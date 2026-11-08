import { useMemo, useState } from 'react';
import { Check, ListChecks, MessageSquareText, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useSiteCtx } from './SiteLayout';
import { getData, useStore } from '../../store/store';
import { sortScope } from '../../lib/progress';
import { crewOn, scopeListNote } from '../../lib/notes';
import ScopeAdd from '../../components/ScopeAdd';
import { KIND_LABEL, TaskModal } from '../../components/TaskBits';
import { ShareText } from '../../components/ShareText';
import { Bar, Confirm, Empty, Seg, toast } from '../../components/ui';
import type { ScopeItem, System } from '../../types';
import { firstName, fmtDate, today } from '../../lib/util';

type Show = 'pending' | 'done' | 'all';
type SysFilter = 'all' | System | 'general';

export default function ScopeList() {
  const { site, progress } = useSiteCtx();
  const t = today();
  const d = useStore(useShallow((s) => ({ scopeItems: s.scopeItems, tasks: s.tasks, people: s.people, allocations: s.allocations })));
  const addScopeItems = useStore((s) => s.addScopeItems);
  const [show, setShow] = useState<Show>('pending');
  const [sys, setSys] = useState<SysFilter>('all');
  const [assign, setAssign] = useState<ScopeItem | null>(null);
  const [remove, setRemove] = useState<ScopeItem | null>(null);
  const [share, setShare] = useState(false);
  const deleteScopeItem = useStore((s) => s.deleteScopeItem);

  const all = useMemo(() => sortScope(d.scopeItems.filter((i) => i.siteId === site.id)), [d.scopeItems, site.id]);
  const pending = all.filter((i) => !i.doneOn);
  const done = all.filter((i) => i.doneOn);
  const bySys = (i: ScopeItem) => sys === 'all' || (sys === 'general' ? !i.system : i.system === sys);
  const list = (show === 'pending' ? pending : show === 'done' ? done : all).filter(bySys);
  const variations = all.filter((i) => i.kind === 'variation').length;
  const found = all.filter((i) => i.kind === 'found').length;
  const hasGeneral = all.some((i) => !i.system);
  const crew = crewOn(d, site.id, t);

  // who has worked on each item, and whether it's on today's plan
  const work = useMemo(() => {
    const m = new Map<string, { today: string[]; last: string | null }>();
    for (const task of d.tasks) {
      if (task.siteId !== site.id || !task.scopeItemId) continue;
      const w = m.get(task.scopeItemId) ?? { today: [], last: null };
      if (task.date === t) w.today.push(...task.assignees);
      if (!w.last || task.date > w.last) w.last = task.date;
      m.set(task.scopeItemId, w);
    }
    return m;
  }, [d.tasks, site.id, t]);
  const names = (ids: string[]) => [...new Set(ids)].map((id) => firstName(d.people.find((p) => p.id === id)?.name ?? '')).filter(Boolean).join(', ');

  return (
    <div className="stack stack--lg">
      <section className="card scope-sum">
        <div className="scope-sum__main">
          <span className="display">{Math.round(progress.overall * 100)}<small>%</small></span>
          <div className="grow stack" style={{ gap: 6 }}>
            <b>
              {done.length} of {all.length} item{all.length === 1 ? '' : 's'} done
            </b>
            <Bar value={progress.overall} kind="done" label="Share of scope items done" />
            <span className="muted small">
              {pending.length} pending
              {variations > 0 && ` · ${variations} variation${variations === 1 ? '' : 's'}`}
              {found > 0 && ` · ${found} found on site`}
            </span>
          </div>
        </div>
        <div className="scope-sum__sys">
          {(['FA', 'FF'] as const).map((s) =>
            progress[s] === null ? null : (
              <div key={s} className="sys-bar">
                <span className="sys-bar__name">{s === 'FA' ? 'Fire alarm' : 'Fire fighting'}</span>
                <Bar value={progress[s]!} kind={s} label={`${s} items done`} />
                <b className="mono">{Math.round(progress[s]! * 100)}%</b>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <div>
            <h2 className="h2">Add to the scope list</h2>
            <p className="muted small">Write each piece of work as a sentence. Add variations and pending work you find on site as they come up.</p>
          </div>
        </div>
        <div className="card__body">
          <ScopeAdd systems={site.systems} onAdd={(items) => addScopeItems(site.id, items)} />
        </div>
      </section>

      <section className="card">
        <div className="card__head scope-head">
          <Seg
            label="Show"
            value={show}
            onChange={setShow}
            options={[
              { value: 'pending', label: 'Pending', count: pending.length },
              { value: 'done', label: 'Done', count: done.length },
              { value: 'all', label: 'All', count: all.length },
            ]}
          />
          <div className="row" style={{ gap: 6 }}>
            {(site.systems.length > 1 || hasGeneral) && (
              <select className="select input--sm scope-add__kind" value={sys} onChange={(e) => setSys(e.target.value as SysFilter)} aria-label="System">
                <option value="all">All systems</option>
                {site.systems.map((s) => (
                  <option key={s} value={s}>{s === 'FA' ? 'Fire alarm' : 'Fire fighting'}</option>
                ))}
                <option value="general">General</option>
              </select>
            )}
            <button className="btn btn--sm" onClick={() => setShare(true)} disabled={!all.length}>
              <MessageSquareText /> Share list
            </button>
          </div>
        </div>
        {list.length ? (
          <ul className="scope-list">
            {list.map((i) => (
              <ScopeRow
                key={i.id}
                item={i}
                work={work.get(i.id)}
                names={names}
                onAssign={() => setAssign(i)}
                onDelete={() => setRemove(i)}
              />
            ))}
          </ul>
        ) : (
          <Empty icon={<ListChecks />} title={all.length ? (show === 'pending' ? 'Nothing pending' : 'Nothing here') : 'No scope items yet'}>
            {all.length
              ? show === 'pending'
                ? 'Every item on the list is done. Add new work above when it comes up.'
                : 'Try another filter.'
              : 'Write the scope as a to-do list above — one line per item. You can paste a whole list at once.'}
          </Empty>
        )}
      </section>

      {assign && <TaskModal site={site} date={t} scopeItemId={assign.id} crewIds={crew.map((p) => p.id)} onClose={() => setAssign(null)} />}
      {remove && (
        <Confirm
          title="Remove this item from the scope list?"
          body={<>“{remove.text}” is removed. Tasks already done for it stay in the daily records.</>}
          action="Remove item"
          onClose={() => setRemove(null)}
          onConfirm={() => {
            deleteScopeItem(remove.id);
            toast('Item removed');
          }}
        />
      )}
      {share && (
        <ShareText title="Scope list" eyebrow={site.code} initial={scopeListNote(site, getData(), show === 'done' ? 'all' : 'pending')} onClose={() => setShare(false)} />
      )}
    </div>
  );
}

function ScopeRow({
  item,
  work,
  names,
  onAssign,
  onDelete,
}: {
  item: ScopeItem;
  work?: { today: string[]; last: string | null };
  names: (ids: string[]) => string;
  onAssign: () => void;
  onDelete: () => void;
}) {
  const setDone = useStore((s) => s.setScopeDone);
  const update = useStore((s) => s.updateScopeItem);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const t = today();
  const save = () => {
    if (text.trim()) update(item.id, { text: text.trim() });
    else setText(item.text);
    setEditing(false);
  };

  return (
    <li className={`scope-item ${item.doneOn ? 'is-done' : ''}`}>
      <button
        className="scope-check"
        role="checkbox"
        aria-checked={!!item.doneOn}
        aria-label={item.doneOn ? `Mark "${item.text}" as pending` : `Tick off "${item.text}"`}
        onClick={() => {
          setDone(item.id, item.doneOn ? null : t);
          if (!item.doneOn) toast('Ticked off');
        }}
      >
        {item.doneOn && <Check />}
      </button>
      <div className="grow scope-item__body">
        {editing ? (
          <div className="row" style={{ gap: 6 }}>
            <input
              className="input input--sm grow"
              value={text}
              autoFocus
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') (setText(item.text), setEditing(false));
              }}
              aria-label="Item text"
            />
            <button className="icon-btn icon-btn--sm" onClick={save} aria-label="Save">
              <Check />
            </button>
            <button className="icon-btn icon-btn--sm" onClick={() => (setText(item.text), setEditing(false))} aria-label="Cancel">
              <X />
            </button>
          </div>
        ) : (
          <p className="scope-item__text">{item.text}</p>
        )}
        <div className="scope-item__meta">
          {item.system && <span className={`sys sys--${item.system}`}>{item.system}</span>}
          {item.kind !== 'scope' && <span className={`kind kind--${item.kind}`}>{KIND_LABEL[item.kind]}</span>}
          <span>Added {fmtDate(item.addedOn)}</span>
          {item.doneOn ? (
            <span className="scope-item__done">Done {fmtDate(item.doneOn)}</span>
          ) : work?.today.length ? (
            <span className="scope-item__today">Today: {names(work.today)}</span>
          ) : work?.last ? (
            <span>Last worked {fmtDate(work.last)}</span>
          ) : null}
        </div>
      </div>
      <div className="scope-item__acts">
        {!item.doneOn && (
          <button className="btn btn--sm" onClick={onAssign}>
            <UserPlus /> Assign
          </button>
        )}
        <button className="icon-btn icon-btn--sm" onClick={() => setEditing(true)} aria-label="Edit item" title="Edit">
          <Pencil />
        </button>
        <button className="icon-btn icon-btn--sm" onClick={onDelete} aria-label="Remove item" title="Remove">
          <Trash2 />
        </button>
      </div>
    </li>
  );
}
