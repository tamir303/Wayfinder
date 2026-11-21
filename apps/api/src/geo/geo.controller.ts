import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { GeoSuggestQueryDto } from './geo.dto';
import { GeoService } from './geo.service';

@ApiTags('geo')
@ApiBearerAuth('bearer')
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @ApiOperation({ summary: 'Airport suggestions for a city or airport name (cached 24h, costs a SerpAPI credit on a miss)' })
  @ApiQuery({ name: 'q', required: true, description: 'City or airport text, 2-80 characters', example: 'tel aviv' })
  @ApiQuery({ name: 'kind', required: false, enum: ['airport'], description: 'Only airports are supported for now' })
  @Get('suggest')
  suggest(@Query() query: GeoSuggestQueryDto, @CurrentUser() user: AuthUser) {
    return this.geo.suggestAirports(user.userId, query.q);
  }
}
