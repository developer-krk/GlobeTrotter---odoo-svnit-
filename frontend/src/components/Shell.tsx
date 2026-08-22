import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { CalendarDays, Compass, LayoutGrid, LogOut, MapPinned, Menu, MessageSquare, Route, Shield, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Brand } from './Brand';
import { Avatar } from './Plate';
import { Button } from './ui';

const NAV = [
  { to: '/', label: 'Home', icon: LayoutGrid, end: true },
  { to: '/trips', label: 'My trips', icon: Route },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/community', label: 'Community', icon: MessageSquare },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const closeAccount = () => setAccountOpen(false);

  /*
   * Close the account menu on a click outside it, or on Escape.
   *
   * Closing on blur instead would race the click: the button loses focus on
   * mouse-down, so any click held longer than the grace period unmounted the
   * menu before mouse-up, and the link never fired.
   */
  useEffect(() => {
    if (!accountOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountOpen]);

  const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-surface/92 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-4">
          <button className="-ml-1 rounded p-1.5 text-slate md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <Link to="/" className="mr-1 shrink-0"><Brand /></Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex h-9 items-center gap-1.5 rounded-[9px] px-2.5 text-[13.5px] font-medium transition-colors ${
                    isActive ? 'bg-route-soft text-route' : 'text-slate hover:bg-canvas hover:text-ink'
                  }`
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => navigate('/trips/new')}>
              <MapPinned size={14} />
              <span className="hidden sm:inline">Plan a trip</span>
            </Button>

            <div className="relative" ref={accountRef}>
              <button
                onClick={() => setAccountOpen((v) => !v)}
                className="rounded-full ring-offset-2 transition hover:opacity-85"
                aria-label="Account"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <Avatar name={name} src={user?.photo_url} size={32} />
              </button>

              {accountOpen && (
                <div
                  role="menu"
                  className="rise card absolute right-0 top-11 w-56 overflow-hidden p-1 shadow-[0_12px_30px_-12px_rgba(11,27,43,0.3)]"
                >
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="truncate text-[12px] text-mist">{user?.email}</p>
                  </div>
                  <hr />
                  <MenuItem to="/profile" icon={UserIcon} onSelect={closeAccount}>Profile and settings</MenuItem>
                  {user?.role === 'admin' && (
                    <MenuItem to="/admin" icon={Shield} onSelect={closeAccount}>Admin dashboard</MenuItem>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => { closeAccount(); logout(); navigate('/login'); }}
                    className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[13.5px] text-flag hover:bg-flag-soft"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t bg-surface px-3 py-2 md:hidden">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-sm font-medium ${
                    isActive ? 'bg-route-soft text-route' : 'text-slate'
                  }`
                }
              >
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-6 pb-20">{children}</main>

      <footer className="border-t bg-surface">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[12.5px] text-mist">
          <span className="eyebrow">GlobeTrotter — plan it before you pack</span>
          <span className="num">Built for the Odoo x SVNIT hackathon</span>
        </div>
      </footer>
    </div>
  );
}

function MenuItem({ to, icon: Icon, onSelect, children }: {
  to: string; icon: any; onSelect: () => void; children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onSelect}
      className="flex items-center gap-2 rounded-[8px] px-3 py-2 text-[13.5px] text-ink hover:bg-canvas"
    >
      <Icon size={15} className="text-slate" /> {children}
    </Link>
  );
}
