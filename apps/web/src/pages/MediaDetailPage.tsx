import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { MediaDetail, SearchResult, TrackingStatus } from '@cinelog/contracts';
import { fromNormalized, scaleForMediaType } from '@cinelog/contracts';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { Button, Spinner } from '../components/ui';
import { StatusPicker } from '../components/StatusPicker';
import { RatingWidget } from '../components/RatingWidget';
import { EpisodesSection } from '../components/EpisodesSection';
import { ArtworkPickerModal } from '../components/ArtworkPickerModal';
import { RematchModal } from '../components/RematchModal';
import { EditCastModal } from '../components/EditCastModal';
import { ReviewsSection } from '../components/ReviewsSection';
import { Poster, SectionHeader, TabBar } from '../components/lb';

type InfoTab = 'cast' | 'crew' | 'details' | 'genres';

export function MediaDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editingArtwork, setEditingArtwork] = useState(false);
  const [fixingMismatch, setFixingMismatch] = useState(false);
  const [editingCast, setEditingCast] = useState(false);
  const [infoTab, setInfoTab] = useState<InfoTab>('cast');

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
  const watchMut = useMutation({
    mutationFn: (isRewatch: boolean) => api.markWatched({ mediaId: id, isRewatch }),
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
  const directors = m.crew.filter((c) => c.role === 'Director' || c.role === 'Creator');

  const infoTabs = [
    { key: 'cast', label: 'Cast', count: m.cast.length || undefined },
    { key: 'crew', label: 'Crew', count: m.crew.length || undefined },
    { key: 'details', label: 'Details' },
    { key: 'genres', label: 'Genres' },
  ];

  return (
    <div className="pb-20">
      {/* Full-bleed backdrop fading into the page — the film's own image is the
          header, with the poster overlapping its lower edge. */}
      <div className="relative">
        {m.backdropUrl && (
          <div className="absolute inset-x-0 top-0 h-[380px] overflow-hidden sm:h-[520px]">
            <img src={m.backdropUrl} alt="" className="h-full w-full object-cover object-top" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/25" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent" />
          </div>
        )}

        <div
          className={cn(
            'relative mx-auto max-w-6xl px-4 sm:px-6',
            m.backdropUrl ? 'pt-56 sm:pt-80' : 'pt-10',
          )}
        >
          <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)_260px]">
            {/* Poster + action panel */}
            <div className="flex gap-5 lg:block">
              <div className="group relative w-28 shrink-0 sm:w-40 lg:w-full">
                <div className="aspect-[2/3] overflow-hidden rounded ring-1 ring-border-hi/60 shadow-soft">
                  {m.posterUrl && (
                    <img src={m.posterUrl} alt={m.title} className="h-full w-full object-cover" />
                  )}
                </div>
                <button
                  onClick={() => setEditingArtwork(true)}
                  title="Edit artwork"
                  className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full border border-border-hi bg-black/70 text-content opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus:opacity-100"
                >
                  ✎
                </button>
              </div>

              {/* On phones the panel sits beside the poster; from lg it stacks under it. */}
              <div className="min-w-0 flex-1 lg:mt-4">
                <ActionPanel
                  state={state}
                  scale={scale}
                  onWatch={() => watchMut.mutate(false)}
                  onLike={() => favoriteMut.mutate(!state.isFavorite)}
                  onWatchlist={() => watchlistMut.mutate(!state.isWatchlisted)}
                  onRate={(v) => ratingMut.mutate(v)}
                  onStatus={(s) => statusMut.mutate(s)}
                />
              </div>
            </div>

            {/* Main column */}
            <div className="min-w-0">
              {directors.length > 0 && (
                <p className="font-cond text-[12px] font-bold uppercase tracking-[0.16em] text-muted-2">
                  Directed by
                </p>
              )}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="font-cond text-4xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-5xl">
                  {m.title}
                </h1>
                {m.releaseDate && (
                  <span className="font-cond text-2xl font-bold tabular-nums text-muted">
                    {m.releaseDate.slice(0, 4)}
                  </span>
                )}
              </div>
              {directors.length > 0 && (
                <p className="mt-1 text-sm text-content/90">
                  {directors.map((d) => d.name).join(', ')}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                {m.runtime && <span className="tabular-nums">{formatRuntime(m.runtime)}</span>}
                {m.trailerUrl && (
                  <a
                    href={m.trailerUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-cyan hover:underline"
                  >
                    ▶ Trailer
                  </a>
                )}
                <button
                  onClick={() => setFixingMismatch(true)}
                  className="text-muted-2 underline-offset-2 hover:text-cyan hover:underline"
                >
                  Wrong title?
                </button>
              </div>

              {m.tagline && (
                <p className="mt-5 font-cond text-[13px] font-bold uppercase tracking-[0.14em] text-gold">
                  {m.tagline}
                </p>
              )}
              {m.overview && (
                <p className="mt-2 max-w-[62ch] leading-relaxed text-content/90">{m.overview}</p>
              )}

              <div className="mt-7">
                <TabBar
                  tabs={infoTabs}
                  active={infoTab}
                  onChange={(k) => setInfoTab(k as InfoTab)}
                />
                <div className="pt-4">
                  {infoTab === 'cast' && (
                    <CastGrid
                      people={m.cast}
                      emptyLabel="No cast recorded for this title."
                      canEdit={user?.role === 'ADMIN'}
                      onEdit={() => setEditingCast(true)}
                    />
                  )}
                  {infoTab === 'crew' && (
                    <CastGrid people={m.crew} emptyLabel="No crew recorded for this title." />
                  )}
                  {infoTab === 'details' && <DetailsList media={m} />}
                  {infoTab === 'genres' && (
                    <ChipRow
                      items={m.genres.map((g) => g.name)}
                      emptyLabel="No genres recorded."
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Right rail: community ratings + stats */}
            <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
              <RatingsPanel media={m} />
              <StatsPanel media={m} />
            </aside>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-6xl space-y-12 px-4 sm:px-6">
        {isEpisodic && <EpisodesSection mediaId={id} scale={scale} />}
        <ReviewsSection mediaId={id} scale={scale} />
        <SimilarSection mediaId={id} onOpenResolved={(mid) => navigate(`/media/${mid}`)} />
      </div>

      {editingArtwork && (
        <ArtworkPickerModal mediaId={id} onClose={() => setEditingArtwork(false)} />
      )}
      {fixingMismatch && (
        <RematchModal mediaId={id} currentTitle={m.title} onClose={() => setFixingMismatch(false)} />
      )}
      {editingCast && (
        <EditCastModal mediaId={id} cast={m.cast} onClose={() => setEditingCast(false)} />
      )}
    </div>
  );
}

/** The boxed action stack under the poster: watch / like / watchlist, then rate. */
function ActionPanel({
  state,
  scale,
  onWatch,
  onLike,
  onWatchlist,
  onRate,
  onStatus,
}: {
  state: MediaDetail['userState'];
  scale: ReturnType<typeof scaleForMediaType>;
  onWatch: () => void;
  onLike: () => void;
  onWatchlist: () => void;
  onRate: (value: number | null) => void;
  onStatus: (status: TrackingStatus | null) => void;
}): JSX.Element {
  const watched = state.status === 'COMPLETED' || state.rewatchCount > 0;
  return (
    <div className="rounded border border-border bg-surface/80 p-3">
      <div className="flex items-stretch justify-between gap-1">
        <PanelAction label="Watched" active={watched} tone="cyan" onClick={onWatch} icon="👁" />
        <PanelAction label="Like" active={state.isFavorite} tone="rose" onClick={onLike} icon={state.isFavorite ? '♥' : '♡'} />
        <PanelAction
          label="Watchlist"
          active={state.isWatchlisted}
          tone="gold"
          onClick={onWatchlist}
          icon={state.isWatchlisted ? '🔖' : '＋'}
        />
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-1.5 font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-muted-2">
          Your rating
        </p>
        <RatingWidget value={state.rating} scale={scale} onChange={onRate} />
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <StatusPicker value={state.status} onChange={onStatus} className="w-full" />
      </div>
    </div>
  );
}

function PanelAction({
  label,
  active,
  tone,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  tone: 'cyan' | 'rose' | 'gold';
  onClick: () => void;
  icon: string;
}): JSX.Element {
  const activeTone = tone === 'cyan' ? 'text-cyan' : tone === 'rose' ? 'text-rose' : 'text-gold';
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex flex-1 flex-col items-center gap-1 rounded px-1 py-2 transition-colors hover:bg-surface-2',
        active ? activeTone : 'text-muted',
      )}
    >
      <span aria-hidden="true" className="text-lg leading-none">
        {icon}
      </span>
      <span className="font-cond text-[10px] font-bold uppercase tracking-[0.08em]">{label}</span>
    </button>
  );
}

/** Community rating average + distribution histogram. */
function RatingsPanel({ media }: { media: MediaDetail }): JSX.Element {
  const max = Math.max(1, ...media.ratingDistribution.map((b) => b.count));
  return (
    <div>
      <SectionHeader title="Ratings" />
      {media.ratingCount === 0 ? (
        <p className="text-sm text-muted-2">
          No ratings yet{media.providerRating !== null && ` · ${(media.providerRating / 10).toFixed(1)} on TMDB`}
        </p>
      ) : (
        <div className="flex items-end gap-3">
          <div className="shrink-0">
            <p className="font-cond text-3xl font-extrabold leading-none tabular-nums text-gold">
              {fromNormalized(media.communityRating ?? 0, 'TEN')}
            </p>
            <p className="mt-1 text-[11px] text-muted-2">
              {media.ratingCount} rating{media.ratingCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex h-12 flex-1 items-end gap-[2px]" aria-hidden="true">
            {media.ratingDistribution.map((b) => (
              <div
                key={b.bucket}
                className="flex-1 rounded-t bg-gradient-to-t from-gold/35 to-gold"
                style={{ height: `${Math.max(5, (b.count / max) * 100)}%` }}
                title={`${b.bucket}/10 — ${b.count} rating${b.count === 1 ? '' : 's'}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatsPanel({ media }: { media: MediaDetail }): JSX.Element {
  const rows = [
    { label: 'Watched by', value: media.watchedCount },
    { label: 'Liked by', value: media.likedCount },
    { label: 'Reviews', value: media.reviewCount },
  ];
  return (
    <div>
      <SectionHeader title="On Cinelog" />
      <dl className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">{r.label}</dt>
            <dd className="font-semibold tabular-nums text-content">{r.value}</dd>
          </div>
        ))}
        {media.providerRating !== null && (
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5">
            <dt className="text-muted">TMDB</dt>
            <dd className="font-semibold tabular-nums text-content">
              {(media.providerRating / 10).toFixed(1)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function CastGrid({
  people,
  emptyLabel,
  canEdit,
  onEdit,
}: {
  people: MediaDetail['cast'];
  emptyLabel: string;
  canEdit?: boolean;
  onEdit?: () => void;
}): JSX.Element {
  if (people.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-2">{emptyLabel}</p>
        {canEdit && onEdit && (
          <Button size="sm" variant="secondary" onClick={onEdit}>
            Edit cast
          </Button>
        )}
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {people.slice(0, 12).map((c) => (
          <div key={c.id} className="flex items-center gap-2.5">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface-2">
              {c.profileUrl && (
                <img src={c.profileUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-content">{c.name}</p>
              {(c.character || c.role) && (
                <p className="truncate text-xs text-muted-2">{c.character ?? c.role}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {canEdit && onEdit && (
        <Button size="sm" variant="secondary" className="mt-4" onClick={onEdit}>
          Edit cast
        </Button>
      )}
    </div>
  );
}

function DetailsList({ media }: { media: MediaDetail }): JSX.Element {
  const rows: { label: string; value: string }[] = [];
  if (media.originalTitle && media.originalTitle !== media.title) {
    rows.push({ label: 'Original title', value: media.originalTitle });
  }
  if (media.releaseDate) rows.push({ label: 'Released', value: media.releaseDate });
  if (media.runtime) rows.push({ label: 'Runtime', value: formatRuntime(media.runtime) });
  if (media.studios.length) rows.push({ label: 'Studios', value: media.studios.join(', ') });
  rows.push({ label: 'Type', value: media.type });

  return (
    <dl className="space-y-2 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
          <dt className="font-cond text-[12px] font-bold uppercase tracking-[0.1em] text-muted-2">
            {r.label}
          </dt>
          <dd className="text-content/90">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChipRow({ items, emptyLabel }: { items: string[]; emptyLabel: string }): JSX.Element {
  if (items.length === 0) return <p className="text-sm text-muted-2">{emptyLabel}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((g) => (
        <span
          key={g}
          className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted"
        >
          {g}
        </span>
      ))}
    </div>
  );
}

function SimilarSection({
  mediaId,
  onOpenResolved,
}: {
  mediaId: string;
  onOpenResolved: (id: string) => void;
}): JSX.Element | null {
  const [opening, setOpening] = useState(false);
  const { data } = useQuery({
    queryKey: ['similar', mediaId],
    queryFn: () => api.getSimilar(mediaId),
    staleTime: 1000 * 60 * 30,
  });

  // Rendered only when the provider actually returned neighbours — an empty
  // "Similar films" heading would just be dead weight.
  if (!data || data.results.length === 0) return null;

  async function open(result: SearchResult): Promise<void> {
    if (result.id) return onOpenResolved(result.id);
    setOpening(true);
    try {
      const detail = await api.resolveMedia({
        provider: result.provider,
        externalId: result.externalId,
        type: result.type,
      });
      onOpenResolved(detail.id);
    } finally {
      setOpening(false);
    }
  }

  return (
    <section>
      <SectionHeader title="Similar films" />
      {opening && (
        <div className="flex justify-center py-3">
          <Spinner className="h-4 w-4" />
        </div>
      )}
      <div className="grid grid-cols-3 gap-x-2.5 gap-y-4 sm:grid-cols-4 md:grid-cols-6">
        {data.results.map((r) => (
          <Poster
            key={`${r.provider}:${r.externalId}`}
            title={r.title}
            posterUrl={r.posterUrl}
            onClick={() => void open(r)}
          />
        ))}
      </div>
    </section>
  );
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
