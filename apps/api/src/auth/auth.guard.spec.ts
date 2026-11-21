import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { generateKeyPair, SignJWT, type KeyLike } from 'jose';
import { AuthGuard } from './auth.guard';
import { JwtVerifier } from './jwt-verifier';
import { IS_PUBLIC } from './public.decorator';

const ISSUER = 'https://proj.supabase.co/auth/v1';
const USER_ID = '7d0b2f4e-1111-4222-8333-944455556666';

const sign = (
  key: KeyLike,
  opts: { iat?: number; exp?: number; iss?: string; aud?: string; sub?: string | null } = {},
) => {
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT({})
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer(opts.iss ?? ISSUER)
    .setAudience(opts.aud ?? 'authenticated')
    .setIssuedAt(opts.iat ?? now)
    .setExpirationTime(opts.exp ?? now + 3600);
  if (opts.sub !== null) jwt.setSubject(opts.sub ?? USER_ID);
  return jwt.sign(key);
};

const contextFor = (headers: Record<string, string>, isPublic = false) => {
  const request: { headers: Record<string, string>; user?: unknown } = { headers };
  const handler = () => undefined;
  if (isPublic) Reflect.defineMetadata(IS_PUBLIC, true, handler);
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { context, request };
};

describe('AuthGuard', () => {
  let goodKeys: Awaited<ReturnType<typeof generateKeyPair>>;
  let otherKeys: Awaited<ReturnType<typeof generateKeyPair>>;
  let guard: AuthGuard;

  beforeAll(async () => {
    goodKeys = await generateKeyPair('ES256');
    otherKeys = await generateKeyPair('ES256');
    guard = new AuthGuard(new Reflector(), new JwtVerifier(async () => goodKeys.publicKey, ISSUER));
  });

  it('accepts a valid token and sets request.user', async () => {
    const token = await sign(goodKeys.privateKey);
    const { context, request } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ userId: USER_ID });
  });

  it('rejects a missing header', async () => {
    const { context } = contextFor({});
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects a non-Bearer scheme', async () => {
    const { context } = contextFor({ authorization: 'Basic abc' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects an expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(goodKeys.privateKey, { iat: now - 7200, exp: now - 3600 });
    const { context } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects a token signed with a different key', async () => {
    const token = await sign(otherKeys.privateKey);
    const { context } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects a wrong issuer and a wrong audience', async () => {
    const badIssuer = await sign(goodKeys.privateKey, { iss: 'https://evil.example/auth/v1' });
    const badAudience = await sign(goodKeys.privateKey, { aud: 'anon' });
    for (const token of [badIssuer, badAudience]) {
      const { context } = contextFor({ authorization: `Bearer ${token}` });
      await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    }
  });

  it('rejects a token without a subject', async () => {
    const token = await sign(goodKeys.privateKey, { sub: null });
    const { context } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('lets @Public() routes through without a token', async () => {
    const { context } = contextFor({}, true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
