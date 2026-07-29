import { cn } from '../lib/cn';

/**
 * Cinelog mark — three overlapping flat dots in the brand palette
 * (gold / cyan / rose). Flat fills, no stroke, no glow: it sits quietly
 * beside the wordmark.
 */
export function LogoMark({
  size = 28,
  className,
}: {
  size?: number;
  /** Retained for call-site compatibility; this world has no glow. */
  glow?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={cn('inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
        {/* Slightly overlapping, in palette order. */}
        <circle cx="9" cy="14" r="5.4" fill="rgb(var(--gold))" />
        <circle cx="14" cy="14" r="5.4" fill="rgb(var(--cyan))" />
        <circle cx="19" cy="14" r="5.4" fill="rgb(var(--rose))" />
      </svg>
    </span>
  );
}

/** Full lockup: dot mark + wordmark, the "log" struck in acetate amber. */
export function Logo({
  size = 28,
  className,
  textClassName,
}: {
  size?: number;
  glow?: boolean;
  className?: string;
  /** Font-size utility for the wordmark; the topbar wants it noticeably larger. */
  textClassName?: string;
}): JSX.Element {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <span
        className={cn(
          'font-cond font-extrabold uppercase leading-none tracking-[0.02em]',
          textClassName,
        )}
      >
        Cine<span className="text-gold">log</span>
      </span>
    </span>
  );
}
