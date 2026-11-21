import { Module } from '@nestjs/common';
import { ProviderModule } from '../provider/provider.module';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

@Module({
  imports: [ProviderModule],
  controllers: [GeoController],
  providers: [GeoService],
})
export class GeoModule {}
