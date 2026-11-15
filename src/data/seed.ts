import type {
  Allocation, CustomMaterial, DailyLog, Expense, ExpenseCategory, MaterialTxn, Person, ScopeItem, ScopeKind, Site, System, Task,
} from '../types';
import { emptyData, type Data } from '../store/store';
import { addDays, clamp01, parseISO, rng, today, uid } from '../lib/util';

/** Sample data for Version 2: each site's scope is a to-do list, worked through day by day. */

type Q = { smoke: number; heat: number; mcp: number; sounders: number; cable: number; sprinklers: number; pipe: number; hangers: number };
type SiteSeed = Omit<Site, 'id' | 'createdAt'> & {
  target: number;
  crew: string[];
  /** areas the work is split into on the scope list */
  areas: string[];
  extra: [ScopeKind, System | null, string][];
  q: Q;
};

const PEOPLE: Omit<Person, 'id'>[] = [
  { name: 'Rajesh Kumar', role: 'foreman', trade: 'both', phone: '050 412 7781', empNo: 'E-1021', pin: '1111', active: true },
  { name: 'Joel Santos', role: 'foreman', trade: 'FF', phone: '052 390 1147', empNo: 'E-1034', pin: '2222', active: true },
  { name: 'Mohammed Aslam', role: 'foreman', trade: 'FA', phone: '055 781 2290', empNo: 'E-1040', pin: '3333', active: true },
  { name: 'Hamid Kalam', role: 'technician', trade: 'both', phone: '', empNo: 'E-1160', pin: '', active: true },
  { name: 'Anil Thomas', role: 'technician', trade: 'FA', phone: '050 118 4402', empNo: 'E-1102', pin: '', active: true },
  { name: 'Imran Khan', role: 'technician', trade: 'FA', phone: '056 227 9031', empNo: 'E-1108', pin: '', active: true },
  { name: 'Sajid Ali', role: 'technician', trade: 'FA', phone: '054 330 6612', empNo: 'E-1115', pin: '', active: true },
  { name: 'Nikhil Menon', role: 'technician', trade: 'FA', phone: '050 902 3375', empNo: 'E-1121', pin: '', active: true },
  { name: 'Ramesh Bhandari', role: 'technician', trade: 'FF', phone: '052 614 0098', empNo: 'E-1130', pin: '', active: true },
  { name: 'Arjun Nair', role: 'technician', trade: 'FF', phone: '055 470 2213', empNo: 'E-1133', pin: '', active: true },
  { name: 'Mark dela Cruz', role: 'technician', trade: 'FF', phone: '056 118 7720', empNo: 'E-1139', pin: '', active: true },
  { name: 'Tariq Mahmood', role: 'technician', trade: 'FF', phone: '050 663 1840', empNo: 'E-1142', pin: '', active: true },
  { name: 'Vinod Pillai', role: 'technician', trade: 'both', phone: '054 220 5519', empNo: 'E-1150', pin: '', active: true },
  { name: 'Kiran Joseph', role: 'technician', trade: 'FF', phone: '052 885 3306', empNo: 'E-1157', pin: '', active: true },
  { name: 'Suresh Thapa', role: 'helper', trade: 'both', phone: '055 301 7764', empNo: 'E-1203', pin: '', active: true },
  { name: 'Bilal Hussain', role: 'helper', trade: 'both', phone: '056 772 1908', empNo: 'E-1207', pin: '', active: true },
  { name: 'Deepak Rai', role: 'helper', trade: 'FF', phone: '050 448 6627', empNo: 'E-1211', pin: '', active: true },
  { name: 'Faisal Rahman', role: 'helper', trade: 'FF', phone: '054 916 0073', empNo: 'E-1216', pin: '', active: true },
  { name: 'Manoj Yadav', role: 'helper', trade: 'FA', phone: '052 157 4480', empNo: 'E-1220', pin: '', active: true },
  { name: 'Harun Mia', role: 'helper', trade: 'FA', phone: '055 629 3351', empNo: 'E-1224', pin: '', active: true },
  { name: 'Rahul Das', role: 'helper', trade: 'both', phone: '056 340 8812', empNo: 'E-1229', pin: '', active: true },
  { name: 'Asif Iqbal', role: 'helper', trade: 'FF', phone: '050 781 0045', empNo: 'E-1233', pin: '', active: true },
  { name: 'Prakash Gurung', role: 'helper', trade: 'both', phone: '054 509 2267', empNo: 'E-1238', pin: '', active: true },
];

function siteSeeds(t: string): SiteSeed[] {
  return [
    {
      code: 'AUH-118', name: 'Reem Island Residential Tower C', client: 'Al Noor Real Estate Development',
      contractor: 'Gulf Crest Contracting LLC', consultant: 'Meridian Engineering Consultants',
      emirate: 'Abu Dhabi', area: 'Al Reem Island', lat: 24.4975, lng: 54.4045, status: 'active', systems: ['FA', 'FF'],
      startDate: addDays(t, -210), targetDate: addDays(t, 120),
      notes: 'Level 14–20 corridors: ID contractor closing boards early — coordinate access panels before 1st fix.',
      target: 0.55, crew: ['Rajesh Kumar', 'Hamid Kalam', 'Anil Thomas', 'Imran Khan', 'Ramesh Bhandari', 'Arjun Nair', 'Suresh Thapa', 'Bilal Hussain'],
      areas: ['Basements B1–B3', 'Podium & Level 1–6', 'Levels 7–13', 'Levels 14–20', 'Levels 21–32 & roof'],
      extra: [
        ['variation', 'FA', 'Add 6 smoke detectors in the new L18 store rooms (VO-03)'],
        ['found', 'FF', 'Replace 4 sprinkler heads damaged by the painter at L16 corridor'],
        ['found', null, 'Seal 12 open sleeves in the L9 riser after cable pulling'],
      ],
      q: { smoke: 1450, heat: 180, mcp: 110, sounders: 260, cable: 38000, sprinklers: 2600, pipe: 9800, hangers: 2400 },
    },
    {
      code: 'AUH-121', name: 'KEZAD Logistics Warehouse W-14', client: 'Sahel Logistics Parks',
      contractor: 'Desert Line Steel Structures', consultant: 'Arcline Consulting Engineers',
      emirate: 'Abu Dhabi', area: 'Khalifa Economic Zone (KEZAD)', lat: 24.738, lng: 54.768, status: 'active', systems: ['FA', 'FF'],
      startDate: addDays(t, -95), targetDate: addDays(t, 85),
      notes: 'Racking layout revised (Rev C) — in-rack sprinklers under review with consultant.',
      target: 0.35, crew: ['Joel Santos', 'Mark dela Cruz', 'Tariq Mahmood', 'Deepak Rai', 'Faisal Rahman'],
      areas: ['Bays 1–2', 'Bays 3–4', 'Bays 5–6', 'Office mezzanine'],
      extra: [
        ['variation', 'FF', 'In-rack sprinklers for the Rev C racking — Bays 3–6'],
        ['found', 'FA', 'Re-align 2 beam detectors moved by the racking contractor, Bay 5'],
      ],
      q: { smoke: 40, heat: 12, mcp: 16, sounders: 28, cable: 3200, sprinklers: 1150, pipe: 4200, hangers: 980 },
    },
    {
      code: 'AUH-124', name: 'Musaffah M-40 Labour Accommodation', client: 'Bayan Facilities Management',
      contractor: 'Gulf Crest Contracting LLC', consultant: 'Meridian Engineering Consultants',
      emirate: 'Abu Dhabi', area: 'Musaffah M-40', lat: 24.335, lng: 54.525, status: 'active', systems: ['FA', 'FF'],
      startDate: addDays(t, -160), targetDate: addDays(t, 30),
      notes: 'Pump room ready. Civil Defence pre-inspection requested for next month.',
      target: 0.8, crew: ['Mohammed Aslam', 'Sajid Ali', 'Manoj Yadav'],
      areas: ['Block A', 'Block B', 'Kitchen & mess'],
      extra: [['found', 'FF', 'Re-route the sprinkler branch around the new kitchen hood']],
      q: { smoke: 520, heat: 60, mcp: 40, sounders: 90, cable: 14000, sprinklers: 900, pipe: 3600, hangers: 820 },
    },
    {
      code: 'AUH-127', name: 'Yas West Villas — Cluster 6', client: 'Al Noor Real Estate Development',
      contractor: 'Palm Coast Builders', consultant: 'Arcline Consulting Engineers',
      emirate: 'Abu Dhabi', area: 'Yas Island', lat: 24.47, lng: 54.587, status: 'active', systems: ['FA'],
      startDate: addDays(t, -70), targetDate: addDays(t, 60),
      notes: '48 villas, one conventional panel each. Void > 800 mm in living areas.',
      target: 0.45, crew: ['Nikhil Menon', 'Harun Mia'],
      areas: ['Villas 1–16', 'Villas 17–32', 'Villas 33–48'],
      extra: [['variation', 'FA', 'Add heat detectors in 6 villas where kitchens were moved (client change)']],
      q: { smoke: 672, heat: 96, mcp: 48, sounders: 96, cable: 16000, sprinklers: 0, pipe: 0, hangers: 0 },
    },
    {
      code: 'AAN-032', name: 'Tawam Clinic Extension', client: 'Oasis Health Services',
      contractor: 'Hili Building Contracting', consultant: 'Meridian Engineering Consultants',
      emirate: 'Abu Dhabi', area: 'Al Ain', lat: 24.191, lng: 55.707, status: 'snagging', systems: ['FA', 'FF'],
      startDate: addDays(t, -300), targetDate: addDays(t, 14),
      notes: 'Snag list from consultant walk-through — items added to the scope list as "found on site".',
      target: 0.9, crew: ['Vinod Pillai', 'Rahul Das'],
      areas: ['Ground floor & OPD', 'Ward wing L1–L2'],
      extra: [
        ['found', 'FA', 'Snag: fix loose detector bases in the OPD corridor'],
        ['found', 'FF', 'Snag: label all hose reel cabinets'],
        ['found', 'FF', 'Snag: touch-up paint on exposed pipework, plant room'],
        ['found', null, 'Snag: as-built drawings and O&M manuals to consultant'],
      ],
      q: { smoke: 310, heat: 40, mcp: 24, sounders: 60, cable: 9000, sprinklers: 620, pipe: 2400, hangers: 560 },
    },
    {
      code: 'DXB-057', name: 'Dubai South Office Block B3', client: 'Southgate Business Parks',
      contractor: 'Crescent Contracting Co.', consultant: 'Arcline Consulting Engineers',
      emirate: 'Dubai', area: 'Dubai South', lat: 24.897, lng: 55.158, status: 'on-hold', systems: ['FA', 'FF'],
      startDate: addDays(t, -120), targetDate: addDays(t, 150),
      notes: 'On hold — waiting for revised shop drawings approval (Dubai Civil Defence).',
      target: 0.2, crew: [],
      areas: ['Basement', 'Levels 1–3', 'Levels 4–7'],
      extra: [],
      q: { smoke: 480, heat: 30, mcp: 30, sounders: 70, cable: 12000, sprinklers: 1100, pipe: 4100, hangers: 950 },
    },
    {
      code: 'AUH-131', name: 'Saadiyat School Campus — Block A', client: 'Crescent Education Holdings',
      contractor: 'Palm Coast Builders', consultant: 'Meridian Engineering Consultants',
      emirate: 'Abu Dhabi', area: 'Saadiyat Island', lat: 24.545, lng: 54.433, status: 'active', systems: ['FA', 'FF'],
      startDate: addDays(t, -18), targetDate: addDays(t, 200),
      notes: 'Mobilised. Sleeves in slab done by civil — confirm locations before hanger install.',
      target: 0.08, crew: ['Kiran Joseph', 'Asif Iqbal'],
      areas: ['Classroom wing', 'Sports hall', 'Admin block'],
      extra: [['variation', 'FA', 'Add a beam detector in the sports hall (consultant comment C-12)']],
      q: { smoke: 260, heat: 30, mcp: 22, sounders: 55, cable: 8000, sprinklers: 540, pipe: 2100, hangers: 480 },
    },
    {
      code: 'RUW-009', name: 'Ruwais Retail Mall Extension', client: 'Dhafra Retail Estates',
      contractor: 'Crescent Contracting Co.', consultant: 'Arcline Consulting Engineers',
      emirate: 'Abu Dhabi', area: 'Ruwais', lat: 24.108, lng: 52.73, status: 'completed', systems: ['FA', 'FF'],
      startDate: addDays(t, -420), targetDate: addDays(t, -25),
      notes: 'Handed over. Civil Defence completion certificate received.',
      target: 1, crew: [],
      areas: ['Retail row A', 'Food court & atrium'],
      extra: [],
      q: { smoke: 700, heat: 60, mcp: 50, sounders: 120, cable: 21000, sprinklers: 1800, pipe: 6400, hangers: 1500 },
    },
  ];
}

/** The scope list, written the way a site is worked: system, then area, then type of work */
function scopeFor(seed: SiteSeed): [System | null, string][] {
  const out: [System | null, string][] = [];
  if (seed.systems.includes('FA')) {
    out.push(['FA', 'Mark out device positions with the main contractor and get sign-off']);
    for (const a of seed.areas) out.push(['FA', `Conduit, containment and back boxes — ${a}`]);
    out.push(['FA', 'Pull loop and sounder cables from the panel to every area']);
    for (const a of seed.areas) out.push(['FA', `Install detectors, call points and sounder-strobes — ${a}`]);
    out.push(['FA', 'Install interface modules for AHUs, lifts, dampers and access control']);
    out.push(['FA', 'Install and terminate the fire alarm control panel']);
    out.push(['FA', 'Program the panel and the cause-and-effect matrix']);
    out.push(['FA', 'Loop testing and commissioning with the consultant']);
  }
  if (seed.systems.includes('FF')) {
    for (const a of seed.areas) out.push(['FF', `Supports, hangers and sprinkler mains — ${a}`]);
    for (const a of seed.areas) out.push(['FF', `Branch pipes, drops and sprinkler heads — ${a}`]);
    out.push(['FF', 'Install alarm / zone control valve sets and flow switches']);
    out.push(['FF', 'Install hose reel cabinets, landing valves and extinguishers']);
    out.push(['FF', 'Install, align and test the fire pump set']);
    out.push(['FF', 'Hydrostatic pressure test of every zone (200 psi for 2 hours)']);
    out.push(['FF', 'Paint and label all exposed pipework']);
  }
  out.push([null, 'Civil Defence inspection and completion certificate']);
  return out;
}

const ISSUES = [
  'Ceiling access panels not yet provided by ID contractor in corridors.',
  'Scaffold tower shared with MEP — lost 2 hours waiting.',
  'Main contractor asked to shift two detector positions near new bulkhead — RFI raised.',
  'Material delivery arrived after 2 pm; unloaded next morning.',
  'Power shutdown on the floor for the utility connection — cable pulling stopped for the afternoon.',
];

export function buildSample(): Data {
  const t = today();
  const r = rng(20261108);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const data = emptyData();
  data.initialised = true;
  data.sampleLoaded = true;
  data.settings = { ...data.settings };

  const people: Person[] = PEOPLE.map((p) => ({ ...p, id: uid() }));
  const byName = new Map(people.map((p) => [p.name, p]));
  data.people = people;

  const sites: Site[] = [];
  const scopeItems: ScopeItem[] = [];
  const tasks: Task[] = [];
  const allocations: Allocation[] = [];
  const logs: DailyLog[] = [];
  const customMaterials: CustomMaterial[] = [];
  const txns: MaterialTxn[] = [];
  const expenses: Expense[] = [];

  // working days: last 13 days + today, skipping Fridays
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(t, -i);
    if (parseISO(d).getDay() !== 5) days.push(d);
  }
  const past = days.slice(0, -1);

  for (const seed of siteSeeds(t)) {
    const { target, crew, areas: _a, extra, q, ...rest } = seed;
    const site: Site = { ...rest, id: uid(), createdAt: new Date(addDays(t, -30)).toISOString() };
    sites.push(site);
    const crewPeople = crew.map((n) => byName.get(n)!).filter(Boolean);
    const working = site.status === 'active' || site.status === 'snagging';

    // the scope list: original scope from the start, variations and found work added in the last few weeks
    const base = scopeFor(seed);
    const items: ScopeItem[] = base.map(([system, text], i) => ({
      id: uid(), siteId: site.id, text, system, kind: 'scope', addedOn: site.startDate, doneOn: null, order: i,
    }));
    extra.forEach(([kind, system, text], i) => {
      items.push({ id: uid(), siteId: site.id, text, system, kind, addedOn: addDays(t, -(3 + i * 4)), doneOn: null, order: base.length + i });
    });

    // tick off the same share of each system's original scope, earliest items first, FA and FF taking turns;
    // the last few inside the last two weeks so the trend moves
    const bySys = (sys: System | null) => items.filter((i) => i.kind === 'scope' && i.system === sys);
    const groups = (['FA', 'FF', null] as (System | null)[]).map((sys) => {
      const list = bySys(sys);
      return list.slice(0, target >= 1 ? list.length : Math.round(target * list.length));
    });
    const doneOrder: ScopeItem[] = [];
    for (let k = 0; doneOrder.length < groups.reduce((a, g) => a + g.length, 0); k++) for (const g of groups) if (g[k]) doneOrder.push(g[k]);
    if (target >= 1) doneOrder.push(...items.filter((i) => i.kind !== 'scope'));
    const doneCount = doneOrder.length;
    const recent = working ? Math.min(doneCount, 3 + Math.floor(r() * 3)) : 0;
    const span = Math.max(1, Math.round((parseISO(addDays(t, -16)).getTime() - parseISO(site.startDate).getTime()) / 864e5));
    for (let i = 0; i < doneCount; i++) {
      const it = doneOrder[i];
      if (target >= 1) it.doneOn = addDays(site.targetDate, -Math.round((1 - (i + 1) / doneCount) * 300));
      else if (i >= doneCount - recent) it.doneOn = past[Math.min(past.length - 1, Math.floor(((i - (doneCount - recent) + 1) / (recent + 1)) * past.length))];
      else it.doneOn = addDays(site.startDate, Math.round(((i + 1) / (doneCount - recent + 1)) * span));
    }
    if (site.code === 'AAN-032') items.find((i) => i.text.startsWith('Snag: label'))!.doneOn = past[past.length - 2];
    scopeItems.push(...items);

    // day-by-day assignments from the list
    if (working && crewPeople.length) {
      const techs = (sys: System | null) => {
        const pool = crewPeople.filter((p) => p.role !== 'foreman' && (!sys || p.trade === 'both' || p.trade === sys));
        return pool.length ? pool : crewPeople;
      };
      const crewFor = (it: ScopeItem, k: number) => {
        const pool = techs(it.system);
        return [...new Set([pool[k % pool.length], pool[(k + 1) % pool.length]].map((p) => p.id))];
      };
      for (const day of days) for (const p of crewPeople) allocations.push({ id: uid(), date: day, personId: p.id, siteId: site.id, attendance: 'present' });

      const task = (it: ScopeItem, date: string, status: Task['status'], k: number, extraFields: Partial<Task> = {}) =>
        tasks.push({
          id: uid(), siteId: site.id, date, scopeItemId: it.id, title: it.text, location: '', assignees: crewFor(it, k),
          status, blockReason: '', note: '', updatedBy: 'engineer', updatedAt: new Date().toISOString(), ...extraFields,
        });

      // items finished in the window: worked for a day or two, then done
      items.filter((i) => i.doneOn && i.doneOn >= days[0]).forEach((it, k) => {
        const di = days.indexOf(it.doneOn!);
        if (di > 0 && r() > 0.3) task(it, days[di - 1], 'in-progress', k, { note: 'Continues tomorrow' });
        task(it, it.doneOn!, 'done', k);
      });
      // what's being worked on now: the next pending items
      const next = items.filter((i) => !i.doneOn).slice(0, Math.min(4, Math.max(1, Math.ceil(crewPeople.length / 2))));
      next.forEach((it, k) => {
        const from = Math.max(0, days.length - 1 - (2 + Math.floor(r() * 3)));
        for (let di = from; di < days.length - 1; di++) task(it, days[di], 'in-progress', k);
        if (k === 1 && site.code === 'AUH-118') {
          task(it, t, 'blocked', k, { location: 'L16 corridor', blockReason: 'Ceiling boards closed before our work — waiting for the ID contractor to open access panels.' });
        } else task(it, t, k === 0 ? 'in-progress' : 'planned', k);
      });

      // daily logs for the last week
      for (const day of past.slice(-6)) {
        const worked = tasks.filter((x) => x.siteId === site.id && x.date === day);
        if (!worked.length) continue;
        logs.push({
          id: uid(), siteId: site.id, date: day,
          summary: worked.map((x) => `${x.title}${x.status === 'done' ? ' — done' : ' — in progress'}`).join('. ') + '.',
          issues: r() > 0.55 ? pick(ISSUES) : '',
          nextPlan: 'Continue the current items; prepare the next area.',
          inspections: r() > 0.8 ? 'Consultant inspection of installed works — accepted with minor comments.' : '',
        });
      }
    }

    // materials typed in from the BOQ, with deliveries and usage in line with progress
    const mats: [System | null, string, string, number][] = [];
    if (site.systems.includes('FA')) {
      mats.push(
        ['FA', 'Addressable smoke detector with base', 'nos', q.smoke],
        ['FA', 'Heat detector with base', 'nos', q.heat],
        ['FA', 'Manual call point with back box', 'nos', q.mcp],
        ['FA', 'Sounder-strobe with base', 'nos', q.sounders],
        ['FA', 'Fire-rated cable 2C × 1.5 mm²', 'm', q.cable],
        ['FA', 'PVC conduit 20 mm (2.9 m lengths)', 'lengths', Math.round(q.cable / 6)],
      );
    }
    if (site.systems.includes('FF') && q.sprinklers) {
      mats.push(
        ['FF', 'Pendent sprinkler K5.6, 68 °C', 'nos', q.sprinklers],
        ['FF', 'Black steel pipe Sch 40 — 25 mm (6 m)', 'lengths', Math.round((q.pipe * 0.4) / 6)],
        ['FF', 'Black steel pipe Sch 40 — 50 to 150 mm (6 m)', 'lengths', Math.round((q.pipe * 0.35) / 6)],
        ['FF', 'Pipe hangers with threaded rod', 'nos', q.hangers],
        ['FF', 'Grooved couplings and fittings', 'nos', Math.round(q.pipe / 9)],
      );
    }
    mats.push([null, 'Anchors and fixings (box of 100)', 'boxes', Math.max(4, Math.round((q.smoke + q.sprinklers) / 120))]);
    let dn = 4400 + Math.floor(r() * 300);
    for (const [system, name, unit, qty] of mats) {
      if (!qty) continue;
      const key = `custom.${uid()}`;
      customMaterials.push({ key, siteId: site.id, system, name, unit, qty });
      const factor = target >= 1 ? 1 : clamp01(target + (r() - 0.5) * 0.2);
      let used = Math.round(qty * factor * 0.95);
      let delivered = target >= 1 ? qty : Math.min(qty, used + Math.max(Math.ceil(qty * 0.08), Math.round(qty * (0.08 + r() * 0.15))));
      if (site.code === 'AUH-118' && name.startsWith('Fire-rated cable')) delivered = used + 140;
      if (site.code === 'AUH-121' && name.startsWith('Pipe hangers')) delivered = used;
      if (site.code === 'AUH-124' && name.startsWith('Pendent')) delivered = used + 4;
      if (used <= 0 && target < 0.1) used = 0;
      if (delivered <= 0) continue;
      const first = Math.round(delivered * 0.6);
      txns.push({ id: uid(), siteId: site.id, date: addDays(t, -24 - Math.floor(r() * 6)), key, type: 'in', qty: first, ref: `DN-${dn++}`, note: '' });
      if (delivered - first > 0) txns.push({ id: uid(), siteId: site.id, date: addDays(t, -3 - Math.floor(r() * 8)), key, type: 'in', qty: delivered - first, ref: `DN-${dn++}`, note: '' });
      if (used > 0) txns.push({ id: uid(), siteId: site.id, date: addDays(t, -1 - Math.floor(r() * 4)), key, type: 'out', qty: used, ref: '', note: 'Issued to installation' });
      if (site.code === 'AUH-121' && name.startsWith('Pipe hangers')) txns.push({ id: uid(), siteId: site.id, date: addDays(t, -1), key, type: 'request', qty: 300, ref: 'MR-118', note: '' });
    }
  }

  // leave for one helper today
  allocations.push({ id: uid(), date: t, personId: byName.get('Prakash Gurung')!.id, siteId: null, attendance: 'leave' });

  const EXP: [ExpenseCategory, number, string][] = [
    ['fuel', 180, 'Pickup diesel — site runs'],
    ['transport', 350, 'Material shifting — 3-ton pickup hire'],
    ['tools', 265, 'Cutting discs, drill bits 6/8/10 mm'],
    ['local-purchase', 420, 'Anchors & saddles — local shop, urgent'],
    ['food', 140, 'Water & refreshments for crew'],
    ['overtime', 600, 'Weekend overtime — pressure test'],
    ['permits', 1200, 'Civil Defence inspection fee'],
    ['tools', 95, 'Teflon, sealant, marker pens'],
    ['transport', 220, 'Taxi — Al Ain site visit'],
    ['local-purchase', 310, 'Cable ties & ferrules'],
    ['fuel', 160, 'Generator diesel — pump test'],
    ['accommodation', 900, 'Ruwais hotel — handover visit'],
  ];
  const active = sites.filter((s) => s.status !== 'on-hold');
  for (let i = 0; i < 26; i++) {
    const [category, base, note] = EXP[i % EXP.length];
    const s = category === 'accommodation' ? sites.find((x) => x.code === 'RUW-009')! : pick(active);
    expenses.push({
      id: uid(), siteId: s.id, date: addDays(t, -Math.floor(r() * 28)), category,
      amount: Math.round(base * (0.8 + r() * 0.5)), note, paidBy: r() > 0.4 ? 'Petty cash' : 'Engineer',
    });
  }

  return { ...data, sites, scopeItems, tasks, allocations, logs, customMaterials, txns, expenses };
}
