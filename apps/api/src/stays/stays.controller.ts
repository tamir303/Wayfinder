import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HTTP_STATUS_BY_CODE } from '@wayfinder/shared';
import type { Response } from 'express';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { AppError } from '../common/app-error';
import { renderErrorPage, sendPage } from '../handoff/handoff-page';
import { StaySearchQueryDto } from './stays.dto';
import { StaysService } from './stays.service';

@ApiTags('stays')
@Controller('stays')
export class StaysController {
  constructor(private readonly stays: StaysService) {}

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Search stays for a destination and dates (cached 30 min; 1 SerpAPI credit per uncached page)' })
  @ApiQuery({ name: 'q', required: true, description: 'Destination text, 2-80 characters', example: 'Paris hotels' })
  @ApiQuery({ name: 'checkIn', required: true, description: 'YYYY-MM-DD, today or later', example: '2027-03-10' })
  @ApiQuery({ name: 'checkOut', required: true, description: 'YYYY-MM-DD, after checkIn, at most 30 nights', example: '2027-03-14' })
  @ApiQuery({ name: 'adults', required: false, description: '1-9, default 2', example: 2 })
  @ApiQuery({ name: 'pageToken', required: false, description: 'nextPageToken from the previous page' })
  @Get('search')
  search(@Query() query: StaySearchQueryDto, @CurrentUser() user: AuthUser) {
    return this.stays.search(user.userId, query);
  }

  @ApiOperation({
    summary: "Open a stay's provider page (public; authorised by the signed ref in a stay's dealUrl)",
    description: 'Records the click and redirects (302) to the provider. Costs no credit. Wayfinder never processes payments.',
  })
  @ApiQuery({ name: 'ref', required: true, description: "Signed, short-lived reference from a stay's dealUrl" })
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('handoff')
  async handoff(@Query('ref') ref: string | undefined, @Res() res: Response): Promise<void> {
    try {
      if (!ref) throw new AppError('BAD_QUERY', 'Missing link');
      const url = await this.stays.handoff(ref);
      res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }).redirect(302, url);
    } catch (error) {
      const known = error instanceof AppError;
      sendPage(res, known ? HTTP_STATUS_BY_CODE[error.code] : 502, renderErrorPage(known ? error.message : 'Something went wrong. Please try again.'));
    }
  }
}
