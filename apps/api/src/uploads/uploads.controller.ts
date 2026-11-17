import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators';
import { UploadsService, type UploadKind } from './uploads.service';

const KIND_PATTERN = /^(avatars|banners)$/;
const FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.(jpg|png|webp|gif)$/;

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** Public so <img> tags load without auth headers, like the artwork proxy. */
  @Public()
  @Get(':kind/:filename')
  @ApiExcludeEndpoint()
  get(
    @Param('kind') kind: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): void {
    if (!KIND_PATTERN.test(kind) || !FILENAME_PATTERN.test(filename)) {
      throw new NotFoundException();
    }
    const path = this.uploads.resolvePath(kind as UploadKind, filename);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(path, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  }
}
