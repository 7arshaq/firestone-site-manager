import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Copy, MessageSquareText, UserPlus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { getData, useStore } from '../store/store';
import { useSummaries } from '../store/hooks';
import { allSitesNote, allocationNote } from '../lib/notes';
import AllocateModal from '../components/AllocateModal';
import { ShareText } from '../components/ShareText';
import { Avatar, Bar, DateStepper, Modal, toast } from '../components/ui';
import type { Attendance, Person } from '../types';
import { addDays, firstName, fmtDay, today } from '../lib/util';

const ATT_LABEL: Record<Exclude<Attendance, 'present'>, string> = { leave: 'On leave', absent: 'Absent', off: 'Day off' };
const ROLE_ORDER = { foreman: 0, technician: 1, helper: 2 };

export default function TodayPage() {
  const [date, setDate] = useState(today());
  const summaries = useSummaries(date);
  const d = useStore(useShallow((s) => ({ people: s.people, allocations: s.allocations })));
  const setAllocation = useStore((s) => s.setAllocation);
  const copyAllocations = useStore((s) => s.copyAllocations);
  const [allocFor, setAllocFor] = useState<string | null>(null);
  const [moving, setMoving] = useState<Person | null>(null);
  const [share, setShare] = useState<'alloc' | 'summary' | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const alloc = useMemo(() => new Map(d.allocations.filter((a) => a.date === date).map((a) => [a.personId, a])), [d.allocations, date]);
  const people = d.people.filter((p) => p.active).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name));
  const cols = summaries
    .filter((s) => s.site.status === 'active' || s.site.status === 'snagging' || people.some((p) => alloc.get(p.id)?.siteId === s.site.id))
    .sort((a, b) => a.site.code.localeCompare(b.site.code));
  const onSite = (siteId: string) => people.filter((p) => alloc.get(p.id)?.siteId === siteId && alloc.get(p.id)?.attendance === 'present');
  const free = people.filter((p) => !alloc.get(p.id) || (alloc.get(p.id)!.attendance === 'present' && !alloc.get(p.id)!.siteId));
  const away = people.filter((p) => alloc.get(p.id) && alloc.get(p.id)!.attendance !== 'present');
  const total = people.length - free.length - away.length;
  const prevCount = d.allocations.filter((a) => a.date === addDays(date, -1)).length;

  const drop = (siteId: string | null, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const pid = e.dataTransfer.getData('text/person');
    if (pid) setAllocation(date, pid, siteId, 'present');
  };

  const chip = (p: Person) => (
    <button
      key={p.id}
      className="board-chip"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/person', p.id)}
      onClick={() => setMoving(p)}
      title={`${p.name} — tap to move`}
    >
      <Avatar p={p} size={24} />
      <span className="grow truncate">{p.name}</span>
      <span className="board-chip__trade mono">{p.trade === 'both' ? 'FA·FF' : p.trade}</span>
    </button>
  );

  return (
    <div className="page page--full">
      <div className="page-head">
        <div className="page-head__title">
          <span className="label">Manpower & tasks</span>
          <h1 className="h1">Today's board</h1>
          <p className="muted">
            <b className="mono">{total}</b> on site · <b className="mono">{free.length}</b> not allocated · <b className="mono">{away.length}</b> away
          </p>
        </div>
        <div className="page-head__actions">
          <DateStepper value={date} onChange={setDate} />
          <button
            className="btn"
            disabled={!prevCount}
            onClick={() => {
              const n = copyAllocations(addDays(date, -1), date);
              toast(`Copied ${n} allocations from ${fmtDay(addDays(date, -1))}`);
            }}
          >
            <Copy /> Copy previous day
          </button>
          <button className="btn" onClick={() => setShare('alloc')}>
            <MessageSquareText /> Share allocation
          </button>
          <button className="btn btn--primary" onClick={() => setShare('summary')}>
            <MessageSquareText /> Sites summary
          </button>
        </div>
      </div>

      <div className="board">
        {cols.map((s) => {
          const crew = onSite(s.site.id);
          return (
            <section
              key={s.site.id}
              className={`board-col ${dragOver === s.site.id ? 'is-over' : ''}`}
              onDragOver={(e) => (e.preventDefault(), setDragOver(s.site.id))}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => drop(s.site.id, e)}
            >
              <header className="board-col__head">
                <div className="row row--between">
                  <span className="label">{s.site.code} · {s.ref}</span>
                  <span className="board-col__count mono">{crew.length}</span>
                </div>
                <Link to={`/sites/${s.site.id}/daily`} className="board-col__name">{s.site.name}</Link>
                <div className="row" style={{ gap: 8 }}>
                  <Bar value={s.progress.overall} thin label="Overall progress" />
                  <span className="mono small">{Math.round(s.progress.overall * 100)}%</span>
                </div>
              </header>
              <div className="board-col__body">
                {crew.map(chip)}
                {!crew.length && <p className="board-col__empty">Drop people here or tap Add</p>}
              </div>
              <footer className="board-col__foot">
                <button className="btn btn--sm btn--ghost" onClick={() => setAllocFor(s.site.id)}>
                  <UserPlus /> Add
                </button>
                <Link to={`/sites/${s.site.id}/daily`} className="board-col__tasks">
                  {s.tasksToday} task{s.tasksToday === 1 ? '' : 's'}
                  {s.blocked > 0 && (
                    <span className="pill pill--flame">
                      <AlertTriangle /> {s.blocked}
                    </span>
                  )}
                  <ArrowRight />
                </Link>
              </footer>
            </section>
          );
        })}

        <section
          className={`board-col board-col--free ${dragOver === 'free' ? 'is-over' : ''}`}
          onDragOver={(e) => (e.preventDefault(), setDragOver('free'))}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => drop(null, e)}
        >
          <header className="board-col__head">
            <div className="row row--between">
              <span className="label">Not allocated</span>
              <span className="board-col__count mono">{free.length}</span>
            </div>
          </header>
          <div className="board-col__body">
            {free.map(chip)}
            {!free.length && <p className="board-col__empty">Everyone has a site</p>}
          </div>
          {away.length > 0 && (
            <>
              <div className="board-col__sub label">Away</div>
              <div className="board-col__body">
                {away.map((p) => (
                  <button key={p.id} className="board-chip board-chip--away" onClick={() => setMoving(p)}>
                    <Avatar p={p} size={24} />
                    <span className="grow truncate">{p.name}</span>
                    <span className="small muted">{ATT_LABEL[alloc.get(p.id)!.attendance as Exclude<Attendance, 'present'>]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {moving && (
        <Modal title={`Move ${firstName(moving.name)}`} eyebrow={fmtDay(date)} size="narrow" onClose={() => setMoving(null)}>
          <div className="move-list">
            {cols.map((s) => {
              const here = alloc.get(moving.id)?.siteId === s.site.id && alloc.get(moving.id)?.attendance === 'present';
              return (
                <button
                  key={s.site.id}
                  className={here ? 'is-on' : ''}
                  onClick={() => {
                    setAllocation(date, moving.id, s.site.id, 'present');
                    setMoving(null);
                  }}
                >
                  <span className="mono">{s.site.code}</span>
                  <span className="grow">{s.site.name}</span>
                  <span className="muted small">{onSite(s.site.id).length}</span>
                </button>
              );
            })}
            <div className="move-list__sep" />
            <button onClick={() => (setAllocation(date, moving.id, null, 'present'), setMoving(null))}>
              <span className="grow">Not allocated</span>
            </button>
            {(Object.keys(ATT_LABEL) as Exclude<Attendance, 'present'>[]).map((a) => (
              <button key={a} onClick={() => (setAllocation(date, moving.id, null, a), setMoving(null))}>
                <span className="grow">{ATT_LABEL[a]}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {allocFor && <AllocateModal siteId={allocFor} date={date} onClose={() => setAllocFor(null)} />}
      {share && (
        <ShareText
          title={share === 'alloc' ? 'Manpower allocation' : 'Sites summary'}
          eyebrow={fmtDay(date)}
          initial={share === 'alloc' ? allocationNote(getData(), date) : allSitesNote(getData(), date)}
          onClose={() => setShare(null)}
        />
      )}
    </div>
  );
}
