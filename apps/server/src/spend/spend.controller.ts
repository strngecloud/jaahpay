import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ValidationPipe,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SpendService } from './spend.service';
import {
  InitiateSpendDto,
  GetSpendHistoryDto,
  ValidateAccountDto,
  CancelSpendDto,
} from '../common/dto/spend.dto';

@Controller('spend')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class SpendController {
  constructor(private readonly spendService: SpendService) {}

  /**
   * POST /api/v1/spend/initiate
   * Initiate a new spend transaction
   */
  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  async initiateSpend(@Body() dto: InitiateSpendDto) {
    return await this.spendService.initiateSpend(dto);
  }

  /**
   * GET /api/v1/spend/:spendId
   * Get spend details by ID
   */
  @Get(':spendId')
  async getSpend(@Param('spendId') spendId: string) {
    return await this.spendService.getSpend(spendId);
  }

  /**
   * GET /api/v1/spend/history
   * Get spend history for a user
   */
  @Get()
  async getSpendHistory(@Query() dto: GetSpendHistoryDto) {
    return await this.spendService.getSpendHistory(dto);
  }

  /**
   * POST /api/v1/spend/cancel/:spendId
   * Cancel a pending spend
   */
  @Post('cancel/:spendId')
  @HttpCode(HttpStatus.OK)
  async cancelSpend(
    @Param('spendId') spendId: string,
    @Body('userAddress') userAddress: string,
  ) {
    const dto: CancelSpendDto = { spendId, userAddress };
    return await this.spendService.cancelSpend(dto);
  }

  /**
   * POST /api/v1/spend/validate-account
   * Validate a bank account
   */
  @Post('validate-account')
  @HttpCode(HttpStatus.OK)
  async validateAccount(@Body() dto: ValidateAccountDto) {
    return await this.spendService.validateAccount(dto);
  }

  /**
   * POST /api/v1/spend/confirm-blockchain
   * Confirm blockchain transaction for a spend
   */
  @Post('confirm-blockchain')
  @HttpCode(HttpStatus.OK)
  async confirmBlockchain(
    @Body()
    body: {
      tempSpendId: string;
      blockchainTxHash: string;
      blockchainSpendId: string;
    },
  ) {
    await this.spendService.updateSpendId(
      body.tempSpendId,
      body.blockchainSpendId,
    );
    return { success: true };
  }
}
