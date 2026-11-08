import { useState } from 'react';
import { CheckCircle2, ExternalLink, KeyRound, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { checkKey, getApiKey, setApiKey, type KeyCheck } from '../lib/ai';
import { toast } from './ui';

const MESSAGE: Record<Exclude<KeyCheck, 'ok'>, string> = {
  invalid: 'That key was not accepted. Copy it again from the Anthropic Console.',
  'no-credit': 'The key works, but the account has no credit. Add credit under Billing.',
  network: 'Could not reach Anthropic. Check the internet and try again.',
};

/** Settings card for the engineer's own Claude key (used to read drawings) */
export default function AiKeyCard() {
  const [saved, setSaved] = useState(getApiKey());
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    const key = value.trim();
    if (!key) return;
    setBusy(true);
    setMsg(null);
    const r = await checkKey(key);
    setBusy(false);
    if (r === 'ok' || r === 'no-credit') {
      setApiKey(key);
      setSaved(key);
      setValue('');
      toast('Claude key saved on this device');
    }
    setMsg(r === 'ok' ? { ok: true, text: 'Key works. New sites will read their drawings automatically.' } : { ok: false, text: MESSAGE[r] });
  };

  const test = async () => {
    setBusy(true);
    const r = await checkKey(saved);
    setBusy(false);
    setMsg(r === 'ok' ? { ok: true, text: 'Key works.' } : { ok: false, text: MESSAGE[r] });
  };

  return (
    <section className="card" id="drawing-reader">
      <div className="card__head">
        <div>
          <h2 className="h2">
            <Sparkles size={18} /> Drawing reader
          </h2>
          <p className="muted small">Reads drawings when you add a site, using Claude with your own Anthropic account.</p>
        </div>
      </div>
      <div className="card__body stack">
        {saved ? (
          <>
            <div className="row">
              <CheckCircle2 size={18} className="text-exit" />
              <span className="grow">
                Key saved on this device <span className="mono muted">••••{saved.slice(-4)}</span>
              </span>
            </div>
            <div className="row row--wrap">
              <button className="btn btn--sm" onClick={test} disabled={busy}>
                {busy ? <Loader2 className="spin" /> : <KeyRound />} Check key
              </button>
              <button
                className="btn btn--sm btn--danger"
                onClick={() => {
                  setApiKey('');
                  setSaved('');
                  setMsg(null);
                  toast('Claude key removed from this device');
                }}
              >
                <Trash2 /> Remove key
              </button>
            </div>
          </>
        ) : (
          <>
            <ol className="steps">
              <li>
                Go to{' '}
                <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">
                  console.anthropic.com <ExternalLink size={12} />
                </a>{' '}
                and sign up or log in.
              </li>
              <li>
                Open <b>Billing</b> and add some credit. $10 reads roughly 15–30 drawing sets.
              </li>
              <li>
                Open <b>API keys</b>, click <b>Create key</b> and copy it.
              </li>
              <li>Paste it below and press <b>Save key</b>.</li>
            </ol>
            <div className="row row--wrap">
              <input
                className="input mono grow"
                type="password"
                autoComplete="off"
                placeholder="sk-ant-…"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label="Claude API key"
                style={{ minWidth: 200 }}
              />
              <button className="btn btn--primary" onClick={save} disabled={busy || !value.trim()}>
                {busy ? <Loader2 className="spin" /> : <KeyRound />} Save key
              </button>
            </div>
          </>
        )}
        {msg && <p className={`small ${msg.ok ? 'text-exit' : 'text-flame'}`}>{msg.text}</p>}
        <p className="muted small">
          The key stays in this browser only and is never put in backups. Drawings you add are sent to Anthropic to be read, so check that your company
          allows this. Tip: set a monthly spend limit in the Console.
        </p>
      </div>
    </section>
  );
}
