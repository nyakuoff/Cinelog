import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-ink hover:brightness-110 font-cond font-extrabold uppercase tracking-wide',
  secondary: 'bg-surface-2 text-content hover:bg-card',
  ghost: 'bg-transparent text-muted hover:text-content hover:bg-surface-2',
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-[15px]',
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
        'inline-flex items-center justify-center gap-2 rounded-xl',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        'disabled:pointer-events-none disabled:opacity-50',
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
          'h-11 w-full rounded-xl border border-border bg-surface-2 px-3.5 text-sm text-content',
          'placeholder:text-muted-2',
          'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan/50',
          className,
        )}
        {...props}
      />
    );
  },
);

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn('rounded-2xl border border-border bg-surface shadow-soft', className)}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs text-muted',
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
