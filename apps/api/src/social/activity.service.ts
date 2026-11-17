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
  /**
   * When the action actually happened, if that isn't now — imports carry a
   * real watched date, and dating those events "now" would dump a whole
   * back catalogue at the top of everyone's feed instead of slotting each
   * entry into its proper place in history.
   */
  createdAt?: Date | null;
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
          ...(input.createdAt ? { createdAt: input.createdAt } : {}),
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to record ${input.type} activity: ${err}`);
    }
  }

  /**
   * Replace a prior same-kind event for the same actor+subject instead of
   * stacking duplicates — re-rating a title should move it up the feed, not
   * appear twice. The subject is the media item or the list: list events have
   * no media, so keying on media alone made editing list B delete list A's
   * LIST_UPDATED event. reviewId isn't part of the key because a member has at
   * most one review per title, so (actor, REVIEWED, media) already pins it —
   * and that also replaces legacy imported REVIEWED rows that lack a reviewId.
   */
  async recordReplacing(input: RecordActivityInput): Promise<void> {
    try {
      await this.prisma.activityEvent.deleteMany({
        where: {
          actorId: input.actorId,
          type: input.type,
          mediaItemId: input.mediaItemId ?? null,
          listId: input.listId ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to clear prior ${input.type} activity: ${err}`);
    }
    await this.record(input);
  }
}
