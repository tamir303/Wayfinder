import { createRecents, type KeyValueStore } from './recents';

const memory = (initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } => {
  const data = { ...initial };
  return { data, getItem: async (k) => data[k] ?? null, setItem: async (k, v) => void (data[k] = v) };
};
type Item = { id: string; n?: number };
const make = (store: KeyValueStore, max = 3) => createRecents<Item>(store, 'k', max, (a, b) => a.id === b.id);

describe('createRecents', () => {
  it('starts empty and keeps the newest first', async () => {
    const r = make(memory());
    expect(await r.load()).toEqual([]);
    await r.add({ id: 'a' });
    expect(await r.add({ id: 'b' })).toEqual([{ id: 'b' }, { id: 'a' }]);
  });

  it('moves a repeated item to the front without duplicating it, using its latest data', async () => {
    const r = make(memory());
    await r.add({ id: 'a', n: 1 });
    await r.add({ id: 'b' });
    expect(await r.add({ id: 'a', n: 2 })).toEqual([{ id: 'a', n: 2 }, { id: 'b' }]);
  });

  it('keeps at most `max` items', async () => {
    const r = make(memory(), 3);
    for (const id of ['a', 'b', 'c', 'd']) await r.add({ id });
    expect((await r.load()).map((x) => x.id)).toEqual(['d', 'c', 'b']);
  });

  it('persists to the store and a new instance reads it back', async () => {
    const store = memory();
    await make(store).add({ id: 'a' });
    expect(await make(store).load()).toEqual([{ id: 'a' }]);
  });

  it('ignores corrupt stored data', async () => {
    expect(await make(memory({ k: '{not json' })).load()).toEqual([]);
    expect(await make(memory({ k: '{"a":1}' })).load()).toEqual([]);
  });

  it('never throws when storage fails; it just returns what it has', async () => {
    const broken: KeyValueStore = { getItem: async () => { throw new Error('disk'); }, setItem: async () => { throw new Error('disk'); } };
    const r = make(broken);
    expect(await r.load()).toEqual([]);
    expect(await r.add({ id: 'a' })).toEqual([{ id: 'a' }]);
  });
});
