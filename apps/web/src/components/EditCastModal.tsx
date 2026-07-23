import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreditPerson } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { Button, Input } from './ui';

interface Props {
  mediaId: string;
  cast: CreditPerson[];
  onClose: () => void;
}

type Draft = Omit<CreditPerson, 'id'>;

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

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit cast"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-soft"
      >
        <div className="flex items-center gap-3 border-b border-border p-4">
          <h2 className="font-cond text-lg font-extrabold uppercase tracking-tight">Edit cast</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-content"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-border p-4">
          <p className="text-sm text-muted">
            This replaces the cast shown to every user on this title. Changes are saved
            separately from the provider's data, so they won't be lost if this title is later
            re-matched or refreshed.
          </p>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {saveMut.isError && (
            <p className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
              {saveMut.error instanceof ApiError ? saveMut.error.message : 'Something went wrong'}
            </p>
          )}

          {rows.map((row, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Name"
                  value={row.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                />
                <Input
                  placeholder="Character"
                  value={row.character ?? ''}
                  onChange={(e) => updateRow(i, { character: e.target.value || null })}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-content disabled:pointer-events-none disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-content disabled:pointer-events-none disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-xs text-muted hover:text-rose"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
          >
            + Add cast member
          </Button>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
