import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { useScreenHeaderConfig } from '../../lib/appShell';
import { Avatar } from '../Avatar';
import { LogModal } from '../LogModal';
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
 * The website's masthead nav is not lost, it's redistributed: the browse tab
 * and the profile tab each carry a strip of their own sub-screens, which is how
 * a phone app of this shape holds a nav that wide.
 */

type TabKey = 'browse' | 'search' | 'activity' | 'profile';

interface Tab {
  key: TabKey;
  to: string;
  label: string;
  icon: (p: { className?: string }) => JSX.Element;
}

const TABS: Tab[] = [
  { key: 'browse', to: '/', label: 'Browse', icon: IconPanels },
  { key: 'search', to: '/search', label: 'Search', icon: IconSearch },
  { key: 'activity', to: '/activity', label: 'Activity', icon: IconBolt },
  { key: 'profile', to: '/profile', label: 'Profile', icon: IconPerson },
];

/** Sub-screens reachable from a tab, shown as a strip under its title bar. */
const BROWSE_STRIP = [
  { to: '/', label: 'Discover', end: true },
  { to: '/films', label: 'Media' },
  { to: '/lists', label: 'Lists' },
  { to: '/members', label: 'Members' },
];
const PROFILE_STRIP = [
  { to: '/profile', label: 'Profile', end: true },
  { to: '/library', label: 'Library' },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/settings', label: 'Settings' },
];

/** Route → screen name, for the bar the screen didn't override. */
const ROUTE_TITLES: { match: RegExp; title: string; back?: boolean }[] = [
  { match: /^\/$/, title: 'Discover' },
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
  { match: /^\/person\//, title: 'Person', back: true },
  { match: /^\/settings/, title: 'Settings' },
  { match: /^\/admin/, title: 'Admin', back: true },
];

function tabForPath(path: string): TabKey | null {
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
    return 'browse';
  }
  return null; // media/person detail screens sit under no tab
}

function stripForPath(path: string): { to: string; label: string; end?: boolean }[] | null {
  if (path === '/' || /^\/(films|lists|members)$/.test(path)) return BROWSE_STRIP;
  if (/^\/(profile|library|watchlist|settings)$/.test(path)) return PROFILE_STRIP;
  return null;
}

export function AppShell(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [logging, setLogging] = useState(false);

  const path = location.pathname;
  const override = useScreenHeaderConfig();
  const route = ROUTE_TITLES.find((r) => r.match.test(path));
  const title = override?.title ?? route?.title ?? 'Cinelog';
  const hidden = override?.hidden ?? false;
  const back = override?.back ?? route?.back ?? tabForPath(path) === null;
  const strip = stripForPath(path);
  const activeTab = tabForPath(path);

  // A phone app opens each screen at its top. Without this, tapping a poster
  // from halfway down a grid lands you halfway down the film page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  // The home-screen icon's "Log a film" shortcut (see manifest.webmanifest)
  // launches at `/?log=1`; consume the flag so a refresh doesn't reopen it.
  const [search, setSearch] = useSearchParams();
  useEffect(() => {
    if (search.get('log') !== '1') return;
    setLogging(true);
    const next = new URLSearchParams(search);
    next.delete('log');
    setSearch(next, { replace: true });
  }, [search, setSearch]);

  return (
    <div className="min-h-full pl-safe pr-safe">
      {!hidden && (
        <header className="sticky top-0 z-40 border-b-2 border-border-hi bg-bg-2/95 pt-safe backdrop-blur-sm">
          <div className="grid h-12 grid-cols-[3rem_minmax(0,1fr)_3rem] items-center">
            {back ? (
              <button
                onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
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

          {strip && (
            <nav className="flex gap-0.5 overflow-x-auto px-2 scrollbar-none">
              {strip.map((s) => (
                <NavLink
                  key={s.to}
                  to={s.to}
                  end={s.end}
                  className={({ isActive }) =>
                    cn(
                      'shrink-0 whitespace-nowrap border-b-2 px-3 pb-2 pt-1 font-cond text-[13px] font-bold uppercase tracking-[0.13em]',
                      isActive ? 'border-gold text-content' : 'border-transparent text-muted',
                    )
                  }
                >
                  {s.label}
                </NavLink>
              ))}
            </nav>
          )}
        </header>
      )}

      {/* Clearance for the fixed tab bar, which would otherwise sit on top of
          the last row of every screen. */}
      <main className="pb-tabbar">
        <Outlet />
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border-hi bg-bg-2 pb-safe pl-safe pr-safe"
      >
        <div className="mx-auto flex h-[3.5rem] max-w-md items-stretch">
          {TABS.slice(0, 2).map((t) => (
            <TabButton key={t.key} tab={t} active={activeTab === t.key} />
          ))}

          {/* The log action, struck through the centre of the bar. */}
          <div className="flex flex-1 items-center justify-center">
            <button
              onClick={() => setLogging(true)}
              aria-label="Log a film"
              className="grid h-11 w-11 place-items-center rounded-sm border-2 border-gold text-gold active:bg-gold active:text-ink"
            >
              <IconPlus className="h-6 w-6" />
            </button>
          </div>

          {TABS.slice(2).map((t) => (
            <TabButton key={t.key} tab={t} active={activeTab === t.key} />
          ))}
        </div>
      </nav>

      {logging && <LogModal onClose={() => setLogging(false)} />}
      <UpdateToast />
    </div>
  );
}

function TabButton({ tab, active }: { tab: Tab; active: boolean }): JSX.Element {
  const Icon = tab.icon;
  return (
    <Link
      to={tab.to}
      aria-label={tab.label}
      aria-current={active ? 'page' : undefined}
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
