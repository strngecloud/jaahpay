import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { SpendEntity } from '../database/entities/spend.entity';
import { WebhookLogEntity } from '../database/entities/webhook-log.entity';
import { SpendStatus, BankProvider } from '../common/types/spend.types';
import { BlockchainService } from '../blockchain/blockchain.service';
import { RedisService } from '../redis/redis.service';
import { SpendLimitService } from '../spend/services/spend-limit.service';

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
    private readonly spendLimitService: SpendLimitService,
  ) {}

  /**
   * Compare an HMAC SHA512 hex digest of the raw request body against the
   * provider-supplied signature, in constant time. Signing the raw bytes
   * (not a re-serialized JSON object) is required: JSON.stringify does not
   * guarantee the same key order or whitespace the provider signed.
   */
  private verifyHmacSignature(
    rawBody: Buffer | undefined,
    signature: string,
    secret: string | undefined,
    provider: string,
  ): boolean {
    if (!signature || !rawBody) return false;

    if (!secret) {
      this.logger.error(`${provider} webhook secret not configured`);
      return false;
    }

    try {
      const computed = createHmac('sha512', secret)
        .update(rawBody)
        .digest('hex');

      const computedBuf = Buffer.from(computed, 'utf8');
      const signatureBuf = Buffer.from(signature, 'utf8');

      return (
        computedBuf.length === signatureBuf.length &&
        timingSafeEqual(computedBuf, signatureBuf)
      );
    } catch (error) {
      this.logger.error(`Error verifying ${provider} signature:`, error);
      return false;
    }
  }

  /**
   * Verify Flutterwave webhook signature. Flutterwave sends the secret hash
   * configured in the dashboard verbatim in the `verif-hash` header, so this
   * is a constant-time equality check rather than an HMAC of the body.
   */
  verifyFlutterwaveSignature(signature: string): boolean {
    if (!signature) return false;

    const secretHash = this.configService.get<string>(
      'FLUTTERWAVE_SECRET_HASH',
    );
    if (!secretHash) {
      this.logger.error('Flutterwave webhook secret hash not configured');
      return false;
    }

    try {
      const signatureBuf = Buffer.from(signature, 'utf8');
      const secretBuf = Buffer.from(secretHash, 'utf8');

      return (
        signatureBuf.length === secretBuf.length &&
        timingSafeEqual(signatureBuf, secretBuf)
      );
    } catch (error) {
      this.logger.error('Error verifying Flutterwave signature:', error);
      return false;
    }
  }

  /**
   * Verify Paystack webhook signature using HMAC SHA512
   */
  verifyPaystackSignature(
    rawBody: Buffer | undefined,
    signature: string,
  ): boolean {
    return this.verifyHmacSignature(
      rawBody,
      signature,
      this.configService.get<string>('PAYSTACK_SECRET_KEY'),
      'Paystack',
    );
  }

  /**
   * Process Flutterwave webhook for transfer status
   */
  async processFlutterwaveWebhook(payload: any): Promise<void> {
    const { event, data } = payload;

    if (event !== 'transfer.completed') {
      this.logger.log(`Ignoring Flutterwave event: ${event}`);
      return;
    }

    const { reference, status } = data;

    // Check idempotency - prevent duplicate processing
    const idempotencyKey = `webhook:flutterwave:${reference}`;
    const alreadyProcessed = await this.redisService.exists(idempotencyKey);

    if (alreadyProcessed) {
      this.logger.warn(`Webhook already processed: ${reference}`);
      return;
    }

    // Log webhook
    await this.webhookLogRepo.upsert(
      {
        provider: BankProvider.FLUTTERWAVE,
        webhookId: reference,
        payload,
        processedAt: new Date(),
        status: 'received',
      },
      ['webhookId'],
    );

    // Find spend by bank reference
    const spend = await this.spendRepo.findOne({
      where: { bankReference: reference },
    });

    if (!spend) {
      this.logger.error(`Spend not found for webhook reference: ${reference}`);
      return;
    }

    // Update spend based on transfer status
    if (status === 'SUCCESSFUL') {
      await this.handleSuccessfulTransfer(spend, reference);
    } else if (status === 'FAILED') {
      await this.handleFailedTransfer(
        spend,
        data.complete_message || 'Transfer failed',
      );
    }

    // Only mark processed once processing actually succeeded, so a retry
    // after a mid-processing crash is not silently skipped (24 hour expiry).
    await this.redisService.setex(idempotencyKey, 86400, 'processed');
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

    const { reference } = data;

    // Check idempotency
    const idempotencyKey = `webhook:paystack:${reference}`;
    const alreadyProcessed = await this.redisService.exists(idempotencyKey);

    if (alreadyProcessed) {
      this.logger.warn(`Webhook already processed: ${reference}`);
      return;
    }

    // Log webhook
    await this.webhookLogRepo.upsert(
      {
        provider: BankProvider.PAYSTACK,
        webhookId: reference,
        payload,
        processedAt: new Date(),
        status: 'received',
      },
      ['webhookId'],
    );

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

    // Only mark processed once processing actually succeeded, so a retry
    // after a mid-processing crash is not silently skipped (24 hour expiry).
    await this.redisService.setex(idempotencyKey, 86400, 'processed');
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

      // Give the reserved amount back to the user's limits
      await this.spendLimitService.releaseSpend(
        spend.userAddress,
        spend.usdcAmount + spend.platformFeeUsdc,
      );

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
