import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankService } from './bank.service';
import { WemaProvider } from './providers/wema.provider';
import { PaystackProvider } from './providers/paystack.provider';
import { BankApiLogEntity } from '../database/entities/bank-api-log.entity';

@Module({
    imports: [
        HttpModule.register({
            timeout: 30000,
            maxRedirects: 5,
        }),
        TypeOrmModule.forFeature([BankApiLogEntity]),
    ],
    providers: [BankService, WemaProvider, PaystackProvider],
    exports: [BankService],
})
export class BankModule { }
