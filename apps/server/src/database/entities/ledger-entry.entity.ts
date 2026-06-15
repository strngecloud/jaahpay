import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('ledger_entries')
@Index(['spendId'])
@Index(['accountType'])
@Index(['createdAt'])
export class LedgerEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 66 })
  spendId: string;

  @Column({ type: 'varchar', length: 50 })
  accountType: string;

  @Column({ type: 'decimal', precision: 20, scale: 6, default: 0 })
  debitAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 6, default: 0 })
  creditAmount: number;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'boolean', default: true })
  isImmutable: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
