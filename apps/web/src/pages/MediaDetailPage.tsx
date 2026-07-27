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
import { ReviewsSection } from '../components/ReviewsSection';
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
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Poster column: poster, then the Letterboxd-style icon action row
                directly beneath it (watched / like / watchlist / rate), which is
                the primary way a viewer interacts with a title. */}
            <div className="w-32 shrink-0 sm:w-48">
              <div className="group relative">
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

              <PosterActionRow
                state={state}
                onToggleWatched={() => api.markWatched({ mediaId: id }).then(invalidate)}
                onToggleFavorite={() => favoriteMut.mutate(!state.isFavorite)}
                onToggleWatchlist={() =>
                  api.setWatchlist({ mediaId: id }, !state.isWatchlisted).then(invalidate)
                }
              />

              <div className="mt-3">
                <RatingWidget value={state.rating} scale={scale} onChange={(v) => ratingMut.mutate(v)} />
              </div>

              <div className="mt-3">
                <StatusPicker value={state.status} onChange={(s) => statusMut.mutate(s)} className="w-full" />
              </div>
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

              {/* Community rating: number + histogram, surfaced right under the
                  title block rather than buried in the sidebar — this is the
                  first thing a Letterboxd film page shows after the header. */}
              <div className="mt-6 max-w-md">
                <RatingHistogramCard media={m} />
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

          <ReviewsSection mediaId={id} scale={scale} />
        </div>

        {/* Secondary panel — supplementary info only; the primary actions
            (watched/like/watchlist/rate/status) live in the poster column. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Rewatched</span>
              <span className="font-semibold tabular-nums text-content">{state.rewatchCount}×</span>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => api.markWatched({ mediaId: id, isRewatch: true }).then(invalidate)}
            >
              Log a rewatch
            </Button>
            {m.providerRating !== null && (
              <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted">Provider rating</span>
                <span className="font-medium">{(m.providerRating / 10).toFixed(1)}/10</span>
              </div>
            )}
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

/** The Letterboxd-signature icon row directly under a poster: watched, like,
 *  watchlist. (Rating lives just below this, as its own widget — Letterboxd
 *  puts the star row here too, but ours needs more horizontal room.) */
function PosterActionRow({
  state,
  onToggleWatched,
  onToggleFavorite,
  onToggleWatchlist,
}: {
  state: MediaDetail['userState'];
  onToggleWatched: () => void;
  onToggleFavorite: () => void;
  onToggleWatchlist: () => void;
}): JSX.Element {
  const watched = state.status === 'COMPLETED';
  return (
    <div className="mt-3 flex items-center justify-between gap-1 rounded-xl border border-border bg-surface-2 px-2 py-2">
      <ActionIcon label={watched ? 'Watched' : 'Mark watched'} active={watched} tone="cyan" onClick={onToggleWatched}>
        {watched ? '✓' : '👁'}
      </ActionIcon>
      <ActionIcon label={state.isFavorite ? 'Liked' : 'Like'} active={state.isFavorite} tone="rose" onClick={onToggleFavorite}>
        {state.isFavorite ? '♥' : '♡'}
      </ActionIcon>
      <ActionIcon
        label={state.isWatchlisted ? 'On watchlist' : 'Add to watchlist'}
        active={state.isWatchlisted}
        tone="gold"
        onClick={onToggleWatchlist}
      >
        {state.isWatchlisted ? '🔖' : '＋'}
      </ActionIcon>
    </div>
  );
}

function ActionIcon({
  label,
  active,
  tone,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  tone: 'cyan' | 'rose' | 'gold';
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  const activeTone =
    tone === 'cyan'
      ? 'text-cyan'
      : tone === 'rose'
        ? 'text-rose'
        : 'text-gold';
  return (
    <button
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className={cn(
        'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-lg transition-colors hover:bg-surface',
        active ? activeTone : 'text-muted',
      )}
    >
      <span aria-hidden="true">{children}</span>
      <span className="text-[9px] font-medium uppercase tracking-wide">{label.split(' ')[0]}</span>
    </button>
  );
}

/** Big average number + 10-bucket histogram — the first thing after the
 *  title on a Letterboxd film page, not a buried sidebar line item. */
function RatingHistogramCard({ media }: { media: MediaDetail }): JSX.Element | null {
  if (media.ratingCount === 0) return null;
  const max = Math.max(1, ...media.ratingDistribution.map((b) => b.count));
  return (
    <div className="flex items-end gap-4">
      <div>
        <p className="font-cond text-3xl font-extrabold tabular-nums text-gold">
          {fromNormalized(media.communityRating ?? 0, 'TEN')}
        </p>
        <p className="text-xs text-muted-2">
          {media.ratingCount} rating{media.ratingCount === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex h-10 flex-1 items-end gap-[3px]">
        {media.ratingDistribution.map((b) => (
          <div
            key={b.bucket}
            className="flex-1 rounded-t bg-gradient-to-t from-gold/40 to-gold"
            style={{ height: `${Math.max(6, (b.count / max) * 100)}%` }}
            title={`${b.count} rating${b.count === 1 ? '' : 's'}`}
          />
        ))}
      </div>
    </div>
  );
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
