import type { MaterialTxn, ScopeItem, Site, System } from '../types';
import type { Data } from '../store/store';
import { addDays, today } from './util';

/* ---------------- Scope list progress ---------------- */

export interface SiteProgress {
  /** share of fire alarm items done, or null when the site has no FA items */
  FA: number | null;
  FF: number | null;
  /** share of all items done (FA, FF and general together) */
  overall: number;
  total: number;
  done: number;
}

/** Scope items of one site as they stood on a date: items added later are left out, items finished later count as pending */
export function itemsOn(items: ScopeItem[], siteId: string, upTo?: string) {
  return items.filter((i) => i.siteId === siteId && (!upTo || i.addedOn <= upTo));
}

export const isDone = (i: ScopeItem, upTo?: string) => i.doneOn !== null && (!upTo || i.doneOn <= upTo);

/** Progress = items done ÷ items on the list. No weights or quantities. */
export function siteProgress(site: Site, scopeItems: ScopeItem[], upTo?: string): SiteProgress {
  const list = itemsOn(scopeItems, site.id, upTo);
  const done = list.filter((i) => isDone(i, upTo)).length;
  const sys = (s: System) => {
    const mine = list.filter((i) => i.system === s);
    return site.systems.includes(s) && mine.length ? mine.filter((i) => isDone(i, upTo)).length / mine.length : null;
  };
  return { FA: sys('FA'), FF: sys('FF'), overall: list.length ? done / list.length : 0, total: list.length, done };
}

type ProgressData = Pick<Data, 'scopeItems'>;

export function progressDelta(site: Site, data: ProgressData, date = today()) {
  const now = siteProgress(site, data.scopeItems, date);
  const before = siteProgress(site, data.scopeItems, addDays(date, -1));
  return {
    now,
    before,
    FA: now.FA !== null && before.FA !== null ? now.FA - before.FA : null,
    FF: now.FF !== null && before.FF !== null ? now.FF - before.FF : null,
    overall: now.overall - before.overall,
  };
}

/** Overall progress for each of the last `days` days, oldest first */
export function progressHistory(site: Site, data: ProgressData, days = 14, end = today()) {
  const out: { date: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(end, -i);
    out.push({ date: d, value: siteProgress(site, data.scopeItems, d).overall });
  }
  return out;
}

/** Pending items first (in list order), then finished ones (latest first) */
export function sortScope(items: ScopeItem[]) {
  return [...items].sort((a, b) => {
    if (!a.doneOn !== !b.doneOn) return a.doneOn ? 1 : -1;
    if (a.doneOn && b.doneOn && a.doneOn !== b.doneOn) return b.doneOn.localeCompare(a.doneOn);
    return a.order - b.order;
  });
}

/* ---------------- Materials on site ---------------- */

export type StockState = 'ok' | 'low' | 'short' | 'none';

export interface MaterialRow {
  key: string;
  system: System | null;
  name: string;
  unit: string;
  /** how much the site needs, as typed by the engineer */
  needed: number;
  delivered: number;
  used: number;
  onSite: number;
  toDeliver: number;
  /** asked for but not delivered yet (requests minus deliveries since) */
  requested: number;
  /** still to ask for: needed − delivered − already requested */
  toRequest: number;
  state: StockState;
}

export const materialGroup = (s: System | null) => (s === 'FA' ? 'Fire alarm' : s === 'FF' ? 'Fire fighting' : 'General');

export function materialRows(site: Site, data: Pick<Data, 'customMaterials' | 'txns'>): MaterialRow[] {
  const order = { FA: 0, FF: 1, general: 2 };
  const txns = data.txns.filter((t) => t.siteId === site.id);
  return data.customMaterials
    .filter((m) => m.siteId === site.id)
    .sort((a, b) => order[a.system ?? 'general'] - order[b.system ?? 'general'])
    .map((m) => {
      const needed = m.qty;
      const mine = txns.filter((t) => t.key === m.key);
      const sum = (type: MaterialTxn['type']) => mine.filter((t) => t.type === type).reduce((a, t) => a + t.qty, 0);
      const inQ = sum('in');
      const outQ = sum('out');
      const ret = sum('return');
      const delivered = inQ - ret;
      const onSite = inQ - outQ - ret;
      const toDeliver = Math.max(0, needed - delivered);
      // a request stays open until deliveries made after it cover it; deliveries before it don't count
      let requested = 0;
      for (const t of [...mine].sort((a, b) => a.date.localeCompare(b.date))) {
        if (t.type === 'request') requested += t.qty;
        else if (t.type === 'in') requested = Math.max(0, requested - t.qty);
      }
      const toRequest = Math.max(0, toDeliver - requested);
      const stillNeeded = Math.max(0, needed - outQ);
      // only materials already being used can run short; untouched ones are simply "not delivered yet"
      const inUse = outQ > 0;
      let state: StockState = 'ok';
      if (delivered <= 0 && needed > 0) state = 'none';
      else if (inUse && stillNeeded > 0 && onSite <= 0) state = 'short';
      else if (inUse && stillNeeded > 0 && onSite < Math.max(1, needed * 0.06) && onSite < stillNeeded) state = 'low';
      return { key: m.key, system: m.system, name: m.name, unit: m.unit, needed, delivered, used: outQ, onSite, toDeliver, requested, toRequest, state };
    });
}

/** Materials that need attention: delivered but running out, or started work with nothing on site */
export function materialAlerts(site: Site, data: Pick<Data, 'customMaterials' | 'txns'>) {
  return materialRows(site, data).filter((r) => r.state === 'short' || r.state === 'low');
}
