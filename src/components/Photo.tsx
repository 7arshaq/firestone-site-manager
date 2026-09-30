import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { getPhotoBlob } from '../store/photos';

const cache = new Map<string, string>();

export function usePhotoURL(id: string, size: 'thumb' | 'full' = 'thumb') {
  const key = `${size}:${id}`;
  const [url, setUrl] = useState<string | null>(cache.get(key) ?? null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    if (cache.has(key)) {
      setUrl(cache.get(key)!);
      return;
    }
    getPhotoBlob(id, size).then((b) => {
      if (!alive) return;
      if (!b) return setMissing(true);
      const u = URL.createObjectURL(b);
      cache.set(key, u);
      setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [key, id, size]);
  return { url, missing };
}

export function Thumb({ id, alt, size = 'thumb', className }: { id: string; alt: string; size?: 'thumb' | 'full'; className?: string }) {
  const { url, missing } = usePhotoURL(id, size);
  if (missing) {
    return (
      <div className={`thumb thumb--missing ${className ?? ''}`}>
        <ImageOff aria-hidden />
      </div>
    );
  }
  return url ? <img className={`thumb ${className ?? ''}`} src={url} alt={alt} loading="lazy" /> : <div className={`thumb thumb--loading ${className ?? ''}`} />;
}
