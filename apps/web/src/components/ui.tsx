import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Controls in this world are pressed labels, not soft pills: cut corners,
 * condensed caps, a flat ink field or a ruled outline. Nothing glows, and
 * nothing gains a gradient — the archive is printed matter.
 */
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-ink hover:bg-gold/90 border border-accent',
  secondary: 'bg-transparent text-content border border-border-hi hover:border-content hover:bg-surface-2',
  ghost: 'bg-transparent text-muted border border-transparent hover:text-content hover:bg-surface-2',
  danger: 'bg-transparent text-rose border border-rose/50 hover:bg-rose/10 hover:border-rose',
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[12px]',
  md: 'h-10 px-4 text-[13px]',
  lg: 'h-11 px-5 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm',
        'font-cond font-bold uppercase tracking-[0.09em]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:pointer-events-none disabled:opacity-45',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          // Ruled underline rather than a boxed pill — a form line on a card.
          'h-11 w-full rounded-sm border border-border bg-bg-2 px-3 text-sm text-content',
          'placeholder:text-muted-2',
          'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
          className,
        )}
        {...props}
      />
    );
  },
);

/**
 * A select in the world's own voice. The browser's native control ships a
 * sentence-case value, its own chevron, and a translucent focus halo — three
 * things this world doesn't do — so the chrome is suppressed and redrawn.
 */
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <span className="relative inline-flex">
        <select
          ref={ref}
          className={cn(
            'h-9 w-full appearance-none rounded-sm border border-border bg-bg-2 pl-2.5 pr-7',
            'font-cond text-[12px] font-bold uppercase tracking-[0.08em] text-content',
            'focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 10 6"
          className="pointer-events-none absolute right-2.5 top-1/2 h-[5px] w-[9px] -translate-y-1/2 fill-muted-2"
        >
          <path d="M0 0h10L5 6z" />
        </svg>
      </span>
    );
  },
);

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div className={cn('rounded-sm border border-border bg-surface', className)} {...props} />
  );
}

/** A gummed classification label: flat stock, condensed caps, cut corners. */
export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border border-border-hi bg-surface-2 px-2 py-0.5',
        'font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-muted',
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        'h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

/**
 * A struck state mark — WATCHED, LIKED, and friends. State in the archive is
 * stamped onto the record, which is why this reads as ink and tilt rather
 * than as a lit pill. `struck` plays the single authored motion in the app.
 */
export function Stamp({
  tone = 'gold',
  struck = false,
  className,
  children,
}: {
  tone?: 'gold' | 'cyan' | 'rose' | 'muted';
  struck?: boolean;
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  const tones = {
    gold: 'text-gold',
    cyan: 'text-cyan',
    rose: 'text-rose',
    muted: 'text-muted-2',
  } as const;
  return (
    <span className={cn('stamp', tones[tone], struck && 'stamp-strike', className)}>
      {children}
    </span>
  );
}
