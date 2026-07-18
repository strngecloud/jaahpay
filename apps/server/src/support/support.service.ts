import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  SupportTicketEntity,
  SupportTicketStatus,
} from '../database/entities/support-ticket.entity';
import {
  CreateSupportTicketDto,
  GetSupportTicketsDto,
  GetAdminTicketsDto,
  UpdateTicketDto,
  SupportTicketResponseDto,
  AdminTicketResponseDto,
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

  /** Admin: list every ticket, optionally filtered by status/search. */
  async getAllTickets(dto: GetAdminTicketsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 25;

    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (dto.status) qb.andWhere('t.status = :status', { status: dto.status });
    if (dto.search) {
      const search = `%${dto.search}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('t.ticketRef ILIKE :search', { search })
            .orWhere('t.userAddress ILIKE :search', { search })
            .orWhere('t.email ILIKE :search', { search })
            .orWhere('t.subject ILIKE :search', { search });
        }),
      );
    }

    const [tickets, total] = await qb.getManyAndCount();
    return {
      tickets: tickets.map((t) => this.mapToAdminDto(t)),
      total,
      page,
      limit,
      openCount: await this.ticketRepo.count({
        where: { status: SupportTicketStatus.OPEN },
      }),
    };
  }

  /** Admin: update a ticket's status and/or internal resolution notes. */
  async updateTicket(
    ticketRef: string,
    dto: UpdateTicketDto,
  ): Promise<AdminTicketResponseDto> {
    const ticket = await this.ticketRepo.findOne({
      where: { ticketRef: ticketRef.toUpperCase() },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketRef} not found`);
    }
    if (dto.status !== undefined) ticket.status = dto.status;
    if (dto.resolutionNotes !== undefined) {
      ticket.resolutionNotes = dto.resolutionNotes;
    }
    await this.ticketRepo.save(ticket);
    this.logger.log(`Support ticket ${ticket.ticketRef} updated by admin`);
    return this.mapToAdminDto(ticket);
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

  private mapToAdminDto(ticket: SupportTicketEntity): AdminTicketResponseDto {
    return {
      ...this.mapToDto(ticket),
      userAddress: ticket.userAddress ?? undefined,
      email: ticket.email ?? undefined,
      resolutionNotes: ticket.resolutionNotes ?? undefined,
    };
  }
}
