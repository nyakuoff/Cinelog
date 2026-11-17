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
import { access, mkdir, writeFile } from 'node:fs/promises';
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

const exists = (p: string): Promise<boolean> => access(p).then(() => true, () => false);

@Injectable()
export class ArtworkService implements OnModuleInit {
  private readonly logger = new Logger(ArtworkService.name);
  private artworkDir!: string;
  // Hot path: sourceUrl -> file, so a proxied image costs no DB lookup.
  private readonly known = new Map<string, { path: string; contentType: string }>();
  private readonly inflight = new Map<string, Promise<{ path: string; contentType: string }>>();

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

  /** Inverse of toProxyUrl: recovers the original remote URL from a
   *  Cinelog-proxied one. Values that aren't proxied URLs pass through
   *  unchanged, so this is safe to apply defensively to any client-supplied
   *  URL before it's persisted (a client may echo back an already-proxied
   *  URL it got from a GET response, which would otherwise get proxied
   *  twice on the next read). */
  fromProxyUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const prefix = '/api/artwork?src=';
    if (!url.startsWith(prefix)) return url;
    try {
      return decodeURIComponent(url.slice(prefix.length));
    } catch {
      return null;
    }
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

    const hot = this.known.get(sourceUrl);
    if (hot) return hot;
    const pending = this.inflight.get(sourceUrl);
    if (pending) return pending;

    const p = this.lookupOrFetch(sourceUrl).finally(() => this.inflight.delete(sourceUrl));
    this.inflight.set(sourceUrl, p);
    return p;
  }

  /** Called by the controller when a remembered file turned out to be gone. */
  forget(sourceUrl: string): void {
    this.known.delete(sourceUrl);
  }

  private async lookupOrFetch(sourceUrl: string): Promise<{ path: string; contentType: string }> {
    const cached = await this.prisma.artworkCache.findUnique({ where: { sourceUrl } });
    if (cached && (await exists(cached.localPath))) {
      const hit = { path: cached.localPath, contentType: cached.contentType ?? 'image/jpeg' };
      this.known.set(sourceUrl, hit);
      return hit;
    }
    const stored = await this.fetchAndStore(sourceUrl);
    this.known.set(sourceUrl, stored);
    return stored;
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

    if (!(await exists(localPath))) await writeFile(localPath, buffer);

    await this.prisma.artworkCache.upsert({
      where: { sourceUrl },
      create: { sourceUrl, localPath, hash, bytes: buffer.length, contentType },
      update: { localPath, hash, bytes: buffer.length, contentType },
    });

    return { path: localPath, contentType };
  }
}
