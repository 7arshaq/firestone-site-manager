import type { CustomMaterial, MaterialTxn, PhotoMeta, ScopeItem, Site, Task } from '../../types';
import type { Data } from '../store';
import type { V1Data } from './types';
import { estimateMaterials } from './estimate';
import { num, today, uid } from '../../lib/util';

/**
 * Brings data saved by Version 1 (device quantities, weighted stages, worked-out materials) into Version 2:
 * - each stage becomes a scope list item ("Cable pulling — 38,000 m"), ticked when it was 100%;
 * - tasks and photos keep their link through the new item, and quantities done go into the task note;
 * - the worked-out material list becomes the site's own material list, so stock history is kept.
 */
export function upgradeFromV1(old: V1Data): Data {
  const t = today();
  const workItems = old.workItems ?? [];
  const adjustments = old.adjustments ?? [];
  const overrides = old.overrides ?? {};
  const scopeItems: ScopeItem[] = [];
  const itemFor = new Map<string, string>();
  const unitFor = new Map(workItems.map((w) => [w.id, w.unit]));
  const customMaterials: CustomMaterial[] = [...(old.customMaterials ?? [])];
  let txns: MaterialTxn[] = [...(old.txns ?? [])];

  for (const site of old.sites ?? []) {
    const startedOn = site.startDate && site.startDate <= t ? site.startDate : t;
    workItems
      .filter((w) => w.siteId === site.id && w.qty > 0)
      .forEach((w, i) => {
        const fromTasks = (old.tasks ?? []).filter((x) => x.workItemId === w.id && x.doneQty > 0);
        const fromAdj = adjustments.filter((a) => a.workItemId === w.id);
        const done = Math.max(0, Math.min(w.qty, w.baseDone + fromTasks.reduce((a, x) => a + x.doneQty, 0) + fromAdj.reduce((a, x) => a + x.qty, 0)));
        const frac = done / w.qty;
        const last = [...fromTasks.map((x) => x.date), ...fromAdj.map((x) => x.date)].sort().pop() ?? startedOn;
        const id = uid();
        itemFor.set(w.id, id);
        scopeItems.push({
          id,
          siteId: site.id,
          system: w.system,
          kind: 'scope',
          text: `${w.label} — ${num(w.qty)} ${w.unit}${frac > 0 && frac < 1 ? ` (about ${Math.round(frac * 100)}% done when moved to the list)` : ''}`,
          addedOn: startedOn,
          doneOn: frac >= 1 ? last : null,
          order: i,
        });
      });

    // the worked-out material list becomes this site's own list; keys are made unique per site
    if (site.conditions && site.fa && site.ff) {
      const ov = overrides[site.id] ?? {};
      for (const l of estimateMaterials(site).lines) {
        const key = `v1.${site.id}.${l.key}`;
        customMaterials.push({ key, siteId: site.id, system: l.system, name: l.name, unit: l.unit, qty: l.key in ov ? ov[l.key] : l.qty });
        txns = txns.map((x) => (x.siteId === site.id && x.key === l.key ? { ...x, key } : x));
      }
    }
  }

  const sites: Site[] = (old.sites ?? []).map(({ faShare: _s, conditions: _c, fa: _a, ff: _f, ...rest }) => rest);
  const tasks: Task[] = (old.tasks ?? []).map(({ workItemId, plannedQty: _p, doneQty, ...rest }) => ({
    ...rest,
    scopeItemId: workItemId ? (itemFor.get(workItemId) ?? null) : null,
    note: doneQty > 0 ? [rest.note, `Done: ${num(doneQty)} ${workItemId ? (unitFor.get(workItemId) ?? '') : ''}`.trim()].filter(Boolean).join(' · ') : rest.note,
  }));
  const photos: PhotoMeta[] = (old.photos ?? []).map(({ workItemId, ...rest }) => ({ ...rest, scopeItemId: workItemId ? (itemFor.get(workItemId) ?? null) : null }));

  return {
    sites,
    scopeItems,
    people: old.people ?? [],
    tasks,
    allocations: old.allocations ?? [],
    logs: old.logs ?? [],
    txns,
    customMaterials,
    expenses: old.expenses ?? [],
    photos,
    drawings: old.drawings ?? [],
    settings: old.settings,
    initialised: old.initialised,
    sampleLoaded: old.sampleLoaded,
  };
}
