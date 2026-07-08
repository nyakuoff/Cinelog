import { fromNormalized, type MediaType, type RatingScale } from '@cinelog/contracts';
import { cn } from '../lib/cn';
import { posterGradient } from '../lib/poster';

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
  /** Show a heart when this title is liked. */
  liked?: boolean;
  /** Reveal delay index for staggered fade-up on mount. */
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
  index = 0,
  onClick,
}: Props): JSX.Element {
  const hasRating = rating !== null && rating !== undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${(index % 12) * 40}ms` }}
      className="group flex w-full animate-fadeup flex-col text-left focus:outline-none"
    >
      <div
        className={cn(
          'relative aspect-[2/3] w-full overflow-hidden rounded-md bg-card shadow-soft',
          'outline outline-2 outline-offset-2 outline-transparent',
          'transition-[transform,box-shadow,outline-color] duration-200',
          'group-hover:-translate-y-1.5 group-hover:scale-[1.03] group-hover:outline-gold',
          'group-hover:shadow-glow-gold group-focus-visible:outline-gold',
        )}
      >
        {posterUrl ? (
          <img src={posterUrl} alt={title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: posterGradient(title) }}>
            <span className="absolute inset-x-2.5 bottom-7 font-cond text-[17px] font-extrabold uppercase leading-none tracking-tight text-white/95 drop-shadow">
              {title}
            </span>
          </div>
        )}

        {/* bottom scrim */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-white/5" />

        {type && (
          <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 font-cond text-[9.5px] font-extrabold uppercase tracking-wider text-[#ffe7c2] backdrop-blur-sm">
            {TYPE_LABELS[type]}
          </span>
        )}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
          {liked && (
            <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-black/60 text-sm leading-none text-rose backdrop-blur">
              ♥
            </span>
          )}
          {hasRating && (
            <span className="flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-bold tabular-nums text-gold backdrop-blur">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-[9px] w-[9px]">
                <path d="M12 17.3l-5.4 3.3 1.4-6.2-4.7-4.1 6.3-.5L12 4l2.4 5.8 6.3.5-4.7 4.1 1.4 6.2z" />
              </svg>
              {fromNormalized(rating, ratingScale)}
            </span>
          )}
        </div>

        {/* hover overlay — rating is shown accurately by the badge above, so no
            redundant (and scale-agnostic) star row here. */}
        <div className="absolute inset-x-0 bottom-0 flex translate-y-2 flex-col gap-1.5 p-2.5 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <p className="font-cond text-sm font-bold uppercase leading-tight tracking-tight text-white drop-shadow">
            {title}
          </p>
        </div>
      </div>
    </button>
  );
}
