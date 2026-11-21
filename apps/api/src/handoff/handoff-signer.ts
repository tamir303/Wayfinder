import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../common/app-error';

export type HandoffPayload = {
  userId: string;
  bookingToken: string;
  from: string;
  to: string;
  date: string;
  adults: number;
  cabin: string;
  /** Expiry as epoch seconds. */
  exp: number;
};

const invalid = () => new AppError('BAD_QUERY', 'Invalid or expired link');

// The system browser opens the handoff link and cannot send our bearer token, so the link itself
// carries a signed, short-lived payload naming the user the credit is charged to.
export class HandoffSigner {
  constructor(private readonly secret: string) {}

  private mac(body: string): Buffer {
    return createHmac('sha256', this.secret).update(body).digest();
  }

  sign(payload: Omit<HandoffPayload, 'exp'>, nowSeconds: number, ttlSeconds: number): string {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: nowSeconds + ttlSeconds })).toString('base64url');
    return `${body}.${this.mac(body).toString('base64url')}`;
  }

  verify(ref: string, nowSeconds: number): HandoffPayload {
    const parts = ref.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw invalid();
    const [body, sig] = parts as [string, string];
    const given = Buffer.from(sig, 'base64url');
    const expected = this.mac(body);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw invalid();

    let payload: HandoffPayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as HandoffPayload;
    } catch {
      throw invalid();
    }
    if (typeof payload.exp !== 'number' || payload.exp < nowSeconds) throw invalid();
    return payload;
  }
}
