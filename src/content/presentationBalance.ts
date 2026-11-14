/**
 * Book 10's presentation numbers for design addendum 2.5 sections 2 and 3, read from
 * content/balance.json as the book writes them:
 *
 * - section 21, "On-screen text" (decisions DF-11 to DF-14): one information line and one speech
 *   line, how long each holds and fades, repeats, what a fight is, the line held through it, and
 *   how tutorial prompts and pickup tooltips fade;
 * - section 25, "The storm" (decisions DF-15 to DF-17): lightning and thunder, fog, the varied
 *   light, the camera's sway, the ship's pitch and roll, swells, breaking waves, green water and
 *   rain; and the first rain over the camp, beading on the sail (DF-21).
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

/** The numbers `pattern` captures from a row's Value (or Notes), or a clear failure. */
function reader(json: unknown, section: string, name: string) {
  const list = rowsOf(json, section, name);
  return (key: string, pattern: string, field: 'Value' | 'Notes' = 'Value'): number[] => {
    const row = list.find((r) => r['Key'] === key);
    if (row === undefined) throw new Error(`balance.json: ${section}.${name} has no "${key}"`);
    const text = row[field] ?? '';
    const m = new RegExp(pattern.replaceAll('N', N)).exec(text);
    if (m === null)
      throw new Error(`balance.json: ${name}.${key} ${field} is "${text}"; expected /${pattern}/`);
    return m.slice(1).map(Number);
  };
}

const first = (xs: number[]): number => xs[0] ?? 0;
const pair = (xs: number[]): [number, number] => [xs[0] ?? 0, xs[1] ?? 0];

export interface TextBalance {
  /** At most this many information and speech lines at once (1 and 1). */
  readonly infoLines: number;
  readonly speechLines: number;
  /** A new line cross-fades in over this (real seconds). */
  readonly crossFadeSeconds: number;
  /** The same information line is not shown again within this (real seconds). */
  readonly repeatSeconds: number;
  readonly infoHoldSeconds: number;
  /** Speech holds base + perChar a character, clamped to [min, max]. */
  readonly speechHold: { base: number; perChar: number; min: number; max: number };
  readonly fadeOutSeconds: number;
  readonly fadeInSeconds: number;
  /** Captions sit within this share of the view's height from the bottom (16 = 16%). */
  readonly placePercent: number;
  /** A fight: a hostile alert within this many tiles, or a blow in the last seconds. */
  readonly fightTiles: number;
  readonly fightBlowSeconds: number;
  /** The held line shows this long after the fight, if younger than maxAge (real seconds). */
  readonly heldDelaySeconds: number;
  readonly heldMaxAgeSeconds: number;
  readonly promptFadeSeconds: number;
  /** Prompts come back this long after a narrative line or beat ends. */
  readonly promptBackSeconds: number;
  /** The move prompt is done once this many tiles are walked. */
  readonly moveDoneTiles: number;
  /** A tooltip shows this long of play, or until its controls are used this many times. */
  readonly tipSeconds: number;
  readonly tipUses: number;
  readonly refusalSeconds: number;
}

export function parseTextBalance(json: unknown): TextBalance {
  const r = reader(json, 'controlsAndCamera', 'onScreenText');
  const [info, speech] = pair(r('captionLines', '^N information line and N speech line at most$'));
  const [hold, fade] = pair(r('infoHold', '^N real seconds, then a N s fade$'));
  const sh = r(
    'speechHold',
    '^N real seconds? \\+ N s a character, from N to N real seconds, then a N s fade$',
  );
  const [fightTiles, fightBlow] = pair(
    r('inFight', 'alert to the steerer within N tiles, or a blow .* in the last N real seconds$'),
  );
  const [heldDelay, heldAge] = pair(
    r('heldAfterFight', 'shows N real seconds? after the fight ends if it is under N s old'),
  );
  // "used twice": the pattern checks the word, the count is two.
  const tipSeconds = first(
    r('tipHold', 'shows for N real seconds of play, or until its controls have been used twice'),
  );
  return {
    infoLines: info,
    speechLines: speech,
    crossFadeSeconds: first(r('captionReplace', 'cross-fading over N real seconds$')),
    repeatSeconds: first(r('captionRepeat', 'not shown again within N real seconds$')),
    infoHoldSeconds: hold,
    speechHold: { base: sh[0] ?? 0, perChar: sh[1] ?? 0, min: sh[2] ?? 0, max: sh[3] ?? 0 },
    fadeOutSeconds: fade,
    fadeInSeconds: first(r('captionFadeIn', '^N real seconds$')),
    placePercent: first(r('captionPlace', 'within the lowest N% of the view')),
    fightTiles,
    fightBlowSeconds: fightBlow,
    heldDelaySeconds: heldDelay,
    heldMaxAgeSeconds: heldAge,
    promptFadeSeconds: first(r('promptFade', '^N real seconds$')),
    promptBackSeconds: first(r('promptQuiet', 'come back N real seconds after it')),
    moveDoneTiles: first(r('promptDone', 'Moving: N tiles walked', 'Notes')),
    tipSeconds,
    tipUses: 2,
    refusalSeconds: first(r('refusalHold', 'shows for N real seconds$')),
  };
}

export interface StormBalance {
  readonly lightningEvery: readonly [number, number];
  /** The scripted strike that shows the skerry, real seconds into the cold open. */
  readonly scriptedStrikeSeconds: number;
  /** The double flicker in ticks: bright, dim, bright; then a fade (real seconds). */
  readonly flash: { bright: number; dim: number; bright2: number; fadeSeconds: number };
  /** At most this many flashes in any one second. */
  readonly flashesPerSecond: number;
  /** The bright frames light the scene to this share of the day grade (0.7). */
  readonly flashDayShare: number;
  /** Reduced flashes: one soft swell, up and down (real seconds), at this strength. */
  readonly reduced: { up: number; down: number; strength: number };
  readonly thunderAfter: readonly [number, number];
  readonly thunderRoll: readonly [number, number];
  /** The two mist layers' drift (tiles a second) and their cover (shares of the view). */
  readonly fogSpeeds: readonly [number, number];
  readonly fogCover: readonly [number, number];
  /** The night grade's variation either way, its patch size (tiles) and drift (tiles a second). */
  readonly lightVaries: { share: number; patchTiles: number; driftTiles: number };
  readonly lanternTiles: number;
  /** The camera's sway: px up and down (with the pitch), px side to side (with the roll). */
  readonly swayY: number;
  readonly swayX: number;
  readonly pitchPx: number;
  readonly pitchSeconds: number;
  readonly rollFrames: number;
  readonly rollSeconds: number;
  readonly mastSwayPx: number;
  readonly swellApart: readonly [number, number];
  readonly swellSpeed: number;
  readonly breakEvery: readonly [number, number];
  readonly sprayCount: readonly [number, number];
  readonly sprayHeight: readonly [number, number];
  readonly greenWaterEvery: readonly [number, number];
  readonly rainDrops: readonly [number, number];
  readonly rainSlantDegrees: number;
  /** The first rain over the camp: day and minute it starts and ends, and its drops. */
  readonly firstRain: { fromDay: number; from: number; toDay: number; to: number };
  readonly firstRainDrops: readonly [number, number];
  readonly clothBeads: number;
  readonly beadGrow: readonly [number, number];
}

export function parseStormBalance(json: unknown): StormBalance {
  const r = reader(json, 'theOpeningGuidanceAndFeel', 'theStorm');
  const fl = r(
    'lightningFlash',
    '^Bright for N ticks, dim for N, bright for N, then fading over N real seconds$',
  );
  const red = r(
    'lightningReduced',
    'one soft swell of light, N s up and N s down, at half strength',
  );
  const fog = r('fog', 'drifting downwind at N and N tiles a second');
  const lv = r(
    'lightVaries',
    'varies by N% either way in drifting patches about N tiles across, moving with the wind at N tiles a second',
  );
  const rainTimes = r(
    'firstRain',
    '^A shower over the island from (\\d+):(\\d+) on day N to (\\d+):(\\d+) on day N',
  );
  const [fh, fm, fromDay, th, tm, toDay] = rainTimes;
  return {
    lightningEvery: pair(r('lightningEvery', '^N to N real seconds between strikes$')),
    scriptedStrikeSeconds: first(r('lightningEvery', 'about N s in', 'Notes')),
    flash: {
      bright: fl[0] ?? 0,
      dim: fl[1] ?? 0,
      bright2: fl[2] ?? 0,
      fadeSeconds: fl[3] ?? 0,
    },
    flashesPerSecond: (
      rowsOf(json, 'theOpeningGuidanceAndFeel', 'theStorm').find(
        (x) => x['Key'] === 'lightningFlash',
      )?.['Notes'] ?? ''
    ).includes('At most two flashes in any one second')
      ? 2
      : (() => {
          throw new Error('balance.json: theStorm.lightningFlash has no "At most two flashes"');
        })(),
    flashDayShare: first(r('lightningFlash', 'to N% of the day grade', 'Notes')) / 100,
    reduced: { up: red[0] ?? 0, down: red[1] ?? 0, strength: 0.5 },
    thunderAfter: pair(r('thunderAfter', '^N to N real seconds after the flash')),
    thunderRoll: pair(r('thunderAfter', 'the roll lasts N to N real seconds', 'Notes')),
    fogSpeeds: pair(fog),
    fogCover: pair(r('fog', '^N to N% cover', 'Notes')).map((x) => x / 100) as [number, number],
    lightVaries: { share: (lv[0] ?? 0) / 100, patchTiles: lv[1] ?? 0, driftTiles: lv[2] ?? 0 },
    lanternTiles: first(r('lightVaries', "lantern's pool of N tiles", 'Notes')),
    swayY: first(r('cameraSway', '^N px up and down')),
    swayX: first(r('cameraSway', 'and N px side to side')),
    pitchPx: first(r('pitch', 'up to N px')),
    pitchSeconds: first(r('pitch', 'over N real seconds$')),
    rollFrames: (
      rowsOf(json, 'theOpeningGuidanceAndFeel', 'theStorm').find((x) => x['Key'] === 'roll')?.[
        'Value'
      ] ?? ''
    ).includes('three roll frames')
      ? 3
      : (() => {
          throw new Error('balance.json: theStorm.roll has no "three roll frames"');
        })(),
    rollSeconds: first(r('roll', 'over N real seconds$')),
    mastSwayPx: first(r('roll', "mast's head sways N px", 'Notes')),
    swellApart: pair(r('swells', '^Crests N to N tiles apart')),
    swellSpeed: first(r('swells', 'rolling across at N tiles a second')),
    breakEvery: pair(r('breakingWaves', 'every N to N real seconds$')),
    sprayCount: pair(r('breakingWaves', 'A burst of N to N spray particles', 'Notes')),
    sprayHeight: pair(r('breakingWaves', 'reaching N to N px up', 'Notes')),
    greenWaterEvery: pair(r('greenWater', 'every N to N real seconds$')),
    rainDrops: pair(r('rain', '^N to N drops on screen')),
    rainSlantDegrees: first(r('rain', 'slanting N degrees')),
    firstRain: {
      fromDay: fromDay ?? 1,
      from: (fh ?? 0) * 60 + (fm ?? 0),
      toDay: toDay ?? 2,
      to: (th ?? 0) * 60 + (tm ?? 0),
    },
    firstRainDrops: pair(r('firstRain', 'A light overlay of N to N drops', 'Notes')),
    clothBeads: first(r('rainCloth', 'up to N beads at once')),
    beadGrow: pair(r('rainCloth', 'growing over N to N real seconds')),
  };
}
