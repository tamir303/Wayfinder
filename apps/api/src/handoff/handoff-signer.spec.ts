import { HandoffSigner, type HandoffPayload } from './handoff-signer';

const SECRET = 'a-test-secret-that-is-at-least-32-chars-long';
const payload: Omit<HandoffPayload, 'exp'> = {
  userId: '7d0b2f4e-1111-4222-8333-944455556666',
  bookingToken: 'tok+/=',
  from: 'TLV',
  to: 'CDG',
  date: '2027-03-10',
  adults: 2,
  cabin: 'economy',
};

describe('HandoffSigner', () => {
  const signer = new HandoffSigner(SECRET);

  it('round-trips a payload', () => {
    const ref = signer.sign(payload, 1_000, 60);
    expect(signer.verify(ref, 1_030)).toEqual({ ...payload, exp: 1_060 });
  });

  it('produces a URL-safe reference', () => {
    expect(signer.sign(payload, 1_000, 60)).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it('rejects an expired reference', () => {
    const ref = signer.sign(payload, 1_000, 60);
    expect(() => signer.verify(ref, 1_061)).toThrow(expect.objectContaining({ code: 'BAD_QUERY' }));
  });

  it('rejects a tampered payload', () => {
    const [body, sig] = signer.sign(payload, 1_000, 60).split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload, userId: 'attacker', exp: 9_999_999 })).toString('base64url');
    expect(() => signer.verify(`${forged}.${sig}`, 1_010)).toThrow(expect.objectContaining({ code: 'BAD_QUERY' }));
    expect(() => signer.verify(`${body}.${'A'.repeat(sig!.length)}`, 1_010)).toThrow(expect.objectContaining({ code: 'BAD_QUERY' }));
  });

  it('rejects a reference signed with a different secret', () => {
    const ref = new HandoffSigner('another-secret-that-is-also-32-chars-long!').sign(payload, 1_000, 60);
    expect(() => signer.verify(ref, 1_010)).toThrow(expect.objectContaining({ code: 'BAD_QUERY' }));
  });

  it('rejects garbage', () => {
    for (const bad of ['', 'x', 'a.b.c', '....', 'e30.e30']) {
      expect(() => signer.verify(bad, 1_000)).toThrow(expect.objectContaining({ code: 'BAD_QUERY' }));
    }
  });
});
