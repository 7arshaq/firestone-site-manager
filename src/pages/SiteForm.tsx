import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Link2, ListChecks, MapPin, Trash2, X } from 'lucide-react';
import UaeMap, { gridRef } from '../components/UaeMap';
import DrawingAssistant from '../components/DrawingAssistant';
import SatelliteView from '../components/SatelliteView';
import { saveDrawingBlob } from '../store/drawings';
import { reverseGeocode, type Place } from '../lib/geocode';
import type { PickedDrawing } from '../lib/drawing-files';
import ScopeAdd from '../components/ScopeAdd';
import { KIND_LABEL } from '../components/TaskBits';
import { Confirm, NumField, Seg, toast } from '../components/ui';
import { useStore, type NewScopeItem } from '../store/store';
import type { DrawingMeta, Emirate, Site, SiteStatus, System } from '../types';
import { addDays, parseLatLng, today, uid } from '../lib/util';

const EMIRATES: Emirate[] = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
const PREFIX: Record<Emirate, string> = {
  'Abu Dhabi': 'AUH', Dubai: 'DXB', Sharjah: 'SHJ', Ajman: 'AJM', 'Umm Al Quwain': 'UAQ', 'Ras Al Khaimah': 'RAK', Fujairah: 'FUJ',
};
type Draft = Omit<Site, 'id' | 'createdAt'>;

function blank(code: string): Draft {
  return {
    code, name: '', client: '', contractor: '', consultant: '', emirate: 'Abu Dhabi', area: '', lat: 24.4539, lng: 54.3773,
    status: 'active', systems: ['FA', 'FF'], startDate: today(), targetDate: addDays(today(), 180),
    notes: '',
  };
}

export default function SiteForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const sites = useStore((s) => s.sites);
  const existing = sites.find((s) => s.id === id);
  const addSite = useStore((s) => s.addSite);
  const updateSite = useStore((s) => s.updateSite);
  const deleteSite = useStore((s) => s.deleteSite);
  const addDrawings = useStore((s) => s.addDrawings);
  const addScopeItems = useStore((s) => s.addScopeItems);
  const savedScope = useStore((s) => s.scopeItems.filter((i) => i.siteId === id).length);
  const nextCode = (e: Emirate) => {
    const nums = sites.filter((s) => s.code.startsWith(PREFIX[e])).map((s) => parseInt(s.code.split('-')[1] ?? '0', 10) || 0);
    return `${PREFIX[e]}-${String((nums.length ? Math.max(...nums) : 100) + 1).padStart(3, '0')}`;
  };
  const [f, setF] = useState<Draft>(() => {
    if (!existing) return blank(nextCode('Abu Dhabi'));
    const { id: _id, createdAt: _c, ...rest } = existing;
    return rest;
  });
  const [link, setLink] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [codeTouched, setCodeTouched] = useState(!!existing);
  const [picked, setPicked] = useState<PickedDrawing[]>([]);
  // a new site's pin only counts once the engineer has placed it
  const [pinSet, setPinSet] = useState(!!existing);
  const [view, setView] = useState<'map' | 'satellite'>('map');
  const [place, setPlace] = useState<Place | null>(null);
  // a new site's scope list, kept here until the site is saved
  const [scope, setScope] = useState<NewScopeItem[]>([]);
  const addScope = (items: NewScopeItem[]) => {
    if (existing) addScopeItems(existing.id, items);
    else setScope((x) => [...x, ...items]);
  };
  const placePin = (p: { lat: number; lng: number }) => {
    setF((x) => ({ ...x, lat: p.lat, lng: p.lng }));
    setPinSet(true);
  };

  useEffect(() => {
    if (!pinSet) return;
    let alive = true;
    const t = setTimeout(() => reverseGeocode(f.lat, f.lng).then((p) => alive && setPlace(p)), 600);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [pinSet, f.lat, f.lng]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggleSys = (s: System) => set('systems', f.systems.includes(s) ? f.systems.filter((x) => x !== s) : ([...f.systems, s].sort() as System[]));

  const keepDrawings = async (siteId: string) => {
    const list = picked.filter((p) => !p.error && (p.kind === 'pdf' || p.kind === 'image'));
    const metas: DrawingMeta[] = [];
    for (const p of list) {
      const meta: DrawingMeta = { id: uid(), siteId, name: p.file.name, kind: p.kind as 'pdf' | 'image', size: p.file.size, pages: p.pages, addedAt: new Date().toISOString() };
      await saveDrawingBlob(meta.id, p.file);
      metas.push(meta);
    }
    if (metas.length) addDrawings(metas);
  };

  const save = async () => {
    if (!f.name.trim()) return toast('Give the site a name');
    if (!f.systems.length) return toast('Choose fire alarm, fire fighting or both');
    if (existing) {
      updateSite(existing.id, f);
      await keepDrawings(existing.id);
      toast('Site saved');
      nav(`/sites/${existing.id}`);
    } else {
      const newId = addSite(f);
      if (scope.length) {
        const addedOn = f.startDate && f.startDate < today() ? f.startDate : today();
        addScopeItems(newId, scope.map((x) => ({ ...x, addedOn })));
      }
      await keepDrawings(newId);
      toast('Site added');
      nav(`/sites/${newId}`);
    }
  };

  const applyLink = (text: string) => {
    setLink(text);
    const p = parseLatLng(text);
    if (p) {
      placePin(p);
      toast('Location set from link');
    }
  };

  return (
    <div className="page">
      <Link to={existing ? `/sites/${existing.id}` : '/'} className="back-link">
        <ArrowLeft aria-hidden /> {existing ? existing.name : 'Map'}
      </Link>
      <div className="page-head">
        <div className="page-head__title">
          <span className="label">{existing ? 'Edit site' : 'New site'}</span>
          <h1 className="h1">{f.name || 'Untitled site'}</h1>
        </div>
        <div className="page-head__actions">
          {existing && (
            <button className="btn btn--danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete site
            </button>
          )}
          <button className="btn btn--primary" onClick={save}>
            {existing ? 'Save site' : 'Add site'}
          </button>
        </div>
      </div>

      <div className="site-form">
        <div className="stack stack--lg">
          <DrawingAssistant
            draft={f}
            setDraft={setF}
            picked={picked}
            setPicked={setPicked}
            pin={pinSet ? { lat: f.lat, lng: f.lng } : null}
            onPin={placePin}
            onFilled={(keys) => keys.includes('code') && setCodeTouched(true)}
            onScope={addScope}
          />

          <section className="card">
            <div className="card__head"><h2 className="h2">Project</h2></div>
            <div className="card__body form-grid form-grid--2">
              <label className="field span-all">
                <span>Site name</span>
                <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Reem Island Residential Tower C" autoFocus={!existing} />
              </label>
              <label className="field">
                <span>Project code</span>
                <input className="input mono" value={f.code} onChange={(e) => (setCodeTouched(true), set('code', e.target.value.toUpperCase()))} />
              </label>
              <label className="field">
                <span>Status</span>
                <select className="select" value={f.status} onChange={(e) => set('status', e.target.value as SiteStatus)}>
                  <option value="active">Active</option>
                  <option value="snagging">Snagging</option>
                  <option value="on-hold">On hold</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <div className="field span-all">
                <span>Systems in scope</span>
                <div className="row">
                  <label className="sys-check">
                    <input type="checkbox" checked={f.systems.includes('FA')} onChange={() => toggleSys('FA')} />
                    <span className="sys sys--FA">FA</span> Fire alarm
                  </label>
                  <label className="sys-check">
                    <input type="checkbox" checked={f.systems.includes('FF')} onChange={() => toggleSys('FF')} />
                    <span className="sys sys--FF">FF</span> Fire fighting
                  </label>
                </div>
              </div>
              <label className="field">
                <span>Client</span>
                <input className="input" value={f.client} onChange={(e) => set('client', e.target.value)} />
              </label>
              <label className="field">
                <span>Main contractor</span>
                <input className="input" value={f.contractor} onChange={(e) => set('contractor', e.target.value)} />
              </label>
              <label className="field">
                <span>Consultant</span>
                <input className="input" value={f.consultant} onChange={(e) => set('consultant', e.target.value)} />
              </label>
              <div className="form-grid form-grid--2" style={{ gap: 12 }}>
                <label className="field">
                  <span>Start</span>
                  <input className="input" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} />
                </label>
                <label className="field">
                  <span>Target</span>
                  <input className="input" type="date" value={f.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
                </label>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <div>
                <h2 className="h2">
                  <ListChecks className="assist__icon" aria-hidden /> Scope of work
                </h2>
                <p className="muted small">
                  Write the scope as a to-do list — one sentence per item. You can add more any time, including variations and work found on site.
                </p>
              </div>
            </div>
            {existing ? (
              <div className="card__body row row--between row--wrap">
                <span>
                  <b>{savedScope}</b> item{savedScope === 1 ? '' : 's'} on this site's scope list.
                </span>
                <Link to={`/sites/${existing.id}/scope`} className="btn btn--sm">
                  Open the scope list <ArrowRight />
                </Link>
              </div>
            ) : (
              <div className="card__body stack">
                <ScopeAdd systems={f.systems.length ? f.systems : ['FA', 'FF']} onAdd={addScope} />
                {scope.length > 0 && (
                  <ul className="draft-scope">
                    {scope.map((x, i) => (
                      <li key={i}>
                        {x.system && <span className={`sys sys--${x.system}`}>{x.system}</span>}
                        <span className="grow">{x.text}</span>
                        {x.kind !== 'scope' && <span className={`kind kind--${x.kind}`}>{KIND_LABEL[x.kind]}</span>}
                        <button className="icon-btn icon-btn--sm" onClick={() => setScope(scope.filter((_, j) => j !== i))} aria-label={`Remove "${x.text}"`}>
                          <X />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card__head"><h2 className="h2">Notes</h2></div>
            <div className="card__body">
              <textarea className="textarea" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Access arrangements, key contacts, coordination points" />
            </div>
          </section>
        </div>

        <aside className="site-form__side">
          <section className="card">
            <div className="card__head">
              <div>
                <h2 className="h2">Location</h2>
                <p className="muted small">{pinSet ? 'Check the pin on the satellite view.' : 'Tap the map, or paste a Google Maps link.'}</p>
              </div>
              <span className="site-head__ref">{gridRef(f.lat, f.lng)}</span>
            </div>
            <div className="site-form__view">
              <Seg
                label="Map or satellite"
                value={view}
                onChange={setView}
                options={[
                  { value: 'map', label: 'Map' },
                  { value: 'satellite', label: 'Satellite' },
                ]}
              />
            </div>
            {view === 'map' ? (
              <div className="site-form__map">
                <UaeMap sites={[]} compact intro={false} pick={pinSet ? { lat: f.lat, lng: f.lng } : null} onPick={placePin} focus={null} />
              </div>
            ) : (
              <div className="site-form__sat">
                <SatelliteView lat={f.lat} lng={f.lng} />
              </div>
            )}
            {pinSet && place && (
              <div className="card__body pin-place">
                <MapPin aria-hidden />
                <span className="grow small">{place.label}</span>
                {!f.area && place.area && (
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => set('area', place.area)}>
                    Use “{place.area}”
                  </button>
                )}
              </div>
            )}
            <div className="card__body stack">
              <label className="field">
                <span><Link2 size={13} style={{ display: 'inline', verticalAlign: -2 }} /> Google Maps link or “lat, lng”</span>
                <input className="input" value={link} onChange={(e) => applyLink(e.target.value)} placeholder="https://maps.google.com/…@24.4975,54.4045" />
              </label>
              <div className="form-grid form-grid--2" style={{ gap: 12 }}>
                <label className="field">
                  <span>Latitude</span>
                  <NumField step={0.0001} min={-90} value={f.lat} onChange={(n) => placePin({ lat: n, lng: f.lng })} />
                </label>
                <label className="field">
                  <span>Longitude</span>
                  <NumField step={0.0001} min={-180} value={f.lng} onChange={(n) => placePin({ lat: f.lat, lng: n })} />
                </label>
                <label className="field">
                  <span>Emirate</span>
                  <select
                    className="select"
                    value={f.emirate}
                    onChange={(e) => {
                      const em = e.target.value as Emirate;
                      setF((x) => ({ ...x, emirate: em, code: codeTouched ? x.code : nextCode(em) }));
                    }}
                  >
                    {EMIRATES.map((e) => <option key={e}>{e}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Area</span>
                  <input className="input" value={f.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. Musaffah M-40" />
                </label>
              </div>
              {navigator.geolocation && (
                <button
                  className="btn btn--sm"
                  onClick={() =>
                    navigator.geolocation.getCurrentPosition(
                      (p) => {
                        placePin({ lat: Math.round(p.coords.latitude * 1e5) / 1e5, lng: Math.round(p.coords.longitude * 1e5) / 1e5 });
                        toast('Location set to where you are');
                      },
                      () => toast('Location permission was not given'),
                    )
                  }
                >
                  <MapPin /> I'm on site — use my location
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>

      {confirmDelete && existing && (
        <Confirm
          title={`Delete ${existing.code}?`}
          body={<>This removes the site with all its tasks, logs, materials, expenses and photos from this device. It can't be undone — export a backup first from Settings if you might need it.</>}
          action="Delete site"
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await deleteSite(existing.id);
            toast('Site deleted');
            nav('/');
          }}
        />
      )}
    </div>
  );
}
