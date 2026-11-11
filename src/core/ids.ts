/**
 * Stable IDs (Book 2 section 04). An ID is an uppercase prefix naming its type, an underscore,
 * then uppercase words joined by underscores: `SK_WRECK_STRAND`, `C_HILD`, `HAZ_CAULDRON`.
 * IDs are stable forever; content/ids.json is the registry.
 */

export type Id = string;

/** Every prefix in Book 2 section 04 and the kind of thing it names. */
export const ID_PREFIXES = {
  ISLE: 'sea-map place',
  TOWN: 'sea-map place',
  FORT: 'sea-map place',
  ABBEY: 'sea-map place',
  GLEN: 'sea-map place',
  CAMP: 'sea-map place',
  SITE: 'sea-map place',
  REG: 'on-foot region',
  MAIN: 'mainland area',
  ZONE: 'zone of a region',
  SK: 'place on Skarvholm',
  HAZ: 'sea hazard',
  C: 'resident',
  L: 'leader',
  R: 'rival captain',
  E: 'enemy',
  H: 'hostage',
  P: 'player',
  FAC: 'faction',
  HULL: 'hull',
  FIT: 'fitting',
  REFIT: 'refit',
  BLD: 'building',
  TASK: 'task',
  RES: 'resource',
  ITEM: 'item',
  CROP: 'crop',
  SCN: 'scenario',
  CMP: 'complication',
  BEAT: 'beat',
  CH: 'chapter',
  PUZ: 'puzzle',
  BARGAIN: 'bargain',
  POWER: 'power',
  OMEN: 'omen',
  MUS: 'music cue',
  SFX: 'sound effect',
  AMB: 'ambience',
  VO: 'voiced bark',
} as const;

export type IdPrefix = keyof typeof ID_PREFIXES;

/** The shape of every ID; at most 32 characters. */
export const ID_PATTERN = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;
export const ID_MAX_LENGTH = 32;

function isPrefix(value: string): value is IdPrefix {
  return Object.hasOwn(ID_PREFIXES, value);
}

/** The prefix of a well-formed ID with a Book 2 prefix, or null. */
export function idPrefix(id: string): IdPrefix | null {
  if (!ID_PATTERN.test(id) || id.length > ID_MAX_LENGTH) return null;
  const head = id.slice(0, id.indexOf('_'));
  return isPrefix(head) ? head : null;
}

export function isValidId(id: string): id is Id {
  return idPrefix(id) !== null;
}
