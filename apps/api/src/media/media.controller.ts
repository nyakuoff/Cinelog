import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { MediaDetail, SearchResponse } from '@cinelog/contracts';
import { CurrentUser } from '../common/decorators';
import { MediaService } from './media.service';
import { MediaRefDto, SearchQueryDto } from './media.dto';

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
}
