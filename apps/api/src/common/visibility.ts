import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The one definition of "whose stuff may this viewer see", shared by every
 * read path that surfaces another member's content (reviews, lists, feed,
 * friend ratings, follower lists, profiles).
 *
 * A member's content is visible when there is no block between the two in
 * either direction AND their profile is PUBLIC, or FOLLOWERS and the viewer
 * follows them. Members always see their own content. Anonymous viewers only
 * ever see PUBLIC profiles.
 *
 * Returned as a Prisma `UserWhereInput` so callers filter in SQL (relation
 * filters like `user: visibleUserWhere(v)`) instead of post-filtering a page.
 */
export function visibleUserWhere(viewerId: string | undefined): Prisma.UserWhereInput {
  if (!viewerId) return { profileVisibility: 'PUBLIC' };
  return {
    OR: [
      { id: viewerId },
      {
        OR: [
          { profileVisibility: 'PUBLIC' },
          { profileVisibility: 'FOLLOWERS', followedBy: { some: { followerId: viewerId } } },
        ],
        ...notBlockedWhere(viewerId),
      },
    ],
  };
}

/** Users with no block between them and the viewer, in either direction. */
export function notBlockedWhere(viewerId: string | undefined): Prisma.UserWhereInput {
  if (!viewerId) return {};
  return {
    blocking: { none: { blockedId: viewerId } },
    blockedBy: { none: { blockerId: viewerId } },
  };
}

/** Single-user form of visibleUserWhere, for detail endpoints. */
export async function canSeeUser(
  prisma: PrismaService,
  ownerId: string,
  viewerId: string | undefined,
): Promise<boolean> {
  if (ownerId === viewerId) return true;
  const n = await prisma.user.count({ where: { AND: [{ id: ownerId }, visibleUserWhere(viewerId)] } });
  return n > 0;
}

/** Whether either of the two has blocked the other. */
export async function isBlockedBetween(
  prisma: PrismaService,
  a: string,
  b: string | undefined,
): Promise<boolean> {
  if (!b || a === b) return false;
  const n = await prisma.userBlock.count({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return n > 0;
}
