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
  const staminaText = table('stamina');
  const stamina = /^(\d+);/.exec(staminaText);
  if (stamina === null) fail('vitalityStaminaAndArmour.stamina', staminaText, '"N; ..."');
  return { vitality: Number(vitality[1]), stamina: Number(stamina[1]) };
}

/** Book 10 section 02: movement on foot, in tiles per second. */
export interface MovementBalance {
  readonly sneak: number;
  readonly walk: number;
  readonly run: number;
  readonly carry: number;
}

export function parseMovementBalance(json: unknown): MovementBalance {
  const list = rows(json, 'timeAndTravel', 'movementOnFoot');
  const speed = (mode: string): number => {
    const row = list.find((r) => r['Mode'] === mode);
    if (row === undefined) throw new Error(`balance.json: movementOnFoot has no ${mode} row`);
    return number(`movementOnFoot.${mode}`, row['Speed'] ?? '');
  };
  return { sneak: speed('Sneak'), walk: speed('Walk'), run: speed('Run'), carry: speed('Carry') };
}
