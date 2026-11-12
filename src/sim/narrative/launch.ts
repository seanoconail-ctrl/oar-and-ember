/**
 * Chapter 1 beat 8 and its gate (Book 4 section 08; Book 6 section 15; Book 2 section 16; Book 10
 * section 22, "The launch"; Stage 12): the launch.
 *
 * - **The gate opens** when the boat is seaworthy and the three searches are decided (decision
 *   S12-2); nothing but the player's choice starts it. Looking the boat over then offers to launch
 *   it, which asks the interface for the **readiness screen** (`readinessView`): the boat, the tide,
 *   the crew, the stores, the weapons in hand, allies and Thorkel's rites, each in plain words from
 *   what the household knows, with the point-of-no-return warning.
 * - **Starting it** (`startLaunch`, only while the tide would float the boat) makes the labelled
 *   checkpoint, writes Book 6's RITES_DENIED if Thorkel has had no rites, and asks the boat's name
 *   and its sail's mark. Then the **scene** plays in real time: the household sets hands to the
 *   boat, runs it down its skids to where the water floats it (Book 10 `floats`), climbs aboard,
 *   sets the sail and rows out; the **sea map** shows the coast and smoke at Carrick Landing. The
 *   chapter resolves and Chapter 2 opens. Closing the map ends the launch: the trial row's time
 *   passes, the boat is drawn up again at its berth, and the chapter-end save is made.
 *
 * The scene's state is kept in facts (`launch.*`) and the ship; positions are content
 * (content/launch.json), every number Book 10's. Pure and deterministic: no random stream is drawn.
 */
import type { LaunchDef } from '../../content/registry.ts';
import type { LaunchBalance } from '../../content/launchBalance.ts';
import { DEPTH_BANDS } from '../../content/balance.ts';
import type { TimeBalance } from '../../content/balance.ts';
import type { Id } from '../../core/ids.ts';
import { advanceMinutes, tideAt } from '../calendar/calendar.ts';
import type { CalendarState } from '../calendar/calendar.ts';
import { foodRd, FACT_TUTORIAL_COMPLETE } from '../home/camp.ts';
import { fireOneShot, setFact } from '../ledger/ledger.ts';
import type { LandContext, OnFootActor } from '../land/onFoot.ts';
import { bandAt, stillWaterLevel } from '../land/water.ts';
import { findActor, placeActor, switchZone } from '../land/zoneLinks.ts';
import { deriveStats } from '../ship/ship.ts';
import type { ShipDefs, ShipInstance } from '../ship/ship.ts';
import { boatOf } from '../ship/work.ts';
import type { GateState, WorldState } from '../world.ts';
import { GATE_LAUNCH } from './gates.ts';

export { GATE_LAUNCH };

const T = 24;
const TICKS = 60;

/** The launch scene's phase (fact `launch.phase`). */
export type LaunchPhase =
  | 'NAMING'
  | 'GATHER'
  | 'HEAVE'
  | 'SLIDE'
  | 'BOARD'
  | 'HOIST'
  | 'ROW'
  | 'MAP'
  | 'DONE';

export const FACT_PHASE = 'launch.phase';
const FACT_SINCE = 'launch.since';
const FACT_FLOAT = 'launch.float_y';
const FACT_BERTH_X = 'launch.berth_x';
const FACT_BERTH_Y = 'launch.berth_y';
const FACT_ABOARD = 'launch.aboard';
const FACT_STEERER_ABOARD = 'launch.steerer_aboard';
const FACT_STROKES = 'launch.strokes';
/** The smoke over Carrick Landing has been seen from the boat (Book 4 beat 8). */
export const FACT_SMOKE = 'ch1.carrick_smoke';
/** The boat has been launched, named and marked (the chapter ends when the map is closed). */
export const FACT_LAUNCHED = 'ch1.launched';

/** Phases in which the household, and the steerer, are the scene's (not their own). */
const SCENE: readonly LaunchPhase[] = ['GATHER', 'HEAVE', 'SLIDE', 'BOARD', 'HOIST', 'ROW', 'MAP'];

export interface LaunchContext {
  readonly def: LaunchDef;
  readonly b: LaunchBalance;
  readonly ship: ShipDefs;
  /** Book 10 section 03: rations a person eats a day. */
  readonly foodPerPersonPerDay: number;
}

export function launchContext(
  def: LaunchDef,
  b: LaunchBalance,
  ship: ShipDefs,
  foodPerPersonPerDay: number,
): LaunchContext {
  return { def, b, ship, foodPerPersonPerDay };
}

export type LaunchEvent =
  | { readonly type: 'SEARCH_INFO'; readonly key: string }
  | {
      readonly type: 'PERSON_SPOKE';
      readonly person: Id;
      readonly lineKey: string;
      readonly bark?: string;
    }
  | { readonly type: 'GATE_OPENED'; readonly gate: Id }
  | { readonly type: 'GATE_STARTED'; readonly gate: Id }
  | { readonly type: 'CHECKPOINT'; readonly label: string }
  | { readonly type: 'SHIP_NAMED'; readonly name: string }
  | { readonly type: 'SAIL_MARKED'; readonly mark: string }
  /** The scene begins: everyone at the boat (the view fades in on it). */
  | { readonly type: 'LAUNCH_GATHERED' }
  | { readonly type: 'LAUNCH_SLIDE' }
  | { readonly type: 'LAUNCH_AFLOAT' }
  | { readonly type: 'CREW_ABOARD'; readonly person: Id }
  | { readonly type: 'SAIL_HOISTED' }
  | { readonly type: 'SAIL_SET' }
  | { readonly type: 'OAR_STROKE'; readonly n: number }
  | { readonly type: 'SEA_MAP_REVEALED' }
  | { readonly type: 'CHAPTER_ENDED'; readonly chapter: Id; readonly save: string };

export type LaunchEmit = (e: LaunchEvent) => void;

/** What the launch asks of the simulation beyond itself. */
export interface LaunchHooks {
  /** Pass game minutes (the trial row) through the world step. */
  readonly advance: (minutes: number) => void;
  /** Write a household deed seen by the residents (Book 6 RITES_DENIED). */
  readonly deed: (tag: string, witnesses: readonly Id[]) => void;
}

function gateOf(world: WorldState, ctx: LaunchContext): GateState {
  let g = world.gates[ctx.def.gate];
  if (g === undefined) {
    g = { status: 'CLOSED', pressureSteps: 0, retriesUsed: 0 };
    world.gates[ctx.def.gate] = g;
  }
  return g;
}

export function launchPhase(world: WorldState): LaunchPhase | null {
  const p = world.facts[FACT_PHASE];
  return typeof p === 'string' ? (p as LaunchPhase) : null;
}

/** Whether the launch scene has the household and the steerer now. */
export function launchActive(world: WorldState): boolean {
  const p = launchPhase(world);
  return p !== null && SCENE.includes(p);
}

/** Whether the launch holds this resident (their day waits until it is over). */
export function launchHolds(world: WorldState, id: Id): boolean {
  return launchActive(world) && world.household.residents.includes(id);
}

/** Whether every condition the gate opens on holds (content `opensWhen`: facts set). */
function opensNow(world: WorldState, ctx: LaunchContext): boolean {
  return ctx.def.opensWhen.every((f) => {
    const v = world.facts[f];
    return v !== undefined && v !== false;
  });
}

/** The crew who will sail: residents in the household, alive and not downed, in content's order. */
export function launchCrew(world: WorldState): Id[] {
  return world.household.residents.filter((id) => {
    const p = world.people[id];
    return p !== undefined && p.status !== 'dead' && p.status !== 'captive';
  });
}

/** Residents of the chapter who died (they will not sail). */
function lostCrew(world: WorldState): Id[] {
  return Object.values(world.people)
    .filter((p) => p.id.startsWith('C_') && p.status === 'dead')
    .map((p) => p.id);
}

/**
 * Where the boat's keel floats, run down its skids from its berth (tiles), at the given calendar:
 * the first line south of the berth, within Book 10's skids, where the water at its keel from
 * stern to stem is at least Book 10's `floats` band; null if the tide is out.
 */
export function floatLine(
  world: WorldState,
  ctx: LaunchContext,
  land: Pick<LandContext, 'water' | 'elevations'>,
  b: TimeBalance,
  cal: CalendarState = world.calendar,
): number | null {
  const ship = boatOf(world);
  if (ship === null) return null;
  const berth = berthOf(world, ship);
  const elevation = land.elevations.get(ship.lies.zone);
  if (elevation === undefined) return null;
  const level = stillWaterLevel(tideAt(cal, b));
  const need = DEPTH_BANDS.indexOf(ctx.b.floats);
  // The keel's wetted length: stern to stem, inside the posts (the T1 hull is 7 tiles).
  const xs = [-2.6, -1.3, 0, 1.3, 2.6].map((dx) => (berth.x + dx) * T);
  for (let d = 0; d <= ctx.b.skidsTiles + 1e-9; d += 0.25) {
    const y = (berth.y + d) * T;
    const ok = xs.every((x) => {
      const band = bandAt(land.water, elevation, x, y, level);
      return band !== null && DEPTH_BANDS.indexOf(band.band) >= need;
    });
    if (ok) return berth.y + d;
  }
  return null;
}

/** Game minutes until the tide floats the boat (0: now), within Book 10's lookahead; else null. */
export function minutesToFloat(
  world: WorldState,
  ctx: LaunchContext,
  land: Pick<LandContext, 'water' | 'elevations'>,
  b: TimeBalance,
): number | null {
  for (let m = 0; m <= ctx.b.tideLookaheadMinutes; m += 10) {
    const cal = m === 0 ? world.calendar : advanceMinutes(world.calendar, m, b);
    if (floatLine(world, ctx, land, b, cal) !== null) return m;
  }
  return null;
}

function berthOf(world: WorldState, ship: ShipInstance): { x: number; y: number } {
  const x = world.facts[FACT_BERTH_X];
  const y = world.facts[FACT_BERTH_Y];
  return typeof x === 'number' && typeof y === 'number' ? { x, y } : ship.lies;
}

/** One line of the readiness screen (Book 2 section 16, ReadinessView, with its words' values). */
export interface ReadinessLine {
  readonly kind: LaunchDef['readiness'][number]['kind'];
  readonly measure: LaunchDef['readiness'][number]['measure'];
  readonly labelKey: string;
  readonly state: 'READY' | 'SHORT' | 'UNKNOWN';
  readonly textKey: string;
  readonly vars: Readonly<Record<string, string | number>>;
  /** IDs or string keys the words list, named by the interface (people, items, fittings, keys). */
  readonly list?: { readonly kind: 'person' | 'item' | 'fitting' | 'key'; readonly ids: string[] };
  readonly extra?: { readonly textKey: string; readonly ids: string[] };
}

export interface ReadinessView {
  readonly gate: Id;
  readonly status: GateState['status'];
  readonly lines: readonly ReadinessLine[];
  readonly pointOfNoReturnKey: string;
  /** Whether the gate can start now (open, the boat seaworthy and the tide in). */
  readonly canStart: boolean;
}

/**
 * The readiness screen (Book 6 section 15: the boat's repairs, crew and stores), from what the
 * household knows: never hidden truth.
 */
export function readinessView(
  world: WorldState,
  ctx: LaunchContext,
  land: Pick<LandContext, 'water' | 'elevations'>,
  b: TimeBalance,
): ReadinessView {
  const gate = gateOf(world, ctx);
  const ship = boatOf(world);
  const crew = launchCrew(world);
  const stats = ship === null ? null : deriveStats(ship, ctx.ship, crew.length);
  const toFloat = minutesToFloat(world, ctx, land, b);
  const lines: ReadinessLine[] = [];
  for (const r of ctx.def.readiness) {
    const base = { kind: r.kind, measure: r.measure, labelKey: r.labelKey };
    switch (r.measure) {
      case 'BOAT': {
        const lacks = stats?.lacks ?? [];
        const fitting =
          ship === null ? undefined : Object.values(ship.fittings).find((f) => f !== null);
        if (lacks.length > 0)
          lines.push({
            ...base,
            state: 'SHORT',
            textKey: 'ui.gate.launch.ship.short',
            vars: {},
            list: {
              kind: 'key',
              ids: lacks.map(
                (l) =>
                  `ui.gate.launch.lack.${l === 'STEERING_OAR' ? 'oar' : l === 'HULL' ? 'hull' : 'rigging'}`,
              ),
            },
          });
        else if (fitting != null)
          lines.push({
            ...base,
            state: 'READY',
            textKey: 'ui.gate.launch.ship.fitted',
            vars: {},
            list: { kind: 'fitting', ids: [fitting] },
          });
        else lines.push({ ...base, state: 'READY', textKey: 'ui.gate.launch.ship.ready', vars: {} });
        break;
      }
      case 'TIDE':
        if (toFloat === 0)
          lines.push({ ...base, state: 'READY', textKey: 'ui.gate.launch.tide.ready', vars: {} });
        else if (toFloat === null)
          lines.push({ ...base, state: 'SHORT', textKey: 'ui.gate.launch.tide.none', vars: {} });
        else if (toFloat < 60)
          lines.push({ ...base, state: 'SHORT', textKey: 'ui.gate.launch.tide.soon', vars: {} });
        else
          lines.push({
            ...base,
            state: 'SHORT',
            textKey: 'ui.gate.launch.tide.short',
            vars: { hours: Math.round(toFloat / 60) },
          });
        break;
      case 'CREW': {
        const oars = stats?.rowingCrew ?? crew.length;
        const lost = lostCrew(world);
        lines.push({
          ...base,
          state: crew.length >= oars ? 'READY' : 'SHORT',
          textKey: crew.length >= oars ? 'ui.gate.launch.crew.ready' : 'ui.gate.launch.crew.short',
          vars: { count: crew.length, oars },
          list: { kind: 'person', ids: crew },
          ...(lost.length === 0 ? {} : { extra: { textKey: 'ui.gate.launch.crew.dead', ids: lost } }),
        });
        break;
      }
      case 'FOOD': {
        const home = world.homes['ISLE_SKARV'];
        const rd = home === undefined ? 0 : foodRd(home);
        const days = Math.floor(rd / ((1 + crew.length) * ctx.foodPerPersonPerDay) + 1e-9);
        lines.push({
          ...base,
          state: days >= ctx.b.storesShortDays ? 'READY' : 'SHORT',
          textKey:
            days <= 0
              ? 'ui.gate.launch.stores.none'
              : days >= ctx.b.storesShortDays
                ? 'ui.gate.launch.stores.ready'
                : 'ui.gate.launch.stores.short',
          vars: { days },
        });
        break;
      }
      case 'WEAPONS': {
        const held = ctx.def.weapons.filter((w) => world.player.hotbar.slots.includes(w));
        const arrows = world.player.inventory['ITEM_ARROW'] ?? 0;
        lines.push({
          ...base,
          state: held.length > 0 ? 'READY' : 'SHORT',
          textKey: held.length > 0 ? 'ui.gate.launch.gear.ready' : 'ui.gate.launch.gear.short',
          vars: { arrows },
          list: { kind: 'item', ids: held },
        });
        break;
      }
      case 'ALLIES':
        lines.push({
          ...base,
          state: 'UNKNOWN',
          textKey: 'ui.gate.launch.allies.unknown',
          vars: {},
        });
        break;
      case 'RITES': {
        const rites = world.facts['ch1.rites'];
        lines.push({
          ...base,
          state: rites === undefined ? 'SHORT' : 'READY',
          textKey:
            rites === 'SHIP_SETTING'
              ? 'ui.gate.launch.rites.setting'
              : rites === 'SEA_BURIAL'
                ? 'ui.gate.launch.rites.sea'
                : 'ui.gate.launch.rites.short',
          vars: {},
        });
        break;
      }
    }
  }
  return {
    gate: ctx.def.gate,
    status: gate.status,
    lines,
    pointOfNoReturnKey: ctx.def.pointOfNoReturnKey,
    canStart: gate.status === 'OPEN' && stats?.seaworthy === true && toFloat === 0,
  };
}

/** Why the launch cannot start now, or null if it can. */
export type LaunchRefusal = 'NOT_OPEN' | 'NOT_SEAWORTHY' | 'TIDE_OUT';

/**
 * Starts the gate on the player's command: the gate is STARTED, the checkpoint is made, Thorkel
 * unburied is a deed, and the boat waits for its name and its mark.
 */
export function startLaunch(
  world: WorldState,
  ctx: LaunchContext,
  land: Pick<LandContext, 'water' | 'elevations'>,
  b: TimeBalance,
  hooks: LaunchHooks,
  emit: LaunchEmit,
): LaunchRefusal | null {
  const gate = gateOf(world, ctx);
  if (gate.status !== 'OPEN') return 'NOT_OPEN';
  const ship = boatOf(world);
  if (ship === null || !deriveStats(ship, ctx.ship, launchCrew(world).length).seaworthy)
    return 'NOT_SEAWORTHY';
  const floats = floatLine(world, ctx, land, b);
  if (floats === null) return 'TIDE_OUT';
  gate.status = 'STARTED';
  setFact(world, FACT_FLOAT, floats);
  gate.startedDay = world.calendar.day;
  world.talk = null;
  setFact(world, FACT_PHASE, 'NAMING');
  setFact(world, FACT_BERTH_X, ship.lies.x);
  setFact(world, FACT_BERTH_Y, ship.lies.y);
  // Thorkel's rites never given: decided now (Book 6 RITES_DENIED; decision S11-14).
  if (world.facts['ch1.rites'] === undefined) {
    const crew = launchCrew(world);
    hooks.deed('RITES_DENIED', crew);
    setFact(world, 'ch1.rites', 'DENIED');
    if (crew.includes(ctx.def.speaker) && ctx.def.lines['noRites'] !== undefined)
      emit({ type: 'PERSON_SPOKE', person: ctx.def.speaker, lineKey: ctx.def.lines['noRites'] });
  }
  emit({ type: 'GATE_STARTED', gate: ctx.def.gate });
  emit({ type: 'CHECKPOINT', label: ctx.def.checkpoint });
  return null;
}

/**
 * A boat's name as the player typed it, made safe to keep and to show: letters (with accents),
 * spaces, hyphens and apostrophes only; spaces collapsed; at most `max` characters. Empty: null.
 */
export function cleanShipName(raw: string, max: number): string | null {
  const kept = [...raw.normalize('NFC')]
    .filter((c) => /[\p{L}\p{M}' \-’]/u.test(c))
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/^[\s'’-]+|[\s'’-]+$/g, '');
  const name = [...kept].slice(0, max).join('').trim();
  return name === '' ? null : name;
}

/** Whether `pattern` (and `dye`) is a sail mark content offers. */
export function markOf(ctx: LaunchContext, pattern: string, dye: string | null): string | null {
  const p = ctx.def.marks.patterns.find((x) => x.key === pattern);
  if (p === undefined) return null;
  if (!p.dyed) return p.key;
  if (dye === null || !ctx.def.marks.dyes.some((d) => d.key === dye)) return null;
  return `${p.key}:${dye}`;
}

/** Names the boat (once the gate has started, before it is in the water). */
export function nameShip(
  world: WorldState,
  ctx: LaunchContext,
  raw: string,
  emit: LaunchEmit,
): boolean {
  const ship = boatOf(world);
  if (ship === null || launchPhase(world) !== 'NAMING') return false;
  const name = cleanShipName(raw, ctx.def.names.maxLength);
  if (name === null) return false;
  ship.name = name;
  ship.history.push({ day: world.calendar.day, kind: 'NAMED', what: name });
  emit({ type: 'SHIP_NAMED', name });
  return true;
}

/** Marks the sail (Book 7 section 04: chosen at the launch). */
export function markSail(
  world: WorldState,
  ctx: LaunchContext,
  pattern: string,
  dye: string | null,
  emit: LaunchEmit,
): boolean {
  const ship = boatOf(world);
  const mark = markOf(ctx, pattern, dye);
  if (ship === null || mark === null || launchPhase(world) !== 'NAMING') return false;
  ship.marks.sail = mark;
  emit({ type: 'SAIL_MARKED', mark });
  return true;
}

function since(world: WorldState): number {
  const s = world.facts[FACT_SINCE];
  return typeof s === 'number' ? s : world.tick;
}

function phaseTo(world: WorldState, phase: LaunchPhase): void {
  setFact(world, FACT_PHASE, phase);
  setFact(world, FACT_SINCE, world.tick);
}

export function aboardOf(world: WorldState): Id[] {
  const a = world.facts[FACT_ABOARD];
  return typeof a === 'string' && a !== '' ? a.split(',') : [];
}

export function steererAboard(world: WorldState): boolean {
  return world.facts[FACT_STEERER_ABOARD] === true;
}

function say(world: WorldState, ctx: LaunchContext, key: string, emit: LaunchEmit): void {
  const line = ctx.def.lines[key];
  if (line === undefined) return;
  const who = SPEAKERS[line.split('.')[0] ?? ''];
  if (who === undefined || !launchCrew(world).includes(who)) return;
  emit({ type: 'PERSON_SPOKE', person: who, lineKey: line });
}

const SPEAKERS: Readonly<Record<string, Id>> = {
  c_hild: 'C_HILD',
  c_bran: 'C_BRAN',
  c_runa: 'C_RUNA',
  c_oddi: 'C_ODDI',
};

function info(ctx: LaunchContext, key: string, emit: LaunchEmit): void {
  const k = ctx.def.info[key];
  if (k !== undefined) emit({ type: 'SEARCH_INFO', key: k });
}

/** Where each of the crew pushes, behind the boat (tiles from the keel's middle). */
function pushSpot(ctx: LaunchContext, i: number): number {
  const xs = ctx.def.push.crew;
  return xs[i % Math.max(1, xs.length)] ?? 0;
}

/** Puts a resident in the scene, at a place in the strand's pixels. */
function stand(
  world: WorldState,
  id: Id,
  zone: Id,
  x: number,
  y: number,
  pose: OnFootActor['pose'],
  moving: boolean,
  task?: Id,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const found = findActor(onFoot, id);
  const actor: OnFootActor = {
    ...(found?.actor ?? {}),
    x,
    y,
    facing: 's',
    pose,
  };
  delete actor.walk;
  delete actor.intent;
  delete actor.carries;
  if (moving) actor.moving = true;
  else delete actor.moving;
  if (task !== undefined) actor.task = task;
  else delete actor.task;
  placeActor(onFoot, id, zone, actor);
}

/**
 * One tick of the launch: the gate opens when its conditions hold; once started and the boat is
 * named and marked, the scene plays.
 */
export function stepLaunch(
  world: WorldState,
  ctx: LaunchContext,
  emit: LaunchEmit,
): void {
  const gate = gateOf(world, ctx);
  if (gate.status === 'CLOSED' && opensNow(world, ctx)) {
    gate.status = 'OPEN';
    gate.openedDay = world.calendar.day;
    emit({ type: 'GATE_OPENED', gate: ctx.def.gate });
  }
  const phase = launchPhase(world);
  const ship = boatOf(world);
  const onFoot = world.onFoot;
  if (phase === null || phase === 'DONE' || ship === null || onFoot === null) return;
  const zone = ship.lies.zone;
  const crew = launchCrew(world);
  const p = onFoot.player;
  const s = ctx.def.scene;
  const t = world.tick - since(world);
  const berth = berthOf(world, ship);
  const pushY = (keel: number): number => (keel + ctx.def.push.dy) * T;
  switch (phase) {
    case 'NAMING': {
      if (ship.name === null || ship.marks.sail === null) return;
      // Everyone to the boat: hands on its strakes from behind (the view fades in on them).
      if (onFoot.zone !== zone) switchZone(onFoot, zone, { x: berth.x * T, y: pushY(berth.y) });
      p.x = (berth.x + ctx.def.push.steerer) * T;
      p.y = pushY(berth.y);
      p.facing = 's';
      p.moving = false;
      p.aim = null;
      p.work = null;
      p.intent = { x: 0, y: 0, run: false, sneak: false };
      onFoot.carrying = null;
      crew.forEach((id, i) => {
        stand(
          world,
          id,
          zone,
          (berth.x + pushSpot(ctx, i)) * T,
          pushY(berth.y),
          'work',
          false,
          'TASK_GATHER_DRIFTWOOD',
        );
      });
      setFact(world, FACT_ABOARD, '');
      setFact(world, FACT_STEERER_ABOARD, false);
      setFact(world, FACT_STROKES, 0);
      phaseTo(world, 'HEAVE');
      emit({ type: 'LAUNCH_GATHERED' });
      info(ctx, 'gather', emit);
      say(world, ctx, 'heave', emit);
      return;
    }
    case 'HEAVE':
      if (t < s.heaveSeconds * TICKS) return;
      phaseTo(world, 'SLIDE');
      emit({ type: 'LAUNCH_SLIDE' });
      say(world, ctx, 'slide', emit);
      return;
    case 'SLIDE': {
      const floatY = Number(world.facts[FACT_FLOAT] ?? berth.y);
      const step = ctx.b.slideSpeed / TICKS;
      const y = Math.min(floatY, ship.lies.y + step);
      ship.lies = { ...ship.lies, y };
      const arrived = y >= floatY - 1e-9;
      p.y = pushY(y);
      p.moving = !arrived;
      p.gait = 'walk';
      p.facing = 's';
      crew.forEach((id, i) => {
        stand(world, id, zone, (berth.x + pushSpot(ctx, i)) * T, pushY(y), 'idle', !arrived);
      });
      if (!arrived) return;
      phaseTo(world, 'BOARD');
      emit({ type: 'LAUNCH_AFLOAT' });
      info(ctx, 'afloat', emit);
      say(world, ctx, 'afloat', emit);
      return;
    }
    case 'BOARD': {
      // One by one over the side, the steerer last, then a moment to settle at the oars.
      const settle = s.settleSeconds * TICKS;
      const stagger = s.boardStaggerSeconds * TICKS;
      const aboard = aboardOf(world);
      for (let i = aboard.length; i < crew.length; i++) {
        if (t < settle + i * stagger) break;
        const id = crew[i];
        if (id === undefined) break;
        aboard.push(id);
        setFact(world, FACT_ABOARD, aboard.join(','));
        emit({ type: 'CREW_ABOARD', person: id });
        if (i === 0) info(ctx, 'aboard', emit);
      }
      if (!steererAboard(world) && t >= settle + crew.length * stagger) {
        setFact(world, FACT_STEERER_ABOARD, true);
        emit({ type: 'CREW_ABOARD', person: 'P_STEERER' });
        say(world, ctx, 'patch', emit);
      }
      followBoat(world, ship, crew);
      if (t < settle * 2 + crew.length * stagger) return;
      phaseTo(world, 'HOIST');
      emit({ type: 'SAIL_HOISTED' });
      say(world, ctx, 'sail', emit);
      return;
    }
    case 'HOIST':
      followBoat(world, ship, crew);
      if (t < s.hoistSeconds * TICKS) return;
      phaseTo(world, 'ROW');
      emit({ type: 'SAIL_SET' });
      info(ctx, 'sail', emit);
      say(world, ctx, 'named', emit);
      return;
    case 'ROW': {
      const out = ctx.b.rowOutTiles;
      const x = Math.min(berth.x + out, ship.lies.x + ctx.b.rowSpeed / TICKS);
      ship.lies = { ...ship.lies, x };
      followBoat(world, ship, crew);
      const strokes = Number(world.facts[FACT_STROKES] ?? 0);
      const due = Math.floor(t / (s.strokeSeconds * TICKS));
      if (due >= strokes) {
        setFact(world, FACT_STROKES, due + 1);
        emit({ type: 'OAR_STROKE', n: due });
        if (due === 1) say(world, ctx, 'row', emit);
      }
      if (x < berth.x + out - 1e-9) return;
      reveal(world, ctx, gate, ship, emit);
      return;
    }
    case 'MAP':
      followBoat(world, ship, crew);
      return;
  }
}

/** Those aboard ride with the boat (the camera follows the steerer, so the view follows it). */
function followBoat(world: WorldState, ship: ShipInstance, crew: readonly Id[]): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const aboard = aboardOf(world);
  for (const id of crew) {
    if (!aboard.includes(id)) continue;
    stand(world, id, ship.lies.zone, ship.lies.x * T, (ship.lies.y - 0.5) * T, 'idle', false);
  }
  if (steererAboard(world)) {
    onFoot.player.x = ship.lies.x * T;
    onFoot.player.y = (ship.lies.y - 0.5) * T;
    onFoot.player.moving = false;
  } else {
    onFoot.player.moving = false;
  }
}

/** Out from the strand: the sea map shows the coast and the smoke; Chapter 1 is resolved. */
function reveal(
  world: WorldState,
  ctx: LaunchContext,
  gate: GateState,
  ship: ShipInstance,
  emit: LaunchEmit,
): void {
  phaseTo(world, 'MAP');
  gate.status = 'PASSED';
  ship.history.push({ day: world.calendar.day, kind: 'LAUNCHED', what: ship.name ?? '' });
  for (const place of ctx.def.seaMap.rumoured)
    if (world.knowledge.places[place] === undefined) world.knowledge.places[place] = 'RUMOURED';
  setFact(world, FACT_SMOKE, true);
  setFact(world, FACT_LAUNCHED, true);
  // The tutorial guard ends at the launch (Book 10 tutorialGuard; decision S7-7).
  setFact(world, FACT_TUTORIAL_COMPLETE, true);
  const ch = world.chapters[ctx.def.chapter];
  if (ch !== undefined) {
    ch.status = 'RESOLVED';
    ch.resolvedDay = world.calendar.day;
    ch.resolvedBy = [ctx.def.gate];
  }
  const next = world.chapters[ctx.def.next];
  if (next !== undefined) {
    next.status = 'ACTIVE';
    next.openedDay = world.calendar.day;
  }
  fireOneShot(world, ctx.def.gate, () => undefined);
  emit({ type: 'SEA_MAP_REVEALED' });
  say(world, ctx, 'smoke', emit);
}

/**
 * The sea map is closed: the trial row's time passes, the boat is drawn up again at its berth,
 * everyone is back on the shingle by it, and the chapter-end save is due.
 */
export function closeSeaMap(
  world: WorldState,
  ctx: LaunchContext,
  hooks: LaunchHooks,
  emit: LaunchEmit,
): boolean {
  const ship = boatOf(world);
  const onFoot = world.onFoot;
  if (launchPhase(world) !== 'MAP' || ship === null || onFoot === null) return false;
  const berth = berthOf(world, ship);
  const crew = launchCrew(world);
  ship.lies = { ...ship.lies, x: berth.x, y: berth.y };
  setFact(world, FACT_PHASE, 'DONE');
  setFact(world, FACT_ABOARD, '');
  setFact(world, FACT_STEERER_ABOARD, false);
  const d = ctx.def.drawnUp;
  crew.forEach((id, i) => {
    const spot = d.crew[i % Math.max(1, d.crew.length)] ?? [berth.x, berth.y + 2];
    stand(world, id, ship.lies.zone, (spot[0] ?? berth.x) * T, (spot[1] ?? berth.y) * T, 'idle', false);
  });
  onFoot.player.x = d.steerer.x * T;
  onFoot.player.y = d.steerer.y * T;
  onFoot.player.facing = d.steerer.facing;
  onFoot.player.moving = false;
  hooks.advance(ctx.b.trialRowMinutes);
  info(ctx, 'drawnUp', emit);
  say(world, ctx, 'drawnUp', emit);
  emit({ type: 'CHAPTER_ENDED', chapter: ctx.def.chapter, save: ctx.def.chapterSave });
  return true;
}

/** What the scene draws of the launch now (read by the view; nothing here changes the world). */
export interface LaunchView {
  readonly phase: LaunchPhase;
  /** Residents aboard (not drawn on foot), and whether the steerer is. */
  readonly aboard: readonly Id[];
  readonly steererAboard: boolean;
  /** The household heaving at the boat: the steerer's loop then. */
  readonly heaving: boolean;
  readonly afloat: boolean;
  /** The sail: furled on its yard, being hoisted (0 to 1), or set and full. */
  readonly sail: { readonly state: 'FURLED' | 'HOIST' | 'SET'; readonly at: number };
  readonly rowing: boolean;
  readonly mark: string | null;
}

export function launchView(world: WorldState, ctx: Pick<LaunchContext, 'def'>): LaunchView | null {
  const phase = launchPhase(world);
  const ship = boatOf(world);
  if (phase === null || phase === 'NAMING' || phase === 'DONE' || ship === null) return null;
  const t = world.tick - since(world);
  const hoist = Math.min(1, t / Math.max(1, ctx.def.scene.hoistSeconds * TICKS));
  return {
    phase,
    aboard: aboardOf(world),
    steererAboard: steererAboard(world),
    heaving: phase === 'HEAVE',
    afloat: phase === 'BOARD' || phase === 'HOIST' || phase === 'ROW' || phase === 'MAP',
    sail:
      phase === 'HOIST'
        ? { state: 'HOIST', at: hoist }
        : phase === 'ROW' || phase === 'MAP'
          ? { state: 'SET', at: 1 }
          : { state: 'FURLED', at: 0 },
    rowing: phase === 'ROW' || phase === 'MAP',
    mark: ship.marks.sail,
  };
}
