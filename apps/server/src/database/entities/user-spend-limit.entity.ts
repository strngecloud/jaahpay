import { decimalTransformer } from '../transformers/decimal.transformer';
import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
} from 'typeorm';
import { KYCLevel } from '../../common/types/spend.types';

@Entity('user_spend_limits')
export class UserSpendLimitEntity {
  @PrimaryColumn({ type: 'varchar', length: 42 })
  userAddress: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 6,
    default: 100.0,
    transformer: decimalTransformer,
  })
  dailyLimitUsdc: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 6,
    default: 1000.0,
    transformer: decimalTransformer,
  })
  monthlyLimitUsdc: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 6,
    default: 0,
    transformer: decimalTransformer,
  })
  dailySpentUsdc: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 6,
    default: 0,
    transformer: decimalTransformer,
  })
  monthlySpentUsdc: number;

  @Column({ type: 'date', nullable: true })
  lastDailyReset: Date;

  @Column({ type: 'date', nullable: true })
  lastMonthlyReset: Date;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({
    type: 'enum',
    enum: KYCLevel,
    default: KYCLevel.BASIC,
  })
  kycLevel: KYCLevel;

  @Column({ type: 'boolean', default: false })
  isBlacklisted: boolean;

  @Column({ type: 'text', nullable: true })
  blacklistReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
