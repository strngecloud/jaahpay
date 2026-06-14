import { Controller, Get, Param } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';

@Controller('rates')
export class ExchangeRateController {
    constructor(private readonly exchangeRateService: ExchangeRateService) { }

    /**
     * GET /api/v1/rates/current
     * Get current USD to NGN exchange rate
     */
    @Get('current')
    async getCurrentRate() {
        const rate = await this.exchangeRateService.getCurrentRate();
        return {
            usdToNgn: rate.usdToNgn,
            lastUpdated: rate.timestamp,
            sources: this.exchangeRateService.getRateSources(),
            confidence: rate.confidence,
        };
    }

    /**
     * GET /api/v1/rates/convert-usdc-to-ngn/:amount
     * Convert USDC to NGN
     */
    @Get('convert-usdc-to-ngn/:amount')
    async convertUsdcToNgn(@Param('amount') amount: number) {
        const ngnAmount = await this.exchangeRateService.usdcToNgn(amount);
        const rate = await this.exchangeRateService.getCurrentRate();

        return {
            usdc: amount,
            ngn: ngnAmount,
            rate: rate.usdToNgn,
            timestamp: rate.timestamp,
        };
    }

    /**
     * GET /api/v1/rates/convert-ngn-to-usdc/:amount
     * Convert NGN to USDC
     */
    @Get('convert-ngn-to-usdc/:amount')
    async convertNgnToUsdc(@Param('amount') amount: number) {
        const usdcAmount = await this.exchangeRateService.ngnToUsdc(amount);
        const rate = await this.exchangeRateService.getCurrentRate();

        return {
            ngn: amount,
            usdc: usdcAmount,
            rate: rate.usdToNgn,
            timestamp: rate.timestamp,
        };
    }
}
