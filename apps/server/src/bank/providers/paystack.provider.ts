import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IBankProvider } from '../interfaces/bank-provider.interface';
import {
    BankTransferRequest,
    BankTransferResponse,
    BankAccountValidation,
    BankProvider,
} from '../../common/types/spend.types';
import { BankApiException } from '../../common/exceptions/custom.exceptions';

@Injectable()
export class PaystackProvider implements IBankProvider {
    private readonly logger = new Logger(PaystackProvider.name);
    private readonly apiUrl: string;
    private readonly secretKey: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) {
        this.apiUrl = this.configService.get<string>('PAYSTACK_API_URL')!;
        this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY')!;
    }

    getProviderName(): string {
        return BankProvider.PAYSTACK;
    }

    async initialize(): Promise<void> {
        this.logger.log('Initializing Paystack provider...');
        // Paystack doesn't require authentication setup, key is used per request
    }

    async validateAccount(
        accountNumber: string,
        bankCode: string,
    ): Promise<BankAccountValidation> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
                    {
                        headers: {
                            Authorization: `Bearer ${this.secretKey}`,
                            'Content-Type': 'application/json',
                        },
                    },
                ),
            );

            return {
                accountNumber,
                bankCode,
                accountName: response.data.data.account_name,
                valid: response.data.status === true,
            };
        } catch (error: any) {
            this.logger.error('Paystack account validation failed:', error.message);
            return {
                accountNumber,
                bankCode,
                valid: false,
            };
        }
    }

    async transfer(request: BankTransferRequest): Promise<BankTransferResponse> {
        try {
            // First, create transfer recipient
            const recipientResponse = await firstValueFrom(
                this.httpService.post(
                    `${this.apiUrl}/transferrecipient`,
                    {
                        type: 'nuban',
                        name: 'Jahpay User', // You might want to get actual name from validation
                        account_number: request.accountNumber,
                        bank_code: request.bankCode,
                        currency: 'NGN',
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${this.secretKey}`,
                            'Content-Type': 'application/json',
                        },
                    },
                ),
            );

            const recipientCode = recipientResponse.data.data.recipient_code;

            // Then initiate transfer
            const transferResponse = await firstValueFrom(
                this.httpService.post(
                    `${this.apiUrl}/transfer`,
                    {
                        source: 'balance',
                        amount: Math.round(request.amount * 100), // Convert to kobo
                        recipient: recipientCode,
                        reason: request.narration,
                        reference: request.reference,
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${this.secretKey}`,
                            'Content-Type': 'application/json',
                        },
                        timeout: 30000,
                    },
                ),
            );

            return {
                success: transferResponse.data.status === true,
                reference: transferResponse.data.data.reference || request.reference,
                status: transferResponse.data.data.status,
                message: transferResponse.data.message,
                data: transferResponse.data.data,
            };
        } catch (error: any) {
            this.logger.error('Paystack transfer failed:', error.message);
            throw new BankApiException('Paystack', 'Transfer failed', error);
        }
    }

    async getTransferStatus(reference: string): Promise<BankTransferResponse> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.apiUrl}/transfer?reference=${reference}`, {
                    headers: {
                        Authorization: `Bearer ${this.secretKey}`,
                    },
                }),
            );

            const transfer = response.data.data[0];

            return {
                success: response.data.status === true,
                reference,
                status: transfer.status,
                message: response.data.message,
                data: transfer,
            };
        } catch (error: any) {
            this.logger.error('Paystack transfer status check failed:', error.message);
            throw new BankApiException(
                'Paystack',
                'Transfer status check failed',
                error,
            );
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            // Simple health check - verify API key by listing banks
            await firstValueFrom(
                this.httpService.get(`${this.apiUrl}/bank?currency=NGN`, {
                    headers: {
                        Authorization: `Bearer ${this.secretKey}`,
                    },
                    timeout: 5000,
                }),
            );
            return true;
        } catch (error) {
            this.logger.warn('Paystack provider is not available');
            return false;
        }
    }
}
