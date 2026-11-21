import { act, renderHook } from '@testing-library/react-native';
import { useDebouncedValue } from './useDebouncedValue';

const advance = (ms: number) => act(async () => void jest.advanceTimersByTime(ms));

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns the initial value immediately and updates only after the delay', async () => {
    const { result, rerender } = await renderHook<string, { v: string }>(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: 'a' },
    });
    expect(result.current).toBe('a');

    await rerender({ v: 'ab' });
    await advance(299);
    expect(result.current).toBe('a');

    await advance(1);
    expect(result.current).toBe('ab');
  });

  it('restarts the timer on each change and keeps only the last value', async () => {
    const { result, rerender } = await renderHook<string, { v: string }>(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: 'a' },
    });
    await rerender({ v: 'ab' });
    await advance(200);
    await rerender({ v: 'abc' });
    await advance(200);
    expect(result.current).toBe('a');
    await advance(100);
    expect(result.current).toBe('abc');
  });
});
