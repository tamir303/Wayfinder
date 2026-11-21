import { Module } from '@nestjs/common';
import { HandoffModule } from '../handoff/handoff.module';
import { ProviderModule } from '../provider/provider.module';
import { StaysController } from './stays.controller';
import { StaysService } from './stays.service';

@Module({
  imports: [ProviderModule, HandoffModule],
  controllers: [StaysController],
  providers: [StaysService],
})
export class StaysModule {}
