import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Building2, CalendarCheck, FileText, HardHat, Map as MapIcon, MoreHorizontal, Package, Receipt, Settings, Users,
} from 'lucide-react';
import { Modal } from './ui';
import { Lockup, ThemeToggle } from './Brand';
import { useSession } from '../store/store';
import { useSummaries } from '../store/hooks';

const NAV = [
  { to: '/', label: 'Map', icon: MapIcon, end: true },
  { to: '/today', label: 'Today', icon: CalendarCheck },
  { to: '/sites', label: 'Sites', icon: Building2 },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/materials', label: 'Materials', icon: Package },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: FileText },
];

export default function Shell() {
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const enterCrew = useSession((s) => s.enterCrew);
  const summaries = useSummaries();
  const alerts = summaries.reduce((a, s) => a + s.alerts, 0);
  const blocked = summaries.reduce((a, s) => a + s.blocked, 0);
  const badge = (to: string) => (to === '/materials' ? alerts : to === '/today' ? blocked : 0);
  const moreActive = ['/materials', '/expenses', '/reports', '/settings'].some((p) => loc.pathname.startsWith(p));

  return (
    <div className="shell">
      <nav className="rail" aria-label="Main">
        <NavLink to="/" className="brand" aria-label="Firestone — home">
          <Lockup className="brand__logo" />
        </NavLink>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="rail__link">
            <Icon aria-hidden />
            {label}
            {badge(to) > 0 && <span className="rail__badge" aria-label={`${badge(to)} need attention`}>{badge(to)}</span>}
          </NavLink>
        ))}
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
        </div>
      </header>

      <main className="main" id="main">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.slice(0, 4).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}>
            <Icon aria-hidden />
            {label}
            {badge(to) > 0 && <span className="tabbar__badge">{badge(to)}</span>}
          </NavLink>
        ))}
        <button className={moreActive ? 'active' : ''} onClick={() => setMore(true)} aria-haspopup="dialog">
          <MoreHorizontal aria-hidden />
          More
          {alerts > 0 && <span className="tabbar__badge">{alerts}</span>}
        </button>
      </nav>

      {more && (
        <Modal title="More" onClose={() => setMore(false)} size="narrow">
          <div className="more-grid" onClick={(e) => (e.target as HTMLElement).closest('a,button') && setMore(false)}>
            {NAV.slice(4).map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to}>
                <Icon aria-hidden />
                <span className="grow">{label}</span>
                {badge(to) > 0 && <span className="pill pill--flame">{badge(to)}</span>}
              </NavLink>
            ))}
            <NavLink to="/settings">
              <Settings aria-hidden />
              <span className="grow">Settings</span>
            </NavLink>
            <button onClick={enterCrew}>
              <HardHat aria-hidden />
              <span className="grow">Crew mode</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
