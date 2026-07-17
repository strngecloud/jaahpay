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
  BankInfo,
} from '../../common/types/spend.types';
import { BankApiException } from '../../common/exceptions/custom.exceptions';

@Injectable()
export class FlutterwaveProvider implements IBankProvider {
  private readonly logger = new Logger(FlutterwaveProvider.name);
  private readonly apiUrl: string;
  private readonly secretKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiUrl = this.configService.get<string>('FLUTTERWAVE_API_URL')!;
    this.secretKey = this.configService.get<string>('FLUTTERWAVE_SECRET_KEY')!;
  }

  getProviderName(): string {
    return BankProvider.FLUTTERWAVE;
  }

  async initialize(): Promise<void> {
    this.logger.log('Initializing Flutterwave provider...');
    // Flutterwave uses a bearer secret key per request, no auth setup needed
    await Promise.resolve();
  }

  async validateAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<BankAccountValidation> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/accounts/resolve`,
          {
            account_number: accountNumber,
            account_bank: bankCode,
          },
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
        valid: response.data.status === 'success',
      };
    } catch (error: any) {
      this.logger.error(
        'Flutterwave account validation failed:',
        error.message,
      );
      return {
        accountNumber,
        bankCode,
        valid: false,
      };
    }
  }

  async transfer(request: BankTransferRequest): Promise<BankTransferResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/transfers`,
          {
            account_bank: request.bankCode,
            account_number: request.accountNumber,
            // Flutterwave expects the amount in naira, not kobo
            amount: request.amount,
            currency: 'NGN',
            narration: request.narration,
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
        success: response.data.status === 'success',
        reference: response.data.data.reference || request.reference,
        status: response.data.data.status,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error: any) {
      this.logger.error('Flutterwave transfer failed:', error.message);
      throw new BankApiException('Flutterwave', 'Transfer failed', error);
    }
  }

  async getTransferStatus(reference: string): Promise<BankTransferResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/transfers?reference=${reference}`,
          {
            headers: {
              Authorization: `Bearer ${this.secretKey}`,
            },
          },
        ),
      );

      const transfer = response.data.data[0];

      return {
        success: response.data.status === 'success',
        reference,
        status: transfer.status,
        message: response.data.message,
        data: transfer,
      };
    } catch (error: any) {
      this.logger.error(
        'Flutterwave transfer status check failed:',
        error.message,
      );
      throw new BankApiException(
        'Flutterwave',
        'Transfer status check failed',
        error,
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple health check - verify API key by listing banks
      await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/banks/NG`, {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
          timeout: 5000,
        }),
      );
      return true;
    } catch {
      this.logger.warn('Flutterwave provider is not available');
      return false;
    }
  }

  async listBanks(): Promise<BankInfo[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/banks/NG`, {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
          timeout: 15000,
        }),
      );

      const banks: BankInfo[] = (response.data.data || [])
        .filter((b: { code?: string; name?: string }) => b.code && b.name)
        .map((b: { code: string; name: string }) => ({
          code: b.code,
          name: b.name,
        }));

      return banks.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error: any) {
      this.logger.error('Flutterwave list banks failed:', error.message);
      throw new BankApiException('Flutterwave', 'Failed to list banks', error);
    }
  }
}
