import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ENV, REDIS } from '../src/common/tokens';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakeRedis } from './fake-redis';
import { testEnv } from './test-env';

describe('per-IP rate limit (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue({ ...testEnv, RATE_LIMIT_PER_MINUTE: 3 })
      .overrideProvider(REDIS)
      .useValue(new FakeRedis())
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it('allows the configured number of requests, then answers 429 RATE_LIMITED', async () => {
    for (let i = 0; i < 3; i++) await request(app.getHttpServer()).get('/health').expect(200);
    const res = await request(app.getHttpServer()).get('/health').expect(429);
    expect(res.body).toEqual({ code: 'RATE_LIMITED', message: 'Too many requests' });
  });
});
