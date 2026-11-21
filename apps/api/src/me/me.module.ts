import { Module } from '@nestjs/common';
import { ProviderModule } from '../provider/provider.module';
import { MeController } from './me.controller';

@Module({ imports: [ProviderModule], controllers: [MeController] })
export class MeModule {}
