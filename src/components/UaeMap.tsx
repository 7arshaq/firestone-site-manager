import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { select } from 'd3-selection';
import 'd3-transition';
import type { Feature, FeatureCollection, MultiPolygon } from 'geojson';
import { ArrowRight, Maximize2, Minus, Plus } from 'lucide-react';
import raw from '../data/uae-map.geojson?raw';
import type { SiteStatus } from '../types';
import { STATUS_LABEL } from './ui';
import { Lockup } from './Brand';

const GEO = JSON.parse(raw) as {
  country: Feature<MultiPolygon, { name: string }>;
  emirates: FeatureCollection<MultiPolygon, { name: string }>;
  neighbours: FeatureCollection<MultiPolygon, { name: string }>;
};

/* Sheet zones follow a real 0.5° graticule so a grid reference means the same place at any zoom or screen size. */
export const GRID = { lon0: 51.5, lat0: 26.2, dLon: 0.5, dLat: 0.6, cols: 10, rows: 6 };
const COLS = 'ABCDEFGHJK';

export function gridRef(lat: number, lng: number) {
  const c = Math.min(GRID.cols - 1, Math.max(0, Math.floor((lng - GRID.lon0) / GRID.dLon)));
  const r = Math.min(GRID.rows - 1, Math.max(0, Math.floor((GRID.lat0 - lat) / GRID.dLat)));
  return `${COLS[c]}${r + 1}`;
}

const EMIRATE_LABELS: [string, number, number, boolean][] = [
  ['ABU DHABI', 53.55, 23.5, true],
  ['DUBAI', 55.33, 24.9, true],
  ['SHARJAH', 55.7, 25.2, false],
  ['AJMAN', 55.5, 25.43, false],
  ['UMM AL QUWAIN', 55.74, 25.53, false],
  ['RAS AL KHAIMAH', 56.02, 25.73, false],
  ['FUJAIRAH', 56.25, 25.27, false],
];

const CITIES: [string, number, number, 1 | 2][] = [
  ['Abu Dhabi', 54.37, 24.47, 1],
  ['Dubai', 55.27, 25.2, 1],
  ['Al Ain', 55.76, 24.21, 1],
  ['Sharjah', 55.4, 25.34, 2],
  ['Ruwais', 52.73, 24.11, 2],
  ['Madinat Zayed', 53.7, 23.69, 2],
  ['Fujairah', 56.33, 25.12, 2],
  ['Ras Al Khaimah', 55.94, 25.79, 2],
];

const WATER: [string, number, number][] = [
  ['A R A B I A N   G U L F', 53.1, 25.45],
  ['G U L F   O F   O M A N', 56.95, 24.75],
];
const LANDS: [string, number, number][] = [
  ['SAUDI ARABIA', 53.25, 22.4],
  ['OMAN', 56.25, 23.45],
  ['QATAR', 51.2, 25.25],
];

export interface MapSite {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  status: SiteStatus;
  progress: number;
  fa: number | null;
  ff: number | null;
  crew: number;
}

interface Props {
  sites: MapSite[];
  selectedId?: string | null;
  hoverId?: string | null;
  focus?: { id: string; n: number } | null;
  onSelect?: (id: string | null) => void;
  onHover?: (id: string | null) => void;
  onOpen?: (id: string) => void;
  pick?: { lat: number; lng: number } | null;
  onPick?: (p: { lat: number; lng: number }) => void;
  engineer?: string;
  dateLabel?: string;
  compact?: boolean;
  intro?: boolean;
}

const B = 22; // sheet border band
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function UaeMap({
  sites, selectedId, hoverId, focus, onSelect, onHover, onOpen, pick, onPick, engineer, dateLabel, compact, intro = true,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);
  const [drawn, setDrawn] = useState(!intro || reduced());

  useLayoutEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize((s) => (Math.abs(s.w - width) > 1 || Math.abs(s.h - height) > 1 ? { w: Math.round(width), h: Math.round(height) } : s));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (drawn) return;
    const id = setTimeout(() => setDrawn(true), 1500);
    return () => clearTimeout(id);
  }, [drawn]);

  const { w, h } = size;
  const view = { x0: B, y0: B, x1: w - B, y1: h - B };

  const projection: GeoProjection | null = useMemo(() => {
    if (w < 60 || h < 60) return null;
    const pad = compact ? 12 : Math.min(48, Math.max(18, w * 0.04));
    return geoMercator().fitExtent(
      [
        [B + pad, B + pad],
        [w - B - pad, h - B - pad - (compact ? 0 : 8)],
      ],
      GEO.country,
    );
  }, [w, h, compact]);

  const paths = useMemo(() => {
    if (!projection) return null;
    const p = geoPath(projection);
    return {
      country: p(GEO.country) ?? '',
      emirates: GEO.emirates.features.map((f) => ({ name: f.properties.name, d: p(f) ?? '' })),
      neighbours: GEO.neighbours.features.map((f) => p(f) ?? '').join(''),
    };
  }, [projection]);

  // zoom behaviour
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !projection) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 60])
      .extent([
        [B, B],
        [w - B, h - B],
      ])
      .translateExtent([
        [B, B],
        [w - B, h - B],
      ])
      .filter((e: Event & { button?: number; ctrlKey?: boolean; type: string }) => (!e.ctrlKey || e.type === 'wheel') && !e.button)
      .on('zoom', (e) => setT(e.transform));
    zoomRef.current = z;
    const sel = select(svg);
    sel.call(z).call(z.transform, zoomIdentity);
    return () => {
      sel.on('.zoom', null);
    };
  }, [projection, w, h]);

  // fly to a site when asked
  useEffect(() => {
    if (!focus || !projection || !svgRef.current || !zoomRef.current) return;
    const s = sites.find((x) => x.id === focus.id);
    if (!s) return;
    const [x, y] = projection([s.lng, s.lat]) ?? [0, 0];
    const k = Math.max(t.k, compact ? 4 : 7);
    const cx = (w - 2 * B) * (compact ? 0.5 : 0.42) + B;
    const cy = (h - 2 * B) * 0.5 + B;
    const next = zoomIdentity.translate(cx, cy).scale(k).translate(-x, -y);
    select(svgRef.current)
      .transition()
      .duration(reduced() ? 0 : 850)
      .call(zoomRef.current.transform, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n]);

  const zoomBy = (f: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).transition().duration(reduced() ? 0 : 300).call(zoomRef.current.scaleBy, f);
  };
  const reset = () => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).transition().duration(reduced() ? 0 : 600).call(zoomRef.current.transform, zoomIdentity);
  };

  const proj = (lng: number, lat: number): [number, number] => {
    const p = projection!([lng, lat]) ?? [0, 0];
    return [t.applyX(p[0]), t.applyY(p[1])];
  };

  /* ---------- sheet zones ---------- */
  const zones = useMemo(() => {
    if (!projection) return null;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= GRID.cols; i++) xs.push(t.applyX(projection([GRID.lon0 + i * GRID.dLon, 24])![0]));
    for (let j = 0; j <= GRID.rows; j++) ys.push(t.applyY(projection([54, GRID.lat0 - j * GRID.dLat])![1]));
    const cols = xs.slice(0, -1).map((x, i) => {
      const a = Math.max(x, view.x0);
      const b = Math.min(xs[i + 1], view.x1);
      return { label: COLS[i], lon: GRID.lon0 + i * GRID.dLon, x: (a + b) / 2, vis: b - a > 16 };
    });
    const rows = ys.slice(0, -1).map((y, j) => {
      const a = Math.max(y, view.y0);
      const b = Math.min(ys[j + 1], view.y1);
      return { label: String(j + 1), lat: GRID.lat0 - j * GRID.dLat, y: (a + b) / 2, vis: b - a > 16 };
    });
    const every = (gap: number, need: number) => (gap >= need ? 1 : gap * 2 >= need ? 2 : gap * 4 >= need ? 4 : 99);
    const xEvery = every(Math.abs(xs[1] - xs[0]), 46);
    const yEvery = every(Math.abs(ys[1] - ys[0]), 46);
    return { xs, ys, cols, rows, xEvery, yEvery };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection, t, w, h]);

  /* ---------- scale bar ---------- */
  const scale = useMemo(() => {
    if (!projection) return null;
    const a = projection([54, 24.5])!;
    const b = projection([55, 24.5])!;
    const pxPerKm = ((b[0] - a[0]) / (111.32 * Math.cos((24.5 * Math.PI) / 180))) * t.k;
    const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200];
    const target = compact ? 60 : 90;
    const km = nice.find((n) => n * pxPerKm >= target) ?? 200;
    return { km, px: km * pxPerKm };
  }, [projection, t.k, compact]);

  /* ---------- pins & label placement ---------- */
  const placed = useMemo(() => {
    if (!projection) return [];
    const pts = sites.map((s, i) => {
      const [x, y] = proj(s.lng, s.lat);
      return { s, i, x, y };
    });
    const inView = (x: number, y: number) => x > view.x0 - 20 && x < view.x1 + 20 && y > view.y0 - 20 && y < view.y1 + 20;
    const boxes: [number, number, number, number][] = pts.map((p) => [p.x - 11, p.y - 11, p.x + 11, p.y + 11]);
    const hit = (bx: [number, number, number, number], skip: number) =>
      bx[0] < view.x0 + 2 || bx[2] > view.x1 - 2 || bx[1] < view.y0 + 2 || bx[3] > view.y1 - 2 ||
      boxes.some((o, i) => i !== skip && bx[0] < o[2] && bx[2] > o[0] && bx[1] < o[3] && bx[3] > o[1]);
    const order = [...pts].sort((a, b) => {
      const pa = a.s.id === selectedId ? 0 : a.s.id === hoverId ? 1 : 2;
      const pb = b.s.id === selectedId ? 0 : b.s.id === hoverId ? 1 : 2;
      return pa - pb || b.s.progress - a.s.progress;
    });
    const labels = new Map<string, { x: number; y: number; anchor: 'start' | 'end' | 'middle' } | null>();
    for (const p of order) {
      if (!inView(p.x, p.y)) {
        labels.set(p.s.id, null);
        continue;
      }
      const tw = p.s.code.length * 6.4 + 6;
      const cands: { x: number; y: number; anchor: 'start' | 'end' | 'middle'; box: [number, number, number, number] }[] = [
        { x: p.x + 15, y: p.y + 4, anchor: 'start', box: [p.x + 13, p.y - 7, p.x + 15 + tw, p.y + 7] },
        { x: p.x - 15, y: p.y + 4, anchor: 'end', box: [p.x - 15 - tw, p.y - 7, p.x - 13, p.y + 7] },
        { x: p.x, y: p.y - 17, anchor: 'middle', box: [p.x - tw / 2, p.y - 28, p.x + tw / 2, p.y - 14] },
        { x: p.x, y: p.y + 25, anchor: 'middle', box: [p.x - tw / 2, p.y + 14, p.x + tw / 2, p.y + 28] },
      ];
      const ok = cands.find((c) => !hit(c.box, -1));
      if (ok) {
        boxes.push(ok.box);
        labels.set(p.s.id, { x: ok.x, y: ok.y, anchor: ok.anchor });
      } else labels.set(p.s.id, null);
    }
    return pts.map((p) => ({ ...p, label: labels.get(p.s.id) ?? null, boxes }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection, sites, t, selectedId, hoverId, w, h]);

  const occupied = placed[0]?.boxes ?? [];
  const cityLabels = useMemo(() => {
    if (!projection) return [];
    const out: { name: string; x: number; y: number; showLabel: boolean }[] = [];
    const taken = [...occupied];
    for (const [name, lng, lat, rank] of CITIES) {
      const [x, y] = proj(lng, lat);
      if (x < view.x0 || x > view.x1 || y < view.y0 || y > view.y1) continue;
      if (rank === 2 && t.k < (compact ? 3 : 1.6)) continue;
      const tw = name.length * 5.6;
      const box: [number, number, number, number] = [x - tw / 2, y + 5, x + tw / 2, y + 17];
      const clash = taken.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]);
      if (!clash) taken.push(box);
      out.push({ name, x, y, showLabel: !clash });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection, t, occupied, compact]);

  const selected = placed.find((p) => p.s.id === selectedId);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!projection) return;
    if (onPick) {
      const r = svgRef.current!.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      if (sx < view.x0 || sx > view.x1 || sy < view.y0 || sy > view.y1) return;
      const [lng, lat] = projection.invert!([t.invertX(sx), t.invertY(sy)]) ?? [0, 0];
      onPick({ lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 });
      return;
    }
    if ((e.target as Element).closest('.pin')) return;
    onSelect?.(null);
  };

  const smallEmirates = t.k >= 2.2;
  const C = 2 * Math.PI * 9;

  return (
    <div className={`sheet ${compact ? 'sheet--compact' : ''} ${onPick ? 'sheet--pick' : ''} ${drawn ? 'is-drawn' : ''}`} ref={wrap}>
      {projection && paths && zones && (
        <svg ref={svgRef} className="sheet__svg" width={w} height={h} onClick={handleClick} role="img" aria-label="Map of the UAE showing site locations">
          <defs>
            <clipPath id="sheet-clip">
              <rect x={view.x0} y={view.y0} width={view.x1 - view.x0} height={view.y1 - view.y0} />
            </clipPath>
          </defs>

          {/* graticule crosses */}
          <g className="sheet__crosses" clipPath="url(#sheet-clip)">
            {zones.xs.flatMap((x, i) =>
              zones.ys.map((y, j) => (
                <path key={`${i}-${j}`} d={`M${x - 4},${y}h8M${x},${y - 4}v8`} />
              )),
            )}
          </g>

          <g clipPath="url(#sheet-clip)">
            <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
              <path className="geo-neighbours" d={paths.neighbours} />
              {paths.emirates.map((e) => (
                <path key={e.name} className="geo-emirate" d={e.d} />
              ))}
              <path className="geo-country" d={paths.country} pathLength={1} />
            </g>

            {LANDS.map(([n, lng, lat]) => {
              const [x, y] = proj(lng, lat);
              const half = n.length * 4.4;
              if (x - half < view.x0 + 4 || x + half > view.x1 - 4 || y < view.y0 + 12 || y > view.y1 - 4) return null;
              // keep clear of the scale bar in the bottom-left corner
              if (scale && x - half < B + 16 + scale.px + 40 && y > h - B - 44) return null;
              return (
                <text key={n} x={x} y={y} className="geo-land-label" textAnchor="middle">
                  {n}
                </text>
              );
            })}
            {!compact && w >= 560 &&
              WATER.map(([n, lng, lat]) => {
                const [x, y] = proj(lng, lat);
                const half = n.length * 3.2;
                if (x - half < view.x0 + 4 || x + half > view.x1 - 4 || y < view.y0 + 12 || y > view.y1 - 4) return null;
                return (
                  <text key={n} x={x} y={y} className="geo-water-label" textAnchor="middle">
                    {n}
                  </text>
                );
              })}
            {EMIRATE_LABELS.filter(([, , , big]) => big || smallEmirates).map(([n, lng, lat, big]) => {
              const [x, y] = proj(lng, lat);
              return (
                <text key={n} x={x} y={y} className={`geo-emirate-label ${big ? 'is-big' : ''}`} textAnchor="middle">
                  {n}
                </text>
              );
            })}
            {!smallEmirates && w >= 560 && (() => {
              const [x, y] = proj(55.72, 25.42);
              const [lx, ly] = proj(54.95, 25.78);
              return (
                <g className="geo-leader">
                  <path d={`M${x},${y} L${lx + 8},${ly + 4} L${lx},${ly + 4}`} />
                  <circle cx={x} cy={y} r={1.8} />
                  <text x={lx - 4} y={ly + 7} className="geo-emirate-label" textAnchor="end">
                    NORTHERN EMIRATES
                  </text>
                </g>
              );
            })()}

            {cityLabels.map((c) => (
              <g key={c.name} className="city">
                <rect x={c.x - 2.5} y={c.y - 2.5} width={5} height={5} />
                {c.showLabel && (
                  <text x={c.x} y={c.y + 14} textAnchor="middle">
                    {c.name}
                  </text>
                )}
              </g>
            ))}

            {/* pins */}
            {placed.map(({ s, i, x, y }) => {
              const isSel = s.id === selectedId;
              const isHover = s.id === hoverId;
              return (
                <g
                  key={s.id}
                  className={`pin pin--${s.status} ${isSel ? 'is-selected' : ''} ${isHover ? 'is-hover' : ''}`}
                  transform={`translate(${x},${y})`}
                  onClick={(e) => {
                    if (onPick) return;
                    e.stopPropagation();
                    onSelect?.(isSel ? null : s.id);
                  }}
                  onMouseEnter={() => onHover?.(s.id)}
                  onMouseLeave={() => onHover?.(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect?.(s.id);
                    }
                  }}
                  tabIndex={onPick ? -1 : 0}
                  role="button"
                  aria-label={`${s.code} ${s.name}, ${Math.round(s.progress * 100)}% complete, ${STATUS_LABEL[s.status]}`}
                  style={{ ['--i' as string]: i }}
                >
                  <g className="pin__body">
                    <circle className="pin__halo" r={16} />
                    <circle className="pin__track" r={9} />
                    <circle
                      className="pin__arc"
                      r={9}
                      strokeDasharray={`${C * s.progress} ${C}`}
                      transform="rotate(-90)"
                    />
                    <circle className="pin__core" r={3.6} />
                  </g>
                </g>
              );
            })}
            {placed.map(({ s, label }) =>
              label && !(s.id === selectedId && !onPick) ? (
                <text
                  key={`l-${s.id}`}
                  className={`pin-label ${s.id === selectedId || s.id === hoverId ? 'is-on' : ''}`}
                  x={label.x}
                  y={label.y}
                  textAnchor={label.anchor}
                >
                  {s.code}
                </text>
              ) : null,
            )}

            {pick && (() => {
              const [x, y] = proj(pick.lng, pick.lat);
              return (
                <g className="pick-mark" transform={`translate(${x},${y})`}>
                  <circle r={10} />
                  <path d="M-16,0h10M6,0h10M0,-16v10M0,6v10" />
                  <circle r={2.5} className="pick-mark__dot" />
                </g>
              );
            })()}
          </g>

          {/* sheet border: zones on top/left, coordinates on bottom/right */}
          <rect className="sheet__outer" x={0.75} y={0.75} width={w - 1.5} height={h - 1.5} />
          <rect className="sheet__inner" x={B} y={B} width={w - 2 * B} height={h - 2 * B} />
          <g className="sheet__ticks">
            {zones.xs.map((x, i) =>
              x > view.x0 && x < view.x1 ? (
                <g key={`tx${i}`}>
                  <path d={`M${x},${B - 7}v7M${x},${h - B}v7`} />
                  {!compact && i % zones.xEvery === 0 && (
                    <text className="sheet__deg" x={x} y={h - 7} textAnchor="middle">
                      {(GRID.lon0 + i * GRID.dLon).toFixed(1)}°E
                    </text>
                  )}
                </g>
              ) : null,
            )}
            {zones.ys.map((y, j) =>
              y > view.y0 && y < view.y1 ? (
                <g key={`ty${j}`}>
                  <path d={`M${B - 7},${y}h7M${w - B},${y}h7`} />
                  {!compact && j % zones.yEvery === 0 && (
                    <text className="sheet__deg" x={w - 11} y={y} textAnchor="middle" transform={`rotate(90 ${w - 11} ${y})`}>
                      {(GRID.lat0 - j * GRID.dLat).toFixed(1)}°N
                    </text>
                  )}
                </g>
              ) : null,
            )}
            {zones.cols.map((c) =>
              c.vis ? (
                <text key={`c${c.label}`} className="sheet__zone" x={c.x} y={15} textAnchor="middle">
                  {c.label}
                </text>
              ) : null,
            )}
            {zones.rows.map((r) =>
              r.vis ? (
                <text key={`r${r.label}`} className="sheet__zone" x={11} y={r.y + 4} textAnchor="middle">
                  {r.label}
                </text>
              ) : null,
            )}
          </g>

          {/* north arrow */}
          <g className="north" transform={`translate(${B + 26},${B + 30})`} aria-hidden>
            <path d="M0,-18 L8,8 L0,3 Z" className="north__fill" />
            <path d="M0,-18 L-8,8 L0,3 Z" className="north__open" />
            <text y={21} textAnchor="middle">N</text>
          </g>

          {/* scale bar */}
          {scale && (
            <g className="scalebar" transform={`translate(${B + 16},${h - B - 18})`} aria-hidden>
              <rect x={0} y={0} width={scale.px / 2} height={4} className="scalebar__fill" />
              <rect x={scale.px / 2} y={0} width={scale.px / 2} height={4} className="scalebar__open" />
              <text x={0} y={-5}>0</text>
              <text x={scale.px} y={-5} textAnchor="middle">{scale.km} km</text>
            </g>
          )}
        </svg>
      )}

      {/* map controls */}
      <div className="sheet__controls">
        <button type="button" onClick={() => zoomBy(1.8)} aria-label="Zoom in">
          <Plus />
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.8)} aria-label="Zoom out">
          <Minus />
        </button>
        <button type="button" onClick={reset} aria-label="Show whole UAE">
          <Maximize2 />
        </button>
      </div>

      {/* title block */}
      {!compact && (
        <div className="titleblock" aria-hidden={false}>
          <div className="titleblock__brand">
            <Lockup layout="row" className="titleblock__logo" />
          </div>
          <div className="titleblock__main">
            <span className="titleblock__title">UAE — Site locations</span>
            <span className="titleblock__sheet">Sheet 01</span>
          </div>
          <div className="titleblock__legend">
            <span><i className="lg lg--active" />Active</span>
            <span><i className="lg lg--snagging" />Snagging</span>
            <span><i className="lg lg--on-hold" />On hold</span>
            <span><i className="lg lg--completed" />Done</span>
            <span className="lg-ring">
              <svg viewBox="-11 -11 22 22" width="14" height="14" aria-hidden>
                <circle r="8" fill="none" stroke="var(--ground-2)" strokeWidth="3" />
                <circle r="8" fill="none" stroke="var(--ink)" strokeWidth="3" strokeDasharray={`${2 * Math.PI * 8 * 0.62} 60`} transform="rotate(-90)" />
              </svg>
              Ring = progress
            </span>
          </div>
          <div className="titleblock__meta">
            <div><span>Drawn</span>{engineer || 'Site engineer'}</div>
            <div><span>Date</span>{dateLabel}</div>
            <div><span>Grid</span>0.5° WGS 84</div>
          </div>
          <div className="titleblock__credit">Boundaries © OpenStreetMap contributors · geoBoundaries</div>
        </div>
      )}

      {/* callout for the selected site */}
      {selected && !onPick && selected.x > view.x0 && selected.x < view.x1 && selected.y > view.y0 && selected.y < view.y1 && (
        <Callout site={selected.s} x={selected.x} y={selected.y} w={w} h={h} onOpen={onOpen} onClose={() => onSelect?.(null)} />
      )}
    </div>
  );
}

function Callout({ site, x, y, w, h, onOpen, onClose }: { site: MapSite; x: number; y: number; w: number; h: number; onOpen?: (id: string) => void; onClose: () => void }) {
  const cw = Math.min(250, w - 2 * B - 24);
  const right = x + 34 + cw < w - B - 8;
  const left = right ? x + 34 : Math.max(B + 8, x - 34 - cw);
  const top = Math.min(Math.max(B + 8, y - 44), h - B - 176);
  const ax = right ? left : left + cw;
  const ay = Math.min(Math.max(top + 22, top + 10), top + 60);
  return (
    <>
      <svg className="callout-leader" width={w} height={h} aria-hidden>
        <path d={`M${x + (right ? 11 : -11)},${y} L${(x + ax) / 2},${ay} L${ax},${ay}`} />
        <circle cx={x + (right ? 11 : -11)} cy={y} r={2} />
      </svg>
      <div className="callout" style={{ left, top, width: cw }} role="dialog" aria-label={site.name}>
        <div className="callout__top">
          <span className="label">
            {site.code} · {gridRef(site.lat, site.lng)}
          </span>
          <button className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="callout__name">{site.name}</div>
        <div className="callout__bars">
          {site.fa !== null && (
            <div className="callout__bar">
              <span className="sys sys--FA">FA</span>
              <div className="bar bar--FA bar--thin"><i style={{ width: `${site.fa * 100}%` }} /></div>
              <b>{Math.round(site.fa * 100)}%</b>
            </div>
          )}
          {site.ff !== null && (
            <div className="callout__bar">
              <span className="sys sys--FF">FF</span>
              <div className="bar bar--FF bar--thin"><i style={{ width: `${site.ff * 100}%` }} /></div>
              <b>{Math.round(site.ff * 100)}%</b>
            </div>
          )}
        </div>
        <div className="callout__foot">
          <span className={`status status--${site.status}`}>{STATUS_LABEL[site.status]}</span>
          <span className="muted small">{site.crew} on site today</span>
        </div>
        {onOpen && (
          <button className="btn btn--primary btn--sm btn--block" onClick={() => onOpen(site.id)}>
            Open site <ArrowRight />
          </button>
        )}
      </div>
    </>
  );
}
