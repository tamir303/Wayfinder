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

  // Reserve before the paid call: INCR is atomic, so parallel requests cannot overshoot the cap.
  async reserve(userId: string): Promise<void> {
    const key = this.key(userId);
    const used = await this.redis.incr(key);
    await this.redis.expire(key, TWO_DAYS_SECONDS);
    if (used > this.env.DAILY_CREDIT_CAP) {
      await this.redis.decr(key);
      throw new AppError('RATE_LIMITED', 'Daily search limit reached');
    }
  }

  async refund(userId: string): Promise<void> {
    await this.redis.decr(this.key(userId));
  }
}
