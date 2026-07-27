import { z } from 'zod';
import { MediaSummary } from './social.js';

export const ListOwner = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type ListOwner = z.infer<typeof ListOwner>;

export const ListEntry = z.object({
  id: z.string(),
  position: z.number().int(),
  note: z.string().nullable(),
  media: MediaSummary,
});
export type ListEntry = z.infer<typeof ListEntry>;

/** A list without its entries — for browse grids and profile tabs. The cover is
 *  built client-side from the first few posters, so no image is stored. */
export const ListSummary = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  isPublic: z.boolean(),
  owner: ListOwner,
  itemCount: z.number().int(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  likedByViewer: z.boolean(),
  isOwnList: z.boolean(),
  /** Up to four posters for the generated cover, in list order. */
  coverPosters: z.array(z.string().nullable()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ListSummary = z.infer<typeof ListSummary>;

export const ListDetail = ListSummary.extend({
  entries: z.array(ListEntry),
});
export type ListDetail = z.infer<typeof ListDetail>;

export const ListListResponse = z.object({
  lists: z.array(ListSummary),
  nextCursor: z.string().nullable(),
});
export type ListListResponse = z.infer<typeof ListListResponse>;

export const CreateListRequest = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  isPublic: z.boolean().optional().default(true),
});
export type CreateListRequest = z.infer<typeof CreateListRequest>;

export const UpdateListRequest = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  isPublic: z.boolean().optional(),
});
export type UpdateListRequest = z.infer<typeof UpdateListRequest>;

export const AddListItemRequest = z.object({
  mediaId: z.string(),
  note: z.string().max(500).nullable().optional(),
});
export type AddListItemRequest = z.infer<typeof AddListItemRequest>;

export const UpdateListItemRequest = z.object({
  note: z.string().max(500).nullable(),
});
export type UpdateListItemRequest = z.infer<typeof UpdateListItemRequest>;

/** Full ordered set of entry ids — the whole order is rewritten in one transaction. */
export const ReorderListRequest = z.object({
  entryIds: z.array(z.string()).min(1),
});
export type ReorderListRequest = z.infer<typeof ReorderListRequest>;

export const ListSort = z.enum(['POPULAR', 'RECENT', 'UPDATED']);
export type ListSort = z.infer<typeof ListSort>;

export const ListBrowseQuery = z.object({
  sort: ListSort.optional().default('POPULAR'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(60).optional().default(24),
});
export type ListBrowseQuery = z.infer<typeof ListBrowseQuery>;

export const ListComment = z.object({
  id: z.string(),
  listId: z.string(),
  author: ListOwner,
  body: z.string(),
  isOwnComment: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ListComment = z.infer<typeof ListComment>;

export const ListCommentListResponse = z.object({
  comments: z.array(ListComment),
  nextCursor: z.string().nullable(),
});
export type ListCommentListResponse = z.infer<typeof ListCommentListResponse>;

export const CreateListCommentRequest = z.object({
  body: z.string().min(1).max(2000),
});
export type CreateListCommentRequest = z.infer<typeof CreateListCommentRequest>;
