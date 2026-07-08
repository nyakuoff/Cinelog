import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { Logo } from './Logo';
import { Avatar } from './Avatar';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/watchlist', label: 'Watchlist', end: false },
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
      <header className="sticky top-0 z-40 border-b border-border-hi/40 bg-bg-2/80 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" aria-label="Cinelog home">
            <Logo size={28} glow />
          </Link>

          <nav className="hidden gap-5 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'font-cond text-[13px] font-bold uppercase tracking-wide',
                    isActive ? 'text-content' : 'text-muted hover:text-content',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <form onSubmit={onSearch} className="ml-auto flex items-center">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-muted transition-colors focus-within:border-cyan">
              <span className="opacity-70">⌕</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search everything…"
                aria-label="Search"
                className="w-32 bg-transparent text-[13.5px] text-content outline-none placeholder:text-muted-2 sm:w-48"
              />
            </div>
          </form>

          <button
            onClick={() => navigate('/search')}
            className="hidden rounded-lg bg-accent px-3.5 py-2 font-cond text-[13px] font-extrabold uppercase tracking-wide text-ink hover:brightness-110 sm:inline-flex"
          >
            ＋ Log
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title={user?.username}
            >
              <Avatar user={user} size={32} />
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
                  to="/watchlist"
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                  className="block rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-content md:hidden"
                >
                  Watchlist
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                  className="block rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-content"
                >
                  Profile
                </Link>
                <Link
                  to="/import"
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                  className="block rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-content"
                >
                  Import from Letterboxd
                </Link>
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
