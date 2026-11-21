// In-memory stand-in for the few ioredis commands the app uses. Backs the dev mock backend and the tests.
// shortcut: TTLs are honoured on read, there is no eviction sweep; fine for a single dev process.
export class MemoryRedis {
  readonly store = new Map<string, string>();
  private readonly expires = new Map<string, number>();

  private live(key: string): boolean {
    const at = this.expires.get(key);
    if (at !== undefined && at <= Date.now()) {
      this.store.delete(key);
      this.expires.delete(key);
    }
    return this.store.has(key);
  }

  async get(key: string): Promise<string | null> {
    return this.live(key) ? (this.store.get(key) as string) : null;
  }

  async set(key: string, value: string, ...args: (string | number)[]): Promise<'OK' | null> {
    if (args.includes('NX') && this.live(key)) return null;
    this.store.set(key, value);
    this.expires.delete(key);
    const unit = args.find((a) => a === 'EX' || a === 'PX');
    if (unit) {
      const n = Number(args[args.indexOf(unit) + 1]);
      this.expires.set(key, Date.now() + (unit === 'EX' ? n * 1000 : n));
    }
    return 'OK';
  }

  async del(key: string): Promise<number> {
    this.expires.delete(key);
    return this.store.delete(key) ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    return this.add(key, 1);
  }

  async decr(key: string): Promise<number> {
    return this.add(key, -1);
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.live(key)) return 0;
    this.expires.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async quit(): Promise<string> {
    return 'OK';
  }

  private add(key: string, by: number): number {
    const next = Number(this.live(key) ? this.store.get(key) : 0) + by;
    this.store.set(key, String(next));
    return next;
  }
}
