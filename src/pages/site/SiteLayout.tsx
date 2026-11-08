import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, ClipboardList, FileText, Gauge, Layers, Package, Pencil, Receipt, Users } from 'lucide-react';
import { useSummaries, type SiteSummary } from '../../store/hooks';
import { Bar, Delta, Empty, StatusDot, SysTag } from '../../components/ui';
import { daysBetween, fmtSheetDate, placeName, today } from '../../lib/util';

const TABS = [
  { to: '', label: 'Overview', icon: Gauge, end: true },
  { to: 'daily', label: 'Today', icon: ClipboardList },
  { to: 'team', label: 'Team', icon: Users },
  { to: 'scope', label: 'Scope & progress', icon: Layers },
  { to: 'materials', label: 'Materials', icon: Package },
  { to: 'expenses', label: 'Expenses', icon: Receipt },
  { to: 'photos', label: 'Photos', icon: Camera },
  { to: 'report', label: 'Report', icon: FileText },
];

export function useSiteCtx() {
  return useOutletContext<SiteSummary>();
}

export default function SiteLayout() {
  const { id } = useParams();
  const summaries = useSummaries();
  const s = summaries.find((x) => x.site.id === id);

  if (!s) {
    return (
      <div className="page">
        <Empty title="This site no longer exists" action={<Link to="/" className="btn">Back to the map</Link>}>
          It may have been deleted, or the link is from another device.
        </Empty>
      </div>
    );
  }

  const { site, progress } = s;
  const left = daysBetween(today(), site.targetDate);

  return (
    <div className="page site-page">
      <Link to="/" className="back-link">
        <ArrowLeft aria-hidden /> Map
      </Link>

      <header className="site-head">
        <div className="site-head__top">
          <div className="site-head__id">
            <span className="site-head__ref" title="Grid reference on the map sheet">{s.ref}</span>
            <span className="label">
              {site.code} · {placeName(site)}
            </span>
            {site.systems.map((x) => (
              <SysTag key={x} s={x} />
            ))}
            <StatusDot s={site.status} />
          </div>
          <div className="page-head__actions">
            <Link to={`/sites/${site.id}/edit`} className="btn btn--sm">
              <Pencil /> Edit site
            </Link>
            <Link to="report" className="btn btn--sm btn--primary">
              <FileText /> Today's report
            </Link>
          </div>
        </div>

        <div className="site-head__main">
          <h1 className="h1 site-head__name">{site.name}</h1>
          <div className="site-head__progress">
            <div className="site-head__pct">
              <span className="display">{Math.round(progress.overall * 100)}<small>%</small></span>
              <span className="label">
                Overall <Delta v={s.delta} />
              </span>
            </div>
            <div className="site-head__bars">
              {progress.FA !== null && (
                <div className="sys-bar">
                  <span className="sys-bar__name">Fire alarm</span>
                  <Bar value={progress.FA} kind="FA" label="Fire alarm progress" />
                  <b className="mono">{Math.round(progress.FA * 100)}%</b>
                </div>
              )}
              {progress.FF !== null && (
                <div className="sys-bar">
                  <span className="sys-bar__name">Fire fighting</span>
                  <Bar value={progress.FF} kind="FF" label="Fire fighting progress" />
                  <b className="mono">{Math.round(progress.FF * 100)}%</b>
                </div>
              )}
            </div>
          </div>
        </div>

        <dl className="tblock">
          <div>
            <dt>Client</dt>
            <dd>{site.client || '—'}</dd>
          </div>
          <div>
            <dt>Main contractor</dt>
            <dd>{site.contractor || '—'}</dd>
          </div>
          <div>
            <dt>Consultant</dt>
            <dd>{site.consultant || '—'}</dd>
          </div>
          <div>
            <dt>Start</dt>
            <dd className="mono">{fmtSheetDate(site.startDate)}</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd className="mono">
              {fmtSheetDate(site.targetDate)}
              {site.status !== 'completed' && (
                <span className={`tblock__due ${left < 0 ? 'is-late' : ''}`}>{left < 0 ? `${-left} d late` : `${left} d left`}</span>
              )}
            </dd>
          </div>
        </dl>
      </header>

      <nav className="tabs site-tabs" aria-label="Site sections">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={label} to={to} end={end}>
            <Icon aria-hidden />
            {label}
            {label === 'Today' && s.blocked > 0 && <span className="pill pill--flame">{s.blocked}</span>}
            {label === 'Materials' && s.alerts > 0 && <span className="pill pill--amber">{s.alerts}</span>}
            {label === 'Team' && s.crew > 0 && <span className="pill">{s.crew}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="site-body">
        <Outlet context={s} />
      </div>
    </div>
  );
}
