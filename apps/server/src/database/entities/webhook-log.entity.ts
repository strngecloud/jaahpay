import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';
import { BankProvider } from '../../common/types/spend.types';

@Entity('webhook_logs')
@Index(['webhookId'], { unique: true })
@Index(['provider'])
@Index(['processedAt'])
export class WebhookLogEntity {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column({
        type: 'enum',
        enum: BankProvider,
    })
    provider: BankProvider;

    @Column({ type: 'varchar', length: 255, unique: true })
    webhookId: string;

    @Column({ type: 'jsonb' })
    payload: any;

    @Column({ type: 'varchar', length: 50 })
    status: string;

    @Column({ type: 'text', nullable: true })
    errorMessage: string;

    @CreateDateColumn()
    processedAt: Date;
}
