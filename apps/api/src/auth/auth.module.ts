import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createRemoteJWKSet } from 'jose';
import { ENV } from '../common/tokens';
import type { Env } from '../config/env';
import { AuthGuard } from './auth.guard';
import { JwtVerifier, MockJwtVerifier } from './jwt-verifier';

@Global()
@Module({
  providers: [
    {
      provide: JwtVerifier,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.MOCK_DATA
          ? new MockJwtVerifier()
          : new JwtVerifier(
          createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)),
          `${env.SUPABASE_URL}/auth/v1`,
        ),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [JwtVerifier],
})
export class AuthModule {}
