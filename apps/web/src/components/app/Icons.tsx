/**
 * Tab-bar glyphs.
 *
 * Drawn rather than pulled from a set: everything else in this world is cut
 * and printed, so these are flat single-weight strokes on the same 24-unit
 * grid, with no rounded caps and no fill except where a mark is meant to read
 * as struck ink. `currentColor` throughout — the tab bar owns the colour.
 */
type IconProps = { className?: string };

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
