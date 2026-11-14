/**
 * Stage 14, work package C: the data shapes of Skarvholm's collectibles (Book 2 section 10,
 * `CollectibleDef`; `content/finds.json` `collectibles`), its puzzles, secrets, the drowned and the
 * side aims (`PuzzleDef`; `content/puzzles.json`), and its resource nodes, discovery marks and
 * region map layout (`ResourceNode`, `AreaDef`, `ViewPoint`; `content/island.json`). Validated at
 * load like every content file; positions are in tiles of their scene, at the foot.
 */
import { SEASONS } from './balance.ts';
import type { Season } from './balance.ts';
import { NODE_KINDS } from './islandBalance.ts';
import { arrayOf, id, object, oneOf, recordOf, ref, text } from './schema.ts';
import type { Check } from './schema.ts';

type Out<C> = C extends Check<infer T> ? T : never;

/** A condition over the world (Book 2 section 10: tide, season, objects, words, puzzle state). */
export type IslandCondition =
  | { readonly fact: string; readonly is?: string | number | boolean }
  | { readonly not: IslandCondition }
  | { readonly any: readonly IslandCondition[] }
  /** LOW: tidal ground open now; SPRING_LOW: and a spring-tide day (Book 10 springLowExtra). */
  | { readonly tide: 'LOW' | 'HIGH' | 'SPRING_LOW' }
  | { readonly season: readonly Season[] }
  /** Days of the year, inclusive (the eggs' window). */
  | { readonly days: readonly [number, number] }
  /** A spring-tide day, at any state of the tide. */
  | { readonly springDay: true }
  | { readonly watch: 'Morning' | 'Day' | 'Evening' | 'Night' }
  | { readonly puzzle: string; readonly in: readonly string[] }
  /** A heavy object off (moved true) or on (false) its starting tile (`RegionState.pushed`). */
  | {
      readonly pushed: { readonly zone: string; readonly id: string };
      readonly moved: boolean;
    }
  | { readonly collected: string }
  | {
      readonly near: {
        readonly zone: string;
        readonly x: number;
        readonly y: number;
        readonly r: number;
      };
      readonly who?: 'STEERER' | 'ANYONE';
    }
  | { readonly zone: string }
  | { readonly weather: 'FOG' }
  /** A festival morning, within alignmentWindow of first light (Book 10 "Grey Men alignment"). */
  | { readonly festivalDawn: true }
  /** Someone within doorWaitTiles of the cairn's east door. */
  | { readonly atDoor: true }
  /** The bog offering's rim shows (Book 10 "Year 1 secrets", bogOfferingShows). */
  | { readonly offeringShows: true }
  /** The deep passage's state now (Book 9 section 16). */
  | { readonly passage: 'OPEN' | 'FLOODING' | 'CLOSED' }
  /** The drowned whose turn it is on the Skerry this spring tides. */
  | { readonly drowned: string }
  /** A household deed in the ledger (RITES_DENIED). */
  | { readonly deed: string }
  /** A scene or area on the region map (`RegionState.discoveredZones`). */
  | { readonly discovered: string };

export const CONDITION_KEYS = [
  'fact',
  'not',
  'any',
  'tide',
  'season',
  'days',
  'springDay',
  'watch',
  'puzzle',
  'pushed',
  'collected',
  'near',
  'zone',
  'weather',
  'festivalDawn',
  'atDoor',
  'offeringShows',
  'passage',
  'drowned',
  'deed',
  'discovered',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates one condition (recursively). */
export const islandCondition: Check<IslandCondition> = (value, path, ctx) => {
  const bad = (reason: string): null => {
    ctx.issues.push({ file: ctx.file, path, reason });
    return null;
  };
  if (!isRecord(value)) return bad('a condition must be an object');
  const key = CONDITION_KEYS.find((k) => k in value);
  if (key === undefined) return bad(`a condition needs one of ${CONDITION_KEYS.join(', ')}`);
  const v = value[key];
  const ok = value as IslandCondition;
  switch (key) {
    case 'fact':
    case 'collected':
    case 'drowned':
    case 'deed':
      return typeof v === 'string' && v !== '' ? ok : bad(`"${key}" needs text`);
    case 'discovered':
      if (typeof v !== 'string') return bad('"discovered" needs a zone');
      ctx.refs.push({ kind: 'zone', id: v, file: ctx.file, path: `${path}.discovered` });
      return ok;
    case 'not':
      return islandCondition(v, `${path}.not`, ctx) === null ? null : ok;
    case 'any':
      if (!Array.isArray(v) || v.length === 0) return bad('"any" needs a list of conditions');
      return v.every((c, i) => islandCondition(c, `${path}.any[${i}]`, ctx) !== null) ? ok : null;
    case 'tide':
      return v === 'LOW' || v === 'HIGH' || v === 'SPRING_LOW'
        ? ok
        : bad('"tide" is LOW, HIGH or SPRING_LOW');
    case 'season':
      return Array.isArray(v) &&
        v.length > 0 &&
        v.every((s) => (SEASONS as readonly unknown[]).includes(s))
        ? ok
        : bad('"season" needs a list of seasons');
    case 'days':
      return Array.isArray(v) && v.length === 2 && v.every(isNum)
        ? ok
        : bad('"days" needs [from, to]');
    case 'watch':
      return ['Morning', 'Day', 'Evening', 'Night'].includes(v as string)
        ? ok
        : bad('"watch" needs a watch');
    case 'puzzle':
      return typeof v === 'string' &&
        Array.isArray(value['in']) &&
        value['in'].every((s) => typeof s === 'string')
        ? ok
        : bad('"puzzle" needs an id and the states it may be "in"');
    case 'pushed':
      return isRecord(v) &&
        typeof v['zone'] === 'string' &&
        typeof v['id'] === 'string' &&
        typeof value['moved'] === 'boolean'
        ? (ctx.refs.push({
            kind: 'zone',
            id: v['zone'],
            file: ctx.file,
            path: `${path}.pushed.zone`,
          }),
          ok)
        : bad('"pushed" needs {zone, id} and "moved"');
    case 'near':
      if (
        !isRecord(v) ||
        typeof v['zone'] !== 'string' ||
        !isNum(v['x']) ||
        !isNum(v['y']) ||
        !isNum(v['r'])
      )
        return bad('"near" needs zone, x, y and r');
      ctx.refs.push({ kind: 'zone', id: v['zone'], file: ctx.file, path: `${path}.near.zone` });
      return ok;
    case 'zone':
      if (typeof v !== 'string') return bad('"zone" needs a zone');
      ctx.refs.push({ kind: 'zone', id: v, file: ctx.file, path: `${path}.zone` });
      return ok;
    case 'weather':
      return v === 'FOG' ? ok : bad('"weather" is FOG');
    case 'passage':
      return v === 'OPEN' || v === 'FLOODING' || v === 'CLOSED'
        ? ok
        : bad('"passage" is OPEN, FLOODING or CLOSED');
    case 'springDay':
    case 'festivalDawn':
    case 'atDoor':
    case 'offeringShows':
      return v === true ? ok : bad(`"${key}" is true`);
  }
};

/** What a transition or a use does. */
export type IslandEffect =
  | { readonly set: string; readonly value?: string | number | boolean }
  | { readonly info: string }
  | { readonly sound: string }
  | { readonly deed: string }
  | { readonly item: string };

export const islandEffect: Check<IslandEffect> = (value, path, ctx) => {
  const bad = (reason: string): null => {
    ctx.issues.push({ file: ctx.file, path, reason });
    return null;
  };
  if (!isRecord(value)) return bad('an effect must be an object');
  if (typeof value['set'] === 'string') return value as IslandEffect;
  if (typeof value['info'] === 'string') {
    ctx.refs.push({ kind: 'string', id: value['info'], file: ctx.file, path: `${path}.info` });
    return value as IslandEffect;
  }
  if (typeof value['sound'] === 'string' || typeof value['deed'] === 'string')
    return value as IslandEffect;
  if (typeof value['item'] === 'string')
    return id(['ITEM'])(value['item'], `${path}.item`, ctx) === null
      ? null
      : (value as IslandEffect);
  return bad('an effect is one of set, info, sound, deed, item');
};

const tiles: Check<number> = (v, path, ctx) =>
  typeof v === 'number' && v >= 0 && v <= 512
    ? v
    : (ctx.issues.push({ file: ctx.file, path, reason: 'expected a number from 0 to 512' }), null);

const vec = object({ x: tiles, y: tiles });
const rect = object({ x: tiles, y: tiles, w: tiles, h: tiles });

export const COLLECTIBLE_KINDS = [
  'SHELL',
  'CARVED_STONE',
  'PSALTER_PAGE',
  'NAME_OF_THE_DEAD',
  'SONG',
  'LORE',
] as const;
export type CollectibleKind = (typeof COLLECTIBLE_KINDS)[number];

/** The movement verbs a collectible's way needs (Book 9 section 03, its "Condition" column). */
export const REACH_VERBS = ['CLIMB', 'WADE', 'SWIM', 'JUMP', 'CRAWL', 'PULL'] as const;

/** Book 2 section 10, CollectibleDef. */
export const collectibleCheck = object(
  {
    key: text,
    kind: oneOf(COLLECTIBLE_KINDS),
    /** Lore: the power it tells of. */
    power: text,
    scene: ref('zone'),
    pos: vec,
    use: oneOf(['LOOK', 'TAKE', 'TALK'] as const),
    conditions: arrayOf(islandCondition),
    sheet: text,
    frame: text,
    /** A taken one leaves its taken frame. */
    takenFrame: text,
    /** Its sound event (content/audio.json events). */
    sound: text,
    nameKey: ref('string'),
    captionKey: ref('string'),
    journalKey: ref('string'),
    /** A Chapter 1 find that counts as this collectible (drawn and used as that find). */
    find: text,
    reach: arrayOf(oneOf(REACH_VERBS)),
    /** Book 9's block, for the record. */
    block: arrayOf(tiles),
    about: text,
  },
  ['power', 'conditions', 'takenFrame', 'find', 'reach', 'block'],
);
export type CollectibleDef = Out<typeof collectibleCheck>;

const hintCheck = object({
  kind: oneOf(['COLLECTIBLE', 'LINE', 'SIGN', 'SIGHT'] as const),
  ref: text,
  about: text,
});

const transitionCheck = object({
  from: text,
  to: text,
  when: arrayOf(islandCondition),
  effects: arrayOf(islandEffect),
});

/** Book 2 section 10, PuzzleDef. */
const puzzleCheck = object(
  {
    id: id(['PUZ']),
    scenes: arrayOf(ref('zone')),
    states: arrayOf(text),
    transitions: arrayOf(transitionCheck),
    hints: arrayOf(hintCheck),
    solvedFact: text,
    /** Places the plan marks for it (the old naust's line of stones). */
    marks: arrayOf(vec),
    about: text,
  },
  ['marks'],
);
export type PuzzleDef = Out<typeof puzzleCheck>;

const useCheck = object(
  {
    key: text,
    scene: ref('zone'),
    x: tiles,
    y: tiles,
    verb: oneOf(['LOOK', 'TAKE'] as const),
    nameKey: ref('string'),
    when: arrayOf(islandCondition),
    effects: arrayOf(islandEffect),
    /** Drawn from prop_collectibles while it can be used, and after (a taken thing's hollow). */
    frame: text,
    frameAfter: text,
    about: text,
  },
  ['frame', 'frameAfter'],
);
export type PuzzleUse = Out<typeof useCheck>;

const drownedCheck = object({
  key: text,
  shortKey: ref('string'),
  lines: arrayOf(ref('string')),
  requires: arrayOf(islandCondition),
});

const sideAimCheck = object({
  id: text,
  speaker: id(['C']),
  scene: ref('zone'),
  givenWhen: arrayOf(islandCondition),
  doneWhen: arrayOf(islandCondition),
  givenKey: ref('string'),
  journalKey: ref('string'),
  hints: arrayOf(object({ speaker: id(['C']), textKey: ref('string') })),
});
export type SideAimDef = Out<typeof sideAimCheck>;

const zoneRect = object({ zone: ref('zone'), x: tiles, y: tiles, w: tiles, h: tiles });

const puzzlesCheck = object({
  about: text,
  puzzles: arrayOf(puzzleCheck),
  uses: arrayOf(useCheck),
  drowned: object({
    scene: ref('zone'),
    order: arrayOf(drownedCheck),
    unmetKey: ref('string'),
    thorkel: object({
      x: tiles,
      y: tiles,
      shortKey: ref('string'),
      lines: arrayOf(ref('string')),
      requires: arrayOf(islandCondition),
      nameKey: ref('string'),
    }),
  }),
  turning: object({
    wake: object({
      zone: ref('zone'),
      x: tiles,
      y: tiles,
      facing: oneOf(['n', 's', 'e', 'w'] as const),
    }),
    cutOff: arrayOf(zoneRect),
    captionKey: ref('string'),
    lines: recordOf(id(['C']), ref('string')),
  }),
  alignment: object({
    door: object({ zone: ref('zone'), x: tiles, y: tiles }),
    fogLines: recordOf(id(['C']), ref('string')),
  }),
  passage: object({
    zone: ref('zone'),
    from: ref('zone'),
    risingKey: ref('string'),
    // Stage 14 (decision S14-115): "The passage grows loud", said as the spring tide turns.
    loudKey: ref('string'),
    // Stage 14 (decision S14-111): the zones whose spring floor follows the passage's water.
    floors: arrayOf(ref('zone')),
  }),
  sideAims: arrayOf(sideAimCheck),
  secrets: recordOf(
    text,
    arrayOf(object({ puzzle: text, find: text, about: text }, ['puzzle', 'find', 'about'])),
  ),
});
export type PuzzlesDef = Out<typeof puzzlesCheck>;
export const parsePuzzles = puzzlesCheck;

const nodeCheck = object({
  key: text,
  kind: oneOf(NODE_KINDS),
  scene: ref('zone'),
  x: tiles,
  y: tiles,
  /** Its frame of prop_island_nodes (`<frame>` while there, `<frame>_taken` once taken). */
  frame: text,
  about: text,
});
export type NodeDef = Out<typeof nodeCheck>;

/** Book 2 section 10, AreaDef and ViewPoint (used until the zone plans carry their own). */
const areaCheck = object({ id: id(['ZONE']), scene: ref('zone'), rect, nameKey: ref('string') });
export type AreaDef = Out<typeof areaCheck>;
const viewPointCheck = object({ scene: ref('zone'), at: rect, reveals: arrayOf(ref('zone')) });
export type ViewPointDef = Out<typeof viewPointCheck>;

const islandCheck = object({
  about: text,
  nodes: arrayOf(nodeCheck),
  areas: arrayOf(areaCheck),
  viewPoints: arrayOf(viewPointCheck),
  regionMap: object({
    windows: recordOf(text, rect),
    insets: recordOf(text, object({ x: tiles, y: tiles, w: tiles, h: tiles, from: ref('zone') })),
    labels: recordOf(text, vec),
  }),
});
export type IslandDef = Out<typeof islandCheck>;
export const parseIsland = islandCheck;

export const parseCollectibles = arrayOf(collectibleCheck);

/** Cross-file checks the schema cannot make: unknown puzzles, states and finds. */
export function islandProblems(
  puzzles: PuzzlesDef | null,
  collectibles: readonly CollectibleDef[],
  findKeys: ReadonlySet<string>,
): { path: string; reason: string }[] {
  const out: { path: string; reason: string }[] = [];
  if (puzzles === null) return out;
  const states = new Map(puzzles.puzzles.map((p) => [p.id, new Set(p.states)]));
  const keys = new Set(collectibles.map((c) => c.key));
  const check = (c: IslandCondition, path: string): void => {
    if ('puzzle' in c) {
      const s = states.get(c.puzzle);
      if (s === undefined) out.push({ path, reason: `unknown puzzle "${c.puzzle}"` });
      else
        for (const st of c.in)
          if (!s.has(st)) out.push({ path, reason: `${c.puzzle} has no state "${st}"` });
    }
    if ('collected' in c && !keys.has(c.collected))
      out.push({ path, reason: `unknown collectible "${c.collected}"` });
    if ('not' in c) check(c.not, `${path}.not`);
    if ('any' in c)
      c.any.forEach((x, i) => {
        check(x, `${path}.any[${i}]`);
      });
  };
  puzzles.puzzles.forEach((p, i) => {
    const s = new Set(p.states);
    p.transitions.forEach((t, j) => {
      if (!s.has(t.from) || !s.has(t.to))
        out.push({
          path: `puzzles[${i}].transitions[${j}]`,
          reason: `a state not in ${p.id}'s states`,
        });
      t.when.forEach((c, k) => {
        check(c, `puzzles[${i}].transitions[${j}].when[${k}]`);
      });
    });
    if (p.hints.length === 0)
      out.push({ path: `puzzles[${i}].hints`, reason: 'every puzzle has an in-world hint' });
    p.hints.forEach((h, j) => {
      if (h.kind === 'COLLECTIBLE' && !keys.has(h.ref))
        out.push({ path: `puzzles[${i}].hints[${j}]`, reason: `unknown collectible "${h.ref}"` });
    });
  });
  puzzles.uses.forEach((u, i) => {
    u.when.forEach((c, k) => {
      check(c, `uses[${i}].when[${k}]`);
    });
  });
  collectibles.forEach((c, i) => {
    (c.conditions ?? []).forEach((x, k) => {
      check(x, `collectibles[${i}].conditions[${k}]`);
    });
    if (c.find !== undefined && !findKeys.has(c.find))
      out.push({ path: `collectibles[${i}].find`, reason: `unknown find "${c.find}"` });
  });
  for (const [scene, list] of Object.entries(puzzles.secrets))
    list.forEach((s, j) => {
      if (s.puzzle !== undefined && !states.has(s.puzzle))
        out.push({ path: `secrets.${scene}[${j}]`, reason: `unknown puzzle "${s.puzzle}"` });
      if (s.find !== undefined && !findKeys.has(s.find))
        out.push({ path: `secrets.${scene}[${j}]`, reason: `unknown find "${s.find}"` });
    });
  return out;
}
