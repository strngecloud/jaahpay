import { Module, forwardRef } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { SpendModule } from '../spend/spend.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [forwardRef(() => SpendModule), RedisModule],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
