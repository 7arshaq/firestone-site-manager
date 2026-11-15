import { useMemo } from 'react';
import { AlertTriangle, Camera, Check, ListChecks, Lock } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store/store';
import { useAuth, sameName, type Account } from '../data/accounts';
import { PhotoButtons } from './site/Photos';
import { Thumb } from '../components/Photo';
import { Logo, ThemeToggle } from '../components/Brand';
import { Empty } from '../components/ui';
import type { Task } from '../types';
import { fmtDay, today } from '../lib/util';

/** A technician's view: only today's tasks, ticked off like a checklist, and the day's photos */
export default function TechApp({ account }: { account: Account }) {
  const signOut = useAuth((s) => s.signOut);
  const updateTask = useStore((s) => s.updateTask);
  const t = today();
  const d = useStore(useShallow((s) => ({ tasks: s.tasks, people: s.people, allocations: s.allocations, sites: s.sites, photos: s.photos })));
  const me = d.people.find((p) => sameName(p.name, account.name));

  const mine = useMemo(() => {
    const list = me ? d.tasks.filter((x) => x.date === t && x.assignees.includes(me.id)) : [];
    return [...list].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'));
  }, [d.tasks, me, t]);
  const alloc = me ? d.allocations.find((a) => a.date === t && a.personId === me.id && a.attendance === 'present' && a.siteId) : undefined;
  const siteId = alloc?.siteId ?? mine[0]?.siteId ?? null;
  const site = d.sites.find((s) => s.id === siteId);
  const done = mine.filter((x) => x.status === 'done').length;
  const manySites = new Set(mine.map((x) => x.siteId)).size > 1;
  const code = new Map(d.sites.map((s) => [s.id, s.code]));
  const photos = d.photos.filter((p) => p.siteId === siteId && p.date === t).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const toggle = (task: Task) => updateTask(task.id, { status: task.status === 'done' ? 'in-progress' : 'done', updatedBy: account.name });

  return (
    <div className="tech">
      <header className="tech__bar">
        <div className="tech__id">
          <span className="tech__brand" data-brand-target>
            <Logo className="tech__mark" />
          </span>
          <span className="tech__titles">
            <b>{account.name}</b>
            <span className="label">{fmtDay(t)}</span>
          </span>
        </div>
        <div className="tech__actions">
          <ThemeToggle />
          <button className="btn btn--sm" onClick={signOut} aria-label="Lock">
            <Lock /> <span className="tech__btn-text">Lock</span>
          </button>
        </div>
      </header>

      <main className="tech__main">
        <section className="tech__hello">
          <div className="grow">
            <h1 className="h1">My day</h1>
            <p className="muted">
              {site ? (
                <>
                  <b className="mono">{site.code}</b> · {site.name}
                </>
              ) : (
                'Not on a site today'
              )}
            </p>
          </div>
          {mine.length > 0 && (
            <div className="tech__count" aria-label={`${done} of ${mine.length} tasks done`}>
              <b className="display">
                {done}
                <small>/{mine.length}</small>
              </b>
              <span className="label">done</span>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card__head">
            <h2 className="h2">Today's tasks</h2>
            {mine.length > 0 && done === mine.length && <span className="tech__all">All done — well done</span>}
          </div>
          {mine.length ? (
            <ul className="tech-tasks">
              {mine.map((task) => (
                <li key={task.id} className={task.status === 'done' ? 'is-done' : ''}>
                  <label>
                    <input type="checkbox" checked={task.status === 'done'} onChange={() => toggle(task)} />
                    <span className="tech-tasks__box" aria-hidden>
                      <Check />
                    </span>
                    <span className="grow">
                      <span className="tech-tasks__title">{task.title}</span>
                      {(task.location || manySites || task.status === 'blocked') && (
                        <small>
                          {[task.location, manySites ? code.get(task.siteId) : ''].filter(Boolean).join(' · ')}
                          {task.status === 'blocked' && (
                            <span className="tech-tasks__hold">
                              <AlertTriangle aria-hidden /> On hold{task.blockReason ? ` — ${task.blockReason}` : ''}
                            </span>
                          )}
                        </small>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={<ListChecks />} title="No tasks for you today">
              {me ? 'Check with the site engineer — they assign the day’s work.' : 'Ask the site engineer to add you to the team.'}
            </Empty>
          )}
        </section>

        <section className="card">
          <div className="card__head">
            <h2 className="h2">Photos{photos.length ? ` · ${photos.length}` : ''}</h2>
            {site && <PhotoButtons siteId={site.id} date={t} extra={{ caption: `By ${account.name.split(' ')[0]}` }} />}
          </div>
          {photos.length ? (
            <div className="card__body tech-photos">
              {photos.map((p) => (
                <Thumb key={p.id} id={p.id} alt={p.caption || 'Site photo'} />
              ))}
            </div>
          ) : (
            <Empty icon={<Camera />} title="No photos today">
              {site ? 'Take photos of the work as you finish it. They go to the site engineer’s daily report.' : 'Photos can be added once you’re on a site.'}
            </Empty>
          )}
        </section>
      </main>
    </div>
  );
}
