import { Global, Module } from '@nestjs/common';
import { ENV } from '../common/tokens';
import type { Env } from '../config/env';
import { createMemoryPrisma } from './memory-prisma';
import { PrismaService } from './prisma.service';

// Mock backend (dev): an in-memory database, so nothing needs DATABASE_URL.
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      inject: [ENV],
      useFactory: (env: Env) => (env.MOCK_DATA ? createMemoryPrisma() : new PrismaService()),
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
