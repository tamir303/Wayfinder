import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HTTP_STATUS_BY_CODE } from '@wayfinder/shared';
import type { Response } from 'express';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { AppError } from '../common/app-error';
import { renderErrorPage, sendPage } from '../handoff/handoff-page';
import { StayCalendarQueryDto, StayDetailQueryDto, StayReviewsQueryDto, StaySearchQueryDto, StaySuggestQueryDto } from './stays.dto';
import { StaysService } from './stays.service';

const MAX_TOKEN_LENGTH = 300;
const checkToken = (token: string): void => {
  if (token.length > MAX_TOKEN_LENGTH) throw new AppError('BAD_QUERY', 'Invalid property id');
};

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

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Destination and hotel suggestions for a search box (cached 24 h; 1 credit on a miss)' })
  @ApiQuery({ name: 'q', required: true, description: '2-80 characters', example: 'paris' })
  @Get('suggest')
  suggest(@Query() query: StaySuggestQueryDto, @CurrentUser() user: AuthUser) {
    return this.stays.suggest(user.userId, query);
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

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'One property with prices by provider, ratings, amenities and photos (cached 30 min; 1 credit on a miss)' })
  @ApiParam({ name: 'token', description: "A stay's id (provider property token)" })
  @ApiQuery({ name: 'q', required: true, description: 'The destination text used for the search', example: 'Paris hotels' })
  @ApiQuery({ name: 'checkIn', required: true, example: '2027-03-10' })
  @ApiQuery({ name: 'checkOut', required: true, example: '2027-03-14' })
  @ApiQuery({ name: 'adults', required: false, example: 2 })
  @Get(':token')
  detail(@Param('token') token: string, @Query() query: StayDetailQueryDto, @CurrentUser() user: AuthUser) {
    checkToken(token);
    return this.stays.detail(user.userId, token, query);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Best one-night price per start day for a property (cached 3 h; 1 credit on a miss)' })
  @ApiParam({ name: 'token', description: "A stay's id (provider property token)" })
  @ApiQuery({ name: 'start', required: true, description: 'First day, today or later', example: '2027-03-01' })
  @ApiQuery({ name: 'end', required: true, description: 'Last day, at most about two months after start', example: '2027-03-31' })
  @ApiQuery({ name: 'adults', required: false, example: 2 })
  @Get(':token/calendar')
  calendar(@Param('token') token: string, @Query() query: StayCalendarQueryDto, @CurrentUser() user: AuthUser) {
    checkToken(token);
    return this.stays.calendar(user.userId, token, query);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Guest reviews for a property, 10 per page (cached 24 h; 1 credit on a miss)' })
  @ApiParam({ name: 'token', description: "A stay's id (provider property token)" })
  @ApiQuery({ name: 'pageToken', required: false, description: 'nextPageToken from the previous page' })
  @Get(':token/reviews')
  reviews(@Param('token') token: string, @Query() query: StayReviewsQueryDto, @CurrentUser() user: AuthUser) {
    checkToken(token);
    return this.stays.reviews(user.userId, token, query);
  }
}
