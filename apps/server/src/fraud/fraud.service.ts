import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { SpendEntity } from '../database/entities/spend.entity';
import { RedisService } from '../redis/redis.service';
import { FraudCheckException } from '../common/exceptions/custom.exceptions';

interface RiskScore {
  velocityRisk: number;
  duplicateRisk: number;
  unusualTimeRisk: number;
  newUserRisk: number;
  highAmountRisk: number;
  totalScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  // Risk thresholds
  private readonly CRITICAL_RISK_THRESHOLD = 70;
  private readonly HIGH_RISK_THRESHOLD = 50;
  private readonly MEDIUM_RISK_THRESHOLD = 30;

  // Velocity limits
  private readonly MAX_TXN_PER_MINUTE = 2;
  private readonly MAX_TXN_PER_HOUR = 10;
  private readonly MAX_TXN_PER_DAY = 50;

  constructor(
    @InjectRepository(SpendEntity)
    private readonly spendRepo: Repository<SpendEntity>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Run comprehensive fraud checks
   */
  async checkTransaction(params: {
    userAddress: string;
    amount: number;
    recipientAccountNumber: string;
    recipientBankCode: string;
    transactionHash?: string;
  }): Promise<{ passed: boolean; riskScore: RiskScore; reason?: string }> {
    const {
      userAddress,
      amount,
      recipientAccountNumber,
      recipientBankCode,
      transactionHash,
    } = params;

    // 1. Check replay attack (if transaction hash provided)
    if (transactionHash) {
      const isReplay = await this.checkReplayAttack(transactionHash);
      if (isReplay) {
        throw new FraudCheckException('Replay attack detected');
      }
    }

    // 2. Check velocity (rate limiting)
    const velocityPassed = await this.checkVelocity(userAddress);
    if (!velocityPassed.passed) {
      throw new FraudCheckException(
        `Velocity limit exceeded: ${velocityPassed.reason}`,
      );
    }

    // 3. Check for duplicate transaction
    const isDuplicate = await this.checkDuplicate(
      userAddress,
      amount,
      recipientAccountNumber,
    );
    if (isDuplicate) {
      throw new FraudCheckException(
        'Duplicate transaction detected within 5 minutes',
      );
    }

    // 4. Calculate risk score
    const riskScore = await this.calculateRiskScore({
      userAddress,
      amount,
      recipientAccountNumber,
      recipientBankCode,
    });

    // 5. Block if risk is too high
    if (riskScore.totalScore >= this.CRITICAL_RISK_THRESHOLD) {
      throw new FraudCheckException(
        `Transaction blocked: Critical risk score ${riskScore.totalScore}`,
      );
    }

    // 6. Log warning for high risk
    if (riskScore.totalScore >= this.HIGH_RISK_THRESHOLD) {
      this.logger.warn(
        `High risk transaction: User ${userAddress}, Score: ${riskScore.totalScore}`,
      );
    }

    return {
      passed: true,
      riskScore,
    };
  }

  /**
   * Check for replay attacks using transaction hash
   */
  private async checkReplayAttack(transactionHash: string): Promise<boolean> {
    const key = `replay:${transactionHash}`;
    const exists = await this.redisService.exists(key);

    if (exists) {
      this.logger.error(`Replay attack detected: ${transactionHash}`);
      return true;
    }

    // Mark as used for 24 hours
    await this.redisService.setex(key, 86400, 'used');
    return false;
  }

  /**
   * Check velocity limits (transactions per time period)
   */
  private async checkVelocity(
    userAddress: string,
  ): Promise<{ passed: boolean; reason?: string }> {
    const now = Date.now();
    const minuteKey = `velocity:minute:${userAddress}`;
    const hourKey = `velocity:hour:${userAddress}`;
    const dayKey = `velocity:day:${userAddress}`;

    // Check per minute
    const minuteCount = await this.redisService.llen(minuteKey);
    if (minuteCount >= this.MAX_TXN_PER_MINUTE) {
      return {
        passed: false,
        reason: `Max ${this.MAX_TXN_PER_MINUTE} transactions per minute`,
      };
    }

    // Check per hour
    const hourCount = await this.redisService.llen(hourKey);
    if (hourCount >= this.MAX_TXN_PER_HOUR) {
      return {
        passed: false,
        reason: `Max ${this.MAX_TXN_PER_HOUR} transactions per hour`,
      };
    }

    // Check per day
    const dayCount = await this.redisService.llen(dayKey);
    if (dayCount >= this.MAX_TXN_PER_DAY) {
      return {
        passed: false,
        reason: `Max ${this.MAX_TXN_PER_DAY} transactions per day`,
      };
    }

    // Record transaction
    await Promise.all([
      this.redisService.lpush(minuteKey, now.toString()),
      this.redisService.expire(minuteKey, 60),
      this.redisService.lpush(hourKey, now.toString()),
      this.redisService.expire(hourKey, 3600),
      this.redisService.lpush(dayKey, now.toString()),
      this.redisService.expire(dayKey, 86400),
    ]);

    return { passed: true };
  }

  /**
   * Check for duplicate transactions (same user, amount, recipient within 5 minutes)
   */
  private async checkDuplicate(
    userAddress: string,
    amount: number,
    recipientAccountNumber: string,
  ): Promise<boolean> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const duplicate = await this.spendRepo.findOne({
      where: {
        userAddress: userAddress.toLowerCase(),
        ngnAmount: amount,
        recipientAccountNumber,
        createdAt: MoreThan(fiveMinutesAgo),
      },
    });

    return !!duplicate;
  }

  /**
   * Calculate comprehensive risk score
   */
  private async calculateRiskScore(params: {
    userAddress: string;
    amount: number;
    recipientAccountNumber: string;
    recipientBankCode: string;
  }): Promise<RiskScore> {
    const { userAddress, amount } = params;

    let velocityRisk = 0;
    const duplicateRisk = 0;
    let unusualTimeRisk = 0;
    let newUserRisk = 0;
    let highAmountRisk = 0;

    // 1. Velocity risk (rapid transactions in last hour)
    const hourKey = `velocity:hour:${userAddress}`;
    const recentTxCount = await this.redisService.llen(hourKey);
    if (recentTxCount > 5) velocityRisk = 20;
    if (recentTxCount > 7) velocityRisk = 30;
    if (recentTxCount > 9) velocityRisk = 40;

    // 2. Check if user is new (first spend)
    const userSpendCount = await this.spendRepo.count({
      where: { userAddress: userAddress.toLowerCase() },
    });
    if (userSpendCount === 0) newUserRisk = 20;

    // 3. High amount risk (>$500 USD equivalent)
    if (amount > 500000) highAmountRisk = 20; // >500k NGN (~$500)
    if (amount > 1000000) highAmountRisk = 30; // >1M NGN (~$1000)
    if (amount > 2000000) highAmountRisk = 40; // >2M NGN (~$2000)

    // 4. Unusual time risk (2 AM - 6 AM)
    const hour = new Date().getHours();
    if (hour >= 2 && hour < 6) unusualTimeRisk = 10;

    const totalScore =
      velocityRisk +
      duplicateRisk +
      unusualTimeRisk +
      newUserRisk +
      highAmountRisk;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (totalScore >= this.CRITICAL_RISK_THRESHOLD) riskLevel = 'critical';
    else if (totalScore >= this.HIGH_RISK_THRESHOLD) riskLevel = 'high';
    else if (totalScore >= this.MEDIUM_RISK_THRESHOLD) riskLevel = 'medium';
    else riskLevel = 'low';

    return {
      velocityRisk,
      duplicateRisk,
      unusualTimeRisk,
      newUserRisk,
      highAmountRisk,
      totalScore,
      riskLevel,
    };
  }

  /**
   * Clean up old velocity records (called by cron job)
   */
  cleanupVelocityRecords(): Promise<void> {
    // Redis handles expiry automatically, but we can log cleanup
    this.logger.log(
      'Velocity records cleanup completed (handled by Redis TTL)',
    );
    return Promise.resolve();
  }
}
