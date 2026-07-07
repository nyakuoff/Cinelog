import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators';
import { ArtworkService } from './artwork.service';

@Controller('artwork')
export class ArtworkController {
  constructor(private readonly artwork: ArtworkService) {}

  /** Public so <img> tags load without auth headers. `src` is the provider URL. */
  @Public()
  @Get()
  @ApiExcludeEndpoint()
  async get(@Query('src') src: string | undefined, @Res() res: Response): Promise<void> {
    if (!src) throw new BadRequestException('Missing src parameter');
    const { path, contentType } = await this.artwork.getLocalFile(src);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.sendFile(path);
  }
}
