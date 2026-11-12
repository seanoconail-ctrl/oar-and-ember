/**
 * Book 10 section 25, "The opening, guidance and feel" (design addendum 2.4 sections 2 to 6;
 * decisions DE-16 to DE-30), with the rows the addendum added to sections 03 ("Work and the wreck
 * camp": mastStores, shelterRaise) and 08 ("The three searches": searchesPlaced, runaTruth,
 * runaLie, rescueGetUp), read from content/balance.json as the book writes them. Every number the
 * opening, the guidance, the world's feedback, the doors, the Hag's Stone and the music's fades
 * use comes from here.
 */
type Row = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function table(json: unknown, section: string, name: string): (key: string) => string {
  const tables = isRecord(json) ? json['tables'] : undefined;
  const sec = isRecord(tables) ? tables[section] : undefined;
  const list = isRecord(sec) ? sec[name] : undefined;
  if (!Array.isArray(list)) throw new Error(`balance.json: no table ${section}.${name}`);
  return (key) => {
    const v = (list as Row[]).find((r) => r['Key'] === key)?.['Value'];
    if (v === undefined) throw new Error(`balance.json: ${section}.${name} has no "${key}"`);
    return v;
  };
}

function read(get: (key: string) => string, key: string, pattern: RegExp, expected: string) {
  const text = get(key);
  const m = pattern.exec(text);
  if (m === null) throw new Error(`balance.json: ${key} is "${text}"; expected ${expected}`);
  return m.slice(1).map(Number);
}

const N = '(\\d+(?:\\.\\d+)?)';
const one = (get: (key: string) => string, key: string, pattern: string, expected: string) =>
  read(get, key, new RegExp(pattern), expected)[0] ?? 0;

export interface OpeningBalance {
  readonly firstMinutes: {
    /** The played cold open's length, real seconds (a range: content sets its script inside it). */
    readonly coldOpen: readonly [number, number];
    /** The first input gets the steerer up within this of waking (real seconds). */
    readonly firstInputSeconds: number;
    /** Hild's first call comes within this of waking (real seconds). */
    readonly hildCallSeconds: number;
    /** Targets for a scripted new player, in minutes of play. */
    readonly seaxBy: number;
    readonly hildFreedBy: number;
    readonly chestAtCampBy: number;
    readonly firstFireBy: number;
    readonly shelterBy: number;
    readonly bowBy: readonly [number, number];
    /** The hold-to-cut at the net (or a lashing), real seconds. */
    readonly cutHoldSeconds: number;
    /** A wave breaks over Hild this often while she is in the net (real seconds). */
    readonly netWaveSeconds: number;
    /** No menu and nothing longer than a tooltip for this long (minutes of play). */
    readonly noMenusMinutes: number;
  };
  readonly guidance: {
    readonly stuckFirstSeconds: number;
    readonly stuckSecondSeconds: number;
    readonly stuckRepeatSeconds: number;
    readonly stuckRepeatTimes: number;
    /** How far a call is heard and captioned with its direction (tiles). */
    readonly callCarryTiles: number;
  };
  readonly feedback: {
    readonly edgeStopDegrees: number;
    readonly edgeCaptionAfterSeconds: number;
    readonly edgeCaptionCooldownSeconds: number;
    /** A carried thing with a home shows its outline within this (tiles); settles within settle. */
    readonly homeOutlineTiles: number;
    readonly homeSettleTiles: number;
  };
  readonly doors: {
    readonly openTicks: number;
    readonly openTicksFlap: number;
    readonly closeAfterSeconds: number;
    readonly closeTicks: number;
    readonly closeTicksFlap: number;
  };
  readonly stone: {
    readonly nearTiles: number;
    readonly hushSeconds: number;
    readonly coldSeconds: number;
    readonly holdSeconds: readonly [number, number];
    readonly holdDefaultSeconds: number;
    readonly gustSeconds: number;
    readonly settleSeconds: number;
    readonly cameraPull: number;
    readonly cameraPullMaxTiles: number;
    /** The figure stands on every n-th showing, for this long. */
    readonly figureEvery: number;
    readonly figureSeconds: number;
  };
  readonly music: {
    readonly fadeInSeconds: number;
    readonly fadeInRange: readonly [number, number];
    readonly layersJoin: readonly [number, number];
    readonly fadeOutSeconds: number;
    readonly fadeOutRange: readonly [number, number];
  };
  readonly camp: {
    /** The stores on the broken mast: salt fish in ration-days (and the ship's cauldron). */
    readonly mastStoresRd: number;
    /** The steerer's raising of the sail shelter: real seconds, game minutes and stamina. */
    readonly shelterRaise: {
      readonly seconds: number;
      readonly minutes: number;
      readonly stamina: number;
    };
  };
  readonly searches: {
    /** The searches' people are placed at this minute of day 1 (19:00 is 1140). */
    readonly placedMinute: number;
    readonly runaTruthFriendship: number;
    /** Runa's friendship lost per point of her Word, when a lie is found out. */
    readonly runaLiePerWord: number;
    /** A rescued person gets up this long after being set down (real seconds). */
    readonly rescueGetUpSeconds: number;
  };
}

export function parseOpeningBalance(json: unknown): OpeningBalance {
  const first = table(json, 'theOpeningGuidanceAndFeel', 'theFirstMinutes');
  const guide = table(json, 'theOpeningGuidanceAndFeel', 'guidance');
  const world = table(json, 'theOpeningGuidanceAndFeel', 'worldFeedback');
  const doors = table(json, 'theOpeningGuidanceAndFeel', 'doors');
  const stone = table(json, 'theOpeningGuidanceAndFeel', 'theWeepingStone');
  const music = table(json, 'theOpeningGuidanceAndFeel', 'musicFades');
  const camp = table(json, 'foodFuelAndSeasons', 'workAndTheWreckCamp');
  const search = table(json, 'peopleSkillsAndWounds', 'theThreeSearches');
  const minutes = (key: string): number => one(first, key, `^${N} minutes`, '"N minutes"');
  const range = (get: (k: string) => string, key: string, unit: string): [number, number] => {
    const [a, b] = read(get, key, new RegExp(`^${N} to ${N} ${unit}`), `"A to B ${unit}"`);
    return [a ?? 0, b ?? 0];
  };
  const [coldA, coldB] = range(first, 'coldOpen', 'real seconds');
  const [bowA, bowB] = range(first, 'bowBy', 'minutes');
  const [repeat, times] = read(
    guide,
    'stuckRepeat',
    new RegExp(`^Every ${N} real seconds after that, at most ${N} times$`),
    '"Every N real seconds after that, at most N times"',
  );
  const [openTicks, openFlap] = read(
    doors,
    'openTicks',
    new RegExp(`^${N} ticks \\(a hide or cloth flap ${N}\\)$`),
    '"N ticks (a hide or cloth flap N)"',
  );
  const [closeTicks, closeFlap] = read(
    doors,
    'closeTicks',
    new RegExp(`^${N} ticks \\(a flap ${N}\\)$`),
    '"N ticks (a flap N)"',
  );
  const [holdA, holdB] = range(stone, 'hold', 'real seconds');
  // The hold's default is in its notes ("(4 by default)").
  const holdDefault = ((): number => {
    const tables = (json as { tables: Record<string, Record<string, Row[]>> }).tables;
    const row = tables['theOpeningGuidanceAndFeel']?.['theWeepingStone']?.find(
      (r) => r['Key'] === 'hold',
    );
    const m = /\((\d+(?:\.\d+)?) by default\)/.exec(row?.['Notes'] ?? '');
    if (m === null) throw new Error('balance.json: theWeepingStone.hold has no "(N by default)"');
    return Number(m[1]);
  })();
  const [pull, pullMax] = read(
    stone,
    'cameraPull',
    new RegExp(`^${N} of the way to the stone, at most ${N} tiles$`),
    '"N of the way to the stone, at most N tiles"',
  );
  const figure = stone('figure');
  if (figure !== 'Every second showing')
    throw new Error(`balance.json: theWeepingStone.figure is "${figure}"`);
  const [fadeIn, fadeInA, fadeInB] = read(
    music,
    'fadeIn',
    new RegExp(`^${N} real seconds \\(${N} to ${N} by piece\\)$`),
    '"N real seconds (A to B by piece)"',
  );
  const [fadeOut, fadeOutA, fadeOutB] = read(
    music,
    'fadeOut',
    new RegExp(`^${N} real seconds \\(${N} to ${N} by piece\\)$`),
    '"N real seconds (A to B by piece)"',
  );
  const [joinA, joinB] = read(
    music,
    'layersJoin',
    new RegExp(`^Over the first ${N} to ${N} real seconds$`),
    '"Over the first A to B real seconds"',
  );
  const firstLayer = music('firstLayer');
  if (firstLayer !== 'One layer')
    throw new Error(`balance.json: musicFades.firstLayer is "${firstLayer}"`);
  const [raiseS, raiseM, raiseSt] = read(
    camp,
    'shelterRaise',
    new RegExp(`${N} real seconds, ${N} game minutes, ${N} stamina`),
    '"... N real seconds, N game minutes, N stamina"',
  );
  const placed = read(
    search,
    'searchesPlaced',
    /^The first dusk: (\d{2}):(\d{2}) on day 1$/,
    '"The first dusk: HH:MM on day 1"',
  );
  return {
    firstMinutes: {
      coldOpen: [coldA, coldB],
      firstInputSeconds: one(
        first,
        'firstInput',
        `^Within ${N} real seconds`,
        '"Within N real seconds"',
      ),
      hildCallSeconds: one(first, 'hildCallBy', `^${N} real seconds`, '"N real seconds"'),
      seaxBy: minutes('seaxBy'),
      hildFreedBy: minutes('hildFreedBy'),
      chestAtCampBy: minutes('chestAtCampBy'),
      firstFireBy: minutes('firstFireBy'),
      shelterBy: minutes('shelterBy'),
      bowBy: [bowA, bowB],
      cutHoldSeconds: one(first, 'cutHold', `^${N} real seconds$`, '"N real seconds"'),
      netWaveSeconds: one(
        first,
        'netWaves',
        `every ${N} real seconds`,
        '"... every N real seconds"',
      ),
      noMenusMinutes: minutes('noMenus'),
    },
    guidance: {
      stuckFirstSeconds: one(guide, 'stuckFirst', `^${N} real seconds$`, '"N real seconds"'),
      stuckSecondSeconds: one(
        guide,
        'stuckSecond',
        `^${N} real seconds more$`,
        '"N real seconds more"',
      ),
      stuckRepeatSeconds: repeat ?? 0,
      stuckRepeatTimes: times ?? 0,
      callCarryTiles: one(guide, 'callCarry', `^${N} tiles$`, '"N tiles"'),
    },
    feedback: {
      edgeStopDegrees: one(world, 'edgeStopAngle', `^${N} degrees`, '"N degrees: ..."'),
      edgeCaptionAfterSeconds: one(
        world,
        'edgeCaptionAfter',
        `^${N} real seconds`,
        '"N real seconds ..."',
      ),
      edgeCaptionCooldownSeconds: one(
        world,
        'edgeCaptionCooldown',
        `^${N} real seconds$`,
        '"N real seconds"',
      ),
      homeOutlineTiles: one(world, 'homeOutline', `^${N} tiles$`, '"N tiles"'),
      homeSettleTiles: ((): number => {
        const tables = (json as { tables: Record<string, Record<string, Row[]>> }).tables;
        const row = tables['theOpeningGuidanceAndFeel']?.['worldFeedback']?.find(
          (r) => r['Key'] === 'homeOutline',
        );
        const m = /set down within (\d+(?:\.\d+)?) tiles? of the outline/.exec(
          row?.['Notes'] ?? '',
        );
        if (m === null)
          throw new Error('balance.json: homeOutline has no "set down within N tile"');
        return Number(m[1]);
      })(),
    },
    doors: {
      openTicks: openTicks ?? 0,
      openTicksFlap: openFlap ?? 0,
      closeAfterSeconds: one(doors, 'closeAfter', `^${N} real seconds`, '"N real seconds ..."'),
      closeTicks: closeTicks ?? 0,
      closeTicksFlap: closeFlap ?? 0,
    },
    stone: {
      nearTiles: one(stone, 'near', `^${N} tiles$`, '"N tiles"'),
      hushSeconds: one(stone, 'hush', `^${N} real seconds?$`, '"N real seconds"'),
      coldSeconds: one(stone, 'cold', `^${N} real seconds$`, '"N real seconds"'),
      holdSeconds: [holdA, holdB],
      holdDefaultSeconds: holdDefault,
      gustSeconds: one(stone, 'gust', `^${N} real seconds$`, '"N real seconds"'),
      settleSeconds: one(stone, 'settle', `^${N} real seconds$`, '"N real seconds"'),
      cameraPull: pull ?? 0,
      cameraPullMaxTiles: pullMax ?? 0,
      figureEvery: 2,
      figureSeconds: ((): number => {
        const tables = (json as { tables: Record<string, Record<string, Row[]>> }).tables;
        const row = tables['theOpeningGuidanceAndFeel']?.['theWeepingStone']?.find(
          (r) => r['Key'] === 'figure',
        );
        const m = /for (\d+(?:\.\d+)?) s\b/.exec(row?.['Notes'] ?? '');
        if (m === null) throw new Error('balance.json: theWeepingStone.figure has no "for N s"');
        return Number(m[1]);
      })(),
    },
    music: {
      fadeInSeconds: fadeIn ?? 0,
      fadeInRange: [fadeInA ?? 0, fadeInB ?? 0],
      layersJoin: [joinA ?? 0, joinB ?? 0],
      fadeOutSeconds: fadeOut ?? 0,
      fadeOutRange: [fadeOutA ?? 0, fadeOutB ?? 0],
    },
    camp: {
      mastStoresRd: one(camp, 'mastStores', `^${N} rd of salt fish`, '"N rd of salt fish ..."'),
      shelterRaise: { seconds: raiseS ?? 0, minutes: raiseM ?? 0, stamina: raiseSt ?? 0 },
    },
    searches: {
      placedMinute: (placed[0] ?? 0) * 60 + (placed[1] ?? 0),
      runaTruthFriendship: one(
        search,
        'runaTruth',
        `^Runa \\+${N} friendship$`,
        '"Runa +N friendship"',
      ),
      runaLiePerWord: one(
        search,
        'runaLie',
        `^Runa -${N} friendship per point of her Word$`,
        '"Runa -N friendship per point of her Word"',
      ),
      rescueGetUpSeconds: one(search, 'rescueGetUp', `^${N} real seconds$`, '"N real seconds"'),
    },
  };
}
