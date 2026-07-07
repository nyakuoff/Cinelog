import { fromNormalized, type MediaType, type RatingScale } from '@cinelog/contracts';
import { cn } from '../lib/cn';

const TYPE_LABELS: Record<MediaType, string> = {
  MOVIE: 'Movie',
  TV: 'TV',
  ANIME: 'Anime',
  CARTOON: 'Cartoon',
  DOCUMENTARY: 'Documentary',
  MINISERIES: 'Mini-series',
  SPECIAL: 'Special',
};

interface Props {
  title: string;
  year?: number | null;
  type?: MediaType;
  posterUrl?: string | null;
  /** Normalized 0..100 personal rating, shown as a badge if present. */
  rating?: number | null;
  ratingScale?: RatingScale;
  onClick?: () => void;
}

export function PosterCard({
  title,
  year,
  type,
  posterUrl,
  rating,
  ratingScale = 'TEN',
  onClick,
}: Props): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col text-left focus:outline-none"
    >
      <div
        className={cn(
          'relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-border bg-surface-2',
          'shadow-soft transition-transform duration-150 group-hover:-translate-y-1',
          'group-focus-visible:ring-2 group-focus-visible:ring-accent',
        )}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-muted">
            {title}
          </div>
        )}
        {rating !== null && rating !== undefined && (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-accent backdrop-blur">
            {fromNormalized(rating, ratingScale)}
          </span>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="truncate text-sm font-medium text-content group-hover:text-accent">
          {title}
        </p>
        <p className="text-xs text-muted">
          {[type ? TYPE_LABELS[type] : null, year].filter(Boolean).join(' · ')}
        </p>
      </div>
    </button>
  );
}
