import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudService } from './fraud.service';
import { SpendEntity } from '../database/entities/spend.entity';
import { RedisModule } from '../redis/redis.module';

@Module({
    imports: [TypeOrmModule.forFeature([SpendEntity]), RedisModule],
    providers: [FraudService],
    exports: [FraudService],
})
export class FraudModule { }
