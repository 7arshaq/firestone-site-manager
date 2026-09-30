import type { MaterialLine, MaterialTxn, Site, System, Task, WorkItem } from '../types';
import type { Data } from '../store/store';
import { estimateMaterials } from './estimate';
import { STAGE_ORDER } from './scope';
import { addDays, clamp01, today } from './util';

export interface ItemProgress {
  item: WorkItem;
  done: number;
  frac: number;
}

export interface SiteProgress {
  FA: number | null;
  FF: number | null;
  overall: number;
  items: ItemProgress[];
}

/** Sum of task quantities per work item, optionally up to and including a date */
function doneByItem(tasks: Task[], siteId: string, upTo?: string) {
  const map = new Map<string, number>();
  for (const t of tasks) {
    if (t.siteId !== siteId || !t.workItemId || t.doneQty <= 0) continue;
    if (upTo && t.date > upTo) continue;
    map.set(t.workItemId, (map.get(t.workItemId) ?? 0) + t.doneQty);
  }
  return map;
}

export function siteProgress(site: Site, workItems: WorkItem[], tasks: Task[], upTo?: string): SiteProgress {
  const items = workItems
    .filter((w) => w.siteId === site.id)
    .sort((a, b) => (STAGE_ORDER.get(a.key) ?? 99) - (STAGE_ORDER.get(b.key) ?? 99));
  const done = doneByItem(tasks, site.id, upTo);
  const out: ItemProgress[] = items.map((item) => {
    const d = Math.min(item.qty, item.baseDone + (done.get(item.id) ?? 0));
    return { item, done: d, frac: item.qty > 0 ? clamp01(d / item.qty) : 0 };
  });
  const sys = (s: System) => {
    const list = out.filter((p) => p.item.system === s && p.item.weight > 0);
    const w = list.reduce((a, p) => a + p.item.weight, 0);
    if (!site.systems.includes(s) || w === 0) return null;
    return list.reduce((a, p) => a + p.item.weight * p.frac, 0) / w;
  };
  const FA = sys('FA');
  const FF = sys('FF');
  let overall = 0;
  if (FA !== null && FF !== null) {
    const share = clamp01(site.faShare / 100);
    overall = FA * share + FF * (1 - share);
  } else overall = FA ?? FF ?? 0;
  return { FA, FF, overall, items: out };
}

export function progressDelta(site: Site, data: Pick<Data, 'workItems' | 'tasks'>, date = today()) {
  const now = siteProgress(site, data.workItems, data.tasks, date);
  const before = siteProgress(site, data.workItems, data.tasks, addDays(date, -1));
  return {
    now,
    before,
    FA: now.FA !== null && before.FA !== null ? now.FA - before.FA : null,
    FF: now.FF !== null && before.FF !== null ? now.FF - before.FF : null,
    overall: now.overall - before.overall,
  };
}

/** Overall progress for each of the last `days` days, oldest first */
export function progressHistory(site: Site, data: Pick<Data, 'workItems' | 'tasks'>, days = 14, end = today()) {
  const out: { date: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(end, -i);
    out.push({ date: d, value: siteProgress(site, data.workItems, data.tasks, d).overall });
  }
  return out;
}

/* ---------------- Materials on site ---------------- */

export type StockState = 'ok' | 'low' | 'short' | 'none';

export interface MaterialRow extends MaterialLine {
  estimate: number;
  delivered: number;
  used: number;
  onSite: number;
  toDeliver: number;
  state: StockState;
}

export function materialRows(site: Site, data: Pick<Data, 'overrides' | 'customMaterials' | 'txns'>): { rows: MaterialRow[]; advisories: string[] } {
  const est = estimateMaterials(site);
  const ov = data.overrides[site.id] ?? {};
  const lines: MaterialLine[] = est.lines.map((l) =>
    l.key in ov ? { ...l, qty: ov[l.key], overridden: true } : l,
  );
  for (const c of data.customMaterials.filter((m) => m.siteId === site.id)) {
    lines.push({
      key: c.key, system: c.system, group: `${c.system} · Added by you`, name: c.name, unit: c.unit,
      qty: c.qty, basis: 'Added manually', custom: true,
    });
  }
  const txns = data.txns.filter((t) => t.siteId === site.id);
  const rows = lines.map((l) => {
    const est = l.qty;
    const mine = txns.filter((t) => t.key === l.key);
    const sum = (type: MaterialTxn['type']) => mine.filter((t) => t.type === type).reduce((a, t) => a + t.qty, 0);
    const inQ = sum('in');
    const outQ = sum('out');
    const ret = sum('return');
    const delivered = inQ - ret;
    const onSite = inQ - outQ - ret;
    const toDeliver = Math.max(0, est - delivered);
    const stillNeeded = Math.max(0, est - outQ);
    // Only materials already being installed can run short; untouched ones are simply "not delivered yet".
    const inUse = outQ > 0;
    let state: StockState = 'ok';
    if (delivered <= 0 && est > 0) state = 'none';
    else if (inUse && stillNeeded > 0 && onSite <= 0) state = 'short';
    else if (inUse && stillNeeded > 0 && onSite < Math.max(1, est * 0.06) && onSite < stillNeeded) state = 'low';
    return { ...l, estimate: est, delivered, used: outQ, onSite, toDeliver, state };
  });
  return { rows, advisories: est.advisories };
}

/** Materials that need attention: delivered but running out, or started work with nothing on site */
export function materialAlerts(site: Site, data: Pick<Data, 'overrides' | 'customMaterials' | 'txns'>) {
  return materialRows(site, data).rows.filter((r) => r.state === 'short' || r.state === 'low');
}
