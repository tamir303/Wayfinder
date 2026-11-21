import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module';
import { AppExceptionFilter } from './common/app-exception.filter';
import { ENV } from './common/tokens';
import type { Env } from './config/env';
import { ConfigModule } from './config/config.module';
import { FlightsModule } from './flights/flights.module';
import { StaysModule } from './stays/stays.module';
import { GeoModule } from './geo/geo.module';
import { MeModule } from './me/me.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => [{ ttl: 60_000, limit: env.RATE_LIMIT_PER_MINUTE }],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    GeoModule,
    FlightsModule,
    StaysModule,
    MeModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule {}
