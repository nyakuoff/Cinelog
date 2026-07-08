import { Injectable } from '@nestjs/common';
import {
  MediaType,
  ProviderId,
  RatingScale,
  TrackingStatus,
  type BackupData,
  type BackupImportResult,
  type BackupItem,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { EpisodesService } from '../episodes/episodes.service';

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function yearOf(releaseDate: string | null): number | null {
  if (!releaseDate) return null;
  const y = Number(releaseDate.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

@Injectable()
export class BackupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly episodes: EpisodesService,
  ) {}

  /** Serialize everything a user has tracked into a portable JSON document.
   *  Media is keyed by provider coordinates so it re-resolves on any install. */
  async exportUserData(userId: string): Promise<BackupData> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const [statuses, ratings, history, artwork, episodeRatings] = await Promise.all([
      this.prisma.userMediaStatus.findMany({ where: { userId } }),
      this.prisma.rating.findMany({ where: { userId } }),
      this.prisma.watchHistory.findMany({ where: { userId } }),
      this.prisma.userArtwork.findMany({ where: { userId } }),
      this.prisma.episodeRating.findMany({
        where: { userId },
        include: { episode: { include: { season: true } } },
      }),
    ]);

    // Any media the user has *any* data for — not just an explicit status row.
    const ids = new Set<string>();
    statuses.forEach((s) => ids.add(s.mediaItemId));
    ratings.forEach((r) => ids.add(r.mediaItemId));
    history.forEach((h) => ids.add(h.mediaItemId));
    artwork.forEach((a) => ids.add(a.mediaItemId));
    episodeRatings.forEach((e) => ids.add(e.episode.season.mediaItemId));

    const media = await this.prisma.mediaItem.findMany({ where: { id: { in: [...ids] } } });
    const mediaById = new Map(media.map((m) => [m.id, m]));
    const statusByMedia = new Map(statuses.map((s) => [s.mediaItemId, s]));
    const ratingByMedia = new Map(ratings.map((r) => [r.mediaItemId, r.value]));
    const historyByMedia = groupBy(history, (h) => h.mediaItemId);
    const artworkByMedia = groupBy(artwork, (a) => a.mediaItemId);
    const epByMedia = groupBy(episodeRatings, (e) => e.episode.season.mediaItemId);

    const items: BackupItem[] = [];
    for (const id of ids) {
      const m = mediaById.get(id);
      if (!m) continue;
      const s = statusByMedia.get(id);
      items.push({
        provider: ProviderId.catch('tmdb').parse(m.provider),
        externalId: m.externalId,
        type: MediaType.catch('MOVIE').parse(m.type),
        title: m.title,
        year: yearOf(m.releaseDate),
        status: s?.status ? (TrackingStatus.safeParse(s.status).data ?? null) : null,
        isFavorite: s?.isFavorite ?? false,
        isWatchlisted: s?.isWatchlisted ?? false,
        rewatchCount: s?.rewatchCount ?? 0,
        startedAt: s?.startedAt?.toISOString() ?? null,
        completedAt: s?.completedAt?.toISOString() ?? null,
        rating: ratingByMedia.get(id) ?? null,
        watchHistory: (historyByMedia.get(id) ?? []).map((h) => ({
          watchedAt: h.watchedAt.toISOString(),
          isRewatch: h.isRewatch,
        })),
        artwork: (artworkByMedia.get(id) ?? []).map((a) => ({
          type: a.type === 'BACKDROP' ? 'BACKDROP' : 'POSTER',
          url: a.url,
        })),
        episodeRatings: (epByMedia.get(id) ?? []).map((e) => ({
          seasonNumber: e.episode.season.seasonNumber,
          episodeNumber: e.episode.episodeNumber,
          value: e.value,
        })),
      });
    }

    return {
      app: 'cinelog',
      version: 1,
      exportedAt: new Date().toISOString(),
      user: {
        username: user.username,
        bio: user.bio,
        ratingScale: RatingScale.catch('TEN').parse(user.ratingScale),
        letterboxdUsername: user.letterboxdUsername,
      },
      items,
    };
  }

  /** Restore a backup into the current account (merge; existing rows are
   *  updated in place, never wiped). Identity fields (username/email/password)
   *  are never touched. */
  async importUserData(userId: string, data: BackupData): Promise<BackupImportResult> {
    const result: BackupImportResult = {
      itemsProcessed: 0,
      itemsImported: 0,
      ratingsImported: 0,
      watchEventsImported: 0,
      episodeRatingsImported: 0,
      failed: 0,
      failures: [],
    };

    // Restore profile *settings* (not the account identity).
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        bio: data.user.bio,
        ratingScale: data.user.ratingScale,
        letterboxdUsername: data.user.letterboxdUsername,
      },
    });

    for (const item of data.items) {
      result.itemsProcessed++;
      try {
        const media = await this.media.getOrFetch(item.provider, item.externalId, item.type);
        const mediaItemId = media.id;

        const statusData = {
          status: item.status,
          isFavorite: item.isFavorite,
          isWatchlisted: item.isWatchlisted,
          rewatchCount: item.rewatchCount,
          startedAt: item.startedAt ? new Date(item.startedAt) : null,
          completedAt: item.completedAt ? new Date(item.completedAt) : null,
        };
        await this.prisma.userMediaStatus.upsert({
          where: { userId_mediaItemId: { userId, mediaItemId } },
          create: { userId, mediaItemId, ...statusData },
          update: statusData,
        });

        if (item.rating !== null) {
          await this.prisma.rating.upsert({
            where: { userId_mediaItemId: { userId, mediaItemId } },
            create: { userId, mediaItemId, value: item.rating },
            update: { value: item.rating },
          });
          result.ratingsImported++;
        }

        // Watch history: skip events already present (same timestamp + kind).
        if (item.watchHistory.length) {
          const existing = await this.prisma.watchHistory.findMany({
            where: { userId, mediaItemId },
            select: { watchedAt: true, isRewatch: true },
          });
          const seen = new Set(existing.map((e) => `${e.watchedAt.getTime()}:${e.isRewatch}`));
          for (const w of item.watchHistory) {
            const key = `${new Date(w.watchedAt).getTime()}:${w.isRewatch}`;
            if (seen.has(key)) continue;
            seen.add(key);
            await this.prisma.watchHistory.create({
              data: { userId, mediaItemId, watchedAt: new Date(w.watchedAt), isRewatch: w.isRewatch },
            });
            result.watchEventsImported++;
          }
        }

        for (const a of item.artwork) {
          await this.prisma.userArtwork.upsert({
            where: { userId_mediaItemId_type: { userId, mediaItemId, type: a.type } },
            create: { userId, mediaItemId, type: a.type, url: a.url },
            update: { url: a.url },
          });
        }

        if (item.episodeRatings.length) {
          await this.episodes.ensureEpisodesCached(mediaItemId);
          for (const er of item.episodeRatings) {
            const ep = await this.prisma.episode.findFirst({
              where: {
                episodeNumber: er.episodeNumber,
                season: { mediaItemId, seasonNumber: er.seasonNumber },
              },
              select: { id: true },
            });
            if (!ep) continue;
            await this.prisma.episodeRating.upsert({
              where: { userId_episodeId: { userId, episodeId: ep.id } },
              create: { userId, episodeId: ep.id, value: er.value },
              update: { value: er.value },
            });
            result.episodeRatingsImported++;
          }
        }

        result.itemsImported++;
      } catch {
        result.failed++;
        result.failures.push(item.title);
      }
    }

    return result;
  }
}
