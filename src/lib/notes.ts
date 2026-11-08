import type { Person, Site } from '../types';
import type { Data } from '../store/store';
import { materialRows, progressDelta } from './progress';
import { firstName, fmtDate, fmtDay, num, placeName, today } from './util';

export const ROLE_LABEL = { foreman: 'Foreman', technician: 'Technician', helper: 'Helper' } as const;
const ROLE_TAG = { foreman: ' (F)', technician: '', helper: ' (H)' } as const;

const signedPct = (d: number | null) => {
  if (d === null) return '';
  const v = Math.round(d * 1000) / 10;
  return v === 0 ? ' (±0%)' : ` (${v > 0 ? '+' : ''}${v}%)`;
};
const p = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);

export function crewOn(data: Pick<Data, 'allocations' | 'people'>, siteId: string, date: string): Person[] {
  const ids = data.allocations.filter((a) => a.date === date && a.siteId === siteId && a.attendance === 'present').map((a) => a.personId);
  const order = { foreman: 0, technician: 1, helper: 2 };
  return data.people.filter((x) => ids.includes(x.id)).sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
}

export function crewBreakdown(crew: Person[]) {
  const c = { foreman: 0, technician: 0, helper: 0 };
  crew.forEach((x) => c[x.role]++);
  return c;
}

export function siteDailyNote(site: Site, data: Data, date: string) {
  const d = progressDelta(site, data, date);
  const crew = crewOn(data, site.id, date);
  const cb = crewBreakdown(crew);
  const tasks = data.tasks.filter((t) => t.siteId === site.id && t.date === date);
  const items = new Map(data.workItems.map((w) => [w.id, w]));
  const log = data.logs.find((l) => l.siteId === site.id && l.date === date);
  const received = data.txns.filter((t) => t.siteId === site.id && t.date === date && t.type === 'in');
  const { rows } = materialRows(site, data);
  const names = new Map(rows.map((r) => [r.key, r]));
  const short = rows.filter((r) => r.state === 'short' || r.state === 'low');
  const who = (ids: string[]) => ids.map((id) => firstName(data.people.find((x) => x.id === id)?.name ?? '')).filter(Boolean).join(', ');

  const L: string[] = [];
  L.push(`*DAILY PROGRESS — ${fmtDay(date)} ${date.slice(0, 4)}*`);
  L.push(`*${site.name}* (${site.code})`);
  L.push(`${placeName(site)}`);
  L.push('');
  L.push('*Progress*');
  const parts: string[] = [];
  if (d.now.FA !== null) parts.push(`FA ${p(d.now.FA)}${signedPct(d.FA)}`);
  if (d.now.FF !== null) parts.push(`FF ${p(d.now.FF)}${signedPct(d.FF)}`);
  L.push(parts.join(' · '));
  if (parts.length > 1) L.push(`Overall ${p(d.now.overall)}${signedPct(d.overall)}`);
  L.push('');
  L.push(`*Manpower: ${crew.length}*`);
  if (crew.length) {
    L.push(`Foreman ${cb.foreman} · Technicians ${cb.technician} · Helpers ${cb.helper}`);
    L.push(crew.map((x) => `${firstName(x.name)}${ROLE_TAG[x.role]}`).join(', '));
  }
  const worked = tasks.filter((t) => t.status !== 'blocked');
  if (worked.length) {
    L.push('');
    L.push("*Today's work*");
    worked.forEach((t, i) => {
      const w = t.workItemId ? items.get(t.workItemId) : undefined;
      const qty = t.doneQty > 0 ? `: ${num(t.doneQty)}${w ? ` ${w.unit}` : ''}` : '';
      const state = t.status === 'done' ? ' ✅' : t.status === 'in-progress' ? ' (in progress)' : ' (planned)';
      const by = who(t.assignees);
      L.push(`${i + 1}. ${t.title}${t.location ? ` — ${t.location}` : ''}${qty}${state}${by ? ` · ${by}` : ''}`);
    });
  }
  const blocked = tasks.filter((t) => t.status === 'blocked');
  if (blocked.length) {
    L.push('');
    L.push('*Hold-ups*');
    blocked.forEach((t) => L.push(`• ${t.title}${t.location ? ` — ${t.location}` : ''}: ${t.blockReason || 'blocked'}`));
  }
  if (received.length) {
    L.push('');
    L.push('*Materials received*');
    received.forEach((t) => {
      const r = names.get(t.key);
      L.push(`• ${r?.name ?? t.key} — ${num(t.qty)} ${r?.unit ?? ''}${t.ref ? ` (${t.ref})` : ''}`);
    });
  }
  if (short.length) {
    L.push('');
    L.push('*Materials needed*');
    short.slice(0, 8).forEach((r) => L.push(`• ${r.name} — ${num(Math.max(r.toDeliver, r.estimate - r.used - r.onSite))} ${r.unit}${r.state === 'short' ? ' (none left on site)' : ' (running low)'}`));
  }
  if (log?.issues) {
    L.push('');
    L.push('*Issues*');
    L.push(log.issues);
  }
  if (log?.inspections) {
    L.push('');
    L.push('*Inspections / visits*');
    L.push(log.inspections);
  }
  if (log?.nextPlan) {
    L.push('');
    L.push('*Plan for tomorrow*');
    L.push(log.nextPlan);
  }
  L.push('');
  L.push(`— ${data.settings.engineerName}${data.settings.companyName ? `, ${data.settings.companyName}` : ''}`);
  return L.join('\n');
}

export function allSitesNote(data: Data, date: string) {
  const sites = data.sites.filter((s) => s.status === 'active' || s.status === 'snagging');
  const L: string[] = [`*SITES SUMMARY — ${fmtDay(date)} ${date.slice(0, 4)}*`, ''];
  let total = 0;
  for (const s of sites) {
    const d = progressDelta(s, data, date);
    const crew = crewOn(data, s.id, date);
    total += crew.length;
    const blocked = data.tasks.filter((t) => t.siteId === s.id && t.date === date && t.status === 'blocked').length;
    L.push(`*${s.code} · ${s.name}*`);
    const parts: string[] = [];
    if (d.now.FA !== null) parts.push(`FA ${p(d.now.FA)}`);
    if (d.now.FF !== null) parts.push(`FF ${p(d.now.FF)}`);
    L.push(`${parts.join(' · ')} · Overall ${p(d.now.overall)}${signedPct(d.overall)}`);
    L.push(`Manpower ${crew.length}${blocked ? ` · ${blocked} task${blocked > 1 ? 's' : ''} on hold` : ''}${s.status === 'snagging' ? ' · Snagging' : ''}`);
    L.push('');
  }
  L.push(`*Total manpower: ${total}*`);
  L.push(`— ${data.settings.engineerName}`);
  return L.join('\n');
}

export function allocationNote(data: Data, date: string) {
  const L: string[] = [`*MANPOWER ALLOCATION — ${fmtDay(date)} ${date.slice(0, 4)}*`, ''];
  const sites = data.sites.filter((s) => s.status !== 'completed');
  let total = 0;
  for (const s of sites) {
    const crew = crewOn(data, s.id, date);
    if (!crew.length) continue;
    total += crew.length;
    L.push(`*${s.code} · ${s.name}* (${crew.length})`);
    crew.forEach((x) => L.push(`• ${x.name}${x.role === 'technician' ? '' : ` — ${ROLE_LABEL[x.role]}`}`));
    L.push('');
  }
  const off = data.allocations.filter((a) => a.date === date && a.attendance !== 'present');
  if (off.length) {
    L.push('*Not on site*');
    off.forEach((a) => {
      const person = data.people.find((x) => x.id === a.personId);
      if (person) L.push(`• ${person.name} — ${a.attendance === 'leave' ? 'On leave' : a.attendance === 'absent' ? 'Absent' : 'Off'}`);
    });
    L.push('');
  }
  L.push(`*Total on site: ${total}*`);
  return L.join('\n');
}

/** Request text for WhatsApp. With `items`, lists exactly those quantities; otherwise what's short and not yet asked for. */
export function materialRequestNote(site: Site, data: Data, items?: { key: string; qty: number }[], ref = '', date = today()) {
  const { rows } = materialRows(site, data);
  const want = items ? new Map(items.map((i) => [i.key, i.qty])) : null;
  const list = rows
    .map((r) => ({ r, qty: want ? (want.get(r.key) ?? 0) : r.toRequest }))
    .filter(({ r, qty }) => qty > 0 && (want || r.state === 'short' || r.state === 'low' || r.state === 'none'));
  const L: string[] = [`*MATERIAL REQUEST${ref ? ` ${ref}` : ''} — ${fmtDate(date)}*`, `*${site.name}* (${site.code})`, ''];
  let last = '';
  for (const { r, qty } of list) {
    if (r.group !== last) {
      L.push(`_${r.group}_`);
      last = r.group;
    }
    L.push(`• ${r.name} — ${num(qty)} ${r.unit}`);
  }
  L.push('');
  L.push(`Deliver to: ${placeName(site)}`);
  L.push(`— ${data.settings.engineerName}${data.settings.engineerPhone ? ` · ${data.settings.engineerPhone}` : ''}`);
  return L.join('\n');
}

export function openWhatsApp(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
