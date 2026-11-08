import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, FileDown, Info, PackageCheck, PackageSearch, Plus, RotateCcw, Send, Trash2, TriangleAlert, Undo2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useSiteCtx } from './SiteLayout';
import { useStore, getData } from '../../store/store';
import { materialRows, type MaterialRow } from '../../lib/progress';
import { materialRequestNote } from '../../lib/notes';
import { makePdf } from '../../lib/pdfLazy';
import { Modal, NumField, Seg, SysTag, toast } from '../../components/ui';
import { ShareText } from '../../components/ShareText';
import type { MaterialMove, Site, System } from '../../types';
import { fmtDate, num, today } from '../../lib/util';

type Filter = 'all' | 'requested' | 'onsite' | 'attention';

function statusLabel(r: MaterialRow) {
  if (r.state === 'short') return 'None on site';
  if (r.state === 'low') return 'Running low';
  if (r.state === 'none') return r.requested > 0 ? 'Requested' : 'Not delivered';
  return r.toDeliver > 0 ? 'In stock' : 'All delivered';
}

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
  const [request, setRequest] = useState<{ key?: string } | null>(null);
  const [share, setShare] = useState<string | null>(null);

  const needed = rows.filter((r) => r.estimate > 0);
  const requested = rows.filter((r) => r.requested > 0);
  const onSite = rows.filter((r) => r.onSite > 0);
  const attention = rows.filter((r) => r.state === 'short' || r.state === 'low');
  const shown = rows.filter((r) =>
    filter === 'requested' ? r.requested > 0 : filter === 'onsite' ? r.onSite > 0 : filter === 'attention' ? attention.includes(r) : true,
  );
  const groups = [...new Set(shown.map((r) => r.group))];
  const history = d.txns.filter((t) => t.siteId === site.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const names = new Map(rows.map((r) => [r.key, r]));

  const tiles: { id: Filter; icon: React.ReactNode; n: number; label: string; warn?: boolean }[] = [
    { id: 'all', icon: <ClipboardList />, n: needed.length, label: 'Needed as per drawings' },
    { id: 'requested', icon: <Send />, n: requested.length, label: 'Requested, not delivered yet' },
    { id: 'onsite', icon: <PackageCheck />, n: onSite.length, label: 'On site now' },
    { id: 'attention', icon: <TriangleAlert />, n: attention.length, label: 'Running low or out', warn: attention.length > 0 },
  ];

  return (
    <div className="stack stack--lg">
      <div className="mat-tiles" role="group" aria-label="Show materials">
        {tiles.map((t) => (
          <button
            key={t.id}
            className={`mat-tile ${filter === t.id ? 'is-on' : ''} ${t.warn ? 'is-warn' : ''}`}
            aria-pressed={filter === t.id}
            onClick={() => setFilter(filter === t.id ? 'all' : t.id)}
          >
            {t.icon}
            <b className="mono">{t.n}</b>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="daily__bar">
        <button className="btn btn--primary" onClick={() => setRequest({})}>
          <Send /> Request materials
        </button>
        <div className="page-head__actions">
          <button className="btn btn--sm" onClick={() => setMove({ type: 'in' })}>
            <ArrowDownToLine /> Record delivery
          </button>
          <button className="btn btn--sm" onClick={() => setMove({ type: 'out' })}>
            <ArrowUpFromLine /> Record usage
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
        {filter !== 'all' && (
          <div className="card__head">
            <span className="muted small">
              Showing {shown.length} of {rows.length} materials ·{' '}
              <button className="link-btn" onClick={() => setFilter('all')}>show all</button>
            </span>
          </div>
        )}
        {shown.length ? (
          <div className="table-wrap">
            <table className="table mat-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="r" title="Worked out from the drawings and site conditions — change any figure to match your BOQ">Needed</th>
                  <th className="r" title="Asked for and not delivered yet">Requested</th>
                  <th className="r">Delivered</th>
                  <th className="r">Used</th>
                  <th className="r">On site</th>
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
                        onRequest={() => setRequest({ key: r.key })}
                        onDelete={r.custom ? () => deleteCustom(r.key) : undefined}
                      />
                    )),
                ])}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="card__body muted">
            {filter === 'requested' ? 'Nothing is waiting for delivery.' : filter === 'onsite' ? 'Nothing has been delivered yet.' : 'Nothing running low.'}
          </p>
        )}
        <div className="card__body row row--between row--wrap" style={{ borderTop: '1px solid var(--rule)' }}>
          <p className="muted small" style={{ maxWidth: 640 }}>
            “Needed” is worked out from the drawing quantities and site conditions. Change any figure to match your approved BOQ; the reason
            for each one shows under the name.
          </p>
          <button className="btn btn--sm" onClick={() => setAdding(true)}>
            <Plus /> Add material
          </button>
        </div>
      </section>

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

      <section className="card">
        <div className="card__head">
          <h2 className="h2">Requests, deliveries and usage</h2>
        </div>
        {history.length ? (
          <ul className="moves">
            {history.map((t) => (
              <li key={t.id}>
                <span className={`move-tag move-tag--${t.type}`}>{{ in: 'In', out: 'Used', return: 'Return', request: 'Asked' }[t.type]}</span>
                <span className="grow">
                  <b>{names.get(t.key)?.name ?? 'Removed material'}</b>
                  <small className="muted">
                    {fmtDate(t.date)}
                    {t.ref ? ` · ${t.ref}` : ''}
                    {t.note ? ` · ${t.note}` : ''}
                  </small>
                </span>
                <span className="mono">
                  {t.type === 'in' ? '+' : t.type === 'request' ? '' : '−'}
                  {num(t.qty)} {names.get(t.key)?.unit}
                </span>
                <button
                  className="icon-btn icon-btn--sm"
                  aria-label={t.type === 'request' ? 'Cancel this request' : 'Delete movement'}
                  title={t.type === 'request' ? 'Cancel this request' : 'Delete'}
                  onClick={() => (deleteTxn(t.id), toast(t.type === 'request' ? 'Request cancelled' : 'Movement deleted'))}
                >
                  <Trash2 />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card__body muted">No requests, deliveries or usage recorded yet.</p>
        )}
      </section>

      {move && <MoveModal siteId={site.id} rows={rows} type={move.type} initialKey={move.key} onClose={() => setMove(null)} />}
      {adding && <AddMaterial siteId={site.id} systems={site.systems} onClose={() => setAdding(false)} />}
      {request && (
        <RequestModal
          site={site}
          rows={rows}
          initialKey={request.key}
          onClose={() => setRequest(null)}
          onSaved={(text) => {
            setRequest(null);
            setShare(text);
          }}
        />
      )}
      {share !== null && (
        <ShareText title="Material request" eyebrow={site.code} initial={share} filename={`${site.code}-material-request.txt`} onClose={() => setShare(null)} />
      )}
    </div>
  );
}

function MatRow({ r, onOverride, onMove, onRequest, onDelete }: { r: MaterialRow; onOverride: (n: number | null) => void; onMove: (t: MaterialMove) => void; onRequest: () => void; onDelete?: () => void }) {
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
          <NumField className="input input--sm input--num w-90" value={r.estimate} onChange={(n) => onOverride(n)} aria-label={`Quantity of ${r.name} needed`} />
          {r.overridden && (
            <button className="icon-btn icon-btn--sm" title="Back to the worked-out figure" aria-label="Reset to the worked-out figure" onClick={() => onOverride(null)}>
              <RotateCcw />
            </button>
          )}
        </span>
        <small className="muted unit">{r.unit}</small>
      </td>
      <td className="r">{r.requested ? <b className="mat-asked">{num(r.requested)}</b> : '—'}</td>
      <td className="r">{num(r.delivered)}</td>
      <td className="r">{num(r.used)}</td>
      <td className="r">
        <b>{num(r.onSite)}</b>
      </td>
      <td>
        <span className={`stock stock--${r.state}`}>
          <span className={`dot dot--${r.state}`} aria-hidden />
          {statusLabel(r)}
        </span>
      </td>
      <td className="nowrap">
        <button className="icon-btn icon-btn--sm" title="Request" aria-label={`Request ${r.name}`} onClick={onRequest}>
          <Send />
        </button>
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

/** Pick materials and quantities, save them as requested, then share the request on WhatsApp */
function RequestModal({ site, rows, initialKey, onClose, onSaved }: { site: Site; rows: MaterialRow[]; initialKey?: string; onClose: () => void; onSaved: (text: string) => void }) {
  const addTxn = useStore((s) => s.addTxn);
  const suggested = rows.filter((r) => r.toRequest > 0);
  const urgent = suggested.filter((r) => r.state === 'short' || r.state === 'low');
  const [show, setShow] = useState<'suggested' | 'all'>(initialKey && !suggested.some((r) => r.key === initialKey) ? 'all' : 'suggested');
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(rows.map((r) => [r.key, r.toRequest])));
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initialKey ? [initialKey] : urgent.map((r) => r.key)));
  const [date, setDate] = useState(today());
  const [ref, setRef] = useState('');
  const list = show === 'all' ? rows : suggested;
  const chosen = rows.filter((r) => picked.has(r.key) && (qty[r.key] ?? 0) > 0);
  const toggle = (key: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    return n;
  });

  const save = () => {
    if (!chosen.length) return toast('Tick at least one material and enter a quantity');
    const items = chosen.map((r) => ({ key: r.key, qty: qty[r.key] }));
    items.forEach((i) => addTxn({ siteId: site.id, date, key: i.key, type: 'request', qty: i.qty, ref, note: '' }));
    toast(`${items.length} material${items.length === 1 ? '' : 's'} marked as requested`);
    onSaved(materialRequestNote(site, getData(), items, ref, date));
  };

  return (
    <Modal
      title="Request materials"
      eyebrow={site.code}
      onClose={onClose}
      footer={
        <>
          <span className="muted small grow">{chosen.length} selected</span>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save}>
            <Send /> Save & share
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="row row--between row--wrap">
          <Seg
            label="Which materials"
            value={show}
            onChange={setShow}
            options={[
              { value: 'suggested', label: 'Still to request', count: suggested.length },
              { value: 'all', label: 'All materials', count: rows.length },
            ]}
          />
          <span className="row" style={{ gap: 4 }}>
            <button className="btn btn--sm btn--ghost" onClick={() => setPicked(new Set([...picked, ...list.filter((r) => (qty[r.key] ?? 0) > 0).map((r) => r.key)]))}>
              Tick all
            </button>
            <button className="btn btn--sm btn--ghost" onClick={() => setPicked(new Set())}>
              Clear
            </button>
          </span>
        </div>
        {list.length ? (
          <ul className="req-list">
            {list.map((r) => (
              <li key={r.key} className={picked.has(r.key) ? 'is-on' : ''}>
                <label className="req-list__pick">
                  <input type="checkbox" checked={picked.has(r.key)} onChange={() => toggle(r.key)} />
                  <span>
                    <b>{r.name}</b>
                    <small className="muted">
                      Needed {num(r.estimate)} · on site {num(r.onSite)}
                      {r.requested ? ` · ${num(r.requested)} already requested` : ''}
                    </small>
                  </span>
                </label>
                <span className="req-list__qty">
                  <NumField
                    className="input input--sm input--num w-90"
                    value={qty[r.key] ?? 0}
                    onChange={(n) => {
                      setQty({ ...qty, [r.key]: n });
                      if (n > 0 && !picked.has(r.key)) toggle(r.key);
                    }}
                    aria-label={`Quantity of ${r.name} to request`}
                  />
                  <small className="muted">{r.unit}</small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            <PackageSearch size={16} /> Everything needed is already delivered or requested. Switch to “All materials” to ask for more.
          </p>
        )}
        <div className="form-grid form-grid--2">
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Request no.</span>
            <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional, e.g. MR-112" />
          </label>
        </div>
      </div>
    </Modal>
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
