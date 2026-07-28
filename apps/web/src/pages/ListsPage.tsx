import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ListSort } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { EmptyState, SectionHeader } from '../components/lb';
import { ListCard } from '../components/ListCard';
import { Button, Input, Spinner } from '../components/ui';
import { Field } from '../components/Field';

const SORTS: { key: ListSort; label: string }[] = [
  { key: 'POPULAR', label: 'Popular' },
  { key: 'UPDATED', label: 'Recently updated' },
  { key: 'RECENT', label: 'Newest' },
];

export function ListsPage(): JSX.Element {
  const [sort, setSort] = useState<ListSort>('POPULAR');
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['lists', sort],
    queryFn: () => api.browseLists({ sort }),
    placeholderData: keepPreviousData,
  });

  const lists = data?.lists ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <SectionHeader
        title="Lists"
        right={isFetching ? <Spinner className="h-4 w-4" /> : undefined}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded border border-border bg-surface p-0.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={cn(
                'rounded px-3 py-1.5 font-cond text-[12px] font-bold uppercase tracking-wide transition-colors',
                sort === s.key ? 'bg-gold text-ink' : 'text-muted hover:text-content',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + New list
        </Button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : lists.length === 0 ? (
          <EmptyState
            title="No public lists yet"
            body="Lists are a way to group films — a top ten, a marathon, a themed collection."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Create the first one
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((l) => (
              <ListCard key={l.id} list={l} />
            ))}
          </div>
        )}
      </div>

      {creating && <CreateListModal onClose={() => setCreating(false)} />}
    </div>
  );
}

export function CreateListModal({ onClose }: { onClose: () => void }): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const mut = useMutation({
    mutationFn: () =>
      api.createList({ title, description: description || null, isPublic }),
    onSuccess: (list) => {
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
      onClose();
      navigate(`/lists/${list.id}`);
    },
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/85 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create a list"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-soft"
      >
        <h2 className="mb-4 font-cond text-lg font-extrabold uppercase tracking-tight">
          New list
        </h2>
        <div className="space-y-4">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              placeholder="e.g. Best of the 1970s"
              autoFocus
            />
          </Field>
          <Field label="Description" hint="optional">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-content placeholder:text-muted-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan/50"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Visible to everyone
          </label>

          {mut.isError && (
            <p className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
              {mut.error instanceof ApiError ? mut.error.message : 'Could not create the list'}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!title.trim() || mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? 'Creating…' : 'Create list'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
