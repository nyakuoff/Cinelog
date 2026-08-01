/**
 * Installed-app mode.
 *
 * Cinelog runs in two shells from one codebase. In a browser tab it is a wide
 * archive site: masthead, horizontal nav, sidebars. Installed to a phone's home
 * screen it has no browser chrome to borrow from and no room for any of that,
 * so it switches to the shape a native media app actually has — a contextual
 * title bar, one scrolling screen, and a fixed bottom tab bar with the log
 * action at its centre.
 *
 * The switch is deliberately narrow: standalone display-mode AND a phone-sized
 * viewport. An installed desktop PWA is still a desktop window, and a bottom
 * tab bar there would be wrong.
 *
 * `?app=1` forces the shell on (and `?app=0` off) so the layout can be worked
 * on in a normal browser tab; the choice persists until it's cleared.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const FORCE_KEY = 'cinelog:force-app-shell';
/** Below this the app shell applies; at or above it, the site layout does. */
const PHONE_QUERY = '(max-width: 899px)';
const DISPLAY_MODES = ['standalone', 'fullscreen', 'minimal-ui'];

/** Read (and consume) a `?app=` override, so it survives later navigations. */
function readForceOverride(): boolean | null {
  if (typeof window === 'undefined') return null;
  const param = new URLSearchParams(window.location.search).get('app');
  if (param === '1' || param === '0') {
    try {
      localStorage.setItem(FORCE_KEY, param);
    } catch {
      /* private mode — the override just won't persist */
    }
    return param === '1';
  }
  try {
    const stored = localStorage.getItem(FORCE_KEY);
    if (stored === '1' || stored === '0') return stored === '1';
  } catch {
    /* ignore */
  }
  return null;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari predates display-mode and reports it on the navigator instead.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return DISPLAY_MODES.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches);
}

function computeAppShell(force: boolean | null): boolean {
  if (typeof window === 'undefined') return false;
  const installed = force ?? isStandalone();
  return installed && window.matchMedia(PHONE_QUERY).matches;
}

const AppShellContext = createContext(false);

export function AppShellProvider({ children }: { children: ReactNode }): JSX.Element {
  const force = useMemo(readForceOverride, []);
  const [on, setOn] = useState(() => computeAppShell(force));

  useEffect(() => {
    const queries = [
      window.matchMedia(PHONE_QUERY),
      ...DISPLAY_MODES.map((m) => window.matchMedia(`(display-mode: ${m})`)),
    ];
    const update = (): void => setOn(computeAppShell(force));
    update();
    for (const q of queries) q.addEventListener('change', update);
    return () => {
      for (const q of queries) q.removeEventListener('change', update);
    };
  }, [force]);

  // Mirrored onto the root element so plain CSS — and the Tailwind `app:`
  // variant built on it — can restyle without every component branching in JS.
  useEffect(() => {
    document.documentElement.classList.toggle('app-shell', on);
  }, [on]);

  return <AppShellContext.Provider value={on}>{children}</AppShellContext.Provider>;
}

/** True when rendering as the installed phone app rather than the website. */
export function useAppShell(): boolean {
  return useContext(AppShellContext);
}

/* ---- Per-screen title bar ---------------------------------------------
   The shell owns the title bar, but only the screen knows what belongs in
   it — a film page wants no bar at all (its artwork runs to the top edge),
   a member's diary wants their name. A screen declares its bar; the
   declaration is torn down when the screen unmounts, so the next route
   starts from the shell's own defaults. */

export interface ScreenHeaderConfig {
  /** Centre title. Defaults to the route's own name. */
  title?: string;
  /** Suppress the bar entirely — for screens whose art runs under the status bar. */
  hidden?: boolean;
  /** Show a back chevron; a string overrides where it goes (default: history back). */
  back?: boolean | string;
}

interface HeaderStore {
  config: ScreenHeaderConfig | null;
  set: (config: ScreenHeaderConfig | null) => void;
}

const ScreenHeaderContext = createContext<HeaderStore>({ config: null, set: () => {} });

export function ScreenHeaderProvider({ children }: { children: ReactNode }): JSX.Element {
  const [config, set] = useState<ScreenHeaderConfig | null>(null);
  const value = useMemo(() => ({ config, set }), [config]);
  return <ScreenHeaderContext.Provider value={value}>{children}</ScreenHeaderContext.Provider>;
}

export function useScreenHeaderConfig(): ScreenHeaderConfig | null {
  return useContext(ScreenHeaderContext).config;
}

/** Declare this screen's title bar. Reverts to the route default on unmount. */
export function useScreenHeader(config: ScreenHeaderConfig): void {
  const { set } = useContext(ScreenHeaderContext);
  const { title, hidden, back } = config;
  useEffect(() => {
    set({ title, hidden, back });
    return () => set(null);
    // Primitives only, so a fresh object literal per render doesn't loop.
  }, [set, title, hidden, back]);
}
