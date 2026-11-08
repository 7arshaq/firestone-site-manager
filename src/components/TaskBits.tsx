import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Minus, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { Person, Site, Task, TaskStatus, WorkItem } from '../types';
import { useStore } from '../store/store';
import { siteProgress } from '../lib/progress';
import { Avatar, Modal, NumField, toast } from './ui';
import { firstName, num } from '../lib/util';

export const TASK_STATUS: { value: TaskStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in-progress', label: 'Ongoing' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'On hold' },
];

/* ---------------- Task card ---------------- */

export function TaskCard({
  task,
  item,
  people,
  onEdit,
  compact,
}: {
  task: Task;
  item?: WorkItem;
  people: Person[];
  onEdit?: () => void;
  compact?: boolean;
}) {
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const [menu, setMenu] = useState(false);
  const who = task.assignees.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  const frac = task.plannedQty > 0 ? Math.min(1, task.doneQty / task.plannedQty) : task.status === 'done' ? 1 : 0;
  const step = item ? (item.unit === 'm' ? 10 : 1) : 1;

  const setStatus = (status: TaskStatus) => {
    const patch: Partial<Task> = { status };
    if (status === 'done' && task.doneQty === 0 && task.plannedQty > 0) patch.doneQty = task.plannedQty;
    updateTask(task.id, patch);
  };

  const setQty = (n: number) => {
    const patch: Partial<Task> = { doneQty: Math.max(0, n) };
    if (task.status === 'planned' && n > 0) patch.status = 'in-progress';
    updateTask(task.id, patch);
  };

  return (
    <article className={`task task--${task.status} ${compact ? 'task--compact' : ''}`}>
      <div className="task__head">
        <div className="task__title">
          {item && <span className={`sys sys--${item.system}`}>{item.system}</span>}
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

      <div className="task__qty">
        {item || task.plannedQty > 0 ? (
          <>
            <div className="qty-step" role="group" aria-label="Quantity done">
              <button type="button" onClick={() => setQty(task.doneQty - step)} aria-label={`Minus ${step}`}>
                <Minus />
              </button>
              <NumField className="qty-step__input" value={task.doneQty} onChange={setQty} aria-label="Quantity done today" />
              <button type="button" onClick={() => setQty(task.doneQty + step)} aria-label={`Plus ${step}`}>
                <Plus />
              </button>
            </div>
            <div className="task__meter">
              <div className={`bar bar--thin ${task.status === 'done' ? 'bar--done' : ''}`}>
                <i style={{ width: `${frac * 100}%` }} />
              </div>
              <span className="mono small">
                {num(task.doneQty)} / {num(task.plannedQty)} {item?.unit ?? ''}
              </span>
            </div>
          </>
        ) : (
          <span className="muted small">Not measured by quantity</span>
        )}
      </div>

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
            <button key={s.value} type="button" aria-pressed={task.status === s.value} className={`is-${s.value}`} onClick={() => setStatus(s.value)}>
              {s.value === 'done' && task.status === 'done' && <Check aria-hidden />}
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {task.note && <p className="task__note">{task.note}</p>}
    </article>
  );
}

/* ---------------- Task editor ---------------- */

export function TaskModal({
  site,
  date,
  task,
  crewIds,
  onClose,
}: {
  site: Site;
  date: string;
  task?: Task;
  crewIds: string[];
  onClose: () => void;
}) {
  const d = useStore(useShallow((s) => ({ workItems: s.workItems, tasks: s.tasks, people: s.people, adjustments: s.adjustments })));
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const prog = useMemo(() => siteProgress(site, d.workItems, d.tasks, undefined, d.adjustments), [site, d.workItems, d.tasks, d.adjustments]);
  const [f, setF] = useState<Omit<Task, 'id' | 'updatedAt'>>(
    task ?? {
      siteId: site.id, date, workItemId: null, title: '', location: '', assignees: [], plannedQty: 0, doneQty: 0,
      status: 'planned', blockReason: '', note: '', updatedBy: 'engineer',
    },
  );
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const item = prog.items.find((p) => p.item.id === f.workItemId);
  const people = d.people.filter((p) => p.active);
  const onSite = people.filter((p) => crewIds.includes(p.id));
  const others = people.filter((p) => !crewIds.includes(p.id));

  const pickItem = (id: string) => {
    const p = prog.items.find((x) => x.item.id === id);
    setF((x) => ({
      ...x,
      workItemId: id || null,
      title: p && (!x.title || prog.items.some((q) => q.item.label === x.title)) ? p.item.label : x.title,
    }));
  };
  const toggle = (id: string) => set('assignees', f.assignees.includes(id) ? f.assignees.filter((a) => a !== id) : [...f.assignees, id]);

  const save = () => {
    if (!f.title.trim()) return toast('Add a task name first');
    const out = { ...f };
    if (out.status === 'planned' && out.doneQty > 0) out.status = out.plannedQty > 0 && out.doneQty >= out.plannedQty ? 'done' : 'in-progress';
    if (task) {
      updateTask(task.id, out);
      toast('Task updated');
    } else {
      addTask(out);
      toast('Task added');
    }
    onClose();
  };

  return (
    <Modal
      title={task ? 'Edit task' : 'Add task'}
      eyebrow={`${site.code} · ${date}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save}>{task ? 'Save task' : 'Add task'}</button>
        </>
      }
    >
      <div className="stack">
        <label className="field">
          <span>Scope activity</span>
          <select className="select" value={f.workItemId ?? ''} onChange={(e) => pickItem(e.target.value)}>
            <option value="">Other work (doesn't count towards progress)</option>
            {(['FA', 'FF'] as const).map((sys) =>
              site.systems.includes(sys) ? (
                <optgroup key={sys} label={sys === 'FA' ? 'Fire alarm' : 'Fire fighting'}>
                  {prog.items
                    .filter((p) => p.item.system === sys)
                    .map((p) => (
                      <option key={p.item.id} value={p.item.id}>
                        {p.item.label} — {Math.round(p.frac * 100)}% ({num(p.item.qty - p.done)} {p.item.unit} left)
                      </option>
                    ))}
                </optgroup>
              ) : null,
            )}
          </select>
          {item && <small>Quantities you enter here add to “{item.item.label}” and update site progress.</small>}
        </label>
        <div className="form-grid form-grid--2">
          <label className="field">
            <span>Task</span>
            <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Cable pulling" />
          </label>
          <label className="field">
            <span>Location</span>
            <input className="input" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. L18 corridor, Bay 3" />
          </label>
          <label className="field">
            <span>Target today{item ? ` (${item.item.unit})` : ''}</span>
            <NumField value={f.plannedQty} onChange={(n) => set('plannedQty', n)} />
          </label>
          <label className="field">
            <span>Done{item ? ` (${item.item.unit})` : ''}</span>
            <NumField value={f.doneQty} onChange={(n) => set('doneQty', n)} />
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
