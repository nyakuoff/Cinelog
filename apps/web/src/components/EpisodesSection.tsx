import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RatingScale, SeasonWithEpisodes } from '@cinelog/contracts';
import { api } from '../lib/api';
import { invalidateUserMedia } from '../lib/invalidate';
import { cn } from '../lib/cn';
import { plural } from '../lib/format';
import { ratingColor } from '../lib/ratingColor';
import { IconChevronRight } from './app/Icons';
import { DateText, SectionHeader } from './lb';
import { formatRating, RatingMark, StarInput } from './Rating';
import { Button, Segmented, Spinner } from './ui';

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

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['episodes', mediaId] });
    invalidateUserMedia(queryClient, mediaId);
  };
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

  if (isLoading) return <Spinner center />;
  if (seasons.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title="Your ratings by episode"
        count={totalEpisodes}
        right={
          <Segmented
            label="Season order"
            value={order}
            onChange={setOrder}
            options={[
              { value: 'oldest', label: 'Oldest first' },
              { value: 'newest', label: 'Newest first' },
            ]}
          />
        }
      />

      {data?.showAverage != null && (
        <p className="mb-4 flex items-center gap-2.5 text-sm text-muted">
          Your average across seasons
          <RatingMark value={data.showAverage} scale={scale} display="number" average size={15} />
        </p>
      )}

      <RatingsGrid seasons={ordered} scale={scale} />

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

function RatingsGrid({
  seasons,
  scale,
}: {
  seasons: SeasonWithEpisodes[];
  scale: RatingScale;
}): JSX.Element {
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
          <div key={c} className="pb-1 font-data text-[11px] text-muted-2">
            {c % labelEvery === 0 || c === 1 ? c : ''}
          </div>
        ))}
        {seasons.map((season) => (
          <GridRow key={season.seasonNumber} season={season} cols={cols} scale={scale} />
        ))}
      </div>
    </div>
  );
}

function GridRow({
  season,
  cols,
  scale,
}: {
  season: SeasonWithEpisodes;
  cols: number[];
  scale: RatingScale;
}): JSX.Element {
  const byNumber = new Map(season.episodes.map((e) => [e.episodeNumber, e]));
  return (
    <>
      <div className="flex items-center justify-end pr-1 font-data text-[11px] text-muted-2">
        S{season.seasonNumber}
      </div>
      {cols.map((c) => {
        const ep = byNumber.get(c);
        if (!ep) return <div key={c} />;
        if (ep.rating == null) {
          return (
            <div
              key={c}
              className="h-8 rounded-sm bg-surface-2/40"
              title={epTitle(ep.episodeNumber, ep.name)}
            />
          );
        }
        const { bg, fg } = ratingColor(ep.rating);
        return (
          <div
            key={c}
            className="grid h-8 place-items-center rounded-sm font-data text-[13px] font-bold"
            style={{ background: bg, color: fg }}
            title={`${epTitle(ep.episodeNumber, ep.name)} — ${formatRating(ep.rating, scale)}`}
          >
            {formatRating(ep.rating, scale)}
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
    <div className="overflow-hidden rounded-sm border border-border bg-surface">
      {/* The clear control sits beside the disclosure button, not inside it:
          a button can't hold another button. */}
      <div className="flex items-center gap-2 pr-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-[2.75rem] min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-left hover:bg-surface-2/50"
        >
          <IconChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-2 transition-transform',
              open && 'rotate-90',
            )}
          />
          <span className="font-cond text-[15px] font-extrabold uppercase tracking-[0.04em]">
            {season.name ?? `Season ${season.seasonNumber}`}
          </span>
          <span className="font-data text-[11px] text-muted-2">
            {plural(season.episodeCount, 'episode')}
          </span>
        </button>
        {hasRatings && (
          <>
            <RatingMark value={season.averageRating!} scale={scale} display="number" average />
            <Button variant="link" size="sm" onClick={onClearSeason}>
              Clear
            </Button>
          </>
        )}
      </div>
      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {season.episodes.map((ep) => (
            /* Ten stars need the row to themselves on a phone — beside the
               title they'd be 14px each — so the row wraps there and the stars
               take the full width under the title. */
            <li key={ep.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2">
              <span className="w-6 shrink-0 text-right font-data text-[13px] font-bold text-muted-2">
                {ep.episodeNumber}
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate text-sm text-content">
                  {ep.name ?? `Episode ${ep.episodeNumber}`}
                </p>
                {ep.airDate && <DateText iso={ep.airDate} />}
              </div>
              <StarInput
                value={ep.rating}
                scale={scale}
                size="sm"
                label={`Your rating for episode ${ep.episodeNumber}`}
                onChange={(v) => onRate(ep.id, v)}
                className="w-full sm:w-[17.5rem]"
              />
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
