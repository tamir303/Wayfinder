import type Redis from 'ioredis';
import { AppError } from '../common/app-error';
import { FakeRedis } from '../../test/fake-redis';
import { testEnv } from '../../test/test-env';
import { CreditLedger } from './credit-ledger';

const makeLedger = (cap: number) =>
  new CreditLedger({ ...testEnv, DAILY_CREDIT_CAP: cap }, new FakeRedis() as unknown as Redis);

describe('CreditLedger', () => {
  it('reserves usage below the cap', async () => {
    const ledger = makeLedger(2);
    await ledger.reserve('u1');
    await expect(ledger.reserve('u1')).resolves.toBeUndefined();
  });

  it('throws RATE_LIMITED once the cap is reached, without counting the rejected attempt', async () => {
    const ledger = makeLedger(2);
    await ledger.reserve('u1');
    await ledger.reserve('u1');
    await expect(ledger.reserve('u1')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await expect(ledger.reserve('u1')).rejects.toBeInstanceOf(AppError);
    await ledger.refund('u1');
    await expect(ledger.reserve('u1')).resolves.toBeUndefined();
  });

  it('lets only cap-many of many parallel reservations through', async () => {
    const ledger = makeLedger(3);
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => ledger.reserve('u1')));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
  });

  it('counts each user separately', async () => {
    const ledger = makeLedger(1);
    await ledger.reserve('u1');
    await expect(ledger.reserve('u2')).resolves.toBeUndefined();
  });
});
