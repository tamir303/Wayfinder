import { Controller, Get, Query } from '@nestjs/common';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { GeoSuggestQueryDto } from './geo.dto';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('suggest')
  suggest(@Query() query: GeoSuggestQueryDto, @CurrentUser() user: AuthUser) {
    return this.geo.suggestAirports(user.userId, query.q);
  }
}
