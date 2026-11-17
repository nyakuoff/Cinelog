import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListSummary } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { plural } from '../lib/format';
import { CreateListModal } from '../pages/ListsPage';
import { IconCheck, IconPlus } from './app/Icons';
import { Dialog } from './Dialog';
import { Button, Notice, Spinner } from './ui';

/**
 * "Add to lists…" on a title's page: the member's own lists, each ticked if
 * the title is already in it. Ticking adds, unticking removes.
 */
export function AddToListsDialog({
  mediaId,
  title,
  onClose,
}: {
  mediaId: string;
  title: string;
  onClose: () => void;
}): JSX.Element {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const username = user?.username ?? '';
  // Under the `user-lists` prefix, so every list mutation elsewhere refreshes it.
  const key = ['user-lists', username, 'entries', mediaId];

  const { data: lists, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => (await api.getUserLists(username, mediaId)).lists,
    enabled: !!username,
  });

  const toggle = useMutation({
    mutationFn: async (list: ListSummary) => {
      if (!list.containsMedia) return api.addListItem(list.id, { mediaId });
      // Removing needs the entry id, which only the detail carries.
      const detail = await api.getList(list.id);
      const entry = detail.entries.find((e) => e.media.id === mediaId);
      return entry ? api.removeListItem(list.id, entry.id) : detail;
    },
    onSuccess: (updated) => {
      const containsMedia = updated.entries.some((e) => e.media.id === mediaId);
      queryClient.setQueryData<ListSummary[]>(key, (old) =>
        old?.map((l) =>
          l.id === updated.id ? { ...l, containsMedia, itemCount: updated.itemCount } : l,
        ),
      );
      for (const queryKey of [['list', updated.id], ['lists'], ['media-lists', mediaId]]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  return (
    <Dialog
      title="Add to lists"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button className="mr-auto" onClick={() => setCreating(true)}>
            <IconPlus className="h-4 w-4" /> New list…
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {toggle.isError && (
        <Notice className="mb-3">
          {toggle.error instanceof ApiError ? toggle.error.message : 'Could not update that list'}
        </Notice>
      )}
      {isLoading ? (
        <Spinner center />
      ) : !lists || lists.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          You have no lists yet. Start one and <span className="text-content">{title}</span> goes
          straight in.
        </p>
      ) : (
        <ul className="-mx-2">
          {lists.map((l) => {
            const inList = !!l.containsMedia;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={inList}
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate(l)}
                  className="flex min-h-[2.75rem] w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left hover:bg-surface-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                  <span
                    className={cn(
                      'grid h-5 w-5 shrink-0 place-items-center rounded-sm border',
                      inList ? 'border-gold bg-gold text-ink' : 'border-border-hi text-transparent',
                    )}
                  >
                    <IconCheck className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-content">{l.title}</span>
                  <span className="shrink-0 font-data text-[11px] text-muted-2">
                    {plural(l.itemCount, 'title')}
                    {!l.isPublic && ' · private'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {creating && (
        <CreateListModal
          onClose={() => setCreating(false)}
          // The new list exists to hold this title, so put it in.
          onCreated={async (list) => {
            await api.addListItem(list.id, { mediaId });
            void queryClient.invalidateQueries({ queryKey: ['media-lists', mediaId] });
          }}
        />
      )}
    </Dialog>
  );
}
