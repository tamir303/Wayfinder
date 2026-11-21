import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtVerifier } from '../src/auth/jwt-verifier';
import { ENV, REDIS } from '../src/common/tokens';
import { HandoffSigner } from '../src/handoff/handoff-signer';
import { PrismaService } from '../src/prisma/prisma.service';
import fixture from './fixtures/google_flights/tlv-cdg-oneway.json';
import { FakeRedis } from './fake-redis';
import { testEnv } from './test-env';

const ISSUER = `${testEnv.SUPABASE_URL}/auth/v1`;
const USER_ID = '7d0b2f4e-1111-4222-8333-944455556666';
const FUTURE = '2099-03-10';
const SEARCH = `/flights/search?from=TLV&to=CDG&date=${FUTURE}`;

describe('GET /flights/search (e2e)', () => {
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
      .useValue({ ...testEnv, DAILY_CREDIT_CAP: 5 })
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
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify(fixture), { status: 200 }));
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => app.close());

  const get = (path: string, withToken = true) => {
    const req = request(app.getHttpServer()).get(path);
    return withToken ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('requires a token', async () => {
    await get(SEARCH, false).expect(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['a bad airport code', `/flights/search?from=tl&to=CDG&date=${FUTURE}`],
    ['a missing date', '/flights/search?from=TLV&to=CDG'],
    ['a past date', '/flights/search?from=TLV&to=CDG&date=2001-01-01'],
    ['adults out of range', `/flights/search?from=TLV&to=CDG&date=${FUTURE}&adults=12`],
    ['an unknown cabin', `/flights/search?from=TLV&to=CDG&date=${FUTURE}&cabin=luxury`],
  ])('rejects %s with 400 BAD_QUERY before calling the provider', async (_name, path) => {
    const res = await get(path).expect(400);
    expect(res.body.code).toBe('BAD_QUERY');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns mapped offers with signed handoff links and without booking tokens', async () => {
    const res = await get(`${SEARCH}&adults=2&cabin=business`).expect(200);

    expect(res.body.offers).toHaveLength(10);
    expect(res.body.insights).toEqual({ lowestPrice: 136, level: 'low' });
    expect(JSON.stringify(res.body)).not.toContain('bookingToken');
    expect(JSON.stringify(res.body)).not.toContain('booking_token');

    const url = new URL(res.body.offers[0].handoffUrl);
    expect(url.origin + url.pathname).toBe('http://api.test/flights/handoff');
    const payload = new HandoffSigner(testEnv.HANDOFF_SECRET).verify(url.searchParams.get('ref')!, Math.floor(Date.now() / 1000));
    expect(payload).toMatchObject({ userId: USER_ID, from: 'TLV', to: 'CDG', date: FUTURE, adults: 2, cabin: 'business' });

    const called = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(called.searchParams.get('engine')).toBe('google_flights');
    expect(called.searchParams.get('type')).toBe('2');
    expect(called.searchParams.get('travel_class')).toBe('3');
    expect(called.searchParams.get('adults')).toBe('2');
  });

  it('serves a repeated search from the cache and logs a hit with 0 credits', async () => {
    await get(`${SEARCH}&adults=3`).expect(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await get(`${SEARCH}&adults=3`).expect(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(searchLogCreate).toHaveBeenLastCalledWith({
      data: { userId: USER_ID, engine: 'google_flights', cacheHit: true, credits: 0 },
    });
  });

  it('returns an empty result for the provider no-results message', async () => {
    fetchSpy.mockImplementation(async () => new Response(JSON.stringify({ error: "Google Flights hasn't returned any results for this query." }), { status: 200 }));
    const res = await get(`${SEARCH}&adults=4`).expect(200);
    expect(res.body).toEqual({ offers: [], insights: null });
  });

  it('answers 502 PROVIDER_DOWN for any other provider error and refunds the credit', async () => {
    const before = (await get('/me/usage').expect(200)).body.used;
    fetchSpy.mockImplementation(async () => new Response(JSON.stringify({ error: 'Invalid API key.' }), { status: 200 }));
    const res = await get(`${SEARCH}&adults=5`).expect(502);
    expect(res.body.code).toBe('PROVIDER_DOWN');
    expect((await get('/me/usage').expect(200)).body.used).toBe(before);
  });
});
