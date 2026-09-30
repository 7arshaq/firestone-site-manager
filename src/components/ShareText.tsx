import { useState } from 'react';
import { Copy, MessageCircle, Share2 } from 'lucide-react';
import { Modal, toast } from './ui';
import { openWhatsApp } from '../lib/notes';

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Copied — paste it into WhatsApp');
}

/** Preview, tweak and send a WhatsApp-formatted note */
export function ShareText({ title, eyebrow, initial, onClose }: { title: string; eyebrow?: string; initial: string; filename?: string; onClose: () => void }) {
  const [text, setText] = useState(initial);
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator && /Android|iPhone|iPad/i.test(navigator.userAgent);
  return (
    <Modal
      title={title}
      eyebrow={eyebrow}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={() => copyText(text)}>
            <Copy /> Copy
          </button>
          {canShare && (
            <button className="btn" onClick={() => navigator.share({ text }).catch(() => undefined)}>
              <Share2 /> Share
            </button>
          )}
          <button className="btn btn--primary" onClick={() => openWhatsApp(text)}>
            <MessageCircle /> Open in WhatsApp
          </button>
        </>
      }
    >
      <WaEditor value={text} onChange={setText} />
    </Modal>
  );
}

/** Editable note with a live WhatsApp-style preview (*bold*, _italic_) */
export function WaEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [tab, setTab] = useState<'preview' | 'edit'>('preview');
  return (
    <div className="wa">
      <div className="seg" role="group" aria-label="View">
        <button type="button" aria-pressed={tab === 'preview'} onClick={() => setTab('preview')}>Preview</button>
        <button type="button" aria-pressed={tab === 'edit'} onClick={() => setTab('edit')}>Edit text</button>
      </div>
      {tab === 'edit' ? (
        <textarea className="textarea wa__edit" value={value} onChange={(e) => onChange(e.target.value)} rows={16} aria-label="Message text" />
      ) : (
        <div className="wa__bubble" aria-label="Message preview">
          {value.split('\n').map((line, i) => (
            <div key={i} className="wa__line">
              {line ? formatWa(line) : ' '}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatWa(line: string) {
  const parts = line.split(/(\*[^*]+\*|_[^_]+_)/g);
  return parts.map((p, i) =>
    p.startsWith('*') && p.endsWith('*') && p.length > 2 ? (
      <b key={i}>{p.slice(1, -1)}</b>
    ) : p.startsWith('_') && p.endsWith('_') && p.length > 2 ? (
      <i key={i}>{p.slice(1, -1)}</i>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
