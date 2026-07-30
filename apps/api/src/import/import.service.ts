import { Injectable, Logger } from '@nestjs/common';
import type {
  ImportMode,
  ImportSummary,
  LetterboxdImportRequest,
  LetterboxdItem,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderRegistry } from '../metadata/provider-registry.service';
import { MediaService } from '../media/media.service';
import { ActivityService } from '../social/activity.service';

/** Run an async mapper over items with a bounded concurrency. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/** What one title's import actually wrote, so the summary can be trusted. */
interface Wrote {
  ok: boolean;
  name: string;
  rating?: boolean;
  diary?: boolean;
  like?: boolean;
  review?: boolean;
  watchlist?: boolean;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistry,
    private readonly media: MediaService,
    private readonly activity: ActivityService,
  ) {}

  /**
   * Import a batch of titles from a Letterboxd export. The web app unzips the
   * archive, merges the per-file rows into one record per title, and sends
   * them in batches — each title costs a provider lookup, so one giant request
   * would outlive any sensible timeout and could report no progress.
   *
   * TMDB matching is the fuzzy part; unmatched titles are reported rather than
   * silently dropped.
   */
  async importLetterboxd(userId: string, req: LetterboxdImportRequest): Promise<ImportSummary> {
    const results = await mapLimit<LetterboxdItem, Wrote>(req.items, 5, (item) =>
      this.importOne(userId, item, req.mode).catch((err): Wrote => {
        this.logger.warn(`Import failed for "${item.name}": ${String(err)}`);
        return { ok: false, name: item.name };
      }),
    );

    const all = results;
    const failures = all.filter((r) => !r.ok).map((r) => r.name);
    return {
      total: all.length,
      imported: all.length - failures.length,
      failed: failures.length,
      failures,
      ratingsImported: all.filter((r) => r.rating).length,
      diaryEntriesImported: all.filter((r) => r.diary).length,
      likesImported: all.filter((r) => r.like).length,
      reviewsImported: all.filter((r) => r.review).length,
      watchlistImported: all.filter((r) => r.watchlist).length,
    };
  }

  private async importOne(
    userId: string,
    item: LetterboxdItem,
    mode: ImportMode,
  ): Promise<Wrote> {
    const results = (await this.registry.search(item.name, 'MOVIE')).filter(
      (r) => r.type === 'MOVIE',
    );
    if (results.length === 0) return { ok: false, name: item.name };

    const year = item.year;
    let pick = results[0]!;
    if (year != null) {
      pick =
        results.find((r) => r.year === year) ??
        results.find((r) => r.year != null && Math.abs(r.year - year) <= 1) ??
        pick;
    }

    const media = await this.media.getOrFetch(pick.provider, pick.externalId, 'MOVIE');
    const mediaItemId = media.id;
    const wrote: Wrote = { ok: true, name: item.name };

    if (mode === 'watchlist') {
      await this.prisma.userMediaStatus.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId } },
        create: { userId, mediaItemId, isWatchlisted: true },
        update: { isWatchlisted: true },
      });
      wrote.watchlist = true;
      return wrote;
    }

    const watchedAt = this.parseDate(item.watchedDate);
    const completedAt = watchedAt ?? new Date();

    await this.prisma.userMediaStatus.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId } },
      create: { userId, mediaItemId, status: 'COMPLETED', completedAt },
      update: { status: 'COMPLETED', completedAt },
    });

    if (item.rating != null) {
      const value = (item.rating / 5) * 100; // 0.5–5 stars → normalized 0..100
      await this.prisma.rating.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId } },
        create: { userId, mediaItemId, value },
        update: { value },
      });
      wrote.rating = true;
    }

    // A diary row is what makes the title show up in Diary and count toward
    // the "watched by" tally; without it an imported history stayed invisible.
    const existingHistory = await this.prisma.watchHistory.findFirst({
      where: { userId, mediaItemId, ...(watchedAt ? { watchedAt } : {}) },
      select: { id: true },
    });
    if (!existingHistory) {
      await this.prisma.watchHistory.create({
        data: {
          userId,
          mediaItemId,
          watchedAt: completedAt,
          isRewatch: item.isRewatch ?? false,
        },
      });
      wrote.diary = true;
    }

    if (item.liked) {
      await this.prisma.userMediaStatus.update({
        where: { userId_mediaItemId: { userId, mediaItemId } },
        data: { isFavorite: true },
      });
      wrote.like = true;
    }

    if (item.review && item.review.trim()) {
      await this.prisma.review.upsert({
        where: {
          userId_mediaItemId_targetType: { userId, mediaItemId, targetType: 'MEDIA' },
        },
        create: {
          userId,
          mediaItemId,
          targetType: 'MEDIA',
          body: item.review.trim(),
          ratingValue: item.rating != null ? (item.rating / 5) * 100 : null,
          watchedDate: watchedAt,
          isSpoiler: item.isSpoiler ?? false,
        },
        update: { body: item.review.trim(), isSpoiler: item.isSpoiler ?? false },
      });
      wrote.review = true;
    }

    // Imports bypass the normal write paths, so without this an imported
    // library produces no feed activity at all. Events carry the real watched
    // date where the export has one, so a back catalogue slots into history
    // rather than flooding the top of everyone's feed.
    await this.activity.recordReplacing({
      actorId: userId,
      type: 'WATCHED',
      mediaItemId,
      createdAt: watchedAt,
    });
    if (wrote.rating) {
      await this.activity.recordReplacing({
        actorId: userId,
        type: 'RATED',
        mediaItemId,
        createdAt: watchedAt,
      });
    }
    if (wrote.like) {
      await this.activity.recordReplacing({
        actorId: userId,
        type: 'FAVORITED',
        mediaItemId,
        createdAt: watchedAt,
      });
    }
    if (wrote.review) {
      await this.activity.recordReplacing({
        actorId: userId,
        type: 'REVIEWED',
        mediaItemId,
        createdAt: watchedAt,
      });
    }

    return wrote;
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
}
