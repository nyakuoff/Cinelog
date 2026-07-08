interface Props {
  /** Normalized 0..100. */
  value: number;
  /** Font size in px controls the star size. */
  size?: number;
  className?: string;
}

/** Read-only gold star rating using the overlay-fill technique from index.css. */
export function Stars({ value, size = 14, className }: Props): JSX.Element {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span className={`stars ${className ?? ''}`} style={{ fontSize: size }} aria-label={`${Math.round(pct / 20 * 10) / 10} of 5`}>
      <span className="stars-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}
