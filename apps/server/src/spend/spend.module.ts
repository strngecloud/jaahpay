import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpendController } from './spend.controller';
import { SpendService } from './spend.service';
import { SpendProcessorService } from './services/spend-processor.service';
import { SpendLimitService } from './services/spend-limit.service';
import { SpendTimeoutService } from './services/spend-timeout.service';
import { SpendEntity } from '../database/entities/spend.entity';
import { UserSpendLimitEntity } from '../database/entities/user-spend-limit.entity';
import { BankModule } from '../bank/bank.module';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { FraudModule } from '../fraud/fraud.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([SpendEntity, UserSpendLimitEntity]),
        BankModule,
        ExchangeRateModule,
        forwardRef(() => BlockchainModule),
        FraudModule,
        LedgerModule,
    ],
    controllers: [SpendController],
    providers: [SpendService, SpendProcessorService, SpendLimitService, SpendTimeoutService],
    exports: [SpendProcessorService],
})
export class SpendModule { }
