import { createObserveModule } from '@nestjs/observe';

// ObserveInstrument must also be passed to NestFactory.create (main.ts and api/index.ts).
export const { ObserveModule, ObserveInstrument } = createObserveModule();
