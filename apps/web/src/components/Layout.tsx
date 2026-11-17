import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { Logo } from './Logo';
import { Avatar } from './Avatar';
import { LogModal, useLogShortcut } from './LogModal';
import { InstallPrompt } from './InstallPrompt';
import { IconChevronDown, IconMenu, IconPlus, IconSearch, IconX } from './app/Icons';
import { Button, Spinner } from './ui';
import { UpdateToast } from './UpdateToast';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/films', label: 'Media', end: false },
  { to: '/lists', label: 'Lists', end: false },
  { to: '/members', label: 'Members', end: false },
  { to: '/activity', label: 'Activity', end: false },
];

/** Account dropdown — the member's own shelves, in the order a profile lists them. */
const MENU_LINKS = [
  { to: '/profile', label: 'Profile' },
  { to: '/profile/diary', label: 'Diary' },
  { to: '/profile/reviews', label: 'Reviews' },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/profile/lists', label: 'Lists' },
  { to: '/profile/likes', label: 'Likes' },
  { to: '/library', label: 'Library' },
  { to: '/settings', label: 'Settings' },
];

export function Layout(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [logging, setLogging] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const navToggleRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" jumps to search, as it does on Letterboxd — unless you're typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      // The masthead field is hidden on a phone; the search page has its own.
      if (searchRef.current?.offsetParent) searchRef.current.focus();
      else navigate('/search');
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hover opens the menu for a mouse only. A finger has no hover: on touch the
  // synthetic enter fired on the tap that was meant to follow the avatar link,
  // so the menu and the navigation fought. There the chevron is the menu and
  // the avatar is just a link.
  function openMenu(e: React.PointerEvent): void {
    if (e.pointerType !== 'mouse') return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenuOpen(true);
  }
  function closeMenuSoon(e: React.PointerEvent): void {
    if (e.pointerType !== 'mouse') return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMenuOpen(false), 180);
  }

  useEffect(() => {
    if (!menuOpen && !navOpen) return;
    // pointerdown, not mousedown: iOS Safari doesn't fire mousedown for taps
    // on non-interactive content, so menus never dismissed there.
    function onPointerDown(e: PointerEvent): void {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      // The toggle closes the drawer itself; closing here too would reopen it.
      if (
        navOpen &&
        navRef.current &&
        !navRef.current.contains(e.target as Node) &&
        !navToggleRef.current?.contains(e.target as Node)
      ) {
        setNavOpen(false);
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setNavOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, navOpen]);

  // The home-screen icon's "Log a title" shortcut (see manifest.webmanifest).
  useLogShortcut(setLogging);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  function onSearch(e: FormEvent): void {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
      setQ('');
      setNavOpen(false);
    }
  }

  return (
    <div className="min-h-full pl-safe pr-safe">
      <header className="sticky top-0 z-40 border-b-2 border-border-hi bg-bg-2 pt-safe">
        {/* gap-5 between every item overflows a 360px phone once the hamburger,
            wordmark, search and avatar are all present; the row then shunts the
            avatar off-screen. Narrower until there's room for it. */}
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:h-20 sm:gap-5 sm:px-6">
          <button
            ref={navToggleRef}
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
            aria-label="Toggle navigation"
            className="-ml-2.5 grid h-11 w-11 shrink-0 place-items-center rounded-sm text-content md:hidden"
          >
            {navOpen ? <IconX className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
          </button>

          <Link to="/" aria-label="Cinelog home" className="flex shrink-0 items-center">
            <Logo size={36} textClassName="text-xl sm:text-2xl" />
          </Link>

          <nav className="hidden gap-5 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'border-b-2 pb-0.5 font-cond text-[13px] font-bold uppercase tracking-[0.14em]',
                    isActive
                      ? 'border-gold text-content'
                      : 'border-transparent text-muted hover:text-content',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <form onSubmit={onSearch} className="ml-auto hidden items-center sm:flex">
            <div className="flex items-center gap-2 rounded-sm border border-border bg-bg px-3 py-2 text-muted transition-colors focus-within:border-gold">
              <IconSearch className="h-4 w-4 shrink-0" />
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                aria-label="Search"
                title="Press / to search"
                className="w-28 bg-transparent text-sm text-content outline-none placeholder:text-muted-2 md:w-44"
              />
            </div>
          </form>

          <Link
            to="/search"
            aria-label="Search"
            className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-sm text-content sm:hidden"
          >
            <IconSearch className="h-5 w-5" />
          </Link>

          <Button
            variant="primary"
            onClick={() => setLogging(true)}
            className="hidden sm:inline-flex"
          >
            <IconPlus className="h-4 w-4" /> Log
          </Button>

          <div
            className="relative flex shrink-0 items-center"
            ref={menuRef}
            onPointerEnter={openMenu}
            onPointerLeave={closeMenuSoon}
          >
            <Link
              to="/profile"
              title={user?.username}
              className="flex min-h-[2.75rem] items-center gap-2"
            >
              <Avatar user={user} size={32} />
              <span className="hidden max-w-[9rem] truncate font-cond text-[13px] font-bold uppercase tracking-[0.08em] text-muted hover:text-content lg:inline">
                {user?.username}
              </span>
            </Link>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
              className="-mr-2 grid h-11 w-9 place-items-center rounded-sm text-muted hover:text-content"
            >
              <IconChevronDown className="h-3.5 w-3.5" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-52 rounded-sm border border-border-hi bg-surface p-1.5 shadow-soft"
              >
                <div className="flex items-center gap-2.5 px-2 py-2">
                  <Avatar user={user} size={28} />
                  <span className="min-w-0 truncate text-sm text-content">{user?.username}</span>
                </div>
                <div className="my-1 h-px bg-border" />
                {MENU_LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                    className="block rounded-sm px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-content coarse:py-2.5"
                  >
                    {l.label}
                  </Link>
                ))}
                {user?.role === 'ADMIN' && (
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                    className="block rounded-sm px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-content coarse:py-2.5"
                  >
                    Admin
                  </Link>
                )}
                <div className="my-1 h-px bg-border" />
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                  className="w-full rounded-sm px-2.5 py-1.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-content coarse:py-2.5"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile nav drawer — the primary tabs live behind the account menu on
            phones, but Letterboxd's mobile pattern surfaces them from a
            hamburger instead, so nothing (Lists, Members, …) is ever hidden. */}
        {navOpen && (
          <div ref={navRef} className="border-t border-border-hi/40 bg-bg-2 px-4 py-3 md:hidden">
            <form onSubmit={onSearch} className="mb-3 flex items-center sm:hidden">
              <div className="flex w-full items-center gap-2 rounded-sm border border-border bg-bg px-3 py-2 text-muted focus-within:border-gold">
                <IconSearch className="h-4 w-4 shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  aria-label="Search"
                  className="w-full bg-transparent text-sm text-content outline-none placeholder:text-muted-2"
                />
              </div>
            </form>
            <nav className="flex flex-col">
              {NAV.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.end}
                  onClick={() => setNavOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'border-l-2 px-3 py-3 font-cond text-sm font-bold uppercase tracking-[0.12em]',
                      isActive
                        ? 'border-gold text-content'
                        : 'border-transparent text-muted hover:text-content',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Bottom clearance for the phone-only log button, which is fixed and
          would otherwise sit on top of the last row of whatever page this is. */}
      <main className="pb-24 sm:pb-0">
        <Suspense fallback={<Spinner center />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Compact log entry on phones, where the desktop "+ Log" button is hidden. */}
      <Button
        variant="primary"
        size="icon"
        onClick={() => setLogging(true)}
        aria-label="Log a title"
        className="fixed bottom-safe-5 right-5 z-30 !h-14 !w-14 shadow-lift sm:hidden"
      >
        <IconPlus className="h-7 w-7" />
      </Button>

      {logging && <LogModal onClose={() => setLogging(false)} />}

      <InstallPrompt />
      <UpdateToast />
    </div>
  );
}
