import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
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
import { SupportModule } from './support/support.module';
import { RedisModule } from './redis/redis.module';
import { HealthController } from './health/health.controller';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { SpendEntity } from './database/entities/spend.entity';
import { BankApiLogEntity } from './database/entities/bank-api-log.entity';
import { UserSpendLimitEntity } from './database/entities/user-spend-limit.entity';
import { WebhookLogEntity } from './database/entities/webhook-log.entity';
import { LedgerEntryEntity } from './database/entities/ledger-entry.entity';
import { SupportTicketEntity } from './database/entities/support-ticket.entity';
import { SnakeNamingStrategy } from './database/snake-naming.strategy';

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
        entities: [
          SpendEntity,
          BankApiLogEntity,
          UserSpendLimitEntity,
          WebhookLogEntity,
          LedgerEntryEntity,
          SupportTicketEntity,
        ],
        namingStrategy: new SnakeNamingStrategy(),
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
    SupportModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    RateLimitMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Basic per-IP rate limiting on every route (webhooks included:
    // providers stay well under 60 req/min per IP).
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}
