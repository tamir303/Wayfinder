import { Module } from '@nestjs/common';
import { ENV } from '../common/tokens';
import type { Env } from '../config/env';
import { HandoffClickService } from './handoff-click.service';
import { HandoffSigner } from './handoff-signer';

@Module({
  providers: [
    { provide: HandoffSigner, inject: [ENV], useFactory: (env: Env) => new HandoffSigner(env.HANDOFF_SECRET) },
    HandoffClickService,
  ],
  exports: [HandoffSigner, HandoffClickService],
})
export class HandoffModule {}
