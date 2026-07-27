import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  FavoriteSlot,
  ProfileDiaryResponse,
  ProfileWatchlistResponse,
  PublicProfile,
} from '@cinelog/contracts';
import { CurrentUser, Public } from '../common/decorators';
import { ProfilesService } from './profiles.service';
import { UpdateFavoritesDto } from './profiles.dto';

@ApiTags('profiles')
@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Public()
  @Get('users/:username')
  getProfile(
    @Param('username') username: string,
    @CurrentUser('sub') viewerId: string | undefined,
  ): Promise<PublicProfile> {
    return this.profiles.getPublicProfile(username, viewerId);
  }

  @Public()
  @Get('users/:username/diary')
  getDiary(
    @Param('username') username: string,
    @CurrentUser('sub') viewerId: string | undefined,
  ): Promise<ProfileDiaryResponse> {
    return this.profiles.getDiary(username, viewerId);
  }

  @Public()
  @Get('users/:username/watchlist')
  getWatchlist(
    @Param('username') username: string,
    @CurrentUser('sub') viewerId: string | undefined,
  ): Promise<ProfileWatchlistResponse> {
    return this.profiles.getWatchlist(username, viewerId);
  }

  @ApiBearerAuth()
  @Patch('users/me/favorites')
  setFavorites(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateFavoritesDto,
  ): Promise<FavoriteSlot[]> {
    return this.profiles.setFavorites(userId, dto);
  }
}
