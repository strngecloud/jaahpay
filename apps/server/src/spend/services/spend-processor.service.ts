import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpendEntity } from '../../database/entities/spend.entity';
import { BankService } from '../../bank/bank.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { LedgerService } from '../../ledger/ledger.service';
import {
  SpendInitiatedEvent,
  SpendStatus,
  BankTransferRequest,
} from '../../common/types/spend.types';
import {
  SpendNotFoundException,
  SpendAlreadyProcessedException,
} from '../../common/exceptions/custom.exceptions';

@Injectable()
export class SpendProcessorService {
  private readonly logger = new Logger(SpendProcessorService.name);

  constructor(
    @InjectRepository(SpendEntity)
    private readonly spendRepo: Repository<SpendEntity>,
    private readonly bankService: BankService,
    private readonly blockchainService: BlockchainService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Process SpendInitiated blockchain event
   */
  async processSpendInitiated(event: SpendInitiatedEvent): Promise<void> {
    this.logger.log(`Processing spend initiated: ${event.spendId}`);

    try {
      // Check if spend already exists
      const spend = await this.spendRepo.findOne({
        where: { spendId: event.spendId },
      });

      if (spend && spend.status !== SpendStatus.PENDING) {
        this.logger.warn(
          `Spend ${event.spendId} already processed with status: ${spend.status}`,
        );
        return;
      }

      if (!spend) {
        this.logger.error(
          `Spend ${event.spendId} not found in database. This shouldn't happen - spend should be created before blockchain transaction.`,
        );
        return;
      }

      // Update spend with blockchain data
      spend.transactionHash = event.transactionHash;
      spend.blockNumber = event.blockNumber;
      spend.status = SpendStatus.PROCESSING;
      spend.processedAt = new Date();

      await this.spendRepo.save(spend);

      // Record in ledger (double-entry bookkeeping)
      await this.ledgerService.recordSpendTransaction(spend);

      // Execute bank transfer
      await this.executeBankTransfer(spend);
    } catch (error) {
      this.logger.error(
        `Error processing spend initiated ${event.spendId}:`,
        error,
      );

      // Mark as failed
      await this.markSpendAsFailed(
        event.spendId,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Execute bank transfer for a spend
   */
  private async executeBankTransfer(spend: SpendEntity): Promise<void> {
    this.logger.log(`Executing bank transfer for spend: ${spend.spendId}`);

    const transferRequest: BankTransferRequest = {
      accountNumber: spend.recipientAccountNumber,
      bankCode: spend.recipientBankCode,
      amount: spend.ngnAmount,
      narration:
        spend.narration || `Jahpay spend: ${spend.spendId.slice(0, 10)}`,
      reference: `JAHPAY-${spend.spendId.slice(2, 12)}-${Date.now()}`,
    };

    try {
      const result = await this.bankService.transfer(
        transferRequest,
        spend.spendId,
      );

      if (result.success) {
        // Bank transfer successful
        spend.status = SpendStatus.COMPLETED;
        spend.bankReference = result.reference;
        spend.completedAt = new Date();
        await this.spendRepo.save(spend);

        this.logger.log(
          `Bank transfer completed for spend: ${spend.spendId}, ref: ${result.reference}`,
        );

        // Record completion in ledger
        await this.ledgerService.recordSpendCompletion(spend);

        // Call smart contract completeSpend() function
        try {
          await this.blockchainService.completeSpend(
            spend.spendId,
            result.reference,
            spend.chain,
          );
          this.logger.log(
            `Blockchain completion successful for ${spend.spendId}`,
          );
        } catch (blockchainError) {
          this.logger.error(
            `Blockchain completion failed for ${spend.spendId}:`,
            blockchainError,
          );
          // Continue - bank transfer succeeded, we'll retry blockchain call
        }
      } else {
        throw new Error(result.message || 'Bank transfer failed');
      }
    } catch (error) {
      this.logger.error(
        `Bank transfer failed for spend ${spend.spendId}:`,
        error,
      );

      // Mark as failed and trigger refund
      await this.markSpendAsFailed(
        spend.spendId,
        error instanceof Error ? error.message : 'Bank transfer failed',
      );

      // Record refund in ledger
      await this.ledgerService.recordSpendRefund(spend);

      // Call smart contract refundSpend() function
      try {
        await this.blockchainService.refundSpend(
          spend.spendId,
          error instanceof Error ? error.message : 'Bank transfer failed',
          spend.chain,
        );
        this.logger.log(`Blockchain refund successful for ${spend.spendId}`);
      } catch (blockchainError) {
        this.logger.error(
          `Blockchain refund failed for ${spend.spendId}:`,
          blockchainError,
        );
        // Critical: funds stuck in contract, needs manual intervention
      }
    }
  }

  /**
   * Mark spend as failed
   */
  private async markSpendAsFailed(
    spendId: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      await this.spendRepo.update(
        { spendId },
        {
          status: SpendStatus.FAILED,
          errorMessage,
        },
      );
    } catch (error) {
      this.logger.error(`Failed to mark spend as failed: ${spendId}`, error);
    }
  }

  /**
   * Get spend by ID
   */
  async getSpendById(spendId: string): Promise<SpendEntity> {
    const spend = await this.spendRepo.findOne({ where: { spendId } });

    if (!spend) {
      throw new SpendNotFoundException(spendId);
    }

    return spend;
  }

  /**
   * Get spend history for user
   */
  async getSpendHistory(
    userAddress: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    spends: SpendEntity[];
    total: number;
    page: number;
    pages: number;
  }> {
    const [spends, total] = await this.spendRepo.findAndCount({
      where: { userAddress: userAddress.toLowerCase() },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      spends,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Cancel a pending spend
   */
  async cancelSpend(
    spendId: string,
    userAddress: string,
  ): Promise<SpendEntity> {
    const spend = await this.getSpendById(spendId);

    if (spend.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      throw new Error('Unauthorized: You can only cancel your own spends');
    }

    if (spend.status !== SpendStatus.PENDING) {
      throw new SpendAlreadyProcessedException(spendId, spend.status);
    }

    spend.status = SpendStatus.CANCELLED;
    return await this.spendRepo.save(spend);
  }
}
