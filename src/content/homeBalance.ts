/**
 * Typed access to the Book 10 numbers of the home on foot (Stage 7): the homestead tasks' game
 * time and stamina and the hands-on action (section 09), work, gathering and the wreck camp
 * (section 03), skills and wounds (section 08), and stamina in traversal and its capacity
 * (section 06). Like balance.ts, every value is parsed strictly, so a change of wording fails at
 * load with the table, key and value rather than reading a wrong number.
 */
import { SEASONS } from './balance.ts';
import type { Season } from './balance.ts';

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

function fail(where: string, value: string, expected: string): never {
  throw new Error(`balance.json: ${where} is "${value}"; expected ${expected}`);
}

function keyed(json: unknown, section: string, table: string): (key: string) => string {
  const list = rows(json, section, table);
  return (key) => {
    const value = list.find((r) => r['Key'] === key)?.['Value'];
    if (value === undefined) throw new Error(`balance.json: ${section}.${table} has no "${key}"`);
    return value;
  };
}

function match(where: string, text: string, pattern: RegExp, expected: string): RegExpExecArray {
  const m = pattern.exec(text);
  if (m === null) fail(where, text, expected);
  return m;
}

const N = '(-?\\d+(?:\\.\\d+)?)';

/** Book 10 section 09, "Homestead tasks: time and stamina": one row per task, by its name. */
export interface TaskCost {
  readonly gameMinutes: number;
  readonly stamina: number;
}

/** Book 10 section 09, "Hands-on action". Seconds are real seconds. */
export interface ActionBalance {
  readonly actionSeconds: number;
  /**
   * The tasks (their Book 10 row names) that keep a timed press (`timedTasks`: fishing from the
   * shore); every other task is a plain action with no ring and no press (decision PT-1).
   */
  readonly timed: ReadonlySet<string>;
  readonly markSeconds: number;
  readonly windowSeconds: number;
}

/** The name the pick-up's cost goes by among the task costs: Book 10's table "Driftwood finds". */
export const DRIFTWOOD_FINDS = 'Driftwood finds';

export interface TaskBalance {
  /**
   * By the task's name in Book 10 ("Fish from the shore", "Cook", ...); a driftwood pick-up's
   * minutes and stamina go by DRIFTWOOD_FINDS (section 03, "Driftwood finds", pickUp).
   */
  readonly costs: ReadonlyMap<string, TaskCost>;
  readonly action: ActionBalance;
}

export function parseTaskBalance(json: unknown): TaskBalance {
  const costs = new Map<string, TaskCost>();
  for (const r of rows(json, 'buildingsToolsAndCrafting', 'homesteadTasksTimeAndStamina')) {
    const name = r['Task'] ?? '';
    const minutes = r['Game minutes per action'] ?? '';
    const stamina = r['Stamina per action'] ?? '';
    if (!/^\d+$/.test(minutes)) fail(`tasks.${name}.minutes`, minutes, 'a whole number');
    if (!/^\d+$/.test(stamina)) fail(`tasks.${name}.stamina`, stamina, 'a whole number');
    costs.set(name, { gameMinutes: Number(minutes), stamina: Number(stamina) });
  }
  const pickUp = parseDriftwoodBalance(json);
  costs.set(DRIFTWOOD_FINDS, { gameMinutes: pickUp.pickUpMinutes, stamina: pickUp.pickUpStamina });
  const action = keyed(json, 'buildingsToolsAndCrafting', 'handsOnAction');
  const timedText = match(
    'handsOnAction.timedTasks',
    action('timedTasks'),
    /^(.+?) only; every other task is a plain action$/,
    '"<task>, <task> and <task> only; every other task is a plain action"',
  )[1];
  const timed = (timedText ?? '').split(/, | and /).map((t) => t.trim());
  for (const t of timed)
    if (!costs.has(t)) fail('handsOnAction.timedTasks', t, 'a task of Homestead tasks');
  return {
    costs,
    action: {
      actionSeconds: Number(
        match(
          'handsOnAction.actionSeconds',
          action('actionSeconds'),
          new RegExp(`^${N} real seconds`),
          '"N real seconds ..."',
        )[1],
      ),
      timed: new Set(timed),
      markSeconds: Number(
        match(
          'handsOnAction.timingMark',
          action('timingMark'),
          new RegExp(`^${N} real seconds into a timed action$`),
          '"N real seconds into a timed action"',
        )[1],
      ),
      windowSeconds: Number(
        match(
          'handsOnAction.timingWindow',
          action('timingWindow'),
          new RegExp(`^${N} real seconds either side of the mark`),
          '"N real seconds either side of the mark ..."',
        )[1],
      ),
    },
  };
}

/** Book 10 section 03, "Driftwood finds" (decisions PT-2 and PT-3). */
export interface DriftwoodBalance {
  /** How many spots on Wreck Strand hold a piece (content/camp.json's DRIFTWOOD sites). */
  readonly spots: number;
  /** Pieces the sea leaves at bare spots each dawn, by season, before a storm's factor. */
  readonly perDawn: Readonly<Record<Season, number>>;
  /** The factor at the dawn after a storm. */
  readonly afterStorm: number;
  /** Loads of driftwood in one piece. */
  readonly loadsPerPiece: number;
  /** A pick-up's game minutes and stamina, and the stoop's real seconds. */
  readonly pickUpMinutes: number;
  readonly pickUpStamina: number;
  readonly stoopSeconds: number;
}

export function parseDriftwoodBalance(json: unknown): DriftwoodBalance {
  const finds = keyed(json, 'foodFuelAndSeasons', 'driftwoodFinds');
  const spots = match(
    'driftwoodFinds.spots',
    finds('spots'),
    /^(\d+) spots on /,
    '"N spots on ..."',
  );
  match(
    'driftwoodFinds.firstDawn',
    finds('firstDawn'),
    /^A piece at every spot$/,
    '"A piece at every spot"',
  );
  const dawn = match(
    'driftwoodFinds.piecesPerDawn',
    finds('piecesPerDawn'),
    /^Spring (\d+), summer (\d+), autumn (\d+), winter (\d+)$/,
    '"Spring N, summer N, autumn N, winter N"',
  );
  const storm = match(
    'driftwoodFinds.afterStorm',
    finds('afterStorm'),
    new RegExp(`^${N} times the season's pieces$`),
    '"N times the season\'s pieces"',
  );
  const loads = match(
    'driftwoodFinds.loadsPerPiece',
    finds('loadsPerPiece'),
    new RegExp(`^${N} loads?$`),
    '"N loads"',
  );
  const pick = match(
    'driftwoodFinds.pickUp',
    finds('pickUp'),
    new RegExp(
      `^(\\d+) game minutes and (\\d+) stamina; the steerer stoops for ${N} real seconds$`,
    ),
    '"N game minutes and N stamina; the steerer stoops for N real seconds"',
  );
  return {
    spots: Number(spots[1]),
    perDawn: {
      Spring: Number(dawn[1]),
      Summer: Number(dawn[2]),
      Autumn: Number(dawn[3]),
      Winter: Number(dawn[4]),
    },
    afterStorm: Number(storm[1]),
    loadsPerPiece: Number(loads[1]),
    pickUpMinutes: Number(pick[1]),
    pickUpStamina: Number(pick[2]),
    stoopSeconds: Number(pick[3]),
  };
}

/** Book 10 sections 03 and 08: work, gathering, fuel, food, skills and wounds. */
export interface WorkBalance {
  /** Game minutes of work in a worker-day. */
  readonly workerDayMinutes: number;
  /** Per worker-day at skill 2, by season (section 03). */
  readonly fishShore: Readonly<Record<Season, number>>;
  /** Loads per search at skill 2, by season (no storms yet: the plain rate). */
  readonly driftwoodPerSearch: Readonly<Record<Season, number>>;
  /** A resident's worker-day of searching counts as this many of the steerer's searches. */
  readonly driftwoodSearchesPerWorkerDay: number;
  /** Loads a heated house (and the camp fire) burns in a day, by season. */
  readonly fuelPerDay: Readonly<Record<Season, number>>;
  readonly foodPerPersonPerDay: number;
  /** Fresh fish: ration-days per fish and days it keeps. */
  readonly freshFish: { readonly rd: number; readonly keepsDays: number };
  /** The wreck camp at S0: salted stores and fuel. */
  readonly wreckStoresRd: number;
  readonly campFuelLoads: number;
  readonly fireLightLoads: number;
  /** Output x (base + perLevel x level). */
  readonly output: { readonly base: number; readonly perLevel: number };
  /** Up to this share added for good timing (0.25). */
  readonly timingBonus: number;
  readonly startingSkills: {
    readonly named: number;
    readonly steererTasks: number;
    readonly otherwise: number;
  };
  /** Days a wound takes to heal once tended, by severity. */
  readonly woundDays: { readonly LIGHT: number; readonly SERIOUS: number; readonly GRAVE: number };
  /** A serious wound halves work (Book 10: "half work"). */
  readonly seriousWorkFactor: number;
}

function seasonRow(where: string, row: Row | undefined): Record<Season, number> {
  if (row === undefined) throw new Error(`balance.json: ${where} is missing`);
  const out = {} as Record<Season, number>;
  for (const s of SEASONS) {
    const text = row[s] ?? '';
    const m = match(`${where}.${s}`, text, new RegExp(`^${N}`), '"N ..."');
    out[s] = Number(m[1]);
  }
  return out;
}

export function parseWorkBalance(json: unknown): WorkBalance {
  const camp = keyed(json, 'foodFuelAndSeasons', 'workAndTheWreckCamp');
  const gathering = rows(json, 'foodFuelAndSeasons', 'gatheringAndFishing');
  const fishRow = gathering.find((r) => r['Source'] === 'Fishing from shore');
  const woodRow = gathering.find((r) => r['Source'] === 'Driftwood');
  // Driftwood's autumn and winter rates are after storms; with no storms (weather is Stage 13),
  // a search finds the plain rate of spring.
  const wood = seasonRow('gatheringAndFishing.Driftwood', woodRow);
  for (const s of SEASONS) if ((woodRow?.[s] ?? '').includes('after storms')) wood[s] = wood.Spring;
  const fuelText = keyed(json, 'foodFuelAndSeasons', 'fuelAndHay')('houseFuelPerDay');
  const fuel = match(
    'fuelAndHay.houseFuelPerDay',
    fuelText,
    new RegExp(`^Summer ${N}, spring and autumn ${N}, winter ${N}$`),
    '"Summer N, spring and autumn N, winter N"',
  );
  const consumption = keyed(json, 'foodFuelAndSeasons', 'consumption');
  const food = match(
    'consumption.foodPerPersonPerDay',
    consumption('foodPerPersonPerDay'),
    new RegExp(`^${N} rd`),
    '"N rd ..."',
  );
  const items = rows(json, 'foodFuelAndSeasons', 'foodItems');
  const fresh = items.find((r) => r['Item'] === 'Fresh fish');
  const freshValue = match(
    'foodItems.Fresh fish',
    fresh?.['Food value'] ?? '',
    new RegExp(`^${N} rd per fish$`),
    '"N rd per fish"',
  );
  const freshKeeps = match(
    'foodItems.Fresh fish.Keeps',
    fresh?.['Keeps'] ?? '',
    new RegExp(`^${N} days$`),
    '"N days"',
  );
  const skills = keyed(json, 'peopleSkillsAndWounds', 'skills');
  const output = match(
    'skills.outputMultiplier',
    skills('outputMultiplier'),
    new RegExp(`^${N} \\+ ${N} x level`),
    '"N + N x level ..."',
  );
  const timing = match(
    'skills.playerTimingBonus',
    skills('playerTimingBonus'),
    /^Up to \+(\d+)% task output/,
    '"Up to +N% task output ..."',
  );
  const starting = match(
    'skills.startingSkills',
    skills('startingSkills'),
    /^(\d+) in each skill Book 5 names for a person; the steerer (\d+) in every homestead task; (\d+) otherwise$/,
    '"N in each skill Book 5 names for a person; the steerer N in every homestead task; N otherwise"',
  );
  const wounds = rows(json, 'peopleSkillsAndWounds', 'wounds');
  const days = (severity: string): number => {
    const text = wounds.find((r) => r['Severity'] === severity)?.['Recovery'] ?? '';
    return Number(match(`wounds.${severity}`, text, /^(\d+) days$/, '"N days"')[1]);
  };
  const serious = wounds.find((r) => r['Severity'] === 'Serious')?.['Effect'] ?? '';
  if (!serious.includes('half work')) fail('wounds.Serious.Effect', serious, '"... half work"');
  return {
    workerDayMinutes:
      Number(
        match(
          'workAndTheWreckCamp.workerDay',
          camp('workerDay'),
          new RegExp(`^${N} game hours of work$`),
          '"N game hours of work"',
        )[1],
      ) * 60,
    fishShore: seasonRow('gatheringAndFishing.Fishing from shore', fishRow),
    driftwoodPerSearch: wood,
    fuelPerDay: {
      Summer: Number(fuel[1]),
      Spring: Number(fuel[2]),
      Autumn: Number(fuel[2]),
      Winter: Number(fuel[3]),
    },
    foodPerPersonPerDay: Number(food[1]),
    freshFish: { rd: Number(freshValue[1]), keepsDays: Number(freshKeeps[1]) },
    wreckStoresRd: Number(
      match(
        'workAndTheWreckCamp.wreckStores',
        camp('wreckStores'),
        new RegExp(`^${N} rd of salt fish$`),
        '"N rd of salt fish"',
      )[1],
    ),
    driftwoodSearchesPerWorkerDay: Number(
      match(
        'workAndTheWreckCamp.driftwoodSearchesPerWorkerDay',
        camp('driftwoodSearchesPerWorkerDay'),
        new RegExp(`^${N} searches$`),
        '"N searches"',
      )[1],
    ),
    campFuelLoads: Number(
      match(
        'workAndTheWreckCamp.campFuel',
        camp('campFuel'),
        new RegExp(`^${N} loads$`),
        '"N loads"',
      )[1],
    ),
    fireLightLoads: Number(
      match(
        'workAndTheWreckCamp.fireLight',
        camp('fireLight'),
        new RegExp(`^${N} loads? of driftwood$`),
        '"N load of driftwood"',
      )[1],
    ),
    output: { base: Number(output[1]), perLevel: Number(output[2]) },
    timingBonus: Number(timing[1]) / 100,
    startingSkills: {
      named: Number(starting[1]),
      steererTasks: Number(starting[2]),
      otherwise: Number(starting[3]),
    },
    woundDays: { LIGHT: days('Light'), SERIOUS: days('Serious'), GRAVE: days('Grave') },
    seriousWorkFactor: 0.5,
  };
}

/** Book 2 section 24. */
export type StaminaReason =
  | 'COLD'
  | 'HUNGRY'
  | 'STARVING'
  | 'WOUNDED'
  | 'BADLY_WOUNDED'
  | 'SICK'
  | 'TIRED'
  | 'EXHAUSTED'
  | 'HARD_WORK'
  | 'FEAST';

/** Book 10 section 06: stamina in traversal, running out, and capacity. */
export interface StaminaBalance {
  readonly base: number;
  /** Per second. */
  readonly regenPerSecond: number;
  /** Ticks without spending before regeneration starts. */
  readonly regenDelayTicks: number;
  readonly drain: {
    readonly run: number;
    readonly runCombat: number;
    readonly heavyCarry: number;
    readonly waistWade: number;
    readonly climb: number;
    readonly swim: number;
  };
  /** Stamina regained before a sprint, a heavy carry or waist wading can start again. */
  readonly recoverAt: number;
  /** Capacity: the amount each reason lowers (or a feast raises) the maximum. */
  readonly capacity: Readonly<Record<StaminaReason, number>>;
  readonly minimumMax: number;
  /** Minutes after midnight by which a steerer with no meal since waking is hungry (14:00). */
  readonly hungryAt: number;
  /** Game minutes of sleep below which the steerer is tired. */
  readonly shortSleepMinutes: number;
  /** Game minutes of tasks in a day beyond which the day was hard work. */
  readonly hardWorkMinutes: number;
  /** Game minutes of sleep in a bed that make a full rest. */
  readonly fullRestMinutes: number;
  /** A warm fire: game minutes within its reach, and that reach in tiles. */
  readonly warmFire: { readonly minutes: number; readonly tiles: number };
}

export function parseStaminaBalance(json: unknown): StaminaBalance {
  const drains = rows(json, 'combatTimings', 'staminaInTraversal');
  const drain = (activity: string): Row => {
    const row = drains.find((r) => r['Activity'] === activity);
    if (row === undefined) throw new Error(`balance.json: staminaInTraversal has no ${activity}`);
    return row;
  };
  const n = (where: string, text: string): number =>
    Number(match(where, text, new RegExp(`^${N}$`), 'a number')[1]);
  const run = drain('Run (sprint)');
  const runCombat = match(
    'staminaInTraversal.Run.Notes',
    run['Notes'] ?? '',
    new RegExp(`^${N} while in combat$`),
    '"N while in combat"',
  );
  // Combat v2 (decision DE-13): "Health, stamina and healing", staminaMax and staminaRegen.
  const health = keyed(json, 'combatTimings', 'healthStaminaAndHealing');
  const max = match(
    'healthStaminaAndHealing.staminaMax',
    health('staminaMax'),
    new RegExp(`^${N}$`),
    '"N"',
  );
  const regen = match(
    'healthStaminaAndHealing.staminaRegen',
    health('staminaRegen'),
    new RegExp(`^${N} a second after (\\d+) ticks without spending`),
    '"N a second after N ticks without spending ..."',
  );
  const stamina = [max[0], max[1], regen[1], regen[2]] as const;
  const out = keyed(json, 'combatTimings', 'runningOutOfStamina');
  const recover = match(
    'runningOutOfStamina.sprintEmpty',
    out('sprintEmpty'),
    /until (\d+) stamina is regained/,
    '"... until N stamina is regained"',
  );
  const cap = rows(json, 'combatTimings', 'staminaCapacity');
  const capRow = (condition: string): Row => {
    const row = cap.find((r) => r['Condition'] === condition);
    if (row === undefined) throw new Error(`balance.json: staminaCapacity has no ${condition}`);
    return row;
  };
  const change = (condition: string): number =>
    Math.abs(
      n(`staminaCapacity.${condition}`, (capRow(condition)['Max change'] ?? '').replace(/^\+/, '')),
    );
  const hungry = match(
    'staminaCapacity.Hungry',
    capRow('Hungry')['Ends when'] ?? '',
    /by (\d{2}):(\d{2})$/,
    '"... by HH:MM"',
  );
  const tired = match(
    'staminaCapacity.Short sleep',
    capRow('Short sleep')['Ends when'] ?? '',
    new RegExp(`less than ${N} game hours of sleep`),
    '"... less than N game hours of sleep"',
  );
  const work = match(
    "staminaCapacity.A hard day's work",
    capRow("A hard day's work")['Ends when'] ?? '',
    new RegExp(`more than ${N} game hours of tasks`),
    '"... more than N game hours of tasks ..."',
  );
  const rest = match(
    'staminaCapacity.fullRest',
    capRow('fullRest')['Max change'] ?? '',
    new RegExp(`^${N} game hours of sleep in a bed`),
    '"N game hours of sleep in a bed ..."',
  );
  const fire = match(
    'staminaCapacity.warmFire',
    capRow('warmFire')['Max change'] ?? '',
    new RegExp(`after ${N} game hours? within ${N} tiles`),
    '"... after N game hour within N tiles"',
  );
  return {
    base: Number(stamina[1]),
    regenPerSecond: Number(stamina[2]),
    regenDelayTicks: Number(stamina[3]),
    drain: {
      run: n('staminaInTraversal.Run', run['Drain per second'] ?? ''),
      runCombat: Number(runCombat[1]),
      heavyCarry: n(
        'staminaInTraversal.Heavy carry',
        drain('Heavy carry')['Drain per second'] ?? '',
      ),
      waistWade: n(
        'staminaInTraversal.Waist-deep wading',
        drain('Waist-deep wading')['Drain per second'] ?? '',
      ),
      climb: n('staminaInTraversal.Climb', drain('Climb')['Drain per second'] ?? ''),
      swim: n('staminaInTraversal.Swim', drain('Swim')['Drain per second'] ?? ''),
    },
    recoverAt: Number(recover[1]),
    capacity: {
      COLD: change('Cold'),
      HUNGRY: change('Hungry'),
      STARVING: change('Starving'),
      WOUNDED: change('Light wound'),
      BADLY_WOUNDED: change('Serious wound'),
      SICK: change('Sick'),
      TIRED: change('Short sleep'),
      EXHAUSTED: change('No sleep'),
      HARD_WORK: change("A hard day's work"),
      FEAST: change('Feast'),
    },
    minimumMax: n('staminaCapacity.minimumMax', capRow('minimumMax')['Max change'] ?? ''),
    hungryAt: Number(hungry[1]) * 60 + Number(hungry[2]),
    shortSleepMinutes: Number(tired[1]) * 60,
    hardWorkMinutes: Number(work[1]) * 60,
    fullRestMinutes: Number(rest[1]) * 60,
    warmFire: { minutes: Number(fire[1]) * 60, tiles: Number(fire[2]) },
  };
}
