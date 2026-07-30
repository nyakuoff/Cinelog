import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  MediaAvailability,
  RequestStatus,
  WatchProvider,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ArtworkService } from '../artwork/artwork.service';
import { ProviderRegistry } from '../metadata/provider-registry.service';
import { SettingsService, type IntegrationSecrets } from './settings.service';

/**
 * A homelab service can be slow, asleep, or gone. Every outbound call is bounded
 * so an unreachable Jellyfin can't hang a media page load.
 */
const TIMEOUT_MS = 4000;

/** Overseerr/Jellyseerr media status numbers, in their own vocabulary. */
const SEERR_STATUS: Record<number, RequestStatus> = {
  1: 'NONE', // "unknown" — nothing requested
  2: 'PENDING',
  3: 'PROCESSING',
  4: 'PARTIALLY_AVAILABLE',
  5: 'AVAILABLE',
};

/**
 * Assembles "where can I watch this" from three independent sources: the
 * instance's own Jellyfin server, TMDB's streaming availability (JustWatch
 * data), and a Jellyseerr instance for requesting what's missing.
 *
 * This lives server-side because two of the three need API keys the browser
 * must never hold. Each source is caught separately, so one failing degrades
 * that section to empty rather than failing the response.
 */
@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly artwork: ArtworkService,
    private readonly registry: ProviderRegistry,
  ) {}

  async getAvailability(mediaId: string): Promise<MediaAvailability> {
    const item = await this.prisma.mediaItem.findUnique({ where: { id: mediaId } });
    if (!item) throw new NotFoundException('Media not found');

    const cfg = await this.settings.getSecrets();
    const tmdbId = tmdbIdOf(item.provider, item.externalId);
    const isFilm = item.type === 'MOVIE' || item.type === 'SPECIAL';
    const region = cfg.watchRegion ?? 'US';

    const [jellyfinUrl, providers, requestStatus] = await Promise.all([
      this.findOnJellyfin(cfg, tmdbId, item.title).catch((err) => {
        this.logger.warn(`Jellyfin lookup failed: ${String(err)}`);
        return null;
      }),
      this.watchProviders(item.provider, item.externalId, region).catch((err) => {
        this.logger.warn(`Watch providers lookup failed: ${String(err)}`);
        return null;
      }),
      this.seerrStatus(cfg, tmdbId, isFilm).catch((err) => {
        this.logger.warn(`Jellyseerr status lookup failed: ${String(err)}`);
        return 'NONE' as RequestStatus;
      }),
    ]);

    return {
      jellyfinUrl,
      streaming: providers?.flatrate ?? [],
      rent: providers?.rent ?? [],
      buy: providers?.buy ?? [],
      providerLink: providers?.link ?? null,
      region: providers ? region : null,
      // Requesting needs both a URL and a key; without either there's nothing
      // to offer, so the button is never shown as a dead control.
      requestSupported: !!(cfg.seerrUrl && cfg.seerrApiKey && tmdbId),
      requestStatus,
    };
  }

  /** Submit a request to Jellyseerr for a title that isn't in the library. */
  async requestMedia(mediaId: string): Promise<{ requestStatus: RequestStatus }> {
    const item = await this.prisma.mediaItem.findUnique({ where: { id: mediaId } });
    if (!item) throw new NotFoundException('Media not found');

    const cfg = await this.settings.getSecrets();
    const tmdbId = tmdbIdOf(item.provider, item.externalId);
    if (!cfg.seerrUrl || !cfg.seerrApiKey) {
      throw new BadRequestException('No request service is configured on this instance');
    }
    if (!tmdbId) {
      throw new BadRequestException('This title has no TMDB id to request');
    }

    const isFilm = item.type === 'MOVIE' || item.type === 'SPECIAL';
    const res = await this.fetchJson<unknown>(
      `${cfg.seerrUrl}/api/v1/request`,
      { 'X-Api-Key': cfg.seerrApiKey, 'Content-Type': 'application/json' },
      {
        method: 'POST',
        body: JSON.stringify({
          mediaType: isFilm ? 'movie' : 'tv',
          mediaId: Number(tmdbId),
          // Jellyseerr requires an explicit season set for shows; "all" is the
          // sensible default when requesting from a title page.
          ...(isFilm ? {} : { seasons: 'all' }),
        }),
      },
    );
    if (res === null) {
      throw new BadRequestException('The request service rejected that request');
    }

    // Re-read rather than trusting the POST body, so the UI reflects whatever
    // the service actually recorded (it may auto-approve).
    const status = await this.seerrStatus(cfg, tmdbId, isFilm).catch(() => 'PENDING' as const);
    return { requestStatus: status === 'NONE' ? 'PENDING' : status };
  }

  // -- sources ---------------------------------------------------------------

  /**
   * Ask Jellyfin whether it holds this title, matching on the TMDB id it stores
   * alongside its own items. Falls back to a name search only when there's no
   * TMDB id to match on, since a name match across a large library is far more
   * likely to be wrong.
   */
  private async findOnJellyfin(
    cfg: IntegrationSecrets,
    tmdbId: string | null,
    title: string,
  ): Promise<string | null> {
    if (!cfg.jellyfinUrl) return null;
    // Without a key Jellyfin won't answer, so offer a search link instead of
    // silently pretending the title isn't there.
    if (!cfg.jellyfinApiKey) {
      return `${cfg.jellyfinUrl}/web/#/search.html?query=${encodeURIComponent(title)}`;
    }

    const params = new URLSearchParams({
      Recursive: 'true',
      IncludeItemTypes: 'Movie,Series',
      Limit: '1',
    });
    if (tmdbId) params.set('AnyProviderIdEquals', `tmdb.${tmdbId}`);
    else params.set('searchTerm', title);

    const body = await this.fetchJson<{ Items?: { Id?: string }[] }>(
      `${cfg.jellyfinUrl}/Items?${params.toString()}`,
      { 'X-Emby-Token': cfg.jellyfinApiKey },
    );
    const id = body?.Items?.[0]?.Id;
    return id ? `${cfg.jellyfinUrl}/web/#/details?id=${encodeURIComponent(id)}` : null;
  }

  /** Streaming availability for a region, with each service's own logo. */
  private async watchProviders(
    provider: string,
    externalId: string,
    region: string,
  ): Promise<{
    flatrate: WatchProvider[];
    rent: WatchProvider[];
    buy: WatchProvider[];
    link: string | null;
  } | null> {
    const raw = await this.registry.getWatchProviders(provider, externalId, region);
    if (!raw) return null;
    const map = (list: { name: string; logoUrl: string | null }[]): WatchProvider[] =>
      list.map((p) => ({ name: p.name, logoUrl: this.artwork.toProxyUrl(p.logoUrl) }));
    return {
      flatrate: map(raw.flatrate),
      rent: map(raw.rent),
      buy: map(raw.buy),
      link: raw.link,
    };
  }

  /** Whether Jellyseerr already knows about this title, and how far along it is. */
  private async seerrStatus(
    cfg: IntegrationSecrets,
    tmdbId: string | null,
    isFilm: boolean,
  ): Promise<RequestStatus> {
    if (!cfg.seerrUrl || !cfg.seerrApiKey || !tmdbId) return 'NONE';
    const kind = isFilm ? 'movie' : 'tv';
    const body = await this.fetchJson<{ mediaInfo?: { status?: number } | null }>(
      `${cfg.seerrUrl}/api/v1/${kind}/${tmdbId}`,
      { 'X-Api-Key': cfg.seerrApiKey },
    );
    const status = body?.mediaInfo?.status;
    return typeof status === 'number' ? (SEERR_STATUS[status] ?? 'NONE') : 'NONE';
  }

  // -- http ------------------------------------------------------------------

  /**
   * Bounded JSON fetch. Returns null on any failure — these are optional
   * enrichments, and a self-hosted service being down is an expected state, not
   * an error worth surfacing to the member.
   */
  private async fetchJson<T>(
    url: string,
    headers: Record<string, string>,
    init: RequestInit = {},
  ): Promise<T | null> {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`${init.method ?? 'GET'} ${redact(url)} -> ${res.status}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      this.logger.warn(`${init.method ?? 'GET'} ${redact(url)} failed: ${String(err)}`);
      return null;
    }
  }
}

/** TMDB external ids are stored as `movie:123` / `tv:456`. */
function tmdbIdOf(provider: string, externalId: string): string | null {
  if (provider !== 'tmdb') return null;
  const id = externalId.replace(/^(movie|tv):/, '');
  return /^\d+$/.test(id) ? id : null;
}

/** Keep any credential in a query string out of the logs. */
function redact(url: string): string {
  return url.replace(/([?&])(api_key|X-Emby-Token)=[^&]*/gi, '$1$2=***');
}
