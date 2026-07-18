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
} from '@nestjs/common';
import { SupportService } from './support.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import {
  CreateSupportTicketDto,
  GetSupportTicketsDto,
  GetAdminTicketsDto,
  UpdateTicketDto,
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
   * GET /api/v1/support/admin/tickets
   * Admin: list every ticket (optionally filtered by status/search).
   */
  @Get('admin/tickets')
  @UseGuards(ApiKeyGuard)
  async getAllTickets(@Query() dto: GetAdminTicketsDto) {
    return await this.supportService.getAllTickets(dto);
  }

  /**
   * PATCH /api/v1/support/admin/tickets/:ticketRef
   * Admin: update a ticket's status and/or resolution notes.
   */
  @Patch('admin/tickets/:ticketRef')
  @UseGuards(ApiKeyGuard)
  async updateTicket(
    @Param('ticketRef') ticketRef: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return await this.supportService.updateTicket(ticketRef, dto);
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
