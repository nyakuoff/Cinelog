import { Injectable } from '@nestjs/common';
import type { RatingResponse, SetRatingRequest } from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { ActivityService } from '../social/activity.service';

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly activity: ActivityService,
  ) {}

  /** Set (or clear, when value is null) the current user's rating for a media item. */
  async setRating(userId: string, req: SetRatingRequest): Promise<RatingResponse> {
    const mediaItemId = (await this.media.resolveRef(req)).id;

    if (req.value === null) {
      await this.prisma.rating.deleteMany({ where: { userId, mediaItemId } });
      // Clearing a rating retracts the feed event rather than leaving a stale one.
      await this.prisma.activityEvent.deleteMany({
        where: { actorId: userId, type: 'RATED', mediaItemId },
      });
    } else {
      await this.prisma.rating.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId } },
        create: { userId, mediaItemId, value: req.value },
        update: { value: req.value },
      });
      await this.activity.recordReplacing({ actorId: userId, type: 'RATED', mediaItemId });

      // Rating something means you watched it. Without this, a rated title
      // stayed uncounted in the profile's Films/Shows stats and in a title's
      // "watched by" tally, because only an explicit status change or a dated
      // diary entry ever marked it complete.
      await this.markWatchedByRating(userId, mediaItemId);
    }

    const community = await this.prisma.rating.aggregate({
      where: { mediaItemId },
      _avg: { value: true },
    });

    return {
      mediaId: mediaItemId,
      value: req.value,
      communityRating: community._avg.value ?? null,
    };
  }

  /**
   * Promote a rated title to COMPLETED and give it a diary entry if it has
   * neither. Deliberately additive: an existing status (WATCHING, ON_HOLD,
   * DROPPED) is left alone, since rating a show midway through shouldn't
   * silently claim you finished it, and an existing diary entry is never
   * duplicated.
   */
  private async markWatchedByRating(userId: string, mediaItemId: string): Promise<void> {
    const now = new Date();
    const existing = await this.prisma.userMediaStatus.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId } },
    });

    if (!existing?.status) {
      await this.prisma.userMediaStatus.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId } },
        create: { userId, mediaItemId, status: 'COMPLETED', completedAt: now },
        update: { status: 'COMPLETED', completedAt: now },
      });
    }

    const hasHistory = await this.prisma.watchHistory.findFirst({
      where: { userId, mediaItemId },
      select: { id: true },
    });
    if (!hasHistory) {
      await this.prisma.watchHistory.create({
        data: { userId, mediaItemId, watchedAt: now, isRewatch: false },
      });
      await this.activity.recordReplacing({ actorId: userId, type: 'WATCHED', mediaItemId });
    }
  }
}
