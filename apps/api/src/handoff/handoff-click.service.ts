import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type HandoffClickEntry = { userId: string; kind: 'flight'; provider: string; price: number | null; currency: string | null };

@Injectable()
export class HandoffClickService {
  private readonly logger = new Logger(HandoffClickService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Analytics must never block the user from reaching the provider.
  async record(entry: HandoffClickEntry): Promise<void> {
    try {
      await this.prisma.handoffClick.create({ data: entry });
    } catch (error) {
      this.logger.warn(`handoff click write failed: ${(error as Error).message}`);
    }
  }
}
