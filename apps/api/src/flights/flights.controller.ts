import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HTTP_STATUS_BY_CODE } from '@wayfinder/shared';
import type { Response } from 'express';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { AppError } from '../common/app-error';
import { renderErrorPage, sendPage, type RenderedPage } from '../handoff/handoff-page';
import { FlightCalendarQueryDto, FlightReturnQueryDto, FlightSearchQueryDto } from './flights.dto';
import { FlightsService } from './flights.service';

@ApiTags('flights')
@ApiBearerAuth('bearer')
@Controller('flights')
export class FlightsController {
  constructor(private readonly flights: FlightsService) {}

  @ApiOperation({
    summary: 'Flight search (cached 30 min; 1 SerpAPI credit on a miss)',
    description: 'One-way by default. With returnDate it is a round trip: offers are outbound options with a returnToken (handoffUrl is null); pick one and call /flights/return.',
  })
  @ApiQuery({ name: 'from', required: true, description: 'Departure airport IATA code', example: 'TLV' })
  @ApiQuery({ name: 'to', required: true, description: 'Arrival airport IATA code', example: 'CDG' })
  @ApiQuery({ name: 'date', required: true, description: 'Departure date, YYYY-MM-DD, today or later', example: '2027-03-10' })
  @ApiQuery({ name: 'returnDate', required: false, description: 'YYYY-MM-DD, after date. Makes it a round trip', example: '2027-03-17' })
  @ApiQuery({ name: 'adults', required: false, description: '1-9, default 1', example: 1 })
  @ApiQuery({ name: 'cabin', required: false, enum: ['economy', 'premium', 'business', 'first'] })
  @Get('search')
  search(@Query() query: FlightSearchQueryDto, @CurrentUser() user: AuthUser) {
    return this.flights.search(user.userId, query);
  }

  @ApiOperation({ summary: 'Round trip step two: return flights for a chosen outbound, priced as the whole trip (1 credit on a miss)' })
  @ApiQuery({ name: 'from', required: true, example: 'TLV' })
  @ApiQuery({ name: 'to', required: true, example: 'CDG' })
  @ApiQuery({ name: 'date', required: true, example: '2027-03-10' })
  @ApiQuery({ name: 'returnDate', required: true, example: '2027-03-17' })
  @ApiQuery({ name: 'token', required: true, description: "returnToken of the chosen outbound offer" })
  @ApiQuery({ name: 'adults', required: false })
  @ApiQuery({ name: 'cabin', required: false, enum: ['economy', 'premium', 'business', 'first'] })
  @Get('return')
  returnFlights(@Query() query: FlightReturnQueryDto, @CurrentUser() user: AuthUser) {
    return this.flights.returnFlights(user.userId, query);
  }

  @ApiOperation({ summary: 'One-way price per day for a date range, for flexible dates (cached 3 h; 1 credit on a miss)' })
  @ApiQuery({ name: 'from', required: true, example: 'TLV' })
  @ApiQuery({ name: 'to', required: true, example: 'CDG' })
  @ApiQuery({ name: 'start', required: true, description: 'First day, today or later', example: '2027-03-01' })
  @ApiQuery({ name: 'end', required: true, description: 'Last day, at most about two months after start', example: '2027-03-31' })
  @Get('calendar')
  calendar(@Query() query: FlightCalendarQueryDto, @CurrentUser() user: AuthUser) {
    return this.flights.calendar(user.userId, query);
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
    sendPage(res, status, page);
  }
}
