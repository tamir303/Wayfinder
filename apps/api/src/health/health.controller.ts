import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Liveness check (public)' })
  @Public()
  @Get()
  check() {
    return { ok: true };
  }
}
