import type Anthropic from '@anthropic-ai/sdk';
import { claude, MODEL, PRICE } from './ai';
import { imageForClaude, MAX_RASTER_PAGES, PDF_INLINE_LIMIT, pdfAsImages, pdfBase64, type PickedDrawing } from './drawing-files';

/* ---------------- What Claude returns ---------------- */

export const FIELD_KEYS = ['name', 'code', 'client', 'contractor', 'consultant', 'emirate', 'area', 'systems'] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export interface Finding {
  key: FieldKey;
  value: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

export interface Question {
  id: string;
  question: string;
  why: string;
  field: FieldKey | 'note';
  options: { label: string; value: string }[];
}

export interface ScopeFinding {
  system: 'FA' | 'FF' | 'general';
  text: string;
  source: string;
}

export interface Analysis {
  summary: string;
  fields: Finding[];
  scope_items: ScopeFinding[];
  location: {
    address_on_drawings: string | null;
    lat: number | null;
    lng: number | null;
    check: 'match' | 'mismatch' | 'unclear' | 'no_location';
    explanation: string;
  };
  drawings: { file: string; sheet: string; title: string; discipline: 'FA' | 'FF' | 'Architectural' | 'Structural' | 'MEP' | 'Other' }[];
  observations: string[];
  questions: Question[];
}

const str = { type: 'string' } as const;
const nullable = (t: 'string' | 'number') => ({ anyOf: [{ type: t }, { type: 'null' }] });
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

const SCHEMA = obj({
  summary: str,
  fields: {
    type: 'array',
    items: obj({
      key: { type: 'string', enum: [...FIELD_KEYS] },
      value: str,
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      source: str,
    }),
  },
  scope_items: {
    type: 'array',
    items: obj({
      system: { type: 'string', enum: ['FA', 'FF', 'general'] },
      text: str,
      source: str,
    }),
  },
  location: obj({
    address_on_drawings: nullable('string'),
    lat: nullable('number'),
    lng: nullable('number'),
    check: { type: 'string', enum: ['match', 'mismatch', 'unclear', 'no_location'] },
    explanation: str,
  }),
  drawings: {
    type: 'array',
    items: obj({
      file: str,
      sheet: str,
      title: str,
      discipline: { type: 'string', enum: ['FA', 'FF', 'Architectural', 'Structural', 'MEP', 'Other'] },
    }),
  },
  observations: { type: 'array', items: str },
  questions: {
    type: 'array',
    items: obj({
      id: str,
      question: str,
      why: str,
      field: { type: 'string', enum: [...FIELD_KEYS, 'note'] },
      options: { type: 'array', items: obj({ label: str, value: str }) },
    }),
  },
});

const SYSTEM = `You help a fire-safety site engineer in the UAE set up a new fire alarm (FA) and fire fighting (FF) installation project from its drawings: shop drawings, IFC or tender drawings, Civil Defence approved sets, schedules and BOQs, as PDFs or photos.

Read every page and return what the drawings actually show. When a value is not shown, leave that field out rather than guessing. Give each value with a confidence and a short source naming the sheet number or title and where on it (title block, legend, device schedule, riser diagram, plan count).

Project details
- name: the project or building name. code: the project or job number. client: the client or employer. contractor: the main contractor. consultant: the consultant or engineer of record.
- emirate: one of Abu Dhabi, Dubai, Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah, Fujairah. area: community, district, sector and plot.

- systems: "FA", "FF" or "FA+FF" — the systems in this drawing set.

Scope list (scope_items)
- The engineer runs the site from a to-do list, not from quantities. Write the scope of work as that list: each item is one plain sentence a foreman can act on, such as "Install addressable smoke detectors on Levels 1–5 (about 320 nos)", "Pull loop cables from the FACP to Block B", "Install sprinkler mains and branches in the basement car park", "Hydrostatic pressure test of the basement zone", "Install and commission the fire pump set".
- Split the work the way a site is worked: by system, then by area or floor and by type of work (containment, cabling, devices, panel, testing; supports, pipework, heads, valves, pumps, testing). Aim for 8 to 40 items for the whole set — not one per device.
- Mention a quantity in brackets only when a schedule, legend or BOQ states it. Do not invent quantities.
- system: FA, FF, or general (for shared work such as builder's work, coordination, documentation or Civil Defence inspections). source: the sheet the item comes from.

Location
- You get the pin the engineer placed, the street address found for that pin, and a satellite picture centred on the pin (red ring). Compare them with the location plan, key plan, address, plot number and title block on the drawings.
- Satellite pictures can be older than the construction, so an empty plot is not a mismatch on its own. Say mismatch only when the drawings clearly point to a different place, and explain why in one or two sentences.
- If the drawings state coordinates, return them as lat and lng; otherwise null. Use no_location when there is no pin.

Questions
- Ask at most 8 short questions, only about project details or the scope of work that the drawings do not settle. Do not ask about anything listed under "Already entered". For a question about the scope, use the field "note".
- Use plain words a site engineer uses on site, each with 2 to 5 short answer options. For a question tied to a field, each option's value must be a valid value for that field. Use the field "note" for anything else worth recording; its option values are short sentences.

Also return
- drawings: every sheet you identified (file name, sheet number, title, discipline).
- observations: up to 8 short notes that matter to the engineer, such as systems outside FA and FF (clean agent, kitchen suppression, foam), phasing, missing sheets, revision status or conflicts between sheets.
- summary: two or three plain sentences on what this project is.`;

/* ---------------- Sending the drawings ---------------- */

export interface AnalysisInput {
  drawings: PickedDrawing[];
  alreadyEntered: Record<string, string | number | boolean>;
  pin: { lat: number; lng: number; address: string | null } | null;
  satellite: string | null;
}

export interface AnalysisProgress {
  stage: string;
  part: number;
  parts: number;
}

type Block = Anthropic.Beta.BetaContentBlockParam;

/** Splits the files into requests that stay under the 32 MB request limit */
async function buildParts(drawings: PickedDrawing[], onStage: (s: string) => void) {
  const parts: Block[][] = [];
  let current: Block[] = [];
  let bytes = 0;
  const BUDGET = 22 * 1024 * 1024;
  const push = (blocks: Block[], size: number) => {
    if (current.length && bytes + size > BUDGET) {
      parts.push(current);
      current = [];
      bytes = 0;
    }
    current.push(...blocks);
    bytes += size;
  };
  for (const d of drawings) {
    if (d.error) continue;
    if (d.kind === 'pdf' && d.file.size <= PDF_INLINE_LIMIT) {
      onStage(`Preparing ${d.file.name}`);
      push([{ type: 'document', title: d.file.name, source: { type: 'base64', media_type: 'application/pdf', data: await pdfBase64(d.file) } }], d.file.size * 1.34);
    } else if (d.kind === 'pdf') {
      onStage(`Turning ${d.file.name} into page pictures`);
      const { pages, total } = await pdfAsImages(d.file);
      const note = total > MAX_RASTER_PAGES ? ` (first ${MAX_RASTER_PAGES} of ${total} pages)` : '';
      pages.forEach((p, i) =>
        push(
          [
            { type: 'text', text: `${d.file.name}${note}, page ${i + 1}:` },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p } },
          ],
          p.length,
        ),
      );
    } else if (d.kind === 'image') {
      onStage(`Preparing ${d.file.name}`);
      const data = await imageForClaude(d.file);
      push([{ type: 'text', text: `Photo or scan: ${d.file.name}` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }], data.length);
    }
  }
  if (current.length) parts.push(current);
  return parts;
}

export interface AnalysisRun {
  result: Analysis;
  cost: number;
}

export async function analyzeDrawings(input: AnalysisInput, onProgress: (p: AnalysisProgress) => void, signal: AbortSignal): Promise<AnalysisRun> {
  const parts = await buildParts(input.drawings, (stage) => onProgress({ stage, part: 0, parts: 0 }));
  if (!parts.length) throw new Error('None of these files can be read. Add PDF drawings or photos.');
  const client = claude();
  let result: Analysis | null = null;
  let cost = 0;

  for (let i = 0; i < parts.length; i++) {
    onProgress({ stage: parts.length > 1 ? `Claude is reading part ${i + 1} of ${parts.length}` : 'Claude is reading the drawings', part: i + 1, parts: parts.length });
    const context: Block[] = [];
    if (input.satellite) {
      context.push({ type: 'text', text: 'Satellite picture centred on the engineer’s pin (red ring):' });
      context.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: input.satellite.slice(input.satellite.indexOf(',') + 1) } });
    }
    const brief = {
      already_entered: input.alreadyEntered,
      pin: input.pin ? { lat: input.pin.lat, lng: input.pin.lng, address_found_for_pin: input.pin.address } : null,
      ...(result ? { findings_from_earlier_parts: result } : {}),
    };
    const ask =
      parts.length > 1
        ? `This is part ${i + 1} of ${parts.length} of one drawing set.${result ? ' Merge what this part shows into the findings from earlier parts and return the complete, updated result.' : ''}`
        : 'Read this drawing set.';

    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: 'user', content: [...parts[i], ...context, { type: 'text', text: `${ask}\n\n${JSON.stringify(brief, null, 1)}` }] }],
      },
      { signal },
    );
    const msg = await stream.finalMessage();
    cost += (msg.usage.input_tokens * PRICE.input + msg.usage.output_tokens * PRICE.output) / 1e6;
    if (msg.stop_reason === 'refusal') throw new Error('Claude declined to read these files. Try removing pages that are not drawings.');
    if (msg.stop_reason === 'max_tokens') throw new Error('The drawing set is too big to read in one go. Try fewer files at a time.');
    const text = msg.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text;
    if (!text) throw new Error('Claude did not return any findings. Try again.');
    result = validate(JSON.parse(text));
  }
  return { result: result!, cost };
}

/** Keeps only well-formed entries (the schema is enforced by the API; this guards against surprises) */
function validate(raw: Analysis): Analysis {
  const keys = new Set<string>(FIELD_KEYS);
  return {
    summary: String(raw.summary ?? ''),
    fields: (raw.fields ?? []).filter((f) => keys.has(f.key) && typeof f.value === 'string' && f.value.trim()),
    scope_items: (raw.scope_items ?? []).filter((x) => typeof x.text === 'string' && x.text.trim()),
    location: raw.location ?? { address_on_drawings: null, lat: null, lng: null, check: 'unclear', explanation: '' },
    drawings: raw.drawings ?? [],
    observations: (raw.observations ?? []).slice(0, 8),
    questions: (raw.questions ?? []).filter((q) => q.options?.length).slice(0, 8),
  };
}

/* ---------------- Putting findings into the form ---------------- */

const EMIRATES = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];

/** Turns a text value into the form's own value for that field, or null when it doesn't fit */
export function parseField(key: FieldKey, value: string): string | string[] | null {
  const v = value.trim();
  const low = v.toLowerCase();
  switch (key) {
    case 'name':
    case 'code':
    case 'client':
    case 'contractor':
    case 'consultant':
    case 'area':
      return v || null;
    case 'emirate':
      return EMIRATES.find((e) => low.includes(e.toLowerCase())) ?? null;
    case 'systems': {
      const s = [low.includes('fa') || low.includes('alarm') ? 'FA' : '', low.includes('ff') || low.includes('fighting') || low.includes('sprinkler') ? 'FF' : ''].filter(Boolean);
      return s.length ? s : null;
    }
  }
}

export const FIELD_LABEL: Record<FieldKey, string> = {
  name: 'Site name', code: 'Project code', client: 'Client', contractor: 'Main contractor', consultant: 'Consultant',
  emirate: 'Emirate', area: 'Area', systems: 'Systems',
};

/* ---------------- Re-checking the location only ---------------- */

const LOCATION_SCHEMA = obj({
  check: { type: 'string', enum: ['match', 'mismatch', 'unclear'] },
  explanation: str,
});

/** Compares a moved pin with what the drawings said — small and cheap, the drawings are not sent again */
export async function checkLocation(
  input: { summary: string; addressOnDrawings: string | null; pin: { lat: number; lng: number; address: string | null }; satellite: string | null },
  signal: AbortSignal,
): Promise<{ check: 'match' | 'mismatch' | 'unclear'; explanation: string; cost: number }> {
  const content: Block[] = [];
  if (input.satellite) {
    content.push({ type: 'text', text: 'Satellite picture centred on the pin (red ring):' });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: input.satellite.slice(input.satellite.indexOf(',') + 1) } });
  }
  content.push({
    type: 'text',
    text: `Does this pin match the project in the drawings? Satellite pictures can be older than construction, so an empty plot is not a mismatch on its own. Answer mismatch only when the place clearly differs, and explain in one or two plain sentences.\n\n${JSON.stringify({ project: input.summary, address_on_drawings: input.addressOnDrawings, pin: input.pin })}`,
  });
  const stream = claude().beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: LOCATION_SCHEMA } },
      messages: [{ role: 'user', content }],
    },
    { signal },
  );
  const msg = await stream.finalMessage();
  const cost = (msg.usage.input_tokens * PRICE.input + msg.usage.output_tokens * PRICE.output) / 1e6;
  const text = msg.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text;
  if (msg.stop_reason !== 'end_turn' || !text) throw new Error('The location could not be checked. Try again.');
  return { ...(JSON.parse(text) as { check: 'match' | 'mismatch' | 'unclear'; explanation: string }), cost };
}
