import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '../store/store';
import { Modal, toast } from './ui';
import type { Person, Role, Trade } from '../types';

/** Add or edit a team member. `onSaved` gets the person's id (handy for placing a new person on a site straight away). */
export function PersonModal({ person, onClose, onSaved, onDelete }: { person?: Person; onClose: () => void; onSaved?: (id: string) => void; onDelete?: () => void }) {
  const save = useStore((s) => s.savePerson);
  const [f, setF] = useState<Omit<Person, 'id'> & { id?: string }>(
    person ?? { name: '', role: 'technician', trade: 'FA', phone: '', empNo: '', pin: '', active: true },
  );
  const submit = () => {
    if (!f.name.trim()) return toast('Enter a name');
    if (f.pin && !/^\d{4}$/.test(f.pin)) return toast('The crew PIN must be 4 digits');
    const id = save(f);
    onClose();
    if (onSaved) onSaved(id);
    else toast(person ? 'Saved' : `${f.name} added`);
  };
  return (
    <Modal
      title={person ? `Edit ${person.name}` : 'Add person'}
      size="narrow"
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <button className="btn btn--ghost btn--danger" style={{ marginRight: 'auto' }} onClick={onDelete}>
              <Trash2 /> Remove from team
            </button>
          )}
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
