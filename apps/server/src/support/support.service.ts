import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  SupportTicketEntity,
  SupportTicketStatus,
} from '../database/entities/support-ticket.entity';
import {
  CreateSupportTicketDto,
  GetSupportTicketsDto,
  SupportTicketResponseDto,
} from '../common/dto/support.dto';

/** Unambiguous alphabet (no 0/O, 1/I/L) for human-readable ticket refs */
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    @InjectRepository(SupportTicketEntity)
    private readonly ticketRepo: Repository<SupportTicketEntity>,
  ) {}

  async createTicket(
    dto: CreateSupportTicketDto,
  ): Promise<{ success: boolean; data: SupportTicketResponseDto }> {
    const ticket = this.ticketRepo.create({
      ticketRef: this.generateTicketRef(),
      userAddress: dto.userAddress ?? null,
      email: dto.email ?? null,
      category: dto.category,
      subject: dto.subject,
      message: dto.message,
      spendId: dto.spendId ?? null,
      status: SupportTicketStatus.OPEN,
    });

    await this.ticketRepo.save(ticket);
    this.logger.log(
      `Support ticket ${ticket.ticketRef} created (category: ${ticket.category}${
        ticket.spendId ? `, spend: ${ticket.spendId}` : ''
      })`,
    );

    return { success: true, data: this.mapToDto(ticket) };
  }

  async getTicketByRef(ticketRef: string): Promise<SupportTicketResponseDto> {
    const ticket = await this.ticketRepo.findOne({
      where: { ticketRef: ticketRef.toUpperCase() },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketRef} not found`);
    }
    return this.mapToDto(ticket);
  }

  async getTickets(dto: GetSupportTicketsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const [tickets, total] = await this.ticketRepo.findAndCount({
      where: { userAddress: dto.userAddress },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      tickets: tickets.map((t) => this.mapToDto(t)),
      total,
      page,
      limit,
    };
  }

  private generateTicketRef(): string {
    const bytes = randomBytes(6);
    let ref = '';
    for (let i = 0; i < 6; i++) {
      ref += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
    }
    return `JP-${ref}`;
  }

  private mapToDto(ticket: SupportTicketEntity): SupportTicketResponseDto {
    return {
      ticketRef: ticket.ticketRef,
      status: ticket.status,
      category: ticket.category,
      subject: ticket.subject,
      message: ticket.message,
      spendId: ticket.spendId ?? undefined,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }
}
