import { Module } from '@nestjs/common';
import { ProviderModule } from '../provider/provider.module';
import { FavoriteStaysController } from './favorite-stays.controller';
import { FavoriteStaysService } from './favorite-stays.service';
import { MeController } from './me.controller';
import { SavedSearchesController } from './saved-searches.controller';
import { SavedSearchesService } from './saved-searches.service';

@Module({
  imports: [ProviderModule],
  controllers: [MeController, SavedSearchesController, FavoriteStaysController],
  providers: [SavedSearchesService, FavoriteStaysService],
})
export class MeModule {}
