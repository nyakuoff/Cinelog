import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ListDetail, ListSort } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { EmptyState, PageHeader } from '../components/lb';
import { ListCard } from '../components/ListCard';
import { Dialog } from '../components/Dialog';
import { Button, Checkbox, Input, Notice, Segmented, Spinner, Textarea } from '../components/ui';
import { Field } from '../components/Field';

const SORTS: { value: ListSort; label: string }[] = [
  { value: 'POPULAR', label: 'Popular' },
  { value: 'UPDATED', label: 'Recently updated' },
  { value: 'RECENT', label: 'Newest' },
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
    <div className="mx-auto max-w-6xl px-4 py-8 app:py-4 sm:px-6">
      <PageHeader
        title="Lists"
        actions={
          <>
            {isFetching && !isLoading && <Spinner className="h-4 w-4" />}
            <Segmented label="Sort lists" value={sort} onChange={setSort} options={SORTS} />
            <Button variant="primary" onClick={() => setCreating(true)}>
              New list
            </Button>
          </>
        }
      />

      {isLoading ? (
        <Spinner center />
      ) : lists.length === 0 ? (
        <EmptyState
          title="No public lists yet"
          body="Lists group titles — a top ten, a marathon, a themed collection."
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

      {creating && <CreateListModal onClose={() => setCreating(false)} />}
    </div>
  );
}

export function CreateListModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  /** Runs instead of opening the new list (e.g. "Add to lists" on a title). */
  onCreated?: (list: ListDetail) => Promise<void> | void;
}): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isRanked, setIsRanked] = useState(false);

  const mut = useMutation({
    mutationFn: async () => {
      const list = await api.createList({
        title,
        description: description || null,
        isPublic,
        isRanked,
      });
      await onCreated?.(list);
      return list;
    },
    onSuccess: (list) => {
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
      void queryClient.invalidateQueries({ queryKey: ['user-lists'] });
      onClose();
      if (!onCreated) navigate(`/lists/${list.id}`);
    },
  });

  return (
    <Dialog
      title="New list"
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
            {mut.isPending ? 'Creating…' : 'Create list'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder="e.g. Best of the 1970s"
            data-autofocus
          />
        </Field>
        <Field label="Description" hint="optional">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
            rows={3}
          />
        </Field>
        <Checkbox checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)}>
          Visible to everyone
        </Checkbox>
        <Checkbox checked={isRanked} onChange={(e) => setIsRanked(e.target.checked)}>
          Ranked list — show position numbers
        </Checkbox>
        {mut.isError && (
          <Notice>
            {mut.error instanceof ApiError ? mut.error.message : 'Could not create the list'}
          </Notice>
        )}
      </div>
    </Dialog>
  );
}
