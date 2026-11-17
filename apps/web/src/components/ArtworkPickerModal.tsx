import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ArtworkKind } from '@cinelog/contracts';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { IconCheck } from './app/Icons';
import { Dialog } from './Dialog';
import { Button, Segmented, Spinner } from './ui';

interface Props {
  mediaId: string;
  onClose: () => void;
}

const TABS: { value: ArtworkKind; label: string }[] = [
  { value: 'POSTER', label: 'Poster' },
  { value: 'BACKDROP', label: 'Backdrop' },
];

/**
 * Artwork picker for your own library.
 *
 * A choice here is yours: it changes how the title looks in your library, and
 * to anyone browsing your profile, but never on the title's own page and never
 * in anyone else's library. That's why this is only reachable from your
 * library — see MediaDetailPage.
 */
export function ArtworkPickerModal({ mediaId, onClose }: Props): JSX.Element {
  const [kind, setKind] = useState<ArtworkKind>('POSTER');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['artwork-options', mediaId],
    queryFn: () => api.getArtworkOptions(mediaId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['artwork-options', mediaId] });
    void queryClient.invalidateQueries({ queryKey: ['media', mediaId] });
    void queryClient.invalidateQueries({ queryKey: ['library'] });
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
  };
  const applyMut = useMutation({
    mutationFn: (sourceUrl: string) => api.setArtwork(mediaId, kind, sourceUrl),
    onSuccess: invalidate,
  });
  const resetMut = useMutation({
    mutationFn: () => api.setArtwork(mediaId, kind, null),
    onSuccess: invalidate,
  });

  const choices = data ? (kind === 'POSTER' ? data.posters : data.backdrops) : [];
  const selected = data
    ? kind === 'POSTER'
      ? data.currentPosterUrl
      : data.currentBackdropUrl
    : null;
  const hasOverride = data
    ? kind === 'POSTER'
      ? data.hasPosterOverride
      : data.hasBackdropOverride
    : false;
  const busy = applyMut.isPending || resetMut.isPending;

  return (
    <Dialog
      title="Change artwork"
      size="lg"
      onClose={onClose}
      toolbar={<Segmented label="Artwork kind" value={kind} onChange={setKind} options={TABS} />}
      footer={
        <>
          <p className="mr-auto text-xs text-muted-2">
            Changes it in your library, not on this title&rsquo;s own page.
          </p>
          {hasOverride && (
            <Button size="sm" disabled={busy} onClick={() => resetMut.mutate()}>
              Reset to default
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {isLoading ? (
        <Spinner center />
      ) : choices.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          No alternate {kind === 'POSTER' ? 'posters' : 'backdrops'} are available for this title.
        </p>
      ) : (
        <div
          className={cn(
            'grid gap-3',
            kind === 'POSTER' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3',
          )}
        >
          {choices.map((c) => {
            const isSelected = c.sourceUrl === selected;
            return (
              <button
                key={c.sourceUrl}
                disabled={busy}
                onClick={() => applyMut.mutate(c.sourceUrl)}
                className={cn(
                  'group relative overflow-hidden rounded-sm border-2 bg-surface-2 transition-colors disabled:opacity-60',
                  kind === 'POSTER' ? 'aspect-[2/3]' : 'aspect-video',
                  isSelected ? 'border-gold' : 'border-transparent hover:border-border-hi',
                )}
              >
                <img
                  src={c.previewUrl}
                  alt=""
                  decoding="async"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {isSelected && (
                  <span className="absolute right-0 top-0 grid h-5 w-5 place-items-center bg-gold text-ink">
                    <IconCheck className="h-3 w-3" />
                  </span>
                )}
                {c.language && (
                  <span className="absolute bottom-1.5 left-1.5 rounded-sm bg-bg-2/90 px-1.5 py-0.5 font-data text-[11px] uppercase text-muted">
                    {c.language}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}
