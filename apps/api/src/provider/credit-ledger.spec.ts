import type Redis from 'ioredis';
import { AppError } from '../common/app-error';
import { FakeRedis } from '../../test/fake-redis';
import { testEnv } from '../../test/test-env';
import { CreditLedger } from './credit-ledger';

const makeLedger = (cap: number) =>
  new CreditLedger({ ...testEnv, DAILY_CREDIT_CAP: cap }, new FakeRedis() as unknown as Redis);

describe('CreditLedger', () => {
  it('allows usage below the cap', async () => {
    const ledger = makeLedger(2);
    await ledger.consume('u1');
    await expect(ledger.assertAvailable('u1')).resolves.toBeUndefined();
  });

  it('throws RATE_LIMITED once the cap is reached', async () => {
    const ledger = makeLedger(2);
    await ledger.consume('u1');
    await ledger.consume('u1');
    await expect(ledger.assertAvailable('u1')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    await expect(ledger.assertAvailable('u1')).rejects.toBeInstanceOf(AppError);
  });

  it('counts each user separately', async () => {
    const ledger = makeLedger(1);
    await ledger.consume('u1');
    await expect(ledger.assertAvailable('u2')).resolves.toBeUndefined();
  });
});
