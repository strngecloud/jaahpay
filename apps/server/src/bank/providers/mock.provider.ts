import { Injectable, Logger } from '@nestjs/common';
import { IBankProvider } from '../interfaces/bank-provider.interface';
import {
    BankTransferRequest,
    BankTransferResponse,
    BankAccountValidation,
    BankProvider,
    BankInfo,
} from '../../common/types/spend.types';

@Injectable()
export class MockBankProvider implements IBankProvider {
    private readonly logger = new Logger(MockBankProvider.name);

    // Mock valid accounts configured via environment
    private mockAccounts: Map<string, string> = new Map();

    constructor() {
        // Initialize with default test account from environment
        const accountNumber = process.env.PROVIDUS_ACCOUNT_NUMBER;
        const accountName = process.env.PROVIDUS_ACCOUNT_NAME;
        if (accountNumber && accountName) {
            this.mockAccounts.set(accountNumber, accountName);
        }
    }

    getProviderName(): string {
        return BankProvider.WEMA;
    }

    async initialize(): Promise<void> {
        this.logger.log('Initializing Mock Bank provider (Development mode)');
    }

    async validateAccount(
        accountNumber: string,
        bankCode: string,
    ): Promise<BankAccountValidation> {
        this.logger.debug(`Mock validation for account ${accountNumber}`);

        // Check if this is a configured test account
        const mockName = this.mockAccounts.get(accountNumber);
        if (mockName) {
            return {
                accountNumber,
                bankCode,
                accountName: mockName,
                valid: true,
            };
        }

        // Allow any account with length 10-11 (typical Nigerian account format)
        if (accountNumber.length >= 10 && accountNumber.length <= 11) {
            return {
                accountNumber,
                bankCode,
                accountName: `Test Account ${accountNumber}`,
                valid: true,
            };
        }

        return {
            accountNumber,
            bankCode,
            valid: false,
        };
    }

    async transfer(request: BankTransferRequest): Promise<BankTransferResponse> {
        this.logger.log(`Mock transfer initiated: ${request.reference}`);
        return {
            success: true,
            reference: `MOCK-${request.reference}`,
            status: 'pending',
            message: 'Mock transfer successful',
            data: {
                mockData: true,
            },
        };
    }

    async getTransferStatus(reference: string): Promise<BankTransferResponse> {
        return {
            success: true,
            reference,
            status: 'success',
            message: 'Mock transfer status',
            data: {
                mockData: true,
            },
        };
    }

    async isAvailable(): Promise<boolean> {
        return true;
    }

    async listBanks(): Promise<BankInfo[]> {
        return [
            { code: '035', name: 'Wema Bank' },
            { code: '076', name: 'Zenith Bank' },
            { code: '044', name: 'Access Bank' },
        ];
    }
}
