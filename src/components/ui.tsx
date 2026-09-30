import { useEffect, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Person, SiteStatus, System } from '../types';
import { addDays, fmtDay, initials, today } from '../lib/util';

/* ---------------- Toasts ---------------- */

interface ToastState {
  items: { id: number; text: string }[];
  push: (text: string) => void;
}

export const useToast = create<ToastState>((set) => ({
  items: [],
  push: (text) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items, { id, text }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 2600);
  },
}));

export const toast = (text: string) => useToast.getState().push(text);

export function Toasts() {
  const items = useToast((s) => s.items);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div className="toast" key={t.id}>
          <Check aria-hidden />
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({
  title,
  onClose,
  children,
  footer,
  size,
  eyebrow,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'wide' | 'narrow';
  eyebrow?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    // Put the cursor in the first field on desktop; on touch screens don't pop the keyboard.
    const fine = window.matchMedia('(pointer: fine)').matches;
    const first = fine
      ? ref.current?.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=range]):not([type=file]), select, textarea')
      : null;
    (first ?? ref.current)?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} className={`modal ${size ? `modal--${size}` : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal__head">
          <div className="stack" style={{ gap: 4 }}>
            {eyebrow && <span className="label">{eyebrow}</span>}
            <h2 className="h2">{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({
  title,
  body,
  action,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  action: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="narrow"
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn--flame"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {action}
          </button>
        </>
      }
    >
      <div className="muted">{body}</div>
    </Modal>
  );
}

/* ---------------- Small pieces ---------------- */

export function SysTag({ s }: { s: System }) {
  return (
    <span className={`sys sys--${s}`} title={s === 'FA' ? 'Fire alarm' : 'Fire fighting'}>
      {s}
    </span>
  );
}

export const STATUS_LABEL: Record<SiteStatus, string> = {
  active: 'Active',
  snagging: 'Snagging',
  'on-hold': 'On hold',
  completed: 'Completed',
};

export function StatusDot({ s }: { s: SiteStatus }) {
  return <span className={`status status--${s}`}>{STATUS_LABEL[s]}</span>;
}

export function Bar({ value, kind, thin, label }: { value: number; kind?: 'FA' | 'FF' | 'done'; thin?: boolean; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={`bar ${kind ? `bar--${kind}` : ''} ${thin ? 'bar--thin' : ''}`}
      role="progressbar"
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <i style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Delta({ v }: { v: number | null }) {
  if (v === null) return null;
  const r = Math.round(v * 1000) / 10;
  return <span className={`delta ${r === 0 ? 'delta--zero' : ''}`}>{r > 0 ? `+${r}%` : r === 0 ? '±0%' : `${r}%`}</span>;
}

export function Avatar({ p, size }: { p: Pick<Person, 'name' | 'role'>; size?: number }) {
  return (
    <span className={`avatar avatar--${p.role}`} style={size ? { width: size, height: size } : undefined} aria-hidden>
      {initials(p.name)}
    </span>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; count?: number }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function DateStepper({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const isToday = value === today();
  return (
    <div className="datestep">
      <button type="button" onClick={() => onChange(addDays(value, -1))} aria-label="Previous day">
        <ChevronLeft />
      </button>
      <label>
        <span>
          {fmtDay(value)}
          {isToday && <span className="today-tag">Today</span>}
        </span>
        <input type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Pick date" />
      </label>
      <button type="button" onClick={() => onChange(addDays(value, 1))} aria-label="Next day">
        <ChevronRight />
      </button>
    </div>
  );
}

/** Number input that keeps a local string while typing */
export function NumField({
  value,
  onChange,
  min = 0,
  step = 1,
  className = 'input input--num',
  ...rest
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  step?: number;
  className?: string;
  'aria-label'?: string;
  id?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      {...rest}
      className={className}
      type="number"
      inputMode="decimal"
      min={min}
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (!Number.isNaN(n)) onChange(Math.max(min, n));
        else if (e.target.value === '') onChange(0);
      }}
      onFocus={(e) => e.target.select()}
    />
  );
}

