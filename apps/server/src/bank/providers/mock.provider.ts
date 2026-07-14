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

  initialize(): Promise<void> {
    this.logger.log('Initializing Mock Bank provider (Development mode)');
    return Promise.resolve();
  }

  validateAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<BankAccountValidation> {
    this.logger.debug(`Mock validation for account ${accountNumber}`);

    // Check if this is a configured test account
    const mockName = this.mockAccounts.get(accountNumber);
    if (mockName) {
      return Promise.resolve({
        accountNumber,
        bankCode,
        accountName: mockName,
        valid: true,
      });
    }

    // Allow any account with length 10-11 (typical Nigerian account format)
    if (accountNumber.length >= 10 && accountNumber.length <= 11) {
      return Promise.resolve({
        accountNumber,
        bankCode,
        accountName: `Test Account ${accountNumber}`,
        valid: true,
      });
    }

    return Promise.resolve({
      accountNumber,
      bankCode,
      valid: false,
    });
  }

  transfer(request: BankTransferRequest): Promise<BankTransferResponse> {
    this.logger.log(`Mock transfer initiated: ${request.reference}`);
    return Promise.resolve({
      success: true,
      reference: `MOCK-${request.reference}`,
      // Settle immediately: there is no webhook in development to move a
      // 'pending' transfer forward.
      status: 'success',
      message: 'Mock transfer successful',
      data: {
        mockData: true,
      },
    });
  }

  getTransferStatus(reference: string): Promise<BankTransferResponse> {
    return Promise.resolve({
      success: true,
      reference,
      status: 'success',
      message: 'Mock transfer status',
      data: {
        mockData: true,
      },
    });
  }

  isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }

  listBanks(): Promise<BankInfo[]> {
    return Promise.resolve([
      { code: '035', name: 'Wema Bank' },
      { code: '076', name: 'Zenith Bank' },
      { code: '044', name: 'Access Bank' },
    ]);
  }
}
