import { useEffect, useState } from 'react';
import { Button } from './ui';
import { IconX } from './app/Icons';

export const SW_UPDATE_EVENT = 'sw-update-available';

/** main.tsx fires SW_UPDATE_EVENT once it sees a new service worker take
 *  over an already-controlled page (i.e. not the very first install) — an
 *  installed PWA can sit open for hours with no other cue a new build shipped. */
export function UpdateToast(): JSX.Element | null {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    function onUpdate(): void {
      setAvailable(true);
    }
    window.addEventListener(SW_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(SW_UPDATE_EVENT, onUpdate);
  }, []);

  if (!available) return null;

  async function reload(): Promise<void> {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg?.waiting) return window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    });
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  return (
    <div className="fixed inset-x-4 bottom-safe-5 app:bottom-tabbar z-40 mx-auto mb-3 flex max-w-sm items-center gap-3 rounded-sm border border-border-hi bg-surface p-3 shadow-lift sm:inset-x-auto sm:right-5 sm:mx-0">
      <p className="font-cond text-[13px] font-bold uppercase tracking-[0.08em] text-content">
        Update available
      </p>
      <Button
        variant="primary"
        size="sm"
        className="ml-auto shrink-0"
        onClick={() => void reload()}
      >
        Reload
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setAvailable(false)} aria-label="Dismiss">
        <IconX />
      </Button>
    </div>
  );
}
