import { Controller, Get } from '@nestjs/common';
import { BankService } from './bank.service';

@Controller('banks')
export class BankController {
  constructor(private readonly bankService: BankService) {}

  /**
   * GET /api/v1/banks
   * List supported Nigerian banks
   */
  @Get()
  async listBanks() {
    const banks = await this.bankService.listBanks();
    return { success: true, data: banks };
  }
}
