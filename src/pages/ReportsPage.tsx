import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileDown, MessageSquareText } from 'lucide-react';
import { getData, useStore } from '../store/store';
import { allSitesNote, allocationNote, materialRequestNote } from '../lib/notes';
import { makePdf } from '../lib/pdfLazy';
import type * as Pdf from '../lib/pdf';
import { ShareText } from '../components/ShareText';
import { DateStepper, toast } from '../components/ui';
import { addDays, fmtDay, today } from '../lib/util';

export default function ReportsPage() {
  const sites = useStore((s) => s.sites);
  const current = sites.filter((s) => s.status !== 'completed');
  const [date, setDate] = useState(today());
  const [siteId, setSiteId] = useState(current[0]?.id ?? '');
  const [matSite, setMatSite] = useState(current[0]?.id ?? '');
  const [expFrom, setExpFrom] = useState(addDays(today(), -30));
  const [expTo, setExpTo] = useState(today());
  const [share, setShare] = useState<{ title: string; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const pdf = async (key: string, make: (p: typeof Pdf) => Promise<Blob>, name: string) => {
    setBusy(key);
    try {
      const r = await makePdf(make, name);
      toast(r === 'shared' ? 'PDF shared' : 'PDF downloaded');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__title">
          <span className="label">PDF & WhatsApp</span>
          <h1 className="h1">Reports</h1>
        </div>
        <div className="page-head__actions">
          <DateStepper value={date} onChange={setDate} />
        </div>
      </div>

      <div className="reports">
        <section className="card report-card">
          <div className="card__body stack">
            <span className="label">Per site · daily</span>
            <h2 className="h2">Daily progress report</h2>
            <p className="muted small">Progress, manpower, work done, hold-ups, materials and photos for one site.</p>
            <select className="select" value={siteId} onChange={(e) => setSiteId(e.target.value)} aria-label="Site">
              {sites.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </select>
            <div className="row row--wrap">
              <Link to={`/sites/${siteId}/report`} className="btn btn--primary">
                Open report <ArrowRight />
              </Link>
            </div>
          </div>
        </section>

        <section className="card report-card">
          <div className="card__body stack">
            <span className="label">All sites · {fmtDay(date)}</span>
            <h2 className="h2">Sites summary</h2>
            <p className="muted small">One message with every current site's FA/FF progress, today's change and manpower. Weekly PDF for the office.</p>
            <div className="row row--wrap">
              <button className="btn btn--primary" onClick={() => setShare({ title: 'Sites summary', text: allSitesNote(getData(), date) })}>
                <MessageSquareText /> WhatsApp note
              </button>
              <button className="btn" disabled={busy === 'sum'} onClick={() => pdf('sum', (p) => p.summaryReportPDF(getData(), date, 7), `sites-summary-${date}.pdf`)}>
                <FileDown /> {busy === 'sum' ? 'Preparing…' : 'Weekly PDF'}
              </button>
            </div>
          </div>
        </section>

        <section className="card report-card">
          <div className="card__body stack">
            <span className="label">Team · {fmtDay(date)}</span>
            <h2 className="h2">Manpower allocation</h2>
            <p className="muted small">Who goes to which site, grouped by site, plus who's on leave. Set it on the Today board first.</p>
            <div className="row row--wrap">
              <button className="btn btn--primary" onClick={() => setShare({ title: 'Manpower allocation', text: allocationNote(getData(), date) })}>
                <MessageSquareText /> WhatsApp note
              </button>
              <Link to="/today" className="btn">Today board</Link>
            </div>
          </div>
        </section>

        <section className="card report-card">
          <div className="card__body stack">
            <span className="label">Per site</span>
            <h2 className="h2">Material status & request</h2>
            <p className="muted small">Required vs delivered vs used for every material, and a request note for what's short.</p>
            <select className="select" value={matSite} onChange={(e) => setMatSite(e.target.value)} aria-label="Site">
              {current.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </select>
            <div className="row row--wrap">
              <button
                className="btn btn--primary"
                onClick={() => {
                  const s = sites.find((x) => x.id === matSite);
                  if (s) setShare({ title: 'Material request', text: materialRequestNote(s, getData()) });
                }}
              >
                <MessageSquareText /> Request note
              </button>
              <button
                className="btn"
                disabled={busy === 'mat'}
                onClick={() => {
                  const s = sites.find((x) => x.id === matSite);
                  if (s) pdf('mat', (p) => p.materialReportPDF(s, getData(), date), `${s.code}-materials-${date}.pdf`);
                }}
              >
                <FileDown /> {busy === 'mat' ? 'Preparing…' : 'PDF'}
              </button>
            </div>
          </div>
        </section>

        <section className="card report-card">
          <div className="card__body stack">
            <span className="label">Office</span>
            <h2 className="h2">Expense report</h2>
            <p className="muted small">Totals by category and site, with every entry, for the chosen period.</p>
            <div className="form-grid form-grid--2" style={{ gap: 10 }}>
              <label className="field"><span>From</span><input className="input" type="date" value={expFrom} onChange={(e) => setExpFrom(e.target.value)} /></label>
              <label className="field"><span>To</span><input className="input" type="date" value={expTo} onChange={(e) => setExpTo(e.target.value)} /></label>
            </div>
            <div className="row row--wrap">
              <button className="btn btn--primary" disabled={busy === 'exp'} onClick={() => pdf('exp', (p) => p.expenseReportPDF(getData(), expFrom, expTo, null), `expenses-${expFrom}-to-${expTo}.pdf`)}>
                <FileDown /> {busy === 'exp' ? 'Preparing…' : 'PDF'}
              </button>
            </div>
          </div>
        </section>
      </div>

      {share && <ShareText title={share.title} eyebrow={fmtDay(date)} initial={share.text} onClose={() => setShare(null)} />}
    </div>
  );
}
