import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, ILike, Repository } from 'typeorm';
import { TransactionEntity } from '../database/entities/transaction.entity';
import {
  SaveTransactionDto,
  UpdateTransactionDto,
  GetAdminTransactionsDto,
} from '../common/dto/transaction.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,
  ) {}

  /**
   * Idempotent save: the web app keys transactions by tx hash, so a repeat
   * save of the same swap upserts rather than erroring on the PK.
   */
  async saveTransaction(dto: SaveTransactionDto): Promise<TransactionEntity> {
    const existing = await this.txRepo.findOne({ where: { id: dto.id } });
    const entity = this.txRepo.merge(existing ?? new TransactionEntity(), {
      id: dto.id,
      userAddress: dto.userAddress ?? null,
      type: dto.type,
      status: dto.status,
      fromToken: dto.fromToken ?? null,
      toToken: dto.toToken ?? null,
      fromAmount: dto.fromAmount ?? null,
      toAmount: dto.toAmount ?? null,
      platformFee: dto.platformFee ?? null,
      txHash: dto.txHash ?? null,
      metadata: dto.metadata ?? null,
    });
    const saved = await this.txRepo.save(entity);
    this.logger.log(
      `Transaction ${saved.id} saved (${saved.type}/${saved.status})`,
    );
    return saved;
  }

  async updateTransaction(
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionEntity | null> {
    const existing = await this.txRepo.findOne({ where: { id } });
    if (!existing) return null;
    const entity = this.txRepo.merge(existing, {
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.txHash !== undefined ? { txHash: dto.txHash } : {}),
      ...(dto.toAmount !== undefined ? { toAmount: dto.toAmount } : {}),
      ...(dto.platformFee !== undefined
        ? { platformFee: dto.platformFee }
        : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
    });
    return this.txRepo.save(entity);
  }

  async getUserTransactions(
    userAddress: string,
    limit = 50,
  ): Promise<TransactionEntity[]> {
    return this.txRepo.find({
      where: { userAddress: ILike(userAddress) },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /** Admin listing with optional status/type/search filters + total count. */
  async getAdminTransactions(dto: GetAdminTransactionsDto) {
    const limit = dto.limit ?? 25;
    const offset = dto.offset ?? 0;

    const qb = this.txRepo
      .createQueryBuilder('t')
      .orderBy('t.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (dto.status) qb.andWhere('t.status = :status', { status: dto.status });
    if (dto.type) qb.andWhere('t.type = :type', { type: dto.type });
    if (dto.search) {
      const search = `%${dto.search}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('t.userAddress ILIKE :search', { search })
            .orWhere('t.txHash ILIKE :search', { search })
            .orWhere('t.id ILIKE :search', { search });
        }),
      );
    }

    const [transactions, total] = await qb.getManyAndCount();
    return { transactions, total, limit, offset };
  }

  /**
   * Aggregate KPIs for the admin overview, computed in the DB over the most
   * recent `sampleSize` rows.
   */
  async getAdminStats(sampleSize = 2000) {
    const rows = await this.txRepo.find({
      order: { createdAt: 'DESC' },
      take: sampleSize,
    });

    const num = (v: string | null) => {
      const n = parseFloat(v || '0');
      return Number.isFinite(n) ? n : 0;
    };
    const completed = rows.filter((r) => r.status === 'completed');
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const daily: { date: string; volume: number; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      daily.push({
        date: new Date(now - i * dayMs).toISOString().slice(0, 10),
        volume: 0,
        count: 0,
      });
    }
    const dailyByDate = new Map(daily.map((d) => [d.date, d]));
    for (const r of completed) {
      const bucket = dailyByDate.get(r.createdAt.toISOString().slice(0, 10));
      if (bucket) {
        bucket.volume += num(r.toAmount);
        bucket.count += 1;
      }
    }

    const last24h = rows.filter(
      (r) => now - r.createdAt.getTime() < dayMs,
    );

    return {
      sampled: rows.length,
      totalTransactions: rows.length,
      completed: completed.length,
      failed: rows.filter((r) => r.status === 'failed').length,
      pending: rows.filter(
        (r) => r.status === 'pending' || r.status === 'processing',
      ).length,
      successRate: rows.length
        ? (completed.length / rows.length) * 100
        : null,
      totalVolume: completed.reduce((s, r) => s + num(r.toAmount), 0),
      totalFees: completed.reduce((s, r) => s + num(r.platformFee), 0),
      uniqueWallets: new Set(
        rows.map((r) => r.userAddress?.toLowerCase()).filter(Boolean),
      ).size,
      txLast24h: last24h.length,
      volumeLast24h: last24h
        .filter((r) => r.status === 'completed')
        .reduce((s, r) => s + num(r.toAmount), 0),
      daily,
      recent: rows.slice(0, 8),
    };
  }
}
