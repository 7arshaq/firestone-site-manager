import { useEffect, useState } from 'react';
import { ExternalLink, ImageOff } from 'lucide-react';
import { googleMapsLink, satellite, SATELLITE_CREDIT, type SatelliteShot } from '../lib/satellite';

/** Satellite picture of the pinned spot (≈ 500 m across) with a link to Google Maps */
export default function SatelliteView({ lat, lng }: { lat: number; lng: number }) {
  const [shot, setShot] = useState<SatelliteShot | null | 'loading'>('loading');
  useEffect(() => {
    let alive = true;
    setShot('loading');
    const t = setTimeout(() => satellite(lat, lng).then((s) => alive && setShot(s)), 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [lat, lng]);

  return (
    <figure className="sat">
      <div className="sat__frame">
        {shot === 'loading' ? (
          <div className="sat__loading">Loading satellite view…</div>
        ) : shot ? (
          <img src={shot.dataUrl} alt="Satellite view of the pinned location" />
        ) : (
          <div className="sat__loading">
            <ImageOff aria-hidden /> Satellite view is not available offline.
          </div>
        )}
      </div>
      <figcaption className="sat__foot">
        <span className="sat__credit">
          {shot && shot !== 'loading' ? `≈ ${shot.widthMeters} m across · ` : ''}
          {SATELLITE_CREDIT}
        </span>
        <a className="btn btn--sm btn--ghost" href={googleMapsLink(lat, lng)} target="_blank" rel="noreferrer">
          Open in Google Maps <ExternalLink />
        </a>
      </figcaption>
    </figure>
  );
}
