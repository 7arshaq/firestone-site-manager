import type { Site, System, WorkItem } from '../types';
import { faDerived, ffDerived } from './estimate';
import { uid } from './util';

interface Template {
  key: string;
  system: System;
  label: string;
  unit: string;
  weight: number;
  qty: (site: Site) => number;
}

/** Stages in installation order. Weights are the default share of each system's progress. */
export const TEMPLATES: Template[] = [
  { key: 'fa.containment', system: 'FA', label: 'Conduit & containment', unit: 'm', weight: 14, qty: (s) => faDerived(s).conduit },
  { key: 'fa.cabling', system: 'FA', label: 'Cable pulling', unit: 'm', weight: 14, qty: (s) => faDerived(s).cable },
  { key: 'fa.firstfix', system: 'FA', label: '1st fix — back boxes & bases', unit: 'nos', weight: 8, qty: (s) => faDerived(s).devices },
  { key: 'fa.detectors', system: 'FA', label: 'Detector installation', unit: 'nos', weight: 14, qty: (s) => s.fa.smoke + s.fa.heat + faDerived(s).voidDet },
  { key: 'fa.beam', system: 'FA', label: 'Beam detectors — install & align', unit: 'nos', weight: 4, qty: (s) => s.fa.beam },
  { key: 'fa.mcp', system: 'FA', label: 'Manual call points', unit: 'nos', weight: 4, qty: (s) => s.fa.mcp },
  { key: 'fa.sounders', system: 'FA', label: 'Sounders & strobes', unit: 'nos', weight: 6, qty: (s) => s.fa.sounders },
  { key: 'fa.modules', system: 'FA', label: 'Interface modules', unit: 'nos', weight: 6, qty: (s) => s.fa.modules },
  { key: 'fa.panel', system: 'FA', label: 'Panel install & termination', unit: 'nos', weight: 8, qty: (s) => s.fa.panels },
  { key: 'fa.program', system: 'FA', label: 'Programming & cause-and-effect', unit: 'loops', weight: 6, qty: (s) => s.fa.loops },
  { key: 'fa.testing', system: 'FA', label: 'Loop testing & commissioning', unit: 'loops', weight: 10, qty: (s) => s.fa.loops },
  { key: 'fa.adcd', system: 'FA', label: 'Civil Defence inspection', unit: 'lot', weight: 6, qty: (s) => (s.fa.panels > 0 ? 1 : 0) },

  { key: 'ff.supports', system: 'FF', label: 'Supports & hangers', unit: 'nos', weight: 10, qty: (s) => ffDerived(s).hangers },
  { key: 'ff.piping', system: 'FF', label: 'Pipe installation', unit: 'm', weight: 24, qty: (s) => s.ff.pipeMeters },
  { key: 'ff.heads', system: 'FF', label: 'Sprinkler heads & drops', unit: 'nos', weight: 12, qty: (s) => s.ff.sprinklers },
  { key: 'ff.valves', system: 'FF', label: 'Alarm / zone control valves', unit: 'sets', weight: 6, qty: (s) => s.ff.alarmValves },
  { key: 'ff.hosereels', system: 'FF', label: 'Hose reel cabinets', unit: 'nos', weight: 5, qty: (s) => s.ff.hoseReels },
  { key: 'ff.landing', system: 'FF', label: 'Landing valves', unit: 'nos', weight: 4, qty: (s) => s.ff.landingValves },
  { key: 'ff.hydrants', system: 'FF', label: 'External hydrants', unit: 'nos', weight: 4, qty: (s) => s.ff.hydrants },
  { key: 'ff.pumps', system: 'FF', label: 'Fire pump set — install & align', unit: 'sets', weight: 10, qty: (s) => s.ff.pumpSets },
  { key: 'ff.pressure', system: 'FF', label: 'Hydrostatic pressure test', unit: 'zones', weight: 8, qty: (s) => (s.ff.pipeMeters > 0 ? Math.max(1, s.ff.alarmValves) : 0) },
  { key: 'ff.painting', system: 'FF', label: 'Painting & pipe identification', unit: 'm', weight: 6, qty: (s) => s.ff.pipeMeters },
  { key: 'ff.extinguishers', system: 'FF', label: 'Fire extinguishers', unit: 'nos', weight: 3, qty: (s) => s.ff.extinguishers },
  { key: 'ff.testing', system: 'FF', label: 'Flushing, testing & commissioning', unit: 'lot', weight: 5, qty: (s) => (s.ff.pipeMeters > 0 || s.ff.sprinklers > 0 ? 1 : 0) },
  { key: 'ff.adcd', system: 'FF', label: 'Civil Defence inspection', unit: 'lot', weight: 5, qty: (s) => (s.ff.pipeMeters > 0 || s.ff.sprinklers > 0 ? 1 : 0) },
];

export const STAGE_ORDER = new Map(TEMPLATES.map((t, i) => [t.key, i]));

/**
 * Rebuild template work items from the site's scope quantities.
 * Keeps ids, weights and base progress of existing items so linked tasks stay valid.
 * Custom (non-template) items are kept untouched.
 */
export function syncWorkItems(site: Site, existing: WorkItem[]): WorkItem[] {
  const mine = existing.filter((w) => w.siteId === site.id);
  const byKey = new Map(mine.map((w) => [w.key, w]));
  const out: WorkItem[] = [];
  for (const t of TEMPLATES) {
    if (!site.systems.includes(t.system)) continue;
    const qty = t.qty(site);
    const prev = byKey.get(t.key);
    if (qty <= 0) continue;
    out.push(
      prev
        ? { ...prev, qty, label: prev.label || t.label, baseDone: Math.min(prev.baseDone, qty) }
        : { id: uid(), siteId: site.id, system: t.system, key: t.key, label: t.label, unit: t.unit, qty, weight: t.weight, baseDone: 0 },
    );
  }
  for (const w of mine) if (w.key.startsWith('custom.') && site.systems.includes(w.system)) out.push(w);
  return out;
}
