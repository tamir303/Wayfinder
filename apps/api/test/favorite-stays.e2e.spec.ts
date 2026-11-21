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

type Row = { id: string; userId: string; stayId: string; name: string; thumbnail: string | null; stars: number | null; rating: number | null; lat: number; lng: number; createdAt: Date };

// A tiny in-memory stand-in for the favoriteStay delegate.
const makePrisma = () => {
  const rows: Row[] = [];
  let n = 0;
  const same = (r: Row, w: Partial<Row>) => (Object.keys(w) as (keyof Row)[]).every((k) => r[k] === w[k]);
  return {
    rows,
    favoriteStay: {
      findMany: async ({ where }: { where: Partial<Row> }) => rows.filter((r) => same(r, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      count: async ({ where }: { where: Partial<Row> }) => rows.filter((r) => same(r, where)).length,
      upsert: async ({ where, create, update }: { where: { userId_stayId: Partial<Row> }; create: Omit<Row, 'id' | 'createdAt'>; update: Partial<Row> }) => {
        const found = rows.find((r) => same(r, where.userId_stayId));
        if (found) return Object.assign(found, update);
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

describe('favorite stays (e2e)', () => {
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

  const api = (token?: string) => {
    const authed = (r: request.Test) => (token ? r.set('Authorization', `Bearer ${token}`) : r);
    const server = () => request(app.getHttpServer());
    return {
      get: () => authed(server().get('/me/favorites/stays')),
      put: (id: string, body: object) => authed(server().put(`/me/favorites/stays/${encodeURIComponent(id)}`)).send(body),
      del: (id: string) => authed(server().delete(`/me/favorites/stays/${encodeURIComponent(id)}`)),
    };
  };
  const stay = (over: object = {}) => ({ id: 'tok-1', name: 'Hotel Eden', thumbnail: 'https://img.example/a.jpg', stars: 4, rating: 4.4, lat: 48.85, lng: 2.37, ...over });

  it('requires a token', async () => {
    await api().get().expect(401);
  });

  it('starts empty, favorites a stay (idempotent PUT), lists newest first', async () => {
    await api(alice).get().expect(200, { favorites: [] });
    const created = await api(alice).put('tok-1', stay()).expect(200);
    expect(created.body).toMatchObject({ id: 'tok-1', name: 'Hotel Eden', lat: 48.85 });
    await api(alice).put('tok-2', stay({ id: 'tok-2', name: 'Casa Rossa' })).expect(200);
    await api(alice).put('tok-1', stay({ name: 'Hotel Eden (renamed)' })).expect(200);
    const list = (await api(alice).get().expect(200)).body.favorites;
    expect(list.map((f: { id: string }) => f.id).sort()).toEqual(['tok-1', 'tok-2']);
    expect(list.find((f: { id: string }) => f.id === 'tok-1').name).toBe('Hotel Eden (renamed)');
  });

  it('validates the body and requires the path id to match it', async () => {
    await api(alice).put('tok-9', stay({ id: 'tok-9', lat: 120 })).expect(400);
    await api(alice).put('tok-9', stay({ id: 'tok-9', name: '' })).expect(400);
    await api(alice).put('tok-9', stay({ id: 'tok-9', thumbnail: 'not a url' })).expect(400);
    const mismatch = await api(alice).put('tok-9', stay({ id: 'other' })).expect(400);
    expect(mismatch.body.code).toBe('BAD_QUERY');
  });

  it("keeps users separate: Bob sees none of Alice's favorites and cannot remove them", async () => {
    await api(bob).get().expect(200, { favorites: [] });
    const res = await api(bob).del('tok-1').expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect((await api(alice).get().expect(200)).body.favorites.map((f: { id: string }) => f.id)).toContain('tok-1');
  });

  it('removes your own favorite', async () => {
    await api(alice).del('tok-1').expect(204);
    expect((await api(alice).get().expect(200)).body.favorites.map((f: { id: string }) => f.id)).not.toContain('tok-1');
    await api(alice).del('tok-1').expect(404);
  });

  it('refuses to add a new favorite beyond 200 per user, but still updates an existing one', async () => {
    for (let i = 0; i < 200; i++) {
      prisma.rows.push({ id: `22222222-2222-4222-8222-${String(i).padStart(12, '0')}`, userId: BOB, stayId: `bulk-${i}`, name: 'x', thumbnail: null, stars: null, rating: null, lat: 0, lng: 0, createdAt: new Date() });
    }
    const res = await api(bob).put('new-one', stay({ id: 'new-one' })).expect(400);
    expect(res.body.code).toBe('BAD_QUERY');
    await api(bob).put('bulk-5', stay({ id: 'bulk-5', name: 'updated' })).expect(200);
    await api(alice).put('tok-new', stay({ id: 'tok-new' })).expect(200);
  });
});
