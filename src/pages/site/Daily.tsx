import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, CornerDownRight, Plus, UserPlus, Wand2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useSiteCtx } from './SiteLayout';
import { useStore } from '../../store/store';
import { crewOn, crewBreakdown } from '../../lib/notes';
import { KIND_LABEL, TaskCard, TaskModal } from '../../components/TaskBits';
import ScopeAdd from '../../components/ScopeAdd';
import { sortScope } from '../../lib/progress';
import AllocateModal from '../../components/AllocateModal';
import { Avatar, DateStepper, Empty, toast } from '../../components/ui';
import { Thumb } from '../../components/Photo';
import type { Task } from '../../types';
import { addDays, isMiddayBreakSeason, today } from '../../lib/util';

export default function Daily() {
  const { site } = useSiteCtx();
  const [date, setDate] = useState(today());
  const [edit, setEdit] = useState<Task | 'new' | { scopeItemId: string } | null>(null);
  const [allocate, setAllocate] = useState(false);
  const d = useStore(
    useShallow((s) => ({ tasks: s.tasks, scopeItems: s.scopeItems, people: s.people, allocations: s.allocations, logs: s.logs, photos: s.photos })),
  );
  const addScopeItems = useStore((s) => s.addScopeItems);
  const carryOver = useStore((s) => s.carryOver);
  const tasks = d.tasks.filter((t) => t.siteId === site.id && t.date === date);
  const order = { blocked: 0, 'in-progress': 1, planned: 2, done: 3 };
  const sorted = [...tasks].sort((a, b) => order[a.status] - order[b.status]);
  const items = new Map(d.scopeItems.map((w) => [w.id, w]));
  const onPlan = new Set(tasks.map((t) => t.scopeItemId).filter(Boolean));
  const pending = sortScope(d.scopeItems.filter((i) => i.siteId === site.id && !i.doneOn && !onPlan.has(i.id)));
  const crew = crewOn(d, site.id, date);
  const cb = crewBreakdown(crew);
  // unfinished work from yesterday that isn't on today's list yet
  const onToday = new Set(tasks.map((t) => `${t.scopeItemId}|${t.title}`));
  const prevOpen = d.tasks.filter((t) => t.siteId === site.id && t.date === addDays(date, -1) && t.status !== 'done' && !onToday.has(`${t.scopeItemId}|${t.title}`)).length;
  const photos = d.photos.filter((p) => p.siteId === site.id && p.date === date);

  return (
    <div className="daily">
      <div className="daily__bar">
        <DateStepper value={date} onChange={setDate} />
        <div className="page-head__actions">
          {prevOpen > 0 && (
            <button
              className="btn btn--sm"
              onClick={() => {
                const n = carryOver(site.id, addDays(date, -1), date);
                toast(n ? `${n} unfinished task${n > 1 ? 's' : ''} carried over` : 'Already carried over');
              }}
            >
              <CornerDownRight /> Carry over {prevOpen} from yesterday
            </button>
          )}
          <button className="btn btn--sm btn--primary" onClick={() => setEdit('new')}>
            <Plus /> Assign work
          </button>
        </div>
      </div>
      {isMiddayBreakSeason(date) && <p className="midday">Midday break applies today: no work under direct sun 12:30–15:00.</p>}

      <div className="daily__grid">
        <section className="stack">
          <div className="section-head">
            <h2 className="h2">Tasks</h2>
            <span className="muted small">
              {tasks.filter((t) => t.status === 'done').length} of {tasks.length} done
            </span>
          </div>
          {sorted.length ? (
            <div className="task-list">
              {sorted.map((t) => (
                <TaskCard key={t.id} task={t} item={t.scopeItemId ? items.get(t.scopeItemId) : undefined} people={d.people} onEdit={() => setEdit(t)} />
              ))}
            </div>
          ) : (
            <div className="card">
              <Empty
                icon={<ClipboardList />}
                title="No tasks for this day"
                action={
                  <button className="btn btn--primary" onClick={() => setEdit('new')}>
                    <Plus /> Assign work
                  </button>
                }
              >
                Pick pending work from the scope list on the right and assign it to the team. When a task is marked Done, it's ticked off the
                scope list.
              </Empty>
            </div>
          )}
        </section>

        <aside className="stack stack--lg">
          <section className="card">
            <div className="card__head">
              <div>
                <h2 className="h2">Pending work · {pending.length}</h2>
                <p className="muted small">From the scope list — assign it to the team for this day.</p>
              </div>
              <Link to="../scope" relative="path" className="btn btn--sm btn--ghost">
                Scope <ArrowRight />
              </Link>
            </div>
            {pending.length > 0 && (
              <ul className="pending-list">
                {pending.slice(0, 12).map((i) => (
                  <li key={i.id}>
                    <span className="grow">
                      {i.system && <span className={`sys sys--${i.system}`}>{i.system}</span>} {i.text}
                      {i.kind !== 'scope' && <span className={`kind kind--${i.kind}`}>{KIND_LABEL[i.kind]}</span>}
                    </span>
                    <button className="btn btn--sm" onClick={() => setEdit({ scopeItemId: i.id })}>
                      <UserPlus /> Assign
                    </button>
                  </li>
                ))}
                {pending.length > 12 && (
                  <li className="muted small">
                    <Link to="../scope" relative="path">{pending.length - 12} more on the scope list</Link>
                  </li>
                )}
              </ul>
            )}
            <div className="card__body">
              <ScopeAdd
                compact
                systems={site.systems}
                defaultKind="found"
                placeholder="Found more work on site? Type it here to add it to the list"
                onAdd={(list) => addScopeItems(site.id, list.map((x) => ({ ...x, addedOn: date })))}
              />
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <div>
                <h2 className="h2">Crew · {crew.length}</h2>
                <p className="muted small">
                  {cb.foreman} foreman · {cb.technician} technicians · {cb.helper} helpers
                </p>
              </div>
              <button className="btn btn--sm" onClick={() => setAllocate(true)}>
                <UserPlus /> Change
              </button>
            </div>
            <div className="card__body">
              {crew.length ? (
                <ul className="crew-list">
                  {crew.map((p) => {
                    const mine = tasks.filter((t) => t.assignees.includes(p.id));
                    return (
                      <li key={p.id}>
                        <Avatar p={p} />
                        <span className="grow">
                          <b>{p.name}</b>
                          <small className="muted">
                            {p.role[0].toUpperCase() + p.role.slice(1)} · {mine.length ? mine.map((t) => t.title).join(', ') : 'No task yet'}
                          </small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted small">No one is allocated to this site on this day.</p>
              )}
            </div>
          </section>

          <LogCard siteId={site.id} date={date} />

          <section className="card">
            <div className="card__head">
              <h2 className="h2">Photos · {photos.length}</h2>
              <Link to="../photos" relative="path" className="btn btn--sm">
                Add photos
              </Link>
            </div>
            {photos.length > 0 && (
              <div className="card__body photo-strip">
                {photos.slice(0, 8).map((p) => (
                  <Thumb key={p.id} id={p.id} alt={p.caption || 'Site photo'} />
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {edit && (
        <TaskModal
          site={site}
          date={date}
          task={edit === 'new' || !('id' in edit) ? undefined : edit}
          scopeItemId={edit !== 'new' && 'scopeItemId' in edit && !('id' in edit) ? edit.scopeItemId : undefined}
          crewIds={crew.map((p) => p.id)}
          onClose={() => setEdit(null)}
        />
      )}
      {allocate && <AllocateModal siteId={site.id} date={date} onClose={() => setAllocate(false)} />}
    </div>
  );
}

function LogCard({ siteId, date }: { siteId: string; date: string }) {
  const log = useStore((s) => s.logs.find((l) => l.siteId === siteId && l.date === date));
  const saveLog = useStore((s) => s.saveLog);
  const tasks = useStore((s) => s.tasks);
  const [f, setF] = useState({ summary: '', issues: '', inspections: '', nextPlan: '' });
  useEffect(() => {
    setF({ summary: log?.summary ?? '', issues: log?.issues ?? '', inspections: log?.inspections ?? '', nextPlan: log?.nextPlan ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, date, log?.id]);

  const draft = useMemo(
    () =>
      tasks
        .filter((t) => t.siteId === siteId && t.date === date && (t.status === 'done' || t.status === 'in-progress'))
        .map((t) => `${t.title}${t.location ? ` at ${t.location}` : ''}${t.status === 'done' ? ' — done' : ' — in progress'}`)
        .join('. '),
    [tasks, siteId, date],
  );

  const field = (k: keyof typeof f, label: string, placeholder: string, rows = 2) => (
    <label className="field">
      <span>{label}</span>
      <textarea
        className="textarea"
        rows={rows}
        value={f[k]}
        placeholder={placeholder}
        onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))}
        onBlur={() => saveLog(siteId, date, { [k]: f[k] })}
      />
    </label>
  );

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="h2">Daily log</h2>
        <span className="kbd-hint">Saves automatically</span>
      </div>
      <div className="card__body stack">
        {field('summary', 'Work summary', 'What was achieved today', 3)}
        {draft && !f.summary && (
          <button
            className="btn btn--sm btn--ghost"
            style={{ justifySelf: 'start', marginTop: -6 }}
            onClick={() => {
              setF((x) => ({ ...x, summary: draft + '.' }));
              saveLog(siteId, date, { summary: draft + '.' });
            }}
          >
            <Wand2 /> Fill from today's tasks
          </button>
        )}
        {field('issues', 'Issues & delays', 'Access, material, coordination problems')}
        {field('inspections', 'Inspections & visits', 'Consultant, Civil Defence, client visits')}
        {field('nextPlan', 'Plan for tomorrow', 'Next fronts, materials to bring')}
      </div>
    </section>
  );
}
