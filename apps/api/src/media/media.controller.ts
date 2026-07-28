import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  FriendRatingsResponse,
  MediaDetail,
  PosterOptionsResponse,
  SearchResponse,
} from '@cinelog/contracts';
import { CurrentUser, Roles } from '../common/decorators';
import { MediaService } from './media.service';
import {
  AdminUpdateCastDto,
  MediaRefDto,
  RematchDto,
  SearchQueryDto,
  SetPosterDto,
} from './media.dto';

@ApiTags('media')
@ApiBearerAuth()
@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get('search')
  search(@Query() query: SearchQueryDto): Promise<SearchResponse> {
    return this.media.search(query.q, query.type);
  }

  /** Resolve a search result (provider + externalId) into a cached MediaItem and
   *  return its full detail. The web app calls this when opening an uncached hit. */
  @Post('media/resolve')
  async resolve(
    @CurrentUser('sub') userId: string,
    @Body() ref: MediaRefDto,
  ): Promise<MediaDetail> {
    const item = await this.media.resolveRef(ref);
    return this.media.getDetail(userId, item.id);
  }

  @Get('media/:id')
  detail(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<MediaDetail> {
    return this.media.getDetail(userId, id);
  }

  @Get('media/:id/similar')
  similar(@Param('id') id: string): Promise<SearchResponse> {
    return this.media.getSimilar(id);
  }

  @Get('media/:id/friend-ratings')
  friendRatings(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<FriendRatingsResponse> {
    return this.media.getFriendRatings(userId, id);
  }

  @Get('media/:id/poster')
  posterOptions(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PosterOptionsResponse> {
    return this.media.getPosterOptions(userId, id);
  }

  /** Sets (or clears) the caller's own poster override — only surfaces in
   *  library contexts (their own library, or anyone browsing their
   *  profile/library), never on the media page itself for anyone, including
   *  the caller. */
  @Put('media/:id/poster')
  @HttpCode(204)
  async setPoster(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: SetPosterDto,
  ): Promise<void> {
    await this.media.setPoster(userId, id, dto.sourceUrl);
  }

  /** Fix a mismatched title: re-point this cached entry at the correct
   *  provider match without losing anyone's tracking/ratings/history. */
  @Put('media/:id/rematch')
  rematch(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: RematchDto,
  ): Promise<MediaDetail> {
    return this.media.rematch(userId, id, dto.provider, dto.externalId, dto.type);
  }

  /** Admin-only: replace the cast shown to every user for this title. */
  @Put('media/:id/cast')
  @Roles('ADMIN')
  @HttpCode(204)
  async updateCast(@Param('id') id: string, @Body() dto: AdminUpdateCastDto): Promise<void> {
    await this.media.updateCast(id, dto.cast);
  }
}
