import { useState } from 'react';
import { ArrowDownLeft, CornerDownRight, Pencil, Phone, UserMinus, UserPlus, Users } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useSiteCtx } from './SiteLayout';
import { useStore } from '../../store/store';
import { crewBreakdown, crewOn, ROLE_LABEL } from '../../lib/notes';
import AllocateModal from '../../components/AllocateModal';
import { PersonModal } from '../../components/PersonModal';
import { Avatar, Confirm, DateStepper, Empty, toast } from '../../components/ui';
import type { Attendance, Person } from '../../types';
import { addDays, fmtDay, today } from '../../lib/util';

const ROLE_ORDER = { foreman: 0, technician: 1, helper: 2 };
const AWAY: Record<Exclude<Attendance, 'present'>, string> = {
  leave: 'On leave',
  absent: 'Absent',
  off: 'Day off',
};
const trade = (p: Person) => (p.trade === 'both' ? 'FA + FF' : p.trade === 'FA' ? 'Fire alarm' : 'Fire fighting');

/** Who works on this site, day by day — and the rest of the company team, ready to bring here. */
export default function SiteTeam() {
  const { site } = useSiteCtx();
  const [date, setDate] = useState(today());
  const d = useStore(
    useShallow((s) => ({
      people: s.people,
      allocations: s.allocations,
      sites: s.sites,
      tasks: s.tasks,
    })),
  );
  const setAllocation = useStore((s) => s.setAllocation);
  const deletePerson = useStore((s) => s.deletePerson);
  const [allocate, setAllocate] = useState(false);
  const [edit, setEdit] = useState<Person | 'new' | null>(null);
  const [remove, setRemove] = useState<Person | null>(null);

  const crew = crewOn(d, site.id, date);
  const cb = crewBreakdown(crew);
  const dayAlloc = new Map(d.allocations.filter((a) => a.date === date).map((a) => [a.personId, a]));
  const siteCode = new Map(d.sites.map((s) => [s.id, s.code]));
  const others = d.people.filter((p) => p.active && !crew.includes(p)).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name));
  const tasksFor = (p: Person) => d.tasks.filter((t) => t.siteId === site.id && t.date === date && t.assignees.includes(p.id));

  // yesterday's crew here who are still free today — one tap brings them back
  const yesterday = crewOn(d, site.id, addDays(date, -1)).filter(
    (p) => !dayAlloc.has(p.id) || (dayAlloc.get(p.id)!.attendance === 'present' && !dayAlloc.get(p.id)!.siteId),
  );
  const sameAsYesterday = () => {
    yesterday.forEach((p) => setAllocation(date, p.id, site.id, 'present'));
    toast(`${yesterday.length} brought back from yesterday`);
  };

  const status = (p: Person) => {
    const a = dayAlloc.get(p.id);
    if (a && a.attendance !== 'present') return { text: AWAY[a.attendance], away: true };
    if (a?.siteId)
      return {
        text: `At ${siteCode.get(a.siteId) ?? 'another site'}`,
        away: false,
        elsewhere: true,
      };
    return { text: 'Free', away: false };
  };

  return (
    <div className="stack stack--lg">
      <div className="daily__bar">
        <DateStepper value={date} onChange={setDate} />
        <div className="page-head__actions">
          {yesterday.length > 0 && (
            <button className="btn btn--sm" onClick={sameAsYesterday}>
              <CornerDownRight /> Same crew as yesterday ({yesterday.length})
            </button>
          )}
          <button className="btn btn--sm" onClick={() => setEdit('new')}>
            <UserPlus /> New person
          </button>
          <button className="btn btn--sm btn--primary" onClick={() => setAllocate(true)} disabled={!d.people.length}>
            <Users /> Choose crew
          </button>
        </div>
      </div>

      <div className="team-grid">
        <section className="card">
          <div className="card__head">
            <div>
              <span className="label">{fmtDay(date)}</span>
              <h2 className="h2">On this site · {crew.length}</h2>
              {crew.length > 0 && (
                <p className="muted small">
                  {cb.foreman} foreman · {cb.technician} technician
                  {cb.technician === 1 ? '' : 's'} · {cb.helper} helper
                  {cb.helper === 1 ? '' : 's'}
                </p>
              )}
            </div>
          </div>
          {crew.length ? (
            <ul className="crew-list team-list">
              {crew.map((p) => {
                const mine = tasksFor(p);
                return (
                  <li key={p.id}>
                    <Avatar p={p} />
                    <span className="grow">
                      <b>{p.name}</b>
                      <small className="muted">
                        {ROLE_LABEL[p.role]} · {trade(p)} · {mine.length ? mine.map((t) => t.title).join(', ') : 'No task yet'}
                      </small>
                    </span>
                    <span className="team-acts">
                      <PersonActions p={p} onEdit={() => setEdit(p)} />
                      <button
                        className="icon-btn icon-btn--sm"
                        title="Take off this site for the day"
                        aria-label={`Take ${p.name} off this site`}
                        onClick={() => {
                          setAllocation(date, p.id, null, 'present');
                          toast(`${p.name} taken off ${site.code} for ${fmtDay(date)}`);
                        }}
                      >
                        <UserMinus />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty
              icon={<Users />}
              title="Nobody on this site yet"
              action={
                d.people.length ? (
                  <button className="btn btn--primary" onClick={() => setAllocate(true)}>
                    <Users /> Choose crew
                  </button>
                ) : (
                  <button className="btn btn--primary" onClick={() => setEdit('new')}>
                    <UserPlus /> Add your first person
                  </button>
                )
              }
            >
              {d.people.length
                ? `Pick the foremen, technicians and helpers working here on ${fmtDay(date)}.`
                : 'Add your foremen, technicians and helpers. Anyone you add here is placed on this site for the day.'}
            </Empty>
          )}
        </section>

        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="h2">Rest of the team · {others.length}</h2>
              <p className="muted small">Bring someone here for {fmtDay(date)}. If they're at another site that day, they move here.</p>
            </div>
          </div>
          {others.length ? (
            <ul className="crew-list team-list">
              {others.map((p) => {
                const st = status(p);
                const a = dayAlloc.get(p.id);
                return (
                  <li key={p.id} className={st.away ? 'is-away' : ''}>
                    <Avatar p={p} />
                    <span className="grow">
                      <b>{p.name}</b>
                      <small className="muted">
                        {ROLE_LABEL[p.role]} · {trade(p)}
                      </small>
                    </span>
                    <span className="team-acts">
                      {st.elsewhere ? (
                        <span className="team-where mono">{st.text}</span>
                      ) : (
                        <select
                          className="select input--sm team-att"
                          value={a && a.attendance !== 'present' ? a.attendance : 'present'}
                          onChange={(e) => setAllocation(date, p.id, null, e.target.value as Attendance)}
                          aria-label={`${p.name} on ${fmtDay(date)}`}
                        >
                          <option value="present">Free</option>
                          <option value="leave">On leave</option>
                          <option value="absent">Absent</option>
                          <option value="off">Day off</option>
                        </select>
                      )}
                      <PersonActions p={p} onEdit={() => setEdit(p)} />
                      <button
                        className="btn btn--sm"
                        onClick={() => {
                          setAllocation(date, p.id, site.id, 'present');
                          toast(`${p.name} is on ${site.code} for ${fmtDay(date)}`);
                        }}
                      >
                        <ArrowDownLeft /> Bring here
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="card__body muted small">{d.people.length ? 'Everyone is on this site.' : 'No team yet — use “New person” to add someone.'}</p>
          )}
        </section>
      </div>

      {allocate && <AllocateModal siteId={site.id} date={date} onClose={() => setAllocate(false)} />}
      {edit && (
        <PersonModal
          person={edit === 'new' ? undefined : edit}
          onClose={() => setEdit(null)}
          onSaved={(id) => {
            if (edit === 'new') {
              setAllocation(date, id, site.id, 'present');
              toast(`Added and placed on ${site.code} for ${fmtDay(date)}`);
            } else toast('Saved');
          }}
          onDelete={edit === 'new' ? undefined : () => (setRemove(edit), setEdit(null))}
        />
      )}
      {remove && (
        <Confirm
          title={`Remove ${remove.name} from the team?`}
          body="They'll be taken off every site and task. Reports already sent aren't affected."
          action="Remove person"
          onClose={() => setRemove(null)}
          onConfirm={() => {
            deletePerson(remove.id);
            toast(`${remove.name} removed`);
          }}
        />
      )}
    </div>
  );
}

function PersonActions({ p, onEdit }: { p: Person; onEdit: () => void }) {
  return (
    <>
      {p.phone && (
        <a className="icon-btn icon-btn--sm" href={`tel:${p.phone.replace(/\s/g, '')}`} aria-label={`Call ${p.name}`} title={`Call ${p.phone}`}>
          <Phone />
        </a>
      )}
      <button className="icon-btn icon-btn--sm" aria-label={`Edit ${p.name}`} title="Edit details or crew PIN" onClick={onEdit}>
        <Pencil />
      </button>
    </>
  );
}
