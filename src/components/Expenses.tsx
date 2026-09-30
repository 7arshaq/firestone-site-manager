import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { Expense, ExpenseCategory } from '../types';
import { useStore } from '../store/store';
import { CATEGORY_LABEL } from '../lib/labels';
import { Modal, NumField, toast } from './ui';
import { aed, fmtDate, today } from '../lib/util';

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as ExpenseCategory[];

export function ExpenseModal({ expense, siteId, onClose }: { expense?: Expense; siteId?: string | null; onClose: () => void }) {
  const sites = useStore((s) => s.sites);
  const save = useStore((s) => s.saveExpense);
  const [f, setF] = useState<Omit<Expense, 'id'> & { id?: string }>(
    expense ?? { siteId: siteId ?? null, date: today(), category: 'transport', amount: 0, note: '', paidBy: 'Petty cash' },
  );
  const submit = () => {
    if (f.amount <= 0) return toast('Enter an amount above zero');
    save(f);
    toast(expense ? 'Expense updated' : 'Expense added');
    onClose();
  };
  return (
    <Modal
      title={expense ? 'Edit expense' : 'Add expense'}
      onClose={onClose}
      size="narrow"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={submit}>{expense ? 'Save expense' : 'Add expense'}</button>
        </>
      }
    >
      <div className="form-grid form-grid--2">
        <label className="field">
          <span>Amount (AED)</span>
          <NumField value={f.amount} step={0.5} onChange={(n) => setF({ ...f, amount: n })} />
        </label>
        <label className="field">
          <span>Date</span>
          <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </label>
        <label className="field">
          <span>Category</span>
          <select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ExpenseCategory })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Site</span>
          <select className="select" value={f.siteId ?? ''} onChange={(e) => setF({ ...f, siteId: e.target.value || null })}>
            <option value="">General / office</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
          </select>
        </label>
        <label className="field span-all">
          <span>Description</span>
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Pickup diesel — site runs" />
        </label>
        <label className="field span-all">
          <span>Paid by</span>
          <input className="input" value={f.paidBy} onChange={(e) => setF({ ...f, paidBy: e.target.value })} list="paid-by" />
          <datalist id="paid-by">
            <option value="Petty cash" />
            <option value="Engineer" />
            <option value="Company card" />
            <option value="Foreman" />
          </datalist>
        </label>
      </div>
    </Modal>
  );
}

export function ExpenseList({ list, showSite }: { list: Expense[]; showSite?: boolean }) {
  const sites = useStore(useShallow((s) => s.sites));
  const del = useStore((s) => s.deleteExpense);
  const [edit, setEdit] = useState<Expense | null>(null);
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              {showSite && <th>Site</th>}
              <th>Category</th>
              <th>Description</th>
              <th>Paid by</th>
              <th className="r">Amount</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td className="nowrap">{fmtDate(e.date)}</td>
                {showSite && <td className="mono small">{sites.find((s) => s.id === e.siteId)?.code ?? 'General'}</td>}
                <td className="nowrap">{CATEGORY_LABEL[e.category]}</td>
                <td>{e.note}</td>
                <td className="muted nowrap">{e.paidBy}</td>
                <td className="r nowrap"><b>{aed(e.amount)}</b></td>
                <td className="nowrap">
                  <button className="icon-btn icon-btn--sm" aria-label="Edit expense" onClick={() => setEdit(e)}><Pencil /></button>
                  <button className="icon-btn icon-btn--sm" aria-label="Delete expense" onClick={() => (del(e.id), toast('Expense deleted'))}><Trash2 /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <ExpenseModal expense={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
