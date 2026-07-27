import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FavoriteSlot, PublicProfile } from '@cinelog/contracts';
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

  @ApiBearerAuth()
  @Patch('users/me/favorites')
  setFavorites(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateFavoritesDto,
  ): Promise<FavoriteSlot[]> {
    return this.profiles.setFavorites(userId, dto);
  }
}
