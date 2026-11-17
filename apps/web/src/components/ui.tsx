/**
 * Controls — the one set.
 *
 * Every button, field, toggle and notice in the app comes from here; a page
 * that needs a control it can't find here should extend this file rather than
 * hand-roll a class string. (Layout grammar — headings, posters, tabs — lives
 * in `lb.tsx`; modals in `Dialog.tsx`; ratings in `Rating.tsx`.)
 */
import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../lib/cn';

/* ---- Button ------------------------------------------------------------ */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'icon';

/**
 * Controls in this world are pressed labels, not soft pills: cut corners,
 * condensed caps, a flat ink field or a ruled outline. Nothing glows, and
 * nothing gains a gradient — the archive is printed matter.
 *
 * `primary` is the amber field and is reserved for the act of writing to your
 * own record (log, save, follow, create). `link` is the inline text action
 * (Clear, More, Remove) — label voice, no box.
 */
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-ink hover:bg-gold/90 border border-accent',
  secondary:
    'bg-transparent text-content border border-border-hi hover:border-content hover:bg-surface-2',
  ghost:
    'bg-transparent text-muted border border-transparent hover:text-content hover:bg-surface-2',
  danger: 'bg-transparent text-rose border border-rose/50 hover:bg-rose/10 hover:border-rose',
  link: 'text-muted-2 underline-offset-2 hover:text-content hover:underline',
};
// Dense with a cursor, a 40–44px target under a finger.
const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] coarse:h-10',
  md: 'h-10 px-4 text-[13px] coarse:h-11',
  icon: 'h-10 w-10 coarse:h-11 coarse:w-11',
};
const linkSizes: Record<ButtonSize, string> = {
  sm: 'text-[11px] tracking-[0.12em]',
  md: 'text-[13px]',
  icon: '',
};

/** The button look as a class string, for `<Link>`s and `<a>`s that are buttons. */
export function buttonClass({
  variant = 'secondary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-sm',
    'font-cond font-bold uppercase tracking-[0.09em]',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-45',
    buttonVariants[variant],
    variant === 'link' ? linkSizes[size] : buttonSizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  );
});

/* ---- Fields ------------------------------------------------------------
   One fill (shelf shadow), one rule, one focus colour. */

const fieldBase = cn(
  'w-full rounded-sm border border-border bg-bg-2 text-sm text-content',
  'placeholder:text-muted-2',
  'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
  'disabled:opacity-60',
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, 'h-11 px-3', className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(fieldBase, 'resize-none px-3 py-2.5 leading-relaxed', className)}
      {...props}
    />
  );
});

/**
 * A select in the world's own voice. The browser's native control ships a
 * sentence-case value, its own chevron, and a translucent focus halo — three
 * things this world doesn't do — so the chrome is suppressed and redrawn.
 * `className` sizes the wrapper (width, grid span); the control fills it.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <span className={cn('relative inline-flex', className)}>
        <select
          ref={ref}
          className={cn(
            fieldBase,
            'h-9 appearance-none pl-2.5 pr-7 coarse:h-11',
            'font-cond text-[13px] font-bold uppercase tracking-[0.08em]',
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

/** A labelled checkbox row, so the box and its label are one target. */
export function Checkbox({
  className,
  children,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>): JSX.Element {
  return (
    <label className={cn('flex min-h-[1.75rem] items-center gap-2 text-sm text-muted', className)}>
      <input type="checkbox" className="h-4 w-4 shrink-0" {...props} />
      {children}
    </label>
  );
}

/* ---- Segmented control -------------------------------------------------- */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Typewritten tally after the label. */
  count?: number;
}

/**
 * A small set of mutually exclusive views (Films / Shows, sort orders). The
 * active segment is raised stock, not an amber fill — choosing a view isn't a
 * mark on your record. Scrolls sideways rather than wrapping when it's wider
 * than its row.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  className?: string;
}): JSX.Element {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex max-w-full gap-0.5 overflow-x-auto rounded-sm border border-border bg-bg-2 p-0.5 scrollbar-none',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-8 shrink-0 whitespace-nowrap rounded-sm px-3 coarse:h-10',
              'font-cond text-[13px] font-bold uppercase tracking-[0.09em]',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent',
              active ? 'bg-card text-content' : 'text-muted hover:text-content',
            )}
          >
            {o.label}
            {o.count != null && (
              <span className="ml-1.5 font-data text-[11px] font-normal tracking-normal text-muted-2">
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---- Surfaces & feedback ------------------------------------------------ */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('rounded-sm border border-border bg-surface', className)} {...props} />;
}

/** The one spinner. `center` gives it the padded block a loading region wants. */
export function Spinner({
  className,
  center = false,
}: {
  className?: string;
  center?: boolean;
}): JSX.Element {
  const ring = (
    <div
      className={cn(
        'h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
  return center ? <div className="flex justify-center py-16">{ring}</div> : ring;
}

/**
 * An inline message from the system — a failed save, a provider that didn't
 * answer. A ruled slip with a typewritten "Notice" tab in verdigris, the
 * system's ink: stamp red means affection here and is never an alarm colour.
 */
export function Notice({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <p
      role="alert"
      className={cn(
        'flex items-baseline gap-2.5 rounded-sm border border-border-hi bg-surface-2 px-3 py-2 text-sm text-content',
        className,
      )}
    >
      <span className="shrink-0 font-data text-[11px] font-bold uppercase text-cyan">Notice</span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/* ---- Stamp ---------------------------------------------------------------
   The identity element. State in the archive is struck onto the record,
   which is why this reads as ink and tilt rather than as a lit pill. */

export type StampTone = 'gold' | 'cyan' | 'rose' | 'muted';
const stampTones: Record<StampTone, string> = {
  gold: 'text-gold',
  cyan: 'text-cyan',
  rose: 'text-rose',
  muted: 'text-muted-2',
};

/**
 * A struck state mark. `active={false}` draws the empty ruled box waiting to
 * be filled; `struck` plays the single authored motion in the app.
 */
export function Stamp({
  tone = 'gold',
  active = true,
  struck = false,
  className,
  children,
}: {
  tone?: StampTone;
  active?: boolean;
  struck?: boolean;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <span
      className={cn(
        'stamp',
        active ? stampTones[tone] : 'text-muted-2 opacity-55',
        active && struck && 'stamp-strike',
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A stamp you can press: WATCHED / LIKED / WATCHLIST and any other "this is
 * now true of this title" toggle. Strikes only on a press the user just made,
 * never on first paint.
 */
export function StampToggle({
  label,
  active,
  tone,
  onChange,
  disabled,
  className,
}: {
  label: string;
  active: boolean;
  tone: Exclude<StampTone, 'muted'>;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
}): JSX.Element {
  const [everPressed, setEverPressed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setEverPressed(true);
        onChange(!active);
      }}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        'flex min-h-[2.75rem] items-center justify-center rounded-sm px-2 hover:bg-surface-2',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-60',
        className,
      )}
    >
      <Stamp tone={tone} active={active} struck={everPressed}>
        {label}
      </Stamp>
    </button>
  );
}

/** "Load more" for a cursor-paginated useInfiniteQuery; renders nothing on the last page. */
export function LoadMore({
  query,
  label = 'Load more',
}: {
  query: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };
  label?: string;
}): JSX.Element | null {
  if (!query.hasNextPage) return null;
  return (
    <div className="mt-6 flex justify-center">
      <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
        {query.isFetchingNextPage ? 'Loading…' : label}
      </Button>
    </div>
  );
}
