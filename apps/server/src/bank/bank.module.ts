import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankService } from './bank.service';
import { BankController } from './bank.controller';
import { PaystackProvider } from './providers/paystack.provider';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import { MockBankProvider } from './providers/mock.provider';
import { BankApiLogEntity } from '../database/entities/bank-api-log.entity';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    TypeOrmModule.forFeature([BankApiLogEntity]),
  ],
  controllers: [BankController],
  providers: [
    BankService,
    PaystackProvider,
    FlutterwaveProvider,
    MockBankProvider,
  ],
  exports: [BankService],
})
export class BankModule {}
