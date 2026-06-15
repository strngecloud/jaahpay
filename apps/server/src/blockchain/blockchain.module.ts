import { Module, forwardRef } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { SpendModule } from '../spend/spend.module';

@Module({
    imports: [forwardRef(() => SpendModule)],
    providers: [BlockchainService],
    exports: [BlockchainService],
})
export class BlockchainModule { }
