import type {
  Allocation, DailyLog, Expense, ExpenseCategory, MaterialTxn, Person, Site, Task, WorkItem,
} from '../types';
import { emptyData, type Data } from '../store/store';
import { syncWorkItems } from '../lib/scope';
import { estimateMaterials } from '../lib/estimate';
import { addDays, clamp01, parseISO, rng, today, uid } from '../lib/util';

/** skew: how far FA runs ahead of FF (negative = FF ahead) */
type SiteSeed = Omit<Site, 'id' | 'createdAt'> & { target: number; skew?: number; crew: string[] };

const D = (ft: Partial<Site['conditions']>): Site['conditions'] => ({
  buildingType: 'tower', structure: 'concrete', ceiling: 'false-ceiling', ceilingHeight: 3.2, voidDepth: 0.6,
  floors: 1, basements: 0, conditioned: true, ...ft,
});
const FF0 = { sprinklers: 0, pipeMeters: 0, hoseReels: 0, landingValves: 0, hydrants: 0, alarmValves: 0, pumpSets: 0, extinguishers: 0 };

const PEOPLE: Omit<Person, 'id'>[] = [
  { name: 'Rajesh Kumar', role: 'foreman', trade: 'both', phone: '050 412 7781', empNo: 'E-1021', pin: '1111', active: true },
  { name: 'Joel Santos', role: 'foreman', trade: 'FF', phone: '052 390 1147', empNo: 'E-1034', pin: '2222', active: true },
  { name: 'Mohammed Aslam', role: 'foreman', trade: 'FA', phone: '055 781 2290', empNo: 'E-1040', pin: '3333', active: true },
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
      emirate: 'Abu Dhabi', area: 'Al Reem Island', lat: 24.4975, lng: 54.4045, status: 'active', systems: ['FA', 'FF'], faShare: 40,
      startDate: addDays(t, -210), targetDate: addDays(t, 120),
      conditions: D({ buildingType: 'tower', floors: 32, basements: 3, ceilingHeight: 3.2, voidDepth: 0.6 }),
      fa: { panels: 2, loops: 8, smoke: 1450, heat: 180, beam: 0, mcp: 110, sounders: 260, modules: 140 },
      ff: { sprinklers: 2600, pipeMeters: 9800, hoseReels: 70, landingValves: 70, hydrants: 2, alarmValves: 36, pumpSets: 1, extinguishers: 140 },
      notes: 'Level 14–20 corridors: ID contractor closing boards early — coordinate access panels before 1st fix.',
      target: 0.58, skew: 0.06, crew: ['Rajesh Kumar', 'Anil Thomas', 'Imran Khan', 'Ramesh Bhandari', 'Arjun Nair', 'Suresh Thapa', 'Bilal Hussain'],
    },
    {
      code: 'AUH-121', name: 'KEZAD Logistics Warehouse W-14', client: 'Sahel Logistics Parks',
      contractor: 'Desert Line Steel Structures', consultant: 'Arcline Consulting Engineers',
      emirate: 'Abu Dhabi', area: 'Khalifa Economic Zone (KEZAD)', lat: 24.7380, lng: 54.7680, status: 'active', systems: ['FA', 'FF'], faShare: 25,
      startDate: addDays(t, -95), targetDate: addDays(t, 85),
      conditions: D({ buildingType: 'warehouse', structure: 'steel', ceiling: 'exposed', ceilingHeight: 12, voidDepth: 0, conditioned: false }),
      fa: { panels: 1, loops: 2, smoke: 40, heat: 12, beam: 18, mcp: 16, sounders: 28, modules: 20 },
      ff: { sprinklers: 1150, pipeMeters: 4200, hoseReels: 12, landingValves: 0, hydrants: 6, alarmValves: 4, pumpSets: 1, extinguishers: 36 },
      notes: 'Racking layout revised (Rev C) — in-rack sprinklers under review with consultant.',
      target: 0.34, skew: -0.09, crew: ['Joel Santos', 'Mark dela Cruz', 'Tariq Mahmood', 'Deepak Rai', 'Faisal Rahman'],
    },
    {
      code: 'AUH-124', name: 'Musaffah M-40 Labour Accommodation', client: 'Bayan Facilities Management',
      contractor: 'Gulf Crest Contracting LLC', consultant: 'Meridian Engineering Consultants',
      emirate: 'Abu Dhabi', area: 'Musaffah M-40', lat: 24.3350, lng: 54.5250, status: 'active', systems: ['FA', 'FF'], faShare: 45,
      startDate: addDays(t, -160), targetDate: addDays(t, 30),
      conditions: D({ buildingType: 'labour-camp', ceiling: 'mixed', floors: 4, ceilingHeight: 3.0, voidDepth: 0.4 }),
      fa: { panels: 1, loops: 4, smoke: 520, heat: 60, beam: 0, mcp: 40, sounders: 90, modules: 30 },
      ff: { sprinklers: 900, pipeMeters: 3600, hoseReels: 16, landingValves: 8, hydrants: 4, alarmValves: 4, pumpSets: 1, extinguishers: 60 },
      notes: 'Pump room ready. Civil Defence pre-inspection requested for next month.',
      target: 0.81, skew: 0.04, crew: ['Mohammed Aslam', 'Sajid Ali', 'Manoj Yadav'],
    },
    {
      code: 'AUH-127', name: 'Yas West Villas — Cluster 6', client: 'Al Noor Real Estate Development',
      contractor: 'Palm Coast Builders', consultant: 'Arcline Consulting Engineers',
      emirate: 'Abu Dhabi', area: 'Yas Island', lat: 24.4700, lng: 54.5870, status: 'active', systems: ['FA'], faShare: 100,
      startDate: addDays(t, -70), targetDate: addDays(t, 60),
      conditions: D({ buildingType: 'villa', floors: 2, ceilingHeight: 3.2, voidDepth: 0.9 }),
      fa: { panels: 48, loops: 48, smoke: 672, heat: 96, beam: 0, mcp: 48, sounders: 96, modules: 48 },
      ff: { ...FF0 },
      notes: '48 villas, one conventional panel each. Void > 800 mm in living areas.',
      target: 0.46, crew: ['Nikhil Menon', 'Harun Mia'],
    },
    {
      code: 'AAN-032', name: 'Tawam Clinic Extension', client: 'Oasis Health Services',
      contractor: 'Hili Building Contracting', consultant: 'Meridian Engineering Consultants',
      emirate: 'Abu Dhabi', area: 'Al Ain', lat: 24.1910, lng: 55.7070, status: 'snagging', systems: ['FA', 'FF'], faShare: 45,
      startDate: addDays(t, -300), targetDate: addDays(t, 14),
      conditions: D({ buildingType: 'hospital', floors: 3, ceilingHeight: 3.6, voidDepth: 1.1 }),
      fa: { panels: 1, loops: 3, smoke: 310, heat: 40, beam: 0, mcp: 24, sounders: 60, modules: 45 },
      ff: { sprinklers: 620, pipeMeters: 2400, hoseReels: 10, landingValves: 6, hydrants: 2, alarmValves: 3, pumpSets: 1, extinguishers: 30 },
      notes: 'Snag list from consultant walk-through — 23 items open.',
      target: 0.94, skew: -0.03, crew: ['Vinod Pillai', 'Rahul Das'],
    },
    {
      code: 'DXB-057', name: 'Dubai South Office Block B3', client: 'Southgate Business Parks',
      contractor: 'Crescent Contracting Co.', consultant: 'Arcline Consulting Engineers',
      emirate: 'Dubai', area: 'Dubai South', lat: 24.8970, lng: 55.1580, status: 'on-hold', systems: ['FA', 'FF'], faShare: 40,
      startDate: addDays(t, -120), targetDate: addDays(t, 150),
      conditions: D({ buildingType: 'office', floors: 7, ceilingHeight: 3.0, voidDepth: 0.7 }),
      fa: { panels: 1, loops: 4, smoke: 480, heat: 30, beam: 0, mcp: 30, sounders: 70, modules: 40 },
      ff: { sprinklers: 1100, pipeMeters: 4100, hoseReels: 14, landingValves: 14, hydrants: 2, alarmValves: 7, pumpSets: 1, extinguishers: 40 },
      notes: 'On hold — waiting for revised shop drawings approval (Dubai Civil Defence).',
      target: 0.22, skew: 0.05, crew: [],
    },
    {
      code: 'AUH-131', name: 'Saadiyat School Campus — Block A', client: 'Crescent Education Holdings',
      contractor: 'Palm Coast Builders', consultant: 'Meridian Engineering Consultants',
      emirate: 'Abu Dhabi', area: 'Saadiyat Island', lat: 24.5450, lng: 54.4330, status: 'active', systems: ['FA', 'FF'], faShare: 40,
      startDate: addDays(t, -18), targetDate: addDays(t, 200),
      conditions: D({ buildingType: 'school', ceiling: 'mixed', floors: 3, ceilingHeight: 3.8, voidDepth: 0.5 }),
      fa: { panels: 1, loops: 3, smoke: 260, heat: 30, beam: 0, mcp: 22, sounders: 55, modules: 20 },
      ff: { sprinklers: 540, pipeMeters: 2100, hoseReels: 8, landingValves: 0, hydrants: 3, alarmValves: 3, pumpSets: 1, extinguishers: 28 },
      notes: 'Mobilised. Sleeves in slab done by civil — confirm locations before hanger install.',
      target: 0.08, skew: 0.03, crew: ['Kiran Joseph', 'Asif Iqbal'],
    },
    {
      code: 'RUW-009', name: 'Ruwais Retail Mall Extension', client: 'Dhafra Retail Estates',
      contractor: 'Crescent Contracting Co.', consultant: 'Arcline Consulting Engineers',
      emirate: 'Abu Dhabi', area: 'Ruwais', lat: 24.1080, lng: 52.7300, status: 'completed', systems: ['FA', 'FF'], faShare: 40,
      startDate: addDays(t, -420), targetDate: addDays(t, -25),
      conditions: D({ buildingType: 'mall', ceiling: 'mixed', floors: 2, ceilingHeight: 6.5, voidDepth: 1.2 }),
      fa: { panels: 2, loops: 6, smoke: 700, heat: 60, beam: 6, mcp: 50, sounders: 120, modules: 90 },
      ff: { sprinklers: 1800, pipeMeters: 6400, hoseReels: 24, landingValves: 12, hydrants: 8, alarmValves: 10, pumpSets: 1, extinguishers: 70 },
      notes: 'Handed over. Civil Defence completion certificate received.',
      target: 1, crew: [],
    },
  ];
}

const LOCATIONS: Record<string, string[]> = {
  tower: ['L14', 'L15', 'L16', 'L17', 'L18', 'L19', 'L20', 'B2', 'Podium P1', 'Roof'],
  warehouse: ['Bay 1–2', 'Bay 3–4', 'Bay 5–6', 'Office mezzanine', 'Pump room', 'Loading dock'],
  'labour-camp': ['Block A · GF', 'Block A · 1F', 'Block B · 2F', 'Block B · 3F', 'Kitchen & mess', 'Pump room'],
  villa: ['Villa 11', 'Villa 14', 'Villa 19', 'Villa 23', 'Villa 27', 'Villa 31', 'Villa 36'],
  hospital: ['Ward wing · L1', 'OPD · GF', 'Theatre corridor · L2', 'Plant room', 'Roof'],
  office: ['L3', 'L4', 'L5', 'Basement', 'Roof'],
  school: ['Classroom wing · GF', 'Classroom wing · 1F', 'Sports hall', 'Admin block', 'Pump room'],
  mall: ['Atrium', 'Retail row A', 'Food court', 'Car park'],
};

/** daily output for a pair of workers, by work item */
const RATE: Record<string, number> = {
  'fa.containment': 90, 'fa.cabling': 160, 'fa.firstfix': 35, 'fa.detectors': 40, 'fa.beam': 3, 'fa.mcp': 12,
  'fa.sounders': 18, 'fa.modules': 8, 'fa.panel': 1, 'fa.program': 1, 'fa.testing': 1, 'fa.adcd': 1,
  'ff.supports': 26, 'ff.piping': 42, 'ff.heads': 30, 'ff.valves': 1, 'ff.hosereels': 3, 'ff.landing': 3,
  'ff.hydrants': 1, 'ff.pumps': 1, 'ff.pressure': 1, 'ff.painting': 70, 'ff.extinguishers': 12, 'ff.testing': 1, 'ff.adcd': 1,
};

const ISSUES = [
  'Ceiling access panels not yet provided by ID contractor in corridors.',
  'Scaffold tower shared with MEP — lost 2 hours waiting.',
  'Main contractor asked to shift two detector positions near new bulkhead — RFI raised.',
  'Material delivery arrived after 2 pm; unloaded next morning.',
  'Power shutdown on the floor for the utility connection — cable pulling stopped for the afternoon.',
];

export function buildSample(): Data {
  const t = today();
  const r = rng(20260927);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const data = emptyData();
  data.initialised = true;
  data.sampleLoaded = true;
  data.settings = { ...data.settings };

  const people: Person[] = PEOPLE.map((p) => ({ ...p, id: uid() }));
  const byName = new Map(people.map((p) => [p.name, p]));
  data.people = people;

  const seeds = siteSeeds(t);
  const sites: Site[] = [];
  const workItems: WorkItem[] = [];
  const tasks: Task[] = [];
  const allocations: Allocation[] = [];
  const logs: DailyLog[] = [];
  const txns: MaterialTxn[] = [];
  const expenses: Expense[] = [];

  // working days: last 13 days + today, skipping Fridays
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(t, -i);
    if (parseISO(d).getDay() !== 5) days.push(d);
  }

  for (const seed of seeds) {
    const { target: siteTarget, skew = 0, crew, ...rest } = seed;
    const site: Site = { ...rest, id: uid(), createdAt: new Date(addDays(t, -30)).toISOString() };
    sites.push(site);
    const items = syncWorkItems(site, []);

    // target completion per item: earlier stages further along, calibrated so each system lands on the target
    const targetDone = new Map<string, number>();
    for (const sys of ['FA', 'FF'] as const) {
      const list = items.filter((w) => w.system === sys);
      if (!list.length) continue;
      const target = siteTarget >= 1 ? 1 : clamp01(siteTarget + (site.systems.length > 1 ? (sys === 'FA' ? skew : -skew) : 0));
      const stage = (i: number) => (list.length > 1 ? i / (list.length - 1) : 0);
      const curve = (o: number, i: number) => (target >= 1 ? 1 : clamp01((o - stage(i)) / 0.35));
      const total = list.reduce((a, w) => a + w.weight, 0);
      const avg = (o: number) => list.reduce((a, w, i) => a + w.weight * curve(o, i), 0) / total;
      let lo = -0.4;
      let hi = 1.4;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (avg(mid) < target) lo = mid;
        else hi = mid;
      }
      list.forEach((w, i) => {
        targetDone.set(w.id, Math.round(curve(hi, i) * w.qty));
      });
    }
    const remainingTarget = new Map(targetDone);
    const crewPeople = crew.map((n) => byName.get(n)!).filter(Boolean);
    const locs = LOCATIONS[site.conditions.buildingType] ?? ['GF'];
    const workingSite = site.status === 'active' || site.status === 'snagging';

    if (workingSite && crewPeople.length) {
      // walk days newest → oldest so today's tasks get priority
      for (let di = days.length - 1; di >= 0; di--) {
        const day = days[di];
        const isToday = day === t;
        for (const p of crewPeople) allocations.push({ id: uid(), date: day, personId: p.id, siteId: site.id, attendance: 'present' });

        const pairs = Math.max(1, Math.floor(crewPeople.length / 2));
        const front = items.filter((w) => (remainingTarget.get(w.id) ?? 0) > 0).slice(-pairs);
        const nextUp = items.find((w) => (targetDone.get(w.id) ?? 0) < w.qty);
        if (isToday && nextUp && !front.includes(nextUp)) front.push(nextUp);
        const chosen = front.slice(0, 4);

        chosen.forEach((w, idx) => {
          const tech = crewPeople.filter((p) => p.role !== 'foreman' && (p.trade === 'both' || p.trade === w.system));
          const pool = tech.length ? tech : crewPeople;
          const assignees = [...new Set([pool[idx % pool.length], pool[(idx + 1) % pool.length]].map((p) => p.id))];
          const rate = RATE[w.key] ?? 10;
          const plan = Math.max(1, Math.min(w.qty, Math.round(rate * (0.8 + r() * 0.4))));
          const left = remainingTarget.get(w.id) ?? 0;
          let done = Math.min(left, Math.round(plan * (0.75 + r() * 0.3)));
          let status: Task['status'] = done >= plan ? 'done' : 'in-progress';
          let blockReason = '';
          const loc = pick(locs);
          if (isToday) {
            if (idx === 0) {
              status = 'in-progress';
              done = Math.min(left, Math.round(plan * 0.55));
            } else if (idx === 1 && site.code === 'AUH-118') {
              status = 'blocked';
              done = 0;
              blockReason = `Ceiling boards closed at ${loc} before our work — waiting for ID contractor to open access panels.`;
            } else {
              status = 'planned';
              done = 0;
            }
          } else if (done < plan && r() > 0.5) status = 'done';
          remainingTarget.set(w.id, left - done);
          tasks.push({
            id: uid(), siteId: site.id, date: day, workItemId: w.id,
            title: w.label, location: loc, assignees, plannedQty: plan, doneQty: done,
            status, blockReason, note: '', updatedBy: 'engineer', updatedAt: new Date().toISOString(),
          });
        });

        if (!isToday && di >= days.length - 6) {
          const done = tasks.filter((x) => x.siteId === site.id && x.date === day && x.doneQty > 0);
          logs.push({
            id: uid(), siteId: site.id, date: day,
            summary: done.map((x) => `${x.title} at ${x.location}: ${x.doneQty} ${items.find((w) => w.id === x.workItemId)?.unit}`).join('. ') + '.',
            issues: r() > 0.55 ? pick(ISSUES) : '',
            nextPlan: 'Continue current fronts; prepare area for next stage.',
            inspections: r() > 0.8 ? 'Consultant inspection of installed pipework — accepted with minor comments.' : '',
          });
        }
      }
    }

    for (const w of items) {
      const tgt = targetDone.get(w.id) ?? 0;
      const fromTasks = tgt - (remainingTarget.get(w.id) ?? 0);
      w.baseDone = Math.max(0, tgt - fromTasks);
    }
    workItems.push(...items);

    // material deliveries and usage consistent with progress
    const est = estimateMaterials(site).lines;
    let dn = 4400 + Math.floor(r() * 300);
    for (const l of est) {
      if (l.key === 'site.access' || l.key === 'ff.testpump') continue;
      const progressFactor = siteTarget >= 1 ? 1 : clamp01(siteTarget + (l.group.includes('Devices') || l.group.includes('Sprinklers') || l.group.includes('Valves') ? -0.1 : 0.05));
      let used = Math.round(l.qty * progressFactor * 0.96);
      let delivered = siteTarget >= 1 ? l.qty : Math.min(l.qty, used + Math.max(Math.ceil(l.qty * 0.1), Math.round(l.qty * (0.1 + r() * 0.2))));
      if (site.code === 'AUH-118' && l.key === 'fa.cable') { used = Math.round(l.qty * 0.52); delivered = used + 120; }
      if (site.code === 'AUH-118' && l.key === 'ff.hangers') { delivered = used; }
      if (site.code === 'AUH-121' && l.key === 'ff.clamps') { used = Math.round(l.qty * 0.4); delivered = used + 6; }
      if (site.code === 'AUH-121' && l.key === 'ff.pipe25') { delivered = used; }
      if (site.code === 'AUH-124' && l.key === 'ff.upright68') { delivered = used + 4; }
      if (delivered <= 0) continue;
      const first = Math.round(delivered * 0.6);
      txns.push({ id: uid(), siteId: site.id, date: addDays(t, -24 - Math.floor(r() * 6)), key: l.key, type: 'in', qty: first, ref: `DN-${dn++}`, note: '' });
      if (delivered - first > 0) txns.push({ id: uid(), siteId: site.id, date: addDays(t, -3 - Math.floor(r() * 8)), key: l.key, type: 'in', qty: delivered - first, ref: `DN-${dn++}`, note: '' });
      if (used > 0) txns.push({ id: uid(), siteId: site.id, date: addDays(t, -1 - Math.floor(r() * 4)), key: l.key, type: 'out', qty: used, ref: '', note: 'Issued to installation' });
    }
  }

  // leave for one helper today
  const prakash = byName.get('Prakash Gurung')!;
  allocations.push({ id: uid(), date: t, personId: prakash.id, siteId: null, attendance: 'leave' });

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

  return { ...data, sites, workItems, tasks, allocations, logs, txns, expenses };
}
