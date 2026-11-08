import { useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { Person, ScopeItem, Site, Task, TaskStatus } from '../types';
import { useStore } from '../store/store';
import { sortScope } from '../lib/progress';
import { Avatar, Modal, toast } from './ui';
import { firstName } from '../lib/util';

export const TASK_STATUS: { value: TaskStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in-progress', label: 'Ongoing' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'On hold' },
];

export const KIND_LABEL = { scope: 'Scope', variation: 'Variation', found: 'Found on site' } as const;

/* ---------------- Task card ---------------- */

export function TaskCard({
  task,
  item,
  people,
  onEdit,
  compact,
}: {
  task: Task;
  item?: ScopeItem;
  people: Person[];
  onEdit?: () => void;
  compact?: boolean;
}) {
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const [menu, setMenu] = useState(false);
  const who = task.assignees.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];

  return (
    <article className={`task task--${task.status} ${compact ? 'task--compact' : ''}`}>
      <div className="task__head">
        <div className="task__title">
          {item?.system && <span className={`sys sys--${item.system}`}>{item.system}</span>}
          <h3>
            {task.title}
            {task.location && <span className="task__loc"> — {task.location}</span>}
          </h3>
        </div>
        {onEdit && (
          <div className="task__menu">
            <button className="icon-btn icon-btn--sm" onClick={() => setMenu((m) => !m)} aria-label="Task options" aria-expanded={menu}>
              <MoreHorizontal />
            </button>
            {menu && (
              <div className="menu" onMouseLeave={() => setMenu(false)}>
                <button onClick={() => (setMenu(false), onEdit())}>
                  <Pencil /> Edit task
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    setMenu(false);
                    deleteTask(task.id);
                    toast('Task deleted');
                  }}
                >
                  <Trash2 /> Delete task
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {item && item.kind !== 'scope' && <span className={`kind kind--${item.kind}`}>{KIND_LABEL[item.kind]}</span>}

      {task.status === 'blocked' && (
        <label className="task__block">
          <AlertTriangle aria-hidden />
          <textarea
            className="task__block-input"
            rows={2}
            value={task.blockReason}
            onChange={(e) => updateTask(task.id, { blockReason: e.target.value })}
            placeholder="What's holding it up? This goes into the report."
            aria-label="Reason the task is on hold"
            autoFocus={!task.blockReason}
          />
        </label>
      )}

      <div className="task__foot">
        <div className="task__who">
          {who.length ? (
            who.map((p) => (
              <span key={p.id} className="who" title={p.name}>
                <Avatar p={p} size={22} />
                {firstName(p.name)}
              </span>
            ))
          ) : (
            <span className="muted small">No one assigned</span>
          )}
        </div>
        <div className="status-seg" role="group" aria-label="Task status">
          {TASK_STATUS.map((s) => (
            <button key={s.value} type="button" aria-pressed={task.status === s.value} className={`is-${s.value}`} onClick={() => updateTask(task.id, { status: s.value })}>
              {s.value === 'done' && task.status === 'done' && <Check aria-hidden />}
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {item && task.status === 'done' && item.doneOn && (
        <p className="task__ticked">
          <CheckCircle2 aria-hidden /> Ticked off the scope list
        </p>
      )}
      {task.note && <p className="task__note">{task.note}</p>}
    </article>
  );
}

/* ---------------- Task editor ---------------- */

export function TaskModal({
  site,
  date,
  task,
  scopeItemId,
  crewIds,
  onClose,
}: {
  site: Site;
  date: string;
  task?: Task;
  /** start a new task on this scope list item */
  scopeItemId?: string;
  crewIds: string[];
  onClose: () => void;
}) {
  const d = useStore(useShallow((s) => ({ scopeItems: s.scopeItems, people: s.people })));
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const items = sortScope(d.scopeItems.filter((i) => i.siteId === site.id));
  const preset = items.find((i) => i.id === scopeItemId);
  const [f, setF] = useState<Omit<Task, 'id' | 'updatedAt'>>(
    task ?? {
      siteId: site.id, date, scopeItemId: preset?.id ?? null, title: preset?.text ?? '', location: '', assignees: [],
      status: 'planned', blockReason: '', note: '', updatedBy: 'engineer',
    },
  );
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const item = items.find((i) => i.id === f.scopeItemId);
  // pending items, plus the one this task is already on (even if it's been ticked off)
  const choices = items.filter((i) => !i.doneOn || i.id === f.scopeItemId);
  const people = d.people.filter((p) => p.active);
  const onSite = people.filter((p) => crewIds.includes(p.id));
  const others = people.filter((p) => !crewIds.includes(p.id));

  const pickItem = (id: string) => {
    const next = items.find((x) => x.id === id);
    setF((x) => ({
      ...x,
      scopeItemId: id || null,
      title: next && (!x.title || items.some((q) => q.text === x.title)) ? next.text : x.title,
    }));
  };
  const toggle = (id: string) => set('assignees', f.assignees.includes(id) ? f.assignees.filter((a) => a !== id) : [...f.assignees, id]);

  const save = () => {
    if (!f.title.trim()) return toast('Write what the work is first');
    if (task) {
      updateTask(task.id, f);
      toast('Task updated');
    } else {
      addTask(f);
      toast(f.assignees.length ? `Assigned to ${f.assignees.length} ${f.assignees.length === 1 ? 'person' : 'people'}` : 'Task added');
    }
    onClose();
  };

  const group = (label: string, list: ScopeItem[]) =>
    list.length ? (
      <optgroup key={label} label={label}>
        {list.map((i) => (
          <option key={i.id} value={i.id}>
            {i.kind === 'variation' ? '[Variation] ' : i.kind === 'found' ? '[Found] ' : ''}
            {i.text.length > 90 ? `${i.text.slice(0, 88)}…` : i.text}
            {i.doneOn ? ' (ticked off)' : ''}
          </option>
        ))}
      </optgroup>
    ) : null;

  return (
    <Modal
      title={task ? 'Edit task' : 'Assign work'}
      eyebrow={`${site.code} · ${date}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save}>{task ? 'Save task' : 'Assign'}</button>
        </>
      }
    >
      <div className="stack">
        <label className="field">
          <span>From the scope list</span>
          <select className="select" value={f.scopeItemId ?? ''} onChange={(e) => pickItem(e.target.value)}>
            <option value="">Other work (not on the scope list)</option>
            {group('Fire alarm', choices.filter((i) => i.system === 'FA'))}
            {group('Fire fighting', choices.filter((i) => i.system === 'FF'))}
            {group('General', choices.filter((i) => !i.system))}
          </select>
          {item ? <small>When this task is marked Done, the item is ticked off the scope list.</small> : !choices.length && <small>The scope list has nothing pending. Add work in the Scope tab.</small>}
        </label>
        <div className="form-grid form-grid--2">
          <label className="field span-all">
            <span>Work to do</span>
            <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Fix smoke detectors in L3 corridor" />
          </label>
          <label className="field span-all">
            <span>Location</span>
            <input className="input" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Optional — e.g. L18 corridor, Bay 3" />
          </label>
        </div>
        <div className="field">
          <span>Status</span>
          <div className="status-seg status-seg--lg" role="group" aria-label="Status">
            {TASK_STATUS.map((s) => (
              <button key={s.value} type="button" aria-pressed={f.status === s.value} className={`is-${s.value}`} onClick={() => set('status', s.value)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {f.status === 'blocked' && (
          <label className="field">
            <span>What's holding it up?</span>
            <input className="input" value={f.blockReason} onChange={(e) => set('blockReason', e.target.value)} placeholder="e.g. Waiting for ceiling access panels" />
          </label>
        )}
        <div className="field">
          <span>Assigned to</span>
          <div className="pick-people">
            {onSite.length > 0 && <span className="label">On this site today</span>}
            <div className="pick-people__list">
              {onSite.map((p) => (
                <PersonToggle key={p.id} p={p} on={f.assignees.includes(p.id)} onClick={() => toggle(p.id)} />
              ))}
            </div>
            {others.length > 0 && (
              <details open={onSite.length === 0}>
                <summary className="label">Everyone else ({others.length})</summary>
                <div className="pick-people__list">
                  {others.map((p) => (
                    <PersonToggle key={p.id} p={p} on={f.assignees.includes(p.id)} onClick={() => toggle(p.id)} />
                  ))}
                </div>
              </details>
            )}
            {!people.length && <small className="muted">No team yet — add people in the site's Team tab.</small>}
          </div>
        </div>
        <label className="field">
          <span>Note</span>
          <textarea className="textarea" rows={2} value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Optional" />
        </label>
      </div>
    </Modal>
  );
}

export function PersonToggle({ p, on, onClick, hint }: { p: Person; on: boolean; onClick: () => void; hint?: string }) {
  return (
    <button type="button" className={`person-toggle ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={onClick}>
      <Avatar p={p} size={24} />
      <span className="grow">
        {p.name}
        {hint && <small>{hint}</small>}
      </span>
      {on && <Check aria-hidden />}
    </button>
  );
}
