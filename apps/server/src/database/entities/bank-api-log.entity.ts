import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';
import { BankProvider } from '../../common/types/spend.types';

@Entity('bank_api_logs')
@Index(['spendId'])
@Index(['createdAt'])
export class BankApiLogEntity {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column({ type: 'varchar', length: 66, nullable: false })
    spendId: string;

    @Column({
        type: 'enum',
        enum: BankProvider,
        nullable: false,
    })
    apiProvider: BankProvider;

    @Column({ type: 'varchar', length: 255, nullable: false })
    endpoint: string;

    @Column({ type: 'jsonb', nullable: false })
    requestPayload: Record<string, any>;

    @Column({ type: 'jsonb', nullable: true })
    responsePayload: Record<string, any>;

    @Column({ type: 'int', nullable: true })
    statusCode: number;

    @Column({ type: 'boolean', default: false })
    success: boolean;

    @Column({ type: 'text', nullable: true })
    errorMessage: string;

    @Column({ type: 'int', nullable: true })
    responseTimeMs: number;

    @CreateDateColumn()
    createdAt: Date;
}
