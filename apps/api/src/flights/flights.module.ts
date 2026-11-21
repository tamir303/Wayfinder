import { Module } from '@nestjs/common';
import { HandoffModule } from '../handoff/handoff.module';
import { ProviderModule } from '../provider/provider.module';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';

@Module({
  imports: [ProviderModule, HandoffModule],
  controllers: [FlightsController],
  providers: [FlightsService],
})
export class FlightsModule {}
