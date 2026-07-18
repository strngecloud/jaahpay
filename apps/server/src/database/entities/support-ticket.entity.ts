import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SupportTicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum SupportTicketCategory {
  TRANSACTION = 'transaction',
  PAYMENT = 'payment',
  ACCOUNT = 'account',
  TECHNICAL = 'technical',
  OTHER = 'other',
}

@Entity('support_tickets')
@Index(['userAddress', 'createdAt'])
@Index(['status'])
@Index(['ticketRef'], { unique: true })
export class SupportTicketEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  /** Public reference shown to the user, e.g. JP-4F7K2M */
  @Column({ type: 'varchar', length: 20, unique: true, nullable: false })
  ticketRef: string;

  @Column({ type: 'varchar', length: 42, nullable: true })
  userAddress: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({
    type: 'enum',
    enum: SupportTicketCategory,
    default: SupportTicketCategory.OTHER,
  })
  category: SupportTicketCategory;

  @Column({ type: 'varchar', length: 200, nullable: false })
  subject: string;

  @Column({ type: 'text', nullable: false })
  message: string;

  /** Optional link to a spend transaction the ticket is about */
  @Column({ type: 'varchar', length: 66, nullable: true })
  spendId: string | null;

  @Column({
    type: 'enum',
    enum: SupportTicketStatus,
    default: SupportTicketStatus.OPEN,
  })
  status: SupportTicketStatus;

  /** Internal notes / resolution summary (not exposed to users) */
  @Column({ type: 'text', nullable: true })
  resolutionNotes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
