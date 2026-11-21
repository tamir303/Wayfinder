import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../common/app-error';

export type HandoffKind = 'flight' | 'stay';

const invalid = () => new AppError('BAD_QUERY', 'Invalid or expired link');

// The system browser opens handoff links and cannot send our bearer token, so each link carries a
// signed, short-lived payload (naming the user a credit is charged to, or the destination).
// `k` binds a ref to one endpoint, so a stay link can never be replayed against the flight handoff.
export class HandoffSigner {
  constructor(private readonly secret: string) {}

  private mac(body: string): Buffer {
    return createHmac('sha256', this.secret).update(body).digest();
  }

  sign<P extends object>(kind: HandoffKind, payload: P, nowSeconds: number, ttlSeconds: number): string {
    const body = Buffer.from(JSON.stringify({ ...payload, k: kind, exp: nowSeconds + ttlSeconds })).toString('base64url');
    return `${body}.${this.mac(body).toString('base64url')}`;
  }

  verify<P extends object>(ref: string, nowSeconds: number, kind: HandoffKind): P & { k: HandoffKind; exp: number } {
    const parts = ref.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw invalid();
    const [body, sig] = parts as [string, string];
    const given = Buffer.from(sig, 'base64url');
    const expected = this.mac(body);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw invalid();

    let payload: P & { k: HandoffKind; exp: number };
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as P & { k: HandoffKind; exp: number };
    } catch {
      throw invalid();
    }
    if (payload.k !== kind || typeof payload.exp !== 'number' || payload.exp < nowSeconds) throw invalid();
    return payload;
  }
}
