import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useSiteCtx } from './SiteLayout';
import MarkupReader from '../../components/MarkupReader';
import { useStore } from '../../store/store';
import { siteProgress } from '../../lib/progress';
import { Modal, NumField, SysTag, toast } from '../../components/ui';
import type { System } from '../../types';
import { num, qtyNum } from '../../lib/util';

const FA_FIELDS: [keyof import('../../types').FAScope, string][] = [
  ['panels', 'Fire alarm panels'], ['loops', 'Loops'], ['smoke', 'Smoke detectors'], ['heat', 'Heat detectors'],
  ['beam', 'Beam detectors'], ['mcp', 'Manual call points'], ['sounders', 'Sounders / strobes'], ['modules', 'Interface modules'],
];
const FF_FIELDS: [keyof import('../../types').FFScope, string, string][] = [
  ['sprinklers', 'Sprinkler heads', 'nos'], ['pipeMeters', 'Pipework', 'm'], ['hoseReels', 'Hose reels', 'nos'],
  ['landingValves', 'Landing valves', 'nos'], ['hydrants', 'External hydrants', 'nos'], ['alarmValves', 'Alarm / zone valves', 'sets'],
  ['pumpSets', 'Pump sets', 'sets'], ['extinguishers', 'Extinguishers', 'nos'],
];

export default function Scope() {
  const s = useSiteCtx();
  const { site } = s;
  const d = useStore(useShallow((st) => ({ workItems: st.workItems, tasks: st.tasks, adjustments: st.adjustments })));
  const updateWorkItem = useStore((st) => st.updateWorkItem);
  const deleteWorkItem = useStore((st) => st.deleteWorkItem);
  const updateSite = useStore((st) => st.updateSite);
  const prog = useMemo(() => siteProgress(site, d.workItems, d.tasks, undefined, d.adjustments), [site, d]);
  // recorded since tracking began: daily task quantities plus updates from highlighted drawings
  const fromTasks = useMemo(() => {
    const m = new Map<string, number>();
    d.tasks.forEach((t) => t.siteId === site.id && t.workItemId && m.set(t.workItemId, (m.get(t.workItemId) ?? 0) + t.doneQty));
    d.adjustments.forEach((a) => a.siteId === site.id && m.set(a.workItemId, (m.get(a.workItemId) ?? 0) + a.qty));
    return m;
  }, [d.tasks, d.adjustments, site.id]);
  const [adding, setAdding] = useState(false);

  return (
    <div className="stack stack--lg">
      <MarkupReader site={site} items={prog.items} />

      <section className="card">
        <div className="card__head">
          <div>
            <h2 className="h2">Scope from drawings</h2>
            <p className="muted small">Quantities from the approved shop drawings / BOQ. Stages and materials are worked out from these.</p>
          </div>
          <Link to={`/sites/${site.id}/edit`} className="btn btn--sm">
            <Pencil /> Edit scope
          </Link>
        </div>
        <div className="card__body scope-sum">
          {site.systems.includes('FA') && (
            <div>
              <div className="stages__title">
                <SysTag s="FA" />
                <span className="h3">Fire alarm</span>
              </div>
              <dl className="qty-grid">
                {FA_FIELDS.map(([k, label]) => (
                  <div key={k}>
                    <dt>{label}</dt>
                    <dd className="mono">{num(site.fa[k])}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {site.systems.includes('FF') && (
            <div>
              <div className="stages__title">
                <SysTag s="FF" />
                <span className="h3">Fire fighting</span>
              </div>
              <dl className="qty-grid">
                {FF_FIELDS.map(([k, label, unit]) => (
                  <div key={k}>
                    <dt>{label}</dt>
                    <dd className="mono">
                      {num(site.ff[k])} <small>{unit}</small>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <div>
            <h2 className="h2">How progress is calculated</h2>
            <p className="muted small">
              Each stage's share of its system = its weight. Progress = Σ (weight × done ÷ scope) ÷ Σ weight.
              {site.systems.length === 2 && ' Overall combines the two systems by the split below.'}
            </p>
          </div>
          <button className="btn btn--sm" onClick={() => setAdding(true)}>
            <Plus /> Add stage
          </button>
        </div>

        {site.systems.length === 2 && (
          <div className="card__body split">
            <span className="label">Overall split</span>
            <div className="split__control">
              <span className="sys sys--FA">FA {site.faShare}%</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={site.faShare}
                onChange={(e) => updateSite(site.id, { faShare: Number(e.target.value) })}
                aria-label="Fire alarm share of overall progress"
                style={{ ['--v' as string]: `${site.faShare}%` }}
              />
              <span className="sys sys--FF">FF {100 - site.faShare}%</span>
            </div>
            <p className="muted small">Set this to each system's share of the contract value.</p>
          </div>
        )}

        <div className="table-wrap">
          <table className="table scope-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th className="r">Scope</th>
                <th className="r" title="Progress achieved before you started tracking it here">Done before</th>
                <th className="r" title="Daily task quantities plus updates from highlighted drawings">Recorded</th>
                <th className="r">Done</th>
                <th className="r">%</th>
                <th className="r">Weight</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {(['FA', 'FF'] as System[])
                .filter((sys) => site.systems.includes(sys))
                .map((sys) => {
                  const rows = prog.items.filter((p) => p.item.system === sys);
                  const wsum = rows.reduce((a, p) => a + p.item.weight, 0);
                  return [
                    <tr key={`g-${sys}`} className="group-row">
                      <td colSpan={8}>
                        <span className="row">
                          <SysTag s={sys} />
                          <b>{sys === 'FA' ? 'Fire alarm' : 'Fire fighting'}</b>
                          <span className="muted small">weights total {wsum}</span>
                        </span>
                      </td>
                    </tr>,
                    ...rows.map((p) => (
                      <tr key={p.item.id}>
                        <td>
                          <input
                            className="input input--sm scope-table__label"
                            value={p.item.label}
                            onChange={(e) => updateWorkItem(p.item.id, { label: e.target.value })}
                            aria-label="Stage name"
                          />
                        </td>
                        <td className="r nowrap">
                          {p.item.key.startsWith('custom.') ? (
                            <NumField className="input input--sm input--num w-90" value={p.item.qty} onChange={(n) => updateWorkItem(p.item.id, { qty: n })} aria-label="Scope quantity" />
                          ) : (
                            num(p.item.qty)
                          )}{' '}
                          <small className="muted">{p.item.unit}</small>
                        </td>
                        <td className="r">
                          <NumField className="input input--sm input--num w-90" value={p.item.baseDone} onChange={(n) => updateWorkItem(p.item.id, { baseDone: Math.min(n, p.item.qty) })} aria-label="Done before tracking" />
                        </td>
                        <td className="r">{qtyNum(fromTasks.get(p.item.id) ?? 0)}</td>
                        <td className="r">{qtyNum(p.done)}</td>
                        <td className="r">
                          <b>{Math.round(p.frac * 100)}%</b>
                        </td>
                        <td className="r">
                          <NumField className="input input--sm input--num w-64" value={p.item.weight} onChange={(n) => updateWorkItem(p.item.id, { weight: n })} aria-label="Weight" />
                        </td>
                        <td>
                          {p.item.key.startsWith('custom.') && (
                            <button
                              className="icon-btn icon-btn--sm"
                              aria-label="Delete stage"
                              onClick={() => {
                                deleteWorkItem(p.item.id);
                                toast('Stage deleted');
                              }}
                            >
                              <Trash2 />
                            </button>
                          )}
                        </td>
                      </tr>
                    )),
                  ];
                })}
            </tbody>
          </table>
        </div>
      </section>

      {adding && <AddStage siteId={site.id} systems={site.systems} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddStage({ siteId, systems, onClose }: { siteId: string; systems: System[]; onClose: () => void }) {
  const addWorkItem = useStore((s) => s.addWorkItem);
  const [f, setF] = useState({ system: systems[0], label: '', unit: 'nos', qty: 1, weight: 5 });
  const save = () => {
    if (!f.label.trim()) return toast('Name the stage first');
    addWorkItem({ ...f, siteId, baseDone: 0 });
    toast('Stage added');
    onClose();
  };
  return (
    <Modal
      title="Add a stage"
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save}>Add stage</button>
        </>
      }
    >
      <div className="form-grid form-grid--2">
        <label className="field span-all">
          <span>Stage name</span>
          <input className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. Gas suppression — FM-200 room" />
        </label>
        <label className="field">
          <span>System</span>
          <select className="select" value={f.system} onChange={(e) => setF({ ...f, system: e.target.value as System })}>
            {systems.map((s) => (
              <option key={s} value={s}>{s === 'FA' ? 'Fire alarm' : 'Fire fighting'}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Unit</span>
          <select className="select" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
            {['nos', 'm', 'sets', 'lot', 'zones', 'loops'].map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Scope quantity</span>
          <NumField value={f.qty} onChange={(n) => setF({ ...f, qty: n })} />
        </label>
        <label className="field">
          <span>Weight</span>
          <NumField value={f.weight} onChange={(n) => setF({ ...f, weight: n })} />
        </label>
      </div>
    </Modal>
  );
}
