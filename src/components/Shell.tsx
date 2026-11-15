import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Lock, Map as MapIcon, Settings } from 'lucide-react';
import { Lockup, ThemeToggle } from './Brand';
import { firstName, initials, ROLE_NAME, useAccount, useAuth } from '../data/accounts';

/**
 * The map is home. Everything about a site (team, today's tasks, materials, expenses, reports)
 * lives inside that site, so the side bar only needs the map and the app-wide switches.
 */
export default function Shell() {
  const loc = useLocation();
  const account = useAccount();
  const signOut = useAuth((s) => s.signOut);
  const onMap = loc.pathname === '/' || loc.pathname.startsWith('/sites');

  return (
    <div className="shell">
      <nav className="rail" aria-label="Main">
        <NavLink to="/" className="brand" aria-label="Firestone — home" data-brand-target>
          <Lockup className="brand__logo" />
        </NavLink>
        <NavLink to="/" className={`rail__link ${onMap ? 'active' : ''}`} aria-current={loc.pathname === '/' ? 'page' : undefined}>
          <MapIcon aria-hidden />
          Map
        </NavLink>
        <div className="rail__spacer" />
        <ThemeToggle className="rail__link" label />
        <NavLink to="/settings" className="rail__link">
          <Settings aria-hidden />
          Settings
        </NavLink>
        {account && (
          <button className="rail__user" onClick={signOut} title={`${account.name} · ${ROLE_NAME[account.role]} — lock so the next person signs in with their code`}>
            <span className={`rail__avatar ${account.role === 'dev' ? 'is-dev' : ''}`}>{account.role === 'dev' ? 'DEV' : initials(account)}</span>
            <span className="rail__who">{account.role === 'dev' ? 'Developer' : firstName(account)}</span>
            <span className="rail__lock">
              <Lock aria-hidden /> Lock
            </span>
          </button>
        )}
      </nav>

      <header className="topbar">
        <NavLink to="/" className="topbar__brand" aria-label="Firestone — home" data-brand-target>
          <Lockup layout="row" className="topbar__lockup" />
        </NavLink>
        <div className="row" style={{ gap: 2 }}>
          <ThemeToggle />
          <NavLink to="/settings" className="icon-btn" aria-label="Settings" title="Settings">
            <Settings />
          </NavLink>
          {account && (
            <button className="icon-btn" onClick={signOut} aria-label={`Lock — signed in as ${account.name}`} title="Lock">
              <Lock />
            </button>
          )}
        </div>
      </header>

      <main className="main" id="main">
        <Outlet />
      </main>
    </div>
  );
}
