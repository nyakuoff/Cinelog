import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { existsSync } from 'node:fs';
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
    if (!existsSync(path)) throw new NotFoundException();
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(path);
  }
}
