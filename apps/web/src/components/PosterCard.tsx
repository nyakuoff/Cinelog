import type { MediaType, RatingScale } from '@cinelog/contracts';
import { cn } from '../lib/cn';
import { PosterMarks } from './lb';
import { posterGradient } from '../lib/poster';

/**
 * The workhorse tile. Artwork is the content, so the tile stays flat and out
 * of its way: no lift, no glow, no gradient scrim competing with the poster's
 * own art direction. What the archive adds is classification — the medium's
 * stock label and your own rating, both struck on by PosterMarks, which is the
 * single source for those marks across every poster surface.
 */
interface Props {
  title: string;
  year?: number | null;
  type?: MediaType;
  posterUrl?: string | null;
  /** Normalized 0..100 personal rating. */
  rating?: number | null;
  ratingScale?: RatingScale;
  /** Tooltip naming whose rating this is. Defaults to the viewer's own. */
  ratingLabel?: string;
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
  ratingLabel,
  liked = false,
  onClick,
}: Props): JSX.Element {
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
            <span className="absolute inset-x-2.5 bottom-3 font-cond text-lg font-extrabold uppercase leading-none tracking-tight text-white/95">
              {title}
            </span>
          </div>
        )}

        <PosterMarks
          type={type}
          rating={rating}
          ratingScale={ratingScale}
          ratingLabel={ratingLabel}
          liked={liked}
        />
      </div>
    </button>
  );
}
