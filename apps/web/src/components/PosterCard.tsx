import { fromNormalized, type MediaType, type RatingScale } from '@cinelog/contracts';
import { cn } from '../lib/cn';
import { posterGradient } from '../lib/poster';

/**
 * The workhorse tile. Artwork is the content, so the tile stays flat and out
 * of its way: no lift, no glow, no gradient scrim competing with the poster's
 * own art direction. What the archive adds is classification — a stock label
 * for the medium, and the viewer's own rating struck into the corner as a
 * machine record.
 */
const TYPE_LABELS: Record<MediaType, string> = {
  MOVIE: 'Film',
  TV: 'Show',
  ANIME: 'Anime',
  CARTOON: 'Cartoon',
  DOCUMENTARY: 'Doc',
  MINISERIES: 'Mini',
  SPECIAL: 'Special',
};

interface Props {
  title: string;
  year?: number | null;
  type?: MediaType;
  posterUrl?: string | null;
  /** Normalized 0..100 personal rating. */
  rating?: number | null;
  ratingScale?: RatingScale;
  /** Show a mark when this title is liked. */
  liked?: boolean;
  /** Accepted for call-site compatibility; entrances are no longer staggered. */
  index?: number;
  onClick?: () => void;
}

export function PosterCard({
  title,
  year,
  type,
  posterUrl,
  rating,
  ratingScale = 'TEN',
  liked = false,
  onClick,
}: Props): JSX.Element {
  const hasRating = rating !== null && rating !== undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      title={year ? `${title} (${year})` : title}
      className="group flex w-full flex-col text-left focus:outline-none"
    >
      <div
        className={cn(
          'relative aspect-[2/3] w-full overflow-hidden rounded-sm bg-card',
          'ring-1 ring-border-hi/60',
          'transition-[box-shadow] duration-150',
          'group-hover:ring-2 group-hover:ring-gold group-focus-visible:ring-2 group-focus-visible:ring-gold',
        )}
      >
        {posterUrl ? (
          <img src={posterUrl} alt={title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: posterGradient(title) }}>
            <span className="absolute inset-x-2.5 bottom-3 font-cond text-[17px] font-extrabold uppercase leading-none tracking-tight text-white/95">
              {title}
            </span>
          </div>
        )}

        {type && (
          <span className="absolute left-0 top-0 bg-bg-2/90 px-1.5 py-[3px] font-cond text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-content/90">
            {TYPE_LABELS[type]}
          </span>
        )}

        {/* Your own marks, top right — the convention the library established.
            Typewritten, on a flat ink field, never a glowing chip. */}
        <div className="absolute right-0 top-0 flex items-stretch">
          {liked && (
            <span className="flex items-center bg-bg-2/90 px-1.5 text-[12px] leading-none text-rose">
              ♥
            </span>
          )}
          {hasRating && (
            <span className="flex items-center bg-gold px-1.5 py-[3px] font-data text-[11px] font-bold leading-none text-ink">
              {fromNormalized(rating, ratingScale)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
