/**
 * The one modal.
 *
 * Built on the native <dialog>: `showModal()` puts it in the top layer and
 * gives us the focus trap, inertness of the page behind, Escape, and focus
 * return for free. What this adds is the sheet itself — a ruled header, one
 * scrolling body, a footer for actions — plus a scroll lock on the page, safe-
 * area padding, a dvh-based height cap, and the bottom-sheet presentation in
 * the installed app (see `.dialog` in index.css).
 *
 * `useConfirm()` is the replacement for `window.confirm`, built on the same
 * sheet so a destructive question looks like the rest of the app.
 */
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn';
import { IconX } from './app/Icons';
import { Button } from './ui';

type DialogSize = 'sm' | 'md' | 'lg';
const sizes: Record<DialogSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

// Dialogs can stack (a confirm over an editor); the page unlocks with the last.
let openDialogs = 0;

export function Dialog({
  title,
  onClose,
  size = 'md',
  headerExtra,
  toolbar,
  footer,
  children,
  bodyClassName,
}: {
  /** Heading, and the dialog's accessible name. */
  title: string;
  onClose: () => void;
  size?: DialogSize;
  /** Sits in the header row between the title and the close button. */
  headerExtra?: ReactNode;
  /** A fixed band under the header (a search field, an explainer). */
  toolbar?: ReactNode;
  /** Action row pinned to the foot. */
  footer?: ReactNode;
  /** The scrolling body. */
  children: ReactNode;
  bodyClassName?: string;
}): JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  const downOnScrim = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.showModal();
    // showModal focuses the first focusable thing, which is the close button.
    // A field marked `data-autofocus` wins; otherwise the sheet itself, so the
    // first Tab lands inside without a control looking pre-selected.
    const target =
      el.querySelector<HTMLElement>('[data-autofocus]') ??
      el.querySelector<HTMLElement>('.dialog-panel');
    target?.focus({ preventScroll: true });

    if (openDialogs++ === 0) document.documentElement.style.overflow = 'hidden';
    return () => {
      if (--openDialogs === 0) document.documentElement.style.overflow = '';
      // close() is what hands focus back to whatever opened the dialog.
      if (el.open) el.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      // Escape: let the owner unmount us rather than the browser closing a
      // dialog React still thinks is open.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click that both starts and ends on the scrim dismisses; a drag that
      // began in a text field and ended outside does not.
      onMouseDown={(e) => {
        downOnScrim.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (downOnScrim.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        tabIndex={-1}
        className={cn(
          'dialog-panel flex max-h-full w-full flex-col rounded-sm border border-border-hi bg-surface shadow-soft outline-none',
          sizes[size],
        )}
      >
        <header className="flex min-h-[3.25rem] shrink-0 items-center gap-3 border-b border-border py-1.5 pl-4 pr-1.5">
          <h2 className="min-w-0 flex-1 truncate font-cond text-lg font-extrabold uppercase tracking-[0.04em]">
            {title}
          </h2>
          {headerExtra}
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <IconX />
          </Button>
        </header>
        {toolbar && <div className="shrink-0 border-b border-border p-4">{toolbar}</div>}
        <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain p-4', bodyClassName)}>
          {children}
        </div>
        {footer && (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border p-4">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}

/* ---- Confirm ------------------------------------------------------------- */

export interface ConfirmOptions {
  title: string;
  body?: string;
  /** Label for the confirming button. Default "Confirm". */
  confirmLabel?: string;
  /** Draw the confirming button as destructive. */
  danger?: boolean;
}

type Ask = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask>(() => Promise.resolve(false));

/** Mounted once around the app; hosts whichever question is being asked. */
export function ConfirmProvider({ children }: { children: ReactNode }): JSX.Element {
  const [pending, setPending] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);

  const ask = useCallback<Ask>(
    (opts) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  );
  const answer = (ok: boolean): void => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending && (
        <Dialog
          title={pending.title}
          size="sm"
          onClose={() => answer(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => answer(false)}>
                Cancel
              </Button>
              <Button
                variant={pending.danger ? 'danger' : 'primary'}
                data-autofocus
                onClick={() => answer(true)}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-muted">
            {pending.body ?? 'This cannot be undone.'}
          </p>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}

/**
 * `const confirm = useConfirm(); if (await confirm({ title, danger: true })) …`
 * — the in-world replacement for `window.confirm`.
 */
export function useConfirm(): Ask {
  return useContext(ConfirmContext);
}
