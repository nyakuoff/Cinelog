import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { EpisodeRatingResponse, EpisodesResponse } from '@cinelog/contracts';
import { CurrentUser } from '../common/decorators';
import { EpisodesService } from './episodes.service';
import { SetEpisodeRatingDto } from './episodes.dto';

@ApiTags('episodes')
@ApiBearerAuth()
@Controller()
export class EpisodesController {
  constructor(private readonly episodes: EpisodesService) {}

  @Get('media/:id/episodes')
  list(
    @CurrentUser('sub') userId: string,
    @Param('id') mediaId: string,
  ): Promise<EpisodesResponse> {
    return this.episodes.getEpisodes(userId, mediaId);
  }

  @Put('episodes/:episodeId/rating')
  rate(
    @CurrentUser('sub') userId: string,
    @Param('episodeId') episodeId: string,
    @Body() dto: SetEpisodeRatingDto,
  ): Promise<EpisodeRatingResponse> {
    return this.episodes.rateEpisode(userId, episodeId, dto.value);
  }

  @Delete('media/:mediaId/seasons/:seasonNumber/ratings')
  @HttpCode(204)
  clearSeason(
    @CurrentUser('sub') userId: string,
    @Param('mediaId') mediaId: string,
    @Param('seasonNumber', ParseIntPipe) seasonNumber: number,
  ): Promise<void> {
    return this.episodes.clearSeason(userId, mediaId, seasonNumber);
  }
}
