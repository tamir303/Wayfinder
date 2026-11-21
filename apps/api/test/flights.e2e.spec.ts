import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtVerifier } from '../src/auth/jwt-verifier';
import { ENV, REDIS } from '../src/common/tokens';
import { HandoffSigner } from '../src/handoff/handoff-signer';
import { PrismaService } from '../src/prisma/prisma.service';
import calendarFixture from './fixtures/google_flights_calendar/tlv-cdg-march.json';
import bookingFixture from './fixtures/google_flights/tlv-cdg-oneway-booking.json';
import roundtripBooking from './fixtures/google_flights/tlv-cdg-roundtrip-booking.json';
import roundtripReturn from './fixtures/google_flights/tlv-cdg-roundtrip-return.json';
import roundtripFixture from './fixtures/google_flights/tlv-cdg-roundtrip.json';
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
  const handoffCreate = jest.fn().mockResolvedValue({});

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
    // Route the mocked provider by request shape, as the real one would answer.
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const q = new URL(String(input)).searchParams;
      const roundTrip = q.get('type') === '1';
      const body = q.get('engine') === 'google_flights_calendar'
        ? calendarFixture
        : q.has('booking_token')
          ? roundTrip ? roundtripBooking : bookingFixture
          : q.has('departure_token')
            ? roundtripReturn
            : roundTrip ? roundtripFixture : fixture;
      return new Response(JSON.stringify(body), { status: 200 });
    });
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
    expect(res.body.insights).toMatchObject({ lowestPrice: 136, level: 'low', typicalRange: { low: 150, high: 255 } });
    expect(new Date(res.body.asOf).toString()).not.toBe('Invalid Date');
    expect(JSON.stringify(res.body)).not.toContain('bookingToken');
    expect(JSON.stringify(res.body)).not.toContain('booking_token');

    const url = new URL(res.body.offers[0].handoffUrl);
    expect(url.origin + url.pathname).toBe('http://api.test/flights/handoff');
    const payload = new HandoffSigner(testEnv.HANDOFF_SECRET).verify(url.searchParams.get('ref')!, Math.floor(Date.now() / 1000), 'flight');
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
    expect(res.body).toMatchObject({ offers: [], insights: null });
    expect(typeof res.body.asOf).toBe('string');
  });

  it('answers 502 PROVIDER_DOWN for any other provider error and refunds the credit', async () => {
    const before = (await get('/me/usage').expect(200)).body.used;
    fetchSpy.mockImplementation(async () => new Response(JSON.stringify({ error: 'Invalid API key.' }), { status: 200 }));
    const res = await get(`${SEARCH}&adults=5`).expect(502);
    expect(res.body.code).toBe('PROVIDER_DOWN');
    expect((await get('/me/usage').expect(200)).body.used).toBe(before);
  });

  describe('GET /flights/handoff', () => {
    const signer = new HandoffSigner(testEnv.HANDOFF_SECRET);
    const now = () => Math.floor(Date.now() / 1000);
    const refPayload = { userId: USER_ID, bookingToken: 'TOKEN+/=', from: 'TLV', to: 'CDG', date: FUTURE, adults: 1, cabin: 'economy' };
    const used = async () => (await get('/me/usage').expect(200)).body.used as number;

    const handoffPath = async (query = '&adults=6') => {
      const res = await get(`${SEARCH}${query}`).expect(200);
      const url = new URL(res.body.offers[0].handoffUrl);
      return url.pathname + url.search;
    };

    it('is public and shows a chooser when several providers sell the flight', async () => {
      const path = await handoffPath('&adults=6');
      const before = await used();
      const res = await get(path, false).expect(200);

      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['content-security-policy']).toContain('form-action https://www.google.com');
      expect(res.text).toContain('Choose where to book');
      expect(res.text).toContain('El Al');
      expect(res.text).toContain('Air France');
      expect(res.text).toContain('action="https://www.google.com/travel/clk/f"');
      expect(res.text).not.toContain('<script');

      const lookup = new URL(String(fetchSpy.mock.calls.at(-1)![0]));
      expect(lookup.searchParams.get('departure_id')).toBe('TLV');
      expect(lookup.searchParams.get('arrival_id')).toBe('CDG');
      expect(lookup.searchParams.get('booking_token')).toBeTruthy();
      expect(await used()).toBe(before + 1);
      expect(handoffCreate).toHaveBeenCalledWith({
        data: { userId: USER_ID, kind: 'flight', provider: 'multiple', price: 226, currency: 'USD' },
      });
    });

    it('auto-submits the POST when there is a single provider, with a matching nonce', async () => {
      const path = await handoffPath('&adults=7');
      const one = { ...bookingFixture, booking_options: [bookingFixture.booking_options[0]] };
      fetchSpy.mockImplementation(async () => new Response(JSON.stringify(one), { status: 200 }));
      const res = await get(path, false).expect(200);

      const nonce = /<script nonce="([^"]+)">/.exec(res.text)?.[1];
      expect(nonce).toBeTruthy();
      expect(res.headers['content-security-policy']).toContain(`script-src 'nonce-${nonce}'`);
      expect(res.text).toContain('<form id="go" method="post" action="https://www.google.com/travel/clk/f">');
      expect(handoffCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ provider: 'El Al' }),
      });
    });

    it.each([
      ['a missing ref', '/flights/handoff'],
      ['a garbage ref', '/flights/handoff?ref=nonsense'],
      ['a tampered ref', `/flights/handoff?ref=${signer.sign('flight', refPayload, now(), 600).split('.')[0]}.AAAA`],
    ])('rejects %s with an HTML 400 and spends nothing', async (_n, path) => {
      const before = await used();
      const res = await get(path, false).expect(400);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('We could not open that booking page');
      expect(await used()).toBe(before);
      expect(handoffCreate).not.toHaveBeenCalled();
    });

    it('rejects an expired ref', async () => {
      const expired = signer.sign('flight', refPayload, now() - 10_000, 60);
      await get(`/flights/handoff?ref=${expired}`, false).expect(400);
    });

    it('answers a 502 page and refunds the credit when the provider lookup fails', async () => {
      const path = await handoffPath('&adults=8');
      const before = await used();
      fetchSpy.mockImplementation(async () => new Response(JSON.stringify({ error: 'booking token expired' }), { status: 200 }));
      const res = await get(path, false).expect(502);
      expect(res.text).toContain('We could not open that booking page');
      expect(await used()).toBe(before);
      expect(handoffCreate).not.toHaveBeenCalled();
    });
  });

  describe('round trip', () => {
    const RETURN = '2099-03-17';
    const RT = `${SEARCH}&returnDate=${RETURN}`;
    const now = () => Math.floor(Date.now() / 1000);
    const used = async () => (await get('/me/usage').expect(200)).body.used as number;

    it('search with a return date returns outbound options with a return token and no handoff link yet', async () => {
      const res = await get(`${RT}&adults=2`).expect(200);
      expect(res.body.offers).toHaveLength(10);
      for (const o of res.body.offers) {
        expect(o.handoffUrl).toBeNull();
        expect(typeof o.returnToken).toBe('string');
      }
      expect(res.body.offers[0].price).toBe(405);
      const q = new URL(String(fetchSpy.mock.calls[0][0])).searchParams;
      expect(q.get('type')).toBe('1');
      expect(q.get('return_date')).toBe(RETURN);
    });

    it.each([
      ['a return date before the outbound', `${SEARCH}&returnDate=2099-03-01`],
      ['a return date equal to the outbound', `${SEARCH}&returnDate=${FUTURE}`],
      ['a malformed return date', `${SEARCH}&returnDate=soon`],
    ])('rejects %s with 400', async (_n, path) => {
      await get(path).expect(400);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('step two: return flights for a chosen outbound are bookable and carry the whole trip price', async () => {
      const outbound = (await get(`${RT}&adults=3`).expect(200)).body.offers[0];
      const res = await get(`/flights/return?from=TLV&to=CDG&date=${FUTURE}&returnDate=${RETURN}&adults=3&token=${encodeURIComponent(outbound.returnToken)}`).expect(200);

      expect(res.body.offers).toHaveLength(8);
      expect(res.body.offers[0].legs[0]).toMatchObject({ fromCode: 'CDG', toCode: 'TLV' });
      expect(JSON.stringify(res.body)).not.toContain('booking_token');
      const q = new URL(String(fetchSpy.mock.calls.at(-1)![0])).searchParams;
      expect(q.get('departure_token')).toBe(outbound.returnToken);
      expect(q.get('type')).toBe('1');
      expect(q.get('return_date')).toBe(RETURN);

      const ref = new URL(res.body.offers[0].handoffUrl).searchParams.get('ref')!;
      const payload = new HandoffSigner(testEnv.HANDOFF_SECRET).verify<{ returnDate: string }>(ref, now(), 'flight');
      expect(payload.returnDate).toBe(RETURN);
    });

    it('rejects a return request without a token or with a bad date', async () => {
      await get(`/flights/return?from=TLV&to=CDG&date=${FUTURE}&returnDate=${RETURN}`).expect(400);
      await get(`/flights/return?from=TLV&to=CDG&date=${FUTURE}&token=abc`).expect(400);
      await get(`/flights/return?from=TLV&to=CDG&date=${FUTURE}&returnDate=2099-03-01&token=abc`).expect(400);
    });

    it('handoff for a round trip looks up booking options as a round trip and shows a capped chooser', async () => {
      const outbound = (await get(`${RT}&adults=4`).expect(200)).body.offers[0];
      const ret = (await get(`/flights/return?from=TLV&to=CDG&date=${FUTURE}&returnDate=${RETURN}&adults=4&token=${encodeURIComponent(outbound.returnToken)}`).expect(200)).body.offers[0];
      const url = new URL(ret.handoffUrl);
      const before = await used();
      const res = await get(url.pathname + url.search, false).expect(200);

      const q = new URL(String(fetchSpy.mock.calls.at(-1)![0])).searchParams;
      expect(q.get('type')).toBe('1');
      expect(q.get('return_date')).toBe(RETURN);
      expect(q.get('booking_token')).toBeTruthy();
      expect(res.text).toContain('Choose where to book');
      expect(res.text.match(/<form /g)).toHaveLength(10);
      expect(await used()).toBe(before + 1);
    });
  });

  describe('GET /flights/calendar', () => {
    const used = async () => (await get('/me/usage').expect(200)).body.used as number;
    const CAL = '/flights/calendar?from=TLV&to=CDG&start=2099-03-01&end=2099-03-31';

    it('requires a token', async () => {
      await get(CAL, false).expect(401);
    });

    it('returns a price per day and calls the calendar engine with the range', async () => {
      const res = await get(CAL).expect(200);
      expect(res.body.currency).toBe('USD');
      expect(res.body.prices).toHaveLength(31);
      expect(res.body.prices[0]).toEqual({ date: '2027-03-01', price: 170 });
      const q = new URL(String(fetchSpy.mock.calls[0][0])).searchParams;
      expect(q.get('engine')).toBe('google_flights_calendar');
      expect(q.get('type')).toBe('2');
      expect(q.get('date_range_start')).toBe('2099-03-01');
      expect(q.get('date_range_end')).toBe('2099-03-31');
    });

    it('serves a repeated range from the cache', async () => {
      await get(`${CAL}&x=1`.replace('&x=1', '')).expect(200);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['end before start', '/flights/calendar?from=TLV&to=CDG&start=2099-03-10&end=2099-03-01'],
      ['a range over two months', '/flights/calendar?from=TLV&to=CDG&start=2099-01-01&end=2099-06-01'],
      ['a past start', '/flights/calendar?from=TLV&to=CDG&start=2001-03-01&end=2001-03-31'],
      ['a bad airport code', '/flights/calendar?from=T&to=CDG&start=2099-03-01&end=2099-03-31'],
    ])('rejects %s with 400 before calling the provider', async (_n, path) => {
      await get(path).expect(400);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('answers 502 and refunds the credit on a provider error', async () => {
      const before = await used();
      fetchSpy.mockImplementation(async () => new Response(JSON.stringify({ error: 'Invalid API key.' }), { status: 200 }));
      await get('/flights/calendar?from=TLV&to=LHR&start=2099-03-01&end=2099-03-31').expect(502);
      expect(await used()).toBe(before);
    });
  });
});
