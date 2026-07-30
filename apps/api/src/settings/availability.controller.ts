import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { MediaAvailability, RequestMediaResponse } from '@cinelog/contracts';
import { AvailabilityService } from './availability.service';

@ApiTags('media')
@ApiBearerAuth()
@Controller()
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  /** Where this title can be watched: the instance's Jellyfin, streaming
   *  services in the configured region, and its request status. */
  @Get('media/:id/availability')
  get(@Param('id') id: string): Promise<MediaAvailability> {
    return this.availability.getAvailability(id);
  }

  /** Ask the configured Jellyseerr to fetch a title that isn't in the library. */
  @Post('media/:id/request')
  request(@Param('id') id: string): Promise<RequestMediaResponse> {
    return this.availability.requestMedia(id);
  }
}
