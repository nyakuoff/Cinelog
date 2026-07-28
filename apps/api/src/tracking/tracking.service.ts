import { Injectable, NotFoundException } from '@nestjs/common';
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
import { MediaService } from '../media/media.service';
import { ArtworkService } from '../artwork/artwork.service';
import { ActivityService } from '../social/activity.service';

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

  async setWatchlist(userId: string, ref: MediaRef, value: boolean): Promise<TrackingResponse> {
    return this.setFlag(userId, ref, { isWatchlisted: value });
  }

  async markWatched(userId: string, req: MarkWatchedRequest): Promise<TrackingResponse> {
    const mediaItemId = (await this.media.resolveRef(req)).id;
    const watchedAt = req.watchedAt ? new Date(req.watchedAt) : new Date();
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
    const entry = await this.prisma.watchHistory.findUnique({ where: { id: entryId } });
    if (!entry || entry.userId !== userId) throw new NotFoundException('Diary entry not found');
    await this.prisma.watchHistory.update({
      where: { id: entryId },
      data: {
        ...(dto.watchedAt !== undefined ? { watchedAt: new Date(dto.watchedAt) } : {}),
        ...(dto.isRewatch !== undefined ? { isRewatch: dto.isRewatch } : {}),
      },
    });
  }

  async deleteWatchEntry(userId: string, entryId: string): Promise<void> {
    const entry = await this.prisma.watchHistory.findUnique({ where: { id: entryId } });
    if (!entry || entry.userId !== userId) throw new NotFoundException('Diary entry not found');
    await this.prisma.watchHistory.delete({ where: { id: entryId } });
  }

  async getLibrary(userId: string): Promise<LibraryResponse> {
    const statuses = await this.prisma.userMediaStatus.findMany({
      where: {
        userId,
        OR: [{ status: { not: null } }, { isFavorite: true }, { isWatchlisted: true }],
      },
      include: { media: true },
      orderBy: { updatedAt: 'desc' },
    });

    const mediaIds = statuses.map((s) => s.mediaItemId);
    const ratings = await this.prisma.rating.findMany({
      where: { userId, mediaItemId: { in: mediaIds } },
    });
    const ratingByMedia = new Map(ratings.map((r) => [r.mediaItemId, r.value]));

    return {
      items: statuses.map((s) => ({
        id: s.media.id,
        type: MediaType.safeParse(s.media.type).data ?? 'MOVIE',
        title: s.media.title,
        year: yearOf(s.media.releaseDate),
        posterUrl: this.artwork.toProxyUrl(s.media.posterPath),
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
    const [status, rating] = await Promise.all([
      this.prisma.userMediaStatus.findUnique({
        where: { userId_mediaItemId: { userId, mediaItemId } },
      }),
      this.prisma.rating.findUnique({
        where: { userId_mediaItemId: { userId, mediaItemId } },
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
    };
  }
}

function yearOf(releaseDate: string | null): number | null {
  if (!releaseDate) return null;
  const y = Number(releaseDate.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}
