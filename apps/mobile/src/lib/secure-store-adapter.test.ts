import { chunkedSecureStore } from './secure-store-adapter';

const mockMemory = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockMemory.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (value.length > 2048) throw new Error('value too large for SecureStore');
    mockMemory.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockMemory.delete(key);
  }),
}));

describe('chunkedSecureStore', () => {
  beforeEach(() => mockMemory.clear());

  it('round-trips a value larger than the SecureStore limit', async () => {
    const big = 'x'.repeat(5000);
    await chunkedSecureStore.setItem('sb-auth-token', big);
    expect(await chunkedSecureStore.getItem('sb-auth-token')).toBe(big);
  });

  it('returns null for a missing key', async () => {
    expect(await chunkedSecureStore.getItem('nope')).toBeNull();
  });

  it('removes every chunk', async () => {
    await chunkedSecureStore.setItem('k', 'y'.repeat(4000));
    await chunkedSecureStore.removeItem('k');
    expect(mockMemory.size).toBe(0);
    expect(await chunkedSecureStore.getItem('k')).toBeNull();
  });

  it('overwriting with a shorter value leaves no stale chunks', async () => {
    await chunkedSecureStore.setItem('k', 'a'.repeat(5000));
    await chunkedSecureStore.setItem('k', 'short');
    expect(await chunkedSecureStore.getItem('k')).toBe('short');
    expect([...mockMemory.keys()].sort()).toEqual(['k.0', 'k.n']);
  });
});

describe('chunkedSecureStore concurrency', () => {
  beforeEach(() => mockMemory.clear());

  it('keeps the last of concurrent writes intact (no interleaved chunks)', async () => {
    const a = 'a'.repeat(3000);
    const b = 'b'.repeat(2500);
    await Promise.all([chunkedSecureStore.setItem('k', a), chunkedSecureStore.setItem('k', b)]);
    expect(await chunkedSecureStore.getItem('k')).toBe(b);
  });

  it('keeps non-ASCII chunks under the byte limit', async () => {
    const value = '日本語'.repeat(1000);
    await chunkedSecureStore.setItem('k', value);
    expect(await chunkedSecureStore.getItem('k')).toBe(value);
  });
});
