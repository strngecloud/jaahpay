import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpendEntity } from '../../database/entities/spend.entity';
import { BankService } from '../../bank/bank.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { LedgerService } from '../../ledger/ledger.service';
import { SpendLimitService } from './spend-limit.service';
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

  /** USDC has 6 decimals on-chain */
  private readonly USDC_DECIMALS_FACTOR = 1e6;
  /** Tolerance for float rounding between quote and on-chain amount */
  private readonly AMOUNT_TOLERANCE_USDC = 2e-6;
  /** Bank statuses that mean the money has actually settled */
  private readonly FINAL_SUCCESS_STATUSES = ['success', 'successful'];
  /** Bank statuses that mean the transfer is already dead */
  private readonly FINAL_FAILURE_STATUSES = ['failed', 'reversed', 'abandoned'];

  constructor(
    @InjectRepository(SpendEntity)
    private readonly spendRepo: Repository<SpendEntity>,
    private readonly bankService: BankService,
    private readonly blockchainService: BlockchainService,
    private readonly ledgerService: LedgerService,
    private readonly spendLimitService: SpendLimitService,
  ) {}

  /**
   * Process SpendInitiated blockchain event
   */
  async processSpendInitiated(event: SpendInitiatedEvent): Promise<void> {
    this.logger.log(`Processing spend initiated: ${event.spendId}`);

    try {
      // Check if spend already exists (bound earlier via confirm-blockchain)
      let spend = await this.spendRepo.findOne({
        where: { spendId: event.spendId },
      });

      if (spend && spend.status !== SpendStatus.PENDING) {
        this.logger.warn(
          `Spend ${event.spendId} already processed with status: ${spend.status}`,
        );
        return;
      }

      // The on-chain event (not the client) is the source of truth for
      // binding: match the escrow to a pending record by sender + amount.
      if (!spend) {
        spend = await this.bindPendingSpend(event);
      }

      // No backend record at all — refund the escrow rather than leaving
      // the user's USDC stuck in the contract.
      if (!spend) {
        this.logger.warn(
          `No matching spend record for on-chain spend ${event.spendId}; refunding escrow`,
        );
        await this.blockchainService.refundSpend(
          event.spendId,
          'No matching spend record',
          event.chain,
        );
        return;
      }

      // Never pay out NGN unless the on-chain escrow actually covers the
      // quoted USDC total for this exact user.
      const escrowedUsdc = Number(event.usdcAmount) / this.USDC_DECIMALS_FACTOR;
      const expectedTotal = spend.usdcAmount + spend.platformFeeUsdc;
      const userMatches =
        spend.userAddress.toLowerCase() === event.user.toLowerCase();
      const amountCovers =
        escrowedUsdc + this.AMOUNT_TOLERANCE_USDC >= expectedTotal;

      if (!userMatches || !amountCovers) {
        this.logger.error(
          `On-chain spend ${event.spendId} does not match record ${spend.spendId}: ` +
            `user ${event.user} vs ${spend.userAddress}, escrowed ${escrowedUsdc} vs expected ${expectedTotal}. Refunding.`,
        );
        await this.failAndRelease(spend, 'On-chain escrow mismatch');
        await this.blockchainService.refundSpend(
          event.spendId,
          'Escrow does not match spend record',
          event.chain,
        );
        return;
      }

      // Lock the escrow on-chain before any money moves off-chain, so the
      // user cannot cancel and reclaim USDC while the NGN is in flight.
      // If this fails we stop here: the spend stays Pending/refundable and
      // no bank transfer has been attempted.
      await this.blockchainService.markProcessing(event.spendId, event.chain);

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
   * Bind an on-chain SpendInitiated event to the pending record it was
   * quoted from, matching by sender address and escrowed amount.
   */
  private async bindPendingSpend(
    event: SpendInitiatedEvent,
  ): Promise<SpendEntity | null> {
    const candidates = await this.spendRepo.find({
      where: {
        userAddress: event.user.toLowerCase(),
        status: SpendStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
    });

    const escrowedUsdc = Number(event.usdcAmount) / this.USDC_DECIMALS_FACTOR;
    const match = candidates.find(
      (c) =>
        Math.abs(c.usdcAmount + c.platformFeeUsdc - escrowedUsdc) <=
        this.AMOUNT_TOLERANCE_USDC,
    );

    if (!match) return null;

    match.spendId = event.spendId;
    try {
      await this.spendRepo.save(match);
    } catch {
      // A concurrent confirm-blockchain call may have bound the ID already;
      // re-read by the on-chain ID.
      return await this.spendRepo.findOne({
        where: { spendId: event.spendId },
      });
    }

    this.logger.log(
      `Bound on-chain spend ${event.spendId} to record for ${event.user}`,
    );
    return match;
  }

  /**
   * Mark a spend as failed and release the reserved spending limits
   */
  private async failAndRelease(
    spend: SpendEntity,
    errorMessage: string,
  ): Promise<void> {
    await this.markSpendAsFailed(spend.spendId, errorMessage);
    await this.spendLimitService.releaseSpend(
      spend.userAddress,
      spend.usdcAmount + spend.platformFeeUsdc,
    );
  }

  /**
   * Execute bank transfer for a spend
   */
  private async executeBankTransfer(spend: SpendEntity): Promise<void> {
    this.logger.log(`Executing bank transfer for spend: ${spend.spendId}`);

    const transferRequest: BankTransferRequest = {
      accountNumber: spend.recipientAccountNumber,
      bankCode: spend.recipientBankCode,
      accountName: spend.recipientAccountName,
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

      const status = (result.status || '').toLowerCase();

      if (!result.success || this.FINAL_FAILURE_STATUSES.includes(status)) {
        throw new Error(result.message || 'Bank transfer failed');
      }

      // Persist the provider reference immediately so status webhooks can
      // find this spend.
      spend.bankReference = result.reference;

      if (this.FINAL_SUCCESS_STATUSES.includes(status)) {
        // Transfer already settled (mock/synchronous providers)
        spend.status = SpendStatus.COMPLETED;
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
        // Transfer accepted but not yet settled (e.g. Paystack 'pending').
        // Stay in PROCESSING; the provider webhook decides COMPLETED/FAILED.
        await this.spendRepo.save(spend);
        this.logger.log(
          `Bank transfer accepted for spend ${spend.spendId} (status: ${result.status}); awaiting provider webhook`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Bank transfer failed for spend ${spend.spendId}:`,
        error,
      );

      // Mark as failed, release limits and trigger refund
      await this.failAndRelease(
        spend,
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
    const cancelled = await this.spendRepo.save(spend);

    // Give the reserved amount back to the user's limits
    await this.spendLimitService.releaseSpend(
      spend.userAddress,
      spend.usdcAmount + spend.platformFeeUsdc,
    );

    return cancelled;
  }
}
