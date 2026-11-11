/**
 * Content loading (Book 2 section 04): one schema per content type, validated at load; every
 * cross-reference must resolve; every content ID must be in the ID registry (content/ids.json).
 * `loadContent` is pure: give it the parsed files, get back registries and a list of issues.
 */
import type { Id } from '../core/ids.ts';
import { parseIdRegistry } from './idRegistry.ts';
import type { IdRegistry } from './idRegistry.ts';
import { arrayOf, bool, id, int, object, oneOf, recordOf, ref, text } from './schema.ts';
import type { Check, Ctx, Issue, Ref, RefKind } from './schema.ts';
import { steererWordingProblems } from './steererWords.ts';
import { captionProblems, isDialogueKey, modernMoralWordsIn, parseStringTable } from './strings.ts';
import { checkZoneMap } from './zoneMap.ts';
import type { ZoneMap } from './zoneMap.ts';
import type { StringTable } from './strings.ts';

export const CONTENT_FILES = {
  ids: 'content/ids.json',
  strings: 'content/strings/en.json',
  balance: 'content/balance.json',
  places: 'content/places.json',
  hazards: 'content/hazards.json',
  regions: 'content/regions.json',
  people: 'content/people.json',
  factions: 'content/factions.json',
  hulls: 'content/hulls.json',
  fittings: 'content/fittings.json',
  audio: 'content/audio.json',
  onFoot: 'content/onfoot.json',
  opening: 'content/opening.json',
  zoneStrand: 'content/zones/zone_sk_strand.json',
} as const;

export type ContentFiles = { readonly [K in keyof typeof CONTENT_FILES]: unknown };

const PLACE_TYPES = [
  'HOME_ISLAND',
  'RAID_SITE',
  'FARM_SETTLEMENT',
  'MONASTERY',
  'RINGFORT',
  'HARBOUR',
  'FARMSTEADS',
  'SACRED_ISLAND',
  'RAIDERS_CAMP',
  'SEA_KING_SEAT',
  'HOME_SITE',
  'SKARVHOLM_PLACE',
] as const;
export const VALUES = ['GAIN', 'MERCY', 'GLORY', 'KIN', 'FAITH', 'WORD'] as const;
export const TIE_KINDS = [
  'KIN',
  'FRIEND',
  'RIVAL',
  'SPOUSE',
  'DEBT',
  'GRIEVANCE',
  'OATH',
  'MENTOR',
] as const;
const PERSON_KINDS = ['PLAYER', 'RESIDENT', 'LEADER', 'RIVAL_CAPTAIN', 'ENEMY', 'HOSTAGE'] as const;
const ATTITUDES = ['NEUTRAL', 'WARY', 'UNKNOWN', 'RIVAL', 'DEMANDING'] as const;
const TIERS = ['T1', 'T2', 'T3A', 'T3B'] as const;
const SLOTS = [
  'BOW',
  'MIDSHIP',
  'STERN',
  'RIG',
  'GUNWALE',
  'BOW_IDENTITY',
  'MAST_IDENTITY',
] as const;

/** Each person kind and the ID prefix it must use (Book 2 section 04). */
const KIND_PREFIX = {
  PLAYER: 'P',
  RESIDENT: 'C',
  LEADER: 'L',
  RIVAL_CAPTAIN: 'R',
  ENEMY: 'E',
  HOSTAGE: 'H',
} as const;

const placeCheck = object(
  {
    id: id(['ISLE', 'TOWN', 'FORT', 'ABBEY', 'GLEN', 'CAMP', 'SITE', 'SK']),
    type: oneOf(PLACE_TYPES),
    nameKey: ref('string'),
    region: ref('region'),
  },
  ['region'],
);
const hazardCheck = object({ id: id(['HAZ']), nameKey: ref('string') });
const zoneCheck = object({ id: id(['ZONE']), terrain: text });
const regionCheck = object(
  {
    id: id(['REG']),
    nameKey: ref('string'),
    homeSites: arrayOf(ref('place')),
    zones: arrayOf(zoneCheck),
  },
  ['homeSites'],
);
const tieCheck = object({ to: ref('person'), kind: oneOf(TIE_KINDS) });
const personCheck = object(
  {
    id: id(['P', 'C', 'L', 'R', 'E', 'H']),
    kind: oneOf(PERSON_KINDS),
    nameKey: ref('string'),
    values: recordOf(oneOf(VALUES), int(1, 3)),
    home: ref('place'),
    faction: ref('faction'),
    ties: arrayOf(tieCheck),
  },
  ['values', 'home', 'faction', 'ties'],
);
const factionCheck = object({
  id: id(['FAC']),
  nameKey: ref('string'),
  home: ref('place'),
  startAttitude: oneOf(ATTITUDES),
});
const hullCheck = object({
  id: id(['HULL']),
  tier: oneOf(TIERS),
  balanceRow: ref('balance:hull'),
  nameKey: ref('string'),
});
const fittingCheck = object({
  id: id(['FIT']),
  slot: oneOf(SLOTS),
  balanceRow: ref('balance:fitting'),
  nameKey: ref('string'),
});

export const AUDIO_BUSES = ['music', 'ambience', 'effects', 'voice', 'tells'] as const;
const cueCheck = object(
  {
    id: id(['MUS', 'SFX', 'AMB', 'VO']),
    kind: oneOf(['music', 'stinger', 'sfx', 'ambience'] as const),
    bpm: int(20, 240),
    beatsPerBar: int(2, 12),
    stems: arrayOf(oneOf(['bed', 'rhythm', 'melody', 'voice', 'danger'] as const)),
    lengthBeats: int(1, 32),
    bus: oneOf(AUDIO_BUSES),
    zones: arrayOf(ref('zone')),
    phases: arrayOf(oneOf(['day', 'dusk', 'night'] as const)),
    captionKey: ref('string'),
    temporary: bool,
    piece: oneOf(['hearth', 'skarvholm', 'raid'] as const),
    layers: recordOf(text, bool),
  },
  [
    'bpm',
    'beatsPerBar',
    'stems',
    'lengthBeats',
    'bus',
    'zones',
    'phases',
    'captionKey',
    'piece',
    'layers',
  ],
);
const audioCheck = object({
  about: text,
  captionSeconds: int(1, 10),
  stingerDuck: (v, path, ctx) =>
    typeof v === 'number' && v >= 0 && v <= 1
      ? v
      : (ctx.issues.push({ file: ctx.file, path, reason: 'expected a level from 0 to 1' }), null),
  cues: arrayOf(cueCheck),
  events: recordOf(text, id(['MUS', 'SFX', 'AMB', 'VO'])),
});

const fraction =
  (min: number, max: number): Check<number> =>
  (v, path, ctx) =>
    typeof v === 'number' && v >= min && v <= max
      ? v
      : (ctx.issues.push({
          file: ctx.file,
          path,
          reason: `expected a number from ${min} to ${max}`,
        }),
        null);

const itemCheck = object(
  {
    nameKey: ref('string'),
    /**
     * The hotbar icon (a ui_icons state) and the target-tile glyph (a ui_cursor_glyph state; none
     * for an item aimed freely, which shows the aim line instead).
     */
    icon: text,
    glyph: text,
    use: oneOf(['AIM', 'MELEE', 'TOOL', 'AMMO'] as const),
    /** The refusal word when there is nothing to use it on ("Nothing to cut", "No arrows"). */
    refusalKey: ref('string'),
    /** An aimed item's missile and the item each shot spends (Book 10 section 21). */
    missile: oneOf(['arrow', 'spear'] as const),
    ammo: id(['ITEM']),
    /** The tooltip shown the first time one is picked up, naming its controls. */
    tipKey: ref('string'),
  },
  ['glyph', 'missile', 'ammo', 'tipKey'],
);

const pickupCheck = object(
  {
    /** Unique within the zone; stable, as saves record what is still lying there. */
    key: text,
    zone: ref('zone'),
    item: id(['ITEM']),
    count: int(1, 99),
    /** Tile coordinates of its foot. */
    x: fraction(0, 512),
    y: fraction(0, 512),
    /** A quiver with Book 10's startingArrows comes with it. */
    quiver: bool,
    /** A fact that must be true before it shows. */
    after: text,
    glint: bool,
  },
  ['quiver', 'after', 'glint'],
);

const coverCheck = object({
  w: int(1, 200),
  h: int(1, 200),
  material: oneOf(['wood', 'stone'] as const),
  tall: bool,
});

const onFootCheck = object({
  about: text,
  interactRadiusTiles: fraction(0.5, 4),
  footprint: object({ w: int(2, 24), h: int(1, 24) }),
  setDownReach: int(1, 48),
  /** What the steerer wakes with: hotbar slots from the first, and the one in hand. */
  hotbar: object({ about: text, start: arrayOf(id(['ITEM'])), selected: int(0, 11) }),
  items: recordOf(id(['ITEM']), itemCheck),
  /** The height a missile leaves the hand at, in pixels above the feet. */
  releaseHeightPx: int(0, 48),
  /** A person's body as a missile meets it, on the ground plane, in pixels. */
  missileHitBox: object({ w: int(2, 32), h: int(1, 16) }),
  /** Props that stop missiles, by sheet. */
  cover: recordOf(text, coverCheck),
  /** Items lying in zones at the start of a campaign. */
  pickups: arrayOf(pickupCheck),
  /** How long a pickup tooltip stays up, in seconds. */
  tipSeconds: int(1, 60),
});

const openingCheck = object({
  about: text,
  beat: id(['BEAT']),
  zone: ref('zone'),
  caller: ref('person'),
  firstCallSeconds: int(0, 60),
  callEverySeconds: int(1, 60),
  moveHintSeconds: int(1, 60),
  /** How the caller waits to be rescued: lying, or standing and calling. */
  callerPose: oneOf(['down', 'call'] as const),
  callLines: arrayOf(ref('string')),
  foundLine: ref('string'),
  safeLine: ref('string'),
  refusedLine: ref('string'),
  /** Once she is safe, Hild names the bow in the wreck's stern, after this many seconds. */
  bowLine: ref('string'),
  bowLineSeconds: int(0, 60),
});

type Out<C> = C extends Check<infer T> ? T : never;
export type OnFootDef = Out<typeof onFootCheck>;
export type OpeningDef = Out<typeof openingCheck>;
export type CueDef = Out<typeof cueCheck>;
export type AudioTable = Out<typeof audioCheck>;
export type PlaceDef = Out<typeof placeCheck>;
export type HazardDef = Out<typeof hazardCheck>;
export type RegionDef = Out<typeof regionCheck>;
export type PersonDef = Out<typeof personCheck>;
export type FactionDef = Out<typeof factionCheck>;
export type HullDef = Out<typeof hullCheck>;
export type FittingDef = Out<typeof fittingCheck>;

export interface Content {
  readonly ids: IdRegistry;
  readonly strings: StringTable;
  readonly balance: unknown;
  readonly places: ReadonlyMap<Id, PlaceDef>;
  readonly hazards: ReadonlyMap<Id, HazardDef>;
  readonly regions: ReadonlyMap<Id, RegionDef>;
  readonly zones: ReadonlyMap<Id, RegionDef['zones'][number] & { readonly region: Id }>;
  readonly people: ReadonlyMap<Id, PersonDef>;
  readonly factions: ReadonlyMap<Id, FactionDef>;
  readonly hulls: ReadonlyMap<Id, HullDef>;
  readonly fittings: ReadonlyMap<Id, FittingDef>;
  readonly audio: AudioTable | null;
  readonly cues: ReadonlyMap<Id, CueDef>;
  readonly onFoot: OnFootDef | null;
  readonly opening: OpeningDef | null;
  readonly zoneMaps: ReadonlyMap<Id, ZoneMap>;
}

function balanceRows(
  balance: unknown,
  section: string,
  table: string,
  column: string,
): Set<string> {
  const tables = (balance as { tables?: Record<string, Record<string, unknown>> } | null)?.tables;
  const rows = tables?.[section]?.[table];
  if (!Array.isArray(rows)) return new Set();
  return new Set(rows.map((r) => String((r as Record<string, unknown>)[column])));
}

function toMap<T extends { id: Id }>(
  items: readonly T[] | null,
  file: string,
  issues: Issue[],
): Map<Id, T> {
  const map = new Map<Id, T>();
  (items ?? []).forEach((item, i) => {
    if (map.has(item.id))
      issues.push({ file, path: `[${i}].id`, reason: `"${item.id}" is defined twice` });
    map.set(item.id, item);
  });
  return map;
}

/** Validates every content file and resolves every reference. Usable only with no issues. */
export function loadContent(files: ContentFiles): { content: Content; issues: Issue[] } {
  const issues: Issue[] = [];
  const refs: Ref[] = [];
  const ctx = (file: string): Ctx => ({ file, issues, refs });

  const { registry: ids, problems } = parseIdRegistry(files.ids);
  for (const reason of problems)
    issues.push({ file: CONTENT_FILES.ids, path: '(registry)', reason });
  let strings: StringTable = new Map();
  try {
    strings = parseStringTable(files.strings, CONTENT_FILES.strings);
  } catch (error) {
    issues.push({ file: CONTENT_FILES.strings, path: '(root)', reason: (error as Error).message });
  }

  const places = toMap(
    arrayOf(placeCheck)(files.places, '', ctx(CONTENT_FILES.places)),
    CONTENT_FILES.places,
    issues,
  );
  const hazards = toMap(
    arrayOf(hazardCheck)(files.hazards, '', ctx(CONTENT_FILES.hazards)),
    CONTENT_FILES.hazards,
    issues,
  );
  const regionList = arrayOf(regionCheck)(files.regions, '', ctx(CONTENT_FILES.regions));
  const regions = toMap(regionList, CONTENT_FILES.regions, issues);
  const zones = new Map<Id, RegionDef['zones'][number] & { region: Id }>();
  for (const region of regionList ?? [])
    for (const zone of region.zones) zones.set(zone.id, { ...zone, region: region.id });
  const people = toMap(
    arrayOf(personCheck)(files.people, '', ctx(CONTENT_FILES.people)),
    CONTENT_FILES.people,
    issues,
  );
  const factions = toMap(
    arrayOf(factionCheck)(files.factions, '', ctx(CONTENT_FILES.factions)),
    CONTENT_FILES.factions,
    issues,
  );
  const hulls = toMap(
    arrayOf(hullCheck)(files.hulls, '', ctx(CONTENT_FILES.hulls)),
    CONTENT_FILES.hulls,
    issues,
  );
  const fittings = toMap(
    arrayOf(fittingCheck)(files.fittings, '', ctx(CONTENT_FILES.fittings)),
    CONTENT_FILES.fittings,
    issues,
  );

  const audio = audioCheck(files.audio, '', ctx(CONTENT_FILES.audio));
  const cues = toMap(audio?.cues ?? null, CONTENT_FILES.audio, issues);
  (audio?.cues ?? []).forEach((cue, i) => {
    const at = (field: string) => `cues[${i}].${field}`;
    const need = (field: keyof CueDef, why: string) => {
      if (cue[field] === undefined)
        issues.push({
          file: CONTENT_FILES.audio,
          path: at(field),
          reason: `${cue.kind} cues need ${why}`,
        });
    };
    if (cue.kind === 'music') {
      need('bpm', 'a tempo');
      need('beatsPerBar', 'a bar length');
      need('stems', 'stems');
    }
    if (cue.kind === 'stinger') need('lengthBeats', 'a length');
    if (cue.kind === 'sfx') need('bus', 'a bus');
    // Book 11 section 09: a caption for every gameplay-relevant sound.
    if (cue.kind !== 'ambience') need('captionKey', 'a caption (Book 11 section 09)');
  });
  for (const [event, cue] of Object.entries(audio?.events ?? {})) {
    if (!cues.has(cue))
      issues.push({
        file: CONTENT_FILES.audio,
        path: `events.${event}`,
        reason: `unknown cue "${cue}"`,
      });
  }

  // Book 8 section 03: no gendered word to or about the steerer.
  for (const [key, entry] of strings) {
    for (const reason of steererWordingProblems(entry.text, entry.tags))
      issues.push({ file: CONTENT_FILES.strings, path: key, reason });
    // Design addendum 2.3 section 10: speech and information captions.
    for (const reason of captionProblems(key, entry))
      issues.push({ file: CONTENT_FILES.strings, path: key, reason });
    // Design addendum 2.3 section 2: no modern moral vocabulary in dialogue.
    if (isDialogueKey(key))
      for (const word of modernMoralWordsIn(entry.text))
        issues.push({
          file: CONTENT_FILES.strings,
          path: key,
          reason: `dialogue uses the modern word "${word}" (Book 8: speak in period terms)`,
        });
  }

  const onFoot = onFootCheck(files.onFoot, '', ctx(CONTENT_FILES.onFoot));
  const opening = openingCheck(files.opening, '', ctx(CONTENT_FILES.opening));
  const zoneMaps = new Map<Id, ZoneMap>();
  const strand = checkZoneMap(files.zoneStrand);
  for (const reason of strand.problems)
    issues.push({ file: CONTENT_FILES.zoneStrand, path: '(map)', reason });
  if (strand.map !== null) {
    zoneMaps.set(strand.map.zone, strand.map);
    if (!zones.has(strand.map.zone))
      issues.push({
        file: CONTENT_FILES.zoneStrand,
        path: 'zone',
        reason: `unknown zone "${strand.map.zone}"`,
      });
    for (const who of Object.keys(strand.map.spawns)) {
      if (who !== 'P_STEERER' && !people.has(who))
        issues.push({
          file: CONTENT_FILES.zoneStrand,
          path: `spawns.${who}`,
          reason: `unknown person "${who}"`,
        });
    }
  }
  if (onFoot !== null) {
    onFoot.hotbar.start.forEach((item, i) => {
      if (onFoot.items[item] === undefined)
        issues.push({
          file: CONTENT_FILES.onFoot,
          path: `hotbar.start[${i}]`,
          reason: `"${item}" has no entry in items`,
        });
    });
    onFoot.pickups.forEach((p, i) => {
      if (onFoot.items[p.item] === undefined)
        issues.push({
          file: CONTENT_FILES.onFoot,
          path: `pickups[${i}].item`,
          reason: `"${p.item}" has no entry in items`,
        });
    });
    for (const [item, def] of Object.entries(onFoot.items))
      if (def.ammo !== undefined && onFoot.items[def.ammo] === undefined)
        issues.push({
          file: CONTENT_FILES.onFoot,
          path: `items.${item}.ammo`,
          reason: `"${def.ammo}" has no entry in items`,
        });
    for (const item of Object.keys(onFoot.items))
      if (!ids.byId.has(item))
        issues.push({
          file: CONTENT_FILES.onFoot,
          path: `items.${item}`,
          reason: `"${item}" is not in the ID registry (${CONTENT_FILES.ids})`,
        });
  }
  if (opening !== null && !ids.byId.has(opening.beat))
    issues.push({
      file: CONTENT_FILES.opening,
      path: 'beat',
      reason: `"${opening.beat}" is not in the ID registry (${CONTENT_FILES.ids})`,
    });
  if (opening !== null && strand.map !== null && strand.map.spawns[opening.caller] === undefined)
    issues.push({
      file: CONTENT_FILES.opening,
      path: 'caller',
      reason: `${opening.caller} has no spawn in ${opening.zone}`,
    });

  const hullRows = balanceRows(files.balance, 'shipStatisticsAndCosts', 'hulls', 'Hull');
  const fittingRows = balanceRows(files.balance, 'shipStatisticsAndCosts', 'fittings', 'Fitting');
  const known: Record<RefKind, (id: string) => boolean> = {
    place: (x) => places.has(x),
    hazard: (x) => hazards.has(x),
    region: (x) => regions.has(x),
    zone: (x) => zones.has(x),
    person: (x) => people.has(x),
    faction: (x) => factions.has(x),
    hull: (x) => hulls.has(x),
    fitting: (x) => fittings.has(x),
    string: (x) => strings.has(x),
    'balance:hull': (x) => hullRows.has(x),
    'balance:fitting': (x) => fittingRows.has(x),
  };
  const noun: Record<RefKind, string> = {
    place: 'place',
    hazard: 'hazard',
    region: 'region',
    zone: 'zone',
    person: 'person',
    faction: 'faction',
    hull: 'hull',
    fitting: 'fitting',
    string: 'string key',
    'balance:hull': 'Book 10 hull row',
    'balance:fitting': 'Book 10 fitting row',
  };
  for (const r of refs) {
    if (!known[r.kind](r.id))
      issues.push({ file: r.file, path: r.path, reason: `unknown ${noun[r.kind]} "${r.id}"` });
  }

  // Every content ID is a registered, stable ID.
  const defined: [string, Map<Id, { id: Id }>][] = [
    [CONTENT_FILES.places, places],
    [CONTENT_FILES.hazards, hazards],
    [CONTENT_FILES.regions, regions],
    [CONTENT_FILES.regions, zones],
    [CONTENT_FILES.people, people],
    [CONTENT_FILES.factions, factions],
    [CONTENT_FILES.hulls, hulls],
    [CONTENT_FILES.fittings, fittings],
    [CONTENT_FILES.audio, cues],
  ];
  for (const [file, map] of defined) {
    for (const key of map.keys()) {
      if (!ids.byId.has(key))
        issues.push({
          file,
          path: key,
          reason: `"${key}" is not in the ID registry (${CONTENT_FILES.ids})`,
        });
    }
  }

  // People: the ID prefix matches the kind, and ties go both ways.
  [...people.values()].forEach((p, i) => {
    const expected = KIND_PREFIX[p.kind];
    if (!p.id.startsWith(`${expected}_`)) {
      issues.push({
        file: CONTENT_FILES.people,
        path: `[${i}].kind`,
        reason: `a ${p.kind} needs an ID starting ${expected}_`,
      });
    }
    (p.ties ?? []).forEach((tie, t) => {
      const back =
        people.get(tie.to)?.ties?.some((b) => b.to === p.id && b.kind === tie.kind) ?? false;
      if (people.has(tie.to) && !back) {
        issues.push({
          file: CONTENT_FILES.people,
          path: `[${i}].ties[${t}]`,
          reason: `${tie.to} has no matching ${tie.kind} tie back to ${p.id}`,
        });
      }
    });
  });

  return {
    content: {
      ids,
      strings,
      balance: files.balance,
      places,
      hazards,
      regions,
      zones,
      people,
      factions,
      hulls,
      fittings,
      audio,
      cues,
      onFoot,
      opening,
      zoneMaps,
    },
    issues,
  };
}

export function formatIssue(issue: Issue): string {
  return `${issue.file}: ${issue.path}: ${issue.reason}`;
}

/** Validates the audio table on its own (the browser bundles it without the other content). */
export function parseAudioTable(json: unknown): AudioTable {
  const issues: Issue[] = [];
  const audio = audioCheck(json, '', { file: CONTENT_FILES.audio, issues, refs: [] });
  if (audio === null || issues.length > 0) {
    throw new Error(
      `${CONTENT_FILES.audio}: ${issues.map((i) => `${i.path}: ${i.reason}`).join('; ')}`,
    );
  }
  return audio;
}
