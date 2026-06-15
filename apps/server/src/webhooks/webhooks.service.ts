import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac } from 'crypto';
import { SpendEntity } from '../database/entities/spend.entity';
import { WebhookLogEntity } from '../database/entities/webhook-log.entity';
import { SpendStatus, BankProvider } from '../common/types/spend.types';
import { BlockchainService } from '../blockchain/blockchain.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SpendEntity)
    private readonly spendRepo: Repository<SpendEntity>,
    @InjectRepository(WebhookLogEntity)
    private readonly webhookLogRepo: Repository<WebhookLogEntity>,
    private readonly blockchainService: BlockchainService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Verify Wema webhook signature using HMAC SHA512
   */
  async verifyWemaSignature(payload: any, signature: string): Promise<boolean> {
    if (!signature) return false;

    const saltKey = this.configService.get<string>('WEMA_SALT_KEY');
    if (!saltKey) {
      this.logger.error('WEMA_SALT_KEY not configured');
      return false;
    }

    try {
      const payloadString = JSON.stringify(payload);
      const hmac = createHmac('sha512', saltKey);
      hmac.update(payloadString);
      const computedSignature = hmac.digest('hex');

      return computedSignature === signature;
    } catch (error) {
      this.logger.error('Error verifying Wema signature:', error);
      return false;
    }
  }

  /**
   * Verify Paystack webhook signature using HMAC SHA512
   */
  async verifyPaystackSignature(
    payload: any,
    signature: string,
  ): Promise<boolean> {
    if (!signature) return false;

    const secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      this.logger.error('PAYSTACK_SECRET_KEY not configured');
      return false;
    }

    try {
      const payloadString = JSON.stringify(payload);
      const hmac = createHmac('sha512', secretKey);
      hmac.update(payloadString);
      const computedSignature = hmac.digest('hex');

      return computedSignature === signature;
    } catch (error) {
      this.logger.error('Error verifying Paystack signature:', error);
      return false;
    }
  }

  /**
   * Process Wema webhook for bank transfer status
   */
  async processWemaWebhook(payload: any): Promise<void> {
    const {
      transactionReference,
      platformTransactionReference,
      status,
      amount,
      narration,
    } = payload;

    // Check idempotency - prevent duplicate processing
    const idempotencyKey = `webhook:wema:${transactionReference}`;
    const alreadyProcessed = await this.redisService.exists(idempotencyKey);

    if (alreadyProcessed) {
      this.logger.warn(`Webhook already processed: ${transactionReference}`);
      return;
    }

    // Mark as processed (24 hour expiry)
    await this.redisService.setex(idempotencyKey, 86400, 'processed');

    // Log webhook
    await this.webhookLogRepo.save({
      provider: BankProvider.WEMA,
      webhookId: transactionReference,
      payload,
      processedAt: new Date(),
      status: 'received',
    });

    // Find spend by bank reference
    const spend = await this.spendRepo.findOne({
      where: { bankReference: transactionReference },
    });

    if (!spend) {
      this.logger.error(
        `Spend not found for webhook reference: ${transactionReference}`,
      );
      return;
    }

    // Update spend based on bank status
    if (status === 'Successful' || status === 'Success') {
      await this.handleSuccessfulTransfer(spend, platformTransactionReference);
    } else if (status === 'Failed' || status === 'Declined') {
      await this.handleFailedTransfer(
        spend,
        payload.message || 'Transfer failed',
      );
    }
  }

  /**
   * Process Paystack webhook for transfer status
   */
  async processPaystackWebhook(payload: any): Promise<void> {
    const { event, data } = payload;

    if (event !== 'transfer.success' && event !== 'transfer.failed') {
      this.logger.log(`Ignoring Paystack event: ${event}`);
      return;
    }

    const { reference, status, recipient } = data;

    // Check idempotency
    const idempotencyKey = `webhook:paystack:${reference}`;
    const alreadyProcessed = await this.redisService.exists(idempotencyKey);

    if (alreadyProcessed) {
      this.logger.warn(`Webhook already processed: ${reference}`);
      return;
    }

    await this.redisService.setex(idempotencyKey, 86400, 'processed');

    // Log webhook
    await this.webhookLogRepo.save({
      provider: BankProvider.PAYSTACK,
      webhookId: reference,
      payload,
      processedAt: new Date(),
      status: 'received',
    });

    // Find spend by bank reference
    const spend = await this.spendRepo.findOne({
      where: { bankReference: reference },
    });

    if (!spend) {
      this.logger.error(`Spend not found for webhook reference: ${reference}`);
      return;
    }

    // Update spend based on status
    if (event === 'transfer.success') {
      await this.handleSuccessfulTransfer(spend, reference);
    } else {
      await this.handleFailedTransfer(spend, data.message || 'Transfer failed');
    }
  }

  /**
   * Handle successful bank transfer
   */
  private async handleSuccessfulTransfer(
    spend: SpendEntity,
    bankReference: string,
  ): Promise<void> {
    if (spend.status !== SpendStatus.PROCESSING) {
      this.logger.warn(
        `Spend ${spend.spendId} not in PROCESSING state, skipping`,
      );
      return;
    }

    try {
      // Update database
      spend.status = SpendStatus.COMPLETED;
      spend.bankReference = bankReference;
      spend.completedAt = new Date();
      await this.spendRepo.save(spend);

      this.logger.log(`Bank transfer successful for spend ${spend.spendId}`);

      // Call smart contract completeSpend()
      await this.blockchainService.completeSpend(
        spend.spendId,
        bankReference,
        spend.chain,
      );

      this.logger.log(
        `Blockchain completion successful for spend ${spend.spendId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling successful transfer for ${spend.spendId}:`,
        error,
      );
      // Don't throw - webhook already processed
    }
  }

  /**
   * Handle failed bank transfer
   */
  private async handleFailedTransfer(
    spend: SpendEntity,
    reason: string,
  ): Promise<void> {
    if (
      spend.status !== SpendStatus.PROCESSING &&
      spend.status !== SpendStatus.PENDING
    ) {
      this.logger.warn(
        `Spend ${spend.spendId} not in processable state, skipping`,
      );
      return;
    }

    try {
      // Update database
      spend.status = SpendStatus.FAILED;
      spend.errorMessage = reason;
      await this.spendRepo.save(spend);

      this.logger.log(
        `Bank transfer failed for spend ${spend.spendId}: ${reason}`,
      );

      // Call smart contract refundSpend()
      await this.blockchainService.refundSpend(
        spend.spendId,
        reason,
        spend.chain,
      );

      this.logger.log(
        `Blockchain refund successful for spend ${spend.spendId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling failed transfer for ${spend.spendId}:`,
        error,
      );
      // Don't throw - webhook already processed
    }
  }
}
