import { Injectable, NotFoundException } from '@nestjs/common';
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

/** Mean of a list of numbers, or null when empty. */
function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

@Injectable()
export class EpisodesService {
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

    const episodeIds = seasons.flatMap((s) => s.episodes.map((e) => e.id));
    const ratings = episodeIds.length
      ? await this.prisma.episodeRating.findMany({
          where: { userId, episodeId: { in: episodeIds } },
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

    const seasonAverage = await this.seasonAverage(userId, episode.seasonId);
    const showAverage = await this.showAverage(userId, episode.season.mediaItemId);

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

  // -- helpers ---------------------------------------------------------------

  private async seasonAverage(userId: string, seasonId: string): Promise<number | null> {
    const episodes = await this.prisma.episode.findMany({
      where: { seasonId },
      select: { id: true },
    });
    const ratings = await this.prisma.episodeRating.findMany({
      where: { userId, episodeId: { in: episodes.map((e) => e.id) } },
      select: { value: true },
    });
    return mean(ratings.map((r) => r.value));
  }

  private async showAverage(userId: string, mediaItemId: string): Promise<number | null> {
    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId },
      select: { id: true },
    });
    const perSeason = await Promise.all(seasons.map((s) => this.seasonAverage(userId, s.id)));
    return mean(perSeason.filter((v): v is number => v !== null));
  }

  /** Populate seasons + episodes from the provider on first access. */
  private async ensureCached(media: MediaItem): Promise<void> {
    const existing = await this.prisma.season.count({ where: { mediaItemId: media.id } });
    if (existing > 0) return;

    const provider = this.registry.getById(ProviderId.catch('tmdb').parse(media.provider));
    if (!provider.getSeasons || !provider.getEpisodes) return;

    const seasons = await provider.getSeasons(media.externalId);
    for (const season of seasons) {
      const episodes = await provider.getEpisodes(media.externalId, season.seasonNumber);
      await this.prisma.season.create({
        data: {
          mediaItemId: media.id,
          seasonNumber: season.seasonNumber,
          name: season.name,
          overview: season.overview,
          posterPath: season.posterUrl,
          airDate: season.airDate,
          episodeCount: season.episodeCount,
          episodes: {
            create: episodes.map((e) => ({
              episodeNumber: e.episodeNumber,
              name: e.name,
              overview: e.overview,
              stillPath: e.stillUrl,
              airDate: e.airDate,
              runtime: e.runtime,
            })),
          },
        },
      });
    }
  }
}

// Episode type re-exported for controllers/tests if needed.
export type { Episode };
