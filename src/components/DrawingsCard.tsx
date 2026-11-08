import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { useStore } from '../store/store';
import { getDrawingBlob } from '../store/drawings';
import { Empty, toast } from './ui';
import { fileSize, fmtDate } from '../lib/util';

/** Drawing files kept with a site */
export default function DrawingsCard({ siteId }: { siteId: string }) {
  const all = useStore((s) => s.drawings);
  const deleteDrawing = useStore((s) => s.deleteDrawing);
  const list = all.filter((d) => d.siteId === siteId);

  const open = async (id: string) => {
    const blob = await getDrawingBlob(id);
    if (!blob) return toast('This drawing is no longer on this device');
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  };

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="h2">Drawings</h2>
        <Link to={`/sites/${siteId}/edit`} className="btn btn--sm">
          <Upload /> Add
        </Link>
      </div>
      {list.length ? (
        <ul className="dfiles dfiles--card">
          {list.map((d) => (
            <li key={d.id}>
              <span className="dfiles__ph">{d.kind === 'pdf' ? <FileText aria-hidden /> : <ImageIcon aria-hidden />}</span>
              <span className="grow">
                <b className="truncate block">{d.name}</b>
                {d.tag === 'markup' && <span className="pill pill--water">Progress markup</span>}
                <small className="muted">
                  {d.kind === 'pdf' ? `${d.pages} page${d.pages === 1 ? '' : 's'} · ` : ''}
                  {fileSize(d.size)} · {fmtDate(d.addedAt.slice(0, 10))}
                </small>
              </span>
              <button className="icon-btn icon-btn--sm" onClick={() => open(d.id)} aria-label={`Open ${d.name}`} title="Open">
                <ExternalLink />
              </button>
              <button
                className="icon-btn icon-btn--sm"
                onClick={async () => {
                  await deleteDrawing(d.id);
                  toast('Drawing removed');
                }}
                aria-label={`Remove ${d.name}`}
                title="Remove"
              >
                <Trash2 />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty icon={<FileText />} title="No drawings yet" action={<Link to={`/sites/${siteId}/edit`} className="btn btn--sm">Add drawings</Link>}>
          Keep the site’s drawings here. They can also fill in the scope for you.
        </Empty>
      )}
    </section>
  );
}
