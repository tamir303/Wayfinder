import { Module } from '@nestjs/common';
import { ProviderModule } from '../provider/provider.module';
import { MeController } from './me.controller';
import { SavedSearchesController } from './saved-searches.controller';
import { SavedSearchesService } from './saved-searches.service';

@Module({ imports: [ProviderModule], controllers: [MeController, SavedSearchesController], providers: [SavedSearchesService] })
export class MeModule {}
