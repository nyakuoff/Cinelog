import { cn } from '../lib/cn';

/**
 * Cinelog mark — three flat dots in the brand palette (gold / cyan / rose),
 * deliberately understated in the spirit of Letterboxd's dots. No gradients,
 * no glow animation: it should sit quietly next to the wordmark.
 */
export function LogoMark({
  size = 28,
  glow = false,
  className,
}: {
  size?: number;
  glow?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={cn('inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        aria-hidden="true"
        className={glow ? 'drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]' : undefined}
      >
        {/* Slightly overlapping, in palette order. Flat fills, no stroke. */}
        <circle cx="9" cy="14" r="5.4" fill="rgb(var(--gold))" />
        <circle cx="14" cy="14" r="5.4" fill="rgb(var(--cyan))" />
        <circle cx="19" cy="14" r="5.4" fill="rgb(var(--rose))" />
      </svg>
    </span>
  );
}

/** Full lockup: dot mark + wordmark (the "log" tinted gold). */
export function Logo({
  size = 28,
  glow = false,
  className,
}: {
  size?: number;
  glow?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <span className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <LogoMark size={size} glow={glow} />
      <span>
        Cine<span className="text-gold">log</span>
      </span>
    </span>
  );
}
