import { jsPDF } from 'jspdf';
import { autoTable, type UserOptions } from 'jspdf-autotable';
import type { ExpenseCategory, Site } from '../types';
import type { Data } from '../store/store';
import { materialRows, progressDelta, siteProgress } from './progress';
import { crewBreakdown, crewOn, ROLE_LABEL } from './notes';
import { addDays, aed, downloadBlob, fmtDate, fmtDay, fmtSheetDate, num } from './util';
import { CATEGORY_LABEL } from './labels';
import { blobToDataURL, getPhotoBlob } from '../store/photos';

const INK: [number, number, number] = [21, 24, 29];
const GRAPHITE: [number, number, number] = [89, 97, 108];
const RULE: [number, number, number] = [213, 218, 224];
const FLAME: [number, number, number] = [184, 38, 27];
const WATER: [number, number, number] = [31, 95, 160];
const EXIT: [number, number, number] = [19, 128, 74];
const BRAND: [number, number, number] = [59, 152, 80];
const M = 14;
const W = 210;

let logoCache: Promise<string | null> | null = null;
/** Company logo for the report header (null when it can't be loaded, e.g. offline before first cache) */
function loadLogo() {
  logoCache ??= fetch(`${import.meta.env.BASE_URL}brand/logo-pdf.png`)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('logo'))))
    .then(blobToDataURL)
    .catch(() => null);
  return logoCache;
}


class Doc {
  doc = new jsPDF({ unit: 'mm', format: 'a4' });
  y = M;
  constructor(private data: Data, private title: string, private subtitle: string, private logo: string | null) {
    this.header();
  }

  static async create(data: Data, title: string, subtitle: string) {
    return new Doc(data, title, subtitle, await loadLogo());
  }

  header() {
    const d = this.doc;
    const tx = this.logo ? M + 15 : M;
    if (this.logo) d.addImage(this.logo, 'PNG', M, M - 1.4, 13.2, 10.8, 'brand-logo', 'FAST');
    d.setFont('helvetica', 'bold');
    d.setFontSize(11);
    d.setTextColor(...INK);
    d.text(this.data.settings.companyName || 'Firestone', tx, M + 4);
    d.setFont('helvetica', 'normal');
    d.setFontSize(7.5);
    d.setTextColor(...GRAPHITE);
    d.text('FIRE ALARM  ·  FIRE FIGHTING', tx, M + 8.5);
    d.setFont('helvetica', 'bold');
    d.setFontSize(12.5);
    d.setTextColor(...INK);
    d.text(this.title.toUpperCase(), W - M, M + 4, { align: 'right' });
    d.setFont('helvetica', 'normal');
    d.setFontSize(8.5);
    d.setTextColor(...GRAPHITE);
    d.text(this.subtitle, W - M, M + 8.5, { align: 'right' });
    d.setDrawColor(...BRAND);
    d.setLineWidth(0.9);
    d.line(M, M + 12, W - M, M + 12);
    this.y = M + 17;
  }

  footer() {
    const d = this.doc;
    const n = d.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      d.setPage(i);
      d.setDrawColor(...RULE);
      d.setLineWidth(0.2);
      d.line(M, 285, W - M, 285);
      d.setFontSize(7);
      d.setTextColor(...GRAPHITE);
      d.text(`Prepared by ${this.data.settings.engineerName}${this.data.settings.engineerPhone ? ` · ${this.data.settings.engineerPhone}` : ''}`, M, 289);
      d.text(`Page ${i} of ${n}`, W - M, 289, { align: 'right' });
    }
  }

  ensure(h: number) {
    if (this.y + h > 280) {
      this.doc.addPage();
      this.header();
    }
  }

  /** Drawing-sheet style title block */
  titleBlock(cells: [string, string][], cols = 4) {
    const d = this.doc;
    const cw = (W - 2 * M) / cols;
    d.setFont('helvetica', 'bold');
    d.setFontSize(8.5);
    const lines = cells.map(([, v]) => (d.splitTextToSize(v || '—', cw - 4) as string[]).slice(0, 2));
    const rowCount = Math.ceil(cells.length / cols);
    const heights = Array.from({ length: rowCount }, (_, r) =>
      Math.max(...lines.slice(r * cols, r * cols + cols).map((l) => 7.6 + l.length * 3.6)),
    );
    this.ensure(heights.reduce((a, b) => a + b, 0) + 4);
    d.setDrawColor(...INK);
    d.setLineWidth(0.25);
    let y = this.y;
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (i >= cells.length) break;
        const x = M + c * cw;
        d.rect(x, y, cw, heights[r]);
        d.setFont('helvetica', 'normal');
        d.setFontSize(6);
        d.setTextColor(...GRAPHITE);
        d.text(cells[i][0].toUpperCase(), x + 2, y + 3.6);
        d.setFont('helvetica', 'bold');
        d.setFontSize(8.5);
        d.setTextColor(...INK);
        d.text(lines[i], x + 2, y + 8.2, { lineHeightFactor: 1.2 });
      }
      y += heights[r];
    }
    this.y = y + 6;
  }

  section(title: string) {
    this.ensure(14);
    const d = this.doc;
    d.setFont('helvetica', 'bold');
    d.setFontSize(9);
    d.setTextColor(...INK);
    d.text(title.toUpperCase(), M, this.y);
    d.setDrawColor(...RULE);
    d.setLineWidth(0.2);
    d.line(M + d.getTextWidth(title.toUpperCase()) + 3, this.y - 1, W - M, this.y - 1);
    this.y += 4;
  }

  bar(label: string, value: number, delta: number | null, color: [number, number, number]) {
    const d = this.doc;
    this.ensure(9);
    d.setFont('helvetica', 'bold');
    d.setFontSize(8.5);
    d.setTextColor(...INK);
    d.text(label, M, this.y + 3.5);
    const x = M + 32;
    const bw = W - 2 * M - 32 - 34;
    d.setFillColor(238, 240, 242);
    d.rect(x, this.y, bw, 4.5, 'F');
    d.setFillColor(...color);
    d.rect(x, this.y, Math.max(0.5, bw * value), 4.5, 'F');
    d.text(`${Math.round(value * 100)}%`, x + bw + 4, this.y + 3.5);
    if (delta !== null) {
      d.setFont('helvetica', 'normal');
      d.setTextColor(...GRAPHITE);
      const v = Math.round(delta * 1000) / 10;
      d.text(`${v >= 0 ? '+' : ''}${v}% today`, W - M, this.y + 3.5, { align: 'right' });
    }
    this.y += 8;
  }

  table(opts: UserOptions) {
    this.ensure(18);
    const userParse = opts.didParseCell;
    const colStyles = (opts.columnStyles ?? {}) as Record<string, { halign?: 'left' | 'center' | 'right' }>;
    autoTable(this.doc, {
      startY: this.y,
      margin: { left: M, right: M, top: M + 17 },
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 }, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.15 } },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.2, lineWidth: 0 },
      alternateRowStyles: { fillColor: [247, 248, 249] },
      didDrawPage: (h) => {
        if (h.pageNumber > 1 && h.table.startPageNumber !== h.pageNumber) this.header();
      },
      ...opts,
      didParseCell: (h) => {
        if (h.section === 'head') {
          const align = colStyles[h.column.index]?.halign;
          if (align) h.cell.styles.halign = align;
        }
        userParse?.(h);
      },
    });
    this.y = ((this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? this.y) + 7;
  }

  paragraph(label: string, text: string) {
    if (!text.trim()) return;
    const d = this.doc;
    d.setFont('helvetica', 'normal');
    d.setFontSize(8.5);
    const lines = d.splitTextToSize(text, W - 2 * M - 34) as string[];
    this.ensure(lines.length * 4 + 4);
    d.setFont('helvetica', 'bold');
    d.setFontSize(7);
    d.setTextColor(...GRAPHITE);
    d.text(label.toUpperCase(), M, this.y + 3);
    d.setFont('helvetica', 'normal');
    d.setFontSize(8.5);
    d.setTextColor(...INK);
    d.text(lines, M + 34, this.y + 3);
    this.y += lines.length * 4 + 3;
  }

  async photos(list: { id: string; caption: string; width: number; height: number; date: string }[]) {
    if (!list.length) return;
    this.section(`Site photos (${list.length})`);
    const gap = 5;
    const bw = (W - 2 * M - gap) / 2;
    const bh = 62;
    for (let i = 0; i < list.length; i += 2) {
      this.ensure(bh + 10);
      for (let j = 0; j < 2 && i + j < list.length; j++) {
        const ph = list[i + j];
        const blob = await getPhotoBlob(ph.id, 'full');
        if (!blob) continue;
        const url = await blobToDataURL(blob);
        const s = Math.min(bw / ph.width, bh / ph.height);
        const w = ph.width * s;
        const h = ph.height * s;
        const x = M + j * (bw + gap) + (bw - w) / 2;
        this.doc.addImage(url, 'JPEG', x, this.y + (bh - h) / 2, w, h, undefined, 'FAST');
        this.doc.setFontSize(7.5);
        this.doc.setTextColor(...GRAPHITE);
        this.doc.text(this.doc.splitTextToSize(`${ph.caption || 'Photo'} · ${fmtDate(ph.date)}`, bw)[0] as string, M + j * (bw + gap), this.y + bh + 4);
      }
      this.y += bh + 9;
    }
  }

  blob() {
    this.footer();
    return this.doc.output('blob');
  }
}

export async function dailyReportPDF(site: Site, data: Data, date: string, includePhotos = true) {
  const n = data.tasks.filter((t) => t.siteId === site.id && t.date <= date).map((t) => t.date);
  const reportNo = new Set(n).size;
  const doc = await Doc.create(data, 'Daily Progress Report', `${fmtDay(date)} ${date.slice(0, 4)}  ·  No. ${String(reportNo).padStart(3, '0')}`);
  doc.titleBlock([
    ['Project', site.name], ['Code', site.code], ['Location', `${site.area}, ${site.emirate}`], ['Status', { active: 'Active', snagging: 'Snagging', 'on-hold': 'On hold', completed: 'Completed' }[site.status]],
    ['Client', site.client], ['Main contractor', site.contractor], ['Consultant', site.consultant], ['Date', fmtSheetDate(date)],
  ]);

  const d = progressDelta(site, data, date);
  doc.section('Progress');
  if (d.now.FA !== null) doc.bar('Fire alarm', d.now.FA, d.FA, FLAME);
  if (d.now.FF !== null) doc.bar('Fire fighting', d.now.FF, d.FF, WATER);
  if (d.now.FA !== null && d.now.FF !== null) doc.bar('Overall', d.now.overall, d.overall, INK);
  doc.y += 2;

  const crew = crewOn(data, site.id, date);
  const cb = crewBreakdown(crew);
  doc.section(`Manpower — ${crew.length}  (Foreman ${cb.foreman} · Technicians ${cb.technician} · Helpers ${cb.helper})`);
  if (crew.length) {
    doc.table({
      head: [['Name', 'Role', 'Trade', 'Emp. no.']],
      body: crew.map((x) => [x.name, ROLE_LABEL[x.role], x.trade === 'both' ? 'FA + FF' : x.trade, x.empNo]),
    });
  }

  const items = new Map(data.workItems.map((w) => [w.id, w]));
  const tasks = data.tasks.filter((t) => t.siteId === site.id && t.date === date);
  doc.section('Work carried out');
  if (tasks.length) {
    doc.table({
      head: [['Activity', 'Location', 'Planned', 'Done', 'Status', 'Team']],
      body: tasks.map((t) => {
        const w = t.workItemId ? items.get(t.workItemId) : undefined;
        const u = w ? ` ${w.unit}` : '';
        return [
          t.title + (t.status === 'blocked' && t.blockReason ? `\nHold-up: ${t.blockReason}` : ''),
          t.location,
          t.plannedQty ? `${num(t.plannedQty)}${u}` : '—',
          t.doneQty ? `${num(t.doneQty)}${u}` : '—',
          t.status === 'in-progress' ? 'In progress' : t.status[0].toUpperCase() + t.status.slice(1),
          t.assignees.map((id) => data.people.find((p) => p.id === id)?.name.split(' ')[0]).filter(Boolean).join(', '),
        ];
      }),
      columnStyles: { 0: { cellWidth: 58 }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      didParseCell: (h) => {
        if (h.section === 'body' && h.column.index === 4) {
          const v = String(h.cell.raw);
          if (v === 'Blocked') h.cell.styles.textColor = FLAME;
          if (v === 'Done') h.cell.styles.textColor = EXIT;
        }
      },
    });
  } else doc.paragraph('Tasks', 'No tasks recorded for this day.');

  const log = data.logs.find((l) => l.siteId === site.id && l.date === date);
  if (log) {
    doc.paragraph('Summary', log.summary);
    doc.paragraph('Issues', log.issues);
    doc.paragraph('Inspections', log.inspections);
    doc.paragraph('Plan for tomorrow', log.nextPlan);
    doc.y += 3;
  }

  doc.section('Scope progress');
  const prog = siteProgress(site, data.workItems, data.tasks, date);
  doc.table({
    head: [['System', 'Activity', 'Scope', 'Done', '%']],
    body: prog.items.map((p) => [p.item.system, p.item.label, `${num(p.item.qty)} ${p.item.unit}`, num(p.done), `${Math.round(p.frac * 100)}%`]),
    columnStyles: { 0: { cellWidth: 16 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
  });

  const { rows } = materialRows(site, data);
  const names = new Map(rows.map((r) => [r.key, r]));
  const moves = data.txns.filter((t) => t.siteId === site.id && t.date === date);
  if (moves.length) {
    doc.section('Material movements');
    doc.table({
      head: [['Material', 'Movement', 'Qty', 'Ref']],
      body: moves.map((t) => [names.get(t.key)?.name ?? t.key, t.type === 'in' ? 'Received' : t.type === 'out' ? 'Used / issued' : 'Returned', `${num(t.qty)} ${names.get(t.key)?.unit ?? ''}`, t.ref]),
      columnStyles: { 2: { halign: 'right' } },
    });
  }
  const short = rows.filter((r) => r.state === 'short' || r.state === 'low');
  if (short.length) {
    doc.section('Materials needed');
    doc.table({
      head: [['Material', 'On site', 'Still to deliver', 'Status']],
      body: short.map((r) => [r.name, `${num(r.onSite)} ${r.unit}`, `${num(r.toDeliver)} ${r.unit}`, r.state === 'short' ? 'None on site' : 'Running low']),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });
  }

  if (includePhotos) {
    const photos = data.photos.filter((p) => p.siteId === site.id && p.date === date).slice(0, 8);
    await doc.photos(photos);
  }
  return doc.blob();
}

export async function summaryReportPDF(data: Data, date: string, days = 7) {
  const from = addDays(date, -(days - 1));
  const doc = await Doc.create(data, 'Sites Progress Summary', `${fmtDate(from)} – ${fmtDate(date)}`);
  const sites = data.sites.filter((s) => s.status !== 'completed');
  doc.section('All sites');
  doc.table({
    head: [['Code', 'Site', 'Status', 'FA', 'FF', 'Overall', `+ ${days} days`, 'Crew today']],
    body: sites.map((s) => {
      const now = siteProgress(s, data.workItems, data.tasks, date);
      const before = siteProgress(s, data.workItems, data.tasks, addDays(from, -1));
      const gain = Math.round((now.overall - before.overall) * 1000) / 10;
      return [
        s.code, s.name, s.status.replace('-', ' '),
        now.FA === null ? '—' : `${Math.round(now.FA * 100)}%`,
        now.FF === null ? '—' : `${Math.round(now.FF * 100)}%`,
        `${Math.round(now.overall * 100)}%`, `${gain >= 0 ? '+' : ''}${gain}%`,
        String(crewOn(data, s.id, date).length),
      ];
    }),
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 18 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
  });

  for (const s of sites) {
    const tasks = data.tasks.filter((t) => t.siteId === s.id && t.date >= from && t.date <= date);
    const blocked = tasks.filter((t) => t.status === 'blocked' && t.date === date);
    const logs = data.logs.filter((l) => l.siteId === s.id && l.date >= from && l.date <= date && l.issues);
    if (!tasks.length && !logs.length) continue;
    doc.section(`${s.code} · ${s.name}`);
    const items = new Map(data.workItems.map((w) => [w.id, w]));
    const byItem = new Map<string, number>();
    tasks.forEach((t) => t.workItemId && byItem.set(t.workItemId, (byItem.get(t.workItemId) ?? 0) + t.doneQty));
    const lines = [...byItem.entries()].filter(([, q]) => q > 0).map(([id, q]) => `${items.get(id)?.label}: ${num(q)} ${items.get(id)?.unit}`);
    doc.paragraph('Done this week', lines.join('  ·  ') || '—');
    doc.paragraph('Hold-ups', blocked.map((t) => `${t.title} — ${t.blockReason}`).join('\n'));
    doc.paragraph('Issues', [...new Set(logs.map((l) => l.issues))].join('\n'));
    doc.y += 2;
  }
  return doc.blob();
}

export async function expenseReportPDF(data: Data, from: string, to: string, siteId: string | null) {
  const site = siteId ? data.sites.find((s) => s.id === siteId) : null;
  const doc = await Doc.create(data, 'Expense Report', `${fmtDate(from)} – ${fmtDate(to)}${site ? `  ·  ${site.code}` : ''}`);
  const list = data.expenses
    .filter((e) => e.date >= from && e.date <= to && (!siteId || e.siteId === siteId))
    .sort((a, b) => a.date.localeCompare(b.date));
  const total = list.reduce((a, e) => a + e.amount, 0);
  doc.titleBlock([
    ['Period', `${fmtSheetDate(from)} – ${fmtSheetDate(to)}`], ['Site', site ? site.name : 'All sites'], ['Entries', String(list.length)], ['Total', aed(total)],
  ]);
  const byCat = new Map<string, number>();
  list.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount));
  doc.section('By category');
  doc.table({
    head: [['Category', 'Amount', 'Share']],
    body: [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, a]) => [CATEGORY_LABEL[c as ExpenseCategory], aed(a), `${Math.round((a / (total || 1)) * 100)}%`]),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  });
  if (!site) {
    const bySite = new Map<string, number>();
    list.forEach((e) => bySite.set(e.siteId ?? '', (bySite.get(e.siteId ?? '') ?? 0) + e.amount));
    doc.section('By site');
    doc.table({
      head: [['Site', 'Amount']],
      body: [...bySite.entries()].sort((a, b) => b[1] - a[1]).map(([id, a]) => {
        const s = data.sites.find((x) => x.id === id);
        return [s ? `${s.code} · ${s.name}` : 'General / office', aed(a)];
      }),
      columnStyles: { 1: { halign: 'right' } },
    });
  }
  doc.section('All entries');
  doc.table({
    head: [['Date', 'Site', 'Category', 'Description', 'Paid by', 'Amount']],
    body: list.map((e) => [fmtSheetDate(e.date), data.sites.find((s) => s.id === e.siteId)?.code ?? 'General', CATEGORY_LABEL[e.category], e.note, e.paidBy, aed(e.amount)]),
    foot: [['', '', '', '', 'Total', aed(total)]],
    footStyles: { fontStyle: 'bold', textColor: INK },
    columnStyles: { 5: { halign: 'right' } },
  });
  return doc.blob();
}

export async function materialReportPDF(site: Site, data: Data, date: string) {
  const doc = await Doc.create(data, 'Material Status', `${site.code}  ·  ${fmtDate(date)}`);
  doc.titleBlock([
    ['Project', site.name], ['Code', site.code], ['Location', `${site.area}, ${site.emirate}`], ['Date', fmtSheetDate(date)],
  ]);
  const { rows, advisories } = materialRows(site, data);
  if (advisories.length) {
    doc.paragraph('Site conditions', advisories.join('\n'));
    doc.y += 2;
  }
  const groups = [...new Set(rows.map((r) => r.group))];
  for (const g of groups) {
    doc.section(g);
    doc.table({
      head: [['Material', 'Unit', 'Required', 'Delivered', 'Used', 'On site', 'To deliver']],
      body: rows.filter((r) => r.group === g).map((r) => [r.name, r.unit, num(r.estimate), num(r.delivered), num(r.used), num(r.onSite), num(r.toDeliver)]),
      columnStyles: { 0: { cellWidth: 66 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'right' } },
    });
  }
  return doc.blob();
}

/** Share a PDF through the phone's share sheet (WhatsApp etc.) when supported, else download it */
export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch {
      /* user cancelled — fall through to download */
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}
