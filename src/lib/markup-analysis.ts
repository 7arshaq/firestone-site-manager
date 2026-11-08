import type Anthropic from '@anthropic-ai/sdk';
import { claude, MODEL, PRICE } from './ai';
import { imageForClaude, markupPages, type PickedDrawing } from './drawing-files';
import type { WorkItem } from '../types';

/** Most sheets read in one request; bigger sets go in several requests */
const PAGES_PER_REQUEST = 24;
/** Most sheets read from one PDF */
export const MAX_MARKUP_PAGES = 60;

export interface MarkupColour {
  colour: string;
  swatch: string;
  meaning: string;
  stage_id: string | null;
}

export interface MarkupPage {
  file: string;
  page: number;
  floor: string;
  system: 'FA' | 'FF' | 'both' | 'unknown';
  coverage: { colour: string; percent: number; basis: string }[];
}

export interface MarkupReading {
  summary: string;
  colours: MarkupColour[];
  pages: MarkupPage[];
  observations: string[];
}

const str = { type: 'string' } as const;
const obj = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

function schema(stageIds: string[]) {
  return obj({
    summary: str,
    colours: {
      type: 'array',
      items: obj({
        colour: str,
        swatch: str,
        meaning: str,
        stage_id: { anyOf: [{ type: 'string', enum: stageIds }, { type: 'null' }] },
      }),
    },
    pages: {
      type: 'array',
      items: obj({
        file: str,
        page: { type: 'integer' },
        floor: str,
        system: { type: 'string', enum: ['FA', 'FF', 'both', 'unknown'] },
        coverage: { type: 'array', items: obj({ colour: str, percent: { type: 'number' }, basis: str }) },
      }),
    },
    observations: { type: 'array', items: str },
  });
}

const SYSTEM = `You read marked-up fire alarm (FA) and fire fighting (FF) drawings on which a UAE site team has highlighted the work already done, so the engineer can report progress without counting every device.

Highlighting may be digital (PDF highlighter, coloured lines, clouds or fills) or drawn with highlighter pens on printed sheets that were then scanned or photographed. Colours mean different things on different sites, so work out each colour's meaning from the evidence.

1. Colours. List every highlight colour used on the sheets with a plain name (yellow, green, pink, orange, blue…) and a hex swatch close to how it looks. Say what it most likely means, using any legend, key, note, stamp, sheet title or file name, and pick the matching stage from the site's stage list — or null when the evidence is unclear. Ignore revision clouds, consultant comments and red-line markups unless a legend says they mark finished work.

2. Pages. For each page give the floor or zone it shows (from the sheet title or title block, e.g. "Level 5", "Basement 2", "Typical floor L6–L20", "Roof"), and whether it is an FA or FF layout. For each colour, estimate the share of the work drawn on that sheet that is highlighted, from 0 to 100: for pipework, the share of the pipe length; for devices (detectors, call points, sounders, sprinkler heads, hose reels), the share of the devices; for cabling or containment, the share of the cable route. Judge by the services drawn, not by floor area. Give 0 when a colour does not appear on the page, and say briefly what you based each estimate on.

3. Observations. Up to 6 short notes on anything that affects the reading: faded or overlapping colours, pages you could not read, sheets that seem to be missing, or highlights that contradict each other.

4. Summary. Two plain sentences on what the highlights show overall.`;

export interface MarkupInput {
  files: PickedDrawing[];
  stages: WorkItem[];
}

type Block = Anthropic.Beta.BetaContentBlockParam;

async function sheets(files: PickedDrawing[], onStage: (s: string) => void) {
  const out: Block[][] = [];
  for (const f of files) {
    if (f.error) continue;
    if (f.kind === 'pdf') {
      onStage(`Preparing ${f.file.name}`);
      const { pages, total } = await markupPages(f.file, MAX_MARKUP_PAGES);
      pages.forEach((p, i) =>
        out.push([
          { type: 'text', text: `File "${f.file.name}", page ${i + 1}${total > MAX_MARKUP_PAGES ? ` (of ${total}, first ${MAX_MARKUP_PAGES} read)` : ''}. Text on the sheet: ${p.text || '(none)'}` },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.image } },
        ]),
      );
    } else if (f.kind === 'image') {
      onStage(`Preparing ${f.file.name}`);
      out.push([
        { type: 'text', text: `File "${f.file.name}", page 1 (photo or scan).` },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await imageForClaude(f.file) } },
      ]);
    }
  }
  return out;
}

export async function readMarkups(input: MarkupInput, onStage: (s: string) => void, signal: AbortSignal) {
  const pages = await sheets(input.files, onStage);
  if (!pages.length) throw new Error('None of these files can be read. Add highlighted PDFs or photos.');
  const stageList = input.stages.map((w) => ({ id: w.id, system: w.system, stage: w.label, unit: w.unit }));
  const client = claude();
  let reading: MarkupReading | null = null;
  let cost = 0;
  const batches = Math.ceil(pages.length / PAGES_PER_REQUEST);

  for (let b = 0; b < batches; b++) {
    onStage(batches > 1 ? `Claude is reading the highlights, part ${b + 1} of ${batches}` : 'Claude is reading the highlights');
    const blocks = pages.slice(b * PAGES_PER_REQUEST, (b + 1) * PAGES_PER_REQUEST).flat();
    const brief = {
      site_stages: stageList,
      ...(reading ? { colours_found_in_earlier_parts: reading.colours } : {}),
    };
    const ask = batches > 1 ? `These are sheets from part ${b + 1} of ${batches} of one marked-up set. Use the same colour names as earlier parts where the colours match.` : 'Read the highlights on these sheets.';
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high', format: { type: 'json_schema', schema: schema(input.stages.map((w) => w.id)) } },
        system: SYSTEM,
        messages: [{ role: 'user', content: [...blocks, { type: 'text', text: `${ask}\n\n${JSON.stringify(brief, null, 1)}` }] }],
      },
      { signal },
    );
    const msg = await stream.finalMessage();
    cost += (msg.usage.input_tokens * PRICE.input + msg.usage.output_tokens * PRICE.output) / 1e6;
    if (msg.stop_reason === 'refusal') throw new Error('Claude declined to read these files. Try removing pages that are not drawings.');
    if (msg.stop_reason === 'max_tokens') throw new Error('Too many sheets to read in one go. Try fewer files at a time.');
    const text = msg.content.find((x): x is Anthropic.Beta.BetaTextBlock => x.type === 'text')?.text;
    if (!text) throw new Error('Claude did not return a reading. Try again.');
    const part = JSON.parse(text) as MarkupReading;
    reading = reading ? merge(reading, part) : part;
  }
  return { reading: tidy(reading!, input.stages), cost };
}

function merge(a: MarkupReading, b: MarkupReading): MarkupReading {
  const colours = [...a.colours];
  for (const c of b.colours) if (!colours.some((x) => x.colour.toLowerCase() === c.colour.toLowerCase())) colours.push(c);
  return {
    summary: [a.summary, b.summary].filter(Boolean).join(' '),
    colours,
    pages: [...a.pages, ...b.pages],
    observations: [...a.observations, ...b.observations].slice(0, 8),
  };
}

function tidy(r: MarkupReading, stages: WorkItem[]): MarkupReading {
  const ids = new Set(stages.map((s) => s.id));
  return {
    summary: r.summary ?? '',
    colours: (r.colours ?? []).map((c) => ({ ...c, stage_id: c.stage_id && ids.has(c.stage_id) ? c.stage_id : null })),
    pages: (r.pages ?? []).map((p) => ({ ...p, coverage: (p.coverage ?? []).map((c) => ({ ...c, percent: Math.max(0, Math.min(100, c.percent)) })) })),
    observations: (r.observations ?? []).slice(0, 8),
  };
}

/**
 * Turns colour coverage into a % per stage, using the engineer's colour → stage choices.
 * A stage's % is the average over the sheets of its system; where two colours point to the
 * same stage, the higher reading on each sheet counts.
 */
export function stagePercents(reading: MarkupReading, mapping: Record<string, string | null>, stages: WorkItem[]) {
  const out = new Map<string, { pct: number; sheets: number }>();
  for (const stage of stages) {
    const colours = Object.entries(mapping)
      .filter(([, id]) => id === stage.id)
      .map(([c]) => c.toLowerCase());
    if (!colours.length) continue;
    const relevant = reading.pages.filter((p) => p.system === stage.system || p.system === 'both' || p.system === 'unknown');
    if (!relevant.length) continue;
    const perSheet = relevant.map((p) => Math.max(0, ...p.coverage.filter((c) => colours.includes(c.colour.toLowerCase())).map((c) => c.percent)));
    out.set(stage.id, { pct: perSheet.reduce((a, v) => a + v, 0) / perSheet.length, sheets: relevant.length });
  }
  return out;
}
