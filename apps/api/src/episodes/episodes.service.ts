import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Episode, MediaItem } from '@prisma/client';
import {
  ProviderId,
  type EpisodeItem,
  type EpisodeRatingResponse,
  type EpisodesResponse,
  type SeasonWithEpisodes,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderRegistry } from '../metadata/provider-registry.service';
import { ArtworkService } from '../artwork/artwork.service';
import { mapLimit } from '../common/map-limit';

/** Mean of a list of numbers, or null when empty. */
function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

@Injectable()
export class EpisodesService {
  private readonly logger = new Logger(EpisodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistry,
    private readonly artwork: ArtworkService,
  ) {}

  /** Seasons + episodes for a show, merged with the user's ratings + averages. */
  async getEpisodes(userId: string, mediaId: string): Promise<EpisodesResponse> {
    const media = await this.prisma.mediaItem.findUnique({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Media not found');

    await this.ensureCached(media);

    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId: mediaId },
      orderBy: { seasonNumber: 'asc' },
      include: { episodes: { orderBy: { episodeNumber: 'asc' } } },
    });

    // Relation filter, not `episodeId IN (...)`: long-running shows have thousands of episodes.
    const ratings = seasons.length
      ? await this.prisma.episodeRating.findMany({
          where: { userId, episode: { season: { mediaItemId: mediaId } } },
        })
      : [];
    const ratingByEpisode = new Map(ratings.map((r) => [r.episodeId, r.value]));

    const seasonAverages: number[] = [];
    let totalRated = 0;

    const mapped: SeasonWithEpisodes[] = seasons.map((season) => {
      const episodes: EpisodeItem[] = season.episodes.map((e) => ({
        id: e.id,
        episodeNumber: e.episodeNumber,
        name: e.name,
        overview: e.overview,
        airDate: e.airDate,
        stillUrl: this.artwork.toProxyUrl(e.stillPath),
        runtime: e.runtime,
        rating: ratingByEpisode.get(e.id) ?? null,
      }));
      const seasonRatings = episodes
        .map((e) => e.rating)
        .filter((v): v is number => v !== null);
      const avg = mean(seasonRatings);
      if (avg !== null) seasonAverages.push(avg);
      totalRated += seasonRatings.length;

      return {
        seasonNumber: season.seasonNumber,
        name: season.name,
        posterUrl: this.artwork.toProxyUrl(season.posterPath),
        airDate: season.airDate,
        episodeCount: season.episodes.length,
        averageRating: avg,
        ratedCount: seasonRatings.length,
        episodes,
      };
    });

    return {
      mediaId,
      seasons: mapped,
      showAverage: mean(seasonAverages),
      totalRated,
    };
  }

  /** Set (or clear) the user's rating for one episode; return recomputed averages. */
  async rateEpisode(
    userId: string,
    episodeId: string,
    value: number | null,
  ): Promise<EpisodeRatingResponse> {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: { season: true },
    });
    if (!episode) throw new NotFoundException('Episode not found');

    if (value === null) {
      await this.prisma.episodeRating.deleteMany({ where: { userId, episodeId } });
    } else {
      await this.prisma.episodeRating.upsert({
        where: { userId_episodeId: { userId, episodeId } },
        create: { userId, episodeId, value },
        update: { value },
      });
    }

    const { seasonAverage, showAverage } = await this.averages(
      userId,
      episode.season.mediaItemId,
      episode.seasonId,
    );

    return {
      episodeId,
      seasonNumber: episode.season.seasonNumber,
      value,
      seasonAverage,
      showAverage,
    };
  }

  /** Clear all of the user's episode ratings within one season. */
  async clearSeason(userId: string, mediaId: string, seasonNumber: number): Promise<void> {
    const season = await this.prisma.season.findUnique({
      where: { mediaItemId_seasonNumber: { mediaItemId: mediaId, seasonNumber } },
      include: { episodes: { select: { id: true } } },
    });
    if (!season) throw new NotFoundException('Season not found');
    await this.prisma.episodeRating.deleteMany({
      where: { userId, episodeId: { in: season.episodes.map((e) => e.id) } },
    });
  }

  /** Guarantee a show's seasons/episodes are cached — used by backup restore
   *  before re-attaching per-episode ratings. No-op for non-episodic media. */
  async ensureEpisodesCached(mediaId: string): Promise<void> {
    const media = await this.prisma.mediaItem.findUnique({ where: { id: mediaId } });
    if (media) await this.ensureCached(media);
  }

  /** Re-sync seasons/episodes from the provider now (after a rematch). */
  async resync(mediaId: string): Promise<void> {
    const media = await this.prisma.mediaItem.findUnique({ where: { id: mediaId } });
    if (media) await this.sync(media);
  }

  // -- helpers ---------------------------------------------------------------

  /** One query for the show's ratings, grouped in JS: the season's mean, and
   *  the show's mean of per-season means (unrated seasons skipped). */
  private async averages(
    userId: string,
    mediaItemId: string,
    seasonId: string,
  ): Promise<{ seasonAverage: number | null; showAverage: number | null }> {
    const rows = await this.prisma.episodeRating.findMany({
      where: { userId, episode: { season: { mediaItemId } } },
      select: { value: true, episode: { select: { seasonId: true } } },
    });
    const bySeason = new Map<string, number[]>();
    for (const r of rows) {
      const list = bySeason.get(r.episode.seasonId) ?? [];
      list.push(r.value);
      bySeason.set(r.episode.seasonId, list);
    }
    return {
      seasonAverage: mean(bySeason.get(seasonId) ?? []),
      showAverage: mean([...bySeason.values()].map((v) => mean(v) as number)),
    };
  }

  /** In-flight provider syncs keyed by media id, so concurrent first-opens of a
   *  show share one fetch instead of racing each other into the unique
   *  (mediaItemId, seasonNumber) constraint.
   *  ponytail: per-process only; fine for the single-container deployment. */
  private readonly syncing = new Map<string, Promise<void>>();

  /** Populate seasons + episodes from the provider on first access, and
   *  refresh them in the background once stale — weekly while a show is
   *  still airing (new episodes, metadata fixes), quarterly once its latest
   *  season is over a year old (a proxy for "ended"; the provider layer
   *  doesn't expose show status). A stale cache is served as-is while the
   *  refresh runs, and a failed refresh keeps the old data — an offline
   *  instance must still show what it has. */
  private async ensureCached(media: MediaItem): Promise<void> {
    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId: media.id },
      select: { cachedAt: true, airDate: true },
    });
    if (seasons.length === 0) return this.sync(media);

    const oldest = Math.min(...seasons.map((s) => s.cachedAt.getTime()));
    const lastAired = Math.max(0, ...seasons.map((s) => (s.airDate ? Date.parse(s.airDate) || 0 : 0)));
    const ttl = lastAired && Date.now() - lastAired > YEAR_MS ? 90 * DAY_MS : 7 * DAY_MS;
    if (Date.now() - oldest > ttl) {
      this.sync(media).catch((err: unknown) =>
        this.logger.warn(`Season refresh failed for ${media.id}: ${String(err)}`),
      );
    }
  }

  private sync(media: MediaItem): Promise<void> {
    let running = this.syncing.get(media.id);
    if (!running) {
      running = this.syncFromProvider(media).finally(() => this.syncing.delete(media.id));
      this.syncing.set(media.id, running);
    }
    return running;
  }

  /** Upsert seasons/episodes by number, so existing Episode rows (and every
   *  member's EpisodeRating hanging off them) survive a refresh or a rematch.
   *  Rows the provider no longer lists are pruned only when nobody has rated
   *  them — a rating is user data and is never discarded by a metadata sync. */
  private async syncFromProvider(media: MediaItem): Promise<void> {
    const provider = this.registry.getById(ProviderId.catch('tmdb').parse(media.provider));
    if (!provider.getSeasons || !provider.getEpisodes) return;
    const getEpisodes = provider.getEpisodes.bind(provider);

    const seasons = await provider.getSeasons(media.externalId);
    const withEpisodes = await mapLimit(seasons, 4, async (season) => ({
      season,
      episodes: await getEpisodes(media.externalId, season.seasonNumber),
    }));

    const cachedAt = new Date();
    for (const { season, episodes } of withEpisodes) {
      const seasonData = {
        name: season.name,
        overview: season.overview,
        posterPath: season.posterUrl,
        airDate: season.airDate,
        episodeCount: season.episodeCount,
        cachedAt,
      };
      const row = await this.prisma.season.upsert({
        where: {
          mediaItemId_seasonNumber: { mediaItemId: media.id, seasonNumber: season.seasonNumber },
        },
        create: { mediaItemId: media.id, seasonNumber: season.seasonNumber, ...seasonData },
        update: seasonData,
      });
      await this.prisma.$transaction([
        ...episodes.map((e) => {
          const data = {
            name: e.name,
            overview: e.overview,
            stillPath: e.stillUrl,
            airDate: e.airDate,
            runtime: e.runtime,
          };
          return this.prisma.episode.upsert({
            where: { seasonId_episodeNumber: { seasonId: row.id, episodeNumber: e.episodeNumber } },
            create: { seasonId: row.id, episodeNumber: e.episodeNumber, ...data },
            update: data,
          });
        }),
        this.prisma.episode.deleteMany({
          where: {
            seasonId: row.id,
            episodeNumber: { notIn: episodes.map((e) => e.episodeNumber) },
            ratings: { none: {} },
          },
        }),
      ]);
    }

    // Seasons the provider no longer lists: drop their unrated episodes, then
    // the season itself if nothing rated remains in it.
    const goneSeasons = { mediaItemId: media.id, seasonNumber: { notIn: seasons.map((s) => s.seasonNumber) } };
    await this.prisma.episode.deleteMany({ where: { season: goneSeasons, ratings: { none: {} } } });
    await this.prisma.season.deleteMany({ where: { ...goneSeasons, episodes: { none: {} } } });
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

// Episode type re-exported for controllers/tests if needed.
export type { Episode };
