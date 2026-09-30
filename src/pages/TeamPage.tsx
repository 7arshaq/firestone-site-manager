import { useMemo, useState } from 'react';
import { Pencil, Phone, Plus, Search, Trash2, Users } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store/store';
import { Avatar, Confirm, Empty, Modal, Seg, toast } from '../components/ui';
import type { Person, Role, Trade } from '../types';
import { ROLE_LABEL } from '../lib/notes';
import { addDays, fmtDay, today } from '../lib/util';

type Filter = 'all' | Role;

export default function TeamPage() {
  const d = useStore(useShallow((s) => ({ people: s.people, allocations: s.allocations, sites: s.sites, tasks: s.tasks })));
  const deletePerson = useStore((s) => s.deletePerson);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Person | 'new' | null>(null);
  const [remove, setRemove] = useState<Person | null>(null);
  const t = today();
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(t, i - 13)), [t]);
  const byKey = useMemo(() => new Map(d.allocations.map((a) => [`${a.personId}|${a.date}`, a])), [d.allocations]);
  const siteCode = new Map(d.sites.map((s) => [s.id, s.code]));
  const siteIdx = new Map(d.sites.map((s, i) => [s.id, i]));

  const list = d.people
    .filter((p) => (filter === 'all' || p.role === filter) && (!q || `${p.name} ${p.empNo} ${p.phone}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => ({ foreman: 0, technician: 1, helper: 2 })[a.role] - ({ foreman: 0, technician: 1, helper: 2 })[b.role] || a.name.localeCompare(b.name));
  const count = (r: Role) => d.people.filter((p) => p.role === r).length;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__title">
          <span className="label">{d.people.length} people</span>
          <h1 className="h1">Team</h1>
        </div>
        <div className="page-head__actions">
          <button className="btn btn--primary" onClick={() => setEdit('new')}>
            <Plus /> Add person
          </button>
        </div>
      </div>

      <div className="daily__bar">
        <Seg
          label="Filter by role"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: d.people.length },
            { value: 'foreman', label: 'Foremen', count: count('foreman') },
            { value: 'technician', label: 'Technicians', count: count('technician') },
            { value: 'helper', label: 'Helpers', count: count('helper') },
          ]}
        />
        <div className="home__search" style={{ minWidth: 240 }}>
          <Search aria-hidden />
          <input className="input" placeholder="Search name, emp. no." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search team" />
        </div>
      </div>

      <section className="card">
        {list.length ? (
          <div className="table-wrap">
            <table className="table team-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Trade</th>
                  <th>Today</th>
                  <th>
                    Last 14 days <span className="legend-inline"><i className="att att--on" /> site <i className="att att--leave" /> leave <i className="att att--absent" /> absent</span>
                  </th>
                  <th className="r">Tasks</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const a = byKey.get(`${p.id}|${t}`);
                  const tasks = d.tasks.filter((x) => x.assignees.includes(p.id) && x.date >= days[0]).length;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="row">
                          <Avatar p={p} />
                          <span>
                            <b className="block">{p.name}</b>
                            <small className="muted">
                              {ROLE_LABEL[p.role]} · {p.empNo || 'no emp. no.'}
                              {p.pin && ' · crew PIN set'}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="row" style={{ gap: 4 }}>
                          {(p.trade === 'both' ? ['FA', 'FF'] : [p.trade]).map((x) => (
                            <span key={x} className={`sys sys--${x}`}>{x}</span>
                          ))}
                        </span>
                      </td>
                      <td className="nowrap">
                        {a?.attendance === 'present' && a.siteId ? (
                          <span className="mono small">{siteCode.get(a.siteId)}</span>
                        ) : a && a.attendance !== 'present' ? (
                          <span className="pill">{a.attendance === 'leave' ? 'On leave' : a.attendance === 'absent' ? 'Absent' : 'Off'}</span>
                        ) : (
                          <span className="muted small">Not allocated</span>
                        )}
                      </td>
                      <td>
                        <div className="att-strip" aria-label="Attendance over the last 14 days">
                          {days.map((day) => {
                            const x = byKey.get(`${p.id}|${day}`);
                            const cls = !x ? 'none' : x.attendance === 'present' && x.siteId ? 'on' : x.attendance === 'leave' ? 'leave' : x.attendance === 'absent' ? 'absent' : 'none';
                            return (
                              <i
                                key={day}
                                className={`att att--${cls}`}
                                style={x?.siteId ? { ['--shade' as string]: `${55 + ((siteIdx.get(x.siteId) ?? 0) % 4) * 12}%` } : undefined}
                                title={`${fmtDay(day)}: ${x?.siteId ? siteCode.get(x.siteId) : x ? x.attendance : 'no record'}`}
                              />
                            );
                          })}
                        </div>
                      </td>
                      <td className="r">{tasks}</td>
                      <td className="nowrap">
                        {p.phone && (
                          <a className="icon-btn icon-btn--sm" href={`tel:${p.phone.replace(/\s/g, '')}`} aria-label={`Call ${p.name}`}>
                            <Phone />
                          </a>
                        )}
                        <button className="icon-btn icon-btn--sm" aria-label={`Edit ${p.name}`} onClick={() => setEdit(p)}>
                          <Pencil />
                        </button>
                        <button className="icon-btn icon-btn--sm" aria-label={`Remove ${p.name}`} onClick={() => setRemove(p)}>
                          <Trash2 />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<Users />} title={q ? 'Nobody matches that search' : 'No one here yet'} action={<button className="btn btn--primary" onClick={() => setEdit('new')}><Plus /> Add person</button>}>
            Add foremen, technicians and helpers so you can allocate them to sites and tasks.
          </Empty>
        )}
      </section>

      {edit && <PersonModal person={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {remove && (
        <Confirm
          title={`Remove ${remove.name}?`}
          body="They'll be taken off every allocation and task. Past reports that were already sent aren't affected."
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

export function PersonModal({ person, onClose }: { person?: Person; onClose: () => void }) {
  const save = useStore((s) => s.savePerson);
  const [f, setF] = useState<Omit<Person, 'id'> & { id?: string }>(
    person ?? { name: '', role: 'technician', trade: 'FA', phone: '', empNo: '', pin: '', active: true },
  );
  const submit = () => {
    if (!f.name.trim()) return toast('Enter a name');
    if (f.pin && !/^\d{4}$/.test(f.pin)) return toast('The crew PIN must be 4 digits');
    save(f);
    toast(person ? 'Saved' : `${f.name} added`);
    onClose();
  };
  return (
    <Modal
      title={person ? `Edit ${person.name}` : 'Add person'}
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={submit}>{person ? 'Save' : 'Add person'}</button>
        </>
      }
    >
      <div className="form-grid form-grid--2">
        <label className="field span-all">
          <span>Full name</span>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="field">
          <span>Role</span>
          <select className="select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            <option value="foreman">Foreman</option>
            <option value="technician">Technician</option>
            <option value="helper">Helper</option>
          </select>
        </label>
        <label className="field">
          <span>Trade</span>
          <select className="select" value={f.trade} onChange={(e) => setF({ ...f, trade: e.target.value as Trade })}>
            <option value="FA">Fire alarm</option>
            <option value="FF">Fire fighting</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label className="field">
          <span>Mobile</span>
          <input className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="05X XXX XXXX" />
        </label>
        <label className="field">
          <span>Employee no.</span>
          <input className="input" value={f.empNo} onChange={(e) => setF({ ...f, empNo: e.target.value })} />
        </label>
        <label className="field span-all">
          <span>Crew mode PIN</span>
          <input className="input mono" inputMode="numeric" maxLength={4} value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '') })} placeholder="4 digits — leave empty if they won't use this device" />
          <small>Lets them open their own task list in Crew mode on a shared site phone or tablet.</small>
        </label>
      </div>
    </Modal>
  );
}
