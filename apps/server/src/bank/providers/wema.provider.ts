import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createHmac } from 'crypto';
import { IBankProvider } from '../interfaces/bank-provider.interface';
import {
    BankTransferRequest,
    BankTransferResponse,
    BankAccountValidation,
    BankProvider,
    BankInfo,
} from '../../common/types/spend.types';
import { BankApiException } from '../../common/exceptions/custom.exceptions';

@Injectable()
export class WemaProvider implements IBankProvider {
    private readonly logger = new Logger(WemaProvider.name);

    private readonly apiUrl: string;
    private readonly apiKey: string;
    private readonly saltKey: string;
    private readonly sourceAccount: string;
    private readonly callbackUrl: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) {
        this.apiUrl = this.configService.get<string>('WEMA_API_URL')!;
        this.apiKey = this.configService.get<string>('WEMA_API_KEY')!;
        this.saltKey = this.configService.get<string>('WEMA_SALT_KEY')!;
        this.sourceAccount = this.configService.get<string>('WEMA_SOURCE_ACCOUNT')!;
        this.callbackUrl = this.configService.get<string>('WEMA_CALLBACK_URL')!;
    }

    getProviderName(): string {
        return BankProvider.WEMA;
    }

    /**
     * Computes HMAC SHA512 hash for transfer requests
     * Format: transactionReference + destinationBankCode + destinationAccountNumber + sourceAccountNumber + amount
     */
    private computeHash(
        transactionReference: string,
        destinationBankCode: string,
        destinationAccountNumber: string,
        sourceAccountNumber: string,
        amount: number,
    ): string {
        const message = `${transactionReference}${destinationBankCode}${destinationAccountNumber}${sourceAccountNumber}${amount}`;
        const hmac = createHmac('sha512', this.saltKey);
        hmac.update(message);
        return hmac.digest('hex');
    }

    async initialize(): Promise<void> {
        this.logger.log('Initializing Wema Bank provider...');
        // Wema uses subscription key authentication, no OAuth needed
        this.logger.log('Wema provider ready (uses subscription key auth)');
    }

    async validateAccount(
        accountNumber: string,
        bankCode: string,
    ): Promise<BankAccountValidation> {
        try {
            // URL: /Shared/AccountNameEnquiry/{bankCode}/{accountNumber}
            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/Shared/AccountNameEnquiry/${bankCode}/${accountNumber}`,
                    {
                        headers: {
                            'Ocp-Apim-Subscription-Key': this.apiKey,
                        },
                        timeout: 15000,
                    },
                ),
            );

            const isValid = response.data.successful === true;

            return {
                accountNumber,
                bankCode,
                accountName: response.data.result?.accountName || response.data.result?.account_name,
                valid: isValid,
            };
        } catch (error: any) {
            this.logger.error('Wema account validation failed:', error.message);
            return {
                accountNumber,
                bankCode,
                valid: false,
            };
        }
    }

    async transfer(request: BankTransferRequest): Promise<BankTransferResponse> {
        try {
            // Validate required configuration
            if (!this.saltKey) {
                throw new Error('WEMA_SALT_KEY is not configured');
            }
            if (!this.sourceAccount) {
                throw new Error('WEMA_SOURCE_ACCOUNT is not configured');
            }

            // Compute hash
            const hash = this.computeHash(
                request.reference,
                request.bankCode,
                request.accountNumber,
                this.sourceAccount,
                request.amount,
            );

            // URL: /OpenApiTransfer/transfer-fund-request
            const response = await firstValueFrom(
                this.httpService.post(
                    `${this.apiUrl}/OpenApiTransfer/transfer-fund-request`,
                    {
                        amount: request.amount,
                        narration: request.narration,
                        transactionReference: request.reference,
                        destinationBankCode: request.bankCode,
                        destinationBankName: '', // Optional
                        destinationAccountNumber: request.accountNumber,
                        destinationAccountName: '', // Optional
                        sourceAccountNumber: this.sourceAccount,
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Ocp-Apim-Subscription-Key': this.apiKey,
                            'hash': hash,
                        },
                        timeout: 30000,
                    },
                ),
            );

            // Response returns "Pending" status initially, callback will provide final status
            const isSuccessful = response.data.successful === true;

            return {
                success: isSuccessful,
                reference: response.data.result?.platformTransactionReference || request.reference,
                status: response.data.result?.status || (isSuccessful ? 'pending' : 'failed'),
                message: response.data.message || response.data.result?.message,
                data: response.data,
            };
        } catch (error: any) {
            this.logger.error('Wema transfer failed:', error.message);
            if (error.response?.data) {
                this.logger.error('Response:', JSON.stringify(error.response.data));
            }
            throw new BankApiException('Wema', 'Transfer failed', error);
        }
    }

    async getTransferStatus(reference: string): Promise<BankTransferResponse> {
        try {
            // Status endpoint might be similar pattern - adjust if needed
            const response = await firstValueFrom(
                this.httpService.get(`${this.apiUrl}/OpenApiTransfer/transfer-status/${reference}`, {
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.apiKey,
                    },
                    timeout: 15000,
                }),
            );

            return {
                success: response.data.successful === true,
                reference,
                status: response.data.successful ? 'success' : 'failed',
                message: response.data.message,
                data: response.data,
            };
        } catch (error: any) {
            this.logger.error('Wema transfer status check failed:', error.message);
            throw new BankApiException(
                'Wema',
                'Transfer status check failed',
                error,
            );
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            // Test availability by calling GetAllBanks
            await firstValueFrom(
                this.httpService.get(`${this.apiUrl}/OpenApiTransfer/GetAllBanks`, {
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.apiKey,
                    },
                    timeout: 10000,
                }),
            );
            return true;
        } catch (error) {
            this.logger.warn('Wema provider is not available');
            return false;
        }
    }

    async listBanks(): Promise<BankInfo[]> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.apiUrl}/OpenApiTransfer/GetAllBanks`, {
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.apiKey,
                    },
                    timeout: 15000,
                }),
            );

            const banks: BankInfo[] = (response.data.result || [])
                .filter((b: { bankCode?: string; bankName?: string }) => b.bankCode && b.bankName)
                .map((b: { bankCode: string; bankName: string }) => ({
                    code: b.bankCode,
                    name: b.bankName,
                }));

            return banks.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error: any) {
            this.logger.error('Wema list banks failed:', error.message);
            throw new BankApiException('Wema', 'Failed to list banks', error);
        }
    }
}
