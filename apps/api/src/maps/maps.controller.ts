import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MapConfigResponse } from '@wayfinder/shared';
import { ENV } from '../common/tokens';
import type { Env } from '../config/env';

@ApiTags('maps')
@ApiBearerAuth('bearer')
@Controller('maps')
export class MapsController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @ApiOperation({ summary: 'Map tile style for the app map, or null when none is configured' })
  @Get('config')
  config(): MapConfigResponse {
    // A client-side tile key is public by design (it ships in the app); keep it per-environment.
    return { styleUrl: this.env.MAP_STYLE_URL ?? null };
  }
}
