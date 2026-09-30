import { useShallow } from 'zustand/react/shallow';
import type { Role } from '../types';
import { useStore } from '../store/store';
import { Modal } from './ui';
import { PersonToggle } from './TaskBits';
import { fmtDay } from '../lib/util';

const ROLES: { role: Role; label: string }[] = [
  { role: 'foreman', label: 'Foremen' },
  { role: 'technician', label: 'Technicians' },
  { role: 'helper', label: 'Helpers' },
];

/** Choose who works on one site on one day. Picking someone moves them off any other site that day. */
export default function AllocateModal({ siteId, date, onClose }: { siteId: string; date: string; onClose: () => void }) {
  const d = useStore(useShallow((s) => ({ people: s.people, allocations: s.allocations, sites: s.sites })));
  const setAllocation = useStore((s) => s.setAllocation);
  const site = d.sites.find((s) => s.id === siteId)!;
  const today = new Map(d.allocations.filter((a) => a.date === date).map((a) => [a.personId, a]));
  const count = d.allocations.filter((a) => a.date === date && a.siteId === siteId && a.attendance === 'present').length;

  return (
    <Modal
      title={`Crew for ${site.code}`}
      eyebrow={fmtDay(date)}
      onClose={onClose}
      footer={
        <>
          <span className="muted small grow">{count} on this site</span>
          <button className="btn btn--primary" onClick={onClose}>Done</button>
        </>
      }
    >
      <div className="stack stack--lg">
        {ROLES.map(({ role, label }) => {
          const list = d.people.filter((p) => p.active && p.role === role);
          if (!list.length) return null;
          return (
            <div key={role} className="stack" style={{ gap: 8 }}>
              <span className="label">{label}</span>
              <div className="pick-people__list pick-people__list--cols">
                {list.map((p) => {
                  const a = today.get(p.id);
                  const on = a?.siteId === siteId && a.attendance === 'present';
                  const elsewhere = a?.siteId && a.siteId !== siteId ? d.sites.find((s) => s.id === a.siteId)?.code : null;
                  const hint = a && a.attendance !== 'present' ? (a.attendance === 'leave' ? 'On leave' : a.attendance === 'absent' ? 'Absent' : 'Day off') : elsewhere ? `At ${elsewhere} — tap to move here` : p.trade === 'both' ? 'FA + FF' : p.trade;
                  return (
                    <PersonToggle
                      key={p.id}
                      p={p}
                      on={on}
                      hint={hint}
                      onClick={() => setAllocation(date, p.id, on ? null : siteId, 'present')}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
