import { Body, Controller, Delete, Get, HttpCode, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { FavoriteStayInputSchema, type FavoriteStay, type FavoriteStayListResponse } from '@wayfinder/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { AppError } from '../common/app-error';
import { FavoriteStaysService } from './favorite-stays.service';

class FavoriteStayDto extends createZodDto(FavoriteStayInputSchema) {}

@ApiTags('me')
@ApiBearerAuth('bearer')
@Controller('me/favorites/stays')
export class FavoriteStaysController {
  constructor(private readonly favorites: FavoriteStaysService) {}

  @ApiOperation({ summary: "The signed-in user's favorite stays, newest first" })
  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<FavoriteStayListResponse> {
    return { favorites: await this.favorites.list(user.userId) };
  }

  @ApiOperation({ summary: 'Favorite a stay (idempotent; max 200 per user). The body id must match the path id.' })
  @ApiParam({ name: 'id', description: "The stay's id (provider property token)" })
  @Put(':id')
  put(@Param('id') id: string, @Body() body: FavoriteStayDto, @CurrentUser() user: AuthUser): Promise<FavoriteStay> {
    if (body.id !== id) throw new AppError('BAD_QUERY', 'Path id and body id must match');
    return this.favorites.put(user.userId, body);
  }

  @ApiOperation({ summary: 'Remove a favorite stay' })
  @ApiParam({ name: 'id', description: "The stay's id (provider property token)" })
  @HttpCode(204)
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<void> {
    await this.favorites.remove(user.userId, id);
  }
}
