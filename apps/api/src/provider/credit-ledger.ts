import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { AppError } from '../common/app-error';
import { ENV, REDIS } from '../common/tokens';
import type { Env } from '../config/env';

const TWO_DAYS_SECONDS = 172_800;

@Injectable()
export class CreditLedger {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private key(userId: string): string {
    return `credits:${userId}:${new Date().toISOString().slice(0, 10)}`;
  }

  async assertAvailable(userId: string): Promise<void> {
    const used = Number((await this.redis.get(this.key(userId))) ?? 0);
    if (used >= this.env.DAILY_CREDIT_CAP) {
      throw new AppError('RATE_LIMITED', 'Daily search limit reached');
    }
  }

  async consume(userId: string): Promise<void> {
    const key = this.key(userId);
    const used = await this.redis.incr(key);
    if (used === 1) await this.redis.expire(key, TWO_DAYS_SECONDS);
  }
}
