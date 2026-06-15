import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerService } from './ledger.service';
import { LedgerEntryEntity } from '../database/entities/ledger-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEntryEntity])],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
