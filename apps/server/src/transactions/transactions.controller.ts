import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
  UsePipes,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import {
  SaveTransactionDto,
  UpdateTransactionDto,
  GetTransactionsDto,
  GetAdminTransactionsDto,
} from '../common/dto/transaction.dto';

@Controller('transactions')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * POST /api/v1/transactions
   * Save (upsert) a swap transaction. Called by the web app after a swap.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async save(@Body() dto: SaveTransactionDto) {
    const tx = await this.transactionsService.saveTransaction(dto);
    return { success: true, data: tx };
  }

  /**
   * GET /api/v1/transactions?userAddress=&limit=
   * A user's swap history.
   */
  @Get()
  async getUserTransactions(@Query() dto: GetTransactionsDto) {
    const transactions = await this.transactionsService.getUserTransactions(
      dto.userAddress,
      dto.limit,
    );
    return { transactions };
  }

  /**
   * GET /api/v1/transactions/admin?status=&type=&search=&limit=&offset=
   * Admin listing across all users.
   */
  @Get('admin')
  @UseGuards(ApiKeyGuard)
  async getAdminTransactions(@Query() dto: GetAdminTransactionsDto) {
    return this.transactionsService.getAdminTransactions(dto);
  }

  /**
   * GET /api/v1/transactions/admin/stats
   * Aggregated KPIs + 30-day daily series for the admin overview.
   */
  @Get('admin/stats')
  @UseGuards(ApiKeyGuard)
  async getAdminStats() {
    return this.transactionsService.getAdminStats();
  }

  /**
   * PATCH /api/v1/transactions/:id
   * Update a transaction's status/fields (e.g. confirmation tracking).
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    const tx = await this.transactionsService.updateTransaction(id, dto);
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);
    return { success: true, data: tx };
  }
}
