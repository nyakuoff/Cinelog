import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { List, ListItem, MediaItem, User } from '@prisma/client';
import {
  MediaType,
  type AddListItemRequest,
  type CreateListCommentRequest,
  type CreateListRequest,
  type ListBrowseQuery,
  type ListComment,
  type ListCommentListResponse,
  type ListDetail,
  type ListListResponse,
  type ListSummary,
  type MediaSummary,
  type ReorderListRequest,
  type UpdateListItemRequest,
  type UpdateListRequest,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { mediaSummarySelect, watchedMediaWhere, type MediaSummaryRow } from '../common/media-select';
import { ArtworkService } from '../artwork/artwork.service';
import { ActivityService } from '../social/activity.service';
import { canSeeUser, isBlockedBetween, visibleUserWhere } from '../common/visibility';

type ListWithOwner = List & {
  user: User;
  items?: (ListItem & { media: MediaSummaryRow })[];
  _count?: { items: number; likes: number; comments: number };
};

@Injectable()
export class ListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artwork: ArtworkService,
    private readonly activity: ActivityService,
  ) {}

  // -- reads -------------------------------------------------------------------

  /** Public lists across the instance, for the Lists browse page — or, with
   *  `containingMediaId`, the public lists that include that title (the
   *  title page's "Lists" panel). `ownerIds` narrows to those owners (home's
   *  friends' lists); `q` is the list search (title/description substring,
   *  case-insensitive for ASCII via SQLite LIKE). */
  async browse(
    viewerId: string | undefined,
    query: ListBrowseQuery,
    containingMediaId?: string,
    extra: { ownerIds?: string[]; q?: string } = {},
  ): Promise<ListListResponse> {
    const skip = query.cursor ? Number(query.cursor) : 0;

    const rows = await this.prisma.list.findMany({
      where: {
        isPublic: true,
        // A public list on a private/followers-only profile follows the
        // profile's visibility; blocked members' lists never appear.
        user: visibleUserWhere(viewerId),
        ...(containingMediaId ? { items: { some: { mediaItemId: containingMediaId } } } : {}),
        ...(extra.ownerIds ? { userId: { in: extra.ownerIds } } : {}),
        ...(extra.q
          ? { OR: [{ title: { contains: extra.q } }, { description: { contains: extra.q } }] }
          : {}),
      },
      include: this.listInclude(),
      orderBy:
        query.sort === 'RECENT'
          ? { createdAt: 'desc' }
          : query.sort === 'UPDATED'
            ? { updatedAt: 'desc' }
            : { likes: { _count: 'desc' } },
      take: query.limit,
      skip,
    });

    return {
      lists: await this.toSummaries(rows, viewerId),
      nextCursor: rows.length >= query.limit ? String(skip + query.limit) : null,
    };
  }

  /** Lists owned by a member. Private lists are only returned to their owner. */
  async listByOwner(
    username: string,
    viewerId: string | undefined,
    containsMediaId?: string,
  ): Promise<ListListResponse> {
    const owner = await this.prisma.user.findUnique({ where: { username } });
    if (!owner) throw new NotFoundException('User not found');
    if (await isBlockedBetween(this.prisma, owner.id, viewerId)) {
      throw new NotFoundException('User not found');
    }
    const isOwner = owner.id === viewerId;
    // Same rule as the profile's other tabs: hidden profile -> empty, not an error.
    if (!(await canSeeUser(this.prisma, owner.id, viewerId))) return { lists: [], nextCursor: null };

    const rows = await this.prisma.list.findMany({
      where: { userId: owner.id, ...(isOwner ? {} : { isPublic: true }) },
      include: this.listInclude(),
      orderBy: { updatedAt: 'desc' },
    });
    const lists = await this.toSummaries(rows, viewerId);
    if (containsMediaId) {
      // One query answers membership for every list (visible ones only, via `rows`).
      const hits = await this.prisma.listItem.findMany({
        where: { mediaItemId: containsMediaId, listId: { in: rows.map((r) => r.id) } },
        select: { listId: true },
      });
      const held = new Set(hits.map((h) => h.listId));
      for (const l of lists) l.containsMedia = held.has(l.id);
    }
    return { lists, nextCursor: null };
  }

  /** Lists `likerId` has liked, newest like first — only ones the viewer could
   *  open. Caller checks the liker's own profile visibility. */
  async listLikedBy(
    likerId: string,
    viewerId: string | undefined,
    cursor: string | undefined,
    limit: number,
  ): Promise<ListListResponse> {
    const skip = cursor ? Number(cursor) : 0;
    const likes = await this.prisma.listLike.findMany({
      where: {
        userId: likerId,
        list: {
          OR: [
            { isPublic: true, user: visibleUserWhere(viewerId) },
            ...(viewerId ? [{ userId: viewerId }] : []),
          ],
        },
      },
      include: { list: { include: this.listInclude() } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
    return {
      lists: await this.toSummaries(likes.map((l) => l.list), viewerId),
      nextCursor: likes.length >= limit ? String(skip + limit) : null,
    };
  }

  async getDetail(listId: string, viewerId: string | undefined): Promise<ListDetail> {
    const row = await this.prisma.list.findUnique({
      where: { id: listId },
      include: {
        user: true,
        _count: { select: { items: true, likes: true, comments: true } },
        items: { include: { media: { select: mediaSummarySelect } }, orderBy: { position: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('List not found');
    await this.assertVisible(row, viewerId);

    const [[summary], watched] = await Promise.all([
      this.toSummaries([row], viewerId),
      viewerId
        ? this.prisma.mediaItem.findMany({
            where: { AND: [{ listItems: { some: { listId } } }, watchedMediaWhere(viewerId)] },
            select: { id: true },
          })
        : null,
    ]);
    const watchedIds = watched ? new Set(watched.map((m) => m.id)) : null;
    return {
      ...(summary as ListSummary),
      entries: (row.items ?? []).map((item) => ({
        id: item.id,
        position: item.position,
        note: item.note,
        media: this.toSummary(item.media),
        ...(watchedIds ? { viewerWatched: watchedIds.has(item.mediaItemId) } : {}),
      })),
      ...(watchedIds ? { viewerWatchedCount: watchedIds.size } : {}),
    };
  }

  // -- writes ------------------------------------------------------------------

  async create(userId: string, dto: CreateListRequest): Promise<ListDetail> {
    const row = await this.prisma.list.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description ?? null,
        isPublic: dto.isPublic ?? true,
        ...(dto.isRanked !== undefined ? { isRanked: dto.isRanked } : {}),
      },
    });
    if (row.isPublic) {
      await this.activity.record({ actorId: userId, type: 'LIST_CREATED', listId: row.id });
    }
    return this.getDetail(row.id, userId);
  }

  async update(userId: string, listId: string, dto: UpdateListRequest): Promise<ListDetail> {
    const list = await this.requireOwned(userId, listId);
    const updated = await this.prisma.list.update({
      where: { id: list.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
        ...(dto.isRanked !== undefined ? { isRanked: dto.isRanked } : {}),
      },
    });
    // Making a list private retracts its feed events; nothing should point at
    // content the viewer can no longer open.
    if (dto.isPublic === false) {
      await this.prisma.activityEvent.deleteMany({ where: { listId: list.id } });
    } else if (dto.isPublic === true && !list.isPublic) {
      await this.activity.record({ actorId: userId, type: 'LIST_CREATED', listId: updated.id });
    }
    return this.getDetail(updated.id, userId);
  }

  async remove(userId: string, listId: string): Promise<void> {
    const list = await this.requireOwned(userId, listId);
    await this.prisma.list.delete({ where: { id: list.id } });
    // ActivityEvent has no FK to List, so its rows must be cleared explicitly.
    await this.prisma.activityEvent.deleteMany({ where: { listId: list.id } });
  }

  async addItem(userId: string, listId: string, dto: AddListItemRequest): Promise<ListDetail> {
    const list = await this.requireOwned(userId, listId);
    const media = await this.prisma.mediaItem.findUnique({ where: { id: dto.mediaId } });
    if (!media) throw new NotFoundException('Media not found');

    const last = await this.prisma.listItem.findFirst({
      where: { listId: list.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    try {
      await this.prisma.listItem.create({
        data: {
          listId: list.id,
          mediaItemId: media.id,
          position: (last?.position ?? 0) + 1,
          note: dto.note ?? null,
        },
      });
    } catch (err) {
      // Unique [listId, mediaItemId] — a title can only appear once per list.
      if (isUniqueConstraintError(err)) {
        throw new BadRequestException('That title is already in this list');
      }
      throw err;
    }

    await this.touch(list.id, userId);
    return this.getDetail(list.id, userId);
  }

  async updateItem(
    userId: string,
    listId: string,
    entryId: string,
    dto: UpdateListItemRequest,
  ): Promise<ListDetail> {
    const list = await this.requireOwned(userId, listId);
    const entry = await this.prisma.listItem.findUnique({ where: { id: entryId } });
    if (!entry || entry.listId !== list.id) throw new NotFoundException('List entry not found');
    await this.prisma.listItem.update({ where: { id: entryId }, data: { note: dto.note } });
    await this.touch(list.id, userId);
    return this.getDetail(list.id, userId);
  }

  async removeItem(userId: string, listId: string, entryId: string): Promise<ListDetail> {
    const list = await this.requireOwned(userId, listId);
    const entry = await this.prisma.listItem.findUnique({ where: { id: entryId } });
    if (!entry || entry.listId !== list.id) throw new NotFoundException('List entry not found');
    await this.prisma.listItem.delete({ where: { id: entryId } });
    await this.touch(list.id, userId);
    return this.getDetail(list.id, userId);
  }

  /** Rewrite the whole order in one transaction so the list is never left
   *  half-reordered if a single write fails. */
  async reorder(userId: string, listId: string, dto: ReorderListRequest): Promise<ListDetail> {
    const list = await this.requireOwned(userId, listId);
    const entries = await this.prisma.listItem.findMany({
      where: { listId: list.id },
      select: { id: true },
    });
    const known = new Set(entries.map((e) => e.id));

    if (dto.entryIds.length !== known.size || dto.entryIds.some((id) => !known.has(id))) {
      throw new BadRequestException('Reorder must list every entry in this list exactly once');
    }
    if (new Set(dto.entryIds).size !== dto.entryIds.length) {
      throw new BadRequestException('Reorder contains duplicate entries');
    }

    await this.prisma.$transaction(
      dto.entryIds.map((id, i) =>
        this.prisma.listItem.update({ where: { id }, data: { position: i + 1 } }),
      ),
    );
    await this.touch(list.id, userId);
    return this.getDetail(list.id, userId);
  }

  // -- likes & comments --------------------------------------------------------

  async like(userId: string, listId: string): Promise<void> {
    await this.requireVisible(listId, userId);
    try {
      await this.prisma.listLike.create({ data: { userId, listId } });
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
    }
  }

  async unlike(userId: string, listId: string): Promise<void> {
    await this.prisma.listLike.deleteMany({ where: { userId, listId } });
  }

  async listComments(
    listId: string,
    viewerId: string | undefined,
    cursor?: string,
    limit = 30,
  ): Promise<ListCommentListResponse> {
    await this.requireVisible(listId, viewerId);
    const skip = cursor ? Number(cursor) : 0;
    const rows = await this.prisma.listComment.findMany({
      where: { listId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip,
    });
    return {
      comments: rows.map((r) => this.toComment(r as never, viewerId)),
      nextCursor: rows.length >= limit ? String(skip + limit) : null,
    };
  }

  async addComment(
    userId: string,
    listId: string,
    dto: CreateListCommentRequest,
  ): Promise<ListComment> {
    await this.requireVisible(listId, userId);
    const row = await this.prisma.listComment.create({
      data: { listId, userId, body: dto.body },
      include: { user: true },
    });
    return this.toComment(row as never, userId);
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.prisma.listComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.listComment.delete({ where: { id: commentId } });
  }

  // -- helpers -----------------------------------------------------------------

  private listInclude() {
    return {
      user: true,
      _count: { select: { items: true, likes: true, comments: true } },
      // Only enough entries to build the cover collage.
      items: { include: { media: { select: mediaSummarySelect } }, orderBy: { position: 'asc' as const }, take: 4 },
    };
  }

  private async requireOwned(userId: string, listId: string): Promise<List> {
    const list = await this.prisma.list.findUnique({ where: { id: listId } });
    if (!list) throw new NotFoundException('List not found');
    if (list.userId !== userId) throw new ForbiddenException('You can only edit your own lists');
    return list;
  }

  private async requireVisible(listId: string, viewerId: string | undefined): Promise<List> {
    const list = await this.prisma.list.findUnique({ where: { id: listId } });
    if (!list) throw new NotFoundException('List not found');
    await this.assertVisible(list, viewerId);
    return list;
  }

  /** A list is visible to its owner, or to others when it's public AND its
   *  owner's profile is visible to them (visibility + blocks). Anything else
   *  is a 404 rather than a 403 so its existence isn't confirmed. */
  private async assertVisible(list: List, viewerId: string | undefined): Promise<void> {
    if (list.userId === viewerId) return;
    if (!list.isPublic || !(await canSeeUser(this.prisma, list.userId, viewerId))) {
      throw new NotFoundException('List not found');
    }
  }

  /** Bump updatedAt and surface an "updated a list" event for public lists. */
  private async touch(listId: string, userId: string): Promise<void> {
    await this.prisma.list.update({ where: { id: listId }, data: { updatedAt: new Date() } });
    const list = await this.prisma.list.findUnique({ where: { id: listId } });
    if (list?.isPublic) {
      await this.activity.recordReplacing({
        actorId: userId,
        type: 'LIST_UPDATED',
        listId,
      });
    }
  }

  private toSummary(media: MediaSummaryRow): MediaSummary {
    return {
      id: media.id,
      type: MediaType.catch('MOVIE').parse(media.type),
      title: media.title,
      year: media.releaseDate ? Number(media.releaseDate.slice(0, 4)) || null : null,
      posterUrl: this.artwork.toProxyUrl(media.posterPath),
    };
  }

  private async toSummaries(
    rows: ListWithOwner[],
    viewerId: string | undefined,
  ): Promise<ListSummary[]> {
    if (rows.length === 0) return [];
    const likedIds = viewerId
      ? new Set(
          (
            await this.prisma.listLike.findMany({
              where: { userId: viewerId, listId: { in: rows.map((r) => r.id) } },
              select: { listId: true },
            })
          ).map((l) => l.listId),
        )
      : new Set<string>();

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      isPublic: row.isPublic,
      isRanked: row.isRanked,
      owner: {
        id: row.user.id,
        username: row.user.username,
        displayName: row.user.displayName,
        avatarUrl: row.user.avatarUrl,
      },
      itemCount: row._count?.items ?? 0,
      likeCount: row._count?.likes ?? 0,
      commentCount: row._count?.comments ?? 0,
      likedByViewer: likedIds.has(row.id),
      isOwnList: row.userId === viewerId,
      coverPosters: (row.items ?? [])
        .slice(0, 4)
        .map((i) => this.artwork.toProxyUrl(i.media.posterPath)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  private toComment(
    row: { id: string; listId: string; body: string; userId: string; createdAt: Date; updatedAt: Date; user: User },
    viewerId: string | undefined,
  ): ListComment {
    return {
      id: row.id,
      listId: row.listId,
      author: {
        id: row.user.id,
        username: row.user.username,
        displayName: row.user.displayName,
        avatarUrl: row.user.avatarUrl,
      },
      body: row.body,
      isOwnComment: row.userId === viewerId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}
