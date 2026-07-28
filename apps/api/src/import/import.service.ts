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
   * Import a Letterboxd export (films only). Each row is matched to a movie via
   * the provider layer, cached, then marked watched+rated or added to the
   * watchlist. TMDB matching is the fuzzy part; unmatched titles are reported.
   */
  async importLetterboxd(userId: string, req: LetterboxdImportRequest): Promise<ImportSummary> {
    const results = await mapLimit(req.items, 5, (item) =>
      this.importOne(userId, item, req.mode).catch((err) => {
        this.logger.warn(`Import failed for "${item.name}": ${String(err)}`);
        return { ok: false, name: item.name };
      }),
    );

    const failures = results.filter((r) => !r.ok).map((r) => r.name);
    return {
      total: req.items.length,
      imported: results.length - failures.length,
      failed: failures.length,
      failures,
    };
  }

  private async importOne(
    userId: string,
    item: LetterboxdItem,
    mode: ImportMode,
  ): Promise<{ ok: boolean; name: string }> {
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

    if (mode === 'watchlist') {
      await this.prisma.userMediaStatus.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId: media.id } },
        create: { userId, mediaItemId: media.id, status: 'PLAN_TO_WATCH' },
        update: { status: 'PLAN_TO_WATCH' },
      });
    } else {
      const now = new Date();
      await this.prisma.userMediaStatus.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId: media.id } },
        create: { userId, mediaItemId: media.id, status: 'COMPLETED', completedAt: now },
        update: { status: 'COMPLETED', completedAt: now },
      });
      if (item.rating != null) {
        const value = (item.rating / 5) * 100; // 0.5–5 stars → normalized 0..100
        await this.prisma.rating.upsert({
          where: { userId_mediaItemId: { userId, mediaItemId: media.id } },
          create: { userId, mediaItemId: media.id, value },
          update: { value },
        });
      }
      // Without this, "watched" only ever set status+rating — never a diary
      // row — so an imported Letterboxd history never showed up in Diary.
      let watchedAt: Date | null = null;
      if (item.watchedDate) {
        const parsed = new Date(item.watchedDate);
        if (!Number.isNaN(parsed.getTime())) {
          watchedAt = parsed;
          const exists = await this.prisma.watchHistory.findFirst({
            where: { userId, mediaItemId: media.id, watchedAt: parsed },
          });
          if (!exists) {
            await this.prisma.watchHistory.create({
              data: { userId, mediaItemId: media.id, watchedAt: parsed, isRewatch: false },
            });
          }
        }
      }

      // Imports bypass the normal write paths, so without this an imported
      // library produces no feed activity at all. Events are dated to the
      // real watch date where the CSV has one, so a back catalogue slots
      // into history rather than flooding the top of everyone's feed.
      await this.activity.recordReplacing({
        actorId: userId,
        type: 'WATCHED',
        mediaItemId: media.id,
        createdAt: watchedAt,
      });
      if (item.rating != null) {
        await this.activity.recordReplacing({
          actorId: userId,
          type: 'RATED',
          mediaItemId: media.id,
          createdAt: watchedAt,
        });
      }
    }
    return { ok: true, name: item.name };
  }
}
