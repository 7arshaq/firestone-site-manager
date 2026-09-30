import { useMemo, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useSiteCtx } from './SiteLayout';
import { useStore } from '../../store/store';
import { processPhoto, savePhotoBlobs } from '../../store/photos';
import { Thumb } from '../../components/Photo';
import { Empty, Modal, toast } from '../../components/ui';
import type { PhotoMeta } from '../../types';
import { fmtDay, relDay, today, uid } from '../../lib/util';

export function usePhotoAdder(siteId: string, date: string) {
  const addPhoto = useStore((s) => s.addPhoto);
  const [busy, setBusy] = useState(false);
  const add = async (files: FileList | null, extra?: Partial<PhotoMeta>) => {
    if (!files?.length) return;
    setBusy(true);
    let n = 0;
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const p = await processPhoto(file);
        const id = uid();
        await savePhotoBlobs(id, p.full, p.thumb);
        addPhoto({ id, siteId, date, caption: '', tag: '', workItemId: null, width: p.width, height: p.height, createdAt: new Date().toISOString(), ...extra });
        n++;
      }
      toast(n === 1 ? 'Photo added' : `${n} photos added`);
    } catch {
      toast('That photo could not be read. Try a JPEG or PNG.');
    } finally {
      setBusy(false);
    }
  };
  return { add, busy };
}

export function PhotoButtons({ siteId, date, extra }: { siteId: string; date: string; extra?: Partial<PhotoMeta> }) {
  const cam = useRef<HTMLInputElement>(null);
  const lib = useRef<HTMLInputElement>(null);
  const { add, busy } = usePhotoAdder(siteId, date);
  return (
    <div className="row">
      <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => cam.current?.click()}>
        <Camera /> {busy ? 'Saving…' : 'Take photo'}
      </button>
      <button className="btn btn--sm" disabled={busy} onClick={() => lib.current?.click()}>
        <ImagePlus /> Upload
      </button>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (add(e.target.files, extra), (e.target.value = ''))} />
      <input ref={lib} type="file" accept="image/*" multiple hidden onChange={(e) => (add(e.target.files, extra), (e.target.value = ''))} />
    </div>
  );
}

export default function Photos() {
  const { site } = useSiteCtx();
  const d = useStore(useShallow((s) => ({ photos: s.photos, workItems: s.workItems })));
  const [date, setDate] = useState(today());
  const [open, setOpen] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const { add } = usePhotoAdder(site.id, date);
  const photos = useMemo(
    () => d.photos.filter((p) => p.siteId === site.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [d.photos, site.id],
  );
  const days = [...new Set(photos.map((p) => p.date))];

  return (
    <div
      className={`stack stack--lg photos ${drag ? 'is-drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        add(e.dataTransfer.files);
      }}
    >
      <div className="daily__bar">
        <label className="field" style={{ gridAutoFlow: 'column', alignItems: 'center', gap: 10 }}>
          <span>Photo date</span>
          <input className="input input--sm" type="date" value={date} onChange={(e) => setDate(e.target.value || today())} style={{ width: 160 }} />
        </label>
        <PhotoButtons siteId={site.id} date={date} />
      </div>

      {photos.length ? (
        days.map((day) => (
          <section key={day} className="stack">
            <h2 className="label">
              {relDay(day)} · {fmtDay(day)}
            </h2>
            <div className="gallery">
              {photos
                .filter((p) => p.date === day)
                .map((p) => (
                  <button key={p.id} className="gallery__item" onClick={() => setOpen(photos.indexOf(p))}>
                    <Thumb id={p.id} alt={p.caption || 'Site photo'} />
                    {(p.caption || p.tag) && <span className="gallery__cap">{p.caption || p.tag}</span>}
                  </button>
                ))}
            </div>
          </section>
        ))
      ) : (
        <div className="card">
          <Empty icon={<Camera />} title="No photos for this site yet" action={<PhotoButtons siteId={site.id} date={date} />}>
            Take progress photos on site or drop images here. They're compressed and stored on this device, and can be added to the daily PDF.
          </Empty>
        </div>
      )}

      {open !== null && photos[open] && (
        <Lightbox
          photo={photos[open]}
          items={d.workItems.filter((w) => w.siteId === site.id)}
          onPrev={open > 0 ? () => setOpen(open - 1) : undefined}
          onNext={open < photos.length - 1 ? () => setOpen(open + 1) : undefined}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function Lightbox({ photo, items, onPrev, onNext, onClose }: { photo: PhotoMeta; items: { id: string; label: string; system: string }[]; onPrev?: () => void; onNext?: () => void; onClose: () => void }) {
  const update = useStore((s) => s.updatePhoto);
  const del = useStore((s) => s.deletePhoto);
  return (
    <Modal
      title={photo.caption || 'Site photo'}
      eyebrow={fmtDay(photo.date)}
      size="wide"
      onClose={onClose}
      footer={
        <>
          <button
            className="btn btn--danger"
            onClick={async () => {
              await del(photo.id);
              toast('Photo deleted');
              onClose();
            }}
          >
            <Trash2 /> Delete
          </button>
          <span className="grow" />
          <button className="btn" onClick={onPrev} disabled={!onPrev} aria-label="Previous photo"><ChevronLeft /></button>
          <button className="btn" onClick={onNext} disabled={!onNext} aria-label="Next photo"><ChevronRight /></button>
        </>
      }
    >
      <div className="lightbox">
        <Thumb id={photo.id} size="full" alt={photo.caption || 'Site photo'} className="lightbox__img" />
        <div className="form-grid form-grid--2">
          <label className="field span-all">
            <span>Caption</span>
            <input className="input" value={photo.caption} onChange={(e) => update(photo.id, { caption: e.target.value })} placeholder="e.g. Sprinkler mains installed, L18 corridor" />
          </label>
          <label className="field">
            <span>Location / area</span>
            <input className="input" value={photo.tag} onChange={(e) => update(photo.id, { tag: e.target.value })} placeholder="e.g. L18" />
          </label>
          <label className="field">
            <span>Stage</span>
            <select className="select" value={photo.workItemId ?? ''} onChange={(e) => update(photo.id, { workItemId: e.target.value || null })}>
              <option value="">Not linked</option>
              {items.map((w) => <option key={w.id} value={w.id}>{w.system} · {w.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" value={photo.date} onChange={(e) => e.target.value && update(photo.id, { date: e.target.value })} />
          </label>
        </div>
      </div>
    </Modal>
  );
}
