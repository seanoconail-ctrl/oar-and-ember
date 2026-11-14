/**
 * Thorkel's body taken by the sea (the user's third playtest, decision DG-14; Book 4 section 08,
 * beat 16; Book 7 section 07; Book 10 section 08, "Thorkel's rites", seaBier to seaLength): the
 * scene that ends the sea burial. Once the lament's last word is said he is borne down on a bier
 * of the wreck's planks to the water's edge below the gathering place, wherever the tide stands;
 * three waves come in, the first washing round the bier, the second over it, the third lifting it;
 * the backwash carries it out, it drifts turning and riding lower, and sinks in a ring of foam;
 * Hild says the last word, and control returns. The scene takes control (Book 10 section 25).
 *
 * The state is a handful of facts (when it began, the water's edge, the turn); everything else is
 * a pure function of the seconds since, so a save made in the middle of it loads and plays on. The
 * body stays in the world, drawn masked by the water like a wader, until control returns: wholly
 * under for longer than Book 10's seaSink before it is taken out (Book 2 section 23). Every number
 * is Book 10's; no random stream is drawn here.
 */
import type { Id } from '../../core/ids.ts';
import { cyrb53 } from '../../core/hash.ts';
import { setFact } from '../ledger/ledger.ts';
import { TICKS_PER_SECOND } from '../land/onFoot.ts';
import type { LandContext, OnFootActor } from '../land/onFoot.ts';
import { findActor, placeActor } from '../land/zoneLinks.ts';
import { stepResident } from '../people/residents.ts';
import type { WorldState } from '../world.ts';

type Row = Record<string, string>;

/** Book 10 section 08's sea burial, in real seconds and tiles. */
export interface SeaBurialBalance {
  /** The bier borne down to the water's edge. */
  readonly bierSeconds: number;
  /** The three waves: the first this long after the bier is set down, then this far apart. */
  readonly waves: number;
  readonly firstWaveSeconds: number;
  readonly waveEverySeconds: number;
  /** The first washes round the bier and this far past it. */
  readonly firstWashTiles: number;
  /** The second has the body under the foam this long. */
  readonly underSeconds: number;
  /** The third lifts it; the backwash carries it this far out over this long. */
  readonly backwashTiles: number;
  readonly backwashSeconds: number;
  /** It drifts on to this far from the edge over this long, turning, riding lower in steps. */
  readonly driftTiles: number;
  readonly driftSeconds: number;
  readonly turnDegrees: readonly [number, number];
  readonly lowerPx: number;
  readonly lowerEverySeconds: number;
  /** It sinks over this long; the ring of foam and bubbles stays this long. */
  readonly sinkSeconds: number;
  readonly ringSeconds: number;
  /** Hild's last line this long after the sink; control this long after that. */
  readonly lineAfterSeconds: number;
  readonly controlAfterSeconds: number;
  /** The camera eases out with the bier at most this far from where it began (tiles). */
  readonly cameraTiles: number;
  /** "About" this long from the bier set down to control returning. */
  readonly aboutSeconds: number;
}

const N = '(\\d+(?:\\.\\d+)?)';

export function parseSeaBurialBalance(json: unknown): SeaBurialBalance {
  const rows = (json as { tables?: Record<string, Record<string, Row[]>> } | null)?.tables?.[
    'peopleSkillsAndWounds'
  ]?.['thorkelSRites'];
  if (!Array.isArray(rows)) throw new Error("balance.json: no table Thorkel's rites");
  const read = (key: string, pattern: string): number[] => {
    const v = rows.find((r) => r['Key'] === key)?.['Value'] ?? '';
    const m = new RegExp(pattern).exec(v);
    if (m === null) throw new Error(`balance.json: ${key} is "${v}"; expected /${pattern}/`);
    return m.slice(1).map(Number);
  };
  const [bier = 0] = read('seaBier', `; ${N} real seconds$`);
  const wavesText = rows.find((r) => r['Key'] === 'seaWaves')?.['Value'] ?? '';
  const waves =
    { two: 2, three: 3, four: 4 }[/^A set of (\w+) waves/.exec(wavesText)?.[1] ?? ''] ?? 0;
  if (waves === 0) throw new Error(`balance.json: seaWaves is "${wavesText}"`);
  const [every = 0, first = 0] = read(
    'seaWaves',
    `, ${N} real seconds apart, the first ${N} real seconds after`,
  );
  const [wash = 0] = read('seaFirstWave', `${N} tiles past it`);
  const [under = 0] = read('seaSecondWave', `for ${N} real seconds`);
  const [back = 0, backS = 0] = read('seaThirdWave', `carries it ${N} tiles out over ${N} real`);
  const [drift = 0, driftS = 0, turnA = 0, turnB = 0, lower = 0, lowerS = 0] = read(
    'seaDrift',
    `out to ${N} tiles from the water's edge over ${N} real seconds, turning ${N} to ${N} degrees.*drawn ${N} px lower every ${N} real seconds`,
  );
  const [sink = 0, ring = 0] = read('seaSink', `over ${N} real seconds:.*stays ${N} real seconds`);
  const [line = 0, control = 0] = read(
    'seaAfter',
    `^Hild's last line ${N} real seconds after the sink; control returns ${N} real seconds`,
  );
  const [camera = 0] = read('seaCamera', `at most ${N} tiles`);
  const [about = 0] = read('seaLength', `^About ${N} real seconds`);
  return {
    bierSeconds: bier,
    waves,
    firstWaveSeconds: first,
    waveEverySeconds: every,
    firstWashTiles: wash,
    underSeconds: under,
    backwashTiles: back,
    backwashSeconds: backS,
    driftTiles: drift,
    driftSeconds: driftS,
    turnDegrees: [turnA, turnB],
    lowerPx: lower,
    lowerEverySeconds: lowerS,
    sinkSeconds: sink,
    ringSeconds: ring,
    lineAfterSeconds: line,
    controlAfterSeconds: control,
    cameraTiles: camera,
    aboutSeconds: about,
  };
}

/** The scene's marks, in real seconds from the bier lifted at the rite's place. */
export interface SeaTimeline {
  readonly set: number;
  readonly waves: readonly number[];
  readonly lift: number;
  readonly drift: number;
  readonly sink: number;
  readonly sunk: number;
  readonly line: number;
  readonly control: number;
}

export function seaTimeline(b: SeaBurialBalance): SeaTimeline {
  const set = b.bierSeconds;
  const waves = Array.from(
    { length: b.waves },
    (_, k) => set + b.firstWaveSeconds + k * b.waveEverySeconds,
  );
  const lift = waves[waves.length - 1] ?? set;
  const drift = lift + b.backwashSeconds;
  const sink = drift + b.driftSeconds;
  const sunk = sink + b.sinkSeconds;
  const line = sunk + b.lineAfterSeconds;
  return { set, waves, lift, drift, sink, sunk, line, control: line + b.controlAfterSeconds };
}

export type SeaPhase = 'BIER' | 'SET' | 'WAVES' | 'BACKWASH' | 'DRIFT' | 'SINK' | 'GONE';

/** Where the scene is at `t` seconds: the phase, and how the bier is drawn. */
export interface SeaMoment {
  readonly t: number;
  readonly phase: SeaPhase;
  /** 0 to 1 along the carry from the rite's place to the water's edge. */
  readonly carried: number;
  /** Tiles out from the water's edge (seaward). */
  readonly out: number;
  /** 0 to 1 of the turn the swell gives it. */
  readonly turn: number;
  /** Which wave last came (0 none, 1 to 3), and seconds since it came. */
  readonly wave: number;
  readonly sinceWave: number;
  /** Under the second wave's foam to the shoulders. */
  readonly underFoam: boolean;
  /** Afloat: pixels it rides lower (1 px every lowerEverySeconds of the drift). */
  readonly lowerPx: number;
  /** 0 to 1 through the sink (1: wholly under); the ring's 0 to 1 after it. */
  readonly sink: number;
  readonly ring: number;
}

export function seaMoment(b: SeaBurialBalance, t: number): SeaMoment {
  const tl = seaTimeline(b);
  const clamp = (v: number): number => Math.max(0, Math.min(1, v));
  const ease = (v: number): number => {
    const k = clamp(v);
    return k * k * (3 - 2 * k);
  };
  let wave = 0;
  for (let k = 0; k < tl.waves.length; k++) if (t >= (tl.waves[k] ?? Infinity)) wave = k + 1;
  const sinceWave = wave === 0 ? 0 : t - (tl.waves[wave - 1] ?? 0);
  const out =
    t < tl.lift
      ? 0
      : t < tl.drift
        ? b.backwashTiles * ease((t - tl.lift) / b.backwashSeconds)
        : b.backwashTiles +
          (b.driftTiles - b.backwashTiles) * clamp((t - tl.drift) / b.driftSeconds);
  const phase: SeaPhase =
    t < tl.set
      ? 'BIER'
      : t < (tl.waves[0] ?? tl.lift)
        ? 'SET'
        : t < tl.lift
          ? 'WAVES'
          : t < tl.drift
            ? 'BACKWASH'
            : t < tl.sink
              ? 'DRIFT'
              : t < tl.sunk
                ? 'SINK'
                : 'GONE';
  return {
    t,
    phase,
    carried: clamp(t / b.bierSeconds),
    out,
    turn: t < tl.lift ? 0 : clamp((t - tl.lift) / (tl.sink - tl.lift)),
    wave,
    sinceWave,
    underFoam: wave === 2 && sinceWave < b.underSeconds,
    lowerPx:
      t < tl.drift
        ? 0
        : Math.min(
            b.lowerPx * Math.floor(b.driftSeconds / b.lowerEverySeconds),
            b.lowerPx * Math.floor((t - tl.drift) / b.lowerEverySeconds),
          ),
    sink: clamp((t - tl.sink) / b.sinkSeconds),
    ring: t < tl.sunk ? 0 : clamp((t - tl.sunk) / b.ringSeconds),
  };
}

// --------------------------------------------------------------------------------- the state

export const FACT_TAKEN_AT = 'rites.taken_at';
const FACT_FROM_X = 'rites.from_x';
const FACT_FROM_Y = 'rites.from_y';
const FACT_EDGE_X = 'rites.edge_x';
const FACT_EDGE_Y = 'rites.edge_y';
const FACT_TURN = 'rites.turn';
const FACT_ZONE = 'rites.sea_zone';
const FACT_DONE_AT = 'rites.taken_step';
const FACT_CARRY = 'rites.carry_s';
const FACT_STEER_X = 'rites.steer_x';
const FACT_STEER_Y = 'rites.steer_y';

/** The scene as stored, or null when it is not playing. */
export interface SeaBurialState {
  readonly at: number;
  readonly zone: Id;
  /** Where the bier was lifted, and the water's edge it was set at (tiles). */
  readonly from: { readonly x: number; readonly y: number };
  readonly edge: { readonly x: number; readonly y: number };
  /** The turn the swell gives it, in degrees. */
  readonly turn: number;
  /**
   * The carry down, real seconds: Book 10's seaBier, or longer at the bearers' carry pace when the
   * ebb has left the water's edge far down the flats (DG-58).
   */
  readonly carry: number;
  /** Where the steerer stood when the bier was lifted (tiles), to walk down with the household. */
  readonly steerer: { readonly x: number; readonly y: number } | null;
}

/** Book 10's timings for this burial: its own carry down in place of seaBier. */
export function seaBalanceFor(s: SeaBurialState, b: SeaBurialBalance): SeaBurialBalance {
  return s.carry > b.bierSeconds ? { ...b, bierSeconds: s.carry } : b;
}

export function seaBurialState(world: WorldState): SeaBurialState | null {
  const at = world.facts[FACT_TAKEN_AT];
  const zone = world.facts[FACT_ZONE];
  if (typeof at !== 'number' || typeof zone !== 'string') return null;
  const n = (k: string): number => Number(world.facts[k] ?? 0);
  const sx = world.facts[FACT_STEER_X];
  const sy = world.facts[FACT_STEER_Y];
  return {
    at,
    zone,
    from: { x: n(FACT_FROM_X), y: n(FACT_FROM_Y) },
    edge: { x: n(FACT_EDGE_X), y: n(FACT_EDGE_Y) },
    turn: n(FACT_TURN),
    carry: Number(world.facts[FACT_CARRY] ?? 0),
    steerer: typeof sx === 'number' && typeof sy === 'number' ? { x: sx, y: sy } : null,
  };
}

/** Whether the scene has the steerer (Book 10 section 25: a scene that takes control). */
export function seaBurialActive(world: WorldState): boolean {
  return world.facts[FACT_TAKEN_AT] !== undefined;
}

/** Seconds into the scene (null when it is not playing). */
export function seaSeconds(world: WorldState): number | null {
  const at = world.facts[FACT_TAKEN_AT];
  return typeof at === 'number' ? (world.tick - at) / TICKS_PER_SECOND : null;
}

/**
 * The water's edge below a point at the tide now: going seaward (south, down the shingle) from
 * the point to the first wet ground, or, with the point already awash, back up to the last. Tiles.
 */
export function waterEdgeBelow(
  x: number,
  y: number,
  wet: (xTiles: number, yTiles: number) => boolean,
): { x: number; y: number } {
  const step = 0.25;
  if (wet(x, y)) {
    let yy = y;
    for (let k = 0; k < 120 && wet(x, yy - step); k++) yy -= step;
    return { x, y: yy };
  }
  for (let yy = y; yy <= y + 40; yy += step) if (wet(x, yy)) return { x, y: yy };
  return { x, y: y + 2 };
}

/** Begins the scene once the lament's last word is said: the bier at the rite's place. */
export function beginSeaBurial(
  world: WorldState,
  b: SeaBurialBalance,
  place: { readonly zone: Id; readonly x: number; readonly y: number },
  wet: (xTiles: number, yTiles: number) => boolean,
  carrySpeed = 0,
): void {
  const edge = waterEdgeBelow(place.x, place.y, wet);
  const far = Math.hypot(edge.x - place.x, edge.y - place.y);
  const carry = Math.max(b.bierSeconds, carrySpeed > 0 ? far / carrySpeed : 0);
  setFact(world, FACT_CARRY, Math.round(carry * 100) / 100);
  const p = world.onFoot?.player;
  if (p !== undefined && world.onFoot?.zone === place.zone) {
    setFact(world, FACT_STEER_X, Math.round((p.x / 24) * 100) / 100);
    setFact(world, FACT_STEER_Y, Math.round((p.y / 24) * 100) / 100);
  }
  // The swell's turn, 30 to 60 degrees either way, from the world's seed (no stream is drawn).
  const h = cyrb53(`${world.seed}:sea:${world.calendar.day}`);
  const [lo, hi] = b.turnDegrees;
  const turn = lo + ((h % 1000) / 999) * (hi - lo);
  setFact(world, FACT_TAKEN_AT, world.tick);
  setFact(world, FACT_ZONE, place.zone);
  setFact(world, FACT_FROM_X, place.x);
  setFact(world, FACT_FROM_Y, place.y);
  setFact(world, FACT_EDGE_X, Math.round(edge.x * 100) / 100);
  setFact(world, FACT_EDGE_Y, Math.round(edge.y * 100) / 100);
  setFact(world, FACT_TURN, Math.round(turn * 10) / 10);
  setFact(world, FACT_DONE_AT, -1);
}

/** Clears the scene's facts (control returns). */
export function endSeaBurial(world: WorldState): void {
  for (const k of [
    FACT_TAKEN_AT,
    FACT_ZONE,
    FACT_FROM_X,
    FACT_FROM_Y,
    FACT_EDGE_X,
    FACT_EDGE_Y,
    FACT_TURN,
    FACT_DONE_AT,
    FACT_CARRY,
    FACT_STEER_X,
    FACT_STEER_Y,
  ])
    Reflect.deleteProperty(world.facts, k);
}

/** Where the bier is now (tiles): along the carry, then out to sea. */
export function bierAt(s: SeaBurialState, m: SeaMoment): { x: number; y: number } {
  if (m.phase === 'BIER') {
    const k = m.carried * m.carried * (3 - 2 * m.carried);
    return { x: s.from.x + (s.edge.x - s.from.x) * k, y: s.from.y + (s.edge.y - s.from.y) * k };
  }
  return { x: s.edge.x, y: s.edge.y + m.out };
}

export type SeaWhat = 'BIER' | 'SET' | 'WAVE' | 'LIFT' | 'SINK' | 'SUNK' | 'LINE' | 'DONE';

export type SeaEvent =
  | { readonly type: 'SEA_TAKEN'; readonly what: SeaWhat; readonly n?: number }
  | { readonly type: 'PERSON_SPOKE'; readonly person: Id; readonly lineKey: string };

/** Who bears the bier: the guard and the next who can carry, else any two of the household. */
export function bearersOf(world: WorldState, guard: Id, caller: Id): Id[] {
  const onFoot = world.onFoot;
  if (onFoot === null) return [];
  const able = (id: Id): boolean => {
    const a = findActor(onFoot, id);
    return (
      a !== null &&
      world.people[id]?.status !== 'downed' &&
      a.actor.pose !== 'down' &&
      a.actor.pose !== 'dead' &&
      a.actor.pose !== 'carried'
    );
  };
  const order = [guard, 'C_ODDI', ...world.household.residents].filter(
    (id, i, all) => all.indexOf(id) === i && id !== caller,
  );
  return order.filter((id) => world.household.residents.includes(id) && able(id)).slice(0, 2);
}

/**
 * A bearer leaves any walk the fight left them (a carrier is held by the fight's walking, which
 * would take them towards a goal left over from the last fight): the rite moves them now.
 */
export function settleForCarry(a: OnFootActor): void {
  const fa = a.fight;
  if (fa === undefined) return;
  fa.ai.goal = null;
  fa.vel = { x: 0, y: 0 };
}

/** Where the household stands at the edge while the sea takes him (tiles from the edge). */
const STAND: readonly (readonly [number, number])[] = [
  [-2.3, -1.2],
  [2.4, -1.3],
  [-0.9, -1.7],
  [0.9, -1.8],
];

/**
 * One tick of the scene: the bearers and the bier, the household at the edge, the body moved and
 * drawn by the moment, its events, Hild's last line and control returned. Returns true on the
 * tick control returns (the caller finishes the rite: its facts, the body out of the world).
 */
export function stepSeaBurial(
  world: WorldState,
  b0: SeaBurialBalance,
  who: { readonly body: Id; readonly guard: Id; readonly caller: Id; readonly line: string },
  land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  tidalGroundOpen: boolean,
  emit: (e: SeaEvent) => void,
): boolean {
  const s = seaBurialState(world);
  const onFoot = world.onFoot;
  if (s === null || onFoot === null) return false;
  const b = seaBalanceFor(s, b0);
  const t = (world.tick - s.at) / TICKS_PER_SECOND;
  const tl = seaTimeline(b);
  const m = seaMoment(b, t);
  const T = 24;
  const bier = bierAt(s, m);
  // The body on its bier, where the moment puts it (lying, never carried over a shoulder).
  const body = findActor(onFoot, who.body);
  if (body !== null) {
    if (body.zone !== s.zone) placeActor(onFoot, who.body, s.zone, body.actor);
    body.actor.x = bier.x * T;
    body.actor.y = bier.y * T;
    body.actor.facing = 'e';
    body.actor.pose = 'dead';
  }
  const bearers = bearersOf(world, who.guard, who.caller);
  const residents = world.household.residents.filter((id) => !bearers.includes(id));
  // The bearers at the bier's ends, carrying it down; then a step back up the shingle.
  bearers.forEach((id, i) => {
    const a = findActor(onFoot, id);
    if (a === null) return;
    const side = i === 0 ? -1 : 1;
    if (m.phase === 'BIER') {
      if (a.zone !== s.zone) placeActor(onFoot, id, s.zone, a.actor);
      a.actor.carries = who.body;
      settleForCarry(a.actor);
      a.actor.x = (bier.x + side * 1.05) * T;
      a.actor.y = bier.y * T + 2;
      a.actor.facing = 's';
      a.actor.pose = 'idle';
      a.actor.moving = true;
      delete a.actor.walk;
    } else {
      if (a.actor.carries !== undefined) {
        delete a.actor.carries;
        delete a.actor.moving;
      }
      stepResident(
        onFoot,
        id,
        {
          zone: s.zone,
          x: (s.edge.x + side * 1.4) * T,
          y: (s.edge.y - 1.1) * T,
          facing: 's',
          pose: 'idle',
        },
        land.maps,
        land,
        tidalGroundOpen,
      );
    }
  });
  // The steerer walks down with them to stand at the water's edge (the scene has control).
  const p = onFoot.player;
  if (s.steerer !== null && onFoot.zone === s.zone) {
    const stand = { x: s.edge.x - 2.2, y: s.edge.y - 1.3 };
    const k = Math.min(1, t / b.bierSeconds);
    const e = k * k * (3 - 2 * k);
    if (k < 1) {
      p.x = (s.steerer.x + (stand.x - s.steerer.x) * e) * T;
      p.y = (s.steerer.y + (stand.y - s.steerer.y) * e) * T;
      p.facing = 's';
      p.moving = Math.hypot(stand.x - s.steerer.x, stand.y - s.steerer.y) > 0.5;
    } else if (p.moving) {
      p.x = stand.x * T;
      p.y = stand.y * T;
      p.facing = 's';
      p.moving = false;
    }
  }
  // The household at the edge; Hild steps into the wash to the ankle beside the bier.
  let k = 0;
  for (const id of residents) {
    const spot: readonly [number, number] =
      id === who.caller ? [0.9, -0.25] : (STAND[k++ % STAND.length] ?? [0, -1.5]);
    stepResident(
      onFoot,
      id,
      {
        zone: s.zone,
        x: (s.edge.x + spot[0]) * T,
        y: (s.edge.y + spot[1]) * T,
        facing: 's',
        pose: 'idle',
      },
      land.maps,
      land,
      tidalGroundOpen,
    );
  }
  // The scene's marks, each once (a save in the middle replays none twice).
  const done = Number(world.facts[FACT_DONE_AT] ?? -1);
  const marks: { at: number; what: SeaWhat; n?: number }[] = [
    { at: 0, what: 'BIER' },
    { at: tl.set, what: 'SET' },
    ...tl.waves.map((at, i) => ({ at, what: 'WAVE' as const, n: i + 1 })),
    { at: tl.lift, what: 'LIFT' },
    { at: tl.sink, what: 'SINK' },
    { at: tl.sunk, what: 'SUNK' },
    { at: tl.line, what: 'LINE' },
    { at: tl.control, what: 'DONE' },
  ];
  let last = done;
  marks.forEach((mk, i) => {
    if (i <= done || t < mk.at) return;
    last = i;
    if (mk.what === 'LINE') {
      if (world.household.residents.includes(who.caller))
        emit({ type: 'PERSON_SPOKE', person: who.caller, lineKey: who.line });
      return;
    }
    emit(
      mk.n === undefined
        ? { type: 'SEA_TAKEN', what: mk.what }
        : { type: 'SEA_TAKEN', what: mk.what, n: mk.n },
    );
  });
  if (last !== done) setFact(world, FACT_DONE_AT, last);
  if (t < tl.control) return false;
  // Control returns: the bearers put down nothing more; the scene's facts go.
  for (const id of bearers) {
    const a = findActor(onFoot, id);
    if (a !== null) delete a.actor.carries;
  }
  endSeaBurial(world);
  return true;
}
