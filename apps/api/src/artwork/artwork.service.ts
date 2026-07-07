import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';

/** Hosts we're willing to fetch remote artwork from (SSRF guard). */
const ALLOWED_HOSTS = new Set([
  'image.tmdb.org',
  'artworks.thetvdb.com',
  's4.anilist.co',
]);

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/gif': '.gif',
};

@Injectable()
export class ArtworkService implements OnModuleInit {
  private readonly logger = new Logger(ArtworkService.name);
  private artworkDir!: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const dataDir = this.config.getOrThrow<string>('dataDir');
    this.artworkDir = join(isAbsolute(dataDir) ? dataDir : resolve(dataDir), 'artwork');
    await mkdir(this.artworkDir, { recursive: true });
  }

  /** Turn a remote provider image URL into a Cinelog-proxied (cached) URL.
   *  Returns null for null input so callers can pass through optional images. */
  toProxyUrl(sourceUrl: string | null | undefined): string | null {
    if (!sourceUrl) return null;
    return `/api/artwork?src=${encodeURIComponent(sourceUrl)}`;
  }

  /** Resolve a proxied request to a local file path, fetching + caching on miss. */
  async getLocalFile(sourceUrl: string): Promise<{ path: string; contentType: string }> {
    let parsed: URL;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      throw new BadRequestException('Invalid artwork URL');
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      throw new BadRequestException('Artwork host is not allowed');
    }

    const cached = await this.prisma.artworkCache.findUnique({ where: { sourceUrl } });
    if (cached && existsSync(cached.localPath)) {
      return { path: cached.localPath, contentType: cached.contentType ?? 'image/jpeg' };
    }

    return this.fetchAndStore(sourceUrl);
  }

  private async fetchAndStore(
    sourceUrl: string,
  ): Promise<{ path: string; contentType: string }> {
    let res: Response;
    try {
      res = await fetch(sourceUrl);
    } catch (err) {
      this.logger.warn(`Artwork fetch failed for ${sourceUrl}: ${String(err)}`);
      throw new ServiceUnavailableException('Failed to fetch artwork');
    }
    if (!res.ok) throw new NotFoundException('Artwork not found at source');

    const contentType = res.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    const hash = createHash('sha256').update(buffer).digest('hex');
    const ext = EXT_BY_TYPE[contentType] ?? '.img';
    const localPath = join(this.artworkDir, `${hash}${ext}`);

    if (!existsSync(localPath)) await writeFile(localPath, buffer);

    await this.prisma.artworkCache.upsert({
      where: { sourceUrl },
      create: { sourceUrl, localPath, hash, bytes: buffer.length, contentType },
      update: { localPath, hash, bytes: buffer.length, contentType },
    });

    return { path: localPath, contentType };
  }
}
