import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from './store/store';
import { TEAM_ACCOUNTS, useAccount, useAuth } from './data/accounts';
import Gate from './components/Gate';
import TechApp from './pages/TechApp';
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
  const people = useStore((s) => s.people);
  const account = useAccount();
  const signIn = useAuth((s) => s.signIn);
  // the sign-in screen: shown at start and after "Lock"; the boot animation plays only the first time
  const [gate, setGate] = useState(!account);
  // a tab that was already signed in (e.g. after a reload) has had its start-up animation
  const played = useRef(!!account);
  useEffect(() => {
    if (!account) setGate(true);
  }, [account]);

  // company technicians belong to the team, so the engineer can give them tasks
  useEffect(() => {
    if (!hydrated || !initialised) return;
    useStore.getState().ensurePeople(
      TEAM_ACCOUNTS.map((a) => ({ id: `acc-${a.id}`, name: a.name, role: 'technician', trade: 'both', phone: '', empNo: '', pin: '', active: true })),
    );
  }, [hydrated, initialised, people]);

  const sheet = (
    <>
      {account && (!hydrated || !initialised) && (
        <div className="boot" role="status">
          <Lockup className="boot__logo" />
          <span className="label">Loading your sites</span>
        </div>
      )}
      {account && hydrated && initialised && (account.role === 'technician' ? <TechApp account={account} /> : <Main />)}
      {gate && (
        <Gate
          intro={!played.current}
          onSignIn={(a) => signIn(a.id)}
          onDone={() => {
            played.current = true;
            setGate(false);
          }}
        />
      )}
      <Toasts />
    </>
  );
  return sheet;
}

/** Site engineer, project manager and developer: the full app */
function Main() {
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
    </>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="page"><span className="label">Loading…</span></div>}>{children}</Suspense>;
}
