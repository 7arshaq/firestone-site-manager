import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageSquareText, PackageCheck } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { getData, useStore } from '../store/store';
import { materialRows } from '../lib/progress';
import { materialRequestNote } from '../lib/notes';
import { ShareText } from '../components/ShareText';
import { Bar, Empty, SysTag } from '../components/ui';
import type { Site } from '../types';
import { num } from '../lib/util';

export default function MaterialsPage() {
  const d = useStore(useShallow((s) => ({ sites: s.sites, overrides: s.overrides, customMaterials: s.customMaterials, txns: s.txns })));
  const [request, setRequest] = useState<Site | null>(null);
  const data = useMemo(
    () =>
      d.sites
        .filter((s) => s.status !== 'completed')
        .map((site) => {
          const { rows } = materialRows(site, d);
          const req = rows.reduce((a, r) => a + (r.estimate > 0 ? 1 : 0), 0);
          const fully = rows.filter((r) => r.delivered >= r.estimate && r.estimate > 0).length;
          return { site, rows, alerts: rows.filter((r) => r.state === 'short' || r.state === 'low'), pending: rows.filter((r) => r.state === 'none').length, delivered: req ? fully / req : 0 };
        })
        .sort((a, b) => b.alerts.length - a.alerts.length || a.site.code.localeCompare(b.site.code)),
    [d],
  );
  const totalAlerts = data.reduce((a, x) => a + x.alerts.length, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__title">
          <span className="label">All current sites</span>
          <h1 className="h1">Materials</h1>
          <p className="muted">{totalAlerts ? `${totalAlerts} materials are running low or out on site.` : 'Every material being installed has stock on site.'}</p>
        </div>
      </div>

      <div className="stack stack--lg">
        {data.map(({ site, alerts, pending, delivered }) => (
          <section key={site.id} className="card">
            <div className="card__head">
              <div className="grow">
                <span className="label">{site.code} · {site.area}</span>
                <h2 className="h2">{site.name}</h2>
              </div>
              <div className="mat-summary">
                <div>
                  <span className="label">Fully delivered</span>
                  <div className="row" style={{ gap: 8, width: 150 }}>
                    <div className="grow"><Bar value={delivered} thin label="Share of materials fully delivered" /></div>
                    <b className="mono small">{Math.round(delivered * 100)}%</b>
                  </div>
                </div>
                <div>
                  <span className="label">Not yet delivered</span>
                  <b className="mono">{pending}</b>
                </div>
              </div>
              <div className="row">
                {alerts.length > 0 && (
                  <button className="btn btn--sm" onClick={() => setRequest(site)}>
                    <MessageSquareText /> Request
                  </button>
                )}
                <Link to={`/sites/${site.id}/materials`} className="btn btn--sm">
                  Open <ArrowRight />
                </Link>
              </div>
            </div>
            {alerts.length ? (
              <ul className="alert-list">
                {alerts.map((r) => (
                  <li key={r.key}>
                    <span className={`dot dot--${r.state}`} aria-hidden />
                    <SysTag s={r.system} />
                    <span className="grow">
                      {r.name}
                      <small className="muted">{r.state === 'short' ? 'None left on site' : `${num(r.onSite)} ${r.unit} left`} · {num(r.used)} of {num(r.estimate)} used</small>
                    </span>
                    <span className="mono small">
                      {num(r.toDeliver || Math.max(0, r.estimate - r.used - r.onSite))} {r.unit}
                      <small className="muted">to deliver</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card__body muted small row"><PackageCheck size={16} /> Nothing running low.</p>
            )}
          </section>
        ))}
        {!data.length && <Empty title="No current sites" />}
      </div>

      {request && (
        <ShareText title="Material request" eyebrow={request.code} initial={materialRequestNote(request, getData())} onClose={() => setRequest(null)} />
      )}
    </div>
  );
}
