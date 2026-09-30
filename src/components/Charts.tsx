import { useLayoutEffect, useRef, useState } from 'react';
import { fmtDay } from '../lib/util';

/** Single-series progress trend: 2px line, 10% wash, hairline grid, crosshair tooltip. */
export function TrendChart({ data, height = 150, label }: { data: { date: string; value: number }[]; height?: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current!);
    return () => ro.disconnect();
  }, []);

  const pad = { l: 34, r: 44, t: 12, b: 24 };
  const iw = Math.max(0, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const vals = data.map((d) => d.value);
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 0.02) * 20) / 20);
  const hi = Math.min(1, Math.ceil((Math.max(...vals) + 0.02) * 20) / 20);
  const span = Math.max(0.05, hi - lo);
  const x = (i: number) => pad.l + (data.length > 1 ? (i / (data.length - 1)) * iw : iw / 2);
  const y = (v: number) => pad.t + ih - ((v - lo) / span) * ih;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join('');
  const area = `${line}L${x(data.length - 1)},${pad.t + ih}L${x(0)},${pad.t + ih}Z`;
  const ticks = [lo, lo + span / 2, hi];
  const last = data[data.length - 1];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - pad.l) / Math.max(1, iw)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div className="chart" ref={ref}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} className="chart__grid" />
              <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" className="chart__tick">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % Math.ceil(data.length / 5) === 0 || i === data.length - 1 ? (
              <text key={d.date} x={x(i)} y={height - 6} textAnchor="middle" className="chart__tick">
                {fmtDay(d.date).slice(4)}
              </text>
            ) : null,
          )}
          <path d={area} className="chart__area" />
          <path d={line} className="chart__line" />
          <circle cx={x(data.length - 1)} cy={y(last.value)} r={4} className="chart__dot" />
          <text x={x(data.length - 1) + 9} y={y(last.value) + 4} className="chart__end">
            {Math.round(last.value * 100)}%
          </text>
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="chart__cross" />
              <circle cx={x(hover)} cy={y(data[hover].value)} r={4} className="chart__dot" />
            </g>
          )}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <div className="chart__tip" style={{ left: Math.min(Math.max(x(hover), 70), w - 70), top: 0 }}>
          <span>{fmtDay(data[hover].date)}</span>
          <b>{(data[hover].value * 100).toFixed(1)}%</b>
          {hover > 0 && (
            <span className="muted">
              {(data[hover].value - data[hover - 1].value >= 0 ? '+' : '') + ((data[hover].value - data[hover - 1].value) * 100).toFixed(1)}% that day
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Horizontal magnitude bars with value at the tip; hover shows the exact figure. */
export function HBars({ rows, format, color = 'var(--ink)' }: { rows: { label: string; value: number; note?: string }[]; format: (n: number) => string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars" role="table">
      {rows.map((r) => (
        <div className="hbars__row" role="row" key={r.label} title={`${r.label}: ${format(r.value)}${r.note ? ` · ${r.note}` : ''}`}>
          <span className="hbars__label" role="cell">{r.label}</span>
          <span className="hbars__track" role="cell">
            <i style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </span>
          <span className="hbars__value mono" role="cell">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
