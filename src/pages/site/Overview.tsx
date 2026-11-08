import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Camera, CheckCircle2, ListChecks, Package } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useSiteCtx } from './SiteLayout';
import { useStore } from '../../store/store';
import { materialRows, progressHistory, sortScope } from '../../lib/progress';
import { crewOn } from '../../lib/notes';
import { TrendChart } from '../../components/Charts';
import { Avatar, Empty } from '../../components/ui';
import { KIND_LABEL } from '../../components/TaskBits';
import { Thumb } from '../../components/Photo';
import DrawingsCard from '../../components/DrawingsCard';
import { fmtDate, fmtDay, num, today } from '../../lib/util';

export default function Overview() {
  const s = useSiteCtx();
  const { site } = s;
  const t = today();
  const data = useStore(
    useShallow((st) => ({
      scopeItems: st.scopeItems, tasks: st.tasks, allocations: st.allocations, people: st.people,
      customMaterials: st.customMaterials, txns: st.txns, photos: st.photos,
    })),
  );
  const history = useMemo(() => progressHistory(site, data, 14, t), [site, data, t]);
  const crew = crewOn(data, site.id, t);
  const tasks = data.tasks.filter((x) => x.siteId === site.id && x.date === t);
  const blocked = tasks.filter((x) => x.status === 'blocked');
  const rows = useMemo(() => materialRows(site, data), [site, data]);
  const scope = sortScope(data.scopeItems.filter((i) => i.siteId === site.id));
  const pending = scope.filter((i) => !i.doneOn);
  const recent = scope.filter((i) => i.doneOn).slice(0, 4);
  const tickedTwoWeeks = scope.filter((i) => i.doneOn && i.doneOn >= history[0].date).length;
  const alerts = rows.filter((r) => r.state === 'short' || r.state === 'low');
  const photos = data.photos.filter((p) => p.siteId === site.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const count = (st: string) => tasks.filter((x) => x.status === st).length;

  return (
    <div className="overview">
      <div className="overview__main stack stack--lg">
        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="h2">Progress, last 14 days</h2>
              <p className="muted small">
                {tickedTwoWeeks} item{tickedTwoWeeks === 1 ? '' : 's'} ticked off the scope list in two weeks
              </p>
            </div>
          </div>
          <div className="card__body">
            <TrendChart data={history} label={`Overall progress for ${site.name} over the last 14 days`} />
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="h2">Scope list</h2>
              <p className="muted small">
                {scope.length - pending.length} of {scope.length} done · {pending.length} pending
              </p>
            </div>
            <Link to="scope" className="btn btn--sm">
              Open list <ArrowRight />
            </Link>
          </div>
          {scope.length ? (
            <ul className="pending-list pending-list--plain">
              {pending.slice(0, 8).map((i) => (
                <li key={i.id}>
                  <span className="grow">
                    {i.system && <span className={`sys sys--${i.system}`}>{i.system}</span>} {i.text}
                    {i.kind !== 'scope' && <span className={`kind kind--${i.kind}`}>{KIND_LABEL[i.kind]}</span>}
                  </span>
                </li>
              ))}
              {pending.length > 8 && <li className="muted small">and {pending.length - 8} more pending</li>}
              {recent.map((i) => (
                <li key={i.id} className="is-done">
                  <CheckCircle2 aria-hidden />
                  <span className="grow">{i.text}</span>
                  <span className="muted small nowrap">{fmtDate(i.doneOn!)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={<ListChecks />} title="No scope list yet" action={<Link to="scope" className="btn btn--primary">Write the scope list</Link>}>
              Write the site's scope as a to-do list. Progress is the share of items ticked off.
            </Empty>
          )}
        </section>
      </div>

      <aside className="overview__side stack stack--lg">
        <section className="card">
          <div className="card__head">
            <div>
              <span className="label">{fmtDay(t)}</span>
              <h2 className="h2">On site today</h2>
            </div>
            <Link to="team" className="btn btn--sm">
              Team <ArrowRight />
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
              <p className="muted small">Nobody is allocated here today. Choose the crew in the Team tab.</p>
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
            <Empty icon={<Package />} title={rows.length ? 'Nothing running low' : 'No materials added yet'}>
              {rows.length ? 'Materials being used all have stock on site.' : 'Add the materials this site needs in the Materials tab.'}
            </Empty>
          )}
        </section>

        {site.notes && (
          <section className="card">
            <div className="card__head">
              <h2 className="h2">Site notes</h2>
              <Link to={`/sites/${site.id}/edit`} className="btn btn--sm btn--ghost">Edit</Link>
            </div>
            <div className="card__body">
              <p className="note">{site.notes}</p>
            </div>
          </section>
        )}

        <DrawingsCard siteId={site.id} />

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
