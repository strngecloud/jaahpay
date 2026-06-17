import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpendEntity } from '../database/entities/spend.entity';
import { BankService } from '../bank/bank.service';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { SpendLimitService } from './services/spend-limit.service';
import { SpendProcessorService } from './services/spend-processor.service';
import { FraudService } from '../fraud/fraud.service';
import {
  InitiateSpendDto,
  InitiateSpendResponseDto,
  SpendResponseDto,
  GetSpendHistoryDto,
  ValidateAccountDto,
  CancelSpendDto,
} from '../common/dto/spend.dto';
import { SpendStatus } from '../common/types/spend.types';
import { InvalidAccountException } from '../common/exceptions/custom.exceptions';

@Injectable()
export class SpendService {
  private readonly logger = new Logger(SpendService.name);
  private readonly PLATFORM_FEE_BPS = 30; // 0.3%

  constructor(
    @InjectRepository(SpendEntity)
    private readonly spendRepo: Repository<SpendEntity>,
    private readonly bankService: BankService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly spendLimitService: SpendLimitService,
    private readonly spendProcessor: SpendProcessorService,
    private readonly fraudService: FraudService,
  ) {}

  /**
   * Initiate a new spend transaction
   */
  async initiateSpend(
    dto: InitiateSpendDto,
  ): Promise<InitiateSpendResponseDto> {
    this.logger.log(
      `Initiating spend for user ${dto.userAddress}, amount: ${dto.ngnAmount} NGN`,
    );

    // 1. Run fraud checks FIRST (before any other operations)
    try {
      const fraudCheck = await this.fraudService.checkTransaction({
        userAddress: dto.userAddress,
        amount: dto.ngnAmount,
        recipientAccountNumber: dto.recipientAccountNumber,
        recipientBankCode: dto.recipientBankCode,
      });

      this.logger.log(
        `Fraud check passed for ${dto.userAddress}, risk score: ${fraudCheck.riskScore.totalScore}`,
      );
    } catch (fraudError) {
      this.logger.error(`Fraud check failed: ${fraudError.message}`);
      throw fraudError;
    }

    // 2. Validate bank account
    const accountValidation = await this.bankService.validateAccount(
      dto.recipientAccountNumber,
      dto.recipientBankCode,
    );

    if (!accountValidation.valid || !accountValidation.accountName) {
      throw new InvalidAccountException(
        dto.recipientAccountNumber,
        dto.recipientBankCode,
      );
    }

    // 3. Get current exchange rate
    const rate = await this.exchangeRateService.getCurrentRate();
    const usdcAmount = dto.ngnAmount / rate.usdToNgn;

    // 4. Calculate platform fee
    const platformFee = (usdcAmount * this.PLATFORM_FEE_BPS) / 10000;
    const totalUSDCRequired = usdcAmount + platformFee;

    // 5. Check spending limits
    await this.spendLimitService.checkSpendLimit(
      dto.userAddress,
      totalUSDCRequired,
    );

    // 6. Create spend record (before blockchain transaction)
    // Generate a temporary ID that will be replaced by the blockchain spendId
    const tempSpendId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const spend = this.spendRepo.create({
      spendId: tempSpendId,
      userAddress: dto.userAddress.toLowerCase(),
      chain: dto.chain,
      usdcAmount: usdcAmount,
      ngnAmount: dto.ngnAmount,
      exchangeRate: rate.usdToNgn,
      platformFeeUsdc: platformFee,
      recipientAccountNumber: dto.recipientAccountNumber,
      recipientBankCode: dto.recipientBankCode,
      recipientAccountName: accountValidation.accountName,
      narration: dto.narration,
      status: SpendStatus.PENDING,
    });

    await this.spendRepo.save(spend);

    // 7. Record spending against limits
    await this.spendLimitService.recordSpend(
      dto.userAddress,
      totalUSDCRequired,
    );

    this.logger.log(
      `Spend initiated with temp ID: ${tempSpendId}, USDC: ${totalUSDCRequired}`,
    );

    // Return data for frontend to complete blockchain transaction
    return {
      success: true,
      data: {
        spendId: tempSpendId, // Frontend will replace this with actual blockchain spendId
        usdcAmount,
        exchangeRate: rate.usdToNgn,
        platformFee,
        totalUSDCRequired,
        recipientAccountName: accountValidation.accountName,
        estimatedCompletionTime: '2-5 minutes',
      },
    };
  }

  /**
   * Get spend by ID
   */
  async getSpend(spendId: string): Promise<SpendResponseDto> {
    const spend = await this.spendProcessor.getSpendById(spendId);
    return this.mapToDto(spend);
  }

  /**
   * Get spend history for user
   */
  async getSpendHistory(dto: GetSpendHistoryDto) {
    const result = await this.spendProcessor.getSpendHistory(
      dto.userAddress,
      dto.page,
      dto.limit,
    );

    return {
      ...result,
      spends: result.spends.map((s) => this.mapToDto(s)),
    };
  }

  /**
   * Cancel a pending spend
   */
  async cancelSpend(dto: CancelSpendDto): Promise<SpendResponseDto> {
    const spend = await this.spendProcessor.cancelSpend(
      dto.spendId,
      dto.userAddress,
    );
    return this.mapToDto(spend);
  }

  /**
   * Validate a bank account
   */
  async validateAccount(dto: ValidateAccountDto) {
    return await this.bankService.validateAccount(
      dto.accountNumber,
      dto.bankCode,
    );
  }

  /**
   * Get current exchange rate
   */
  async getCurrentRate() {
    const rate = await this.exchangeRateService.getCurrentRate();
    return {
      usdToNgn: rate.usdToNgn,
      lastUpdated: rate.timestamp,
      sources: this.exchangeRateService.getRateSources(),
    };
  }

  /**
   * Update spend with blockchain spendId (called after blockchain transaction)
   */
  async updateSpendId(
    tempSpendId: string,
    blockchainSpendId: string,
  ): Promise<void> {
    await this.spendRepo.update(
      { spendId: tempSpendId },
      { spendId: blockchainSpendId },
    );
    this.logger.log(
      `Updated temp spend ${tempSpendId} to ${blockchainSpendId}`,
    );
  }

  /**
   * Map entity to DTO
   */
  private mapToDto(spend: SpendEntity): SpendResponseDto {
    return {
      spendId: spend.spendId,
      status: spend.status,
      usdcAmount: spend.usdcAmount,
      ngnAmount: spend.ngnAmount,
      exchangeRate: spend.exchangeRate,
      platformFee: spend.platformFeeUsdc,
      recipient: {
        accountName: spend.recipientAccountName || '',
        accountNumber: spend.recipientAccountNumber,
        bank: spend.recipientBankCode,
      },
      bankReference: spend.bankReference,
      createdAt: spend.createdAt,
      completedAt: spend.completedAt,
      errorMessage: spend.errorMessage,
    };
  }
}
