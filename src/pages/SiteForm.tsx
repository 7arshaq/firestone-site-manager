import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Link2, MapPin, Trash2 } from 'lucide-react';
import UaeMap, { gridRef } from '../components/UaeMap';
import DrawingAssistant from '../components/DrawingAssistant';
import SatelliteView from '../components/SatelliteView';
import { saveDrawingBlob } from '../store/drawings';
import { reverseGeocode, type Place } from '../lib/geocode';
import type { PickedDrawing } from '../lib/drawing-files';
import { Confirm, NumField, Seg, toast } from '../components/ui';
import { useStore } from '../store/store';
import { estimateMaterials } from '../lib/estimate';
import { TEMPLATES } from '../lib/scope';
import type { BuildingType, DrawingMeta, Emirate, FAScope, FFScope, Site, SiteStatus, System } from '../types';
import { addDays, parseLatLng, today, uid } from '../lib/util';

const EMIRATES: Emirate[] = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
const PREFIX: Record<Emirate, string> = {
  'Abu Dhabi': 'AUH', Dubai: 'DXB', Sharjah: 'SHJ', Ajman: 'AJM', 'Umm Al Quwain': 'UAQ', 'Ras Al Khaimah': 'RAK', Fujairah: 'FUJ',
};
const BUILDINGS: [BuildingType, string][] = [
  ['tower', 'Tower / high-rise'], ['villa', 'Villas'], ['warehouse', 'Warehouse / factory'], ['mall', 'Mall / retail'],
  ['school', 'School'], ['hospital', 'Hospital / clinic'], ['hotel', 'Hotel'], ['office', 'Office'], ['labour-camp', 'Labour accommodation'],
];
const FA_FIELDS: [keyof FAScope, string][] = [
  ['panels', 'Fire alarm panels'], ['loops', 'Loops (total)'], ['smoke', 'Smoke detectors'], ['heat', 'Heat detectors'],
  ['beam', 'Beam detectors'], ['mcp', 'Manual call points'], ['sounders', 'Sounders / strobes'], ['modules', 'Interface modules'],
];
const FF_FIELDS: [keyof FFScope, string][] = [
  ['sprinklers', 'Sprinkler heads'], ['pipeMeters', 'Pipework (m, all sizes)'], ['hoseReels', 'Hose reels'], ['landingValves', 'Landing valves'],
  ['hydrants', 'External hydrants'], ['alarmValves', 'Alarm / zone control valves'], ['pumpSets', 'Fire pump sets'], ['extinguishers', 'Extinguishers'],
];

type Draft = Omit<Site, 'id' | 'createdAt'>;

function blank(code: string): Draft {
  return {
    code, name: '', client: '', contractor: '', consultant: '', emirate: 'Abu Dhabi', area: '', lat: 24.4539, lng: 54.3773,
    status: 'active', systems: ['FA', 'FF'], faShare: 40, startDate: today(), targetDate: addDays(today(), 180),
    conditions: { buildingType: 'tower', structure: 'concrete', ceiling: 'false-ceiling', ceilingHeight: 3.2, voidDepth: 0.6, floors: 1, basements: 0, conditioned: true },
    fa: { panels: 1, loops: 2, smoke: 0, heat: 0, beam: 0, mcp: 0, sounders: 0, modules: 0 },
    ff: { sprinklers: 0, pipeMeters: 0, hoseReels: 0, landingValves: 0, hydrants: 0, alarmValves: 0, pumpSets: 0, extinguishers: 0 },
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
  const setC = <K extends keyof Draft['conditions']>(k: K, v: Draft['conditions'][K]) => setF((x) => ({ ...x, conditions: { ...x.conditions, [k]: v } }));
  const toggleSys = (s: System) => set('systems', f.systems.includes(s) ? f.systems.filter((x) => x !== s) : ([...f.systems, s].sort() as System[]));

  const preview = useMemo(() => {
    const fake = { ...f, id: 'x', createdAt: '' } as Site;
    const est = estimateMaterials(fake);
    const stages = TEMPLATES.filter((t) => f.systems.includes(t.system) && t.qty(fake) > 0).length;
    return { materials: est.lines.length, advisories: est.advisories, stages };
  }, [f]);

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
                <h2 className="h2">Site conditions</h2>
                <p className="muted small">Used to pick the right materials: conduit type, sprinkler type and rating, hangers, access equipment.</p>
              </div>
            </div>
            <div className="card__body form-grid">
              <label className="field">
                <span>Building type</span>
                <select className="select" value={f.conditions.buildingType} onChange={(e) => setC('buildingType', e.target.value as BuildingType)}>
                  {BUILDINGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Ceiling</span>
                <select className="select" value={f.conditions.ceiling} onChange={(e) => setC('ceiling', e.target.value as Draft['conditions']['ceiling'])}>
                  <option value="false-ceiling">False ceiling</option>
                  <option value="exposed">Exposed soffit / roof</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>
              <label className="field">
                <span>Structure</span>
                <select className="select" value={f.conditions.structure} onChange={(e) => setC('structure', e.target.value as Draft['conditions']['structure'])}>
                  <option value="concrete">Concrete slab</option>
                  <option value="steel">Steel structure</option>
                </select>
              </label>
              <label className="field">
                <span>Ceiling / roof height (m)</span>
                <NumField step={0.1} value={f.conditions.ceilingHeight} onChange={(n) => setC('ceilingHeight', n)} />
              </label>
              <label className="field">
                <span>False-ceiling void (m)</span>
                <NumField step={0.1} value={f.conditions.voidDepth} onChange={(n) => setC('voidDepth', n)} />
              </label>
              <label className="field">
                <span>Floors</span>
                <NumField value={f.conditions.floors} onChange={(n) => setC('floors', Math.max(1, Math.round(n)))} />
              </label>
              <label className="field">
                <span>Basements</span>
                <NumField value={f.conditions.basements} onChange={(n) => setC('basements', Math.round(n))} />
              </label>
              <label className="check" style={{ alignSelf: 'end', minHeight: 40 }}>
                <input type="checkbox" checked={f.conditions.conditioned} onChange={(e) => setC('conditioned', e.target.checked)} />
                Air-conditioned
              </label>
            </div>
          </section>

          {f.systems.includes('FA') && (
            <section className="card">
              <div className="card__head">
                <h2 className="h2"><span className="sys sys--FA">FA</span> Fire alarm scope</h2>
              </div>
              <div className="card__body form-grid">
                {FA_FIELDS.map(([k, label]) => (
                  <label className="field" key={k}>
                    <span>{label}</span>
                    <NumField value={f.fa[k]} onChange={(n) => set('fa', { ...f.fa, [k]: Math.round(n) })} />
                  </label>
                ))}
              </div>
            </section>
          )}

          {f.systems.includes('FF') && (
            <section className="card">
              <div className="card__head">
                <h2 className="h2"><span className="sys sys--FF">FF</span> Fire fighting scope</h2>
              </div>
              <div className="card__body form-grid">
                {FF_FIELDS.map(([k, label]) => (
                  <label className="field" key={k}>
                    <span>{label}</span>
                    <NumField value={f.ff[k]} onChange={(n) => set('ff', { ...f.ff, [k]: Math.round(n) })} />
                  </label>
                ))}
              </div>
            </section>
          )}

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

          <section className="card">
            <div className="card__head"><h2 className="h2">What this scope gives you</h2></div>
            <div className="card__body stack">
              <div className="today-counts" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div><b className="mono">{preview.stages}</b><span>progress stages</span></div>
                <div><b className="mono">{preview.materials}</b><span>materials estimated</span></div>
              </div>
              {preview.advisories.map((a) => (
                <p key={a} className="advisory">{a}</p>
              ))}
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
