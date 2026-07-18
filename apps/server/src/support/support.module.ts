import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SupportTicketEntity } from '../database/entities/support-ticket.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicketEntity])],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
