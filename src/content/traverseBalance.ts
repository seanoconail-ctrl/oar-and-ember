/**
 * Typed access to the movement verbs' numbers (Stage 14, decisions S14-13 and S14-50): Book 10
 * section 02's climb and swim speeds, section 06's "Stamina in traversal" (climb, swim and the
 * regeneration row), "Running out of stamina" (climbEmpty, swimEmpty) and "Movement verbs" (jumpGap,
 * jumpStamina, crawlSpeed, crawlCarry, pushSpeed, pushStamina, climbLedgeEvery, bogSoftRain,
 * climbFallFloor). Like balance.ts, every value is parsed strictly, so a change of wording fails at
 * load with the table, key and value rather than reading a wrong number.
 */

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

function match(where: string, text: string, pattern: RegExp, expected: string): RegExpExecArray {
  const m = pattern.exec(text);
  if (m === null) fail(where, text, expected);
  return m;
}

const N = '(\\d+(?:\\.\\d+)?)';

/** Book 10's movement verbs and their empty-bar outcomes (all speeds in tiles a second). */
export interface TraverseBalance {
  /** Book 10 section 02, "Movement on foot": Climb and Swim. */
  readonly climbSpeed: number;
  readonly swimSpeed: number;
  /** Book 10 section 06, "Stamina in traversal": drain per second climbing and swimming. */
  readonly climbDrain: number;
  readonly swimDrain: number;
  /** The Regeneration row: regeneration while climbing or swimming (0). */
  readonly regenWhileClimbingOrSwimming: number;
  /** climbEmpty: the slide's speed, the tiles slid free, and the vitality each tile beyond costs. */
  readonly slide: {
    readonly tilesPerSecond: number;
    readonly freeTiles: number;
    readonly vitalityPerTile: number;
  };
  /** swimEmpty: the seconds to reach the waist band, then the drowning rate in vitality a second. */
  readonly sink: { readonly seconds: number; readonly drownPerSecond: number };
  /** "Movement verbs". */
  readonly jumpGap: number;
  readonly jumpStamina: number;
  readonly crawlSpeed: number;
  /** crawlCarry: nothing passes a crawl ("Nothing"). */
  readonly crawlCarries: false;
  readonly pushSpeed: number;
  readonly pushStamina: number;
  readonly climbLedgeEvery: number;
  readonly bogSoftRain: number;
  readonly climbFallFloor: number;
}

export function parseTraverseBalance(json: unknown): TraverseBalance {
  const moving = rows(json, 'timeAndTravel', 'movementOnFoot');
  const speed = (mode: string): number => {
    const row = moving.find((r) => r['Mode'] === mode);
    if (row === undefined) throw new Error(`balance.json: movementOnFoot has no ${mode} row`);
    return Number(
      match(`movementOnFoot.${mode}`, row['Speed'] ?? '', new RegExp(`^${N}$`), 'a number')[1],
    );
  };
  const drains = rows(json, 'combatTimings', 'staminaInTraversal');
  const drain = (activity: string): string => {
    const row = drains.find((r) => r['Activity'] === activity);
    if (row === undefined) throw new Error(`balance.json: staminaInTraversal has no ${activity}`);
    return row['Drain per second'] ?? '';
  };
  const perSecond = (activity: string): number =>
    Number(match(`staminaInTraversal.${activity}`, drain(activity), new RegExp(`^${N}$`), 'N')[1]);
  const regen = match(
    'staminaInTraversal.Regeneration',
    drain('Regeneration'),
    new RegExp(`^${N} while climbing or swimming$`),
    '"N while climbing or swimming"',
  );
  const keyed = (table: string): ((key: string) => string) => {
    const list = rows(json, 'combatTimings', table);
    return (key) => {
      const value = list.find((r) => r['Key'] === key)?.['Value'];
      if (value === undefined) throw new Error(`balance.json: ${table} has no "${key}"`);
      return value;
    };
  };
  const out = keyed('runningOutOfStamina');
  const slide = match(
    'runningOutOfStamina.climbEmpty',
    out('climbEmpty'),
    new RegExp(
      `^Slides down ${N} tiles? per second to the last ledge or the foot of the route; a slide of more than ${N} tiles costs ${N} vitality per tile beyond ${N}$`,
    ),
    '"Slides down N tile per second ... more than N tiles costs N vitality per tile beyond N"',
  );
  if (slide[2] !== slide[4])
    fail('runningOutOfStamina.climbEmpty', out('climbEmpty'), 'the same free tiles twice');
  const sink = match(
    'runningOutOfStamina.swimEmpty',
    out('swimEmpty'),
    new RegExp(
      `^Starts to sink: ${N} s to reach water no deeper than the waist band, then drowning at ${N} vitality per second; reaching the shallows ends it$`,
    ),
    '"Starts to sink: N s to reach water no deeper than the waist band, then drowning at N vitality per second; ..."',
  );
  const verbs = keyed('movementVerbs');
  const num = (key: string, pattern: string): number =>
    Number(
      match(`movementVerbs.${key}`, verbs(key), new RegExp(`^${pattern}$`), `"${pattern}"`)[1],
    );
  const carry = verbs('crawlCarry');
  if (carry !== 'Nothing') fail('movementVerbs.crawlCarry', carry, '"Nothing"');
  return {
    climbSpeed: speed('Climb'),
    swimSpeed: speed('Swim'),
    climbDrain: perSecond('Climb'),
    swimDrain: perSecond('Swim'),
    regenWhileClimbingOrSwimming: Number(regen[1]),
    slide: {
      tilesPerSecond: Number(slide[1]),
      freeTiles: Number(slide[2]),
      vitalityPerTile: Number(slide[3]),
    },
    sink: { seconds: Number(sink[1]), drownPerSecond: Number(sink[2]) },
    jumpGap: num('jumpGap', `${N} tiles`),
    jumpStamina: num('jumpStamina', N),
    crawlSpeed: num('crawlSpeed', `${N} tiles per second`),
    crawlCarries: false,
    pushSpeed: num('pushSpeed', `${N} tiles per second`),
    pushStamina: num('pushStamina', `${N} per second`),
    climbLedgeEvery: num('climbLedgeEvery', `${N} tiles or fewer`),
    bogSoftRain: num('bogSoftRain', N),
    climbFallFloor: num('climbFallFloor', `${N} vitality`),
  };
}
