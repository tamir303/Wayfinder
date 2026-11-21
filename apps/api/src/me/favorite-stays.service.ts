import { Injectable } from '@nestjs/common';
import type { FavoriteStay, FavoriteStayInput } from '@wayfinder/shared';
import { AppError } from '../common/app-error';
import { PrismaService } from '../prisma/prisma.service';

export const MAX_FAVORITE_STAYS = 200;

type Row = { stayId: string; name: string; thumbnail: string | null; stars: number | null; rating: number | null; lat: number; lng: number; createdAt: Date };
const toFavorite = (r: Row): FavoriteStay => ({
  id: r.stayId,
  name: r.name,
  thumbnail: r.thumbnail,
  stars: r.stars,
  rating: r.rating,
  lat: r.lat,
  lng: r.lng,
  createdAt: r.createdAt.toISOString(),
});

@Injectable()
export class FavoriteStaysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<FavoriteStay[]> {
    const rows = await this.prisma.favoriteStay.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_FAVORITE_STAYS,
    });
    return rows.map(toFavorite);
  }

  /** Idempotent: favoriting the same stay again refreshes its snapshot. */
  async put(userId: string, input: FavoriteStayInput): Promise<FavoriteStay> {
    const data = { name: input.name, thumbnail: input.thumbnail, stars: input.stars, rating: input.rating, lat: input.lat, lng: input.lng };
    const where = { userId, stayId: input.id };
    // Only a genuinely new favorite counts against the cap.
    if ((await this.prisma.favoriteStay.count({ where: { userId } })) >= MAX_FAVORITE_STAYS && (await this.prisma.favoriteStay.count({ where })) === 0) {
      throw new AppError('BAD_QUERY', `You can favorite up to ${MAX_FAVORITE_STAYS} stays`);
    }
    const row = await this.prisma.favoriteStay.upsert({
      where: { userId_stayId: where },
      create: { ...where, ...data },
      update: data,
    });
    return toFavorite(row);
  }

  async remove(userId: string, stayId: string): Promise<void> {
    // Scoped by user so one user can never remove another's favorite.
    const { count } = await this.prisma.favoriteStay.deleteMany({ where: { userId, stayId } });
    if (count === 0) throw new AppError('NOT_FOUND', 'Favorite not found');
  }
}
