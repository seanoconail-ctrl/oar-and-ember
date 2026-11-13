/**
 * Book 10's numbers for the interface of the user's third playtest, read from content/balance.json
 * as the book writes them:
 *
 * - section 21, "Menus and saves" (decisions DG-15 to DG-18): the manual slots, the thumbnail's
 *   size and bytes, and the pause duck;
 * - section 21, "The intro" (DG-19): the hold that skips the cold open and when its button shows;
 * - section 21, "Developer menu" (DG-21): the hours skipped and the teleport's search radius;
 * - section 25, "No trap" (DG-20): the edge-walk test's probe step, offset, directions, distance
 *   and time.
 *
 * Each value is parsed strictly: if Book 10's wording changes, loading fails with the table, key
 * and value rather than reading a wrong number.
 */
type Row = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowsOf(json: unknown, section: string, name: string): Row[] {
  const tables = isRecord(json) ? json['tables'] : undefined;
  const sec = isRecord(tables) ? tables[section] : undefined;
  const list = isRecord(sec) ? sec[name] : undefined;
  if (!Array.isArray(list)) throw new Error(`balance.json: no table ${section}.${name}`);
  return list as Row[];
}

const N = '(\\d+(?:\\.\\d+)?)';

function reader(json: unknown, section: string, name: string) {
  const list = rowsOf(json, section, name);
  return (key: string, pattern: string): number[] => {
    const row = list.find((r) => r['Key'] === key);
    if (row === undefined) throw new Error(`balance.json: ${section}.${name} has no "${key}"`);
    const text = row['Value'] ?? '';
    const m = new RegExp(pattern.replaceAll('N', N)).exec(text);
    if (m === null)
      throw new Error(`balance.json: ${name}.${key} Value is "${text}"; expected /${pattern}/`);
    return m.slice(1).map(Number);
  };
}

const first = (xs: number[]): number => xs[0] ?? 0;

export interface MenuBalance {
  /** Manual save slots (3), besides the autosave slot. */
  readonly saveSlots: number;
  /** The slot's screenshot: the logical view at a quarter (160 x 90). */
  readonly thumbnail: { readonly w: number; readonly h: number; readonly block: number };
  /** Its PNG in base64 at most this many bytes (24 KB). */
  readonly thumbnailBytes: number;
  /** Music and ambience fall this many dB while the menu holds time, over this many seconds. */
  readonly pauseDuckDb: number;
  readonly pauseDuckSeconds: number;
}

export interface IntroBalance {
  /** Any key or pad button held this long (real seconds) skips the cold open. */
  readonly skipHoldSeconds: number;
  /** The Skip button shows this far into the cold open, and fades after this long. */
  readonly skipShowSeconds: number;
  readonly skipFadeSeconds: number;
}

export interface DevBalance {
  /** Game hours one "skip" passes (6). */
  readonly skipHours: number;
  /** The teleport looks this many tiles round the clicked tile for a clear one (2). */
  readonly teleportTiles: number;
  /** Frames per second averaged over this many real seconds (1). */
  readonly fpsSeconds: number;
}

export interface NoTrapBalance {
  /** Tiles between probe points along an edge (0.25). */
  readonly probeStep: number;
  /** Tiles outside the edge the footprint is set (0.1). */
  readonly probeOut: number;
  readonly escapeDirs: number;
  /** Tiles the steerer must get from the probe point (0.5)... */
  readonly escapeDistance: number;
  /** ...within this many real seconds (1). */
  readonly escapeSeconds: number;
  /** Tiles of margin over the footprint a gap must have not to be a dead end (0.25). */
  readonly narrowestMargin: number;
}

export interface InterfaceBalance {
  readonly menu: MenuBalance;
  readonly intro: IntroBalance;
  readonly dev: DevBalance;
  readonly noTrap: NoTrapBalance;
}

export function parseInterfaceBalance(json: unknown): InterfaceBalance {
  const menu = reader(json, 'controlsAndCamera', 'menusAndSaves');
  const intro = reader(json, 'controlsAndCamera', 'theIntro');
  const dev = reader(json, 'controlsAndCamera', 'developerMenu');
  const trap = reader(json, 'theOpeningGuidanceAndFeel', 'noTrap');
  const [tw, th] = menu('thumbnail', '^N x N pixels');
  const [lw] = menu('thumbnail', 'logical view \\(N x');
  const [duckDb, duckS] = menu('pauseDuck', 'fall N dB over N real seconds');
  const [showS, fadeS] = intro('skipShows', 'N real second into the cold open, and fade after N');
  return {
    menu: {
      saveSlots: first(menu('saveSlots', '^N manual slots')),
      thumbnail: { w: tw ?? 0, h: th ?? 0, block: (lw ?? 0) / (tw ?? 1) },
      thumbnailBytes: first(menu('thumbnailBytes', '^N KB')) * 1024,
      pauseDuckDb: duckDb ?? 0,
      pauseDuckSeconds: duckS ?? 0,
    },
    intro: {
      skipHoldSeconds: first(intro('skipHold', 'held for N real second')),
      skipShowSeconds: showS ?? 0,
      skipFadeSeconds: fadeS ?? 0,
    },
    dev: {
      skipHours: first(dev('devSkipHours', '^N game hours')),
      teleportTiles: first(dev('devTeleport', 'nearest clear tile within N tiles')),
      fpsSeconds: first(dev('devReadout', 'averaged over N real second')),
    },
    noTrap: {
      probeStep: first(trap('probeStep', '^N tiles')),
      probeOut: first(trap('probeOut', '^Each probe point is N tiles')),
      escapeDirs: first(trap('escapeDirs', '^N directions')),
      escapeDistance: first(trap('escapeDistance', '^N tiles')),
      escapeSeconds: first(trap('escapeTime', '^N real second')),
      narrowestMargin: first(trap('narrowest', 'footprint \\+ N tiles')),
    },
  };
}
