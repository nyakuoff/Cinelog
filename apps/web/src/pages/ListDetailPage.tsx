import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ListDetail, ListEntry, SearchResult } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { useScreenHeader } from '../lib/appShell';
import { plural } from '../lib/format';
import { Avatar } from '../components/Avatar';
import {
  IconArrowDown,
  IconArrowUp,
  IconEye,
  IconGrid,
  IconHeart,
  IconList,
} from '../components/app/Icons';
import { Dialog, useConfirm } from '../components/Dialog';
import {
  DateText,
  EmptyState,
  ErrorState,
  mediaHref,
  Poster,
  PosterGrid,
  PosterThumb,
  SectionHeader,
} from '../components/lb';
import { Button, Checkbox, Input, Notice, Spinner, Textarea } from '../components/ui';

const VIEW_KEY = 'cinelog:list-view';
type View = 'detail' | 'grid';

function storedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'detail';
  } catch {
    return 'detail';
  }
}

export function ListDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [view, setViewState] = useState<View>(storedView);
  const setView = (v: View): void => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* private mode — the choice just won't persist */
    }
  };

  const {
    data: list,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['list', id],
    queryFn: () => api.getList(id),
    enabled: id.length > 0,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['list', id] });
    void queryClient.invalidateQueries({ queryKey: ['lists'] });
    void queryClient.invalidateQueries({ queryKey: ['user-lists'] });
  };

  const deleteMut = useMutation({
    mutationFn: () => api.deleteList(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
      void queryClient.invalidateQueries({ queryKey: ['user-lists'] });
      navigate('/lists');
    },
  });

  // The app's title bar carries the list's own name.
  useScreenHeader({ title: list?.title, back: true });

  if (isLoading) return <Spinner center />;

  if (isError || !list) {
    const notFound = error instanceof ApiError && error.status === 404;
    const browse = <Button onClick={() => navigate('/lists')}>Browse lists</Button>;
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        {notFound ? (
          <EmptyState
            title="List not found"
            body="It may have been deleted, or it's private."
            action={browse}
          />
        ) : (
          <ErrorState
            title="Could not load this list"
            onRetry={() => void refetch()}
            action={browse}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 app:py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-cond text-2xl font-extrabold uppercase leading-tight tracking-[0.02em] sm:text-3xl">
            {list.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Link
              to={`/u/${list.owner.username}`}
              className="flex items-center gap-1.5 hover:text-gold"
            >
              <Avatar
                user={{ username: list.owner.username, avatarUrl: list.owner.avatarUrl }}
                size={20}
              />
              {list.owner.displayName || list.owner.username}
            </Link>
            <span>·</span>
            <span className="font-data text-[13px]">{plural(list.itemCount, 'title')}</span>
            {list.isRanked && (
              <>
                <span>·</span>
                <span className="font-cond text-[11px] font-bold uppercase tracking-[0.14em]">
                  Ranked
                </span>
              </>
            )}
            {!list.isPublic && (
              <>
                <span>·</span>
                <span className="font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  Private
                </span>
              </>
            )}
          </div>
          {list.description && (
            <p className="mt-3 max-w-[62ch] whitespace-pre-wrap text-sm leading-relaxed text-content/90">
              {list.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <LikeButton list={list} />
          {list.isOwnList && (
            <>
              <Button onClick={() => setAdding(true)}>Add titles</Button>
              <Button onClick={() => setEditing(true)}>Edit</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete this list?',
                    body: `“${list.title}” and its notes will be removed. This cannot be undone.`,
                    confirmLabel: 'Delete list',
                    danger: true,
                  });
                  if (ok) deleteMut.mutate();
                }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {list.entries.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-border py-3">
          {list.viewerWatchedCount !== undefined && (
            <WatchedProgress watched={list.viewerWatchedCount} total={list.entries.length} />
          )}
          <div
            role="group"
            aria-label="List view"
            className="ml-auto flex gap-0.5 rounded-sm border border-border bg-bg-2 p-0.5"
          >
            {(['detail', 'grid'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                aria-label={v === 'detail' ? 'Detail view' : 'Grid view'}
                title={v === 'detail' ? 'Detail view' : 'Grid view'}
                onClick={() => setView(v)}
                className={cn(
                  'grid h-8 w-9 place-items-center rounded-sm coarse:h-10 coarse:w-11',
                  'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent',
                  view === v ? 'bg-card text-content' : 'text-muted hover:text-content',
                )}
              >
                {v === 'detail' ? <IconList /> : <IconGrid />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        {list.entries.length === 0 ? (
          <EmptyState
            title="Nothing in this list yet"
            body={list.isOwnList ? 'Add titles to start building it.' : undefined}
            action={
              list.isOwnList ? (
                <Button variant="primary" onClick={() => setAdding(true)}>
                  Add titles
                </Button>
              ) : undefined
            }
          />
        ) : view === 'grid' ? (
          <PosterGrid>
            {list.entries.map((entry, i) => (
              <Poster
                key={entry.id}
                title={entry.media.title}
                year={entry.media.year}
                type={entry.media.type}
                posterUrl={entry.media.posterUrl}
                to={mediaHref(entry.media)}
                caption={
                  <span className="flex min-h-4 items-center justify-between gap-2">
                    <span className="font-data text-[13px] font-bold text-muted">
                      {list.isRanked && i + 1}
                    </span>
                    {entry.viewerWatched && <WatchedMark />}
                  </span>
                }
              />
            ))}
          </PosterGrid>
        ) : (
          <EntryList list={list} onChanged={invalidate} />
        )}
      </div>

      <div className="mt-12">
        <ListComments listId={list.id} />
      </div>

      {adding && (
        <AddTitlesModal listId={list.id} onClose={() => setAdding(false)} onAdded={invalidate} />
      )}
      {editing && (
        <EditListModal list={list} onClose={() => setEditing(false)} onSaved={invalidate} />
      )}
    </div>
  );
}

/** "You've watched X of Y" — the reason a Letterboxd user opens a list. */
function WatchedProgress({ watched, total }: { watched: number; total: number }): JSX.Element {
  const pct = Math.round((watched / total) * 100);
  return (
    <div className="min-w-[12rem] flex-1 sm:max-w-sm">
      <p className="flex items-baseline justify-between gap-3 text-sm text-muted">
        <span>
          You&rsquo;ve watched <b className="font-data text-content">{watched}</b> of{' '}
          <b className="font-data text-content">{total}</b>
        </span>
        <span className="font-data text-[11px] text-cyan">{pct}%</span>
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={watched}
        aria-label="Titles watched"
        className="mt-1.5 h-1 bg-border"
      >
        <div className="h-full bg-cyan" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function WatchedMark(): JSX.Element {
  return (
    <span title="You've watched this" className="shrink-0 text-cyan">
      <IconEye className="h-3.5 w-3.5" />
      <span className="sr-only">Watched</span>
    </span>
  );
}

function LikeButton({ list }: { list: ListDetail }): JSX.Element {
  const [liked, setLiked] = useState(list.likedByViewer);
  const [count, setCount] = useState(list.likeCount);
  // Follow the server when a refetch brings different values (liked elsewhere).
  useEffect(() => {
    setLiked(list.likedByViewer);
    setCount(list.likeCount);
  }, [list.likedByViewer, list.likeCount]);
  const queryClient = useQueryClient();

  const mut = useMutation({
    mutationFn: (next: boolean) => (next ? api.likeList(list.id) : api.unlikeList(list.id)),
    onMutate: (next: boolean) => {
      const prev = { liked, count };
      setLiked(next);
      setCount((c) => c + (next ? 1 : -1));
      return prev;
    },
    onError: (_e, _v, prev) => {
      if (prev) {
        setLiked(prev.liked);
        setCount(prev.count);
      }
    },
    // The cached detail and list cards still hold the old like state.
    onSettled: () => {
      for (const queryKey of [['list', list.id], ['lists'], ['user-lists'], ['profile']]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  return (
    <Button
      onClick={() => mut.mutate(!liked)}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike this list' : 'Like this list'}
      className={cn(liked && '!border-rose/60 !text-rose')}
    >
      <IconHeart filled={liked} />
      <span className="font-data tracking-normal">{count}</span>
    </Button>
  );
}

/**
 * Ordered entries. The owner reorders with the arrows — which work under a
 * finger and from the keyboard — or by dragging a row with a mouse (HTML5
 * drag-and-drop never fires for touch).
 */
function EntryList({ list, onChanged }: { list: ListDetail; onChanged: () => void }): JSX.Element {
  const [order, setOrder] = useState<ListEntry[]>(list.entries);
  const [dragId, setDragId] = useState<string | null>(null);

  // Keep local order in sync when the server sends a new version.
  useEffect(() => setOrder(list.entries), [list.entries]);

  const reorderMut = useMutation({
    mutationFn: (entryIds: string[]) => api.reorderList(list.id, { entryIds }),
    onError: () => setOrder(list.entries), // roll back to the server's order
    onSuccess: onChanged,
  });
  const removeMut = useMutation({
    mutationFn: (entryId: string) => api.removeListItem(list.id, entryId),
    onSuccess: onChanged,
  });

  function move(from: number, to: number): void {
    if (from === to || from < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    setOrder(next);
    reorderMut.mutate(next.map((e) => e.id));
  }

  function drop(targetId: string): void {
    if (!dragId || dragId === targetId) return;
    move(
      order.findIndex((e) => e.id === dragId),
      order.findIndex((e) => e.id === targetId),
    );
    setDragId(null);
  }

  return (
    <ol className="divide-y divide-border">
      {order.map((entry, i) => (
        <li
          key={entry.id}
          draggable={list.isOwnList}
          onDragStart={() => setDragId(entry.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => drop(entry.id)}
          onDragEnd={() => setDragId(null)}
          className={cn(
            'flex items-start gap-3 py-3',
            list.isOwnList && 'not-app:cursor-grab not-app:active:cursor-grabbing',
            dragId === entry.id && 'opacity-50',
          )}
        >
          {list.isRanked && (
            <span className="w-6 shrink-0 pt-1 text-right font-data text-[13px] font-bold text-muted-2">
              {i + 1}
            </span>
          )}
          <PosterThumb
            title={entry.media.title}
            posterUrl={entry.media.posterUrl}
            to={mediaHref(entry.media)}
          />
          <div className="min-w-0 flex-1">
            <Link to={mediaHref(entry.media)} className="group">
              <span className="text-sm font-semibold text-content group-hover:text-gold">
                {entry.media.title}
              </span>
              {entry.media.year && (
                <span className="ml-1.5 font-data text-[13px] text-muted-2">
                  {entry.media.year}
                </span>
              )}
            </Link>
            {entry.viewerWatched && (
              <span className="ml-2 inline-block align-middle">
                <WatchedMark />
              </span>
            )}
            {entry.note && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{entry.note}</p>
            )}
            {list.isOwnList && (
              <div className="mt-1 flex flex-wrap items-center gap-x-4">
                <NoteEditor list={list} entry={entry} onSaved={onChanged} />
                <Button variant="link" size="sm" onClick={() => removeMut.mutate(entry.id)}>
                  Remove
                </Button>
              </div>
            )}
          </div>
          {list.isOwnList && (
            <div className="flex shrink-0 flex-col">
              <Button
                variant="ghost"
                size="icon"
                className="!h-9 !w-9"
                disabled={i === 0 || reorderMut.isPending}
                onClick={() => move(i, i - 1)}
                aria-label={`Move ${entry.media.title} up`}
              >
                <IconArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="!h-9 !w-9"
                disabled={i === order.length - 1 || reorderMut.isPending}
                onClick={() => move(i, i + 1)}
                aria-label={`Move ${entry.media.title} down`}
              >
                <IconArrowDown />
              </Button>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function NoteEditor({
  list,
  entry,
  onSaved,
}: {
  list: ListDetail;
  entry: ListEntry;
  onSaved: () => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(entry.note ?? '');

  const mut = useMutation({
    mutationFn: () => api.updateListItem(list.id, entry.id, note || null),
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
  });

  if (!editing) {
    return (
      <Button variant="link" size="sm" onClick={() => setEditing(true)}>
        {entry.note ? 'Edit note' : 'Add a note'}
      </Button>
    );
  }

  return (
    <div className="mt-1 flex w-full flex-wrap gap-2">
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        placeholder="Why is this here?"
        autoFocus
        className="h-8 min-w-[10rem] flex-1 coarse:h-10"
      />
      <Button size="sm" variant="secondary" disabled={mut.isPending} onClick={() => mut.mutate()}>
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  );
}

function AddTitlesModal({
  listId,
  onClose,
  onAdded,
}: {
  listId: string;
  onClose: () => void;
  onAdded: () => void;
}): JSX.Element {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Debounce so typing doesn't fire a provider search per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.length > 1,
  });

  const addMut = useMutation({
    mutationFn: async (result: SearchResult) => {
      // Provider hits aren't cached locally yet, so resolve before adding.
      const mediaId =
        result.id ??
        (
          await api.resolveMedia({
            provider: result.provider,
            externalId: result.externalId,
            type: result.type,
          })
        ).id;
      return api.addListItem(listId, { mediaId });
    },
    onSuccess: (_res, result) => {
      setAdded((s) => new Set(s).add(result.externalId));
      setError(null);
      onAdded();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Could not add that title');
    },
  });

  return (
    <Dialog
      title="Add titles"
      onClose={onClose}
      toolbar={
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for a film or show…"
          aria-label="Search for a film or show"
          data-autofocus
        />
      }
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      {error && <Notice className="mb-3">{error}</Notice>}
      {isFetching ? (
        <Spinner center />
      ) : debounced.length < 2 ? (
        <p className="py-6 text-center text-sm text-muted-2">
          Type at least two characters to search.
        </p>
      ) : (data?.results.length ?? 0) === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No results.</p>
      ) : (
        <ul className="space-y-1.5">
          {data?.results.slice(0, 20).map((r) => (
            <li key={`${r.provider}:${r.externalId}`} className="flex items-center gap-3">
              <PosterThumb title={r.title} posterUrl={r.posterUrl} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-content">{r.title}</p>
                {r.year && <p className="font-data text-[11px] text-muted-2">{r.year}</p>}
              </div>
              <Button
                size="sm"
                variant={added.has(r.externalId) ? 'ghost' : 'secondary'}
                disabled={added.has(r.externalId) || addMut.isPending}
                onClick={() => addMut.mutate(r)}
              >
                {added.has(r.externalId) ? 'Added' : 'Add'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function EditListModal({
  list,
  onClose,
  onSaved,
}: {
  list: ListDetail;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element {
  const [title, setTitle] = useState(list.title);
  const [description, setDescription] = useState(list.description ?? '');
  const [isPublic, setIsPublic] = useState(list.isPublic);
  const [isRanked, setIsRanked] = useState(list.isRanked ?? false);

  const mut = useMutation({
    mutationFn: () =>
      api.updateList(list.id, { title, description: description || null, isPublic, isRanked }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <Dialog
      title="Edit list"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!title.trim() || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 120))}
          aria-label="Title"
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
          rows={3}
          placeholder="Description"
          aria-label="Description"
        />
        <Checkbox checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)}>
          Visible to everyone
        </Checkbox>
        <Checkbox checked={isRanked} onChange={(e) => setIsRanked(e.target.checked)}>
          Ranked list — show position numbers
        </Checkbox>
        {mut.isError && (
          <Notice>{mut.error instanceof ApiError ? mut.error.message : 'Could not save'}</Notice>
        )}
      </div>
    </Dialog>
  );
}

function ListComments({ listId }: { listId: string }): JSX.Element {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['list-comments', listId],
    queryFn: () => api.getListComments(listId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['list-comments', listId] });
    void queryClient.invalidateQueries({ queryKey: ['list', listId] });
  };

  const addMut = useMutation({
    mutationFn: () => api.addListComment(listId, { body }),
    onSuccess: () => {
      setBody('');
      invalidate();
    },
  });
  const deleteMut = useMutation({
    mutationFn: (commentId: string) => api.deleteListComment(listId, commentId),
    onSuccess: invalidate,
  });

  return (
    <section>
      <SectionHeader title="Comments" />
      {isLoading ? (
        <Spinner className="h-4 w-4" />
      ) : (data?.comments.length ?? 0) === 0 ? (
        <p className="py-1 text-sm text-muted-2">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {data?.comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <Avatar
                user={{ username: c.author.username, avatarUrl: c.author.avatarUrl }}
                size={28}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <Link
                    to={`/u/${c.author.username}`}
                    className="font-semibold text-content hover:text-gold"
                  >
                    {c.author.displayName || c.author.username}
                  </Link>{' '}
                  <DateText iso={c.createdAt} />
                </p>
                <p className="whitespace-pre-wrap text-sm text-content/90">{c.body}</p>
              </div>
              {c.isOwnComment && (
                <Button variant="link" size="sm" onClick={() => deleteMut.mutate(c.id)}>
                  Delete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 2000))}
          placeholder="Add a comment…"
          aria-label="Add a comment"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && body.trim() && !addMut.isPending) addMut.mutate();
          }}
          className="h-10 flex-1 coarse:h-11"
        />
        <Button
          variant="secondary"
          disabled={!body.trim() || addMut.isPending}
          onClick={() => addMut.mutate()}
        >
          Post
        </Button>
      </div>
    </section>
  );
}
