import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Camera, Info, Package } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useSiteCtx } from './SiteLayout';
import { useStore } from '../../store/store';
import { materialRows, progressHistory } from '../../lib/progress';
import { crewOn } from '../../lib/notes';
import { TrendChart } from '../../components/Charts';
import { Avatar, Bar, Empty } from '../../components/ui';
import { Thumb } from '../../components/Photo';
import { fmtDay, num, today } from '../../lib/util';

const BUILDING: Record<string, string> = {
  tower: 'Residential / mixed-use tower', villa: 'Villas', warehouse: 'Warehouse', mall: 'Mall / retail', school: 'School',
  hospital: 'Hospital / clinic', hotel: 'Hotel', office: 'Office building', 'labour-camp': 'Labour accommodation',
};
const CEILING = { 'false-ceiling': 'False ceiling', exposed: 'Exposed soffit', mixed: 'Mixed' } as const;

export default function Overview() {
  const s = useSiteCtx();
  const { site, progress } = s;
  const t = today();
  const data = useStore(
    useShallow((st) => ({
      workItems: st.workItems, tasks: st.tasks, allocations: st.allocations, people: st.people,
      overrides: st.overrides, customMaterials: st.customMaterials, txns: st.txns, photos: st.photos,
    })),
  );
  const history = useMemo(() => progressHistory(site, data, 14, t), [site, data, t]);
  const crew = crewOn(data, site.id, t);
  const tasks = data.tasks.filter((x) => x.siteId === site.id && x.date === t);
  const blocked = tasks.filter((x) => x.status === 'blocked');
  const { rows, advisories } = useMemo(() => materialRows(site, data), [site, data]);
  const alerts = rows.filter((r) => r.state === 'short' || r.state === 'low');
  const photos = data.photos.filter((p) => p.siteId === site.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const count = (st: string) => tasks.filter((x) => x.status === st).length;
  const c = site.conditions;
  const gained = history[history.length - 1].value - history[0].value;

  return (
    <div className="overview">
      <div className="overview__main stack stack--lg">
        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="h2">Overall progress, last 14 days</h2>
              <p className="muted small">
                +{(gained * 100).toFixed(1)}% in two weeks · about {(gained * 100 / 12).toFixed(1)}% per working day
              </p>
            </div>
          </div>
          <div className="card__body">
            <TrendChart data={history} label={`Overall progress for ${site.name} over the last 14 days`} />
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <h2 className="h2">Progress by stage</h2>
            <Link to="scope" className="btn btn--sm btn--ghost">
              Edit weights <ArrowRight />
            </Link>
          </div>
          <div className="card__body stages">
            {(['FA', 'FF'] as const)
              .filter((sys) => site.systems.includes(sys))
              .map((sys) => (
                <div key={sys} className="stages__group">
                  <div className="stages__title">
                    <span className={`sys sys--${sys}`}>{sys}</span>
                    <span className="h3">{sys === 'FA' ? 'Fire alarm' : 'Fire fighting'}</span>
                    <b className="mono">{Math.round((sys === 'FA' ? progress.FA : progress.FF)! * 100)}%</b>
                  </div>
                  {progress.items
                    .filter((p) => p.item.system === sys)
                    .map((p) => (
                      <div key={p.item.id} className={`stage ${p.frac >= 1 ? 'is-done' : p.frac > 0 ? 'is-going' : ''}`}>
                        <span className="stage__label">{p.item.label}</span>
                        <Bar value={p.frac} kind={p.frac >= 1 ? 'done' : sys} thin label={p.item.label} />
                        <span className="stage__qty mono">
                          {num(p.done)} / {num(p.item.qty)} {p.item.unit}
                        </span>
                        <span className="stage__pct mono">{Math.round(p.frac * 100)}%</span>
                      </div>
                    ))}
                </div>
              ))}
          </div>
        </section>
      </div>

      <aside className="overview__side stack stack--lg">
        <section className="card">
          <div className="card__head">
            <div>
              <span className="label">{fmtDay(t)}</span>
              <h2 className="h2">On site today</h2>
            </div>
            <Link to="daily" className="btn btn--sm">
              Daily <ArrowRight />
            </Link>
          </div>
          <div className="card__body stack">
            <div className="today-counts">
              <div><b className="mono">{crew.length}</b><span>crew</span></div>
              <div><b className="mono">{count('done')}</b><span>done</span></div>
              <div><b className="mono">{count('in-progress')}</b><span>ongoing</span></div>
              <div className={blocked.length ? 'is-warn' : ''}><b className="mono">{blocked.length}</b><span>on hold</span></div>
            </div>
            {crew.length > 0 ? (
              <div className="crew-row">
                {crew.map((p) => (
                  <span key={p.id} className="crew-chip" title={`${p.name} · ${p.role}`}>
                    <Avatar p={p} size={24} />
                    {p.name.split(' ')[0]}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted small">Nobody is allocated here today. Assign crew from the Daily tab or the Today board.</p>
            )}
            {blocked.map((b) => (
              <div key={b.id} className="holdup">
                <AlertTriangle aria-hidden />
                <div>
                  <b>{b.title}{b.location ? ` — ${b.location}` : ''}</b>
                  <p>{b.blockReason || 'Blocked'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <h2 className="h2">Materials to chase</h2>
            <Link to="materials" className="btn btn--sm">
              All materials <ArrowRight />
            </Link>
          </div>
          {alerts.length ? (
            <ul className="alert-list">
              {alerts.slice(0, 6).map((r) => (
                <li key={r.key}>
                  <span className={`dot dot--${r.state}`} aria-hidden />
                  <span className="grow">
                    {r.name}
                    <small className="muted">{r.state === 'short' ? 'None left on site' : `${num(r.onSite)} ${r.unit} left on site`}</small>
                  </span>
                  <span className="mono small">{num(r.toDeliver)} {r.unit}<small className="muted">to deliver</small></span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={<Package />} title="Nothing running low">Materials being installed all have stock on site.</Empty>
          )}
        </section>

        <section className="card">
          <div className="card__head">
            <h2 className="h2">Site conditions</h2>
            <Link to={`/sites/${site.id}/edit`} className="btn btn--sm btn--ghost">Edit</Link>
          </div>
          <div className="card__body stack">
            <dl className="facts">
              <div><dt>Building</dt><dd>{BUILDING[c.buildingType]}</dd></div>
              <div><dt>Levels</dt><dd>{c.floors} floor{c.floors === 1 ? '' : 's'}{c.basements ? ` + ${c.basements} basement` : ''}</dd></div>
              <div><dt>Ceiling</dt><dd>{CEILING[c.ceiling]} · {c.ceilingHeight} m</dd></div>
              <div><dt>Void depth</dt><dd>{c.ceiling === 'exposed' ? '—' : `${c.voidDepth} m`}</dd></div>
              <div><dt>Structure</dt><dd>{c.structure === 'steel' ? 'Steel' : 'Concrete'}</dd></div>
              <div><dt>Air-conditioned</dt><dd>{c.conditioned ? 'Yes' : 'No'}</dd></div>
            </dl>
            {advisories.map((a) => (
              <p key={a} className="advisory">
                <Info aria-hidden /> {a}
              </p>
            ))}
            {site.notes && <p className="note">{site.notes}</p>}
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <h2 className="h2">Latest photos</h2>
            <Link to="photos" className="btn btn--sm">
              <Camera /> Photos
            </Link>
          </div>
          {photos.length ? (
            <div className="card__body photo-strip">
              {photos.map((p) => (
                <Link key={p.id} to="photos">
                  <Thumb id={p.id} alt={p.caption || 'Site photo'} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty icon={<Camera />} title="No photos yet" action={<Link to="photos" className="btn btn--sm">Add photos</Link>}>
              Photos you add are kept on this device and can go into the daily PDF.
            </Empty>
          )}
        </section>
      </aside>
    </div>
  );
}
