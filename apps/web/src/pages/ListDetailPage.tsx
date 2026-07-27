import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ListDetail, ListEntry, SearchResult } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { posterGradient } from '../lib/poster';
import { Avatar } from '../components/Avatar';
import { EmptyState, SectionHeader } from '../components/lb';
import { Button, Input, Spinner } from '../components/ui';

export function ListDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data: list, isLoading, isError, error } = useQuery({
    queryKey: ['list', id],
    queryFn: () => api.getList(id),
    enabled: id.length > 0,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['list', id] });
    void queryClient.invalidateQueries({ queryKey: ['lists'] });
  };

  const deleteMut = useMutation({
    mutationFn: () => api.deleteList(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
      navigate('/lists');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (isError || !list) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          title={notFound ? 'List not found' : 'Could not load this list'}
          body={
            notFound
              ? "It may have been deleted, or it's private."
              : 'Something went wrong fetching it.'
          }
          action={
            <Button variant="secondary" onClick={() => navigate('/lists')}>
              Browse lists
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-cond text-3xl font-extrabold uppercase leading-tight tracking-tight">
            {list.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Link to={`/u/${list.owner.username}`} className="flex items-center gap-1.5 hover:text-gold">
              <Avatar
                user={{ username: list.owner.username, avatarUrl: list.owner.avatarUrl }}
                size={20}
              />
              {list.owner.displayName || list.owner.username}
            </Link>
            <span>·</span>
            <span className="tabular-nums">
              {list.itemCount} {list.itemCount === 1 ? 'film' : 'films'}
            </span>
            {!list.isPublic && (
              <>
                <span>·</span>
                <span className="font-cond text-[11px] font-bold uppercase tracking-wide text-gold">
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
              <Button variant="secondary" onClick={() => setAdding(true)}>
                + Add films
              </Button>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm(`Delete "${list.title}"? This cannot be undone.`)) {
                    deleteMut.mutate();
                  }
                }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-8">
        {list.entries.length === 0 ? (
          <EmptyState
            title="Nothing in this list yet"
            body={list.isOwnList ? 'Add films to start building it.' : undefined}
            action={
              list.isOwnList ? (
                <Button variant="primary" onClick={() => setAdding(true)}>
                  + Add films
                </Button>
              ) : undefined
            }
          />
        ) : (
          <EntryList list={list} onChanged={invalidate} />
        )}
      </div>

      <div className="mt-12">
        <ListComments listId={list.id} />
      </div>

      {adding && <AddFilmsModal listId={list.id} onClose={() => setAdding(false)} onAdded={invalidate} />}
      {editing && <EditListModal list={list} onClose={() => setEditing(false)} onSaved={invalidate} />}
    </div>
  );
}

function LikeButton({ list }: { list: ListDetail }): JSX.Element {
  const [liked, setLiked] = useState(list.likedByViewer);
  const [count, setCount] = useState(list.likeCount);

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
  });

  return (
    <button
      onClick={() => mut.mutate(!liked)}
      aria-pressed={liked}
      className={cn(
        'rounded border px-3 py-1.5 font-cond text-[12px] font-bold uppercase tracking-wide transition-colors',
        liked
          ? 'border-rose bg-rose/15 text-rose'
          : 'border-border bg-surface-2 text-muted hover:text-content',
      )}
    >
      {liked ? '♥' : '♡'} {count}
    </button>
  );
}

/** Ordered entries; the owner can drag to reorder and edit per-entry notes. */
function EntryList({ list, onChanged }: { list: ListDetail; onChanged: () => void }): JSX.Element {
  const navigate = useNavigate();
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

  function drop(targetId: string): void {
    if (!dragId || dragId === targetId) return;
    const from = order.findIndex((e) => e.id === dragId);
    const to = order.findIndex((e) => e.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    setOrder(next);
    setDragId(null);
    reorderMut.mutate(next.map((e) => e.id));
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
            list.isOwnList && 'cursor-grab active:cursor-grabbing',
            dragId === entry.id && 'opacity-50',
          )}
        >
          <span className="w-6 shrink-0 pt-1 text-right font-cond text-[13px] font-bold tabular-nums text-muted-2">
            {i + 1}
          </span>
          <button
            onClick={() => navigate(`/media/${entry.media.id}`)}
            className="h-[72px] w-12 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-border-hi/50"
          >
            {entry.media.posterUrl ? (
              <img
                src={entry.media.posterUrl}
                alt={entry.media.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                className="block h-full w-full"
                style={{ background: posterGradient(entry.media.title) }}
              />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <button onClick={() => navigate(`/media/${entry.media.id}`)} className="text-left">
              <span className="text-sm font-semibold text-content hover:text-gold">
                {entry.media.title}
              </span>
              {entry.media.year && <span className="ml-1.5 text-muted-2">{entry.media.year}</span>}
            </button>
            {entry.note && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{entry.note}</p>
            )}
            {list.isOwnList && <NoteEditor list={list} entry={entry} onSaved={onChanged} />}
          </div>
          {list.isOwnList && (
            <button
              onClick={() => removeMut.mutate(entry.id)}
              className="shrink-0 text-xs text-muted-2 hover:text-rose"
            >
              Remove
            </button>
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
      <button
        onClick={() => setEditing(true)}
        className="mt-1 text-[11px] text-muted-2 hover:text-content"
      >
        {entry.note ? 'Edit note' : '+ Add a note'}
      </button>
    );
  }

  return (
    <div className="mt-2 flex gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        placeholder="Why is this here?"
        autoFocus
        className="h-8 flex-1 rounded border border-border bg-surface-2 px-2.5 text-sm text-content placeholder:text-muted-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan/50"
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

function AddFilmsModal({
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

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.length > 1,
  });

  const addMut = useMutation({
    mutationFn: async (result: SearchResult) => {
      // Provider hits aren't cached locally yet, so resolve before adding.
      const mediaId = result.id ?? (await api.resolveMedia({
        provider: result.provider,
        externalId: result.externalId,
        type: result.type,
      })).id;
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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add films to list"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface shadow-soft"
      >
        <div className="border-b border-border p-4">
          <h2 className="mb-3 font-cond text-lg font-extrabold uppercase tracking-tight">
            Add films
          </h2>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for a film or show…"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <p className="mb-3 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
              {error}
            </p>
          )}
          {isFetching ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
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
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-[2px] bg-surface-2">
                    {r.posterUrl ? (
                      <img src={r.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span
                        className="block h-full w-full"
                        style={{ background: posterGradient(r.title) }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-content">{r.title}</p>
                    {r.year && <p className="text-xs text-muted-2">{r.year}</p>}
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
        </div>

        <div className="flex justify-end border-t border-border p-4">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
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

  const mut = useMutation({
    mutationFn: () =>
      api.updateList(list.id, { title, description: description || null, isPublic }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit list"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-soft"
      >
        <h2 className="mb-4 font-cond text-lg font-extrabold uppercase tracking-tight">
          Edit list
        </h2>
        <div className="space-y-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
            rows={3}
            placeholder="Description"
            className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-content placeholder:text-muted-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan/50"
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Visible to everyone
          </label>
          <div className="flex justify-end gap-2">
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
          </div>
        </div>
      </div>
    </div>
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
        <p className="py-3 text-sm text-muted-2">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {data?.comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <Avatar user={{ username: c.author.username, avatarUrl: c.author.avatarUrl }} size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <Link to={`/u/${c.author.username}`} className="font-semibold text-content hover:text-gold">
                    {c.author.displayName || c.author.username}
                  </Link>{' '}
                  <span className="text-muted-2">{new Date(c.createdAt).toLocaleDateString()}</span>
                </p>
                <p className="whitespace-pre-wrap text-sm text-content/90">{c.body}</p>
              </div>
              {c.isOwnComment && (
                <button
                  onClick={() => deleteMut.mutate(c.id)}
                  className="text-xs text-muted-2 hover:text-rose"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 2000))}
          placeholder="Add a comment…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && body.trim()) addMut.mutate();
          }}
          className="h-9 flex-1 rounded border border-border bg-surface-2 px-3 text-sm text-content placeholder:text-muted-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan/50"
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
