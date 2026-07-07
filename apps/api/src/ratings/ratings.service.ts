import { Injectable } from '@nestjs/common';
import type { RatingResponse, SetRatingRequest } from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  /** Set (or clear, when value is null) the current user's rating for a media item. */
  async setRating(userId: string, req: SetRatingRequest): Promise<RatingResponse> {
    const mediaItemId = (await this.media.resolveRef(req)).id;

    if (req.value === null) {
      await this.prisma.rating.deleteMany({ where: { userId, mediaItemId } });
    } else {
      await this.prisma.rating.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId } },
        create: { userId, mediaItemId, value: req.value },
        update: { value: req.value },
      });
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
}
