import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, CheckCircle2, FileText, Info, KeyRound, ListChecks, Loader2, MapPin, RefreshCw, Sparkles, Square, Upload, X } from 'lucide-react';
import type { Emirate, Site, System } from '../types';
import { getApiKey, explainError } from '../lib/ai';
import { estimate, inspect, type PickedDrawing } from '../lib/drawing-files';
import { analyzeDrawings, checkLocation, FIELD_LABEL, parseField, type Analysis, type FieldKey, type Finding } from '../lib/drawing-analysis';
import { satellite } from '../lib/satellite';
import { findPlace, reverseGeocode } from '../lib/geocode';
import type { NewScopeItem } from '../store/store';
import { toast } from './ui';
import { fileSize, uid } from '../lib/util';

export type SiteDraft = Omit<Site, 'id' | 'createdAt'>;

/** Writes one parsed value into the form draft */
function applyValue(d: SiteDraft, key: FieldKey, v: NonNullable<ReturnType<typeof parseField>>): SiteDraft {
  switch (key) {
    case 'emirate':
      return { ...d, emirate: v as Emirate };
    case 'systems':
      return { ...d, systems: v as System[] };
    default:
      return { ...d, [key]: v };
  }
}

const shown = (v: ReturnType<typeof parseField>) => (v === null ? '' : Array.isArray(v) ? v.join(' + ') : String(v));

interface Props {
  draft: SiteDraft;
  setDraft: (fn: (d: SiteDraft) => SiteDraft) => void;
  picked: PickedDrawing[];
  setPicked: (fn: (p: PickedDrawing[]) => PickedDrawing[]) => void;
  /** null until the engineer has placed the pin */
  pin: { lat: number; lng: number } | null;
  onPin: (p: { lat: number; lng: number }) => void;
  onFilled: (keys: FieldKey[]) => void;
  /** adds the chosen items to the new site's scope list */
  onScope: (items: NewScopeItem[]) => void;
}

type Status = 'idle' | 'reading' | 'done' | 'error';

export default function DrawingAssistant({ draft, setDraft, picked, setPicked, pin, onPin, onFilled, onScope }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [stage, setStage] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Analysis | null>(null);
  const [cost, setCost] = useState(0);
  const [use, setUse] = useState<Record<number, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loc, setLoc] = useState<{ check: string; explanation: string; pinKey: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [readSig, setReadSig] = useState('');
  const [drag, setDrag] = useState(false);
  const [filledCount, setFilledCount] = useState(0);
  const [useScope, setUseScope] = useState<Record<number, boolean>>({});
  const [scopeAdded, setScopeAdded] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const hasKey = !!getApiKey();

  const usable = picked.filter((p) => !p.error && (p.kind === 'pdf' || p.kind === 'image'));
  const sig = usable.map((p) => p.id).join(',');
  const est = useMemo(() => estimate(picked), [picked]);
  const pinKey = pin ? `${pin.lat.toFixed(4)},${pin.lng.toFixed(4)}` : '';

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const pending = list.map((file) => ({ id: uid(), file, kind: 'other' as const, pages: 0, thumb: null, error: undefined }));
    setPicked((p) => [...p, ...pending.map((x) => ({ ...x, error: 'Opening…' }))]);
    for (const item of pending) {
      const info = await inspect(item.file, item.id);
      setPicked((p) => p.map((x) => (x.id === item.id ? info : x)));
    }
  };

  const read = async () => {
    if (!usable.length) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setStatus('reading');
    setError('');
    setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    try {
      setStage('Looking up the pin');
      const [address, sat] = pin ? await Promise.all([reverseGeocode(pin.lat, pin.lng), satellite(pin.lat, pin.lng)]) : [null, null];
      const alreadyEntered = Object.fromEntries(
        Object.entries({ name: draft.name, client: draft.client, contractor: draft.contractor, consultant: draft.consultant, area: draft.area }).filter(([, v]) => v),
      );
      const run = await analyzeDrawings(
        { drawings: usable, alreadyEntered, pin: pin ? { ...pin, address: address?.label ?? null } : null, satellite: sat?.dataUrl ?? null },
        (p) => setStage(p.stage),
        ctrl.signal,
      );
      setResult(run.result);
      setCost(run.cost);
      setUse(Object.fromEntries(run.result.fields.map((f, i) => [i, f.confidence !== 'low' && parseField(f.key, f.value) !== null])));
      setAnswers({});
      setFilledCount(0);
      setUseScope(Object.fromEntries(run.result.scope_items.map((_, i) => [i, true])));
      setScopeAdded(0);
      setLoc(pin && run.result.location.check !== 'no_location' ? { check: run.result.location.check, explanation: run.result.location.explanation, pinKey } : null);
      setReadSig(sig);
      setStatus('done');
    } catch (e) {
      if (ctrl.signal.aborted) {
        setStatus(result ? 'done' : 'idle');
      } else {
        setError(explainError(e));
        setStatus('error');
      }
    } finally {
      clearInterval(timer);
    }
  };

  // Reads in the background as soon as drawings are added (when a Claude key is set).
  useEffect(() => {
    if (!hasKey || status !== 'idle' || !usable.length || picked.some((p) => p.error === 'Opening…')) return;
    const t = setTimeout(read, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, status, hasKey, picked]);

  useEffect(() => () => abort.current?.abort(), []);

  const fill = () => {
    if (!result) return;
    const chosen = result.fields
      .map((f, i) => ({ key: f.key, v: use[i] ? parseField(f.key, f.value) : null }))
      .filter((x): x is { key: FieldKey; v: NonNullable<ReturnType<typeof parseField>> } => x.v !== null);
    setDraft((d) => chosen.reduce((next, { key, v }) => applyValue(next, key, v), d));
    const keys = chosen.map((c) => c.key);
    setFilledCount(keys.length);
    onFilled(keys);
    toast(`${keys.length} detail${keys.length === 1 ? '' : 's'} filled in from the drawings`);
  };

  const answer = (q: Analysis['questions'][number], opt: { label: string; value: string }) => {
    setAnswers((a) => ({ ...a, [q.id]: opt.label }));
    if (q.field === 'note') {
      setDraft((d) => ({ ...d, notes: [d.notes, `${q.question} — ${opt.label}`].filter(Boolean).join('\n') }));
      return;
    }
    const v = parseField(q.field, opt.value) ?? parseField(q.field, opt.label);
    if (v !== null) {
      setDraft((d) => applyValue(d, q.field as FieldKey, v));
      onFilled([q.field]);
    } else {
      setDraft((d) => ({ ...d, notes: [d.notes, `${q.question} — ${opt.label}`].filter(Boolean).join('\n') }));
    }
  };

  const addScope = () => {
    if (!result) return;
    const list = result.scope_items
      .filter((_, i) => useScope[i])
      .map((x) => ({ text: x.text, system: x.system === 'general' ? null : x.system, kind: 'scope' as const }));
    if (!list.length) return;
    onScope(list);
    setScopeAdded(list.length);
    toast(`${list.length} item${list.length === 1 ? '' : 's'} added to the scope list`);
  };

  const addNotes = () => {
    if (!result?.observations.length) return;
    setDraft((d) => ({ ...d, notes: [d.notes, ...result.observations.map((o) => `• ${o}`)].filter(Boolean).join('\n') }));
    toast('Added to the site notes');
  };

  const placeFromDrawings = async () => {
    if (!result) return;
    const { lat, lng, address_on_drawings } = result.location;
    if (lat !== null && lng !== null) {
      onPin({ lat, lng });
      toast('Pin placed at the coordinates on the drawings');
      return;
    }
    if (!address_on_drawings) return;
    const hit = await findPlace(address_on_drawings);
    if (hit) {
      onPin(hit);
      toast('Pin placed — check it on the satellite view');
    } else toast('That address could not be found. Place the pin on the map instead.');
  };

  const recheck = async () => {
    if (!result || !pin) return;
    setChecking(true);
    try {
      const [address, sat] = await Promise.all([reverseGeocode(pin.lat, pin.lng), satellite(pin.lat, pin.lng)]);
      const r = await checkLocation(
        { summary: result.summary, addressOnDrawings: result.location.address_on_drawings, pin: { ...pin, address: address?.label ?? null }, satellite: sat?.dataUrl ?? null },
        new AbortController().signal,
      );
      setLoc({ check: r.check, explanation: r.explanation, pinKey });
      setCost((c) => c + r.cost);
    } catch (e) {
      toast(explainError(e));
    } finally {
      setChecking(false);
    }
  };

  const remove = (id: string) => setPicked((p) => p.filter((x) => x.id !== id));
  const selected = result ? result.fields.filter((_, i) => use[i]).length : 0;
  const newFiles = status === 'done' && sig !== readSig && usable.length > 0;

  return (
    <section className="card assist">
      <div className="card__head">
        <div>
          <h2 className="h2">
            <Sparkles className="assist__icon" aria-hidden /> Start from the drawings
          </h2>
          <p className="muted small">Add the drawing PDFs or photos. They’re read in the background: the project details are filled in and the scope list is written for you to check.</p>
        </div>
      </div>

      <div className="card__body stack">
        <div
          className={`drop ${drag ? 'is-drag' : ''}`}
          onDragOver={(e) => (e.preventDefault(), setDrag(true))}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <Upload aria-hidden />
          <div>
            <b>Drop drawings here</b> or{' '}
            <button type="button" className="link-btn" onClick={() => input.current?.click()}>
              choose files
            </button>
            <small>PDF from AutoCAD, scans, or photos of drawings. AutoCAD DWG files need saving as PDF first.</small>
          </div>
          <input ref={input} type="file" multiple hidden accept=".pdf,application/pdf,image/*,.dwg,.dxf" onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
        </div>

        {picked.length > 0 && (
          <ul className="dfiles">
            {picked.map((d) => (
              <li key={d.id} className={d.error && d.error !== 'Opening…' ? 'is-bad' : ''}>
                {d.thumb ? <img src={d.thumb} alt="" /> : <span className="dfiles__ph"><FileText aria-hidden /></span>}
                <span className="grow">
                  <b className="truncate block">{d.file.name}</b>
                  <small className={d.error && d.error !== 'Opening…' ? 'text-flame' : 'muted'}>
                    {d.error ?? `${d.kind === 'pdf' ? `${d.pages} page${d.pages === 1 ? '' : 's'}` : 'Photo'} · ${fileSize(d.file.size)}`}
                  </small>
                </span>
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => remove(d.id)} aria-label={`Remove ${d.file.name}`}>
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
              To read drawings automatically, add your Claude key once in{' '}
              <Link to="/settings">Settings → Drawing reader</Link>. The drawings are still saved with the site.
            </p>
          </div>
        )}

        {hasKey && status === 'idle' && usable.length > 0 && (
          <p className="muted small">
            Starting… {est.pages} page{est.pages === 1 ? '' : 's'} · about ${est.dollars.toFixed(2)}
          </p>
        )}

        {status === 'reading' && (
          <div className="assist__run" role="status">
            <Loader2 className="spin" aria-hidden />
            <div className="grow">
              <b>{stage || 'Reading the drawings'}…</b>
              <small className="muted">
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} · {est.pages} pages · about ${est.dollars.toFixed(2)} · you can keep filling in the form
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

        {newFiles && (
          <button type="button" className="btn btn--sm" onClick={read} style={{ justifySelf: 'start' }}>
            <RefreshCw /> Read again with the new files
          </button>
        )}

        {result && status !== 'reading' && (
          <Results
            result={result}
            cost={cost}
            use={use}
            setUse={setUse}
            selected={selected}
            fill={fill}
            filledCount={filledCount}
            showAgain={() => setFilledCount(0)}
            answers={answers}
            answer={answer}
            addNotes={addNotes}
            useScope={useScope}
            setUseScope={setUseScope}
            addScope={addScope}
            scopeAdded={scopeAdded}
            pin={pin}
            loc={loc && loc.pinKey === pinKey ? loc : null}
            pinMoved={!!loc && loc.pinKey !== pinKey}
            checking={checking}
            recheck={recheck}
            placeFromDrawings={placeFromDrawings}
          />
        )}
      </div>
    </section>
  );
}

function Results(props: {
  result: Analysis;
  cost: number;
  use: Record<number, boolean>;
  setUse: (fn: (u: Record<number, boolean>) => Record<number, boolean>) => void;
  selected: number;
  fill: () => void;
  filledCount: number;
  showAgain: () => void;
  answers: Record<string, string>;
  answer: (q: Analysis['questions'][number], o: { label: string; value: string }) => void;
  addNotes: () => void;
  useScope: Record<number, boolean>;
  setUseScope: (fn: (u: Record<number, boolean>) => Record<number, boolean>) => void;
  addScope: () => void;
  scopeAdded: number;
  pin: { lat: number; lng: number } | null;
  loc: { check: string; explanation: string } | null;
  pinMoved: boolean;
  checking: boolean;
  recheck: () => void;
  placeFromDrawings: () => void;
}) {
  const { result, use } = props;
  const l = result.location;
  const canPlace = !props.pin && ((l.lat !== null && l.lng !== null) || !!l.address_on_drawings);

  return (
    <div className="assist__out stack stack--lg">
      <p className="assist__summary">{result.summary}</p>

      {/* location */}
      <div className={`locbox locbox--${props.loc?.check ?? 'none'}`}>
        <MapPin aria-hidden />
        <div className="grow stack" style={{ gap: 4 }}>
          <b>
            {props.loc?.check === 'match'
              ? 'The pin matches the drawings'
              : props.loc?.check === 'mismatch'
                ? 'The pin may be in the wrong place'
                : props.loc
                  ? 'Location could not be confirmed'
                  : 'Location'}
          </b>
          <small>
            {props.loc?.explanation ??
              (l.address_on_drawings ? `The drawings say: ${l.address_on_drawings}.` : 'No address was found on the drawings.')}
            {props.pinMoved && ' The pin has moved since this check.'}
          </small>
          <div className="row row--wrap" style={{ gap: 6 }}>
            {canPlace && (
              <button type="button" className="btn btn--sm" onClick={props.placeFromDrawings}>
                <MapPin /> Put the pin where the drawings say
              </button>
            )}
            {props.pin && (!props.loc || props.pinMoved) && (
              <button type="button" className="btn btn--sm" onClick={props.recheck} disabled={props.checking}>
                {props.checking ? <Loader2 className="spin" /> : <RefreshCw />} Check the pin against the drawings
              </button>
            )}
          </div>
        </div>
      </div>

      {/* findings */}
      {result.fields.length > 0 && props.filledCount > 0 && (
        <div className="filled">
          <CheckCircle2 aria-hidden />
          <span className="grow">
            {props.filledCount} detail{props.filledCount === 1 ? '' : 's'} filled in below — check them before saving.
          </span>
          <button type="button" className="btn btn--sm btn--ghost" onClick={props.showAgain}>
            Show again
          </button>
        </div>
      )}

      {result.fields.length > 0 && !props.filledCount && (
        <div className="stack">
          <div className="row row--between row--wrap">
            <h3 className="h3">Found in the drawings</h3>
            <span className="muted small">Untick anything that looks wrong</span>
          </div>
          <div className="table-wrap">
            <table className="table finds">
              <tbody>
                {result.fields.map((f: Finding, i) => {
                  const v = parseField(f.key, f.value);
                  return (
                    <tr key={i} className={v === null ? 'is-off' : ''}>
                      <td style={{ width: 36 }}>
                        <input
                          type="checkbox"
                          checked={!!use[i]}
                          disabled={v === null}
                          onChange={(e) => props.setUse((u) => ({ ...u, [i]: e.target.checked }))}
                          aria-label={`Use ${FIELD_LABEL[f.key]}`}
                        />
                      </td>
                      <td className="nowrap">{FIELD_LABEL[f.key]}</td>
                      <td>
                        <b>{v === null ? f.value : shown(v)}</b>
                        <small className="block muted">{f.source}</small>
                      </td>
                      <td className="nowrap">
                        <span className={`conf conf--${f.confidence}`}>{f.confidence === 'high' ? 'Sure' : f.confidence === 'medium' ? 'Likely' : 'Check'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn--primary" onClick={props.fill} disabled={!props.selected} style={{ justifySelf: 'start' }}>
            <Check /> Fill in the form with {props.selected} detail{props.selected === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {/* scope list */}
      {result.scope_items.length > 0 &&
        (props.scopeAdded ? (
          <div className="filled">
            <ListChecks aria-hidden />
            <span className="grow">
              {props.scopeAdded} item{props.scopeAdded === 1 ? '' : 's'} added to the scope list — see them under “Scope of work”.
            </span>
          </div>
        ) : (
          <div className="stack">
            <div className="row row--between row--wrap">
              <h3 className="h3">Scope list from the drawings</h3>
              <span className="muted small">Untick anything you don't want</span>
            </div>
            <ul className="scope-picks">
              {result.scope_items.map((x, i) => (
                <li key={i}>
                  <label>
                    <input type="checkbox" checked={!!props.useScope[i]} onChange={(e) => props.setUseScope((u) => ({ ...u, [i]: e.target.checked }))} />
                    <span className="grow">
                      {x.system !== 'general' && <span className={`sys sys--${x.system}`}>{x.system}</span>} {x.text}
                      <small className="block muted">{x.source}</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn--primary"
              onClick={props.addScope}
              disabled={!Object.values(props.useScope).some(Boolean)}
              style={{ justifySelf: 'start' }}
            >
              <ListChecks /> Add {Object.values(props.useScope).filter(Boolean).length} items to the scope list
            </button>
          </div>
        ))}

      {/* questions */}
      {result.questions.length > 0 && (
        <div className="stack">
          <h3 className="h3">A few questions</h3>
          <ol className="qs">
            {result.questions.map((q) => (
              <li key={q.id}>
                <b>{q.question}</b>
                {q.why && <small className="muted block">{q.why}</small>}
                <div className="qs__opts">
                  {q.options.map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      className={`chip ${props.answers[q.id] === o.label ? 'is-on' : ''}`}
                      aria-pressed={props.answers[q.id] === o.label}
                      onClick={() => props.answer(q, o)}
                    >
                      {props.answers[q.id] === o.label && <CheckCircle2 aria-hidden />}
                      {o.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* notes */}
      {result.observations.length > 0 && (
        <div className="stack">
          <div className="row row--between row--wrap">
            <h3 className="h3">Worth knowing</h3>
            <button type="button" className="btn btn--sm btn--ghost" onClick={props.addNotes}>
              Add to site notes
            </button>
          </div>
          <ul className="obs">
            {result.observations.map((o) => (
              <li key={o}>
                <Info aria-hidden /> {o}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.drawings.length > 0 && (
        <details className="sheets">
          <summary>Sheets found ({result.drawings.length})</summary>
          <ul>
            {result.drawings.map((d, i) => (
              <li key={i}>
                <span className="mono">{d.sheet || '—'}</span>
                <span className="grow">{d.title}</span>
                <span className="muted small">{d.discipline}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="muted small">Reading cost about ${props.cost.toFixed(2)}, charged to your Anthropic account. Check the list against the approved drawings and BOQ.</p>
    </div>
  );
}
