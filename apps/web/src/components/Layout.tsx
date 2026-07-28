import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { Logo } from './Logo';
import { Avatar } from './Avatar';
import { LogModal } from './LogModal';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/films', label: 'Media', end: false },
  { to: '/lists', label: 'Lists', end: false },
  { to: '/members', label: 'Members', end: false },
  { to: '/library', label: 'Library', end: false },
  { to: '/watchlist', label: 'Watchlist', end: false },
];

/** Account dropdown — mirrors the shortcut set a member reaches from their avatar. */
const MENU_LINKS = [
  { to: '/profile', label: 'Profile' },
  { to: '/library', label: 'Library' },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/settings', label: 'Settings' },
  { to: '/import', label: 'Import from Letterboxd' },
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

  // Click-to-open menu (not hover — hover gaps make the menu unreachable).
  useEffect(() => {
    if (!menuOpen && !navOpen) return;
    function onPointerDown(e: MouseEvent): void {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (navOpen && navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavOpen(false);
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setNavOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, navOpen]);

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
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b-2 border-border-hi bg-bg-2">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-5 px-4 sm:h-20 sm:px-6">
          <button
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
            aria-label="Toggle navigation"
            className="grid h-9 w-9 shrink-0 place-items-center rounded text-content md:hidden"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              {navOpen ? '✕' : '☰'}
            </span>
          </button>

          <Link to="/" aria-label="Cinelog home" className="flex shrink-0 items-center">
            <Logo size={36} textClassName="text-xl sm:text-2xl" glow />
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
              <span aria-hidden="true" className="opacity-70">
                ⌕
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                aria-label="Search"
                className="w-28 bg-transparent text-sm text-content outline-none placeholder:text-muted-2 md:w-44"
              />
            </div>
          </form>

          <Link
            to="/search"
            aria-label="Search"
            className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded text-content sm:hidden"
          >
            <span aria-hidden="true" className="text-lg opacity-80">
              ⌕
            </span>
          </Link>

          <button
            onClick={() => setLogging(true)}
            className="hidden shrink-0 rounded-sm bg-accent px-3.5 py-2 font-cond text-[13px] font-extrabold uppercase tracking-[0.1em] text-ink hover:bg-gold/90 sm:inline-flex"
          >
            + Log
          </button>

          <div className="relative flex shrink-0 items-center gap-1.5" ref={menuRef}>
            <Link to="/profile" title={user?.username} className="flex items-center gap-2">
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
              className="grid h-7 w-7 place-items-center rounded text-muted hover:text-content"
            >
              <span aria-hidden="true" className="text-xs">
                ▾
              </span>
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
                    className="block rounded-sm px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-content"
                  >
                    {l.label}
                  </Link>
                ))}
                {user?.role === 'ADMIN' && (
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                    className="block rounded-sm px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-content"
                  >
                    Admin panel
                  </Link>
                )}
                <div className="my-1 h-px bg-border" />
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                  className="w-full rounded-sm px-2.5 py-1.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-content"
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
          <div
            ref={navRef}
            className="border-t border-border-hi/40 bg-bg-2 px-4 py-3 md:hidden"
          >
            <form onSubmit={onSearch} className="mb-3 flex items-center sm:hidden">
              <div className="flex w-full items-center gap-2 rounded-sm border border-border bg-bg px-3 py-2 text-muted focus-within:border-gold">
                <span aria-hidden="true" className="opacity-70">
                  ⌕
                </span>
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
                      'border-l-2 px-3 py-2.5 font-cond text-sm font-bold uppercase tracking-[0.12em]',
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

      <main>
        <Outlet />
      </main>

      {/* Compact log entry on phones, where the desktop "+ Log" button is hidden. */}
      <button
        onClick={() => setLogging(true)}
        aria-label="Log a film"
        className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-sm bg-accent font-cond text-2xl font-extrabold text-ink shadow-lift hover:bg-gold/90 sm:hidden"
      >
        +
      </button>

      {logging && <LogModal onClose={() => setLogging(false)} />}
    </div>
  );
}
