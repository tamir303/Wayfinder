import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HTTP_STATUS_BY_CODE } from '@wayfinder/shared';
import type { Response } from 'express';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { AppError } from '../common/app-error';
import { renderErrorPage, type RenderedPage } from '../handoff/handoff-page';
import { FlightSearchQueryDto } from './flights.dto';
import { FlightsService } from './flights.service';

@ApiTags('flights')
@ApiBearerAuth('bearer')
@Controller('flights')
export class FlightsController {
  constructor(private readonly flights: FlightsService) {}

  @ApiOperation({ summary: 'One-way flight search (cached 30 min; costs 1 SerpAPI credit on a miss)' })
  @ApiQuery({ name: 'from', required: true, description: 'Departure airport IATA code', example: 'TLV' })
  @ApiQuery({ name: 'to', required: true, description: 'Arrival airport IATA code', example: 'CDG' })
  @ApiQuery({ name: 'date', required: true, description: 'Departure date, YYYY-MM-DD, today or later', example: '2027-03-10' })
  @ApiQuery({ name: 'adults', required: false, description: '1-9, default 1', example: 1 })
  @ApiQuery({ name: 'cabin', required: false, enum: ['economy', 'premium', 'business', 'first'] })
  @Get('search')
  search(@Query() query: FlightSearchQueryDto, @CurrentUser() user: AuthUser) {
    return this.flights.search(user.userId, query);
  }

  @ApiOperation({
    summary: 'Open the provider booking page for a flight (public; authorised by the signed ref in its handoffUrl)',
    description: 'Returns an HTML page that posts the user to the provider (or lets them choose one). Costs 1 SerpAPI credit for the user named in the ref. Wayfinder never processes payments.',
  })
  @ApiQuery({ name: 'ref', required: true, description: "Signed, short-lived reference from an offer's handoffUrl" })
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('handoff')
  async handoff(@Query('ref') ref: string | undefined, @Res() res: Response): Promise<void> {
    let status = 200;
    let page: RenderedPage;
    try {
      if (!ref) throw new AppError('BAD_QUERY', 'Missing link');
      page = await this.flights.handoff(ref);
    } catch (error) {
      const known = error instanceof AppError;
      status = known ? HTTP_STATUS_BY_CODE[error.code] : 502;
      page = renderErrorPage(known ? error.message : 'Something went wrong. Please try again.');
    }
    res
      .status(status)
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': page.csp,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(page.html);
  }
}
