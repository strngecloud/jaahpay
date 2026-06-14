import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER } from '@nestjs/core';
import { SpendModule } from './spend/spend.module';
import { BankModule } from './bank/bank.module';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { FraudModule } from './fraud/fraud.module';
import { RedisModule } from './redis/redis.module';
import { HealthController } from './health/health.controller';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { SpendEntity } from './database/entities/spend.entity';
import { BankApiLogEntity } from './database/entities/bank-api-log.entity';
import { UserSpendLimitEntity } from './database/entities/user-spend-limit.entity';
import { WebhookLogEntity } from './database/entities/webhook-log.entity';
import { LedgerEntryEntity } from './database/entities/ledger-entry.entity';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get('DATABASE_USERNAME'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        entities: [SpendEntity, BankApiLogEntity, UserSpendLimitEntity, WebhookLogEntity, LedgerEntryEntity],
        synchronize: configService.get('DATABASE_SYNCHRONIZE') === 'true',
        logging: configService.get('DATABASE_LOGGING') === 'true',
      }),
    }),

    // Scheduling (for cron jobs)
    ScheduleModule.forRoot(),

    // Infrastructure
    RedisModule,

    // Feature modules
    SpendModule,
    BankModule,
    ExchangeRateModule,
    BlockchainModule,
    WebhooksModule,
    FraudModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule { }
