import { Controller, Get, Header, Param, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators';
import { OgService } from './og.service';

/** Crawler-facing Open Graph pages. Public (scrapers are unauthenticated) and
 *  hidden from Swagger — these serve HTML, not JSON. */
@ApiExcludeController()
@Controller('og')
export class OgController {
  constructor(private readonly og: OgService) {}

  @Public()
  @Get('media/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=600')
  mediaEmbed(@Param('id') id: string, @Req() req: Request): Promise<string> {
    return this.og.mediaHtml(id, baseUrl(req));
  }

  @Public()
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  siteEmbed(@Req() req: Request): string {
    return this.og.siteHtml(baseUrl(req));
  }
}

/** Reconstruct the public origin from proxy headers (nginx sets these). */
function baseUrl(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol;
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost';
  return `${proto}://${host}`;
}
