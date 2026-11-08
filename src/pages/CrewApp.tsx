import { useState } from 'react';
import { ArrowLeft, Delete, LogOut, MessageSquareWarning, UserRound } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useSession, useStore } from '../store/store';
import { TaskCard } from '../components/TaskBits';
import { PhotoButtons } from './site/Photos';
import { Avatar, Empty, Modal, toast } from '../components/ui';
import { Logo, ThemeToggle } from '../components/Brand';
import type { Person } from '../types';
import { ROLE_LABEL } from '../lib/notes';
import { firstName, fmtDay, today } from '../lib/util';

export default function CrewApp() {
  const { crewId, setCrew, exitCrew } = useSession();
  const d = useStore(useShallow((s) => ({ people: s.people, settings: s.settings })));
  const me = d.people.find((p) => p.id === crewId);
  const [pinFor, setPinFor] = useState<Person | 'engineer' | null>(null);

  const leave = () => (d.settings.engineerPin ? setPinFor('engineer') : exitCrew());

  return (
    <div className="crew">
      <header className="crew__bar">
        <div className="crew__id">
          <Logo className="crew__mark" />
          <div className="crew__titles">
            <b className="crew__brand">Crew mode</b>
            <span className="label">{fmtDay(today())}</span>
          </div>
        </div>
        <div className="crew__actions">
          <ThemeToggle />
          {me && (
            <button className="btn btn--sm" onClick={() => setCrew(null)} aria-label="Switch person">
              <UserRound /> <span className="crew__btn-text">Switch person</span>
            </button>
          )}
          <button className="btn btn--sm btn--ghost" onClick={leave} aria-label="Back to engineer view">
            <LogOut /> <span className="crew__btn-text">Engineer view</span>
          </button>
        </div>
      </header>

      {me ? <MyDay me={me} /> : <WhoAreYou onPick={(p) => (p.pin ? setPinFor(p) : toast('Ask the engineer to set a crew PIN for you'))} />}

      {pinFor && (
        <PinPad
          title={pinFor === 'engineer' ? 'Engineer PIN' : `Hi ${firstName(pinFor.name)}`}
          expected={pinFor === 'engineer' ? d.settings.engineerPin : pinFor.pin}
          onClose={() => setPinFor(null)}
          onOk={() => {
            if (pinFor === 'engineer') exitCrew();
            else setCrew(pinFor.id);
            setPinFor(null);
          }}
        />
      )}
    </div>
  );
}

function WhoAreYou({ onPick }: { onPick: (p: Person) => void }) {
  const allPeople = useStore((s) => s.people);
  const people = allPeople.filter((p) => p.active);
  const withPin = people.filter((p) => p.pin);
  return (
    <main className="crew__main">
      <h1 className="h1">Who's using this phone?</h1>
      <p className="muted">Tap your name and enter your 4-digit PIN.</p>
      {withPin.length ? (
        <div className="crew__people">
          {withPin.map((p) => (
            <button key={p.id} className="crew__person" onClick={() => onPick(p)}>
              <Avatar p={p} size={40} />
              <span>
                <b>{p.name}</b>
                <small>{ROLE_LABEL[p.role]}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty title="No one has a crew PIN yet">The engineer can set PINs in any site’s Team tab (edit a person → Crew mode PIN).</Empty>
      )}
    </main>
  );
}

function MyDay({ me }: { me: Person }) {
  const t = today();
  const d = useStore(useShallow((s) => ({ tasks: s.tasks, workItems: s.workItems, people: s.people, allocations: s.allocations, sites: s.sites, logs: s.logs })));
  const saveLog = useStore((s) => s.saveLog);
  const [issue, setIssue] = useState<string | null>(null);
  const alloc = d.allocations.find((a) => a.date === t && a.personId === me.id && a.attendance === 'present');
  const site = d.sites.find((s) => s.id === alloc?.siteId);
  const items = new Map(d.workItems.map((w) => [w.id, w]));
  const mine = d.tasks.filter((x) => x.date === t && (x.assignees.includes(me.id) || (me.role === 'foreman' && x.siteId === site?.id)));
  const done = mine.filter((x) => x.status === 'done').length;

  return (
    <main className="crew__main">
      <div className="crew__hello">
        <Avatar p={me} size={44} />
        <div>
          <h1 className="h1">{firstName(me.name)}'s day</h1>
          <p className="muted">
            {site ? (
              <>
                <b className="mono">{site.code}</b> · {site.name}
              </>
            ) : (
              'Not allocated to a site today'
            )}
          </p>
        </div>
      </div>

      <div className="today-counts" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div><b className="mono">{mine.length}</b><span>tasks</span></div>
        <div><b className="mono">{done}</b><span>done</span></div>
        <div><b className="mono">{mine.length - done}</b><span>to go</span></div>
      </div>

      {mine.length ? (
        <div className="task-list">
          {mine.map((x) => (
            <TaskCard key={x.id} task={{ ...x }} item={x.workItemId ? items.get(x.workItemId) : undefined} people={d.people} />
          ))}
        </div>
      ) : (
        <Empty title="No tasks for you today">Check with the engineer, or ask them to add tasks for you on their device.</Empty>
      )}

      {site && (
        <section className="card crew__tools">
          <div className="card__body stack">
            <h2 className="h2">Site photos & problems</h2>
            <PhotoButtons siteId={site.id} date={t} extra={{ caption: `By ${firstName(me.name)}` }} />
            <button className="btn btn--lg" onClick={() => setIssue('')}>
              <MessageSquareWarning /> Report a problem
            </button>
          </div>
        </section>
      )}

      {issue !== null && site && (
        <Modal
          title="Report a problem"
          eyebrow={site.code}
          onClose={() => setIssue(null)}
          footer={
            <>
              <button className="btn" onClick={() => setIssue(null)}>Cancel</button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  if (!issue.trim()) return toast('Describe the problem first');
                  const log = d.logs.find((l) => l.siteId === site.id && l.date === t);
                  const line = `${firstName(me.name)}: ${issue.trim()}`;
                  saveLog(site.id, t, { issues: log?.issues ? `${log.issues}\n${line}` : line });
                  toast('Sent to the engineer’s daily log');
                  setIssue(null);
                }}
              >
                Add to daily log
              </button>
            </>
          }
        >
          <textarea className="textarea" rows={4} value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="e.g. No access to L17 corridor — ceiling closed" autoFocus />
        </Modal>
      )}
    </main>
  );
}

function PinPad({ title, expected, onOk, onClose }: { title: string; expected: string; onOk: () => void; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const press = (k: string) => {
    const next = (pin + k).slice(0, 4);
    setPin(next);
    setWrong(false);
    if (next.length === 4) {
      if (next === expected) onOk();
      else {
        setWrong(true);
        setTimeout(() => setPin(''), 350);
      }
    }
  };
  return (
    <Modal title={title} eyebrow="Enter PIN" size="narrow" onClose={onClose}>
      <div className="pinpad">
        <div className={`pinpad__dots ${wrong ? 'is-wrong' : ''}`} aria-live="polite" aria-label={wrong ? 'Wrong PIN, try again' : `${pin.length} of 4 digits`}>
          {[0, 1, 2, 3].map((i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}
        </div>
        {wrong && <p className="pinpad__msg">That PIN doesn't match. Try again.</p>}
        <div className="pinpad__keys">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
            <button key={k} onClick={() => press(k)}>{k}</button>
          ))}
          <button onClick={onClose} aria-label="Cancel"><ArrowLeft /></button>
          <button onClick={() => press('0')}>0</button>
          <button onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete digit"><Delete /></button>
        </div>
      </div>
    </Modal>
  );
}
