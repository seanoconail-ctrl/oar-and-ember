/**
 * The sea map's content (Book 2 section 09; Stage 13, decisions S13-1 to S13-17), and its
 * validator, for `content/sea.json`:
 *
 * - **Nodes**: the ten places of Book 4 section 01 and the two hazard nodes the routes pass
 *   (`HAZ_CAULDRON`, `HAZ_BLUEMEN`). Their chart positions are the chart's (content/launch.json
 *   `seaMap`), so they are drawn and sailed from one set of numbers.
 * - **Edges**: the fourteen routes of Book 10 section 02 by their `SEA_` IDs, with their ends, the
 *   areas they pass (Rán's Reach, Manannán's Mist), whether they are known at the start, the tide
 *   gate and the encounter table. Base watches, exposure and winter are Book 10's, never here.
 * - **Encounter tables** (`ENC_`): each entry's words, what it needs and whether it is
 *   supernatural; its weight is Book 10's ("Encounter weights").
 * - **Landings**: a place whose arrival hands off to a scenario (Carrick Landing's, a stub until
 *   Stage 16), and the story gate a course there starts.
 * - **Words**: the string keys of the sea map's refusals, holds, choice and shortage.
 *
 * This file stands alone (no import of registry.ts), as raidSchema.ts does.
 */
import { arrayOf, bool, id, int, object, oneOf, recordOf, ref, text } from './schema.ts';
import type { Check } from './schema.ts';

type Out<C> = C extends Check<infer T> ? T : never;

export const SEA_NODE_KINDS = ['PLACE', 'WAYPOINT', 'HAZARD'] as const;
export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export const SEA_VISIBILITY = ['CLEAR', 'HAZE', 'FOG', 'NIGHT'] as const;
/** The refusals, holds and other words the sea map says (each a string key in `words`). */
export const SEA_WORDS = [
  'UNKNOWN_PLACE',
  'HERE',
  'INLAND',
  'NO_KNOWN_ROUTE',
  'WINTER',
  'NO_WAY',
  'NOT_READY',
  'AT_SEA',
  'NOT_AT_SEA',
  'FIXED_NIGHT',
  'NO_PLAN',
  'NO_CREW',
  'NOT_SAFE',
  'BUSY',
  'HOLD_TIDE',
  'HOLD_WINTER',
  'HOLD_SHELTER',
  'CHOICE_RISING',
  'PRESS_ON',
  'SHELTER',
  'STORES_SHORT',
  'STORM',
  'ARRIVED',
  'HOME',
] as const;
export type SeaWord = (typeof SEA_WORDS)[number];

const nodeCheck = object({ id: text, kind: oneOf(SEA_NODE_KINDS) });
const edgeCheck = object(
  {
    id: id(['SEA']),
    a: text,
    b: text,
    hazards: arrayOf(ref('hazard')),
    known: bool,
    encounterTable: id(['ENC']),
    tideGate: object({ passableAt: oneOf(['SLACK', 'FLOOD', 'EBB'] as const), at: ref('hazard') }),
  },
  ['tideGate'],
);
const sceneCheck = object({
  kind: oneOf(['ON_FOOT', 'SEA_BATTLE'] as const),
  scenario: id(['SCN']),
});
const entryCheck = object(
  {
    key: text,
    textKey: ref('string'),
    supernatural: bool,
    /** Placed on its edges by the story: it comes first when it applies (the wreck). */
    story: bool,
    oneShot: bool,
    edges: arrayOf(id(['SEA'])),
    seasons: arrayOf(oneOf(SEASON_NAMES)),
    chapters: arrayOf(id(['CH'])),
    minStrength: int(0, 4),
    visibility: arrayOf(oneOf(SEA_VISIBILITY)),
    needsFacts: arrayOf(text),
    withoutFacts: arrayOf(text),
    ledgerHas: arrayOf(text),
    ledgerLacks: arrayOf(text),
    scene: sceneCheck,
  },
  [
    'supernatural',
    'story',
    'oneShot',
    'edges',
    'seasons',
    'chapters',
    'minStrength',
    'visibility',
    'needsFacts',
    'withoutFacts',
    'ledgerHas',
    'ledgerLacks',
    'scene',
  ],
);
const tableCheck = object({ entries: arrayOf(entryCheck) });
const landingCheck = object(
  {
    place: ref('place'),
    scenario: id(['SCN']),
    gate: id(['BEAT']),
    chapter: id(['CH']),
    checkpoint: text,
    textKey: ref('string'),
    /** The stage that builds the landing's scene; until then it is a stub. */
    stubUntilStage: int(13, 38),
  },
  ['gate', 'chapter', 'checkpoint', 'stubUntilStage'],
);

export const seaCheck = object({
  about: text,
  home: ref('place'),
  nodes: arrayOf(nodeCheck),
  edges: arrayOf(edgeCheck),
  tables: recordOf(id(['ENC']), tableCheck),
  landings: arrayOf(landingCheck),
  words: recordOf(oneOf(SEA_WORDS), ref('string')),
});

export type SeaDef = Out<typeof seaCheck>;
export type SeaEdgeDef = SeaDef['edges'][number];
export type SeaEntryDef = SeaDef['tables'][string]['entries'][number];
export type SeaLandingDef = SeaDef['landings'][number];

export function parseSea(json: unknown, path: string, ctx: Parameters<Check<unknown>>[2]) {
  if (json === undefined || json === null) return null;
  return seaCheck(json, path, ctx);
}

/** What the sea content must agree with beyond its own shape (checked in registry.ts). */
export interface SeaCrossCheck {
  readonly places: ReadonlySet<string>;
  readonly hazards: ReadonlySet<string>;
  readonly chart: { readonly places: ReadonlySet<string>; readonly hazards: ReadonlySet<string> };
  readonly registered: (id: string) => boolean;
  /** Book 10 section 02: route ID to its tide gate (from the routes table's notes). */
  readonly routes: ReadonlyMap<string, { readonly tideGateSlack: boolean }>;
  /** Book 10 section 02: table ID to its entries' keys. */
  readonly weights: ReadonlyMap<string, ReadonlySet<string>>;
}

/** Every disagreement between content/sea.json, the books' tables, the chart and the registry. */
export function seaProblems(sea: SeaDef, x: SeaCrossCheck): { path: string; reason: string }[] {
  const out: { path: string; reason: string }[] = [];
  const nodes = new Map(sea.nodes.map((n) => [n.id, n]));
  sea.nodes.forEach((n, i) => {
    if (n.kind === 'PLACE') {
      if (!x.places.has(n.id)) out.push({ path: `nodes[${i}]`, reason: `unknown place "${n.id}"` });
      if (!x.chart.places.has(n.id))
        out.push({
          path: `nodes[${i}]`,
          reason: `"${n.id}" has no chart position (launch.json seaMap)`,
        });
    } else if (n.kind === 'HAZARD') {
      if (!x.hazards.has(n.id))
        out.push({ path: `nodes[${i}]`, reason: `unknown hazard "${n.id}"` });
      if (!x.chart.hazards.has(n.id))
        out.push({
          path: `nodes[${i}]`,
          reason: `"${n.id}" has no chart position (launch.json seaMap)`,
        });
    }
  });
  if (!nodes.has(sea.home)) out.push({ path: 'home', reason: `"${sea.home}" is not a node` });
  const seen = new Set<string>();
  sea.edges.forEach((e, i) => {
    const at = `edges[${i}]`;
    if (seen.has(e.id)) out.push({ path: at, reason: `"${e.id}" is defined twice` });
    seen.add(e.id);
    for (const end of [e.a, e.b])
      if (!nodes.has(end)) out.push({ path: at, reason: `"${end}" is not a node` });
    if (e.a === e.b) out.push({ path: at, reason: 'an edge joins two different nodes' });
    if (!x.registered(e.id)) out.push({ path: at, reason: `"${e.id}" is not in the ID registry` });
    const row = x.routes.get(e.id);
    if (row === undefined)
      out.push({ path: at, reason: `Book 10 section 02 has no route "${e.id}"` });
    else if (row.tideGateSlack !== (e.tideGate?.passableAt === 'SLACK'))
      out.push({ path: at, reason: `the tide gate does not match Book 10's route "${e.id}"` });
    if (e.tideGate !== undefined && e.tideGate.at !== e.a && e.tideGate.at !== e.b)
      out.push({ path: `${at}.tideGate.at`, reason: 'a tide gate guards one of its own ends' });
    if (sea.tables[e.encounterTable] === undefined)
      out.push({ path: `${at}.encounterTable`, reason: `no table "${e.encounterTable}"` });
  });
  for (const id of x.routes.keys())
    if (!seen.has(id)) out.push({ path: 'edges', reason: `Book 10's route "${id}" has no edge` });
  for (const [tid, table] of Object.entries(sea.tables)) {
    if (!x.registered(tid))
      out.push({ path: `tables.${tid}`, reason: `"${tid}" is not in the ID registry` });
    const weights = x.weights.get(tid);
    if (weights === undefined) {
      out.push({ path: `tables.${tid}`, reason: `Book 10 has no encounter weights for "${tid}"` });
      continue;
    }
    const keys = new Set(table.entries.map((e) => e.key));
    for (const k of weights)
      if (!keys.has(k))
        out.push({ path: `tables.${tid}`, reason: `Book 10 weighs "${k}", which has no entry` });
    table.entries.forEach((entry, j) => {
      const at = `tables.${tid}.entries[${j}]`;
      if (!weights.has(entry.key))
        out.push({ path: at, reason: `Book 10 gives "${entry.key}" no weight` });
      for (const edge of entry.edges ?? [])
        if (!seen.has(edge)) out.push({ path: `${at}.edges`, reason: `no edge "${edge}"` });
      for (const ch of entry.chapters ?? [])
        if (!x.registered(ch))
          out.push({ path: `${at}.chapters`, reason: `"${ch}" is not registered` });
      if (entry.scene !== undefined && !x.registered(entry.scene.scenario))
        out.push({
          path: `${at}.scene`,
          reason: `"${entry.scene.scenario}" is not in the ID registry`,
        });
    });
  }
  for (const t of x.weights.keys())
    if (sea.tables[t] === undefined)
      out.push({ path: 'tables', reason: `Book 10's table "${t}" has no entries` });
  sea.landings.forEach((l, i) => {
    for (const idv of [l.scenario, l.gate, l.chapter])
      if (idv !== undefined && !x.registered(idv))
        out.push({ path: `landings[${i}]`, reason: `"${idv}" is not in the ID registry` });
    if (!nodes.has(l.place))
      out.push({ path: `landings[${i}]`, reason: `"${l.place}" is not a node` });
  });
  return out;
}
