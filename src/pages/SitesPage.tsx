import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { useSummaries } from '../store/hooks';
import { Bar, Delta, Empty, Seg, StatusDot, SysTag } from '../components/ui';
import type { SiteStatus } from '../types';
import { daysBetween, fmtDate, today } from '../lib/util';

type Filter = 'all' | SiteStatus;

export default function SitesPage() {
  const summaries = useSummaries();
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const list = summaries
    .filter((s) => filter === 'all' || s.site.status === filter)
    .sort((a, b) => a.site.code.localeCompare(b.site.code));
  const c = (st: SiteStatus) => summaries.filter((s) => s.site.status === st).length;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__title">
          <span className="label">{summaries.length} sites</span>
          <h1 className="h1">Sites</h1>
        </div>
        <div className="page-head__actions">
          <Link to="/sites/new" className="btn btn--primary">
            <Plus /> New site
          </Link>
        </div>
      </div>
      <div className="daily__bar">
        <Seg
          label="Filter by status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: summaries.length },
            { value: 'active', label: 'Active', count: c('active') },
            { value: 'snagging', label: 'Snagging', count: c('snagging') },
            { value: 'on-hold', label: 'On hold', count: c('on-hold') },
            { value: 'completed', label: 'Completed', count: c('completed') },
          ]}
        />
      </div>
      <section className="card">
        {list.length ? (
          <div className="table-wrap">
            <table className="table sites-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Site</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th className="r">Today</th>
                  <th className="r">Crew</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const left = daysBetween(today(), s.site.targetDate);
                  return (
                    <tr key={s.site.id} className="click-row" onClick={() => nav(`/sites/${s.site.id}`)}>
                      <td><span className="site-head__ref">{s.ref}</span></td>
                      <td>
                        <Link to={`/sites/${s.site.id}`} className="sites-table__name" onClick={(e) => e.stopPropagation()}>
                          {s.site.name}
                        </Link>
                        <div className="row small muted" style={{ gap: 6, marginTop: 2 }}>
                          <span className="mono">{s.site.code}</span>· {s.site.area}
                          {s.site.systems.map((x) => <SysTag key={x} s={x} />)}
                        </div>
                      </td>
                      <td><StatusDot s={s.site.status} /></td>
                      <td style={{ minWidth: 180 }}>
                        <div className="row">
                          <b className="mono" style={{ width: 38 }}>{Math.round(s.progress.overall * 100)}%</b>
                          <div className="grow"><Bar value={s.progress.overall} kind={s.progress.overall >= 1 ? 'done' : undefined} label="Overall progress" /></div>
                        </div>
                      </td>
                      <td className="r"><Delta v={s.delta} /></td>
                      <td className="r">{s.crew}</td>
                      <td className="nowrap">
                        {fmtDate(s.site.targetDate)}
                        {s.site.status !== 'completed' && (
                          <small className={`block ${left < 0 ? 'text-flame' : 'muted'}`}>{left < 0 ? `${-left} days late` : `${left} days left`}</small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<Building2 />} title="No sites with this status" />
        )}
      </section>
    </div>
  );
}
