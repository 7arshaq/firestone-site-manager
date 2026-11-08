import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Package, Plus, Search, Share2, Users } from 'lucide-react';
import AllSitesShare from '../components/AllSitesShare';
import UaeMap, { type MapSite } from '../components/UaeMap';
import { useSummaries, type SiteSummary } from '../store/hooks';
import { useStore } from '../store/store';
import { Bar, Delta, Empty, Seg, SysTag, StatusDot } from '../components/ui';
import { fmtDay, fmtSheetDate, isMiddayBreakSeason, today } from '../lib/util';

type Filter = 'current' | 'snagging' | 'on-hold' | 'completed' | 'all';

export default function MapHome() {
  const t = today();
  const summaries = useSummaries(t);
  const engineer = useStore((s) => s.settings.engineerName);
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>('current');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [sharing, setSharing] = useState(false);

  const counts = useMemo(() => {
    const c = { current: 0, snagging: 0, 'on-hold': 0, completed: 0, all: summaries.length };
    for (const s of summaries) {
      if (s.site.status === 'active' || s.site.status === 'snagging') c.current++;
      if (s.site.status === 'snagging') c.snagging++;
      if (s.site.status === 'on-hold') c['on-hold']++;
      if (s.site.status === 'completed') c.completed++;
    }
    return c;
  }, [summaries]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return summaries
      .filter((s) => {
        const st = s.site.status;
        if (filter === 'current' && !(st === 'active' || st === 'snagging')) return false;
        if (filter !== 'current' && filter !== 'all' && st !== filter) return false;
        if (!needle) return true;
        return [s.site.name, s.site.code, s.site.area, s.site.client, s.site.emirate].some((x) => x.toLowerCase().includes(needle));
      })
      .sort((a, b) => a.ref.localeCompare(b.ref) || a.site.code.localeCompare(b.site.code));
  }, [summaries, filter, q]);

  const mapSites: MapSite[] = useMemo(
    () =>
      list.map((s) => ({
        id: s.site.id, code: s.site.code, name: s.site.name, lat: s.site.lat, lng: s.site.lng, status: s.site.status,
        progress: s.progress.overall, fa: s.progress.FA, ff: s.progress.FF, crew: s.crew,
      })),
    [list],
  );

  const current = summaries.filter((s) => s.site.status === 'active' || s.site.status === 'snagging');
  const crew = current.reduce((a, s) => a + s.crew, 0);
  const blocked = current.reduce((a, s) => a + s.blocked, 0);
  const alerts = current.reduce((a, s) => a + s.alerts, 0);
  const desktop = () => window.matchMedia('(min-width: 901px)').matches;

  const pickFromList = (id: string) => {
    if (!desktop()) return nav(`/sites/${id}`);
    setSelected(id);
    setFocus({ id, n: Date.now() });
  };

  return (
    <div className="home">
      <section className="home__map" aria-label="Site map">
        <UaeMap
          sites={mapSites}
          selectedId={selected}
          hoverId={hover}
          focus={focus}
          onSelect={setSelected}
          onHover={setHover}
          onOpen={(id) => nav(`/sites/${id}`)}
          engineer={engineer}
          dateLabel={fmtSheetDate(t)}
        />
      </section>

      <aside className="home__list">
        <header className="home__head">
          <div className="row row--between">
            <span className="label">{fmtDay(t)} {t.slice(0, 4)}</span>
            <span className="row" style={{ gap: 6 }}>
              {summaries.length > 0 && (
                <button className="btn btn--sm" onClick={() => setSharing(true)} title="WhatsApp and PDF summaries covering every site">
                  <Share2 /> Share
                </button>
              )}
              <Link to="/sites/new" className="btn btn--primary btn--sm">
                <Plus /> New site
              </Link>
            </span>
          </div>
          <h1 className="h1">Your sites</h1>
          <p className="home__today">
            <span><Users aria-hidden /> <b>{crew}</b> on site today</span>
            <span className={blocked ? 'is-warn' : ''}><AlertTriangle aria-hidden /> <b>{blocked}</b> hold-up{blocked === 1 ? '' : 's'}</span>
            <span className={alerts ? 'is-warn' : ''}><Package aria-hidden /> <b>{alerts}</b> material{alerts === 1 ? '' : 's'} low</span>
          </p>
          {isMiddayBreakSeason(t) && (
            <p className="midday">Midday break in force · no outdoor work 12:30–15:00 until 15 Sep</p>
          )}
          <div className="home__search">
            <Search aria-hidden />
            <input className="input" placeholder="Search site, code, area or client" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search sites" />
          </div>
          <Seg
            label="Filter sites"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'current', label: 'Current', count: counts.current },
              { value: 'on-hold', label: 'On hold', count: counts['on-hold'] },
              { value: 'completed', label: 'Done', count: counts.completed },
              { value: 'all', label: 'All', count: counts.all },
            ]}
          />
        </header>

        <div className="home__cards">
          {list.map((s) => (
            <SiteCard
              key={s.site.id}
              s={s}
              selected={selected === s.site.id}
              hover={hover === s.site.id}
              onHover={setHover}
              onPick={pickFromList}
            />
          ))}
          {!list.length && (
            <Empty
              title={q ? 'No sites match your search' : 'No sites here yet'}
              action={
                <Link to="/sites/new" className="btn btn--primary">
                  <Plus /> Add a site
                </Link>
              }
            >
              {q ? 'Try a site code like AUH-118, or an area name.' : 'Add your first site to see it on the map.'}
            </Empty>
          )}
        </div>
      </aside>
      {sharing && <AllSitesShare onClose={() => setSharing(false)} />}
    </div>
  );
}

function SiteCard({ s, selected, hover, onHover, onPick }: { s: SiteSummary; selected: boolean; hover: boolean; onHover: (id: string | null) => void; onPick: (id: string) => void }) {
  const { site, progress } = s;
  return (
    <article
      className={`site-card ${selected ? 'is-selected' : ''} ${hover ? 'is-hover' : ''}`}
      onMouseEnter={() => onHover(site.id)}
      onMouseLeave={() => onHover(null)}
    >
      <button className="site-card__hit" onClick={() => onPick(site.id)} aria-label={`Show ${site.name} on the map`} />
      <div className="site-card__ref" title="Grid reference on the map sheet">{s.ref}</div>
      <div className="site-card__main">
        <div className="site-card__eyebrow">
          <span className="label truncate">
            {site.code} · {site.area || site.emirate}
          </span>
          <span className="row" style={{ gap: 4 }}>
            {site.systems.map((x) => (
              <SysTag key={x} s={x} />
            ))}
          </span>
        </div>
        <h2 className="site-card__name">{site.name}</h2>
        <div className="site-card__prog">
          <span className="site-card__pct display">{Math.round(progress.overall * 100)}<small>%</small></span>
          <div className="site-card__bars">
            {progress.FA !== null && (
              <div className="mini-bar">
                <Bar value={progress.FA} kind="FA" thin label="Fire alarm progress" />
                <span className="mono">FA {Math.round(progress.FA * 100)}</span>
              </div>
            )}
            {progress.FF !== null && (
              <div className="mini-bar">
                <Bar value={progress.FF} kind="FF" thin label="Fire fighting progress" />
                <span className="mono">FF {Math.round(progress.FF * 100)}</span>
              </div>
            )}
          </div>
          <Delta v={s.delta} />
        </div>
        <div className="site-card__meta">
          <StatusDot s={site.status} />
          <span>{s.crew} on site</span>
          {s.blocked > 0 && <span className="pill pill--flame">{s.blocked} hold-up</span>}
          {s.alerts > 0 && <span className="pill pill--amber">{s.alerts} low stock</span>}
        </div>
      </div>
      <Link to={`/sites/${site.id}`} className="site-card__open icon-btn" aria-label={`Open ${site.name}`}>
        <ArrowUpRight />
      </Link>
    </article>
  );
}
