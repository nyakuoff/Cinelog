import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import type { MediaDetail, TrackingStatus } from '@cinelog/contracts';
import { fromNormalized } from '@cinelog/contracts';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Button, Card, Spinner } from '../components/ui';
import { StatusPicker } from '../components/StatusPicker';
import { RatingWidget } from '../components/RatingWidget';
import { cn } from '../lib/cn';

export function MediaDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const scale = user?.ratingScale ?? 'TEN';
  const queryClient = useQueryClient();

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
  const watchlistMut = useMutation({
    mutationFn: (value: boolean) => api.setWatchlist({ mediaId: id }, value),
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

  return (
    <div className="-mx-4 -mt-8 sm:-mx-6">
      {/* Backdrop hero */}
      <div className="relative">
        {m.backdropUrl && (
          <div className="absolute inset-0 h-72 overflow-hidden sm:h-96">
            <img src={m.backdropUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/30" />
          </div>
        )}
        <div className="relative mx-auto max-w-6xl px-4 pt-28 sm:px-6 sm:pt-56">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="w-32 shrink-0 sm:w-48">
              <div className="aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface-2 shadow-soft">
                {m.posterUrl && (
                  <img src={m.posterUrl} alt={m.title} className="h-full w-full object-cover" />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="text-3xl font-semibold tracking-tight">{m.title}</h1>
              {m.tagline && <p className="mt-1 italic text-muted">{m.tagline}</p>}
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
      <div className="mx-auto mt-8 grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {m.overview && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">Overview</h2>
              <p className="leading-relaxed text-content/90">{m.overview}</p>
            </section>
          )}

          {m.cast.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Cast</h2>
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

            <div className="flex gap-2">
              <ToggleButton
                active={state.isWatchlisted}
                onClick={() => watchlistMut.mutate(!state.isWatchlisted)}
              >
                {state.isWatchlisted ? 'On Watchlist' : 'Watchlist'}
              </ToggleButton>
              <ToggleButton
                active={state.isFavorite}
                onClick={() => favoriteMut.mutate(!state.isFavorite)}
              >
                {state.isFavorite ? '★ Favorite' : '☆ Favorite'}
              </ToggleButton>
            </div>

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
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 rounded-xl border px-3 py-2 text-sm font-medium',
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border bg-surface-2 text-muted hover:text-content',
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
