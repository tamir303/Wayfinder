import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtVerifier } from '../src/auth/jwt-verifier';
import { ENV, REDIS } from '../src/common/tokens';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakeRedis } from './fake-redis';
import { testEnv } from './test-env';

const ISSUER = `${testEnv.SUPABASE_URL}/auth/v1`;

describe('GET /maps/config (e2e)', () => {
  const boot = async (env: object) => {
    const keys = await generateKeyPair('ES256');
    const token = await new SignJWT({}).setProtectedHeader({ alg: 'ES256' }).setIssuer(ISSUER).setAudience('authenticated').setSubject('7d0b2f4e-1111-4222-8333-944455556666').setIssuedAt().setExpirationTime('1h').sign(keys.privateKey);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue({ ...testEnv, ...env })
      .overrideProvider(REDIS)
      .useValue(new FakeRedis())
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(JwtVerifier)
      .useValue(new JwtVerifier(async () => keys.publicKey, ISSUER))
      .compile();
    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();
    return { app, token };
  };

  it('requires a token', async () => {
    const { app } = await boot({});
    await request(app.getHttpServer()).get('/maps/config').expect(401);
    await app.close();
  });

  it('returns the configured tile style URL', async () => {
    const { app, token } = await boot({ MAP_STYLE_URL: 'https://tiles.example/style.json?key=public-client-key' });
    const res = await request(app.getHttpServer()).get('/maps/config').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toEqual({ styleUrl: 'https://tiles.example/style.json?key=public-client-key' });
    await app.close();
  });

  it('returns null when no tile provider is configured, so the app keeps its placeholder map', async () => {
    const { app, token } = await boot({});
    const res = await request(app.getHttpServer()).get('/maps/config').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toEqual({ styleUrl: null });
    await app.close();
  });
});
