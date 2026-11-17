/**
 * The icon set — one for both shells and every control.
 *
 * Drawn rather than pulled from a set: everything else in this world is cut
 * and printed, so these are flat single-weight strokes on the same 24-unit
 * grid, with no rounded caps and no fill except where a mark is meant to read
 * as struck ink. `currentColor` throughout — the caller owns the colour.
 * Text glyphs (⌕ ☰ ✕ ▶ ✎ ♥) are not used anywhere; they render differently
 * on every platform and some of them fall back to colour emoji.
 */
type IconProps = { className?: string; style?: React.CSSProperties };

const BASE = 'h-6 w-6';

/** Two shelf panels — the browse surface, where the archive is laid out. */
export function IconPanels({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? BASE}>
      <rect x="3" y="4" width="7" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect
        x="14"
        y="4"
        width="7"
        height="11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function IconSearch({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? BASE}>
      <circle cx="11" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 15.2 20.5 20.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

/** The log action. Struck as a solid cross, because it is the one thing here
 *  that writes to your record rather than moving you around it. */
export function IconPlus({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? BASE}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" fill="none" />
    </svg>
  );
}

/** Activity — a strike of current through the feed. */
export function IconBolt({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? BASE}>
      <path
        d="M13.5 2.5 5 13.5h5.5L9.5 21.5 19 10.5h-5.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function IconPerson({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? BASE}>
      <circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.5 20.5c0-3.9 3.4-6.4 7.5-6.4s7.5 2.5 7.5 6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function IconChevronLeft({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? 'h-5 w-5'}>
      <path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/* ---- Controls ----------------------------------------------------------
   Smaller default box: these sit inline in buttons and rows, not in the
   tab bar. Built from one helper so stroke weight can't drift. */

function stroke(d: string, width = 1.8) {
  return function Icon({ className }: IconProps): JSX.Element {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? 'h-4 w-4'}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth={width} strokeLinejoin="miter" />
      </svg>
    );
  };
}

export const IconX = stroke('M5 5l14 14M19 5 5 19', 2);
export const IconMenu = stroke('M3 6.5h18M3 12h18M3 17.5h18', 2);
export const IconCheck = stroke('M4 12.5 9.5 18 20 6.5', 2.2);
export const IconChevronRight = stroke('M9 4l8 8-8 8', 2);
export const IconChevronDown = stroke('M4 9l8 8 8-8', 2);
export const IconArrowUp = stroke('M12 20V5M5.5 11.5 12 5l6.5 6.5', 2);
export const IconArrowDown = stroke('M12 4v15M5.5 12.5 12 19l6.5-6.5', 2);
export const IconEye = stroke(
  'M2 12c2.6-4.4 6-6.6 10-6.6S19.4 7.6 22 12c-2.6 4.4-6 6.6-10 6.6S4.6 16.4 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
);
export const IconClock = stroke('M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3.2 2.2');
export const IconList = stroke('M8.5 6.5H21M8.5 12H21M8.5 17.5H21M3 6.5h2M3 12h2M3 17.5h2', 2);
export const IconShare = stroke('M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5v7.5h14v-7.5');
export const IconEdit = stroke('M4 20h4L19.5 8.5l-4-4L4 16v4zM13.5 6.5l4 4');
export const IconComment = stroke('M4 5h16v11h-8l-4.5 3.5V16H4z');
/** Rewatch — the reel going round again. */
export const IconRewatch = stroke('M19.5 12a7.5 7.5 0 1 1-2.6-5.7M17.5 2.5v4.2h-4.2', 2);
/** A written review — ruled lines on a slip. */
export const IconReview = stroke('M5 4h14v16H5zM8.5 9h7M8.5 12.5h7M8.5 16h4');
export const IconGrid = stroke(
  'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
);
export const IconDots = stroke(
  'M5 11.5h1.5v1.5H5zM11.25 11.5h1.5v1.5h-1.5zM17.5 11.5H19v1.5h-1.5z',
  2,
);

/** Play is struck solid — it is the one glyph that means "this leaves the archive". */
export function IconPlay({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? 'h-4 w-4'}>
      <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
    </svg>
  );
}

/** Outlined when unset, struck solid when set — the same grammar as a stamp. */
export function IconHeart({ className, filled }: IconProps & { filled?: boolean }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? 'h-4 w-4'}>
      <path
        d="M12 20.5 3.6 12.3a5 5 0 0 1 7-7.1L12 6.6l1.4-1.4a5 5 0 0 1 7 7.1z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function IconStar({ className, style }: IconProps): JSX.Element {
  return (
    // Cropped to the glyph rather than the 24-unit grid, so a row of stars
    // sits tight and the box you see is the box you hit.
    <svg viewBox="3 3.5 18 18" aria-hidden="true" className={className ?? 'h-4 w-4'} style={style}>
      <path
        d="M12 17.3l-5.4 3.3 1.4-6.2-4.7-4.1 6.3-.5L12 4l2.4 5.8 6.3.5-4.7 4.1 1.4 6.2z"
        fill="currentColor"
      />
    </svg>
  );
}
