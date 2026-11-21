import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SavedSearch, SavedSearchListResponse } from '@wayfinder/shared';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { FlightSearchQueryDto } from '../flights/flights.dto';
import { SavedSearchesService } from './saved-searches.service';

@ApiTags('me')
@ApiBearerAuth('bearer')
@Controller('me/saved-searches')
export class SavedSearchesController {
  constructor(private readonly saved: SavedSearchesService) {}

  @ApiOperation({ summary: "The signed-in user's saved flight searches, newest first" })
  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<SavedSearchListResponse> {
    return { searches: await this.saved.list(user.userId) };
  }

  @ApiOperation({ summary: 'Save a flight search (same search twice is a no-op; max 50 per user)' })
  @Post()
  create(@Body() body: FlightSearchQueryDto, @CurrentUser() user: AuthUser): Promise<SavedSearch> {
    return this.saved.create(user.userId, body);
  }

  @ApiOperation({ summary: 'Delete one of your saved searches' })
  @HttpCode(204)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser): Promise<void> {
    await this.saved.remove(user.userId, id);
  }
}
