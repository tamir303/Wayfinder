import { Injectable } from '@nestjs/common';
import type { FlightSearchQuery, SavedSearch } from '@wayfinder/shared';
import { AppError } from '../common/app-error';
import { PrismaService } from '../prisma/prisma.service';

export const MAX_SAVED_SEARCHES = 50;

type Row = { id: string; fromCode: string; toCode: string; date: string; adults: number; cabin: string; createdAt: Date };
const toSavedSearch = (r: Row): SavedSearch => ({
  id: r.id,
  from: r.fromCode,
  to: r.toCode,
  date: r.date,
  adults: r.adults,
  cabin: r.cabin as SavedSearch['cabin'],
  createdAt: r.createdAt.toISOString(),
});

@Injectable()
export class SavedSearchesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<SavedSearch[]> {
    const rows = await this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_SAVED_SEARCHES,
    });
    return rows.map(toSavedSearch);
  }

  async create(userId: string, q: FlightSearchQuery): Promise<SavedSearch> {
    const key = { userId, fromCode: q.from, toCode: q.to, date: q.date, adults: q.adults, cabin: q.cabin };
    // Saving the same search twice is a no-op, so only a genuinely new one counts against the cap.
    const existing = await this.prisma.savedSearch.count({ where: { userId } });
    if (existing >= MAX_SAVED_SEARCHES) {
      const already = await this.prisma.savedSearch.count({ where: key });
      if (already === 0) throw new AppError('BAD_QUERY', `You can save up to ${MAX_SAVED_SEARCHES} searches`);
    }
    const row = await this.prisma.savedSearch.upsert({
      where: { userId_fromCode_toCode_date_adults_cabin: key },
      create: key,
      update: {},
    });
    return toSavedSearch(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    // Scoped by user so one user can never delete another's row, even with a valid id.
    const { count } = await this.prisma.savedSearch.deleteMany({ where: { id, userId } });
    if (count === 0) throw new AppError('NOT_FOUND', 'Saved search not found');
  }
}
