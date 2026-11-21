import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV, REDIS } from '../common/tokens';
import type { Env } from '../config/env';
import { MemoryRedis } from './memory-redis';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: Env) => (env.MOCK_DATA ? new MemoryRedis() : new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 })),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: { quit(): Promise<unknown> }) {}

  async onApplicationShutdown() {
    await this.redis.quit();
  }
}
