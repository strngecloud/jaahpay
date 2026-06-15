import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSpendLimitEntity } from '../../database/entities/user-spend-limit.entity';
import { SpendLimits, KYCLevel } from '../../common/types/spend.types';
import { SpendLimitExceededException } from '../../common/exceptions/custom.exceptions';

@Injectable()
export class SpendLimitService {
    private readonly logger = new Logger(SpendLimitService.name);

    constructor(
        @InjectRepository(UserSpendLimitEntity)
        private readonly limitRepo: Repository<UserSpendLimitEntity>,
    ) { }

    /**
     * Get or create user spend limits
     */
    async getUserLimits(userAddress: string): Promise<SpendLimits> {
        let userLimit = await this.limitRepo.findOne({
            where: { userAddress: userAddress.toLowerCase() },
        });

        if (!userLimit) {
            userLimit = await this.createDefaultLimits(userAddress);
        }

        // Reset daily limits if needed
        if (this.shouldResetDaily(userLimit)) {
            await this.resetDailyLimits(userLimit);
        }

        // Reset monthly limits if needed
        if (this.shouldResetMonthly(userLimit)) {
            await this.resetMonthlyLimits(userLimit);
        }

        return {
            dailyLimitUsdc: userLimit.dailyLimitUsdc,
            monthlyLimitUsdc: userLimit.monthlyLimitUsdc,
            dailySpent: userLimit.dailySpentUsdc,
            monthlySpent: userLimit.monthlySpentUsdc,
            isVerified: userLimit.isVerified,
            kycLevel: userLimit.kycLevel,
        };
    }

    /**
     * Check if user can spend the amount
     */
    async checkSpendLimit(
        userAddress: string,
        usdcAmount: number,
    ): Promise<boolean> {
        const limits = await this.getUserLimits(userAddress);

        // Check if blacklisted
        const userLimit = await this.limitRepo.findOne({
            where: { userAddress: userAddress.toLowerCase() },
        });

        if (userLimit?.isBlacklisted) {
            throw new Error(
                `Account is blacklisted: ${userLimit.blacklistReason || 'No reason provided'}`,
            );
        }

        // Check daily limit
        if (limits.dailySpent + usdcAmount > limits.dailyLimitUsdc) {
            throw new SpendLimitExceededException(
                'daily',
                limits.dailyLimitUsdc,
                limits.dailySpent + usdcAmount,
            );
        }

        // Check monthly limit
        if (limits.monthlySpent + usdcAmount > limits.monthlyLimitUsdc) {
            throw new SpendLimitExceededException(
                'monthly',
                limits.monthlyLimitUsdc,
                limits.monthlySpent + usdcAmount,
            );
        }

        return true;
    }

    /**
     * Record a spend
     */
    async recordSpend(userAddress: string, usdcAmount: number): Promise<void> {
        let userLimit = await this.limitRepo.findOne({
            where: { userAddress: userAddress.toLowerCase() },
        });

        if (!userLimit) {
            userLimit = await this.createDefaultLimits(userAddress);
        }

        userLimit.dailySpentUsdc += usdcAmount;
        userLimit.monthlySpentUsdc += usdcAmount;

        await this.limitRepo.save(userLimit);

        this.logger.log(
            `Recorded spend of ${usdcAmount} USDC for ${userAddress}. Daily: ${userLimit.dailySpentUsdc}, Monthly: ${userLimit.monthlySpentUsdc}`,
        );
    }

    /**
     * Create default limits for new user
     */
    private async createDefaultLimits(
        userAddress: string,
    ): Promise<UserSpendLimitEntity> {
        const userLimit = this.limitRepo.create({
            userAddress: userAddress.toLowerCase(),
            dailyLimitUsdc: 100.0,
            monthlyLimitUsdc: 1000.0,
            dailySpentUsdc: 0,
            monthlySpentUsdc: 0,
            kycLevel: KYCLevel.BASIC,
            isVerified: false,
            lastDailyReset: new Date(),
            lastMonthlyReset: new Date(),
        });

        return await this.limitRepo.save(userLimit);
    }

    /**
     * Check if daily limits should be reset
     */
    private shouldResetDaily(userLimit: UserSpendLimitEntity): boolean {
        if (!userLimit.lastDailyReset) return true;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const lastReset = new Date(userLimit.lastDailyReset);
        lastReset.setHours(0, 0, 0, 0);

        return today > lastReset;
    }

    /**
     * Check if monthly limits should be reset
     */
    private shouldResetMonthly(userLimit: UserSpendLimitEntity): boolean {
        if (!userLimit.lastMonthlyReset) return true;

        const today = new Date();
        const lastReset = new Date(userLimit.lastMonthlyReset);

        return (
            today.getMonth() !== lastReset.getMonth() ||
            today.getFullYear() !== lastReset.getFullYear()
        );
    }

    /**
     * Reset daily limits
     */
    private async resetDailyLimits(
        userLimit: UserSpendLimitEntity,
    ): Promise<void> {
        userLimit.dailySpentUsdc = 0;
        userLimit.lastDailyReset = new Date();
        await this.limitRepo.save(userLimit);
        this.logger.log(`Reset daily limits for ${userLimit.userAddress}`);
    }

    /**
     * Reset monthly limits
     */
    private async resetMonthlyLimits(
        userLimit: UserSpendLimitEntity,
    ): Promise<void> {
        userLimit.monthlySpentUsdc = 0;
        userLimit.lastMonthlyReset = new Date();
        await this.limitRepo.save(userLimit);
        this.logger.log(`Reset monthly limits for ${userLimit.userAddress}`);
    }

    /**
     * Update user KYC level (admin function)
     */
    async updateKYCLevel(
        userAddress: string,
        kycLevel: KYCLevel,
    ): Promise<void> {
        const userLimit = await this.limitRepo.findOne({
            where: { userAddress: userAddress.toLowerCase() },
        });

        if (!userLimit) {
            throw new Error('User limits not found');
        }

        // Update limits based on KYC level
        const limits = this.getLimitsByKYCLevel(kycLevel);
        userLimit.kycLevel = kycLevel;
        userLimit.dailyLimitUsdc = limits.daily;
        userLimit.monthlyLimitUsdc = limits.monthly;
        userLimit.isVerified = kycLevel >= KYCLevel.INTERMEDIATE;

        await this.limitRepo.save(userLimit);

        this.logger.log(
            `Updated KYC level to ${kycLevel} for ${userAddress}. New limits: Daily ${limits.daily}, Monthly ${limits.monthly}`,
        );
    }

    /**
     * Get spend limits by KYC level
     */
    private getLimitsByKYCLevel(kycLevel: KYCLevel): {
        daily: number;
        monthly: number;
    } {
        switch (kycLevel) {
            case KYCLevel.BASIC:
                return { daily: 100, monthly: 1000 };
            case KYCLevel.INTERMEDIATE:
                return { daily: 500, monthly: 5000 };
            case KYCLevel.FULL:
                return { daily: 2000, monthly: 20000 };
            default:
                return { daily: 100, monthly: 1000 };
        }
    }

    /**
     * Blacklist user (admin function)
     */
    async blacklistUser(userAddress: string, reason: string): Promise<void> {
        await this.limitRepo.update(
            { userAddress: userAddress.toLowerCase() },
            {
                isBlacklisted: true,
                blacklistReason: reason,
            },
        );

        this.logger.warn(`Blacklisted user ${userAddress}: ${reason}`);
    }

    /**
     * Unblacklist user (admin function)
     */
    async unblacklistUser(userAddress: string): Promise<void> {
        await this.limitRepo.update(
            { userAddress: userAddress.toLowerCase() },
            {
                isBlacklisted: false,
                blacklistReason: '',
            },
        );

        this.logger.log(`Unblacklisted user ${userAddress}`);
    }
}
