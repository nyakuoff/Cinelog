import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { LibraryResponse, TrackingResponse } from '@cinelog/contracts';
import { CurrentUser } from '../common/decorators';
import { TrackingService } from './tracking.service';
import { MarkWatchedDto, SetFlagDto, SetStatusDto } from './tracking.dto';

@ApiTags('tracking')
@ApiBearerAuth()
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get('library')
  library(@CurrentUser('sub') userId: string): Promise<LibraryResponse> {
    return this.tracking.getLibrary(userId);
  }

  @Put('status')
  setStatus(
    @CurrentUser('sub') userId: string,
    @Body() dto: SetStatusDto,
  ): Promise<TrackingResponse> {
    return this.tracking.setStatus(userId, dto, dto.status);
  }

  @Put('favorite')
  setFavorite(
    @CurrentUser('sub') userId: string,
    @Body() dto: SetFlagDto,
  ): Promise<TrackingResponse> {
    return this.tracking.setFavorite(userId, dto, dto.value);
  }

  @Put('watchlist')
  setWatchlist(
    @CurrentUser('sub') userId: string,
    @Body() dto: SetFlagDto,
  ): Promise<TrackingResponse> {
    return this.tracking.setWatchlist(userId, dto, dto.value);
  }

  @Post('watch')
  markWatched(
    @CurrentUser('sub') userId: string,
    @Body() dto: MarkWatchedDto,
  ): Promise<TrackingResponse> {
    return this.tracking.markWatched(userId, dto);
  }
}
