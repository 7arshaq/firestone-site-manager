import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Delete } from 'lucide-react';
import { Logo } from './Brand';
import { accountFor, couldGrow, firstName, ROLE_NAME, type Account } from '../data/accounts';

type Phase = 'boot' | 'pin' | 'ok' | 'greet' | 'leave';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

function greeting(h = new Date().getHours()) {
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** The visible logo mark the app shows in its header — the hand-off lands on it */
function brandTarget(): HTMLElement | null {
  const els = [...document.querySelectorAll<HTMLElement>('[data-brand-target] .logo')];
  return els.find((el) => el.getBoundingClientRect().width > 0) ?? null;
}

/**
 * Sign-in: boot (logo, then name) → the lockup rises as the keypad arrives → code → greeting →
 * the logo mark flies into the app header while the screen fades away.
 * `intro` plays the boot animation (first open); after "Lock" the keypad shows straight away.
 */
export default function Gate({ intro, onSignIn, onDone }: { intro: boolean; onSignIn: (a: Account) => void; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>(intro && !reducedMotion() ? 'boot' : 'pin');
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const [who, setWho] = useState<Account | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const left = useRef(false);

  // the lockup starts in the middle of the screen: drop it by half the panel's height until the keypad arrives
  useLayoutEffect(() => {
    const h = panel.current?.offsetHeight ?? 0;
    root.current?.style.setProperty('--drop', `${Math.round(h / 2 + 18)}px`);
  }, []);

  useEffect(() => {
    if (phase !== 'boot') return;
    const t = setTimeout(() => setPhase('pin'), 650);
    return () => clearTimeout(t);
  }, [phase]);

  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    setPhase('leave');
    const quick = reducedMotion();
    const target = brandTarget();
    const from = mark.current?.getBoundingClientRect();
    const to = target?.getBoundingClientRect();
    const done = () => {
      if (target) target.style.visibility = '';
      onDone();
    };
    // the screen behind the logo fades away and the app (already drawn underneath) shows through
    root.current?.querySelector('.gate__bg')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: quick ? 200 : 360, delay: quick ? 0 : 80, easing: 'ease-out', fill: 'forwards' });
    if (!quick && target && from && to && from.width > 0) {
      target.style.visibility = 'hidden';
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const s = to.width / from.width;
      const flight = mark.current!.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], { duration: 560, easing: EASE, fill: 'forwards' });
      flight.onfinish = done;
    } else setTimeout(done, quick ? 200 : 440);
  }, [onDone]);

  // after the greeting has been read, hand over to the app
  useEffect(() => {
    if (phase !== 'greet') return;
    const t = setTimeout(leave, reducedMotion() ? 900 : 1250);
    return () => clearTimeout(t);
  }, [phase, leave]);

  const accept = (a: Account) => {
    setWho(a);
    setPhase('ok');
    // the dots turn green, then the app is drawn underneath while the greeting plays
    setTimeout(() => {
      onSignIn(a);
      setPhase('greet');
    }, 240);
  };

  const press = (k: string) => {
    if (phase !== 'pin') return;
    if (k === 'back') {
      setWrong(false);
      setCode((c) => c.slice(0, -1));
      return;
    }
    const next = (code + k).slice(0, 8);
    setWrong(false);
    setCode(next);
    const hit = accountFor(next);
    if (hit) return accept(hit);
    if (next.length >= 4 && !couldGrow(next)) {
      setWrong(true);
      setTimeout(() => setCode(''), 420);
    }
  };

  // number keys and Backspace on a keyboard work too
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const slots = Math.max(4, code.length + (code.length >= 4 && couldGrow(code) ? 1 : 0));
  const signedIn = phase === 'ok' || phase === 'greet' || phase === 'leave';

  return (
    <div
      ref={root}
      className={`gate gate--${phase} ${intro ? 'gate--intro' : ''}`}
      onClick={() => phase === 'greet' && leave()}
      role={phase === 'greet' ? 'status' : undefined}
    >
      <div className="gate__bg" aria-hidden />
      <div className="gate__stage">
        <div className="gate__lockup">
          <span ref={mark} className="gate__mark">
            <Logo alt="Firestone" />
          </span>
          <span className="brand-name gate__name" aria-hidden>
            <span className="brand-name__fire gate__fire">FIRE</span>
            <span className="gate__stone">STONE</span>
          </span>
        </div>

        <div ref={panel} className="gate__panel">
          <div className="gate__pin" aria-hidden={signedIn}>
            <h1 className="gate__ask">Enter your code</h1>
            <div
              className={`gate__dots ${wrong ? 'is-wrong' : ''} ${phase === 'ok' ? 'is-ok' : ''}`}
              aria-live="polite"
              aria-label={wrong ? 'That code is not recognised' : `${code.length} digits entered`}
            >
              {Array.from({ length: slots }, (_, i) => (
                <i key={i} className={i < code.length ? 'on' : ''} />
              ))}
            </div>
            <p className="gate__msg">{wrong ? 'That code isn’t recognised. Try again.' : 'Your code is given by the company.'}</p>
            <div className="gate__keys">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
                <button key={k} type="button" onClick={() => press(k)} tabIndex={signedIn ? -1 : 0}>
                  {k}
                </button>
              ))}
              <span />
              <button type="button" onClick={() => press('0')} tabIndex={signedIn ? -1 : 0}>
                0
              </button>
              <button type="button" onClick={() => press('back')} aria-label="Delete a digit" tabIndex={signedIn ? -1 : 0}>
                <Delete />
              </button>
            </div>
          </div>

          {who && (phase === 'greet' || phase === 'leave') && (
            <div className="gate__hello">
              <span className="gate__greet">{greeting()}</span>
              <span className="gate__who">{who.role === 'dev' ? 'Developer' : firstName(who)}</span>
              <span className="gate__role">{ROLE_NAME[who.role]}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
