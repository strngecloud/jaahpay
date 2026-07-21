import {
  IsString,
  IsEthereumAddress,
  IsEnum,
  IsOptional,
  IsObject,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';

export class SaveTransactionDto {
  /** Primary key; the web app uses the on-chain tx hash. */
  @IsString()
  id: string;

  @IsEthereumAddress()
  @IsOptional()
  userAddress?: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @IsString()
  @IsOptional()
  fromToken?: string;

  @IsString()
  @IsOptional()
  toToken?: string;

  @IsString()
  @IsOptional()
  fromAmount?: string;

  @IsString()
  @IsOptional()
  toAmount?: string;

  @IsString()
  @IsOptional()
  platformFee?: string;

  @IsString()
  @IsOptional()
  txHash?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateTransactionDto {
  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;

  @IsString()
  @IsOptional()
  txHash?: string;

  @IsString()
  @IsOptional()
  toAmount?: string;

  @IsString()
  @IsOptional()
  platformFee?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class GetTransactionsDto {
  @IsEthereumAddress()
  userAddress: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

/** Admin listing: no per-user filter; supports status/type/search/paging. */
export class GetAdminTransactionsDto {
  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;

  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;

  @IsString()
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(2000)
  limit?: number = 25;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  offset?: number = 0;
}
