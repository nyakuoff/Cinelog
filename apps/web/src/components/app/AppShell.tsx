import { Suspense, useLayoutEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { useGoBack, useScreenHeaderConfig } from '../../lib/appShell';
import { Avatar } from '../Avatar';
import { Spinner } from '../ui';
import { TabBar } from '../lb';
import { LogModal, useLogShortcut } from '../LogModal';
import { UpdateToast } from '../UpdateToast';
import { IconBolt, IconChevronLeft, IconPanels, IconPerson, IconPlus, IconSearch } from './Icons';

/**
 * The installed-app shell.
 *
 * One screen at a time, a title bar that belongs to the screen rather than to
 * the site, and a fixed bottom bar carrying the five places a member actually
 * goes — with the log action struck through its centre, because logging is the
 * point of the app and everything else is navigation around it.
 *
 * The website's masthead nav is not lost, it's redistributed: the home tab
 * and the profile tab each carry a strip of their own sub-screens, which is how
 * a phone app of this shape holds a nav that wide.
 */

type TabKey = 'home' | 'search' | 'activity' | 'profile';

interface Tab {
  key: TabKey;
  to: string;
  label: string;
  icon: (p: { className?: string }) => JSX.Element;
}

const TABS: Tab[] = [
  { key: 'home', to: '/', label: 'Home', icon: IconPanels },
  { key: 'search', to: '/search', label: 'Search', icon: IconSearch },
  { key: 'activity', to: '/activity', label: 'Activity', icon: IconBolt },
  { key: 'profile', to: '/profile', label: 'Profile', icon: IconPerson },
];

/** Sub-screens reachable from a tab, shown as a strip under its title bar. */
const HOME_STRIP = [
  { key: '/', to: '/', label: 'Home' },
  { key: '/films', to: '/films', label: 'Media' },
  { key: '/lists', to: '/lists', label: 'Lists' },
  { key: '/members', to: '/members', label: 'Members' },
];
/** Your own profile's sections (the same ones a member page tabs through),
 *  then the private shelves that sit beside them. */
const PROFILE_STRIP = [
  { key: '/profile', to: '/profile', label: 'Profile' },
  { key: '/profile/diary', to: '/profile/diary', label: 'Diary' },
  { key: '/profile/films', to: '/profile/films', label: 'Films' },
  { key: '/profile/reviews', to: '/profile/reviews', label: 'Reviews' },
  { key: '/watchlist', to: '/watchlist', label: 'Watchlist' },
  { key: '/profile/lists', to: '/profile/lists', label: 'Lists' },
  { key: '/profile/likes', to: '/profile/likes', label: 'Likes' },
  { key: '/profile/activity', to: '/profile/activity', label: 'Activity' },
  { key: '/profile/network', to: '/profile/network', label: 'Network' },
  { key: '/library', to: '/library', label: 'Library' },
  { key: '/settings', to: '/settings', label: 'Settings' },
];

/** Route → screen name, for the bar the screen didn't override. */
const ROUTE_TITLES: { match: RegExp; title: string; back?: boolean }[] = [
  { match: /^\/$/, title: 'Home' },
  { match: /^\/films/, title: 'Media' },
  { match: /^\/members/, title: 'Members' },
  { match: /^\/lists$/, title: 'Lists' },
  { match: /^\/lists\//, title: 'List', back: true },
  { match: /^\/library/, title: 'Library' },
  { match: /^\/watchlist/, title: 'Watchlist' },
  { match: /^\/search/, title: 'Search' },
  { match: /^\/activity/, title: 'Activity' },
  { match: /^\/profile/, title: 'Profile' },
  { match: /^\/u\//, title: 'Member', back: true },
  { match: /^\/review\//, title: 'Review', back: true },
  { match: /^\/person\//, title: 'Person', back: true },
  { match: /^\/settings/, title: 'Settings' },
  { match: /^\/admin/, title: 'Admin', back: true },
];

/** The tab a path belongs to outright; null for detail screens, which belong
 *  to whichever tab you opened them from (see `useActiveTab`). */
function tabForPath(path: string, ownUsername?: string): TabKey | null {
  if (path.startsWith('/lists/')) return null;
  if (ownUsername && (path === `/u/${ownUsername}` || path.startsWith(`/u/${ownUsername}/`))) {
    return 'profile';
  }
  if (path.startsWith('/search')) return 'search';
  if (path.startsWith('/activity')) return 'activity';
  if (
    path.startsWith('/profile') ||
    path.startsWith('/library') ||
    path.startsWith('/watchlist') ||
    path.startsWith('/settings') ||
    path.startsWith('/admin')
  ) {
    return 'profile';
  }
  if (
    path === '/' ||
    path.startsWith('/films') ||
    path.startsWith('/lists') ||
    path.startsWith('/members')
  ) {
    return 'home';
  }
  return null; // media / person / member / list detail
}

function stripForPath(path: string): typeof HOME_STRIP | null {
  if (HOME_STRIP.some((s) => s.to === path)) return HOME_STRIP;
  if (PROFILE_STRIP.some((s) => s.to === path)) return PROFILE_STRIP;
  return null;
}

/**
 * Which tab is lit. A detail screen (a title, a person, a member, a list)
 * keeps the tab it was opened from lit, remembered per history entry so Back
 * and Forward light the right one too.
 */
function useActiveTab(path: string, locationKey: string, ownUsername?: string): TabKey {
  const byEntry = useRef(new Map<string, TabKey>());
  const last = useRef<TabKey>('home');
  const own = tabForPath(path, ownUsername);
  const tab = own ?? byEntry.current.get(locationKey) ?? last.current;
  byEntry.current.set(locationKey, tab);
  last.current = tab;
  return tab;
}

export function AppShell(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [logging, setLogging] = useState(false);

  // Trailing slashes are the same screen (`/films/` is a valid deep link).
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const override = useScreenHeaderConfig();
  const route = ROUTE_TITLES.find((r) => r.match.test(path));
  const title = override?.title ?? route?.title ?? 'Cinelog';
  const hidden = override?.hidden ?? false;
  const back = override?.back ?? route?.back ?? tabForPath(path, user?.username) === null;
  const strip = stripForPath(path);
  const activeTab = useActiveTab(path, location.key, user?.username);

  // A phone app opens each new screen at its top — tapping a poster from
  // halfway down a grid shouldn't land you halfway down the film page — but
  // Back returns to where you were.
  const navType = useNavigationType();
  const goBack = useGoBack();
  // Layout effect: the cleanup must record the old position before the new
  // screen's DOM can clamp it, and the new position applies before paint.
  useLayoutEffect(() => {
    const key = `cinelog:scroll:${location.key}`;
    const saved = navType === 'POP' ? Number(sessionStorage.getItem(key) ?? 0) : 0;
    window.scrollTo(0, saved);
    let y = window.scrollY;
    const onScroll = (): void => {
      y = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      try {
        sessionStorage.setItem(key, String(y));
      } catch {
        /* storage full or disabled — Back just opens at the top */
      }
    };
    // Once per history entry; navType is read for that entry only.
  }, [location.key]);

  // The home-screen icon's "Log a title" shortcut (see manifest.webmanifest).
  useLogShortcut(setLogging);

  return (
    <div className="min-h-full pl-safe pr-safe">
      {!hidden && (
        <header className="sticky top-0 z-40 border-b-2 border-border-hi bg-bg-2 pt-safe">
          <div className="grid h-12 grid-cols-[3rem_minmax(0,1fr)_3rem] items-center">
            {back ? (
              <button
                onClick={() => (typeof back === 'string' ? navigate(back) : goBack())}
                aria-label="Back"
                className="grid h-12 w-12 place-items-center text-content"
              >
                <IconChevronLeft />
              </button>
            ) : (
              <span />
            )}
            <h1 className="truncate text-center font-cond text-[15px] font-extrabold uppercase tracking-[0.16em] text-content">
              {title}
            </h1>
            <Link
              to="/settings"
              aria-label="Settings"
              className="grid h-12 w-12 place-items-center justify-self-end"
            >
              <Avatar user={user} size={26} />
            </Link>
          </div>

          {/* The strip's own baseline rule is dropped: the header's 2px edge
              is the rule, and the active tab's underline sits on it. */}
          {strip && <TabBar tabs={strip} active={path} className="border-b-0 px-2" />}
        </header>
      )}

      {/* Clearance for the fixed tab bar, which would otherwise sit on top of
          the last row of every screen. */}
      <main className="pb-tabbar">
        <Suspense fallback={<Spinner center />}>
          <Outlet />
        </Suspense>
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border-hi bg-bg-2 pb-safe pl-safe pr-safe"
      >
        <div className="mx-auto flex h-[var(--tabbar-h)] max-w-md items-stretch">
          {TABS.slice(0, 2).map((t) => (
            <TabButton key={t.key} tab={t} active={activeTab === t.key} here={path === t.to} />
          ))}

          {/* The log action, struck through the centre of the bar. */}
          <div className="flex flex-1 items-center justify-center">
            <button
              onClick={() => setLogging(true)}
              aria-label="Log a title"
              className="grid h-11 w-11 place-items-center rounded-sm border-2 border-gold text-gold active:bg-gold active:text-ink"
            >
              <IconPlus className="h-6 w-6" />
            </button>
          </div>

          {TABS.slice(2).map((t) => (
            <TabButton key={t.key} tab={t} active={activeTab === t.key} here={path === t.to} />
          ))}
        </div>
      </nav>

      {logging && <LogModal onClose={() => setLogging(false)} />}
      <UpdateToast />
    </div>
  );
}

function TabButton({
  tab,
  active,
  here,
}: {
  tab: Tab;
  active: boolean;
  /** Already on this tab's root screen — a tap means "back to the top". */
  here: boolean;
}): JSX.Element {
  const Icon = tab.icon;
  return (
    <Link
      to={tab.to}
      aria-label={tab.label}
      aria-current={active ? 'page' : undefined}
      onClick={(e) => {
        if (!here) return;
        e.preventDefault();
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
      }}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-1',
        active ? 'text-gold' : 'text-muted-2',
      )}
    >
      <Icon className="h-[22px] w-[22px]" />
      {/* A 2px ruled tick rather than a label: five words across a 390px bar
          shrink to unreadable, and the icons already carry the meaning. */}
      <span
        aria-hidden="true"
        className={cn('h-[2px] w-4', active ? 'bg-gold' : 'bg-transparent')}
      />
    </Link>
  );
}
