import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/** Mirrors the web app's TransactionType (swap-only refactor era). */
export enum TransactionType {
  SWAP = 'swap',
  SEND = 'send',
  RECEIVE = 'receive',
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
}

/** Mirrors the web app's TransactionStatus. */
export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

/**
 * Swap history recorded by the web app. Previously stored in Supabase; now
 * the server's Postgres is the single source of truth. The primary key is the
 * on-chain tx hash (the web app uses it as the id for idempotent saves).
 * Amounts are kept as strings to preserve full token precision.
 */
@Entity('transactions')
@Index(['userAddress', 'createdAt'])
@Index(['status'])
@Index(['txHash'])
export class TransactionEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id: string;

  @Column({ type: 'varchar', length: 42, nullable: true })
  userAddress: string | null;

  @Column({ type: 'varchar', length: 20, default: TransactionType.SWAP })
  type: string;

  @Column({ type: 'varchar', length: 20, default: TransactionStatus.PENDING })
  status: string;

  @Column({ type: 'varchar', length: 66, nullable: true })
  fromToken: string | null;

  @Column({ type: 'varchar', length: 66, nullable: true })
  toToken: string | null;

  @Column({ type: 'varchar', length: 78, nullable: true })
  fromAmount: string | null;

  @Column({ type: 'varchar', length: 78, nullable: true })
  toAmount: string | null;

  @Column({ type: 'varchar', length: 78, nullable: true })
  platformFee: string | null;

  @Column({ type: 'varchar', length: 66, nullable: true })
  txHash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
