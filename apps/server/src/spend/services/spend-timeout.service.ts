import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { SpendEntity } from '../../database/entities/spend.entity';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { SpendStatus } from '../../common/types/spend.types';

@Injectable()
export class SpendTimeoutService {
    private readonly logger = new Logger(SpendTimeoutService.name);
    private readonly TIMEOUT_MINUTES = 15;

    constructor(
        @InjectRepository(SpendEntity)
        private readonly spendRepo: Repository<SpendEntity>,
        private readonly blockchainService: BlockchainService,
    ) { }

    /**
     * Run every 5 minutes to check for timed out spends
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async checkTimedOutSpends() {
        try {
            const timeoutThreshold = new Date(
                Date.now() - this.TIMEOUT_MINUTES * 60 * 1000,
            );

            // Find all pending spends older than 15 minutes
            const timedOutSpends = await this.spendRepo.find({
                where: {
                    status: SpendStatus.PENDING,
                    createdAt: LessThan(timeoutThreshold),
                },
                take: 100, // Process in batches
            });

            if (timedOutSpends.length === 0) {
                return;
            }

            this.logger.log(
                `Found ${timedOutSpends.length} timed out spends, processing...`,
            );

            for (const spend of timedOutSpends) {
                await this.processTimedOutSpend(spend);
            }
        } catch (error) {
            this.logger.error('Error checking timed out spends:', error);
        }
    }

    /**
     * Process a single timed out spend
     */
    private async processTimedOutSpend(spend: SpendEntity): Promise<void> {
        try {
            this.logger.log(`Processing timed out spend: ${spend.spendId}`);

            // Call blockchain emergencyRefund
            await this.blockchainService.handleTimedOutSpend(
                spend.spendId,
                spend.chain,
            );

            // Update database
            spend.status = SpendStatus.REFUNDED;
            spend.errorMessage = 'Transaction timed out after 15 minutes';
            await this.spendRepo.save(spend);

            this.logger.log(
                `Successfully refunded timed out spend: ${spend.spendId}`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to process timed out spend ${spend.spendId}:`,
                error,
            );
        }
    }

    /**
     * Manually trigger timeout check (for testing)
     */
    async checkNow(): Promise<number> {
        await this.checkTimedOutSpends();
        return (await this.spendRepo.count({
            where: { status: SpendStatus.PENDING },
        }));
    }
}
