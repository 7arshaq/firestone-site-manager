import { useState } from 'react';
import { FileDown, MessageSquareText } from 'lucide-react';
import { getData } from '../store/store';
import { allSitesNote, allocationNote } from '../lib/notes';
import { makePdf } from '../lib/pdfLazy';
import type * as Pdf from '../lib/pdf';
import { ShareText } from './ShareText';
import { DateStepper, Modal, toast } from './ui';
import { addDays, fmtDay, today } from '../lib/util';

/** Messages and PDFs that cover every site at once — opened from the map's site list. */
export default function AllSitesShare({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(today());
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState<string | null>(null);
  const [share, setShare] = useState<{ title: string; text: string } | null>(null);

  const pdf = async (key: string, make: (p: typeof Pdf) => Promise<Blob>, name: string) => {
    setBusy(key);
    try {
      const r = await makePdf(make, name);
      toast(r === 'shared' ? 'PDF shared' : 'PDF downloaded');
    } finally {
      setBusy(null);
    }
  };

  if (share) return <ShareText title={share.title} eyebrow={fmtDay(date)} initial={share.text} onClose={() => setShare(null)} />;

  return (
    <Modal title="Share — all sites" eyebrow="WhatsApp & PDF" onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <div className="stack stack--lg">
        <div className="row row--between row--wrap">
          <span className="muted small">For one site, open it and use its Report tab.</span>
          <DateStepper value={date} onChange={setDate} />
        </div>

        <div className="share-row">
          <div className="grow">
            <b>Sites summary</b>
            <small className="muted">Every current site's FA/FF progress, the day's change and manpower.</small>
          </div>
          <div className="row row--wrap">
            <button className="btn btn--sm btn--primary" onClick={() => setShare({ title: 'Sites summary', text: allSitesNote(getData(), date) })}>
              <MessageSquareText /> WhatsApp
            </button>
            <button className="btn btn--sm" disabled={busy === 'sum'} onClick={() => pdf('sum', (p) => p.summaryReportPDF(getData(), date, 7), `sites-summary-${date}.pdf`)}>
              <FileDown /> {busy === 'sum' ? 'Preparing…' : 'Weekly PDF'}
            </button>
          </div>
        </div>

        <div className="share-row">
          <div className="grow">
            <b>Who's where</b>
            <small className="muted">The crew on each site, and who's on leave. Set crews in each site's Team tab.</small>
          </div>
          <button className="btn btn--sm btn--primary" onClick={() => setShare({ title: 'Manpower allocation', text: allocationNote(getData(), date) })}>
            <MessageSquareText /> WhatsApp
          </button>
        </div>

        <div className="share-row share-row--top">
          <div className="grow stack" style={{ gap: 8 }}>
            <span>
              <b>Expense report</b>
              <small className="muted">Totals by category and site, with every entry.</small>
            </span>
            <div className="form-grid form-grid--2" style={{ gap: 10 }}>
              <label className="field"><span>From</span><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="field"><span>To</span><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            </div>
          </div>
          <button className="btn btn--sm" disabled={busy === 'exp'} onClick={() => pdf('exp', (p) => p.expenseReportPDF(getData(), from, to, null), `expenses-${from}-to-${to}.pdf`)}>
            <FileDown /> {busy === 'exp' ? 'Preparing…' : 'PDF'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
