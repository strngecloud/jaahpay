import {
  IsString,
  IsEthereumAddress,
  IsEnum,
  IsOptional,
  IsEmail,
  IsNumber,
  Length,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  SupportTicketCategory,
  SupportTicketStatus,
} from '../../database/entities/support-ticket.entity';

export class CreateSupportTicketDto {
  @IsEthereumAddress()
  @IsOptional()
  userAddress?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(SupportTicketCategory)
  category: SupportTicketCategory;

  @IsString()
  @Length(3, 200)
  subject: string;

  @IsString()
  @Length(10, 5000)
  message: string;

  @IsString()
  @IsOptional()
  @Length(1, 66)
  spendId?: string;
}

export class GetSupportTicketsDto {
  @IsEthereumAddress()
  userAddress: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SupportTicketResponseDto {
  ticketRef: string;
  status: SupportTicketStatus;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  spendId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Admin listing of every ticket, optionally filtered by status. */
export class GetAdminTicketsDto {
  @IsEnum(SupportTicketStatus)
  @IsOptional()
  status?: SupportTicketStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export class UpdateTicketDto {
  @IsEnum(SupportTicketStatus)
  @IsOptional()
  status?: SupportTicketStatus;

  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}

/** Admin view exposes the submitter's contact info and internal notes. */
export class AdminTicketResponseDto extends SupportTicketResponseDto {
  userAddress?: string;
  email?: string;
  resolutionNotes?: string;
}
