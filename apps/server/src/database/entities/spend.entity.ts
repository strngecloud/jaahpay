import { decimalTransformer } from '../transformers/decimal.transformer';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SpendStatus, Chain } from '../../common/types/spend.types';

@Entity('spends')
@Index(['userAddress', 'createdAt'])
@Index(['status'])
@Index(['spendId'], { unique: true })
export class SpendEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 66, unique: true, nullable: false })
  spendId: string;

  @Column({ type: 'varchar', length: 42, nullable: false })
  userAddress: string;

  @Column({
    type: 'enum',
    enum: Chain,
    default: Chain.CELO,
  })
  chain: Chain;

  @Column({ type: 'decimal', precision: 20, scale: 6, nullable: false, transformer: decimalTransformer })
  usdcAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false, transformer: decimalTransformer })
  ngnAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false, transformer: decimalTransformer })
  exchangeRate: number;

  @Column({ type: 'decimal', precision: 20, scale: 6, nullable: false, transformer: decimalTransformer })
  platformFeeUsdc: number;

  @Column({ type: 'varchar', length: 10, nullable: false })
  recipientAccountNumber: string;

  @Column({ type: 'varchar', length: 10, nullable: false })
  recipientBankCode: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipientAccountName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  narration: string;

  @Column({
    type: 'enum',
    enum: SpendStatus,
    default: SpendStatus.PENDING,
  })
  status: SpendStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankReference: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'varchar', length: 66, nullable: true })
  transactionHash: string;

  @Column({ type: 'int', nullable: true })
  blockNumber: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}
