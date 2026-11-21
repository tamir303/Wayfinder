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
const ALICE = '7d0b2f4e-1111-4222-8333-944455556666';
const BOB = '8e1c3a5f-2222-4333-9444-a55566667777';
const FUTURE = '2099-03-10';

type Row = { id: string; userId: string; fromCode: string; toCode: string; date: string; adults: number; cabin: string; createdAt: Date };

// A tiny in-memory stand-in for the savedSearch delegate.
const makePrisma = () => {
  const rows: Row[] = [];
  let n = 0;
  const same = (r: Row, w: Partial<Row>) => (Object.keys(w) as (keyof Row)[]).every((k) => r[k] === w[k]);
  return {
    rows,
    savedSearch: {
      findMany: async ({ where }: { where: Partial<Row> }) => rows.filter((r) => same(r, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      count: async ({ where }: { where: Partial<Row> }) => rows.filter((r) => same(r, where)).length,
      upsert: async ({ where, create }: { where: { userId_fromCode_toCode_date_adults_cabin: Partial<Row> }; create: Omit<Row, 'id' | 'createdAt'> }) => {
        const found = rows.find((r) => same(r, where.userId_fromCode_toCode_date_adults_cabin));
        if (found) return found;
        const row = { ...create, id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, createdAt: new Date(Date.now() + n) };
        rows.push(row);
        return row;
      },
      deleteMany: async ({ where }: { where: Partial<Row> }) => {
        const keep = rows.filter((r) => !same(r, where));
        const count = rows.length - keep.length;
        rows.splice(0, rows.length, ...keep);
        return { count };
      },
    },
  };
};

describe('saved searches (e2e)', () => {
  let app: INestApplication;
  let alice: string;
  let bob: string;
  const prisma = makePrisma();

  const tokenFor = async (keys: Awaited<ReturnType<typeof generateKeyPair>>, sub: string) =>
    new SignJWT({}).setProtectedHeader({ alg: 'ES256' }).setIssuer(ISSUER).setAudience('authenticated').setSubject(sub).setIssuedAt().setExpirationTime('1h').sign(keys.privateKey);

  beforeAll(async () => {
    const keys = await generateKeyPair('ES256');
    alice = await tokenFor(keys, ALICE);
    bob = await tokenFor(keys, BOB);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(testEnv)
      .overrideProvider(REDIS)
      .useValue(new FakeRedis())
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(JwtVerifier)
      .useValue(new JwtVerifier(async () => keys.publicKey, ISSUER))
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  const api = (token?: string) => ({
    get: () => (token ? request(app.getHttpServer()).get('/me/saved-searches').set('Authorization', `Bearer ${token}`) : request(app.getHttpServer()).get('/me/saved-searches')),
    post: (body: object) => request(app.getHttpServer()).post('/me/saved-searches').set('Authorization', `Bearer ${token}`).send(body),
    del: (id: string) => request(app.getHttpServer()).delete(`/me/saved-searches/${id}`).set('Authorization', `Bearer ${token}`),
  });
  const body = { from: 'TLV', to: 'CDG', date: FUTURE, adults: 2, cabin: 'business' };

  it('requires a token', async () => {
    await api().get().expect(401);
  });

  it('starts empty, saves a search, lists it newest first', async () => {
    await api(alice).get().expect(200, { searches: [] });
    const created = await api(alice).post(body).expect(201);
    expect(created.body).toMatchObject({ ...body, id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    await api(alice).post({ ...body, to: 'LHR' }).expect(201);
    const list = await api(alice).get().expect(200);
    expect(list.body.searches.map((s: { to: string }) => s.to)).toEqual(['LHR', 'CDG']);
  });

  it('does not create a duplicate for the same search', async () => {
    const before = (await api(alice).get().expect(200)).body.searches.length;
    await api(alice).post(body).expect(201);
    expect((await api(alice).get().expect(200)).body.searches).toHaveLength(before);
  });

  it('validates the body like a search', async () => {
    await api(alice).post({ ...body, from: 'tl' }).expect(400);
    await api(alice).post({ ...body, date: '2001-01-01' }).expect(400);
    await api(alice).post({ from: 'TLV' }).expect(400);
  });

  it("keeps users separate: Bob sees none of Alice's searches and cannot delete them", async () => {
    await api(bob).get().expect(200, { searches: [] });
    const id = (await api(alice).get().expect(200)).body.searches[0].id as string;
    const res = await api(bob).del(id).expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect((await api(alice).get().expect(200)).body.searches.map((s: { id: string }) => s.id)).toContain(id);
  });

  it('deletes your own search and rejects a malformed id', async () => {
    const id = (await api(alice).get().expect(200)).body.searches[0].id as string;
    await api(alice).del(id).expect(204);
    expect((await api(alice).get().expect(200)).body.searches.map((s: { id: string }) => s.id)).not.toContain(id);
    await api(alice).del('not-a-uuid').expect(400);
  });

  it('refuses to save more than 50 searches per user', async () => {
    for (let i = 0; i < 50; i++) {
      prisma.rows.push({ id: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`, userId: BOB, fromCode: 'TLV', toCode: 'CDG', date: `2099-06-${String((i % 28) + 1).padStart(2, '0')}`, adults: (i % 9) + 1, cabin: 'economy', createdAt: new Date() });
    }
    const res = await api(bob).post({ ...body, to: 'JFK', date: '2099-12-01' }).expect(400);
    expect(res.body.code).toBe('BAD_QUERY');
    await api(alice).post({ ...body, to: 'JFK', date: '2099-12-01' }).expect(201);
  });
});
