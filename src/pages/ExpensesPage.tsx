import { useMemo, useState } from 'react';
import { FileDown, Plus, Receipt } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { getData, useStore } from '../store/store';
import { ExpenseList, ExpenseModal } from '../components/Expenses';
import { HBars } from '../components/Charts';
import { Empty, toast } from '../components/ui';
import { CATEGORY_LABEL } from '../lib/labels';
import { makePdf } from '../lib/pdfLazy';
import { aed, today } from '../lib/util';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export default function ExpensesPage() {
  const d = useStore(useShallow((s) => ({ expenses: s.expenses, sites: s.sites })));
  const [adding, setAdding] = useState(false);
  const months = useMemo(() => [...new Set([today().slice(0, 7), ...d.expenses.map((e) => e.date.slice(0, 7))])].sort().reverse(), [d.expenses]);
  const [month, setMonth] = useState(months[0]);
  const [siteId, setSiteId] = useState('');
  const list = d.expenses
    .filter((e) => e.date.startsWith(month) && (!siteId || e.siteId === siteId || (siteId === 'general' && !e.siteId)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((a, e) => a + e.amount, 0);
  const prevMonth = months[months.indexOf(month) + 1];
  const prevTotal = prevMonth ? d.expenses.filter((e) => e.date.startsWith(prevMonth) && (!siteId || e.siteId === siteId)).reduce((a, e) => a + e.amount, 0) : null;

  const group = (key: (e: (typeof list)[number]) => string, label: (k: string) => string) => {
    const m = new Map<string, number>();
    list.forEach((e) => m.set(key(e), (m.get(key(e)) ?? 0) + e.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: label(k), value: v }));
  };
  const byCat = group((e) => e.category, (k) => CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL]);
  const bySite = group((e) => e.siteId ?? '', (k) => d.sites.find((s) => s.id === k)?.code ?? 'General');

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__title">
          <span className="label">Site running costs</span>
          <h1 className="h1">Expenses</h1>
        </div>
        <div className="page-head__actions">
          <button
            className="btn"
            disabled={!list.length}
            onClick={async () => {
              const r = await makePdf((p) => p.expenseReportPDF(getData(), `${month}-01`, `${month}-31`, siteId && siteId !== 'general' ? siteId : null), `expenses-${month}.pdf`);
              toast(r === 'shared' ? 'PDF shared' : 'PDF downloaded');
            }}
          >
            <FileDown /> PDF
          </button>
          <button className="btn btn--primary" onClick={() => setAdding(true)}>
            <Plus /> Add expense
          </button>
        </div>
      </div>

      <div className="daily__bar">
        <div className="row row--wrap">
          <select className="select" style={{ width: 190 }} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select className="select" style={{ width: 260 }} value={siteId} onChange={(e) => setSiteId(e.target.value)} aria-label="Site">
            <option value="">All sites</option>
            <option value="general">General / office</option>
            {d.sites.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
          </select>
        </div>
        <div className="money-row">
          <div>
            <span className="label">{monthLabel(month)}</span>
            <b className="mono">{aed(total)}</b>
          </div>
          {prevTotal !== null && (
            <div>
              <span className="label">{monthLabel(prevMonth!)}</span>
              <b className="mono muted">{aed(prevTotal)}</b>
            </div>
          )}
        </div>
      </div>

      {list.length ? (
        <div className="stack stack--lg">
          <div className="two-col">
            <section className="card">
              <div className="card__head"><h2 className="h2">By category</h2></div>
              <div className="card__body"><HBars rows={byCat} format={aed} /></div>
            </section>
            {!siteId && (
              <section className="card">
                <div className="card__head"><h2 className="h2">By site</h2></div>
                <div className="card__body"><HBars rows={bySite} format={aed} color="var(--graphite)" /></div>
              </section>
            )}
          </div>
          <section className="card">
            <ExpenseList list={list} showSite />
          </section>
        </div>
      ) : (
        <div className="card">
          <Empty icon={<Receipt />} title={`No expenses in ${monthLabel(month)}`} action={<button className="btn btn--primary" onClick={() => setAdding(true)}><Plus /> Add expense</button>}>
            Record fuel, transport, local purchases, overtime and permit fees as they happen.
          </Empty>
        </div>
      )}
      {adding && <ExpenseModal siteId={siteId && siteId !== 'general' ? siteId : null} onClose={() => setAdding(false)} />}
    </div>
  );
}
