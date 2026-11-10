/**
 * Content loading (Book 2 section 04): one schema per content type, validated at load; every
 * cross-reference must resolve; every content ID must be in the ID registry (content/ids.json).
 * `loadContent` is pure: give it the parsed files, get back registries and a list of issues.
 */
import type { Id } from '../core/ids.ts';
import { parseIdRegistry } from './idRegistry.ts';
import type { IdRegistry } from './idRegistry.ts';
import { arrayOf, id, int, object, oneOf, recordOf, ref, text } from './schema.ts';
import type { Check, Ctx, Issue, Ref, RefKind } from './schema.ts';
import { parseStringTable } from './strings.ts';
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
  { id: id(['REG']), nameKey: ref('string'), homeSite: ref('place'), zones: arrayOf(zoneCheck) },
  ['homeSite'],
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

type Out<C> = C extends Check<infer T> ? T : never;
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
    },
    issues,
  };
}

export function formatIssue(issue: Issue): string {
  return `${issue.file}: ${issue.path}: ${issue.reason}`;
}
