import type { MaterialLine, Site } from '../types';

/** Shared quantity take-off used by both the scope (work items) and the materials list. */

export const PIPE_SPLIT: [number, number][] = [
  [25, 0.38],
  [32, 0.17],
  [40, 0.12],
  [50, 0.12],
  [65, 0.08],
  [80, 0.05],
  [100, 0.05],
  [150, 0.03],
];

/** NFPA 13 maximum hanger spacing for steel pipe, metres */
const hangerSpacing = (dn: number) => (dn <= 32 ? 3.7 : 4.6);

export interface FADerived {
  voidDet: number;
  devices: number;
  cable: number;
  conduit: number;
}

export function faDerived(site: Site): FADerived {
  const c = site.conditions;
  const fa = site.fa;
  const voidFactor = c.ceiling === 'false-ceiling' ? 1 : c.ceiling === 'mixed' ? 0.5 : 0;
  const voidDet = c.voidDepth > 0.8 ? Math.ceil(fa.smoke * voidFactor * 0.7) : 0;
  const devices = fa.smoke + fa.heat + voidDet + fa.mcp + fa.sounders + fa.modules + fa.beam;
  if (devices === 0) return { voidDet, devices, cable: 0, conduit: 0 };
  const drop = Math.max(0, c.ceilingHeight - 3);
  const levels = Math.max(1, c.floors + c.basements);
  const riser = levels > 1 ? levels * Math.max(3.2, c.ceilingHeight) * 2 * Math.max(1, fa.loops) : 0;
  const cable = Math.ceil((devices * (7.5 + drop) + riser) * 1.1);
  return { voidDet, devices, cable, conduit: Math.ceil(cable * 0.85) };
}

export interface FFDerived {
  pipes: { dn: number; m: number }[];
  smallM: number;
  largeM: number;
  hangers: number;
}

export function ffDerived(site: Site): FFDerived {
  const total = site.ff.pipeMeters;
  const pipes = PIPE_SPLIT.map(([dn, share]) => ({ dn, m: Math.round(total * share) }));
  const smallM = pipes.filter((p) => p.dn <= 50).reduce((s, p) => s + p.m, 0);
  const largeM = pipes.filter((p) => p.dn > 50).reduce((s, p) => s + p.m, 0);
  const hangers = pipes.reduce((s, p) => s + Math.ceil(p.m / hangerSpacing(p.dn)), 0);
  return { pipes, smallM, largeM, hangers };
}

export function spareSprinklers(heads: number) {
  if (heads <= 0) return 0;
  if (heads <= 300) return 6;
  if (heads <= 1000) return 12;
  return 24;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export const BULB = {
  68: { color: '#D0271D', label: '68 °C red bulb' },
  79: { color: '#E8B400', label: '79 °C yellow bulb' },
  93: { color: '#2E8B3E', label: '93 °C green bulb' },
} as const;

export interface Estimate {
  lines: MaterialLine[];
  advisories: string[];
}

export function estimateMaterials(site: Site): Estimate {
  const lines: MaterialLine[] = [];
  const advisories: string[] = [];
  const c = site.conditions;
  const push = (l: Omit<MaterialLine, 'qty'> & { qty: number }) => {
    if (l.qty > 0) lines.push(l);
  };

  if (c.ceilingHeight > 4) {
    const sys = site.systems.includes('FF') ? 'FF' : 'FA';
    push({
      key: 'site.access',
      system: sys,
      group: `${sys} · Access equipment`,
      name: c.ceilingHeight > 8 ? 'Scissor lift / boom lift (rental)' : 'Mobile scaffold tower (rental)',
      unit: 'set',
      qty: c.ceilingHeight > 8 ? 2 : 1,
      basis: `Working height ${c.ceilingHeight} m is above safe ladder height`,
    });
  }

  if (site.systems.includes('FA')) {
    const fa = site.fa;
    const d = faDerived(site);
    const voidFactor = c.ceiling === 'false-ceiling' ? 1 : c.ceiling === 'mixed' ? 0.5 : 0;

    if (c.ceilingHeight > 10.5 && fa.smoke > 0) {
      advisories.push(
        `Ceiling at ${c.ceilingHeight} m — point smoke detectors lose effectiveness above about 10.5 m. Check that beam detectors cover the high areas.`,
      );
    }
    if (d.voidDet > 0) {
      advisories.push(
        `Ceiling void is ${c.voidDepth} m, deeper than 800 mm — void detectors and remote indicator LEDs are included.`,
      );
    }

    const g1 = 'FA · Devices';
    push({ key: 'fa.smoke', system: 'FA', group: g1, name: 'Addressable optical smoke detector', unit: 'nos', qty: fa.smoke, basis: 'From approved drawings' });
    push({ key: 'fa.heat', system: 'FA', group: g1, name: 'Addressable heat detector', unit: 'nos', qty: fa.heat, basis: 'From approved drawings' });
    push({ key: 'fa.void', system: 'FA', group: g1, name: 'Smoke detector — ceiling void', unit: 'nos', qty: d.voidDet, basis: `Void ${c.voidDepth} m > 0.8 m · ~70% of room detectors` });
    push({ key: 'fa.ril', system: 'FA', group: g1, name: 'Remote indicator LED', unit: 'nos', qty: d.voidDet, basis: 'One per concealed void detector' });
    push({ key: 'fa.bases', system: 'FA', group: g1, name: 'Detector mounting base', unit: 'nos', qty: fa.smoke + fa.heat + d.voidDet, basis: 'One per point detector' });
    push({ key: 'fa.beam', system: 'FA', group: g1, name: 'Reflective beam detector', unit: 'nos', qty: fa.beam, basis: 'From approved drawings' });
    push({ key: 'fa.mcp', system: 'FA', group: g1, name: 'Manual call point with back box', unit: 'nos', qty: fa.mcp, basis: 'From approved drawings' });
    push({ key: 'fa.sounders', system: 'FA', group: g1, name: 'Sounder / strobe with base', unit: 'nos', qty: fa.sounders, basis: 'From approved drawings' });
    push({ key: 'fa.modules', system: 'FA', group: g1, name: 'Input / output interface module', unit: 'nos', qty: fa.modules, basis: 'Lifts, AHUs, dampers, pumps, access control' });
    push({ key: 'fa.panel', system: 'FA', group: g1, name: 'Fire alarm control panel', unit: 'nos', qty: fa.panels, basis: `${fa.loops} loop(s) total` });
    push({ key: 'fa.batteries', system: 'FA', group: g1, name: 'Standby battery 12 V', unit: 'nos', qty: fa.panels * 2, basis: 'Two per panel · confirm Ah from battery calc' });

    const g2 = 'FA · Cable & containment';
    const drums = Math.ceil(d.cable / 100) * 100;
    push({
      key: 'fa.cable', system: 'FA', group: g2, name: 'Fire-rated cable 2C × 1.5 mm²', unit: 'm', qty: drums,
      basis: `${fmt(d.devices)} devices × ${(7.5 + Math.max(0, c.ceilingHeight - 3)).toFixed(1)} m + risers + 10% · 100 m drums`,
    });
    push({ key: 'fa.power', system: 'FA', group: g2, name: 'Power cable 3C × 2.5 mm² (panel supply)', unit: 'm', qty: fa.panels * 30, basis: '30 m per panel to nearest DB' });

    const exposedShare = c.ceiling === 'exposed' ? 1 : c.ceiling === 'mixed' ? 0.5 : 0;
    const giM = d.conduit * exposedShare;
    const pvcM = d.conduit - giM;
    const giLen = Math.ceil(giM / 3.75);
    const pvcLen = Math.ceil(pvcM / 2.9);
    push({ key: 'fa.gi', system: 'FA', group: g2, name: 'GI conduit 20 mm (3.75 m lengths)', unit: 'lengths', qty: giLen, basis: `${fmt(Math.round(giM))} m exposed run` });
    push({ key: 'fa.pvc', system: 'FA', group: g2, name: 'PVC conduit 20 mm (2.9 m lengths)', unit: 'lengths', qty: pvcLen, basis: `${fmt(Math.round(pvcM))} m concealed / in void` });
    push({ key: 'fa.couplers', system: 'FA', group: g2, name: 'Conduit couplers 20 mm', unit: 'nos', qty: giLen + pvcLen, basis: 'One per conduit length' });
    push({ key: 'fa.saddles', system: 'FA', group: g2, name: 'Spacer bar saddles 20 mm', unit: 'nos', qty: Math.ceil(d.conduit / 1.2), basis: 'One every 1.2 m of conduit' });
    push({ key: 'fa.jbox', system: 'FA', group: g2, name: 'Circular junction box 20 mm', unit: 'nos', qty: Math.ceil(d.devices * 1.1), basis: 'One per device + 10%' });
    push({
      key: 'fa.flex', system: 'FA', group: g2, name: 'Flexible conduit 20 mm', unit: 'm',
      qty: Math.ceil((fa.smoke + fa.heat) * voidFactor * 1.5), basis: '1.5 m drop per device in false ceiling',
    });
    push({ key: 'fa.glands', system: 'FA', group: g2, name: 'Cable glands 20 mm', unit: 'nos', qty: fa.panels * (fa.loops * 2 + 4), basis: 'Loop out/return + power per panel' });
    push({ key: 'fa.anchors', system: 'FA', group: g2, name: 'Anchors & screws (box of 100)', unit: 'boxes', qty: Math.ceil((Math.ceil(d.conduit / 1.2) + d.devices) / 100), basis: 'Saddles + boxes' });
    push({ key: 'fa.ties', system: 'FA', group: g2, name: 'Cable ties, labels & ferrules', unit: 'packs', qty: Math.ceil(d.devices / 50), basis: 'One pack per 50 devices' });
  }

  if (site.systems.includes('FF')) {
    const ff = site.ff;
    const d = ffDerived(site);

    if (ff.sprinklers > 0 && ff.pipeMeters === 0) {
      advisories.push('Enter the fire fighting pipe length in the scope to estimate pipes, fittings and hangers.');
    }
    if (!c.conditioned && ff.sprinklers > 0) {
      advisories.push('Space is not air-conditioned — main sprinklers are rated 79 °C (yellow bulb) instead of 68 °C.');
    }
    if (c.structure === 'steel' && d.hangers > 0) {
      advisories.push('Steel structure — hangers fixed with beam clamps instead of drop-in anchors.');
    }

    const g1 = 'FF · Pipes & fittings';
    for (const p of d.pipes) {
      push({
        key: `ff.pipe${p.dn}`, system: 'FF', group: g1, name: `Black steel pipe Sch 40 — ${p.dn} mm`, unit: 'lengths',
        qty: Math.ceil((p.m * 1.05) / 6), basis: `${fmt(p.m)} m + 5% offcuts · 6 m lengths · ${p.dn <= 50 ? 'threaded' : 'grooved'}`,
      });
    }
    const threaded = Math.ceil(d.smallM / 3.5);
    push({ key: 'ff.threaded', system: 'FF', group: g1, name: 'Threaded fittings 25–50 mm (elbows, tees, reducers)', unit: 'nos', qty: threaded, basis: 'One every 3.5 m of small-bore pipe' });
    push({ key: 'ff.grooved', system: 'FF', group: g1, name: 'Grooved couplings 65–150 mm', unit: 'nos', qty: Math.ceil(d.largeM / 6), basis: 'One per 6 m length' });
    push({ key: 'ff.groovedFit', system: 'FF', group: g1, name: 'Grooved elbows & tees 65–150 mm', unit: 'nos', qty: Math.ceil(d.largeM / 9), basis: 'One every 9 m of large-bore pipe' });
    push({ key: 'ff.ptfe', system: 'FF', group: g1, name: 'PTFE tape & thread sealant', unit: 'rolls', qty: Math.ceil((threaded * 2) / 15), basis: '15 threaded joints per roll' });

    const g2 = 'FF · Sprinklers';
    const n = ff.sprinklers;
    const hot = Math.ceil(n * 0.05);
    const main = n - hot;
    const temp = c.conditioned ? 68 : 79;
    const pendShare = c.ceiling === 'false-ceiling' ? 1 : c.ceiling === 'mixed' ? 0.6 : 0;
    const pendent = Math.round(main * pendShare);
    const upright = main - pendent;
    push({
      key: `ff.pendent${temp}`, system: 'FF', group: g2, name: `Pendent sprinkler, recessed, K5.6 — ${temp} °C`, unit: 'nos', qty: pendent,
      basis: `${Math.round(pendShare * 100)}% of heads under false ceiling`, bulb: BULB[temp].color,
    });
    push({
      key: `ff.upright${temp}`, system: 'FF', group: g2, name: `Upright sprinkler K5.6 — ${temp} °C`, unit: 'nos', qty: upright,
      basis: `${Math.round((1 - pendShare) * 100)}% of heads on exposed pipe`, bulb: BULB[temp].color,
    });
    push({
      key: 'ff.hot93', system: 'FF', group: g2, name: 'Upright sprinkler K5.6 — 93 °C', unit: 'nos', qty: hot,
      basis: '~5% for plant rooms, kitchens, roof spaces', bulb: BULB[93].color,
    });
    push({ key: 'ff.spares', system: 'FF', group: g2, name: 'Spare sprinklers (all types, in cabinet)', unit: 'nos', qty: spareSprinklers(n), basis: `NFPA 13: ${fmt(n)} heads → at least ${spareSprinklers(n)} spares` });
    push({ key: 'ff.cabinet', system: 'FF', group: g2, name: 'Spare sprinkler cabinet with wrench', unit: 'set', qty: n > 0 ? 1 : 0, basis: 'NFPA 13 requirement' });
    push({ key: 'ff.drops', system: 'FF', group: g2, name: 'Flexible sprinkler drop 1.2 m', unit: 'nos', qty: pendent, basis: 'One per pendent in false ceiling' });
    push({ key: 'ff.reducers', system: 'FF', group: g2, name: 'Reducing coupling 25 × 15 mm', unit: 'nos', qty: upright + hot, basis: 'One per upright head' });

    const g3 = 'FF · Supports';
    const rodPer = c.ceiling === 'exposed' ? 0.5 : Math.max(0.3, c.voidDepth * 0.6);
    push({ key: 'ff.hangers', system: 'FF', group: g3, name: 'Pipe hangers (clevis / ring), sized to pipe', unit: 'nos', qty: d.hangers, basis: 'NFPA 13 spacing: 3.7 m up to 32 mm, 4.6 m from 40 mm' });
    push({ key: 'ff.rod', system: 'FF', group: g3, name: 'Threaded rod M10 (3 m lengths)', unit: 'lengths', qty: Math.ceil((d.hangers * rodPer) / 3), basis: `${rodPer.toFixed(1)} m drop per hanger` });
    if (c.structure === 'steel') {
      push({ key: 'ff.clamps', system: 'FF', group: g3, name: 'Beam clamp M10', unit: 'nos', qty: d.hangers, basis: 'Steel structure · one per hanger' });
    } else {
      push({ key: 'ff.anchors', system: 'FF', group: g3, name: 'Drop-in anchor M10', unit: 'nos', qty: d.hangers, basis: 'Concrete slab · one per hanger' });
    }
    push({ key: 'ff.nuts', system: 'FF', group: g3, name: 'Nuts & washers M10', unit: 'sets', qty: d.hangers * 2, basis: 'Two per hanger' });

    const g4 = 'FF · Valves & equipment';
    const z = ff.alarmValves;
    push({ key: 'ff.alarmValve', system: 'FF', group: g4, name: 'Alarm / zone control valve assembly', unit: 'sets', qty: z, basis: 'From approved drawings' });
    push({ key: 'ff.flow', system: 'FF', group: g4, name: 'Flow switch', unit: 'nos', qty: z, basis: 'One per zone' });
    push({ key: 'ff.tamper', system: 'FF', group: g4, name: 'Tamper switch', unit: 'nos', qty: z, basis: 'One per supervised valve' });
    push({ key: 'ff.gauge', system: 'FF', group: g4, name: 'Pressure gauge 0–300 psi', unit: 'nos', qty: z * 2, basis: 'Two per zone valve' });
    push({ key: 'ff.itv', system: 'FF', group: g4, name: "Inspector's test & drain valve", unit: 'nos', qty: z, basis: 'One per zone' });
    push({ key: 'ff.hoseReel', system: 'FF', group: g4, name: 'Hose reel cabinet (30 m × 25 mm)', unit: 'nos', qty: ff.hoseReels, basis: 'From approved drawings' });
    push({ key: 'ff.landing', system: 'FF', group: g4, name: 'Landing valve 65 mm', unit: 'nos', qty: ff.landingValves, basis: 'From approved drawings' });
    push({ key: 'ff.hydrant', system: 'FF', group: g4, name: 'External fire hydrant (2-way)', unit: 'nos', qty: ff.hydrants, basis: 'From approved drawings' });
    push({ key: 'ff.pumpset', system: 'FF', group: g4, name: 'Fire pump set (electric + diesel + jockey)', unit: 'sets', qty: ff.pumpSets, basis: 'From approved drawings' });
    push({ key: 'ff.ext', system: 'FF', group: g4, name: 'Portable extinguishers (DCP / CO₂)', unit: 'nos', qty: ff.extinguishers, basis: 'From approved drawings' });

    const g5 = 'FF · Testing & finishing';
    push({ key: 'ff.testpump', system: 'FF', group: g5, name: 'Hydrostatic test pump with gauge (rental)', unit: 'set', qty: ff.pipeMeters > 0 ? 1 : 0, basis: 'NFPA 13: 200 psi held for 2 hours' });
    push({ key: 'ff.primer', system: 'FF', group: g5, name: 'Red oxide primer', unit: 'tins (4 L)', qty: Math.ceil((ff.pipeMeters * 0.014 * 1.1) / 4), basis: 'One coat · 10 m² per litre' });
    push({ key: 'ff.enamel', system: 'FF', group: g5, name: 'Red enamel paint RAL 3000', unit: 'tins (4 L)', qty: Math.ceil((ff.pipeMeters * 0.028 * 1.1) / 4), basis: 'Two coats · 10 m² per litre' });
    push({ key: 'ff.markers', system: 'FF', group: g5, name: 'Pipe ID labels & flow arrows', unit: 'nos', qty: Math.ceil(ff.pipeMeters / 6), basis: 'One every 6 m' });
  }

  return { lines, advisories };
}
