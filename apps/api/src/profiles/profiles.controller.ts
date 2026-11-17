import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  FavoriteSlot,
  ProfileDiaryResponse,
  ProfileLikesResponse,
  ProfileWatchedResponse,
  ProfileWatchlistResponse,
  PublicProfile,
  UserReviewListResponse,
} from '@cinelog/contracts';
import { CurrentUser, Public } from '../common/decorators';
import { ProfilesService } from './profiles.service';
import {
  ProfileDiaryQueryDto,
  ProfileLikesQueryDto,
  ProfileWatchedQueryDto,
  UpdateFavoritesDto,
} from './profiles.dto';

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
    @Query() query: ProfileDiaryQueryDto,
  ): Promise<ProfileDiaryResponse> {
    return this.profiles.getDiary(username, viewerId, query);
  }

  @Public()
  @Get('users/:username/watchlist')
  getWatchlist(
    @Param('username') username: string,
    @CurrentUser('sub') viewerId: string | undefined,
  ): Promise<ProfileWatchlistResponse> {
    return this.profiles.getWatchlist(username, viewerId);
  }

  @Public()
  @Get('users/:username/reviews')
  getReviews(
    @Param('username') username: string,
    @CurrentUser('sub') viewerId: string | undefined,
    @Query('cursor') cursor?: string,
  ): Promise<UserReviewListResponse> {
    return this.profiles.getReviews(username, viewerId, cursor);
  }

  @Public()
  @Get('users/:username/watched')
  getWatched(
    @Param('username') username: string,
    @CurrentUser('sub') viewerId: string | undefined,
    @Query() query: ProfileWatchedQueryDto,
  ): Promise<ProfileWatchedResponse> {
    return this.profiles.getWatched(username, viewerId, query);
  }

  @Public()
  @Get('users/:username/likes')
  getLikes(
    @Param('username') username: string,
    @CurrentUser('sub') viewerId: string | undefined,
    @Query() query: ProfileLikesQueryDto,
  ): Promise<ProfileLikesResponse> {
    return this.profiles.getLikes(username, viewerId, query);
  }

  @ApiBearerAuth()
  @Patch('users/me/favorites')
  setFavorites(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateFavoritesDto,
  ): Promise<{ favoriteFilms: FavoriteSlot[]; favoriteShows: FavoriteSlot[] }> {
    return this.profiles.setFavorites(userId, dto);
  }
}
