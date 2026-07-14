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
  private readonly isDevelopment: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';

    if (this.isDevelopment) {
      this.logger.log(
        'Development mode: Using fixed exchange rate of 1370 NGN/USD',
      );
      this.currentRate = {
        usdToNgn: 1370,
        source: 'development-fixed',
        timestamp: new Date(),
        confidence: 1.0,
      };
    }
  }

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
    // Skip API calls in development mode - use fixed rate
    if (this.isDevelopment) {
      this.logger.debug('Development mode: Skipping exchange rate API update');
      return;
    }

    this.logger.log('Updating exchange rate...');

    const rates = await Promise.allSettled([
      this.getCoingeckoRate('usd-coin', 'coingecko-usdc'),
      this.getCoingeckoRate('tether', 'coingecko-usdt'),
      // Add more sources as needed (Binance delisted NGN pairs in 2024)
    ]);

    const validRates = rates
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);

    if (validRates.length === 0) {
      this.logger.error('Failed to fetch exchange rate from any source');
      return;
    }

    // Calculate median rate for reliability
    const sortedRates = validRates.map((r) => r.usdToNgn).sort((a, b) => a - b);
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
   * Get an NGN rate for a stablecoin from CoinGecko.
   * Valid coin ids: 'usd-coin' (USDC), 'tether' (USDT). Note there is no
   * CoinGecko id 'usd' - the old query returned nothing.
   */
  private async getCoingeckoRate(
    coinId: string,
    sourceName: string,
  ): Promise<ExchangeRate> {
    try {
      const coingeckoUrl =
        this.configService.get<string>('COINGECKO_API_URL') ||
        'https://api.coingecko.com/api/v3';

      const response = await firstValueFrom(
        this.httpService.get(
          `${coingeckoUrl}/simple/price?ids=${coinId}&vs_currencies=ngn`,
          { timeout: 5000 },
        ),
      );

      const rate = response.data?.[coinId]?.ngn;

      if (typeof rate !== 'number' || !(rate > 0)) {
        throw new Error(`Invalid NGN rate for ${coinId}: ${rate}`);
      }

      return {
        usdToNgn: rate,
        source: sourceName,
        timestamp: new Date(),
        confidence: 0.85,
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch ${coinId} rate from CoinGecko:`, error);
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
