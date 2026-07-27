import { Injectable, Logger } from '@nestjs/common';
import type { ActivityType } from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordActivityInput {
  actorId: string;
  type: ActivityType;
  mediaItemId?: string | null;
  reviewId?: string | null;
  listId?: string | null;
  targetUserId?: string | null;
}

/**
 * Writes to the activity stream. Called inline from the write paths that
 * produce feed-worthy events (rate, review, watch, favorite, follow, list).
 *
 * Recording is deliberately best-effort: a failure here must never fail the
 * user's actual action, so errors are logged and swallowed.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordActivityInput): Promise<void> {
    try {
      await this.prisma.activityEvent.create({
        data: {
          actorId: input.actorId,
          type: input.type,
          mediaItemId: input.mediaItemId ?? null,
          reviewId: input.reviewId ?? null,
          listId: input.listId ?? null,
          targetUserId: input.targetUserId ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to record ${input.type} activity: ${err}`);
    }
  }

  /**
   * Replace a prior same-kind event for the same actor+media instead of stacking
   * duplicates — re-rating a title should move it up the feed, not appear twice.
   */
  async recordReplacing(input: RecordActivityInput): Promise<void> {
    try {
      await this.prisma.activityEvent.deleteMany({
        where: {
          actorId: input.actorId,
          type: input.type,
          mediaItemId: input.mediaItemId ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to clear prior ${input.type} activity: ${err}`);
    }
    await this.record(input);
  }
}
