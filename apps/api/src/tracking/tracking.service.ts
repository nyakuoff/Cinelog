import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  MediaType,
  TrackingStatus,
  type LibraryResponse,
  type MarkWatchedRequest,
  type MediaRef,
  type TrackingResponse,
  type UpdateWatchEntryRequest,
  type UserMediaState,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { mediaSummarySelect } from '../common/media-select';
import { MediaService } from '../media/media.service';
import { ArtworkService } from '../artwork/artwork.service';
import { ActivityService } from '../social/activity.service';
import { parseWatchDate } from '../common/dates';

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly artwork: ArtworkService,
    private readonly activity: ActivityService,
  ) {}

  async setStatus(
    userId: string,
    ref: MediaRef,
    status: TrackingStatus | null,
  ): Promise<TrackingResponse> {
    const mediaItemId = (await this.media.resolveRef(ref)).id;

    // Auto-stamp lifecycle dates the first time a status implies them.
    const dates: { startedAt?: Date; completedAt?: Date } = {};
    if (status === 'WATCHING' || status === 'REWATCHING') dates.startedAt = new Date();
    if (status === 'COMPLETED') dates.completedAt = new Date();

    await this.prisma.userMediaStatus.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId } },
      create: { userId, mediaItemId, status, ...dates },
      update: { status, ...dates },
    });
    return { mediaId: mediaItemId, userState: await this.getUserState(userId, mediaItemId) };
  }

  async setFavorite(userId: string, ref: MediaRef, value: boolean): Promise<TrackingResponse> {
    const result = await this.setFlag(userId, ref, { isFavorite: value });
    if (value) {
      await this.activity.recordReplacing({
        actorId: userId,
        type: 'FAVORITED',
        mediaItemId: result.mediaId,
      });
    } else {
      // Un-liking retracts the event rather than leaving a stale claim in feeds.
      await this.prisma.activityEvent.deleteMany({
        where: { actorId: userId, type: 'FAVORITED', mediaItemId: result.mediaId },
      });
    }
    return result;
  }

  /**
   * The inverse of markWatched, for toggling the Watched control back off.
   * Clears every diary entry for the title, resets a COMPLETED status and its
   * rewatch tally, and retracts the feed event — otherwise the control could
   * only ever be switched on, and the claim would outlive the data.
   *
   * A rating implies watched, so it goes too (Letterboxd does the same):
   * otherwise the title would stay in the Watched tab and stats. The review,
   * if any, is kept — it's the member's writing, not a watched claim.
   *
   * A non-COMPLETED status (WATCHING, ON_HOLD, DROPPED) is preserved: the user
   * asked to undo "watched", not to stop tracking the title altogether.
   */
  async unmarkWatched(userId: string, ref: MediaRef): Promise<TrackingResponse> {
    const mediaItemId = (await this.media.resolveRef(ref)).id;
    const existing = await this.prisma.userMediaStatus.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId } },
    });

    await this.prisma.$transaction([
      this.prisma.watchHistory.deleteMany({ where: { userId, mediaItemId } }),
      this.prisma.userMediaStatus.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId } },
        create: { userId, mediaItemId },
        update: {
          ...(existing?.status === 'COMPLETED' ? { status: null, completedAt: null } : {}),
          rewatchCount: 0,
        },
      }),
      this.prisma.rating.deleteMany({ where: { userId, mediaItemId } }),
      this.prisma.activityEvent.deleteMany({
        where: { actorId: userId, type: { in: ['WATCHED', 'RATED'] }, mediaItemId },
      }),
    ]);

    return { mediaId: mediaItemId, userState: await this.getUserState(userId, mediaItemId) };
  }

  async setWatchlist(userId: string, ref: MediaRef, value: boolean): Promise<TrackingResponse> {
    return this.setFlag(userId, ref, { isWatchlisted: value });
  }

  async markWatched(userId: string, req: MarkWatchedRequest): Promise<TrackingResponse> {
    const mediaItemId = (await this.media.resolveRef(req)).id;
    const watchedAt = parseWatchDate(req.watchedAt) ?? new Date();
    const isRewatch = req.isRewatch ?? false;

    await this.prisma.$transaction([
      this.prisma.watchHistory.create({
        data: { userId, mediaItemId, watchedAt, isRewatch },
      }),
      this.prisma.userMediaStatus.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId } },
        create: {
          userId,
          mediaItemId,
          status: 'COMPLETED',
          completedAt: watchedAt,
          rewatchCount: isRewatch ? 1 : 0,
        },
        update: isRewatch
          ? { rewatchCount: { increment: 1 } }
          : { status: 'COMPLETED', completedAt: watchedAt },
      }),
    ]);
    await this.activity.recordReplacing({
      actorId: userId,
      type: 'WATCHED',
      mediaItemId,
    });
    return { mediaId: mediaItemId, userState: await this.getUserState(userId, mediaItemId) };
  }

  /** Correct a diary entry's date or rewatch flag. Owner-only; a mismatched
   *  owner is reported as 404 (not 403) to avoid confirming the entry exists. */
  async updateWatchEntry(
    userId: string,
    entryId: string,
    dto: UpdateWatchEntryRequest,
  ): Promise<void> {
    const entry = await this.requireOwnEntry(userId, entryId);
    await this.prisma.$transaction(async (tx) => {
      await tx.watchHistory.update({
        where: { id: entryId },
        data: {
          ...(dto.watchedAt !== undefined ? { watchedAt: parseWatchDate(dto.watchedAt) ?? entry.watchedAt } : {}),
          ...(dto.isRewatch !== undefined ? { isRewatch: dto.isRewatch } : {}),
        },
      });
      await this.syncAfterHistoryChange(tx, userId, entry.mediaItemId);
    });
  }

  async deleteWatchEntry(userId: string, entryId: string): Promise<void> {
    const entry = await this.requireOwnEntry(userId, entryId);
    await this.prisma.$transaction(async (tx) => {
      await tx.watchHistory.delete({ where: { id: entryId } });
      await this.syncAfterHistoryChange(tx, userId, entry.mediaItemId);
    });
  }

  private async requireOwnEntry(userId: string, entryId: string) {
    const entry = await this.prisma.watchHistory.findUnique({ where: { id: entryId } });
    if (!entry || entry.userId !== userId) throw new NotFoundException('Diary entry not found');
    return entry;
  }

  /**
   * Re-derive what depends on a title's diary after one entry changed: the
   * rewatch tally is the number of entries flagged as rewatches, and once the
   * last entry is gone the WATCHED feed event is retracted. A COMPLETED status
   * is reset then too — unless the title is rated, since a rating on its own
   * still means "watched".
   */
  private async syncAfterHistoryChange(
    tx: Prisma.TransactionClient,
    userId: string,
    mediaItemId: string,
  ): Promise<void> {
    const [remaining, rewatches, rating] = await Promise.all([
      tx.watchHistory.count({ where: { userId, mediaItemId } }),
      tx.watchHistory.count({ where: { userId, mediaItemId, isRewatch: true } }),
      tx.rating.findUnique({ where: { userId_mediaItemId: { userId, mediaItemId } }, select: { id: true } }),
    ]);
    const lastGone = remaining === 0;
    await tx.userMediaStatus.updateMany({
      where: { userId, mediaItemId },
      data: { rewatchCount: rewatches },
    });
    if (lastGone) {
      await tx.activityEvent.deleteMany({ where: { actorId: userId, type: 'WATCHED', mediaItemId } });
      if (!rating) {
        await tx.userMediaStatus.updateMany({
          where: { userId, mediaItemId, status: 'COMPLETED' },
          data: { status: null, completedAt: null },
        });
      }
    }
  }

  async getLibrary(userId: string): Promise<LibraryResponse> {
    const statuses = await this.prisma.userMediaStatus.findMany({
      where: {
        userId,
        OR: [{ status: { not: null } }, { isFavorite: true }, { isWatchlisted: true }],
      },
      include: { media: { select: mediaSummarySelect } },
      orderBy: { updatedAt: 'desc' },
    });

    const [ratings, posterOverrides] = await Promise.all([
      // By user, not `id IN (...)`: libraries can be thousands of titles.
      this.prisma.rating.findMany({ where: { userId }, select: { mediaItemId: true, value: true } }),
      // The member's own poster picks must show here too, not just on the detail page.
      this.prisma.userPosterOverride.findMany({ where: { userId }, select: { mediaItemId: true, url: true } }),
    ]);
    const ratingByMedia = new Map(ratings.map((r) => [r.mediaItemId, r.value]));
    const posterByMedia = new Map(posterOverrides.map((a) => [a.mediaItemId, a.url]));

    return {
      items: statuses.map((s) => ({
        id: s.media.id,
        type: MediaType.safeParse(s.media.type).data ?? 'MOVIE',
        title: s.media.title,
        year: yearOf(s.media.releaseDate),
        posterUrl: this.artwork.toProxyUrl(posterByMedia.get(s.mediaItemId) ?? s.media.posterPath),
        status: s.status ? (TrackingStatus.safeParse(s.status).data ?? null) : null,
        isFavorite: s.isFavorite,
        isWatchlisted: s.isWatchlisted,
        rating: ratingByMedia.get(s.mediaItemId) ?? null,
      })),
    };
  }

  // -- helpers ---------------------------------------------------------------

  private async setFlag(
    userId: string,
    ref: MediaRef,
    data: { isFavorite?: boolean; isWatchlisted?: boolean },
  ): Promise<TrackingResponse> {
    const mediaItemId = (await this.media.resolveRef(ref)).id;
    await this.prisma.userMediaStatus.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId } },
      create: { userId, mediaItemId, ...data },
      update: data,
    });
    return { mediaId: mediaItemId, userState: await this.getUserState(userId, mediaItemId) };
  }

  private async getUserState(userId: string, mediaItemId: string): Promise<UserMediaState> {
    const [status, rating, diary] = await Promise.all([
      this.prisma.userMediaStatus.findUnique({
        where: { userId_mediaItemId: { userId, mediaItemId } },
      }),
      this.prisma.rating.findUnique({
        where: { userId_mediaItemId: { userId, mediaItemId } },
      }),
      this.prisma.watchHistory.aggregate({
        where: { userId, mediaItemId },
        _count: { _all: true },
        _max: { watchedAt: true },
      }),
    ]);
    return {
      status: status?.status ? (TrackingStatus.safeParse(status.status).data ?? null) : null,
      isFavorite: status?.isFavorite ?? false,
      isWatchlisted: status?.isWatchlisted ?? false,
      rewatchCount: status?.rewatchCount ?? 0,
      rating: rating?.value ?? null,
      startedAt: status?.startedAt?.toISOString() ?? null,
      completedAt: status?.completedAt?.toISOString() ?? null,
      watchCount: diary._count._all,
      lastWatchedAt: diary._max.watchedAt?.toISOString() ?? null,
    };
  }
}

function yearOf(releaseDate: string | null): number | null {
  if (!releaseDate) return null;
  const y = Number(releaseDate.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}
