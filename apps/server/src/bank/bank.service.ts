import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { IBankProvider } from './interfaces/bank-provider.interface';
import { WemaProvider } from './providers/wema.provider';
import { PaystackProvider } from './providers/paystack.provider';
import { MockBankProvider } from './providers/mock.provider';
import {
    BankTransferRequest,
    BankTransferResponse,
    BankAccountValidation,
    BankProvider,
    BankInfo,
} from '../common/types/spend.types';
import { BankApiLogEntity } from '../database/entities/bank-api-log.entity';
import { BankApiException } from '../common/exceptions/custom.exceptions';

@Injectable()
export class BankService implements OnModuleInit {
    private readonly logger = new Logger(BankService.name);
    private providers: Map<BankProvider, IBankProvider> = new Map();
    private providerPriority: BankProvider[] = [
        BankProvider.WEMA,
        BankProvider.PAYSTACK,
    ];

    constructor(
        @InjectRepository(BankApiLogEntity)
        private readonly bankApiLogRepo: Repository<BankApiLogEntity>,
        private readonly configService: ConfigService,
        private readonly wemaProvider: WemaProvider,
        private readonly paystackProvider: PaystackProvider,
        private readonly mockProvider: MockBankProvider,
    ) {
        const isDevelopment = this.configService.get<string>('NODE_ENV') === 'development';

        if (isDevelopment) {
            this.logger.log('Development mode: Using mock bank provider as priority');
            this.providerPriority = [BankProvider.WEMA, BankProvider.PAYSTACK];
            this.providers.set(BankProvider.WEMA, mockProvider);
        } else {
            this.providers.set(BankProvider.WEMA, wemaProvider);
        }

        this.providers.set(BankProvider.PAYSTACK, paystackProvider);
    }

    async onModuleInit() {
        this.logger.log('Initializing bank providers...');

        // Initialize all providers
        for (const [name, provider] of this.providers) {
            try {
                await provider.initialize();
                this.logger.log(`${name} provider initialized successfully`);
            } catch (error) {
                this.logger.error(`Failed to initialize ${name} provider:`, error);
            }
        }
    }

    /**
     * Validate a bank account using the first available provider
     */
    async validateAccount(
        accountNumber: string,
        bankCode: string,
    ): Promise<BankAccountValidation> {
        for (const providerName of this.providerPriority) {
            const provider = this.providers.get(providerName);
            if (!provider) continue;

            try {
                const isAvailable = await provider.isAvailable();
                if (!isAvailable) continue;

                this.logger.log(
                    `Validating account ${accountNumber} using ${providerName}`,
                );
                const result = await provider.validateAccount(accountNumber, bankCode);

                if (result.valid) {
                    return result;
                }
            } catch (error) {
                this.logger.warn(
                    `Account validation failed with ${providerName}:`,
                    error,
                );
                // Continue to next provider
            }
        }

        return {
            accountNumber,
            bankCode,
            valid: false,
        };
    }

    /**
     * Initiate a bank transfer with automatic fallback
     */
    async transfer(
        request: BankTransferRequest,
        spendId: string,
    ): Promise<BankTransferResponse> {
        let lastError: any;

        for (const providerName of this.providerPriority) {
            const provider = this.providers.get(providerName);
            if (!provider) continue;

            const startTime = Date.now();

            try {
                const isAvailable = await provider.isAvailable();
                if (!isAvailable) {
                    this.logger.warn(`${providerName} is not available, trying next provider`);
                    continue;
                }

                this.logger.log(
                    `Initiating transfer via ${providerName} for spend ${spendId}`,
                );

                const result = await provider.transfer(request);
                const responseTime = Date.now() - startTime;

                // Log successful API call
                await this.logApiCall({
                    spendId,
                    apiProvider: providerName,
                    endpoint: 'transfer',
                    requestPayload: this.sanitizeRequest(request),
                    responsePayload: result,
                    statusCode: 200,
                    success: result.success,
                    responseTimeMs: responseTime,
                });

                if (result.success) {
                    this.logger.log(
                        `Transfer successful via ${providerName}: ${result.reference}`,
                    );
                    return result;
                }

                lastError = new Error(result.message || 'Transfer failed');
            } catch (error: any) {
                const responseTime = Date.now() - startTime;
                lastError = error;

                // Log failed API call
                await this.logApiCall({
                    spendId,
                    apiProvider: providerName,
                    endpoint: 'transfer',
                    requestPayload: this.sanitizeRequest(request),
                    responsePayload: null,
                    statusCode: error.response?.status || 500,
                    success: false,
                    errorMessage: error.message,
                    responseTimeMs: responseTime,
                });

                this.logger.error(
                    `Transfer failed with ${providerName}:`,
                    error.message,
                );
                // Continue to next provider
            }
        }

        // All providers failed
        throw new BankApiException(
            'All providers',
            'All bank transfer attempts failed',
            lastError,
        );
    }

    /**
     * Check transfer status
     */
    async getTransferStatus(
        reference: string,
        provider: BankProvider,
    ): Promise<BankTransferResponse> {
        const bankProvider = this.providers.get(provider);
        if (!bankProvider) {
            throw new BankApiException(provider, 'Provider not found');
        }

        try {
            return await bankProvider.getTransferStatus(reference);
        } catch (error: any) {
            throw new BankApiException(
                provider,
                'Failed to get transfer status',
                error,
            );
        }
    }

    /**
     * Log bank API call
     */
    private async logApiCall(data: {
        spendId: string;
        apiProvider: BankProvider;
        endpoint: string;
        requestPayload: any;
        responsePayload: any;
        statusCode: number;
        success: boolean;
        errorMessage?: string;
        responseTimeMs: number;
    }) {
        try {
            const log = this.bankApiLogRepo.create(data);
            await this.bankApiLogRepo.save(log);
        } catch (error) {
            this.logger.error('Failed to log API call:', error);
            // Don't throw - logging failure shouldn't break the flow
        }
    }

    /**
     * Remove sensitive data from request for logging
     */
    private sanitizeRequest(request: BankTransferRequest): any {
        return {
            ...request,
            // Add any sanitization needed
        };
    }

    /**
     * List Nigerian banks from the first available provider
     */
    async listBanks(): Promise<BankInfo[]> {
        for (const providerName of this.providerPriority) {
            const provider = this.providers.get(providerName);
            if (!provider) continue;

            try {
                const isAvailable = await provider.isAvailable();
                if (!isAvailable) continue;

                this.logger.log(`Listing banks via ${providerName}`);
                return await provider.listBanks();
            } catch (error) {
                this.logger.warn(`List banks failed with ${providerName}:`, error);
            }
        }

        throw new BankApiException('All providers', 'Failed to list banks from any provider');
    }

    /**
     * Get all available providers
     */
    async getAvailableProviders(): Promise<string[]> {
        const available: string[] = [];

        for (const [name, provider] of this.providers) {
            try {
                const isAvailable = await provider.isAvailable();
                if (isAvailable) {
                    available.push(name);
                }
            } catch (error) {
                this.logger.warn(`Provider ${name} availability check failed`);
            }
        }

        return available;
    }
}
