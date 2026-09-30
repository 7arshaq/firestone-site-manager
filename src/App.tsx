import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession, useStore } from './store/store';
import { buildSample } from './data/seed';
import Shell from './components/Shell';
import { Toasts } from './components/ui';
import { Lockup } from './components/Brand';
import { useApplyTheme } from './store/ui';
import MapHome from './pages/MapHome';
import SitesPage from './pages/SitesPage';
import SiteForm from './pages/SiteForm';
import SiteLayout from './pages/site/SiteLayout';
import Overview from './pages/site/Overview';
import Scope from './pages/site/Scope';
import Daily from './pages/site/Daily';
import SiteMaterials from './pages/site/SiteMaterials';
import SiteExpenses from './pages/site/SiteExpenses';
import Photos from './pages/site/Photos';
import Report from './pages/site/Report';
import TodayPage from './pages/TodayPage';
import TeamPage from './pages/TeamPage';
import MaterialsPage from './pages/MaterialsPage';
import ExpensesPage from './pages/ExpensesPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
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

  useEffect(() => {
    if (hydrated && !initialised) useStore.getState().replaceAll(buildSample());
  }, [hydrated, initialised]);

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
          <Route path="today" element={<TodayPage />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="sites/new" element={<SiteForm />} />
          <Route path="sites/:id/edit" element={<SiteForm />} />
          <Route path="sites/:id" element={<SiteLayout />}>
            <Route index element={<Overview />} />
            <Route path="scope" element={<Scope />} />
            <Route path="daily" element={<Daily />} />
            <Route path="materials" element={<SiteMaterials />} />
            <Route path="expenses" element={<SiteExpenses />} />
            <Route path="photos" element={<Photos />} />
            <Route path="report" element={<Report />} />
          </Route>
          <Route path="team" element={<TeamPage />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toasts />
    </>
  );
}
