import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { SpendEntity } from '../database/entities/spend.entity';
import { WebhookLogEntity } from '../database/entities/webhook-log.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SpendEntity, WebhookLogEntity]),
    BlockchainModule,
    RedisModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
