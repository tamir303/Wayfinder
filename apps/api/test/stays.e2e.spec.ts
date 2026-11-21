import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtVerifier } from '../src/auth/jwt-verifier';
import { ENV, REDIS } from '../src/common/tokens';
import { HandoffSigner } from '../src/handoff/handoff-signer';
import { PrismaService } from '../src/prisma/prisma.service';
import fixture from './fixtures/google_hotels/paris-hotels.json';
import { FakeRedis } from './fake-redis';
import { testEnv } from './test-env';

const ISSUER = `${testEnv.SUPABASE_URL}/auth/v1`;
const USER_ID = '7d0b2f4e-1111-4222-8333-944455556666';
const SEARCH = '/stays/search?q=Paris%20hotels&checkIn=2099-03-10&checkOut=2099-03-14';

describe('stays (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let fetchSpy: jest.SpyInstance;
  const searchLogCreate = jest.fn().mockResolvedValue({});
  const handoffCreate = jest.fn().mockResolvedValue({});
  const signer = new HandoffSigner(testEnv.HANDOFF_SECRET);

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
      .useValue({ ...testEnv, DAILY_CREDIT_CAP: 50 })
      .overrideProvider(REDIS)
      .useValue(new FakeRedis())
      .overrideProvider(PrismaService)
      .useValue({ searchLog: { create: searchLogCreate }, handoffClick: { create: handoffCreate } })
      .overrideProvider(JwtVerifier)
      .useValue(new JwtVerifier(async () => keys.publicKey, ISSUER))
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    searchLogCreate.mockClear();
    handoffCreate.mockClear();
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify(fixture), { status: 200 }));
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => app.close());

  const get = (path: string, withToken = true) => {
    const req = request(app.getHttpServer()).get(path);
    return withToken ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  const used = async () => (await get('/me/usage').expect(200)).body.used as number;

  describe('GET /stays/search', () => {
    it('requires a token', async () => {
      await get(SEARCH, false).expect(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['a missing destination', '/stays/search?checkIn=2099-03-10&checkOut=2099-03-14'],
      ['check-out before check-in', '/stays/search?q=Paris&checkIn=2099-03-14&checkOut=2099-03-10'],
      ['a past check-in', '/stays/search?q=Paris&checkIn=2001-03-10&checkOut=2001-03-14'],
      ['more than 30 nights', '/stays/search?q=Paris&checkIn=2099-03-10&checkOut=2099-05-10'],
      ['adults out of range', '/stays/search?q=Paris&checkIn=2099-03-10&checkOut=2099-03-14&adults=12'],
    ])('rejects %s with 400 BAD_QUERY before calling the provider', async (_n, path) => {
      const res = await get(path).expect(400);
      expect(res.body.code).toBe('BAD_QUERY');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns mapped stays with signed deal links and no provider urls', async () => {
      const res = await get(`${SEARCH}&adults=3`).expect(200);
      expect(res.body.stays).toHaveLength(20);
      expect(res.body.nextPageToken).toBe('CBI=');
      expect(res.body.stays[0]).toMatchObject({ name: 'Courtyard by Marriott Paris Gare de Lyon', pricePerNight: 202, currency: 'USD' });
      expect(JSON.stringify(res.body)).not.toContain('providerUrl');

      const url = new URL(res.body.stays[0].dealUrl);
      expect(url.origin + url.pathname).toBe('http://api.test/stays/handoff');
      const payload = signer.verify<{ userId: string; url: string }>(url.searchParams.get('ref')!, Math.floor(Date.now() / 1000), 'stay');
      expect(payload.userId).toBe(USER_ID);
      expect(payload.url).toMatch(/^https:\/\/www\.marriott\.com\//);

      const called = new URL(String(fetchSpy.mock.calls[0][0]));
      expect(called.searchParams.get('engine')).toBe('google_hotels');
      expect(called.searchParams.get('q')).toBe('Paris hotels');
      expect(called.searchParams.get('check_in_date')).toBe('2099-03-10');
      expect(called.searchParams.get('check_out_date')).toBe('2099-03-14');
      expect(called.searchParams.get('adults')).toBe('3');
      expect(called.searchParams.get('next_page_token')).toBeNull();
    });

    it('forwards the page token for the next page', async () => {
      await get(`${SEARCH}&adults=4&pageToken=CBI%3D`).expect(200);
      expect(new URL(String(fetchSpy.mock.calls[0][0])).searchParams.get('next_page_token')).toBe('CBI=');
    });

    it('serves a repeated search from the cache and logs a hit with 0 credits', async () => {
      await get(`${SEARCH}&adults=5`).expect(200);
      await get(`${SEARCH}&adults=5`).expect(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(searchLogCreate).toHaveBeenLastCalledWith({ data: { userId: USER_ID, engine: 'google_hotels', cacheHit: true, credits: 0 } });
    });

    it('returns an empty list for no results, and 502 with a refund for any other provider error', async () => {
      fetchSpy.mockImplementation(async () => new Response(JSON.stringify({ error: "Google Hotels hasn't returned any results for this search." }), { status: 200 }));
      expect((await get(`${SEARCH}&adults=6`).expect(200)).body).toEqual({ stays: [], nextPageToken: null });

      const before = await used();
      fetchSpy.mockImplementation(async () => new Response(JSON.stringify({ error: 'Invalid API key.' }), { status: 200 }));
      const res = await get(`${SEARCH}&adults=7`).expect(502);
      expect(res.body.code).toBe('PROVIDER_DOWN');
      expect(await used()).toBe(before);
    });
  });

  describe('GET /stays/handoff', () => {
    const now = () => Math.floor(Date.now() / 1000);
    const ref = (over: object = {}) =>
      signer.sign('stay', { userId: USER_ID, url: 'https://www.marriott.com/hotel', name: 'Hotel', price: 202, ...over }, now(), 600);

    it('is public, redirects to the provider, records the click and costs no credit', async () => {
      const before = await used();
      const res = await get(`/stays/handoff?ref=${ref()}`, false).expect(302);
      expect(res.headers.location).toBe('https://www.marriott.com/hotel');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(handoffCreate).toHaveBeenCalledWith({ data: { userId: USER_ID, kind: 'stay', provider: 'www.marriott.com', price: 202, currency: 'USD' } });
      expect(await used()).toBe(before);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sends a stay without a provider link to a Google travel search', async () => {
      const res = await get(`/stays/handoff?ref=${ref({ url: 'https://www.google.com/travel/search?q=Tiny%20Inn%20Paris' })}`, false).expect(302);
      expect(res.headers.location).toContain('https://www.google.com/travel/search?q=');
    });

    it.each([
      ['a missing ref', '/stays/handoff'],
      ['a garbage ref', '/stays/handoff?ref=nonsense'],
      ['a flight ref', `/stays/handoff?ref=${signer.sign('flight', { userId: USER_ID, url: 'https://x.example', name: 'x', price: 1 }, Math.floor(Date.now() / 1000), 600)}`],
    ])('rejects %s with an HTML 400 and records nothing', async (_n, path) => {
      const res = await get(path, false).expect(400);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(handoffCreate).not.toHaveBeenCalled();
    });

    it('rejects an expired ref and a non-https destination', async () => {
      await get(`/stays/handoff?ref=${signer.sign('stay', { userId: USER_ID, url: 'https://a.example', name: 'x', price: 1 }, now() - 10_000, 60)}`, false).expect(400);
      await get(`/stays/handoff?ref=${ref({ url: 'http://insecure.example' })}`, false).expect(400);
      await get(`/stays/handoff?ref=${ref({ url: 'javascript:alert(1)' })}`, false).expect(400);
      expect(handoffCreate).not.toHaveBeenCalled();
    });
  });
});
