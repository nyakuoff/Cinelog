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

      // Rating something means you watched it — see markWatchedByRating.
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
   * Rating implies watched (Letterboxd semantics): a rated title with no
   * status becomes COMPLETED, which is what the Watched tab, profile stats and
   * a title's "watched by" tally count alongside the rating itself. It does
   * NOT invent a diary entry — the diary is dated watches the member actually
   * logged, and a rating carries no watch date. An existing status (WATCHING,
   * ON_HOLD, DROPPED) is left alone, since rating a show midway through
   * shouldn't silently claim you finished it.
   */
  private async markWatchedByRating(userId: string, mediaItemId: string): Promise<void> {
    const now = new Date();
    const existing = await this.prisma.userMediaStatus.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId } },
    });
    if (existing?.status) return;
    await this.prisma.userMediaStatus.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId } },
      create: { userId, mediaItemId, status: 'COMPLETED', completedAt: now },
      update: { status: 'COMPLETED', completedAt: now },
    });
  }
}
