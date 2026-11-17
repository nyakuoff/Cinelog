import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreditPerson } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { IconArrowDown, IconArrowUp } from './app/Icons';
import { Dialog } from './Dialog';
import { Button, Input, Notice } from './ui';

interface Props {
  mediaId: string;
  cast: CreditPerson[];
  onClose: () => void;
}

/** The editable fields. A hand-entered credit has no provider person id, which
 *  is why its name links through a name lookup rather than an id. */
type Draft = Omit<CreditPerson, 'id' | 'personId'>;

function emptyRow(): Draft {
  return { name: '', role: null, character: null, department: null, profileUrl: null };
}

export function EditCastModal({ mediaId, cast, onClose }: Props): JSX.Element {
  const [rows, setRows] = useState<Draft[]>(
    cast.length > 0
      ? cast.map((c) => ({
          name: c.name,
          role: c.role,
          character: c.character,
          department: c.department,
          profileUrl: c.profileUrl,
        }))
      : [emptyRow()],
  );
  const queryClient = useQueryClient();

  const saveMut = useMutation({
    mutationFn: () =>
      api.updateMediaCast(mediaId, {
        cast: rows
          .filter((r) => r.name.trim().length > 0)
          .map((r) => ({ ...r, name: r.name.trim() })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['media', mediaId] });
      onClose();
    },
  });

  function updateRow(i: number, patch: Partial<Draft>): void {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRow(i: number): void {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function move(i: number, dir: -1 | 1): void {
    setRows((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const a = next[i];
      const b = next[j];
      if (!a || !b) return prev;
      next[i] = b;
      next[j] = a;
      return next;
    });
  }

  return (
    <Dialog
      title="Edit cast"
      size="lg"
      onClose={onClose}
      toolbar={
        <p className="text-sm text-muted">
          This replaces the cast shown to every user on this title. Changes are saved separately
          from the provider's data, so they won't be lost if this title is later re-matched or
          refreshed.
        </p>
      }
      bodyClassName="space-y-3"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      {saveMut.isError && (
        <Notice>
          {saveMut.error instanceof ApiError ? saveMut.error.message : 'Something went wrong'}
        </Notice>
      )}

      {rows.map((row, i) => (
        <div key={i} className="rounded-sm border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Name"
              aria-label="Name"
              value={row.name}
              onChange={(e) => updateRow(i, { name: e.target.value })}
            />
            <Input
              placeholder="Character"
              aria-label="Character"
              value={row.character ?? ''}
              onChange={(e) => updateRow(i, { character: e.target.value || null })}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="!h-9 !w-9"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label="Move up"
              >
                <IconArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="!h-9 !w-9"
                disabled={i === rows.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Move down"
              >
                <IconArrowDown />
              </Button>
            </div>
            <Button variant="link" size="sm" onClick={() => removeRow(i)}>
              Remove
            </Button>
          </div>
        </div>
      ))}

      <Button variant="ghost" size="sm" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
        Add cast member
      </Button>
    </Dialog>
  );
}
