import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsageResponse } from '@wayfinder/shared';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { ENV } from '../common/tokens';
import type { Env } from '../config/env';
import { CreditLedger } from '../provider/credit-ledger';

@ApiTags('me')
@ApiBearerAuth('bearer')
@Controller('me')
export class MeController {
  constructor(
    private readonly ledger: CreditLedger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @ApiOperation({ summary: "Today's search credits used by the signed-in user and the daily cap" })
  @Get('usage')
  async usage(@CurrentUser() user: AuthUser): Promise<UsageResponse> {
    return { used: await this.ledger.usage(user.userId), cap: this.env.DAILY_CREDIT_CAP };
  }
}
