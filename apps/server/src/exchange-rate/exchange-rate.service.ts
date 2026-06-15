import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExchangeRate } from '../common/types/spend.types';
import { ExchangeRateException } from '../common/exceptions/custom.exceptions';

@Injectable()
export class ExchangeRateService {
    private readonly logger = new Logger(ExchangeRateService.name);
    private currentRate: ExchangeRate | null = null;
    private readonly MAX_RATE_AGE_MS = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_RATE_DEVIATION = 0.05; // 5%

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) { }

    /**
     * Get current USD to NGN exchange rate
     */
    async getCurrentRate(): Promise<ExchangeRate> {
        if (this.isRateStale()) {
            await this.updateRate();
        }

        if (!this.currentRate) {
            throw new ExchangeRateException('Exchange rate not available');
        }

        return this.currentRate;
    }

    /**
     * Update exchange rate from multiple sources
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async updateRate(): Promise<void> {
        this.logger.log('Updating exchange rate...');

        const rates = await Promise.allSettled([
            this.getBinanceRate(),
            this.getCoingeckoRate(),
            // Add more sources as needed
        ]);

        const validRates = rates
            .filter((r) => r.status === 'fulfilled')
            .map((r) => (r as PromiseFulfilledResult<ExchangeRate>).value);

        if (validRates.length === 0) {
            this.logger.error('Failed to fetch exchange rate from any source');
            return;
        }

        // Calculate median rate for reliability
        const sortedRates = validRates
            .map((r) => r.usdToNgn)
            .sort((a, b) => a - b);
        let medianRate =
            sortedRates.length % 2 === 0
                ? (sortedRates[sortedRates.length / 2 - 1] +
                    sortedRates[sortedRates.length / 2]) /
                2
                : sortedRates[Math.floor(sortedRates.length / 2)];

        // Validate rate against deviation
        if (this.currentRate && this.isRateDeviationExcessive(medianRate)) {
            this.logger.warn(
                `Exchange rate deviation too high: ${medianRate} vs ${this.currentRate.usdToNgn}`,
            );
            // Use average instead
            const avgRate =
                validRates.reduce((sum, r) => sum + r.usdToNgn, 0) / validRates.length;
            medianRate = avgRate;
        }

        this.currentRate = {
            usdToNgn: medianRate,
            source: validRates.map((r) => r.source).join(', '),
            timestamp: new Date(),
            confidence: validRates.length / rates.length,
        };

        this.logger.log(
            `Exchange rate updated: 1 USD = ${medianRate.toFixed(2)} NGN (sources: ${validRates.length})`,
        );
    }

    /**
     * Get rate from Binance
     */
    private async getBinanceRate(): Promise<ExchangeRate> {
        try {
            const binanceUrl = this.configService.get<string>('BINANCE_API_URL');

            // Get USDT/NGN if available, or use USDT/USDC * USDC/NGN
            const response = await firstValueFrom(
                this.httpService.get(
                    `${binanceUrl}/api/v3/ticker/price?symbol=USDTNGN`,
                    { timeout: 5000 },
                ),
            );

            const rate = parseFloat(response.data.price);

            return {
                usdToNgn: rate,
                source: 'binance',
                timestamp: new Date(),
                confidence: 0.9,
            };
        } catch (error) {
            this.logger.warn('Failed to fetch rate from Binance:', error);
            throw error;
        }
    }

    /**
     * Get rate from CoinGecko
     */
    private async getCoingeckoRate(): Promise<ExchangeRate> {
        try {
            const coingeckoUrl = this.configService.get<string>('COINGECKO_API_URL');

            const response = await firstValueFrom(
                this.httpService.get(
                    `${coingeckoUrl}/simple/price?ids=usd&vs_currencies=ngn`,
                    { timeout: 5000 },
                ),
            );

            const rate = response.data.usd.ngn;

            return {
                usdToNgn: rate,
                source: 'coingecko',
                timestamp: new Date(),
                confidence: 0.85,
            };
        } catch (error) {
            this.logger.warn('Failed to fetch rate from CoinGecko:', error);
            throw error;
        }
    }

    /**
     * Check if current rate is stale
     */
    private isRateStale(): boolean {
        if (!this.currentRate) return true;

        const age = Date.now() - this.currentRate.timestamp.getTime();
        return age > this.MAX_RATE_AGE_MS;
    }

    /**
     * Check if rate deviation is excessive
     */
    private isRateDeviationExcessive(newRate: number): boolean {
        if (!this.currentRate) return false;

        const deviation =
            Math.abs(newRate - this.currentRate.usdToNgn) / this.currentRate.usdToNgn;
        return deviation > this.MAX_RATE_DEVIATION;
    }

    /**
     * Convert USDC to NGN
     */
    async usdcToNgn(usdcAmount: number): Promise<number> {
        const rate = await this.getCurrentRate();
        return usdcAmount * rate.usdToNgn;
    }

    /**
     * Convert NGN to USDC
     */
    async ngnToUsdc(ngnAmount: number): Promise<number> {
        const rate = await this.getCurrentRate();
        return ngnAmount / rate.usdToNgn;
    }

    /**
     * Get rate sources for transparency
     */
    getRateSources(): string[] {
        return this.currentRate?.source.split(', ') || [];
    }
}
