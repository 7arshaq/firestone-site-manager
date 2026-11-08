import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, FileText, Highlighter, Info, KeyRound, Loader2, RefreshCw, Square, Upload, X } from 'lucide-react';
import type { DrawingMeta, ProgressAdjustment, Site } from '../types';
import type { ItemProgress } from '../lib/progress';
import { explainError, getApiKey, PRICE } from '../lib/ai';
import { inspect, type PickedDrawing } from '../lib/drawing-files';
import { MAX_MARKUP_PAGES, readMarkups, stagePercents, type MarkupReading } from '../lib/markup-analysis';
import { useStore } from '../store/store';
import { saveDrawingBlob } from '../store/drawings';
import { toast } from './ui';
import { fileSize, fmtDate, today, uid } from '../lib/util';

const NOTE = 'Highlighted drawings';

/** Reads marked-up drawings and updates stage progress after the engineer confirms */
export default function MarkupReader({ site, items }: { site: Site; items: ItemProgress[] }) {
  const addAdjustments = useStore((s) => s.addAdjustments);
  const addDrawings = useStore((s) => s.addDrawings);
  const lastUpdate = useStore((s) => s.adjustments.filter((a) => a.siteId === site.id && a.note.startsWith(NOTE)).map((a) => a.date).sort().at(-1));
  const [files, setFiles] = useState<PickedDrawing[]>([]);
  const [status, setStatus] = useState<'idle' | 'reading' | 'done' | 'error'>('idle');
  const [stage, setStage] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<MarkupReading | null>(null);
  const [cost, setCost] = useState(0);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const hasKey = !!getApiKey();
  const stages = items.map((i) => i.item);

  const usable = files.filter((f) => !f.error && (f.kind === 'pdf' || f.kind === 'image'));
  const sig = usable.map((f) => f.id).join(',');
  const pages = usable.reduce((a, f) => a + Math.min(f.pages || 1, MAX_MARKUP_PAGES), 0);
  const estimate = (pages * 2100 * PRICE.input + 8000 * PRICE.output) / 1e6 + 0.02;

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    const pending = Array.from(list).map((file) => ({ id: uid(), file, kind: 'other' as const, pages: 0, thumb: null, error: 'Opening…' }));
    setFiles((f) => [...f, ...pending]);
    for (const p of pending) {
      const info = await inspect(p.file, p.id);
      setFiles((f) => f.map((x) => (x.id === p.id ? info : x)));
    }
  };

  const read = async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setStatus('reading');
    setError('');
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    try {
      const run = await readMarkups({ files: usable, stages }, setStage, ctrl.signal);
      setReading(run.reading);
      setCost(run.cost);
      setMapping(Object.fromEntries(run.reading.colours.map((c) => [c.colour.toLowerCase(), c.stage_id])));
      setEdits({});
      setSkip({});
      setStatus('done');
    } catch (e) {
      if (ctrl.signal.aborted) setStatus(reading ? 'done' : 'idle');
      else {
        setError(explainError(e));
        setStatus('error');
      }
    } finally {
      clearInterval(timer);
    }
  };

  // read in the background once files are added (needs a Claude key)
  useEffect(() => {
    if (!hasKey || !stages.length || status !== 'idle' || !usable.length || files.some((f) => f.error === 'Opening…')) return;
    const t = setTimeout(read, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, status, hasKey, files]);

  useEffect(() => () => abort.current?.abort(), []);

  const percents = useMemo(() => (reading ? stagePercents(reading, mapping, stages) : new Map()), [reading, mapping, stages]);
  const rows = items
    .filter((p) => percents.has(p.item.id))
    .map((p) => {
      const read = percents.get(p.item.id)!;
      const pct = edits[p.item.id] ?? Math.round(read.pct);
      return { p, sheets: read.sheets, pct, now: Math.round(p.frac * 100) };
    });
  const chosen = rows.filter((r) => !skip[r.p.item.id] && r.pct !== r.now);

  const apply = async () => {
    const date = today();
    const names = usable.map((f) => f.file.name);
    const list: ProgressAdjustment[] = chosen
      .map((r) => {
        // whole units for large stages; small ones (zones, loops, lots) keep fractions so 11% of 2 zones still counts
        const raw = (r.p.item.qty * r.pct) / 100;
        const target = r.p.item.qty >= 100 ? Math.round(raw) : Math.round(raw * 100) / 100;
        return { id: uid(), siteId: site.id, date, workItemId: r.p.item.id, qty: Math.round((target - r.p.done) * 100) / 100, note: `${NOTE}: ${names.join(', ')}` };
      })
      .filter((a) => a.qty !== 0);
    addAdjustments(list);
    // keep the marked-up sheets with the site as a record
    const metas: DrawingMeta[] = [];
    for (const f of usable) {
      const meta: DrawingMeta = { id: uid(), siteId: site.id, name: f.file.name, kind: f.kind as 'pdf' | 'image', size: f.file.size, pages: f.pages, addedAt: new Date().toISOString(), tag: 'markup' };
      await saveDrawingBlob(meta.id, f.file);
      metas.push(meta);
    }
    addDrawings(metas);
    toast(`Progress updated for ${list.length} stage${list.length === 1 ? '' : 's'}`);
    setFiles([]);
    setReading(null);
    setStatus('idle');
  };

  const colourName = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

  return (
    <section className="card assist">
      <div className="card__head">
        <div>
          <h2 className="h2">
            <Highlighter className="assist__icon" aria-hidden /> Update from highlighted drawings
          </h2>
          <p className="muted small">
            Add the marked-up drawings — highlighted in a PDF app or on paper and scanned. Each colour is matched to a stage and the progress worked out for you to
            check.
            {lastUpdate && <> Last updated from drawings on {fmtDate(lastUpdate)}.</>}
          </p>
        </div>
      </div>

      <div className="card__body stack">
        {!stages.length ? (
          <p className="muted small">Enter the scope from the drawings first, so there are stages to update.</p>
        ) : (
          <div
            className={`drop ${drag ? 'is-drag' : ''}`}
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              add(e.dataTransfer.files);
            }}
          >
            <Upload aria-hidden />
            <div>
              <b>Drop highlighted drawings here</b> or{' '}
              <button type="button" className="link-btn" onClick={() => input.current?.click()}>
                choose files
              </button>
              <small>PDFs, scans or photos. One sheet per floor or zone works best.</small>
            </div>
            <input ref={input} type="file" multiple hidden accept=".pdf,application/pdf,image/*" onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
          </div>
        )}

        {files.length > 0 && (
          <ul className="dfiles">
            {files.map((d) => (
              <li key={d.id} className={d.error && d.error !== 'Opening…' ? 'is-bad' : ''}>
                {d.thumb ? <img src={d.thumb} alt="" /> : <span className="dfiles__ph"><FileText aria-hidden /></span>}
                <span className="grow">
                  <b className="truncate block">{d.file.name}</b>
                  <small className={d.error && d.error !== 'Opening…' ? 'text-flame' : 'muted'}>
                    {d.error ?? `${d.kind === 'pdf' ? `${d.pages} page${d.pages === 1 ? '' : 's'}` : 'Photo'} · ${fileSize(d.file.size)}`}
                  </small>
                </span>
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => setFiles((f) => f.filter((x) => x.id !== d.id))} aria-label={`Remove ${d.file.name}`}>
                  <X />
                </button>
              </li>
            ))}
          </ul>
        )}

        {!hasKey && usable.length > 0 && (
          <div className="assist__note">
            <KeyRound aria-hidden />
            <p>
              To read highlights, add your Claude key once in <Link to="/settings">Settings → Drawing reader</Link>.
            </p>
          </div>
        )}

        {hasKey && status === 'idle' && usable.length > 0 && (
          <p className="muted small">
            Starting… {pages} sheet{pages === 1 ? '' : 's'} · about ${estimate.toFixed(2)}
          </p>
        )}

        {status === 'reading' && (
          <div className="assist__run" role="status">
            <Loader2 className="spin" aria-hidden />
            <div className="grow">
              <b>{stage || 'Reading the highlights'}…</b>
              <small className="muted">
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} · {pages} sheets · about ${estimate.toFixed(2)}
              </small>
            </div>
            <button type="button" className="btn btn--sm" onClick={() => abort.current?.abort()}>
              <Square /> Stop
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="assist__error" role="alert">
            <AlertTriangle aria-hidden />
            <p className="grow">{error}</p>
            <button type="button" className="btn btn--sm" onClick={read}>
              <RefreshCw /> Try again
            </button>
          </div>
        )}

        {reading && status === 'done' && (
          <div className="assist__out stack stack--lg">
            <p className="assist__summary">{reading.summary}</p>

            <div className="stack">
              <h3 className="h3">What each colour means</h3>
              <p className="muted small">Colours differ from site to site — check each one. Choose “Ignore” for colours that don’t mark finished work.</p>
              <ul className="colours">
                {reading.colours.map((c) => {
                  const key = c.colour.toLowerCase();
                  return (
                    <li key={key}>
                      <span className="swatch" style={{ background: c.swatch }} aria-hidden />
                      <span className="grow">
                        <b>{colourName(c.colour)}</b>
                        <small className="muted block">{c.meaning}</small>
                      </span>
                      <select
                        className="select colours__pick"
                        value={mapping[key] ?? ''}
                        onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || null }))}
                        aria-label={`Stage for ${c.colour}`}
                      >
                        <option value="">Ignore</option>
                        {(['FA', 'FF'] as const).map((sys) =>
                          stages.some((s) => s.system === sys) ? (
                            <optgroup key={sys} label={sys === 'FA' ? 'Fire alarm' : 'Fire fighting'}>
                              {stages.filter((s) => s.system === sys).map((s) => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </optgroup>
                          ) : null,
                        )}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="stack">
              <h3 className="h3">Sheets read</h3>
              <div className="table-wrap">
                <table className="table markup-sheets">
                  <tbody>
                    {reading.pages.map((p, i) => (
                      <tr key={i}>
                        <td>
                          <b>{p.floor || `Page ${p.page}`}</b>
                          <small className="block muted">{p.file}{p.system !== 'unknown' ? ` · ${p.system === 'both' ? 'FA + FF' : p.system}` : ''}</small>
                        </td>
                        <td>
                          <div className="cov">
                            {reading.colours.map((c) => {
                              const v = p.coverage.find((x) => x.colour.toLowerCase() === c.colour.toLowerCase());
                              return (
                                <span key={c.colour} className="cov__chip" title={v?.basis}>
                                  <span className="swatch swatch--sm" style={{ background: c.swatch }} aria-hidden />
                                  <span className="mono">{Math.round(v?.percent ?? 0)}%</span>
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {rows.length > 0 ? (
              <div className="stack">
                <h3 className="h3">Progress update</h3>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th aria-label="Apply" />
                        <th>Stage</th>
                        <th className="r">Now</th>
                        <th className="r">From drawings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ p, pct, now, sheets }) => (
                        <tr key={p.item.id}>
                          <td style={{ width: 36 }}>
                            <input
                              type="checkbox"
                              className="markup-check"
                              checked={!skip[p.item.id]}
                              onChange={(e) => setSkip((s) => ({ ...s, [p.item.id]: !e.target.checked }))}
                              aria-label={`Update ${p.item.label}`}
                            />
                          </td>
                          <td>
                            <span className={`sys sys--${p.item.system}`}>{p.item.system}</span> {p.item.label}
                            <small className="block muted">Average of {sheets} sheet{sheets === 1 ? '' : 's'}</small>
                          </td>
                          <td className="r">{now}%</td>
                          <td className="r">
                            <span className="req">
                              <input
                                className="input input--sm input--num w-64"
                                type="number"
                                min={0}
                                max={100}
                                value={pct}
                                onChange={(e) => setEdits((m) => ({ ...m, [p.item.id]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
                                aria-label={`New % for ${p.item.label}`}
                              />
                              %
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="btn btn--primary" onClick={apply} disabled={!chosen.length} style={{ justifySelf: 'start' }}>
                  <Check /> Update progress for {chosen.length} stage{chosen.length === 1 ? '' : 's'}
                </button>
                <p className="muted small">Recorded as today’s progress, so the trend shows when it happened. The highlighted drawings are kept with the site.</p>
              </div>
            ) : (
              <p className="muted small">Choose a stage for at least one colour to see the progress update.</p>
            )}

            {reading.observations.length > 0 && (
              <ul className="obs">
                {reading.observations.map((o) => (
                  <li key={o}>
                    <Info aria-hidden /> {o}
                  </li>
                ))}
              </ul>
            )}

            <p className="muted small">Reading cost about ${cost.toFixed(2)}, charged to your Anthropic account. Highlights are estimates — check before updating.</p>
          </div>
        )}
      </div>
    </section>
  );
}
