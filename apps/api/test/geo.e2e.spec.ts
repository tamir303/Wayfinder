import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtVerifier } from '../src/auth/jwt-verifier';
import { ENV, REDIS } from '../src/common/tokens';
import { PrismaService } from '../src/prisma/prisma.service';
import fixture from './fixtures/google_flights_autocomplete/tel-aviv.json';
import { FakeRedis } from './fake-redis';
import { testEnv } from './test-env';

const ISSUER = `${testEnv.SUPABASE_URL}/auth/v1`;
const USER_ID = '7d0b2f4e-1111-4222-8333-944455556666';

describe('GET /geo/suggest (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let fetchSpy: jest.SpyInstance;
  const searchLogCreate = jest.fn().mockResolvedValue({});

  beforeAll(async () => {
    const keys = await generateKeyPair('ES256');
    token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setSubject(USER_ID)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(keys.privateKey);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue({ ...testEnv, DAILY_CREDIT_CAP: 1 })
      .overrideProvider(REDIS)
      .useValue(new FakeRedis())
      .overrideProvider(PrismaService)
      .useValue({ searchLog: { create: searchLogCreate } })
      .overrideProvider(JwtVerifier)
      .useValue(new JwtVerifier(async () => keys.publicKey, ISSUER))
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    searchLogCreate.mockClear();
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify(fixture), { status: 200 }));
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => app.close());

  const get = (path: string, withToken = true) => {
    const req = request(app.getHttpServer()).get(path);
    return withToken ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('GET /health is public', async () => {
    await get('/health', false).expect(200, { ok: true });
  });

  it('returns 401 UNAUTHENTICATED without a token', async () => {
    const res = await get('/geo/suggest?q=tel%20aviv', false).expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 400 BAD_QUERY for a too-short query', async () => {
    const res = await get('/geo/suggest?q=a').expect(400);
    expect(res.body).toEqual({ code: 'BAD_QUERY', message: 'Invalid request' });
  });

  it('returns 400 BAD_QUERY for an unsupported kind', async () => {
    await get('/geo/suggest?q=paris&kind=hotel').expect(400);
  });

  it('returns suggestions, then serves the same query from cache and logs both', async () => {
    const expected = {
      suggestions: [{ code: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv-Yafo' }],
    };

    await get('/geo/suggest?q=Tel%20Aviv').expect(200, expected);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(searchLogCreate).toHaveBeenLastCalledWith({
      data: { userId: USER_ID, engine: 'google_flights_autocomplete', cacheHit: false, credits: 1 },
    });

    await get('/geo/suggest?q=%20tel%20%20aviv').expect(200, expected);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(searchLogCreate).toHaveBeenLastCalledWith({
      data: { userId: USER_ID, engine: 'google_flights_autocomplete', cacheHit: true, credits: 0 },
    });
  });

  it('returns 429 RATE_LIMITED for a new query once the daily cap (1) is used', async () => {
    // The previous test already spent the single credit for this user.
    const res = await get('/geo/suggest?q=london').expect(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
