import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, FileDown, Info, MessageSquareText, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useSiteCtx } from './SiteLayout';
import { useStore, getData } from '../../store/store';
import { materialRows, type MaterialRow } from '../../lib/progress';
import { materialRequestNote } from '../../lib/notes';
import { makePdf } from '../../lib/pdfLazy';
import { Modal, NumField, Seg, SysTag, toast } from '../../components/ui';
import { ShareText } from '../../components/ShareText';
import type { MaterialMove, System } from '../../types';
import { fmtDate, num, today } from '../../lib/util';

type Filter = 'all' | 'attention' | 'pending' | 'FA' | 'FF';
const STATE_LABEL = { ok: 'OK', low: 'Running low', short: 'None on site', none: 'Not delivered' } as const;

export default function SiteMaterials() {
  const { site } = useSiteCtx();
  const d = useStore(useShallow((s) => ({ overrides: s.overrides, customMaterials: s.customMaterials, txns: s.txns })));
  const setOverride = useStore((s) => s.setOverride);
  const deleteTxn = useStore((s) => s.deleteTxn);
  const deleteCustom = useStore((s) => s.deleteCustomMaterial);
  const { rows, advisories } = useMemo(() => materialRows(site, d), [site, d]);
  const [filter, setFilter] = useState<Filter>('all');
  const [move, setMove] = useState<{ type: MaterialMove; key?: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [request, setRequest] = useState(false);

  const attention = rows.filter((r) => r.state === 'short' || r.state === 'low');
  const pending = rows.filter((r) => r.state === 'none');
  const shown = rows.filter((r) =>
    filter === 'attention' ? attention.includes(r) : filter === 'pending' ? r.state === 'none' : filter === 'FA' || filter === 'FF' ? r.system === filter : true,
  );
  const groups = [...new Set(shown.map((r) => r.group))];
  const history = d.txns.filter((t) => t.siteId === site.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  const names = new Map(rows.map((r) => [r.key, r]));

  return (
    <div className="stack stack--lg">
      {advisories.length > 0 && (
        <section className="conditions">
          <span className="label">Checked against site conditions</span>
          {advisories.map((a) => (
            <p key={a} className="advisory">
              <Info aria-hidden /> {a}
            </p>
          ))}
        </section>
      )}

      <div className="daily__bar">
        <Seg
          label="Filter materials"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: rows.length },
            { value: 'attention', label: 'Needs attention', count: attention.length },
            { value: 'pending', label: 'Not delivered', count: pending.length },
            ...(site.systems.length > 1 ? site.systems.map((s) => ({ value: s as Filter, label: s })) : []),
          ]}
        />
        <div className="page-head__actions">
          <button className="btn btn--sm" onClick={() => setMove({ type: 'in' })}>
            <ArrowDownToLine /> Record delivery
          </button>
          <button className="btn btn--sm" onClick={() => setMove({ type: 'out' })}>
            <ArrowUpFromLine /> Record usage
          </button>
          <button className="btn btn--sm" onClick={() => setRequest(true)}>
            <MessageSquareText /> Material request
          </button>
          <button
            className="btn btn--sm btn--ghost"
            onClick={async () => {
              const r = await makePdf((p) => p.materialReportPDF(site, getData(), today()), `${site.code}-materials-${today()}.pdf`);
              toast(r === 'shared' ? 'PDF shared' : 'PDF downloaded');
            }}
          >
            <FileDown /> PDF
          </button>
        </div>
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="table mat-table">
            <thead>
              <tr>
                <th>Material</th>
                <th className="r" title="Estimated from scope and site conditions — click to adjust">Required</th>
                <th className="r">Delivered</th>
                <th className="r">Used</th>
                <th className="r">On site</th>
                <th className="r">To deliver</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => [
                <tr key={g} className="group-row">
                  <td colSpan={8}>
                    <span className="row">
                      <SysTag s={g.slice(0, 2) as System} />
                      <b>{g.slice(5)}</b>
                    </span>
                  </td>
                </tr>,
                ...shown
                  .filter((r) => r.group === g)
                  .map((r) => (
                    <MatRow
                      key={r.key}
                      r={r}
                      onOverride={(n) => setOverride(site.id, r.key, n)}
                      onMove={(type) => setMove({ type, key: r.key })}
                      onDelete={r.custom ? () => deleteCustom(r.key) : undefined}
                    />
                  )),
              ])}
            </tbody>
          </table>
        </div>
        <div className="card__body row row--between row--wrap" style={{ borderTop: '1px solid var(--rule)' }}>
          <p className="muted small" style={{ maxWidth: 640 }}>
            Required quantities are estimates from the scope and site conditions. Change any figure to match your approved BOQ; the reason
            for each estimate shows under the name.
          </p>
          <button className="btn btn--sm" onClick={() => setAdding(true)}>
            <Plus /> Add material
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <h2 className="h2">Recent movements</h2>
        </div>
        {history.length ? (
          <ul className="moves">
            {history.map((t) => (
              <li key={t.id}>
                <span className={`move-tag move-tag--${t.type}`}>{t.type === 'in' ? 'In' : t.type === 'out' ? 'Used' : 'Return'}</span>
                <span className="grow">
                  <b>{names.get(t.key)?.name ?? 'Removed material'}</b>
                  <small className="muted">
                    {fmtDate(t.date)}
                    {t.ref ? ` · ${t.ref}` : ''}
                    {t.note ? ` · ${t.note}` : ''}
                  </small>
                </span>
                <span className="mono">
                  {t.type === 'in' ? '+' : '−'}
                  {num(t.qty)} {names.get(t.key)?.unit}
                </span>
                <button className="icon-btn icon-btn--sm" aria-label="Delete movement" onClick={() => (deleteTxn(t.id), toast('Movement deleted'))}>
                  <Trash2 />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card__body muted">No deliveries or usage recorded yet.</p>
        )}
      </section>

      {move && <MoveModal siteId={site.id} rows={rows} type={move.type} initialKey={move.key} onClose={() => setMove(null)} />}
      {adding && <AddMaterial siteId={site.id} systems={site.systems} onClose={() => setAdding(false)} />}
      {request && (
        <ShareText
          title="Material request"
          eyebrow={site.code}
          initial={materialRequestNote(site, getData())}
          filename={`${site.code}-material-request.txt`}
          onClose={() => setRequest(false)}
        />
      )}
    </div>
  );
}

function MatRow({ r, onOverride, onMove, onDelete }: { r: MaterialRow; onOverride: (n: number | null) => void; onMove: (t: MaterialMove) => void; onDelete?: () => void }) {
  return (
    <tr className={`mat-row mat-row--${r.state}`}>
      <td>
        <div className="mat-name">
          {r.bulb && <span className="bulb" style={{ ['--bulb' as string]: r.bulb }} title="Bulb colour = temperature rating" />}
          <span>
            <b>{r.name}</b>
            <small>{r.basis}</small>
          </span>
        </div>
      </td>
      <td className="r nowrap">
        <span className="req">
          <NumField className="input input--sm input--num w-90" value={r.estimate} onChange={(n) => onOverride(n)} aria-label={`Required quantity of ${r.name}`} />
          {r.overridden && (
            <button className="icon-btn icon-btn--sm" title="Back to the estimate" aria-label="Reset to estimate" onClick={() => onOverride(null)}>
              <RotateCcw />
            </button>
          )}
        </span>
        <small className="muted unit">{r.unit}</small>
      </td>
      <td className="r">{num(r.delivered)}</td>
      <td className="r">{num(r.used)}</td>
      <td className="r">
        <b>{num(r.onSite)}</b>
      </td>
      <td className="r">{r.toDeliver ? num(r.toDeliver) : '—'}</td>
      <td>
        <span className={`stock stock--${r.state}`}>
          <span className={`dot dot--${r.state}`} aria-hidden />
          {STATE_LABEL[r.state]}
        </span>
      </td>
      <td className="nowrap">
        <button className="icon-btn icon-btn--sm" title="Record delivery" aria-label={`Record delivery of ${r.name}`} onClick={() => onMove('in')}>
          <ArrowDownToLine />
        </button>
        <button className="icon-btn icon-btn--sm" title="Record usage" aria-label={`Record usage of ${r.name}`} onClick={() => onMove('out')}>
          <ArrowUpFromLine />
        </button>
        {onDelete && (
          <button className="icon-btn icon-btn--sm" title="Remove material" aria-label={`Remove ${r.name}`} onClick={onDelete}>
            <Trash2 />
          </button>
        )}
      </td>
    </tr>
  );
}

function MoveModal({ siteId, rows, type: initialType, initialKey, onClose }: { siteId: string; rows: MaterialRow[]; type: MaterialMove; initialKey?: string; onClose: () => void }) {
  const addTxn = useStore((s) => s.addTxn);
  const [type, setType] = useState<MaterialMove>(initialType);
  const [key, setKey] = useState(initialKey ?? rows[0]?.key ?? '');
  const [qty, setQty] = useState(0);
  const [date, setDate] = useState(today());
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const r = rows.find((x) => x.key === key);
  const verb = type === 'in' ? 'Record delivery' : type === 'out' ? 'Record usage' : 'Record return';
  const save = () => {
    if (!key || qty <= 0) return toast('Enter a quantity above zero');
    addTxn({ siteId, date, key, type, qty, ref, note });
    toast(type === 'in' ? 'Delivery recorded' : type === 'out' ? 'Usage recorded' : 'Return recorded');
    onClose();
  };
  return (
    <Modal
      title={verb}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save}>{verb}</button>
        </>
      }
    >
      <div className="stack">
        <Seg
          label="Movement type"
          value={type}
          onChange={setType}
          options={[
            { value: 'in', label: <><ArrowDownToLine size={14} /> Delivered to site</> },
            { value: 'out', label: <><ArrowUpFromLine size={14} /> Used / issued</> },
            { value: 'return', label: <><Undo2 size={14} /> Returned to store</> },
          ]}
        />
        <label className="field">
          <span>Material</span>
          <select className="select" value={key} onChange={(e) => setKey(e.target.value)}>
            {[...new Set(rows.map((x) => x.group))].map((g) => (
              <optgroup key={g} label={g}>
                {rows.filter((x) => x.group === g).map((x) => (
                  <option key={x.key} value={x.key}>{x.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {r && (
            <small>
              On site now: {num(r.onSite)} {r.unit} · still to deliver: {num(r.toDeliver)} {r.unit}
            </small>
          )}
        </label>
        <div className="form-grid form-grid--2">
          <label className="field">
            <span>Quantity{r ? ` (${r.unit})` : ''}</span>
            <NumField value={qty} onChange={setQty} />
          </label>
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>{type === 'in' ? 'Delivery note no.' : 'Reference'}</span>
            <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={type === 'in' ? 'DN-4471' : 'Optional'} />
          </label>
          <label className="field">
            <span>Note</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </label>
        </div>
      </div>
    </Modal>
  );
}

function AddMaterial({ siteId, systems, onClose }: { siteId: string; systems: System[]; onClose: () => void }) {
  const add = useStore((s) => s.addCustomMaterial);
  const [f, setF] = useState({ system: systems[0], name: '', unit: 'nos', qty: 0 });
  const save = () => {
    if (!f.name.trim()) return toast('Name the material first');
    add({ ...f, siteId });
    toast('Material added');
    onClose();
  };
  return (
    <Modal
      title="Add a material"
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save}>Add material</button>
        </>
      }
    >
      <div className="form-grid form-grid--2">
        <label className="field span-all">
          <span>Material</span>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Fire-rated sealant 310 ml" />
        </label>
        <label className="field">
          <span>System</span>
          <select className="select" value={f.system} onChange={(e) => setF({ ...f, system: e.target.value as System })}>
            {systems.map((s) => <option key={s} value={s}>{s === 'FA' ? 'Fire alarm' : 'Fire fighting'}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Unit</span>
          <input className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
        </label>
        <label className="field span-all">
          <span>Required quantity</span>
          <NumField value={f.qty} onChange={(n) => setF({ ...f, qty: n })} />
        </label>
      </div>
    </Modal>
  );
}
