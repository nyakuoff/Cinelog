import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import type { MediaDetail, TrackingStatus } from '@cinelog/contracts';
import { fromNormalized, scaleForMediaType } from '@cinelog/contracts';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Button, Card, Spinner } from '../components/ui';
import { StatusPicker } from '../components/StatusPicker';
import { RatingWidget } from '../components/RatingWidget';
import { EpisodesSection } from '../components/EpisodesSection';
import { ArtworkPickerModal } from '../components/ArtworkPickerModal';
import { RematchModal } from '../components/RematchModal';
import { EditCastModal } from '../components/EditCastModal';
import { cn } from '../lib/cn';

export function MediaDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editingArtwork, setEditingArtwork] = useState(false);
  const [fixingMismatch, setFixingMismatch] = useState(false);
  const [editingCast, setEditingCast] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['media', id],
    queryFn: () => api.getMedia(id),
    enabled: id.length > 0,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['media', id] });
    void queryClient.invalidateQueries({ queryKey: ['library'] });
  };

  const statusMut = useMutation({
    mutationFn: (status: TrackingStatus | null) => api.setStatus({ mediaId: id }, status),
    onSuccess: invalidate,
  });
  const favoriteMut = useMutation({
    mutationFn: (value: boolean) => api.setFavorite({ mediaId: id }, value),
    onSuccess: invalidate,
  });
  const ratingMut = useMutation({
    mutationFn: (value: number | null) => api.setRating({ mediaId: id }, value),
    onSuccess: invalidate,
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const m = data;
  const state = m.userState;
  const isEpisodic = m.type !== 'MOVIE' && m.type !== 'SPECIAL';
  const scale = scaleForMediaType(m.type);

  return (
    <div className="pb-16">
      {/* Backdrop hero */}
      <div className="relative">
        {m.backdropUrl && (
          <div className="absolute inset-0 h-[440px] overflow-hidden sm:h-[600px]">
            <img src={m.backdropUrl} alt="" className="h-full w-full object-cover object-top" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/20" />
          </div>
        )}
        <div className="relative mx-auto max-w-6xl px-4 pt-44 sm:px-6 sm:pt-80">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="group relative w-32 shrink-0 sm:w-48">
              <div className="aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface-2 shadow-soft">
                {m.posterUrl && (
                  <img src={m.posterUrl} alt={m.title} className="h-full w-full object-cover" />
                )}
              </div>
              <button
                onClick={() => setEditingArtwork(true)}
                title="Edit artwork"
                className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full border border-border-hi bg-black/70 text-content opacity-80 backdrop-blur transition-opacity hover:bg-black/85 hover:opacity-100 sm:h-9 sm:w-9"
              >
                ✎
              </button>
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex items-start justify-between gap-3">
                <h1 className="font-cond text-4xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-5xl">
                  {m.title}
                </h1>
                <button
                  onClick={() => setFixingMismatch(true)}
                  title="Not the right title? Fix mismatch"
                  className="mt-1 shrink-0 whitespace-nowrap rounded-lg border border-border-hi bg-black/40 px-2.5 py-1 text-xs text-muted backdrop-blur transition-colors hover:border-cyan hover:text-cyan"
                >
                  Wrong title?
                </button>
              </div>
              {m.tagline && <p className="mt-2 italic text-muted">{m.tagline}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
                {m.releaseDate && <span>{m.releaseDate.slice(0, 4)}</span>}
                {m.runtime && <span>· {formatRuntime(m.runtime)}</span>}
                {m.providerRating !== null && (
                  <span className="text-accent">
                    · ★ {(m.providerRating / 10).toFixed(1)}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.genres.map((g) => (
                  <Badge key={g.id}>{g.name}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto mt-8 grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          {m.overview && (
            <section>
              <h2 className="mb-2 font-cond text-[15px] font-extrabold uppercase tracking-[0.08em] text-muted">
                Overview
              </h2>
              <p className="leading-relaxed text-content/90">{m.overview}</p>
            </section>
          )}

          {(m.cast.length > 0 || user?.role === 'ADMIN') && (
            <section>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="font-cond text-[15px] font-extrabold uppercase tracking-[0.08em] text-muted">
                  Cast
                </h2>
                {user?.role === 'ADMIN' && (
                  <button
                    onClick={() => setEditingCast(true)}
                    className="rounded-lg border border-border-hi bg-black/40 px-2.5 py-1 text-xs text-muted backdrop-blur transition-colors hover:border-cyan hover:text-cyan"
                  >
                    Edit cast
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {m.cast.slice(0, 9).map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-surface-2">
                      {c.profileUrl && (
                        <img src={c.profileUrl} alt={c.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      {c.character && (
                        <p className="truncate text-xs text-muted">{c.character}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {isEpisodic && <EpisodesSection mediaId={id} scale={scale} />}
        </div>

        {/* Interaction panel */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-5 p-5">
            <div>
              <p className="mb-2 text-sm font-medium text-muted">Status</p>
              <StatusPicker
                value={state.status}
                onChange={(s) => statusMut.mutate(s)}
                className="w-full"
              />
            </div>

            <ToggleButton
              active={state.isFavorite}
              tone="rose"
              onClick={() => favoriteMut.mutate(!state.isFavorite)}
            >
              {state.isFavorite ? '♥ Liked' : '♡ Like'}
            </ToggleButton>

            <div>
              <p className="mb-2 text-sm font-medium text-muted">Your rating</p>
              <RatingWidget
                value={state.rating}
                scale={scale}
                onChange={(v) => ratingMut.mutate(v)}
              />
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => api.markWatched({ mediaId: id }).then(invalidate)}
            >
              Mark watched today
            </Button>

            <RatingSummary media={m} />
          </Card>
        </aside>
      </div>

      {editingArtwork && (
        <ArtworkPickerModal mediaId={id} onClose={() => setEditingArtwork(false)} />
      )}
      {fixingMismatch && (
        <RematchModal
          mediaId={id}
          currentTitle={m.title}
          onClose={() => setFixingMismatch(false)}
        />
      )}
      {editingCast && (
        <EditCastModal mediaId={id} cast={m.cast} onClose={() => setEditingCast(false)} />
      )}
    </div>
  );
}

function ToggleButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: 'cyan' | 'rose';
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  const activeTone =
    tone === 'cyan' ? 'border-cyan bg-cyan/15 text-cyan' : 'border-rose bg-rose/15 text-rose';
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
        active ? activeTone : 'border-border bg-surface-2 text-muted hover:text-content',
      )}
    >
      {children}
    </button>
  );
}

function RatingSummary({ media }: { media: MediaDetail }): JSX.Element | null {
  if (media.communityRating === null && media.providerRating === null) return null;
  return (
    <div className="border-t border-border pt-4 text-sm">
      {media.communityRating !== null && (
        <div className="flex justify-between">
          <span className="text-muted">Community</span>
          <span className="font-medium">{fromNormalized(media.communityRating, 'TEN')}/10</span>
        </div>
      )}
      {media.providerRating !== null && (
        <div className="mt-1 flex justify-between">
          <span className="text-muted">Provider</span>
          <span className="font-medium">{(media.providerRating / 10).toFixed(1)}/10</span>
        </div>
      )}
    </div>
  );
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
