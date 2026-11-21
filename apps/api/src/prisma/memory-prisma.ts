import { randomUUID } from 'node:crypto';

type Row = Record<string, unknown> & { id: string; createdAt: Date };
type Where = Record<string, unknown>;

const matches = (row: Row, where: Where = {}) => Object.entries(where).every(([k, v]) => row[k] === v);

// Generic in-memory table with the few Prisma delegate methods the services call. Backs the dev mock backend.
const table = (uniqueKey?: string) => {
  const rows: Row[] = [];
  return {
    findMany: async ({ where, take }: { where?: Where; take?: number } = {}) =>
      rows.filter((r) => matches(r, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, take),
    count: async ({ where }: { where?: Where } = {}) => rows.filter((r) => matches(r, where)).length,
    create: async ({ data }: { data: Where }) => {
      const row = { ...data, id: randomUUID(), createdAt: new Date() } as Row;
      rows.push(row);
      return row;
    },
    upsert: async ({ where, create, update }: { where: Record<string, Where>; create: Where; update: Where }) => {
      const found = rows.find((r) => matches(r, where[uniqueKey as string]));
      if (found) return Object.assign(found, update);
      const row = { ...create, id: randomUUID(), createdAt: new Date() } as Row;
      rows.push(row);
      return row;
    },
    deleteMany: async ({ where }: { where?: Where } = {}) => {
      const before = rows.length;
      const keep = rows.filter((r) => !matches(r, where));
      rows.splice(0, rows.length, ...keep);
      return { count: before - keep.length };
    },
  };
};

export const createMemoryPrisma = () => ({
  savedSearch: table('userId_fromCode_toCode_date_adults_cabin'),
  favoriteStay: table('userId_stayId'),
  handoffClick: table(),
  searchLog: table(),
  $connect: async () => undefined,
  $disconnect: async () => undefined,
});
