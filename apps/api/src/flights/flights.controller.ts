import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
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
}
