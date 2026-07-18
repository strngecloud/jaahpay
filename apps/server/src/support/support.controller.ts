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
import { SupportService } from './support.service';
import {
  CreateSupportTicketDto,
  GetSupportTicketsDto,
} from '../common/dto/support.dto';

@Controller('support')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  /**
   * POST /api/v1/support/tickets
   * Create a new support ticket
   */
  @Post('tickets')
  @HttpCode(HttpStatus.OK)
  async createTicket(@Body() dto: CreateSupportTicketDto) {
    return await this.supportService.createTicket(dto);
  }

  /**
   * GET /api/v1/support/tickets
   * List support tickets for a user
   */
  @Get('tickets')
  async getTickets(@Query() dto: GetSupportTicketsDto) {
    return await this.supportService.getTickets(dto);
  }

  /**
   * GET /api/v1/support/tickets/:ticketRef
   * Get a single ticket by its public reference (e.g. JP-4F7K2M)
   */
  @Get('tickets/:ticketRef')
  async getTicket(@Param('ticketRef') ticketRef: string) {
    return await this.supportService.getTicketByRef(ticketRef);
  }
}
