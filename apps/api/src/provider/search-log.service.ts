import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SearchLogEntry = {
  userId: string;
  engine: string;
  cacheHit: boolean;
  credits: number;
};

@Injectable()
export class SearchLogService {
  private readonly logger = new Logger(SearchLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: SearchLogEntry): Promise<void> {
    try {
      await this.prisma.searchLog.create({ data: entry });
    } catch (error) {
      this.logger.warn(`search log write failed: ${(error as Error).message}`);
    }
  }
}
