import { useMemo, useState } from 'react';
import { FileDown, Plus, Receipt } from 'lucide-react';
import { useSiteCtx } from './SiteLayout';
import { getData, useStore } from '../../store/store';
import { ExpenseList, ExpenseModal } from '../../components/Expenses';
import { HBars } from '../../components/Charts';
import { Empty, toast } from '../../components/ui';
import { CATEGORY_LABEL } from '../../lib/labels';
import { makePdf } from '../../lib/pdfLazy';
import { aed, today } from '../../lib/util';

export default function SiteExpenses() {
  const { site } = useSiteCtx();
  const all = useStore((s) => s.expenses);
  const [adding, setAdding] = useState(false);
  const list = useMemo(() => all.filter((e) => e.siteId === site.id).sort((a, b) => b.date.localeCompare(a.date)), [all, site.id]);
  const total = list.reduce((a, e) => a + e.amount, 0);
  const month = today().slice(0, 7);
  const thisMonth = list.filter((e) => e.date.startsWith(month)).reduce((a, e) => a + e.amount, 0);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ label: CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL], value: v }));
  }, [list]);

  return (
    <div className="stack stack--lg">
      <div className="daily__bar">
        <div className="money-row">
          <div>
            <span className="label">All time</span>
            <b className="mono">{aed(total)}</b>
          </div>
          <div>
            <span className="label">This month</span>
            <b className="mono">{aed(thisMonth)}</b>
          </div>
          <div>
            <span className="label">Entries</span>
            <b className="mono">{list.length}</b>
          </div>
        </div>
        <div className="page-head__actions">
          <button
            className="btn btn--sm btn--ghost"
            disabled={!list.length}
            onClick={async () => {
              const from = list[list.length - 1]?.date ?? today();
              const r = await makePdf((p) => p.expenseReportPDF(getData(), from, today(), site.id), `${site.code}-expenses-${today()}.pdf`);
              toast(r === 'shared' ? 'PDF shared' : 'PDF downloaded');
            }}
          >
            <FileDown /> PDF
          </button>
          <button className="btn btn--sm btn--primary" onClick={() => setAdding(true)}>
            <Plus /> Add expense
          </button>
        </div>
      </div>

      {list.length ? (
        <>
          <section className="card">
            <div className="card__head">
              <h2 className="h2">By category</h2>
            </div>
            <div className="card__body">
              <HBars rows={byCat} format={aed} />
            </div>
          </section>
          <section className="card">
            <ExpenseList list={list} />
          </section>
        </>
      ) : (
        <div className="card">
          <Empty icon={<Receipt />} title="No expenses for this site" action={<button className="btn btn--primary" onClick={() => setAdding(true)}><Plus /> Add expense</button>}>
            Log fuel, transport, local purchases and fees so the site's running cost is always at hand.
          </Empty>
        </div>
      )}
      {adding && <ExpenseModal siteId={site.id} onClose={() => setAdding(false)} />}
    </div>
  );
}
