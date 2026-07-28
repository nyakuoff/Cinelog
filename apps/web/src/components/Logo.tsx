import { cn } from '../lib/cn';

/**
 * Cinelog mark — three punched holes in a strip of film leader, inked in the
 * three archive colours. Read as sprocket perforations rather than as dots:
 * the strip and its rounded-square holes are what make it belong to this
 * world instead of to any app with three circles.
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
        {/* Leader strip */}
        <rect x="1.5" y="6" width="25" height="16" rx="1.5" fill="rgb(var(--surface-2))" />
        <rect
          x="1.5"
          y="6"
          width="25"
          height="16"
          rx="1.5"
          fill="none"
          stroke="rgb(var(--border-hi))"
          strokeWidth="1"
        />
        {/* Punched perforations, in palette order */}
        <rect x="4.6" y="11.2" width="5.6" height="5.6" rx="1.4" fill="rgb(var(--gold))" />
        <rect x="11.2" y="11.2" width="5.6" height="5.6" rx="1.4" fill="rgb(var(--cyan))" />
        <rect x="17.8" y="11.2" width="5.6" height="5.6" rx="1.4" fill="rgb(var(--rose))" />
      </svg>
    </span>
  );
}

/** Full lockup: perforated leader + wordmark, the "log" struck in acetate amber. */
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
