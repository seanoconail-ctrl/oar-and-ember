/**
 * Typed access to content/balance.json, the only source of tuning numbers (Book 10). Book 10's
 * tables are text, so each value is parsed strictly: if its wording changes, loading fails with
 * the table, key and value rather than silently reading a wrong number.
 */

export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';
export const SEASONS: readonly Season[] = ['Spring', 'Summer', 'Autumn', 'Winter'];

/** Book 10 section 02: clock, daylight and tide. Times are minutes after midnight. */
export interface TimeBalance {
  /** Real seconds per game hour on foot. */
  readonly secondsPerHour: number;
  readonly dayStart: number;
  /** Collapse if still awake; minutes after midnight on the following night. */
  readonly dayEnd: number;
  readonly activeDayMinutes: number;
  /** Earliest time a bed ends the day. */
  readonly sleepAfter: number;
  readonly collapse: { readonly wakeAt: number; readonly staminaMaxChange: number };
  /** The day-length option, as a multiplier range on secondsPerHour. */
  readonly dayLength: { readonly min: number; readonly max: number };
  readonly watchHours: number;
  readonly seaWatchAnimSeconds: number;
  readonly daylight: Readonly<
    Record<Season, { readonly lightFrom: number; readonly darkFrom: number }>
  >;
  readonly tide: {
    /** Days between one-watch shifts of the tide. */
    readonly phaseShiftDays: number;
    /** Days of each season with spring tides. */
    readonly springTideDays: readonly number[];
    /** Width of the passable window around low water, in game minutes. */
    readonly tidalGroundWindowMinutes: number;
  };
}

type Row = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rows(json: unknown, section: string, table: string): Row[] {
  const tables = isRecord(json) ? json['tables'] : undefined;
  const sec = isRecord(tables) ? tables[section] : undefined;
  const list = isRecord(sec) ? sec[table] : undefined;
  if (!Array.isArray(list)) throw new Error(`balance.json: no table ${section}.${table}`);
  return list as Row[];
}

function keyed(json: unknown, section: string, table: string): (key: string) => string {
  const list = rows(json, section, table);
  return (key) => {
    const row = list.find((r) => r['Key'] === key);
    const value = row?.['Value'];
    if (value === undefined) throw new Error(`balance.json: ${section}.${table} has no "${key}"`);
    return value;
  };
}

function fail(where: string, value: string, expected: string): never {
  throw new Error(`balance.json: ${where} is "${value}"; expected ${expected}`);
}

function number(where: string, value: string): number {
  if (!/^-?\d+(\.\d+)?$/.test(value)) fail(where, value, 'a number');
  return Number(value);
}

function clockTime(where: string, value: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (m === null) fail(where, value, 'a time like 06:00');
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) fail(where, value, 'a real time of day');
  return hours * 60 + minutes;
}

export function parseTimeBalance(json: unknown): TimeBalance {
  const clock = keyed(json, 'timeAndTravel', 'clock');
  const tide = keyed(json, 'timeAndTravel', 'tide');

  const collapseText = clock('collapsePenalty');
  const collapse = /^Wake (\d{2}:\d{2}), stamina max (-?\d+) for the day$/.exec(collapseText);
  if (collapse === null) {
    fail('clock.collapsePenalty', collapseText, '"Wake HH:MM, stamina max -N for the day"');
  }
  const lengthText = clock('dayLengthOption');
  const length = /^(\d+(?:\.\d+)?) to (\d+(?:\.\d+)?)$/.exec(lengthText);
  if (length === null) fail('clock.dayLengthOption', lengthText, '"<min> to <max>"');

  const shiftText = tide('phaseShift');
  const shift = /^1 watch every (\d+) days$/.exec(shiftText);
  if (shift === null) fail('tide.phaseShift', shiftText, '"1 watch every N days"');
  const springText = tide('springTideDays');
  const spring = /^([\d, ]+?) and ([\d, ]+?) of each season$/.exec(springText);
  if (spring === null) fail('tide.springTideDays', springText, '"a, b and c, d of each season"');
  const windowText = tide('tidalGroundWindow');
  const window = /^(\d+) game hours around low water$/.exec(windowText);
  if (window === null)
    fail('tide.tidalGroundWindow', windowText, '"N game hours around low water"');
  const alternation = tide('alternation');
  if (alternation !== 'Flood and ebb each watch') {
    fail('tide.alternation', alternation, '"Flood and ebb each watch"');
  }

  const daylightRows = rows(json, 'timeAndTravel', 'daylight');
  const daylight = {} as Record<Season, { lightFrom: number; darkFrom: number }>;
  for (const season of SEASONS) {
    const row = daylightRows.find((r) => r['Season'] === season);
    if (row === undefined) throw new Error(`balance.json: daylight has no ${season} row`);
    daylight[season] = {
      lightFrom: clockTime(`daylight.${season}`, row['Light from'] ?? ''),
      darkFrom: clockTime(`daylight.${season}`, row['Dark from'] ?? ''),
    };
  }

  const days = (list: string): number[] =>
    list.split(',').map((d) => number('tide.springTideDays', d.trim()));

  return {
    secondsPerHour: number('clock.secondsPerHour', clock('secondsPerHour')),
    dayStart: clockTime('clock.dayStart', clock('dayStart')),
    dayEnd: clockTime('clock.dayEnd', clock('dayEnd')),
    activeDayMinutes: number('clock.activeDayMinutes', clock('activeDayMinutes')),
    sleepAfter: clockTime('clock.sleepAfter', clock('sleepAfter')),
    collapse: {
      wakeAt: clockTime('clock.collapsePenalty', collapse[1] ?? ''),
      staminaMaxChange: Number(collapse[2]),
    },
    dayLength: { min: Number(length[1]), max: Number(length[2]) },
    watchHours: number('clock.watchHours', clock('watchHours')),
    seaWatchAnimSeconds: number('clock.seaWatchAnimSeconds', clock('seaWatchAnimSeconds')),
    daylight,
    tide: {
      phaseShiftDays: Number(shift[1]),
      springTideDays: [...days(spring[1] ?? ''), ...days(spring[2] ?? '')],
      tidalGroundWindowMinutes: Number(window[1]) * 60,
    },
  };
}

/** Book 10 section 06: the starting vitality and stamina of the steerer and adult residents. */
export interface PeopleBasics {
  readonly vitality: number;
  readonly stamina: number;
}

export function parsePeopleBasics(json: unknown): PeopleBasics {
  const table = keyed(json, 'combatTimings', 'vitalityStaminaAndArmour');
  const vitalityText = table('vitality');
  const vitality = /^(\d+) for the steerer and adult residents$/.exec(vitalityText);
  if (vitality === null) {
    fail(
      'vitalityStaminaAndArmour.vitality',
      vitalityText,
      '"N for the steerer and adult residents"',
    );
  }
  // Combat v2 (decision DE-13): the bar's size is "Health, stamina and healing", staminaMax.
  const staminaText = keyed(json, 'combatTimings', 'healthStaminaAndHealing')('staminaMax');
  const stamina = /^(\d+)$/.exec(staminaText);
  if (stamina === null) fail('healthStaminaAndHealing.staminaMax', staminaText, '"N"');
  return { vitality: Number(vitality[1]), stamina: Number(stamina[1]) };
}

/** Book 10 section 02: movement on foot, in tiles per second. */
export interface MovementBalance {
  readonly sneak: number;
  readonly walk: number;
  readonly run: number;
  readonly carry: number;
  /** Walking speed in water, before the depth band's speed factor. */
  readonly wade: number;
}

export function parseMovementBalance(json: unknown): MovementBalance {
  const list = rows(json, 'timeAndTravel', 'movementOnFoot');
  const speed = (mode: string): number => {
    const row = list.find((r) => r['Mode'] === mode);
    if (row === undefined) throw new Error(`balance.json: movementOnFoot has no ${mode} row`);
    return number(`movementOnFoot.${mode}`, row['Speed'] ?? '');
  };
  return {
    sneak: speed('Sneak'),
    walk: speed('Walk'),
    run: speed('Run'),
    carry: speed('Carry'),
    wade: speed('Wade'),
  };
}

/** Book 10 section 02, "Water depth bands": WET, ANKLE, KNEE, WAIST and DEEP (Book 2 section 10). */
export type DepthBand = 'WET' | 'ANKLE' | 'KNEE' | 'WAIST' | 'DEEP';
export const DEPTH_BANDS: readonly DepthBand[] = ['WET', 'ANKLE', 'KNEE', 'WAIST', 'DEEP'];

export interface DepthBandBalance {
  readonly band: DepthBand;
  /** The band holds up to this depth (height-field units); Infinity for deep water. */
  readonly upTo: number;
  /** Pixels of the sprite hidden below the waterline; null where the person swims. */
  readonly maskPx: number | null;
  /** Speed multiplier; null where the person swims (the swim speed applies). */
  readonly speedFactor: number | null;
  readonly staminaPerSecond: number;
}

export interface WaterBalance {
  readonly bands: readonly DepthBandBalance[];
  /** Carrying in waist-deep water: an extra multiplier on the carry speed ("carry speed x0.6"). */
  readonly waistCarryFactor: number;
  /** Seconds between ripple rings while standing in water. */
  readonly rippleStandingSeconds: number;
  /** How long a ripple ring lasts, and how wide it grows (px). */
  readonly rippleLifeSeconds: number;
  readonly rippleWidthPx: number;
  /** Seconds of dripping (and a darker sprite) after leaving knee, or waist and deep, water. */
  readonly dripAfterKneeSeconds: number;
  readonly dripAfterWaistSeconds: number;
  /** Seconds between spray bursts round a person standing in the surf. */
  readonly sprayAroundWaderSeconds: number;
  /** The band of a stream crossing open ground. */
  readonly streamBand: DepthBand;
}

export function parseWaterBalance(json: unknown): WaterBalance {
  const list = rows(json, 'timeAndTravel', 'waterDepthBands');
  const bands = DEPTH_BANDS.map((band): DepthBandBalance => {
    const name = band.charAt(0) + band.slice(1).toLowerCase();
    const row = list.find((r) => r['Band'] === name);
    if (row === undefined) throw new Error(`balance.json: waterDepthBands has no ${name} row`);
    const where = `waterDepthBands.${name}`;
    const upToText = row['Depth up to'] ?? '';
    const maskText = row['Sprite masked (px)'] ?? '';
    const speedText = row['Speed factor'] ?? '';
    return {
      band,
      upTo: upToText === 'Deeper' ? Infinity : number(where, upToText),
      maskPx: maskText === 'Swimming' ? null : number(where, maskText),
      speedFactor: speedText === 'Swim speed' ? null : number(where, speedText),
      staminaPerSecond: number(where, row['Stamina per second'] ?? ''),
    };
  });
  for (let i = 1; i < bands.length; i++)
    if ((bands[i]?.upTo ?? 0) <= (bands[i - 1]?.upTo ?? 0))
      throw new Error('balance.json: waterDepthBands "Depth up to" must rise band by band');
  if (bands[bands.length - 1]?.upTo !== Infinity)
    throw new Error('balance.json: waterDepthBands.Deep "Depth up to" must be "Deeper"');
  const waistNotes = list.find((r) => r['Band'] === 'Waist')?.['Notes'] ?? '';
  const carry = /carry speed x(\d+(?:\.\d+)?)/.exec(waistNotes);
  if (carry === null) fail('waterDepthBands.Waist.Notes', waistNotes, '"... carry speed xN ..."');
  const effect = keyed(json, 'timeAndTravel', 'waterEffects');
  const seconds = (key: string, pattern: RegExp, expected: string): RegExpExecArray => {
    const text = effect(key);
    const m = pattern.exec(text);
    if (m === null) fail(`waterEffects.${key}`, text, expected);
    return m;
  };
  const standing = seconds(
    'rippleStanding',
    /^One ring every (\d+(?:\.\d+)?) s while standing in water$/,
    '"One ring every N s while standing in water"',
  );
  const life = seconds(
    'rippleLife',
    /^(\d+(?:\.\d+)?) s, growing to (\d+) px across$/,
    '"N s, growing to N px across"',
  );
  const knee = seconds('dripAfterKnee', /^(\d+(?:\.\d+)?) s of dripping/, '"N s of dripping ..."');
  const waist = seconds(
    'dripAfterWaist',
    /^(\d+(?:\.\d+)?) s after leaving/,
    '"N s after leaving ..."',
  );
  const spray = seconds(
    'sprayAroundWader',
    /^One spray burst every (\d+(?:\.\d+)?) s/,
    '"One spray burst every N s ..."',
  );
  const streamText = effect('streamBand');
  const stream = DEPTH_BANDS.find((band) =>
    streamText.startsWith(`${band.charAt(0)}${band.slice(1).toLowerCase()}:`),
  );
  if (stream === undefined) fail('waterEffects.streamBand', streamText, '"<Band>: ..."');
  return {
    bands,
    streamBand: stream,
    waistCarryFactor: Number(carry[1]),
    rippleStandingSeconds: Number(standing[1]),
    rippleLifeSeconds: Number(life[1]),
    rippleWidthPx: Number(life[2]),
    dripAfterKneeSeconds: Number(knee[1]),
    dripAfterWaistSeconds: Number(waist[1]),
    sprayAroundWaderSeconds: Number(spray[1]),
  };
}

/** The band for a still-water depth (height-field units), or null on dry ground. */
export function bandForDepth(water: WaterBalance, depth: number): DepthBandBalance | null {
  if (!(depth > 0)) return null;
  for (const b of water.bands) if (depth < b.upTo) return b;
  return water.bands[water.bands.length - 1] ?? null;
}

/** Book 10 section 21, "Controls and camera". Distances in tiles, times in seconds. */
export interface ControlsBalance {
  readonly hotbarSlots: number;
  readonly toolReach: number;
  readonly interactReach: number;
  readonly castReach: number;
  /** Share of the right stick's travel that counts as centred. */
  readonly gamepadDeadZone: number;
  readonly lookAheadScale: number;
  readonly lookAheadMax: number;
  readonly lookAheadAiming: number;
  readonly lookAheadDeadZone: number;
  readonly cameraHalfLife: number;
  /** Seconds for the keyboard's direction-of-travel lead to swing halfway to a new heading. */
  readonly keyboardLeadHalfLife: number;
  /** Logical pixels the smoothed offset must move past the drawn one before it changes. */
  readonly cameraSnap: number;
}

export function parseControlsBalance(json: unknown): ControlsBalance {
  const table = keyed(json, 'controlsAndCamera', 'table');
  const lead = (key: string, pattern: RegExp, expected: string): number => {
    const text = table(key);
    const m = pattern.exec(text);
    if (m === null) fail(`controlsAndCamera.${key}`, text, expected);
    return Number(m[1]);
  };
  const N = '(\\d+(?:\\.\\d+)?)';
  const tiles = (key: string): number => lead(key, new RegExp(`^${N} tiles?\\b`), '"N tiles ..."');
  return {
    hotbarSlots: lead('hotbarSlots', new RegExp(`^${N}$`), 'a number'),
    toolReach: tiles('toolReach'),
    interactReach: tiles('interactReach'),
    castReach: tiles('castReach'),
    gamepadDeadZone: lead(
      'gamepadDeadZone',
      new RegExp(`^${N} of the right stick's travel$`),
      '"N of the right stick\'s travel"',
    ),
    lookAheadScale: lead(
      'lookAheadScale',
      new RegExp(`^${N} x the cursor's distance`),
      '"N x the cursor\'s distance ..."',
    ),
    lookAheadMax: tiles('lookAheadMax'),
    lookAheadAiming: tiles('lookAheadAiming'),
    lookAheadDeadZone: tiles('lookAheadDeadZone'),
    cameraHalfLife: lead('cameraHalfLife', new RegExp(`^${N} s\\b`), '"N s, ..."'),
    keyboardLeadHalfLife: lead('keyboardLeadHalfLife', new RegExp(`^${N} s\\b`), '"N s: ..."'),
    cameraSnap: lead(
      'cameraSnap',
      new RegExp(`moves ${N} px past it`),
      '"... moves N px past it ..."',
    ),
  };
}

/** Book 10 section 06: a missile weapon's reach (tiles) and its draw or wind-up (ticks). */
export interface RangedWeapon {
  readonly reachTiles: number;
  /** Ticks to a full draw (the bow) or the throw's wind-up (a thrown spear). */
  readonly drawTicks: number;
}

/** Book 10 section 21, "Starting weapons", and the missile rows of section 06. */
export interface StartingWeaponsBalance {
  /** The hotbar on waking: empty (decision DD-6). */
  readonly startingHotbarEmpty: true;
  /** Minutes of play by which the seax and the bow are found. */
  readonly seaxFoundByMinutes: number;
  readonly bowFoundByMinutes: number;
  /** Arrows in the quiver found with the bow. */
  readonly startingArrows: number;
}

export function parseStartingWeapons(json: unknown): StartingWeaponsBalance {
  const table = keyed(json, 'controlsAndCamera', 'startingWeapons');
  const hotbar = table('startingHotbar');
  if (hotbar !== 'Empty') fail('startingWeapons.startingHotbar', hotbar, '"Empty"');
  const minutes = (key: string): number => {
    const text = table(key);
    const m = /^(\d+) minutes of play:/.exec(text);
    if (m === null) fail(`startingWeapons.${key}`, text, '"N minutes of play: ..."');
    return Number(m[1]);
  };
  return {
    startingHotbarEmpty: true,
    seaxFoundByMinutes: minutes('seaxFoundBy'),
    bowFoundByMinutes: minutes('bowFoundBy'),
    startingArrows: number('startingWeapons.startingArrows', table('startingArrows')),
  };
}

/** Book 10 section 21, "Missiles", with the bow and thrown spear of section 06. */
export interface MissileBalance {
  readonly bow: RangedWeapon;
  readonly spear: RangedWeapon;
  /** A draw released sooner is cancelled and spends nothing. */
  readonly minDrawTicks: number;
  /** Tiles per second. */
  readonly arrowSpeed: number;
  readonly spearSpeed: number;
  /** Height of the arc at the weapon's full range, in tiles (in proportion for shorter shots). */
  readonly arcApexTiles: number;
  /** Degrees either side of the aim at a full draw. */
  readonly spreadFullDraw: { readonly bow: number; readonly spear: number };
  /** Degrees either side at the minimum draw. */
  readonly spreadQuickDraw: number;
  /** A raised shield stops missiles from this many degrees in front. */
  readonly shieldArcDegrees: number;
  /** Low cover stops a missile only below this height, in tiles. */
  readonly lowCoverTiles: number;
  /** Most missiles left stuck in a zone (the oldest goes first). */
  readonly stuckMax: number;
  /** Game days a missile stays stuck in the ground. */
  readonly stuckGroundDays: number;
  /** The shadow under a missile, in pixels. */
  readonly shadow: { readonly w: number; readonly h: number };
}

/** A row of Book 10 section 06's "Weapon movesets" (combat v2, decision DE-13). */
function weaponRow(json: unknown, weapon: string): Row {
  const row = rows(json, 'combatTimings', 'weaponMovesets').find((r) => r['Weapon'] === weapon);
  if (row === undefined) throw new Error(`balance.json: weaponMovesets has no ${weapon} row`);
  return row;
}

export function parseMissileBalance(json: unknown): MissileBalance {
  const table = keyed(json, 'controlsAndCamera', 'missiles');
  const N = '(\\d+(?:\\.\\d+)?)';
  const match = (key: string, pattern: RegExp, expected: string): RegExpExecArray => {
    const text = table(key);
    const m = pattern.exec(text);
    if (m === null) fail(`missiles.${key}`, text, expected);
    return m;
  };
  const bowRow = weaponRow(json, 'Hunting bow');
  const spearRow = weaponRow(json, 'Spear, thrown');
  const bow: RangedWeapon = {
    reachTiles: number('weaponMovesets.Hunting bow.Reach', bowRow['Reach'] ?? ''),
    drawTicks: number('weaponMovesets.Hunting bow.Windup', bowRow['Windup'] ?? ''),
  };
  const spear: RangedWeapon = {
    reachTiles: number('weaponMovesets.Spear, thrown.Reach', spearRow['Reach'] ?? ''),
    drawTicks: number('weaponMovesets.Spear, thrown.Windup', spearRow['Windup'] ?? ''),
  };
  const full = match(
    'spreadFullDraw',
    new RegExp(
      `^${N} degrees either side for a bow at full draw \\((\\d+) ticks\\); ${N} for a thrown spear$`,
    ),
    '"N degrees either side for a bow at full draw (N ticks); N for a thrown spear"',
  );
  if (Number(full[2]) !== bow.drawTicks)
    fail(
      'missiles.spreadFullDraw',
      table('spreadFullDraw'),
      `a full draw of ${bow.drawTicks} ticks`,
    );
  const shield = match(
    'shieldBlock',
    new RegExp(`from the front ${N} degrees`),
    '"... from the front N degrees ..."',
  );
  const cover = match(
    'coverBlock',
    new RegExp(`below ${N} tiles of height`),
    '"... below N tiles of height ..."',
  );
  const stuck = match(
    'stuckArrows',
    new RegExp(`in the ground for ${N} game days?,.* at most (\\d+) in a zone`),
    '"... in the ground for N game day, ... at most N in a zone ..."',
  );
  const shadow = match('shadow', /^A soft (\d+) x (\d+) shadow/, '"A soft W x H shadow ..."');
  return {
    bow,
    spear,
    minDrawTicks: Number(match('minDraw', /^(\d+) ticks:/, '"N ticks: ..."')[1]),
    arrowSpeed: Number(
      match('arrowSpeed', new RegExp(`^${N} tiles per second$`), '"N tiles per second"')[1],
    ),
    spearSpeed: Number(
      match('spearSpeed', new RegExp(`^${N} tiles per second$`), '"N tiles per second"')[1],
    ),
    arcApexTiles: Number(
      match(
        'arcApex',
        new RegExp(`^${N} tiles of height at the weapon's full range`),
        '"N tiles of height at the weapon\'s full range ..."',
      )[1],
    ),
    spreadFullDraw: { bow: Number(full[1]), spear: Number(full[3]) },
    spreadQuickDraw: Number(
      match(
        'spreadQuickDraw',
        new RegExp(`^${N} degrees either side at the minimum draw`),
        '"N degrees either side at the minimum draw ..."',
      )[1],
    ),
    shieldArcDegrees: Number(shield[1]),
    lowCoverTiles: Number(cover[1]),
    stuckGroundDays: Number(stuck[1]),
    stuckMax: Number(stuck[2]),
    shadow: { w: Number(shadow[1]), h: Number(shadow[2]) },
  };
}

/** Where a missile ends up, for the recovery chances of Book 10 section 21, "Arrows". */
export type MissileRest = 'ground' | 'stone' | 'body' | 'shield' | 'water';

/** Book 10 section 21, "Arrows". */
export interface ArrowBalance {
  readonly quiverMax: number;
  /** Share recoverable (0 to 1) by where the arrow ended up; the rest break. */
  readonly recover: Readonly<Record<MissileRest, number>>;
  readonly fletching: {
    readonly shafts: number;
    readonly feathers: number;
    readonly heads: number;
    readonly makes: number;
    readonly gameHours: number;
    readonly skill: number;
  };
  /** Arrows found in a cache, a dead archer's quiver or a hunter's camp. */
  readonly finds: { readonly min: number; readonly max: number };
}

export function parseArrowBalance(json: unknown): ArrowBalance {
  const table = keyed(json, 'controlsAndCamera', 'arrows');
  const share = (key: string): number => {
    const text = table(key);
    const m = /^(\d+)%/.exec(text);
    if (m === null) fail(`arrows.${key}`, text, '"N% ..."');
    return Number(m[1]) / 100;
  };
  const fletchText = table('fletching');
  const fletch =
    /^(\d+) driftwood or timber shaft-blank, (\d+) feathers and (\d+) head \(bone or iron\) make (\d+) arrows in (\d+(?:\.\d+)?) game hours, fletching skill (\d+) or more$/.exec(
      fletchText,
    );
  if (fletch === null)
    fail(
      'arrows.fletching',
      fletchText,
      '"N ... shaft-blank, N feathers and N head ... make N arrows in N game hours, fletching skill N or more"',
    );
  const findsText = table('finds');
  const finds = /^(\d+) to (\d+) arrows/.exec(findsText);
  if (finds === null) fail('arrows.finds', findsText, '"N to N arrows ..."');
  return {
    quiverMax: number('arrows.quiverMax', table('quiverMax')),
    recover: {
      ground: share('recoverGround'),
      stone: share('recoverStone'),
      body: share('recoverBody'),
      shield: share('recoverShield'),
      water: share('recoverWater'),
    },
    fletching: {
      shafts: Number(fletch[1]),
      feathers: Number(fletch[2]),
      heads: Number(fletch[3]),
      makes: Number(fletch[4]),
      gameHours: Number(fletch[5]),
      skill: Number(fletch[6]),
    },
    finds: { min: Number(finds[1]), max: Number(finds[2]) },
  };
}
