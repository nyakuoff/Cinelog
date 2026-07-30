import { useEffect, useState } from 'react';
import { Button } from './ui';

const DISMISS_KEY = 'cinelog:install-dismissed';
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isDismissedRecently(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const at = Number(raw);
  return Number.isFinite(at) && Date.now() - at < DISMISS_COOLDOWN_MS;
}

/** A member with the app open in a browser tab, not yet installed, gets a
 *  once-per-cooldown nudge — the native install affordance lives behind a
 *  browser menu entry that's easy to never notice. */
export function InstallPrompt(): JSX.Element | null {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    function onBeforeInstallPrompt(e: Event): void {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled(): void {
      setDeferred(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred || dismissed || isDismissedRecently()) return null;

  function dismiss(): void {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  async function install(): Promise<void> {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  return (
    <div className="fixed bottom-safe-5 left-5 z-30 flex max-w-xs items-center gap-3 rounded-sm border border-border-hi bg-surface p-3 shadow-lift">
      <p className="font-cond text-[13px] font-bold uppercase tracking-[0.08em] text-content">
        Install Cinelog
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={dismiss} aria-label="Dismiss">
          ✕
        </Button>
        <Button variant="primary" size="sm" onClick={() => void install()}>
          Install
        </Button>
      </div>
    </div>
  );
}
