import { useEffect, useRef, useState } from 'react';
import { Database, Download, HardDrive, Monitor, Moon, MousePointer2, RotateCcw, ShieldCheck, Smartphone, Sun, Upload } from 'lucide-react';
import { emptyData, getData, useStore, type Data } from '../store/store';
import { blobToDataURL, dataURLToBlob, getPhotoBlob, savePhotoBlobs, deleteManyPhotoBlobs } from '../store/photos';
import { Confirm, Seg, toast } from '../components/ui';
import { Logo } from '../components/Brand';
import AiKeyCard from '../components/AiKeyCard';
import { useUi, type ThemePref } from '../store/ui';
import { downloadBlob, today } from '../lib/util';
import { upgradeFromV1 } from '../store/v1/upgrade';
import type { V1Data } from '../store/v1/types';

interface Backup {
  app: 'firestone' | 'riser';
  /** 1 = Version 1 of the app (device quantities), 2 = Version 2 (scope list) */
  version: 1 | 2;
  exportedAt: string;
  data: Data;
  photos?: Record<string, { full: string; thumb: string }>;
}

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const ui = useUi();
  const update = useStore((s) => s.updateSettings);
  const photoCount = useStore((s) => s.photos.length);
  const sampleLoaded = useStore((s) => s.sampleLoaded);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [withPhotos, setWithPhotos] = useState(true);
  const [confirm, setConfirm] = useState<'sample' | 'empty' | { restore: Backup } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 }));
    navigator.storage?.persisted?.().then(setPersisted);
  }, [photoCount]);

  const exportBackup = async () => {
    setBusy(true);
    try {
      const data = getData();
      const backup: Backup = { app: 'firestone', version: 2, exportedAt: new Date().toISOString(), data };
      if (withPhotos) {
        backup.photos = {};
        for (const p of data.photos) {
          const full = await getPhotoBlob(p.id, 'full');
          const thumb = await getPhotoBlob(p.id, 'thumb');
          if (full && thumb) backup.photos[p.id] = { full: await blobToDataURL(full), thumb: await blobToDataURL(thumb) };
        }
      }
      downloadBlob(new Blob([JSON.stringify(backup)], { type: 'application/json' }), `firestone-backup-${today()}.json`);
      toast('Backup downloaded');
    } finally {
      setBusy(false);
    }
  };

  const readBackup = async (f: File | undefined) => {
    if (!f) return;
    try {
      const b = JSON.parse(await f.text()) as Backup;
      if ((b.app !== 'firestone' && b.app !== 'riser') || !b.data?.sites) throw new Error('bad');
      setConfirm({ restore: b });
    } catch {
      toast('That file is not a Firestone Site Manager backup');
    }
  };

  const restore = async (b: Backup) => {
    setBusy(true);
    try {
      await deleteManyPhotoBlobs(getData().photos.map((p) => p.id));
      for (const [id, p] of Object.entries(b.photos ?? {})) await savePhotoBlobs(id, await dataURLToBlob(p.full), await dataURLToBlob(p.thumb));
      // a Version 1 backup is brought into Version 2 the same way saved data is
      const data = b.version === 2 && b.data.scopeItems ? b.data : upgradeFromV1(b.data as unknown as V1Data);
      useStore.getState().replaceAll({ ...emptyData(), ...data, initialised: true });
      toast('Backup restored');
    } finally {
      setBusy(false);
    }
  };

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__title">
          <span className="label">This device</span>
          <h1 className="h1">Settings</h1>
        </div>
      </div>

      <div className="settings">
        <AiKeyCard />

        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="h2">Appearance</h2>
              <p className="muted small">Saved on this device only.</p>
            </div>
          </div>
          <div className="card__body stack">
            <div className="field">
              <span>Theme</span>
              <Seg<ThemePref>
                label="Theme"
                value={ui.theme}
                onChange={ui.setTheme}
                options={[
                  { value: 'light', label: <><Sun size={14} /> Light</> },
                  { value: 'dark', label: <><Moon size={14} /> Dark</> },
                  { value: 'system', label: <><Monitor size={14} /> Match device</> },
                ]}
              />
            </div>
            <label className="check">
              <input type="checkbox" checked={ui.boldCursor} onChange={(e) => ui.setBoldCursor(e.target.checked)} />
              <MousePointer2 size={16} /> Bold dark cursor in light mode
            </label>
            <p className="muted small">
              Makes the mouse pointer easy to see on the white map and pages. Turn it off to use your computer's own cursor (for example, if you've
              made it bigger in Windows settings).
            </p>
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h2 className="h2">Report details</h2></div>
          <div className="card__body form-grid form-grid--2">
            <label className="field span-all">
              <span>Company name</span>
              <input className="input" value={settings.companyName} onChange={(e) => update({ companyName: e.target.value })} />
              <small>Printed at the top of every PDF report.</small>
            </label>
            <label className="field">
              <span>Your name</span>
              <input className="input" value={settings.engineerName} onChange={(e) => update({ engineerName: e.target.value })} />
            </label>
            <label className="field">
              <span>Your mobile</span>
              <input className="input" type="tel" value={settings.engineerPhone} onChange={(e) => update({ engineerPhone: e.target.value })} placeholder="05X XXX XXXX" />
            </label>
            <label className="field span-all">
              <span>Engineer PIN</span>
              <input
                className="input mono"
                inputMode="numeric"
                maxLength={4}
                value={settings.engineerPin}
                onChange={(e) => update({ engineerPin: e.target.value.replace(/\D/g, '') })}
                placeholder="4 digits — needed to leave Crew mode"
              />
              <small>When set, the crew can't get back to your full view without it.</small>
            </label>
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="h2">Backup & restore</h2>
              <p className="muted small">Everything lives on this device only. Download a backup regularly and keep it on Drive or email it to yourself.</p>
            </div>
          </div>
          <div className="card__body stack">
            <label className="check">
              <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} />
              Include photos ({photoCount}) — bigger file
            </label>
            <div className="row row--wrap">
              <button className="btn btn--primary" onClick={exportBackup} disabled={busy}>
                <Download /> {busy ? 'Working…' : 'Download backup'}
              </button>
              <button className="btn" onClick={() => file.current?.click()} disabled={busy}>
                <Upload /> Restore from backup
              </button>
              <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => (readBackup(e.target.files?.[0]), (e.target.value = ''))} />
            </div>
            <p className="muted small">Restoring also moves your data to a new phone or laptop: back up on one, restore on the other.</p>
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h2 className="h2">Storage</h2></div>
          <div className="card__body stack">
            <div className="row">
              <HardDrive size={18} className="muted" />
              <span className="grow">
                {usage ? `${mb(usage.used)} used of ${mb(usage.quota)} available` : 'Checking…'}
              </span>
            </div>
            <div className="row">
              <ShieldCheck size={18} className={persisted ? 'text-exit' : 'muted'} />
              <span className="grow">
                {persisted ? 'Protected — the browser won’t clear this data to free space.' : 'Not protected yet — the browser may clear data when the device is low on space.'}
              </span>
              {!persisted && (
                <button
                  className="btn btn--sm"
                  onClick={async () => {
                    const ok = await navigator.storage?.persist?.();
                    setPersisted(!!ok);
                    toast(ok ? 'Storage protected' : 'The browser declined — install the app to protect storage');
                  }}
                >
                  Protect data
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h2 className="h2">Use it like an app</h2></div>
          <div className="card__body stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <Smartphone size={18} className="muted" style={{ marginTop: 2 }} />
              <p className="small">
                <b>Android (Chrome):</b> menu ⋮ → <i>Install app</i>. <b>iPhone (Safari):</b> Share → <i>Add to Home Screen</i>. It opens full-screen and works
                without signal on site; changes save on the device straight away.
              </p>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h2 className="h2">About</h2></div>
          <div className="card__body stack">
            <div className="row" style={{ gap: 14 }}>
              <Logo className="about__mark" />
              <div>
                <b>Firestone Site Manager</b>
                <p className="muted small">Site management for fire alarm and fire fighting projects.</p>
              </div>
            </div>
            <p className="small muted">
              Emirate boundaries © OpenStreetMap contributors, via geoBoundaries (ODbL 1.0). Neighbouring coastlines from Natural Earth (public
              domain). Material quantities are planning estimates — always check against the approved drawings and BOQ.
            </p>
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="h2">Sample data</h2>
              <p className="muted small">
                {sampleLoaded
                  ? 'You are looking at example sites, crew and history.'
                  : 'Want to see how the app works first? Load example sites, crew and two weeks of history.'}
              </p>
            </div>
          </div>
          <div className="card__body row row--wrap">
            <button className="btn" onClick={() => setConfirm('sample')}>
              <RotateCcw /> Load sample data
            </button>
            <button className="btn btn--danger" onClick={() => setConfirm('empty')}>
              <Database /> Clear everything and start empty
            </button>
          </div>
        </section>
      </div>

      {confirm === 'sample' && (
        <Confirm
          title="Replace everything with sample data?"
          body="All sites, crew, tasks, materials, expenses and photos on this device are replaced. Download a backup first if you need them."
          action="Load sample data"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await deleteManyPhotoBlobs(getData().photos.map((p) => p.id));
            const settingsNow = useStore.getState().settings;
            const { buildSample } = await import('../data/seed');
            useStore.getState().replaceAll({ ...buildSample(), settings: settingsNow });
            toast('Sample data loaded');
          }}
        />
      )}
      {confirm === 'empty' && (
        <Confirm
          title="Clear everything?"
          body="This deletes all sites, crew, tasks, materials, expenses and photos from this device. Your report details stay. This can't be undone."
          action="Clear everything"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await useStore.getState().clearAll();
            toast('Cleared — add your first site from the map');
          }}
        />
      )}
      {confirm && typeof confirm === 'object' && (
        <Confirm
          title="Restore this backup?"
          body={`Backup from ${new Date(confirm.restore.exportedAt).toLocaleString()} with ${confirm.restore.data.sites.length} sites and ${Object.keys(confirm.restore.photos ?? {}).length} photos. It replaces everything currently on this device.`}
          action="Restore backup"
          onClose={() => setConfirm(null)}
          onConfirm={() => restore(confirm.restore)}
        />
      )}
    </div>
  );
}
