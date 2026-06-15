import {
  IsString,
  IsNumber,
  IsEthereumAddress,
  IsEnum,
  IsOptional,
  Min,
  Max,
  Length,
  Matches,
} from 'class-validator';
import { Chain } from '../types/spend.types';

export class InitiateSpendDto {
  @IsEthereumAddress()
  userAddress: string;

  @IsNumber()
  @Min(100) // Minimum 100 NGN
  @Max(1000000) // Maximum 1M NGN per transaction
  ngnAmount: number;

  @IsString()
  @Length(10, 10)
  @Matches(/^[0-9]+$/, { message: 'Account number must be 10 digits' })
  recipientAccountNumber: string;

  @IsString()
  @Length(3, 6)
  recipientBankCode: string;

  @IsString()
  @IsOptional()
  @Length(1, 255)
  narration?: string;

  @IsEnum(Chain)
  chain: Chain;
}

export class GetSpendDto {
  @IsString()
  spendId: string;
}

export class GetSpendHistoryDto {
  @IsEthereumAddress()
  userAddress: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsEnum(Chain)
  @IsOptional()
  chain?: Chain;
}

export class CancelSpendDto {
  @IsString()
  spendId: string;

  @IsEthereumAddress()
  userAddress: string;
}

export class ValidateAccountDto {
  @IsString()
  @Length(10, 10)
  @Matches(/^[0-9]+$/)
  accountNumber: string;

  @IsString()
  @Length(3, 6)
  bankCode: string;
}

export class SpendResponseDto {
  spendId: string;
  status: string;
  usdcAmount: number;
  ngnAmount: number;
  exchangeRate: number;
  platformFee: number;
  recipient?: {
    accountName: string;
    accountNumber: string;
    bank: string;
  };
  bankReference?: string;
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export class InitiateSpendResponseDto {
  success: boolean;
  data: {
    spendId: string;
    usdcAmount: number;
    exchangeRate: number;
    platformFee: number;
    totalUSDCRequired: number;
    recipientAccountName: string;
    estimatedCompletionTime: string;
  };
}

export class ExchangeRateResponseDto {
  usdToNgn: number;
  lastUpdated: Date;
  sources: string[];
}
