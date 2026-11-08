import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession, useStore } from './store/store';
import Shell from './components/Shell';
import { Toasts } from './components/ui';
import { Lockup } from './components/Brand';
import { useApplyTheme } from './store/ui';
import MapHome from './pages/MapHome';
import SiteLayout from './pages/site/SiteLayout';
import Overview from './pages/site/Overview';
import ScopeList from './pages/site/ScopeList';
import Daily from './pages/site/Daily';
import SiteTeam from './pages/site/SiteTeam';
import SiteMaterials from './pages/site/SiteMaterials';
import SiteExpenses from './pages/site/SiteExpenses';
import Photos from './pages/site/Photos';
import Report from './pages/site/Report';
// these two carry the Claude SDK and the PDF reader, so they load on first visit
const SiteForm = lazy(() => import('./pages/SiteForm'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
import CrewApp from './pages/CrewApp';

function useHydrated() {
  const [ok, setOk] = useState(useStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setOk(true));
    setOk(useStore.persist.hasHydrated());
    return unsub;
  }, []);
  return ok;
}

export default function App() {
  useApplyTheme();
  const hydrated = useHydrated();
  const initialised = useStore((s) => s.initialised);
  const crewMode = useSession((s) => s.crewMode);

  if (!hydrated || !initialised) {
    return (
      <div className="boot" role="status">
        <Lockup className="boot__logo" />
        <span className="label">Loading your sites</span>
      </div>
    );
  }

  if (crewMode) {
    return (
      <>
        <CrewApp />
        <Toasts />
      </>
    );
  }

  return (
    <>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<MapHome />} />
          <Route path="sites/new" element={<Lazy><SiteForm /></Lazy>} />
          <Route path="sites/:id/edit" element={<Lazy><SiteForm /></Lazy>} />
          <Route path="sites/:id" element={<SiteLayout />}>
            <Route index element={<Overview />} />
            <Route path="scope" element={<ScopeList />} />
            <Route path="daily" element={<Daily />} />
            <Route path="team" element={<SiteTeam />} />
            <Route path="materials" element={<SiteMaterials />} />
            <Route path="expenses" element={<SiteExpenses />} />
            <Route path="photos" element={<Photos />} />
            <Route path="report" element={<Report />} />
          </Route>
          <Route path="settings" element={<Lazy><SettingsPage /></Lazy>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toasts />
    </>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="page"><span className="label">Loading…</span></div>}>{children}</Suspense>;
}
