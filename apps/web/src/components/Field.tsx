import type { ReactNode } from 'react';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-content">{label}</span>
        {hint && <span className="text-xs text-muted-2">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-rose">{error}</span>}
    </label>
  );
}
