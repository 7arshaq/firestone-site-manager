import { useEffect, useState } from 'react';
import { Copy, FileDown, MessageCircle, RefreshCw } from 'lucide-react';
import { useSiteCtx } from './SiteLayout';
import { getData, useStore } from '../../store/store';
import { openWhatsApp, siteDailyNote } from '../../lib/notes';
import { makePdf } from '../../lib/pdfLazy';
import { brandUrl } from '../../components/Brand';
import { copyText, WaEditor } from '../../components/ShareText';
import { DateStepper, toast } from '../../components/ui';
import { today } from '../../lib/util';

export default function Report() {
  const { site } = useSiteCtx();
  const [date, setDate] = useState(today());
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const photoCount = useStore((s) => s.photos.filter((p) => p.siteId === site.id && p.date === date).length);
  const company = useStore((s) => s.settings.companyName);
  const tasksCount = useStore((s) => s.tasks.filter((t) => t.siteId === site.id && t.date === date).length);

  const regenerate = () => setText(siteDailyNote(site, getData(), date));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(regenerate, [date, site.id]);

  const makePDF = async () => {
    setBusy(true);
    try {
      const r = await makePdf((p) => p.dailyReportPDF(site, getData(), date, photos), `${site.code}-daily-report-${date}.pdf`);
      toast(r === 'shared' ? 'Report shared' : 'Report downloaded');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack stack--lg">
      <div className="daily__bar">
        <DateStepper value={date} onChange={setDate} />
        <span className="muted small">{tasksCount} tasks · {photoCount} photos on this day</span>
      </div>

      <div className="report-grid">
        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="h2">WhatsApp note</h2>
              <p className="muted small">Formatted with *bold* headings, ready to paste into a group.</p>
            </div>
            <button className="btn btn--sm btn--ghost" onClick={regenerate} title="Rebuild from the latest data">
              <RefreshCw /> Rebuild
            </button>
          </div>
          <div className="card__body stack">
            <WaEditor value={text} onChange={setText} />
            <div className="row row--wrap">
              <button className="btn" onClick={() => copyText(text)}>
                <Copy /> Copy
              </button>
              <button className="btn btn--primary" onClick={() => openWhatsApp(text)}>
                <MessageCircle /> Open in WhatsApp
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="h2">PDF report</h2>
              <p className="muted small">A4 daily progress report for the client, consultant or office.</p>
            </div>
          </div>
          <div className="card__body stack">
            <div className="pdf-preview" aria-hidden>
              <div className="pdf-preview__page">
                <div className="pdf-preview__head">
                  <span className="pdf-preview__co">
                    <img src={brandUrl('mark.png')} alt="" />
                    <b>{company}</b>
                  </span>
                  <span>DAILY PROGRESS REPORT</span>
                </div>
                <div className="pdf-preview__rule" />
                <div className="pdf-preview__tb">
                  {['Project', 'Code', 'Location', 'Status', 'Client', 'Contractor', 'Consultant', 'Date'].map((x) => (
                    <i key={x}>{x}</i>
                  ))}
                </div>
                <div className="pdf-preview__bars">
                  <i style={{ width: '64%', background: 'var(--fa)' }} />
                  <i style={{ width: '48%', background: 'var(--ff)' }} />
                </div>
                <div className="pdf-preview__lines">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <i key={i} style={{ width: `${60 + ((i * 37) % 40)}%` }} />
                  ))}
                </div>
                {photos && photoCount > 0 && (
                  <div className="pdf-preview__photos">
                    <i />
                    <i />
                  </div>
                )}
              </div>
            </div>
            <ul className="pdf-contents">
              <li>Title block — project, client, contractor, consultant</li>
              <li>FA / FF / overall progress with today's change</li>
              <li>Manpower list, work carried out, hold-ups</li>
              <li>Scope list — what's done and what's pending — material movements and needs</li>
            </ul>
            <label className="check">
              <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} />
              Include this day's photos ({photoCount})
            </label>
            <button className="btn btn--primary btn--lg" onClick={makePDF} disabled={busy}>
              <FileDown /> {busy ? 'Preparing…' : 'Download PDF'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
