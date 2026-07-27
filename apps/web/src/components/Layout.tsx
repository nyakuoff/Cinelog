import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { Logo } from './Logo';
import { Avatar } from './Avatar';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/films', label: 'Films', end: false },
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
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click-to-open menu (not hover — hover gaps make the menu unreachable).
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function onSearch(e: FormEvent): void {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
      setQ('');
    }
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-border-hi/40 bg-bg-2/85 backdrop-blur-md">
        <div className="mx-auto flex h-[58px] max-w-6xl items-center gap-5 px-4 sm:px-6">
          <Link to="/" aria-label="Cinelog home" className="shrink-0">
            <Logo size={26} glow />
          </Link>

          <nav className="hidden gap-4 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'font-cond text-[12.5px] font-bold uppercase tracking-[0.1em]',
                    isActive ? 'text-content' : 'text-muted hover:text-content',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <form onSubmit={onSearch} className="ml-auto flex items-center">
            <div className="flex items-center gap-2 rounded border border-border bg-surface px-2.5 py-1.5 text-muted transition-colors focus-within:border-cyan">
              <span aria-hidden="true" className="opacity-70">
                ⌕
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                aria-label="Search"
                className="w-24 bg-transparent text-[13px] text-content outline-none placeholder:text-muted-2 sm:w-40"
              />
            </div>
          </form>

          <button
            onClick={() => navigate('/search')}
            className="hidden shrink-0 rounded bg-accent px-3 py-1.5 font-cond text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-ink hover:brightness-110 sm:inline-flex"
          >
            + Log
          </button>

          <div className="relative flex shrink-0 items-center gap-1.5" ref={menuRef}>
            <Link to="/profile" title={user?.username} className="flex items-center gap-2">
              <Avatar user={user} size={28} />
              <span className="hidden max-w-[9rem] truncate font-cond text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted hover:text-content lg:inline">
                {user?.username}
              </span>
            </Link>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
              className="grid h-6 w-6 place-items-center rounded text-muted hover:text-content"
            >
              <span aria-hidden="true" className="text-[10px]">
                ▾
              </span>
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-soft"
              >
                <div className="flex items-center gap-2.5 px-2 py-2">
                  <Avatar user={user} size={28} />
                  <span className="min-w-0 truncate text-sm text-content">{user?.username}</span>
                </div>
                <div className="my-1 h-px bg-border" />
                <Link
                  to="/films"
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                  className="block rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-content md:hidden"
                >
                  Films
                </Link>
                {MENU_LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                    className="block rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-content"
                  >
                    {l.label}
                  </Link>
                ))}
                {user?.role === 'ADMIN' && (
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                    className="block rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-content"
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
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-content"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
