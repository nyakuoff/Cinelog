import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RatingScale, SeasonWithEpisodes } from '@cinelog/contracts';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { ratingColor, to10 } from '../lib/ratingColor';
import { StarInput } from './RatingWidget';
import { Spinner } from './ui';

type Order = 'oldest' | 'newest';

export function EpisodesSection({
  mediaId,
  scale,
}: {
  mediaId: string;
  scale: RatingScale;
}): JSX.Element | null {
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<Order>('oldest');

  const { data, isLoading } = useQuery({
    queryKey: ['episodes', mediaId],
    queryFn: () => api.getEpisodes(mediaId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['episodes', mediaId] });
  const rateMut = useMutation({
    mutationFn: ({ episodeId, value }: { episodeId: string; value: number | null }) =>
      api.rateEpisode(episodeId, value),
    onSuccess: invalidate,
  });
  const clearSeasonMut = useMutation({
    mutationFn: (seasonNumber: number) => api.clearSeasonRatings(mediaId, seasonNumber),
    onSuccess: invalidate,
  });

  const seasons = data?.seasons ?? [];
  const totalEpisodes = seasons.reduce((s, x) => s + x.episodeCount, 0);
  const ordered = useMemo(
    () => (order === 'newest' ? [...seasons].reverse() : seasons),
    [seasons, order],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  if (seasons.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <h2 className="font-cond text-[15px] font-extrabold uppercase tracking-[0.08em] text-muted">
          Ratings by episode
        </h2>
        <span className="text-sm tabular-nums text-muted-2">{totalEpisodes}</span>
        {data?.showAverage != null && (
          <span className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted-2">Show average</span>
            <span className="rounded-md bg-gold px-2 py-0.5 font-cond text-sm font-extrabold tabular-nums text-ink">
              {to10(data.showAverage)}
            </span>
          </span>
        )}
      </div>

      {/* Sort toggle */}
      <div className="mb-5 flex items-center gap-3">
        <span className="font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">
          Sort by
        </span>
        <div className="flex gap-1.5">
          {(['oldest', 'newest'] as Order[]).map((o) => (
            <button
              key={o}
              onClick={() => setOrder(o)}
              className={cn(
                'rounded-full border px-3.5 py-1 text-sm capitalize transition-colors',
                order === o
                  ? 'border-cyan bg-cyan/15 text-cyan'
                  : 'border-border text-muted hover:text-content',
              )}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <RatingsGrid seasons={ordered} />

      {/* Per-season episode lists */}
      <div className="mt-8 space-y-3">
        {ordered.map((season) => (
          <SeasonPanel
            key={season.seasonNumber}
            season={season}
            scale={scale}
            defaultOpen={ordered[0]?.seasonNumber === season.seasonNumber}
            onRate={(episodeId, value) => rateMut.mutate({ episodeId, value })}
            onClearSeason={() => clearSeasonMut.mutate(season.seasonNumber)}
          />
        ))}
      </div>
    </section>
  );
}

// -------------------------------------------------------------------------

function RatingsGrid({ seasons }: { seasons: SeasonWithEpisodes[] }): JSX.Element {
  const maxEp = Math.max(1, ...seasons.flatMap((s) => s.episodes.map((e) => e.episodeNumber)));
  const cols = Array.from({ length: maxEp }, (_, i) => i + 1);
  // Thin out the episode header labels on very long seasons so they stay legible.
  const labelEvery = maxEp > 26 ? 5 : maxEp > 16 ? 2 : 1;

  return (
    <div className="min-w-0 overflow-x-auto pb-1">
      <div
        className="grid w-max gap-1 text-center"
        style={{ gridTemplateColumns: `2rem repeat(${maxEp}, 2.15rem)` }}
      >
        <div />
        {cols.map((c) => (
          <div key={c} className="pb-1 font-cond text-[11px] font-bold uppercase tracking-wide text-muted-2">
            {c % labelEvery === 0 || c === 1 ? c : ''}
          </div>
        ))}
        {seasons.map((season) => (
          <GridRow key={season.seasonNumber} season={season} cols={cols} />
        ))}
      </div>
    </div>
  );
}

function GridRow({ season, cols }: { season: SeasonWithEpisodes; cols: number[] }): JSX.Element {
  const byNumber = new Map(season.episodes.map((e) => [e.episodeNumber, e]));
  return (
    <>
      <div className="flex items-center justify-end pr-1 font-cond text-xs font-bold uppercase text-muted-2">
        S{season.seasonNumber}
      </div>
      {cols.map((c) => {
        const ep = byNumber.get(c);
        if (!ep) return <div key={c} />;
        if (ep.rating == null) {
          return (
            <div
              key={c}
              className="h-8 rounded bg-surface-2/40"
              title={epTitle(ep.episodeNumber, ep.name)}
            />
          );
        }
        const { bg, fg } = ratingColor(ep.rating);
        return (
          <div
            key={c}
            className="grid h-8 place-items-center rounded font-cond text-[13px] font-extrabold tabular-nums"
            style={{ background: bg, color: fg }}
            title={`${epTitle(ep.episodeNumber, ep.name)} — ${to10(ep.rating)}`}
          >
            {to10(ep.rating)}
          </div>
        );
      })}
    </>
  );
}

function SeasonPanel({
  season,
  scale,
  defaultOpen,
  onRate,
  onClearSeason,
}: {
  season: SeasonWithEpisodes;
  scale: RatingScale;
  defaultOpen: boolean;
  onRate: (episodeId: string, value: number | null) => void;
  onClearSeason: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const hasRatings = season.averageRating != null;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/50"
      >
        <span className={cn('text-muted-2 transition-transform', open && 'rotate-90')}>›</span>
        <span className="font-cond text-base font-extrabold uppercase tracking-tight">
          {season.name ?? `Season ${season.seasonNumber}`}
        </span>
        <span className="text-xs text-muted-2">{season.episodeCount} episodes</span>
        {hasRatings && (
          <span className="ml-auto flex items-center gap-2">
            <span className="rounded-md bg-gold/15 px-2 py-0.5 font-cond text-sm font-extrabold tabular-nums text-gold">
              ★ {to10(season.averageRating!)}
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClearSeason();
              }}
              className="rounded-md px-2 py-0.5 text-xs text-muted-2 hover:bg-surface-2 hover:text-rose"
            >
              Clear
            </span>
          </span>
        )}
      </button>
      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {season.episodes.map((ep) => (
            <li key={ep.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-8 shrink-0 text-center font-cond text-sm font-bold tabular-nums text-muted-2">
                {ep.episodeNumber}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-content">{ep.name ?? `Episode ${ep.episodeNumber}`}</p>
                {ep.airDate && <p className="text-xs tabular-nums text-muted-2">{ep.airDate}</p>}
              </div>
              <StarInput value={ep.rating} scale={scale} size={14} onChange={(v) => onRate(ep.id, v)} />
              <button
                onClick={() => onRate(ep.id, null)}
                aria-label="Clear rating"
                className={cn(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-2 transition-opacity hover:bg-surface-2 hover:text-rose',
                  ep.rating == null && 'invisible',
                )}
                title="Clear rating"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function epTitle(n: number, name: string | null): string {
  return name ? `E${n} · ${name}` : `Episode ${n}`;
}
