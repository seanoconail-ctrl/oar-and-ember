/**
 * The user's fourth playtest's story and scenes (requests 1, 5 and 6; decisions DH-12 to DH-16,
 * DH-29 to DH-32). Book 10 section 25, "Story and scenes", holds every number.
 *
 * - **The strongbox taken in sight** ("The silver mustn't vanish by magic"). Before, carrying Oddi
 *   home first made the ship's silver vanish from the strand while the steerer was away. Now, while
 *   the steerer carries Oddi on his strand with the box still lying there, one of the band who is
 *   free (Conn first, then Svart, then Ketill) breaks from the dune grass, runs down, hauls the box
 *   up by its handles and makes off with it up the dunes to the strand's north edge, for the fold.
 *   The steerer is held for that moment (snatchHold) and turns to watch; Oddi shouts. Then the
 *   chase is open: set Oddi down (he is safe wherever he is set, decision DE-85) and run the thief
 *   down; within snatchCatch he drops the box and runs on empty-handed, and the box lies in the
 *   sand to be carried home (`ch1.silver_snatch` CAUGHT). Away over the edge, the silver is the
 *   band's (`ch1.chest` LOST) and the household remembers who took it (`ch1.silver_taken_by`): Oddi
 *   names him, the fold's talk speaks of it and Ketill no longer asks for it. With none of the band
 *   free (all dead, gone, or met at the fold or the cave), nobody comes, and the box waits where it
 *   lies: nothing is ever taken out of sight.
 * - **In view** (sightView): whether the steerer can see someone (the broch's quarrel starts only
 *   in view of its people).
 * - **Runa's reminder**: home at the camp with her tool chest not yet at one of her safe places,
 *   she reminds the steerer to bring it into the broch, at most runaRemindTimes.
 *
 * Pure and deterministic: no random stream is drawn here.
 */
import type { Content } from '../../content/registry.ts';
import type { Story4Balance } from '../../content/story4Balance.ts';
import { parseStory4Balance } from '../../content/story4Balance.ts';
import type { Id } from '../../core/ids.ts';
import { setFact } from '../ledger/ledger.ts';
import type { LandContext, OnFootActor, OnFootState } from '../land/onFoot.ts';
import { footprintClear, TICKS_PER_SECOND } from '../land/onFoot.ts';
import { planWalk, walkAlong } from '../land/path.ts';
import { findActor } from '../land/zoneLinks.ts';
import { solidAt, terrainAt, tileOf } from '../land/zoneMap.ts';
import type { ZoneMap } from '../land/zoneMap.ts';
import type { WorldState } from '../world.ts';
import { remarksContext } from './remarks.ts';
import type { RemarksContext } from './remarks.ts';

type Edge = 'n' | 's' | 'e' | 'w';

export interface Thief {
  readonly person: Id;
  readonly grab: string;
  readonly caught: string;
  readonly oddiShout: string;
  readonly oddiSafe: string;
}

export interface Story4Context {
  readonly b: Story4Balance;
  readonly remarks: RemarksContext | null;
  readonly snatch: {
    readonly landward: Edge;
    readonly exit: Edge;
    readonly thieves: readonly Thief[];
  } | null;
  readonly runaLines: readonly string[];
  /** Oddi's search (content/searches.json): who, where, the box. */
  readonly oddi: { readonly person: Id; readonly zone: Id; readonly chest: Id } | null;
  /** Runa (content/searches.json) and her chest. */
  readonly runa: { readonly person: Id; readonly tools: Id } | null;
  /** Book 10 barkEarshot (section 08), in tiles. */
  readonly earshotTiles: number;
}

export function story4Context(
  content: Pick<Content, 'opening' | 'balance' | 'searches'>,
  earshotTiles: number,
): Story4Context | null {
  const s4 = content.opening?.rework.story4;
  if (s4 === undefined) return null;
  const s = content.searches ?? null;
  return {
    b: parseStory4Balance(content.balance),
    remarks: remarksContext(content),
    snatch: { landward: s4.snatch.landward, exit: s4.snatch.exit, thieves: s4.snatch.thieves },
    runaLines: s4.runa.lines,
    oddi: s === null ? null : { person: s.oddi.person, zone: s.oddi.zone, chest: s.oddi.chest.id },
    runa: s === null ? null : { person: s.runa.person, tools: s.runa.tools.id },
    earshotTiles,
  };
}

// --------------------------------------------------------------------- the strongbox taken

/** Who took the silver over the strand's edge (the household remembers; DH-15). */
export const FACT_SILVER_TAKEN_BY = 'ch1.silver_taken_by';
/** How the snatch ended: CAUGHT (dropped in the sand) or TAKEN (away with it). */
export const FACT_SILVER_SNATCH = 'ch1.silver_snatch';
const FACT_BY = 'snatch.by';
const FACT_STAGE = 'snatch.stage';
const FACT_SINCE = 'snatch.since';
const FACT_LIFTED_AT = 'snatch.oddi_lifted_at';
const FACT_CHEST = 'ch1.chest';
const FACT_ODDI = 'search.oddi';

export type SnatchStage = 'RUN' | 'STOOP' | 'AWAY' | 'FLEE';

export type Story4Event =
  | {
      readonly type: 'SNATCH';
      readonly what: 'BEGAN' | 'GRABBED' | 'CAUGHT' | 'AWAY';
      readonly by: Id;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly type: 'PERSON_SPOKE';
      readonly person: Id;
      readonly lineKey: string;
      readonly bark?: string;
    };

export type Story4Emit = (e: Story4Event) => void;

/** The snatch's stage now, or null when none is under way. */
export function snatchStage(world: WorldState): SnatchStage | null {
  const s = world.facts[FACT_STAGE];
  return s === 'RUN' || s === 'STOOP' || s === 'AWAY' || s === 'FLEE' ? s : null;
}

/** Whether the snatch's brief scene holds the steerer now (snatchHold). */
export function snatchHolds(world: WorldState, ctx: Story4Context | null): boolean {
  if (ctx === null) return false;
  const stage = snatchStage(world);
  if (stage !== 'RUN' && stage !== 'STOOP') return false;
  const since = Number(world.facts[FACT_SINCE] ?? world.tick);
  return world.tick - since < Math.round(ctx.b.snatch.holdSeconds * TICKS_PER_SECOND);
}

/** The steerer lifted Oddi: the clock for snatchAfter starts (once). */
export function oddiLifted(world: WorldState, ctx: Story4Context | null, target: Id): void {
  if (ctx?.oddi?.person !== target) return;
  if (world.facts[FACT_LIFTED_AT] === undefined) setFact(world, FACT_LIFTED_AT, world.tick);
}

/** The first of the band who is free to come: alive, not gone, and not met since the dusk. */
function freeThief(world: WorldState, ctx: Story4Context): Thief | null {
  const onFoot = world.onFoot;
  if (onFoot === null || ctx.snatch === null) return null;
  // Once the fold is decided the band is beaten, paid or at its skiff: none comes to the strand.
  if (world.facts['ch1.wreckers'] !== undefined) return null;
  for (const t of ctx.snatch.thieves) {
    const p = world.people[t.person];
    if (p === undefined || p.status === 'dead' || p.status === 'captive') continue;
    // Spared and gone for good (Book 10 chapter1): never seen again on the island.
    const r = [...(world.spared ?? [])].reverse().find((x) => x.person === t.person);
    if (r?.island === true && r.fate === 'GONE') continue;
    // Somewhere in the world already (still at the stern, at the fold): not free to come.
    if (findActor(onFoot, t.person) !== null) continue;
    return t;
  }
  return null;
}

const STEP: Readonly<Record<Edge, { x: number; y: number }>> = {
  n: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
};

/** Where he breaks from cover: up to snatchStart landward of the box, on open ground. */
function startPoint(
  map: ZoneMap,
  land: Pick<LandContext, 'rules'>,
  box: { x: number; y: number },
  way: Edge,
  tiles: number,
  open: boolean,
): { x: number; y: number } {
  const d = STEP[way];
  for (let k = tiles; k >= 1; k -= 0.5) {
    const x = box.x + d.x * k * map.tile;
    const y = box.y + d.y * k * map.tile;
    if (footprintClear(map, land.rules, x, y, open)) return { x, y };
  }
  return { x: box.x, y: box.y };
}

/** The point on the exit edge he makes for: straight across from where he is. */
function exitPoint(
  map: ZoneMap,
  a: { x: number; y: number },
  way: Edge,
  along?: number,
): { x: number; y: number } {
  const W = map.width * map.tile;
  const H = map.height * map.tile;
  const m = map.tile * 0.6;
  const x = along ?? a.x;
  const y = along ?? a.y;
  if (way === 'n') return { x, y: m + 12 };
  if (way === 's') return { x, y: H - m };
  if (way === 'e') return { x: W - m, y };
  return { x: m, y };
}

/** Where along the exit edge he runs: away from the steerer, by the start's distance (DH-14). */
function veer(
  map: ZoneMap,
  a: { x: number; y: number },
  p: { x: number; y: number },
  way: Edge,
  tiles: number,
): number {
  const T = map.tile;
  const across = way === 'n' || way === 's';
  const from = across ? a.x : a.y;
  const them = across ? p.x : p.y;
  const span = (across ? map.width : map.height) * T;
  const away = from >= them ? 1 : -1;
  return Math.max(2 * T, Math.min(span - 2 * T, from + away * tiles * T));
}

/** The exit point fixed when he took the box (a fact), or straight ahead. */
function exitAlong(world: WorldState): number | undefined {
  const v = world.facts['snatch.exit'];
  return typeof v === 'number' ? v : undefined;
}

function atEdge(map: ZoneMap, a: { x: number; y: number }, way: Edge): boolean {
  const W = map.width * map.tile;
  const H = map.height * map.tile;
  const m = map.tile * 1.2;
  if (way === 'n') return a.y <= m + 12;
  if (way === 's') return a.y >= H - m;
  if (way === 'e') return a.x >= W - m;
  return a.x <= m;
}

function removeActor(onFoot: OnFootState, id: Id): void {
  onFoot.actors = Object.fromEntries(Object.entries(onFoot.actors).filter(([k]) => k !== id));
  for (const rest of Object.values(onFoot.elsewhere ?? {}))
    rest.actors = Object.fromEntries(Object.entries(rest.actors).filter(([k]) => k !== id));
}

function thiefOf(ctx: Story4Context, id: unknown): Thief | null {
  return ctx.snatch?.thieves.find((t) => t.person === id) ?? null;
}

/**
 * One tick of the snatch: it begins while the steerer carries Oddi on his strand (or sets him down
 * there first), plays its brief scene, and ends caught or away. `quiet` holds a beginning back (a
 * fight, a talk or a scene).
 */
export function stepSnatch(
  world: WorldState,
  ctx: Story4Context,
  map: ZoneMap,
  land: Pick<LandContext, 'rules'>,
  tidalGroundOpen: boolean,
  quiet: boolean,
  emit: Story4Emit,
): void {
  const onFoot = world.onFoot;
  const o = ctx.oddi;
  const sn = ctx.snatch;
  if (onFoot === null || o === null || sn === null) return;
  // The steerer gone off the strand while he runs (seen taking it): he is away with it, or, run
  // down already, away empty-handed.
  if (onFoot.zone !== o.zone) {
    const s = snatchStage(world);
    const by = world.facts[FACT_BY];
    if ((s === 'AWAY' || s === 'FLEE') && typeof by === 'string') {
      removeActor(onFoot, by);
      setFact(world, FACT_STAGE, 'DONE');
      if (s === 'AWAY') {
        removeActor(onFoot, o.chest);
        setFact(world, FACT_CHEST, 'LOST');
        setFact(world, FACT_SILVER_SNATCH, 'TAKEN');
        setFact(world, FACT_SILVER_TAKEN_BY, by);
        emit({ type: 'SNATCH', what: 'AWAY', by, x: 0, y: 0 });
      }
    }
    return;
  }
  if (map.zone !== o.zone) return;
  const stage = snatchStage(world);
  const p = onFoot.player;
  const T = map.tile;
  const b = ctx.b.snatch;
  if (stage === null) {
    if (world.facts[FACT_SILVER_SNATCH] !== undefined || world.facts[FACT_BY] !== undefined) return;
    if (world.facts[FACT_CHEST] !== undefined || quiet) return;
    const box = onFoot.actors[o.chest];
    if (box === undefined || box.pose === 'carried') return;
    // While Oddi is carried for snatchAfter, or once he is set down on the strand (DH-13).
    const lifted = world.facts[FACT_LIFTED_AT];
    const carrying = onFoot.carrying === o.person;
    const setDown = world.facts[FACT_ODDI] !== undefined && typeof lifted === 'number';
    if (typeof lifted !== 'number') return;
    if (carrying && world.tick - lifted < Math.round(b.afterSeconds * TICKS_PER_SECOND)) return;
    if (!carrying && !setDown) return;
    const t = freeThief(world, ctx);
    if (t === null) {
      // Nobody free to come: the box waits where it lies (never taken out of sight). Oddi, set
      // down already, says it is still there.
      setFact(world, FACT_BY, 'NONE');
      if (setDown && !carrying)
        emit({ type: 'PERSON_SPOKE', person: o.person, lineKey: 'c_oddi.search.safe_left' });
      return;
    }
    const at = startPoint(map, land, box, sn.landward, b.startTiles, tidalGroundOpen);
    const facing =
      Math.abs(box.x - at.x) > Math.abs(box.y - at.y)
        ? box.x > at.x
          ? 'e'
          : 'w'
        : box.y > at.y
          ? 's'
          : 'n';
    onFoot.actors[t.person] = { x: at.x, y: at.y, facing, pose: 'idle', moving: true };
    setFact(world, FACT_BY, t.person);
    setFact(world, FACT_STAGE, 'RUN');
    setFact(world, FACT_SINCE, world.tick);
    // The steerer turns to him.
    p.facing =
      Math.abs(at.x - p.x) > Math.abs(at.y - p.y)
        ? at.x > p.x
          ? 'e'
          : 'w'
        : at.y > p.y
          ? 's'
          : 'n';
    emit({ type: 'SNATCH', what: 'BEGAN', by: t.person, x: at.x, y: at.y });
    return;
  }
  const by = String(world.facts[FACT_BY]);
  const t = thiefOf(ctx, by);
  const a: OnFootActor | undefined = onFoot.actors[by];
  const box = onFoot.actors[o.chest];
  if (t === null || a === undefined) {
    setFact(world, FACT_STAGE, 'DONE');
    return;
  }
  if (stage === 'RUN') {
    if (box === undefined) {
      setFact(world, FACT_STAGE, 'FLEE');
      return;
    }
    if (runTo(a, box.x, box.y - 2, map, land, b.runTilesPerSecond, tidalGroundOpen)) {
      a.pose = 'work';
      a.task = 'TASK_GATHER_DRIFTWOOD';
      delete a.moving;
      setFact(world, FACT_STAGE, 'STOOP');
      setFact(world, 'snatch.stoop_at', world.tick);
    }
    return;
  }
  if (stage === 'STOOP') {
    const stoopAt = Number(world.facts['snatch.stoop_at'] ?? world.tick);
    if (world.tick - stoopAt < Math.round(b.stoopSeconds * TICKS_PER_SECOND)) return;
    if (box === undefined || box.pose === 'carried') {
      setFact(world, FACT_STAGE, 'FLEE');
      return;
    }
    delete a.task;
    a.pose = 'idle';
    a.carries = o.chest;
    box.pose = 'carried';
    setFact(world, FACT_STAGE, 'AWAY');
    setFact(world, 'snatch.exit', Math.round(veer(map, a, p, sn.exit, b.startTiles)));
    emit({ type: 'SNATCH', what: 'GRABBED', by, x: a.x, y: a.y });
    emit({ type: 'PERSON_SPOKE', person: by, lineKey: t.grab });
    // Oddi shouts after him, carried or lying where he was set.
    if (findActor(onFoot, o.person)?.visible === true)
      emit({ type: 'PERSON_SPOKE', person: o.person, lineKey: t.oddiShout });
    return;
  }
  if (stage === 'AWAY') {
    const goal = exitPoint(map, a, sn.exit, exitAlong(world));
    runTo(a, goal.x, goal.y, map, land, b.carryTilesPerSecond, tidalGroundOpen);
    if (box !== undefined) {
      box.x = a.x;
      box.y = a.y;
      box.facing = a.facing;
    }
    // Run down: he drops it and runs on empty-handed (DH-14).
    // Hands free (Oddi set down) and close enough to lay hold of him.
    if (
      onFoot.carrying === null &&
      p.moving &&
      Math.hypot(a.x - p.x, a.y - p.y) <= b.catchTiles * T
    ) {
      delete a.carries;
      if (box !== undefined) {
        box.pose = 'down';
        box.x = a.x;
        box.y = a.y + 4;
      }
      delete a.walk;
      setFact(world, FACT_STAGE, 'FLEE');
      setFact(world, FACT_SILVER_SNATCH, 'CAUGHT');
      emit({ type: 'SNATCH', what: 'CAUGHT', by, x: a.x, y: a.y });
      emit({ type: 'PERSON_SPOKE', person: by, lineKey: t.caught });
      return;
    }
    if (atEdge(map, a, sn.exit)) {
      removeActor(onFoot, by);
      removeActor(onFoot, o.chest);
      setFact(world, FACT_STAGE, 'DONE');
      setFact(world, FACT_CHEST, 'LOST');
      setFact(world, FACT_SILVER_SNATCH, 'TAKEN');
      setFact(world, FACT_SILVER_TAKEN_BY, by);
      emit({ type: 'SNATCH', what: 'AWAY', by, x: a.x, y: a.y });
      // Oddi, already set down and in earshot, names who it was.
      const od = findActor(onFoot, o.person);
      if (
        world.facts[FACT_ODDI] !== undefined &&
        od?.visible === true &&
        Math.hypot(od.actor.x - p.x, od.actor.y - p.y) <= ctx.earshotTiles * T
      )
        emit({ type: 'PERSON_SPOKE', person: o.person, lineKey: t.oddiSafe });
    }
    return;
  }
  // FLEE: empty-handed to the edge, and gone.
  const goal = exitPoint(map, a, sn.exit, exitAlong(world));
  runTo(a, goal.x, goal.y, map, land, b.runTilesPerSecond, tidalGroundOpen);
  if (atEdge(map, a, sn.exit)) {
    removeActor(onFoot, by);
    setFact(world, FACT_STAGE, 'DONE');
  }
}

/** Walks an actor along a planned way at a speed; true once there. */
function runTo(
  a: OnFootActor,
  x: number,
  y: number,
  map: ZoneMap,
  land: Pick<LandContext, 'rules'>,
  speed: number,
  open: boolean,
): boolean {
  if (a.walk === undefined || Math.hypot(a.walk.x - x, a.walk.y - y) > 2) {
    const w = planWalk(a, map, x, y, open);
    if (w === null) {
      // No way there: straight on (the scene must end).
      const d = Math.hypot(x - a.x, y - a.y);
      const per = (speed * map.tile) / TICKS_PER_SECOND;
      if (d <= per) {
        a.x = x;
        a.y = y;
        return true;
      }
      a.x += ((x - a.x) / d) * per;
      a.y += ((y - a.y) / d) * per;
      a.moving = true;
      return false;
    }
    a.walk = w;
  }
  a.moving = true;
  const there = walkAlong(a, a.walk, map, land, speed, open);
  if (there) {
    delete a.walk;
    delete a.moving;
  }
  return there;
}

/**
 * Oddi's line on being set down when the snatch has had its say: the thief named, the box run down,
 * or the box still lying there (none free to take it). Null: the search's own lines.
 */
export function oddiSafeLine(world: WorldState, ctx: Story4Context | null): string | null {
  if (ctx === null) return null;
  const how = world.facts[FACT_SILVER_SNATCH];
  if (how === 'CAUGHT') return 'c_oddi.snatch.safe.caught';
  const by = world.facts[FACT_SILVER_TAKEN_BY];
  if (how === 'TAKEN') return thiefOf(ctx, by)?.oddiSafe ?? null;
  // The thief still running with it: Oddi has shouted already; he wants it chased.
  if (snatchStage(world) === 'AWAY') return 'c_oddi.snatch.after';
  if (world.facts[FACT_BY] === 'NONE' && world.facts[FACT_CHEST] === undefined)
    return 'c_oddi.search.safe_left';
  return null;
}

// --------------------------------------------------------------------------------- in view

/**
 * Whether the steerer can see a point: inside sightView of the steerer, with no wall, rock or solid
 * ground on the straight line between the steerer's eyes and the person's (DH-29).
 */
export function canSee(
  b: Story4Balance,
  map: ZoneMap,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): boolean {
  const T = map.tile;
  if (Math.abs(to.x - from.x) > b.sightView.x * T || Math.abs(to.y - from.y) > b.sightView.y * T)
    return false;
  // Eye height: a little above the feet on both ends (a person is about 40 px tall).
  const fx = from.x;
  const fy = from.y - 16;
  const tx = to.x;
  const ty = to.y - 16;
  const d = Math.hypot(tx - fx, ty - fy);
  const n = Math.max(1, Math.ceil(d / 4));
  const own = tileOf(map, from.x, from.y);
  const theirs = tileOf(map, to.x, to.y);
  for (let i = 1; i < n; i++) {
    const t = tileOf(map, fx + ((tx - fx) * i) / n, fy + ((ty - fy) * i) / n);
    if ((t.tx === own.tx && t.ty === own.ty) || (t.tx === theirs.tx && t.ty === theirs.ty))
      continue;
    if (solidAt(map, t.tx, t.ty) || terrainAt(map, t.tx, t.ty) === 'rock') return false;
  }
  return true;
}

/** Whether the steerer, in `map`'s zone, can see every one of `ids` who is there. */
export function seesAll(
  world: WorldState,
  b: Story4Balance,
  map: ZoneMap,
  ids: readonly Id[],
): boolean {
  const onFoot = world.onFoot;
  if (onFoot?.zone !== map.zone) return false;
  for (const id of ids) {
    const a = onFoot.actors[id];
    if (a === undefined) return false;
    if (!canSee(b, map, onFoot.player, a)) return false;
  }
  return true;
}

// ----------------------------------------------------------------------- Runa's reminder

const FACT_REMIND_N = 'runa.remind_n';
const FACT_REMIND_AT = 'runa.remind_at';
const FACT_HOME_AT = 'runa.home_at';

/**
 * Runa home at the camp while her tool chest is not at one of her safe places: she reminds the
 * steerer to bring it into the broch, runaRemindAfter after she is home, then every
 * runaRemindEvery, at most runaRemindTimes (DH-31). Only with the steerer awake in earshot, and
 * not while the chest is being carried, in a talk, a fight or a scene (`quiet`).
 */
export function stepRunaRemind(
  world: WorldState,
  ctx: Story4Context,
  tile: number,
  quiet: boolean,
  emit: Story4Emit,
): void {
  const onFoot = world.onFoot;
  const r = ctx.runa;
  if (onFoot === null || r === null || ctx.runaLines.length === 0) return;
  if (!world.household.residents.includes(r.person)) return;
  if (world.facts[`rescue.${r.person}.home`] !== true) return;
  if (world.facts['runa.tools_at'] !== undefined) return;
  const n = Number(world.facts[FACT_REMIND_N] ?? 0);
  if (n >= Math.min(ctx.b.runaRemind.times, ctx.runaLines.length)) return;
  if (typeof world.facts[FACT_HOME_AT] !== 'number') setFact(world, FACT_HOME_AT, world.tick);
  const homeAt = Number(world.facts[FACT_HOME_AT]);
  const last = world.facts[FACT_REMIND_AT];
  const T = TICKS_PER_SECOND;
  const due =
    typeof last === 'number'
      ? last + Math.round(ctx.b.runaRemind.everySeconds * T)
      : homeAt + Math.round(ctx.b.runaRemind.afterSeconds * T);
  if (world.tick < due || quiet || onFoot.carrying === r.tools) return;
  if (!world.player.awake || onFoot.player.sleep != null) return;
  const runa = onFoot.actors[r.person];
  if (runa === undefined || runa.pose === 'sleep' || runa.pose === 'down') return;
  if (Math.hypot(runa.x - onFoot.player.x, runa.y - onFoot.player.y) > ctx.earshotTiles * tile)
    return;
  const key = ctx.runaLines[n];
  if (key === undefined) return;
  setFact(world, FACT_REMIND_N, n + 1);
  setFact(world, FACT_REMIND_AT, world.tick);
  emit({ type: 'PERSON_SPOKE', person: r.person, lineKey: key });
}
