import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { HardHat, Map as MapIcon, Settings } from 'lucide-react';
import { Lockup, ThemeToggle } from './Brand';
import { useSession } from '../store/store';

/**
 * The map is home. Everything about a site (team, today's tasks, materials, expenses, reports)
 * lives inside that site, so the side bar only needs the map and the app-wide switches.
 */
export default function Shell() {
  const loc = useLocation();
  const enterCrew = useSession((s) => s.enterCrew);
  const onMap = loc.pathname === '/' || loc.pathname.startsWith('/sites');

  return (
    <div className="shell">
      <nav className="rail" aria-label="Main">
        <NavLink to="/" className="brand" aria-label="Firestone — home">
          <Lockup className="brand__logo" />
        </NavLink>
        <NavLink to="/" className={`rail__link ${onMap ? 'active' : ''}`} aria-current={loc.pathname === '/' ? 'page' : undefined}>
          <MapIcon aria-hidden />
          Map
        </NavLink>
        <div className="rail__spacer" />
        <button className="rail__link" onClick={enterCrew} title="Hand this device to a foreman or technician">
          <HardHat aria-hidden />
          Crew mode
        </button>
        <ThemeToggle className="rail__link" label />
        <NavLink to="/settings" className="rail__link">
          <Settings aria-hidden />
          Settings
        </NavLink>
      </nav>

      <header className="topbar">
        <NavLink to="/" className="topbar__brand" aria-label="Firestone — home">
          <Lockup layout="row" className="topbar__lockup" />
        </NavLink>
        <div className="row" style={{ gap: 2 }}>
          <ThemeToggle />
          <button className="icon-btn" onClick={enterCrew} aria-label="Crew mode" title="Crew mode">
            <HardHat />
          </button>
          <NavLink to="/settings" className="icon-btn" aria-label="Settings" title="Settings">
            <Settings />
          </NavLink>
        </div>
      </header>

      <main className="main" id="main">
        <Outlet />
      </main>
    </div>
  );
}
