import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LedgerEntryEntity } from '../database/entities/ledger-entry.entity';
import { SpendEntity } from '../database/entities/spend.entity';

export enum AccountType {
    USER_BALANCE = 'user_balance',
    PLATFORM_FEE = 'platform_fee',
    BANK_SETTLEMENT = 'bank_settlement',
    ESCROW = 'escrow',
}

interface LedgerEntry {
    spendId: string;
    accountType: AccountType;
    debitAmount: number;
    creditAmount: number;
    description: string;
}

/**
 * Double-entry bookkeeping ledger system
 * Ensures every debit has a matching credit (accounting principle)
 */
@Injectable()
export class LedgerService {
    private readonly logger = new Logger(LedgerService.name);

    constructor(
        @InjectRepository(LedgerEntryEntity)
        private readonly ledgerRepo: Repository<LedgerEntryEntity>,
        private readonly dataSource: DataSource,
    ) { }

    /**
     * Record a complete spend transaction in the ledger
     * Uses database transaction to ensure atomicity
     */
    async recordSpendTransaction(spend: SpendEntity): Promise<void> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const totalUSDC = spend.usdcAmount + spend.platformFeeUsdc;
            const platformFee = spend.platformFeeUsdc;
            const netAmount = spend.usdcAmount;

            // Entry 1: Debit user balance (money out)
            await this.createEntry(queryRunner, {
                spendId: spend.spendId,
                accountType: AccountType.USER_BALANCE,
                debitAmount: totalUSDC,
                creditAmount: 0,
                description: `User spend initiated: ${spend.spendId}`,
            });

            // Entry 2: Credit escrow (money held)
            await this.createEntry(queryRunner, {
                spendId: spend.spendId,
                accountType: AccountType.ESCROW,
                debitAmount: 0,
                creditAmount: totalUSDC,
                description: `USDC held in escrow: ${spend.spendId}`,
            });

            await queryRunner.commitTransaction();

            this.logger.log(
                `Ledger entries created for spend ${spend.spendId}: Debit ${totalUSDC} USDC`,
            );
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(
                `Failed to record spend transaction ${spend.spendId}:`,
                error,
            );
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Record spend completion (when bank transfer succeeds)
     */
    async recordSpendCompletion(spend: SpendEntity): Promise<void> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const totalUSDC = spend.usdcAmount + spend.platformFeeUsdc;
            const platformFee = spend.platformFeeUsdc;
            const netAmount = spend.usdcAmount;

            // Entry 3: Debit escrow (release funds)
            await this.createEntry(queryRunner, {
                spendId: spend.spendId,
                accountType: AccountType.ESCROW,
                debitAmount: totalUSDC,
                creditAmount: 0,
                description: `Escrow released: ${spend.spendId}`,
            });

            // Entry 4: Credit platform fee
            await this.createEntry(queryRunner, {
                spendId: spend.spendId,
                accountType: AccountType.PLATFORM_FEE,
                debitAmount: 0,
                creditAmount: platformFee,
                description: `Platform fee collected: ${spend.spendId}`,
            });

            // Entry 5: Credit bank settlement (NGN equivalent sent)
            await this.createEntry(queryRunner, {
                spendId: spend.spendId,
                accountType: AccountType.BANK_SETTLEMENT,
                debitAmount: 0,
                creditAmount: netAmount,
                description: `Bank transfer completed: ${spend.ngnAmount} NGN`,
            });

            await queryRunner.commitTransaction();

            this.logger.log(`Spend ${spend.spendId} completion recorded in ledger`);
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(
                `Failed to record spend completion ${spend.spendId}:`,
                error,
            );
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Record spend refund (when bank transfer fails)
     */
    async recordSpendRefund(spend: SpendEntity): Promise<void> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const totalUSDC = spend.usdcAmount + spend.platformFeeUsdc;

            // Entry 3: Debit escrow (release funds)
            await this.createEntry(queryRunner, {
                spendId: spend.spendId,
                accountType: AccountType.ESCROW,
                debitAmount: totalUSDC,
                creditAmount: 0,
                description: `Escrow released for refund: ${spend.spendId}`,
            });

            // Entry 4: Credit user balance (money back)
            await this.createEntry(queryRunner, {
                spendId: spend.spendId,
                accountType: AccountType.USER_BALANCE,
                debitAmount: 0,
                creditAmount: totalUSDC,
                description: `Refund to user: ${spend.spendId}`,
            });

            await queryRunner.commitTransaction();

            this.logger.log(`Spend ${spend.spendId} refund recorded in ledger`);
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(
                `Failed to record spend refund ${spend.spendId}:`,
                error,
            );
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Create a single ledger entry
     */
    private async createEntry(
        queryRunner: any,
        entry: LedgerEntry,
    ): Promise<void> {
        const ledgerEntry = this.ledgerRepo.create({
            spendId: entry.spendId,
            accountType: entry.accountType,
            debitAmount: entry.debitAmount,
            creditAmount: entry.creditAmount,
            description: entry.description,
            isImmutable: true,
        });

        await queryRunner.manager.save(ledgerEntry);
    }

    /**
     * Verify ledger integrity (debits = credits)
     */
    async verifyIntegrity(): Promise<{
        valid: boolean;
        totalDebits: number;
        totalCredits: number;
        difference: number;
    }> {
        const result = await this.ledgerRepo
            .createQueryBuilder('ledger')
            .select('SUM(ledger.debitAmount)', 'totalDebits')
            .addSelect('SUM(ledger.creditAmount)', 'totalCredits')
            .getRawOne();

        const totalDebits = parseFloat(result.totalDebits || 0);
        const totalCredits = parseFloat(result.totalCredits || 0);
        const difference = Math.abs(totalDebits - totalCredits);

        const valid = difference < 0.000001; // Allow for floating point rounding

        if (!valid) {
            this.logger.error(
                `LEDGER INTEGRITY VIOLATION! Debits: ${totalDebits}, Credits: ${totalCredits}, Diff: ${difference}`,
            );
        }

        return {
            valid,
            totalDebits,
            totalCredits,
            difference,
        };
    }

    /**
     * Get ledger entries for a specific spend
     */
    async getEntriesForSpend(spendId: string): Promise<LedgerEntryEntity[]> {
        return await this.ledgerRepo.find({
            where: { spendId },
            order: { createdAt: 'ASC' },
        });
    }

    /**
     * Get account balance
     */
    async getAccountBalance(accountType: AccountType): Promise<number> {
        const result = await this.ledgerRepo
            .createQueryBuilder('ledger')
            .select(
                'SUM(ledger.creditAmount) - SUM(ledger.debitAmount)',
                'balance',
            )
            .where('ledger.accountType = :accountType', { accountType })
            .getRawOne();

        return parseFloat(result.balance || 0);
    }
}
