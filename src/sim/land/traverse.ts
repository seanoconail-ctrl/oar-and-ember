/**
 * The movement verbs (Stage 14; Book 2 section 10, "Movement verbs and hazards", decision S14-14;
 * Book 10 section 06, "Stamina in traversal", "Running out of stamina" and "Movement verbs"):
 * climb marked routes, swim where the plan allows, jump short gaps, crawl through low gaps, push
 * and pull heavy objects along their lines, and the bog's soft ground in rain.
 *
 * Each verb starts only where the zone's plan marks it (src/content/traverseMarks.ts): Interact
 * starts a climb, a jump, a crawl or a hold on a heavy object; walking into a climb's foot or head
 * or a crawl's mouth starts it too, walking into a heavy object pushes it, and walking into marked
 * deep water swims. Each verb is simulation state on the steerer (`OnFootPlayer.traverse`), reached
 * only by commands, saved and replayed like any other; a heavy object's place is kept in
 * `RegionState.pushed`. Every number is Book 10's (src/content/traverseBalance.ts).
 *
 * - **Climb:** up or down the route's column at climb speed, facing the rock, nothing carried and
 *   no weapon used. The bar drains on the face and refills only on a ledge or at either end. Empty
 *   on the face, the climber slides down at Book 10's rate to the nearest ledge below or the foot;
 *   a slide longer than Book 10's free tiles costs its vitality a tile beyond, never leaving the
 *   climber below climbFallFloor (decision S14-52).
 * - **Swim:** in marked deep water only, nothing carried, at swim speed, the bar draining and never
 *   refilling. Empty, the swimmer starts to sink: within Book 10's seconds they must reach water no
 *   deeper than the waist, or they drown at its rate; the steerer drowned, the game is over.
 * - **Jump:** from a marked take-off to its landing, across a gap no wider than jumpGap, for
 *   jumpStamina; refused with less, carrying, or with the landing taken, and never short.
 * - **Crawl:** along the crawl's tiles at crawlSpeed, low and unseen as a sneak is; nothing carried
 *   passes; backed out of at any point.
 * - **Push and pull:** one tile along the object's line at pushSpeed, draining pushStamina; walking
 *   into it pushes it, holding Interact and stepping back pulls it; never off its line, never onto
 *   anyone, always movable back.
 * - **Soft ground:** the bog's soft ground slows the steerer by bogSoftRain while it rains.
 *
 * Pure and deterministic: the simulation calls these once per 60 Hz tick.
 */
import type { TraverseBalance } from '../../content/traverseBalance.ts';
import { crawlMouths, marksOf } from '../../content/traverseMarks.ts';
import type { ClimbMark, CrawlMark, PushMark, TraverseMarks } from '../../content/traverseMarks.ts';
import type { Id } from '../../core/ids.ts';
import type { WorldState } from '../world.ts';
import { footprintClear, TICKS_PER_SECOND } from './onFoot.ts';
import type { LandContext, MoveExtras, OnFootPlayer, OnFootState, TideNow } from './onFoot.ts';
import type { EdgePress } from './edges.ts';
import { bandAt } from './water.ts';
import { terrainAt, tileBlocks, tileOf } from './zoneMap.ts';
import type { Facing, ZoneMap } from './zoneMap.ts';

export type { TraverseMarks } from '../../content/traverseMarks.ts';

/**
 * Whether it rains where the steerer is (decision S14-60): Stage 13's weather has wind and
 * visibility but no rain yet, so the bog's soft ground reads this fact, set by the weather when
 * rain comes (and by tests and the developer menu until then).
 */
export const FACT_RAINING = 'weather.raining';

/** A tile's position: [x, y]. */
type Tile = readonly [number, number];
interface Point {
  readonly x: number;
  readonly y: number;
}

/** The verb under way, if any (version 15 saves: absent until first used). */
export type TraverseState =
  | {
      readonly verb: 'climb';
      readonly route: string;
      /** Sliding down with the bar empty: from and to (feet y, px). */
      slide?: { readonly from: number; readonly to: number };
    }
  | {
      readonly verb: 'swim';
      /** Empty in deep water: the tick the sinking began. */
      sink?: { readonly since: number; drowning?: boolean };
    }
  | {
      readonly verb: 'jump';
      readonly mark: string;
      readonly from: Point;
      readonly to: Point;
      readonly since: number;
      readonly ticks: number;
    }
  | {
      readonly verb: 'crawl';
      readonly crawl: string;
      /** Distance along its path from its first mouth, px. */
      at: number;
    }
  | {
      readonly verb: 'push';
      readonly object: string;
      readonly from: Tile;
      readonly to: Tile;
      readonly since: number;
      readonly ticks: number;
      /** Where the steerer's feet started, and which way they go (a unit axis). */
      readonly start: Point;
      readonly dir: Tile;
      readonly pull: boolean;
    };

/** What the simulation needs for the verbs (built by src/sim/land/context.ts). */
export interface TraverseContext {
  readonly tb: TraverseBalance;
  /** The region a zone belongs to (where a heavy object's place is kept). */
  readonly regionOf: (zone: Id) => Id | null;
}

export type TraverseEvent =
  | { readonly type: 'CLIMB_STARTED'; readonly route: string; readonly from: 'FOOT' | 'HEAD' }
  | { readonly type: 'CLIMB_ENDED'; readonly route: string; readonly at: 'FOOT' | 'HEAD' }
  | { readonly type: 'CLIMB_SLIPPED'; readonly route: string }
  | {
      readonly type: 'CLIMB_SLID';
      readonly route: string;
      readonly tiles: number;
      readonly vitality: number;
    }
  | { readonly type: 'SWIM_STARTED' }
  | { readonly type: 'SWIM_ENDED' }
  | { readonly type: 'SINKING' }
  | { readonly type: 'DROWNING' }
  | { readonly type: 'SINK_ENDED' }
  | { readonly type: 'DROWNED' }
  | { readonly type: 'JUMPED'; readonly mark: string }
  | { readonly type: 'JUMP_LANDED'; readonly mark: string }
  | { readonly type: 'CRAWL_STARTED'; readonly crawl: string }
  | { readonly type: 'CRAWL_ENDED'; readonly crawl: string }
  | { readonly type: 'GRIPPED'; readonly object: string }
  | { readonly type: 'GRIP_RELEASED'; readonly object: string }
  | {
      readonly type: 'OBJECT_MOVED';
      readonly object: string;
      readonly to: { readonly x: number; readonly y: number };
      readonly pull: boolean;
    }
  /** The steerer drowned: the game is over (fight.ts's STEERER_DIED, for the presentation). */
  | { readonly type: 'STEERER_DIED'; readonly day: number };

export type TraverseRefusal = 'HANDS_FULL' | 'TOO_TIRED' | 'NO_ROOM' | 'NOTHING_THERE';

/** What the steerer would do with Interact at a mark now (the prompt, and the command). */
export type TraverseOffer =
  | { readonly kind: 'climb'; readonly route: string; readonly from: 'FOOT' | 'HEAD' }
  | { readonly kind: 'jump'; readonly mark: string; readonly refusal: TraverseRefusal | null }
  | { readonly kind: 'crawl'; readonly crawl: string; readonly refusal: TraverseRefusal | null }
  | { readonly kind: 'grip'; readonly object: string }
  | { readonly kind: 'gripping'; readonly object: string };

type Land = Pick<LandContext, 'rules' | 'water' | 'elevations' | 'movement'>;

const AXES: Readonly<Record<Facing, Tile>> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

function facingOfAxis(d: Tile): Facing {
  if (d[0] > 0) return 'e';
  if (d[0] < 0) return 'w';
  return d[1] < 0 ? 'n' : 's';
}

/** The unit axis of a vector's larger part, or null when it is too small to count. */
function axisOf(x: number, y: number, least = 0.3): Tile | null {
  if (Math.max(Math.abs(x), Math.abs(y)) < least) return null;
  return Math.abs(x) > Math.abs(y) ? [Math.sign(x), 0] : [0, Math.sign(y)];
}

const feetTile = (map: ZoneMap, p: Point): { tx: number; ty: number } =>
  tileOf(map, p.x, p.y - 0.001);

const inRect = (
  r: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  tx: number,
  ty: number,
): boolean => tx >= r.x && ty >= r.y && tx < r.x + r.w && ty < r.y + r.h;

/** Where feet stand to fill a tile: its centre, the footprint centred in it. */
export function standPoint(map: ZoneMap, land: Pick<Land, 'rules'>, t: Tile): Point {
  return { x: (t[0] + 0.5) * map.tile, y: (t[1] + 0.5) * map.tile + land.rules.footprint.h / 2 };
}

// ---------------------------------------------------------------------------- the climb's line

/** A route's column (feet x) and the feet's y at its foot and its head, px. */
export function climbLine(
  map: ZoneMap,
  land: Pick<Land, 'rules'>,
  c: ClimbMark,
): { x: number; footY: number; headY: number } {
  const T = map.tile;
  return {
    x: (c.x + 0.5) * T,
    footY: c.foot * T + land.rules.footprint.h + 1,
    headY: (c.head + 1) * T - 1,
  };
}

/** Whether feet at y on a route rest: on a ledge's row, or at either end. */
export function climbRests(
  map: ZoneMap,
  land: Pick<Land, 'rules'>,
  c: ClimbMark,
  y: number,
): boolean {
  const line = climbLine(map, land, c);
  if (y >= line.footY - 0.5 || y <= line.headY + 0.5) return true;
  const T = map.tile;
  return c.ledges.some((l) => y > l * T && y <= (l + 1) * T);
}

/** Where a slide from y ends: the nearest ledge below, or the foot. */
export function slideTarget(
  map: ZoneMap,
  land: Pick<Land, 'rules'>,
  c: ClimbMark,
  y: number,
): number {
  const line = climbLine(map, land, c);
  const T = map.tile;
  const below = c.ledges.map((l) => (l + 1) * T - 1).filter((ly) => ly >= y);
  return below.length === 0 ? line.footY : Math.min(...below);
}

// ---------------------------------------------------------------------------- the crawl's path

/** The crawl's path: its first mouth, its tiles, its second mouth, as feet points; and its length. */
export function crawlPath(
  map: ZoneMap,
  land: Pick<Land, 'rules'>,
  c: CrawlMark,
): { points: Point[]; length: number } {
  const [m0, m1] = crawlMouths(c);
  const points = [m0, ...c.tiles, m1].map((t) => standPoint(map, land, t));
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a !== undefined && b !== undefined) length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return { points, length };
}

/** A point at distance s along a path, and the unit direction of the segment either side. */
function along(
  points: readonly Point[],
  s: number,
): { at: Point; ahead: Point | null; behind: Point | null } {
  let left = s;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len + 1e-9 || i === points.length - 1) {
      const k = len < 1e-9 ? 0 : Math.max(0, Math.min(1, left / len));
      const u = len < 1e-9 ? { x: 0, y: 0 } : { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      const at = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      // At a vertex, the segment beyond it is the one ahead.
      const next = points[i + 1];
      const ahead =
        k >= 1 - 1e-9 && next !== undefined
          ? (() => {
              const l2 = Math.hypot(next.x - b.x, next.y - b.y);
              return l2 < 1e-9 ? null : { x: (next.x - b.x) / l2, y: (next.y - b.y) / l2 };
            })()
          : k >= 1 - 1e-9
            ? null
            : u;
      const prev = points[i - 2];
      const behind =
        k <= 1e-9 && prev !== undefined
          ? (() => {
              const l2 = Math.hypot(a.x - prev.x, a.y - prev.y);
              return l2 < 1e-9 ? null : { x: (a.x - prev.x) / l2, y: (a.y - prev.y) / l2 };
            })()
          : k <= 1e-9
            ? null
            : u;
      return { at, ahead, behind };
    }
    left -= len;
  }
  const last = points[points.length - 1] ?? { x: 0, y: 0 };
  return { at: last, ahead: null, behind: null };
}

// ---------------------------------------------------------------------------- heavy objects

const pushKey = (zone: Id, id: string): string => `${zone}/${id}`;

/** Where a heavy object lies now: its saved place, or its line's start. */
export function objectTile(world: WorldState, tctx: TraverseContext, zone: Id, m: PushMark): Tile {
  const region = tctx.regionOf(zone) ?? zone;
  const saved = world.regions[region]?.pushed?.[pushKey(zone, m.id)];
  if (saved !== undefined) return [saved.x, saved.y];
  return m.line[m.start] ?? [0, 0];
}

function setObjectTile(
  world: WorldState,
  tctx: TraverseContext,
  zone: Id,
  m: PushMark,
  t: Tile,
): void {
  const region = tctx.regionOf(zone) ?? zone;
  const r = (world.regions[region] ??= { discoveredZones: [], resourceNodes: {}, puzzles: {} });
  r.pushed ??= {};
  r.pushed[pushKey(zone, m.id)] = { x: t[0], y: t[1] };
}

const lineIndex = (m: PushMark, t: Tile): number =>
  m.line.findIndex((l) => l[0] === t[0] && l[1] === t[1]);

/** The tiles a heavy object fills now (both, while it moves). */
function objectTiles(
  world: WorldState,
  tctx: TraverseContext,
  zone: Id,
  marks: TraverseMarks,
): Tile[] {
  const out: Tile[] = [];
  const moving = world.onFoot?.player.traverse;
  for (const m of marks.pushes) {
    if (moving?.verb === 'push' && moving.object === m.id) out.push(moving.from, moving.to);
    else out.push(objectTile(world, tctx, zone, m));
  }
  return out;
}

/** Each heavy object's drawn place, in tiles (eased along its step while it moves). */
export function objectsView(
  world: WorldState,
  tctx: TraverseContext,
  map: ZoneMap,
): { id: string; sheet: string; frame: string; x: number; y: number }[] {
  const t = world.onFoot?.player.traverse;
  return marksOf(map).pushes.map((m) => {
    let at: Point;
    if (t?.verb === 'push' && t.object === m.id) {
      const k = Math.min(1, (world.tick - t.since) / t.ticks);
      at = { x: t.from[0] + (t.to[0] - t.from[0]) * k, y: t.from[1] + (t.to[1] - t.from[1]) * k };
    } else {
      const o = objectTile(world, tctx, map.zone, m);
      at = { x: o[0], y: o[1] };
    }
    return { id: m.id, sheet: m.sheet, frame: m.frame, x: at.x + 0.5, y: at.y + 1 };
  });
}

// ---------------------------------------------------------------------------- the ground

/** The corners footprintClear reads, for a footprint centred on foot (x, y). */
function corners(land: Pick<Land, 'rules'>, x: number, y: number): [number, number][] {
  const f = land.rules.footprint;
  const l = x - f.w / 2;
  const r = x + f.w / 2 - 0.001;
  const t = y - f.h;
  const b = y - 0.001;
  return [
    [l, t],
    [r, t],
    [l, b],
    [r, b],
  ];
}

function swimTile(marks: TraverseMarks, tx: number, ty: number): boolean {
  return marks.swims.some((s) => inRect(s, tx, ty));
}

/**
 * How the verbs change a step of ordinary movement (stepMovement's extras): marked deep water opens
 * to a swimmer carrying nothing, at swim speed; a heavy object's tiles and a crawl's tiles close to
 * a walker; the bog's soft ground slows in rain.
 */
export function moveExtras(
  world: WorldState,
  map: ZoneMap,
  land: Land,
  tctx: TraverseContext,
  tide: TideNow,
  raining: boolean,
): MoveExtras {
  const onFoot = world.onFoot;
  const marks = marksOf(map);
  if (onFoot === null) return {};
  const carrying = onFoot.carrying !== null;
  const closed = new Set<string>();
  for (const t of objectTiles(world, tctx, map.zone, marks)) closed.add(`${t[0]},${t[1]}`);
  for (const c of marks.crawls) for (const t of c.tiles) closed.add(`${t[0]},${t[1]}`);
  const p = onFoot.player;
  const elevation = land.elevations.get(map.zone);
  const ft = feetTile(map, p);
  const swimming =
    !carrying &&
    elevation !== undefined &&
    swimTile(marks, ft.tx, ft.ty) &&
    bandAt(land.water, elevation, p.x, p.y, tide.level)?.band === 'DEEP';
  const soft = raining && marks.soft.some((s) => inRect(s, ft.tx, ft.ty));
  const overlaps = (x: number, y: number): boolean =>
    corners(land, x, y).some(([cx, cy]) => {
      const t = tileOf(map, cx, cy);
      return closed.has(`${t.tx},${t.ty}`);
    });
  // No trap (decision DG-20): feet already over closed ground are never held by it.
  const already = overlaps(p.x, p.y);
  const out: MoveExtras = {
    ...(closed.size === 0 || already
      ? {}
      : { blocked: (x: number, y: number): boolean => overlaps(x, y) }),
    ...(marks.swims.length === 0 || carrying
      ? {}
      : {
          passable: (x: number, y: number): boolean =>
            corners(land, x, y).every(([cx, cy]) => {
              const { tx, ty } = tileOf(map, cx, cy);
              if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
              if (!tileBlocks(map, tx, ty, tide.open)) return true;
              const ground = terrainAt(map, tx, ty);
              return swimTile(marks, tx, ty) && (ground === 'sea' || ground === 'flats');
            }),
          deepOk: (x: number, y: number): boolean => {
            const t = tileOf(map, x, y - 0.001);
            return swimTile(marks, t.tx, t.ty);
          },
        }),
    ...(swimming ? { swimSpeed: tctx.tb.swimSpeed } : {}),
    ...(soft ? { factor: tctx.tb.bogSoftRain } : {}),
  };
  return out;
}

/** Whether the steerer is in marked deep water now, carrying nothing (the swim). */
function inSwimWater(world: WorldState, map: ZoneMap, land: Land, tide: TideNow): boolean {
  const onFoot = world.onFoot;
  if (onFoot?.carrying !== null) return false;
  const p = onFoot.player;
  const elevation = land.elevations.get(map.zone);
  if (elevation === undefined) return false;
  const ft = feetTile(map, p);
  return (
    swimTile(marksOf(map), ft.tx, ft.ty) &&
    bandAt(land.water, elevation, p.x, p.y, tide.level)?.band === 'DEEP'
  );
}

// ---------------------------------------------------------------------------- per tick

/** Verbs that move the steerer themselves (ordinary movement waits while they run). */
export function ownsMovement(p: OnFootPlayer): boolean {
  const t = p.traverse;
  return t != null && t.verb !== 'swim';
}

/**
 * Actions the steerer cannot take in a verb (Book 2 section 10: no weapon, no carrying, no
 * fighting on a climb, a swim, a jump, a crawl or a push).
 */
export function traversing(p: OnFootPlayer): boolean {
  return p.traverse != null || p.grip != null;
}

function emptyBand(world: WorldState): void {
  const p = world.onFoot?.player;
  if (p === undefined) return;
  p.aim = null;
  p.blocking = false;
}

/**
 * One tick of the verb that moves the steerer, before ordinary movement: a climb or its slide, a
 * jump, a crawl, a push or pull, or holding a heavy object. Returns true when ordinary movement
 * waits this tick.
 */
export function stepTraverse(
  world: WorldState,
  map: ZoneMap,
  land: Land,
  tctx: TraverseContext,
  tide: TideNow,
  emit: (e: TraverseEvent) => void,
): boolean {
  const onFoot = world.onFoot;
  if (onFoot === null) return false;
  const p = onFoot.player;
  const t = p.traverse;
  const T = map.tile;
  const tick = world.tick;
  const marks = marksOf(map);
  if (t == null || t.verb === 'swim') {
    if (p.grip != null) return holdObject(world, map, land, tctx, tide.open, emit);
    return false;
  }
  emptyBand(world);
  switch (t.verb) {
    case 'climb': {
      const c = marks.climbs.find((r) => r.id === t.route);
      if (c === undefined) {
        p.traverse = null;
        return false;
      }
      const line = climbLine(map, land, c);
      p.x = line.x;
      p.facing = 'n';
      p.gait = 'walk';
      if (t.slide !== undefined) {
        const step = (tctx.tb.slide.tilesPerSecond * T) / TICKS_PER_SECOND;
        p.y = Math.min(t.slide.to, p.y + step);
        p.moving = true;
        if (p.y >= t.slide.to - 1e-9) {
          const tiles = (t.slide.to - t.slide.from) / T;
          const lost = Math.round(
            Math.max(0, tiles - tctx.tb.slide.freeTiles) * tctx.tb.slide.vitalityPerTile,
          );
          const before = world.player.vitality;
          const floor = tctx.tb.climbFallFloor;
          world.player.vitality = Math.max(Math.min(before, floor), before - lost);
          delete t.slide;
          emit({
            type: 'CLIMB_SLID',
            route: c.id,
            tiles: Math.round(tiles * 100) / 100,
            vitality: before - world.player.vitality,
          });
          if (p.y >= line.footY - 0.5) {
            p.traverse = null;
            emit({ type: 'CLIMB_ENDED', route: c.id, at: 'FOOT' });
          }
        }
        return true;
      }
      const dy =
        Math.max(-1, Math.min(1, p.intent.y)) * ((tctx.tb.climbSpeed * T) / TICKS_PER_SECOND);
      const y = Math.max(line.headY, Math.min(line.footY, p.y + dy));
      p.moving = Math.abs(y - p.y) > 1e-9;
      p.y = y;
      if (p.vel !== undefined) p.vel = { x: 0, y: 0 };
      if (dy > 0 && y >= line.footY) {
        p.traverse = null;
        p.facing = 's';
        emit({ type: 'CLIMB_ENDED', route: c.id, at: 'FOOT' });
      } else if (dy < 0 && y <= line.headY) {
        p.traverse = null;
        emit({ type: 'CLIMB_ENDED', route: c.id, at: 'HEAD' });
      }
      return true;
    }
    case 'jump': {
      const k = Math.min(1, (tick - t.since) / t.ticks);
      p.x = t.from.x + (t.to.x - t.from.x) * k;
      p.y = t.from.y + (t.to.y - t.from.y) * k;
      p.moving = k < 1;
      if (p.vel !== undefined) p.vel = { x: 0, y: 0 };
      if (k >= 1) {
        p.traverse = null;
        emit({ type: 'JUMP_LANDED', mark: t.mark });
      }
      return true;
    }
    case 'crawl': {
      const c = marks.crawls.find((r) => r.id === t.crawl);
      if (c === undefined) {
        p.traverse = null;
        return false;
      }
      const path = crawlPath(map, land, c);
      const here = along(path.points, t.at);
      const speed = (tctx.tb.crawlSpeed * T) / TICKS_PER_SECOND;
      const fwd = here.ahead === null ? 0 : p.intent.x * here.ahead.x + p.intent.y * here.ahead.y;
      const back =
        here.behind === null ? 0 : -(p.intent.x * here.behind.x + p.intent.y * here.behind.y);
      const move = fwd > 0.2 && fwd >= back ? fwd * speed : back > 0.2 ? -back * speed : 0;
      // At either end, a way out of the mouth leaves the crawl (it is backed out of at any point).
      const atStart = t.at <= 1e-6 && here.ahead !== null;
      const atEnd = t.at >= path.length - 1e-6 && here.behind !== null;
      const out =
        (atStart &&
          here.ahead !== null &&
          -(p.intent.x * here.ahead.x + p.intent.y * here.ahead.y) > 0.2) ||
        (atEnd &&
          here.behind !== null &&
          p.intent.x * here.behind.x + p.intent.y * here.behind.y > 0.2);
      // Out only onto ground that can be stood on now (a mouth the tide has closed waits).
      if (out && footprintClear(map, land.rules, here.at.x, here.at.y, tide.open)) {
        p.traverse = null;
        p.gait = 'walk';
        p.moving = false;
        emit({ type: 'CRAWL_ENDED', crawl: c.id });
        return true;
      }
      const was = t.at;
      t.at = Math.max(0, Math.min(path.length, t.at + move));
      if (t.at >= path.length - 1e-6) t.at = path.length;
      if (t.at <= 1e-6) t.at = 0;
      const now = along(path.points, t.at);
      p.x = now.at.x;
      p.y = now.at.y;
      p.gait = 'sneak';
      p.moving = Math.abs(t.at - was) > 1e-9;
      if (p.vel !== undefined) p.vel = { x: 0, y: 0 };
      const dir = move > 0 ? now.ahead : move < 0 ? now.behind : null;
      if (dir !== null && p.moving)
        p.facing = facingOfAxis(
          axisOf(move > 0 ? dir.x : -dir.x, move > 0 ? dir.y : -dir.y, 0) ?? [0, 1],
        );
      return true;
    }
    case 'push': {
      const m = marks.pushes.find((r) => r.id === t.object);
      const k = Math.min(1, (tick - t.since) / t.ticks);
      p.x = t.start.x + t.dir[0] * T * k;
      p.y = t.start.y + t.dir[1] * T * k;
      p.moving = k < 1;
      p.facing = facingOfAxis(t.pull ? [-t.dir[0], -t.dir[1]] : t.dir);
      if (p.vel !== undefined) p.vel = { x: 0, y: 0 };
      if (k >= 1) {
        p.traverse = null;
        if (m !== undefined) setObjectTile(world, tctx, map.zone, m, t.to);
        emit({
          type: 'OBJECT_MOVED',
          object: t.object,
          to: { x: t.to[0], y: t.to[1] },
          pull: t.pull,
        });
      }
      return true;
    }
  }
}

/**
 * Holding a heavy object (Interact held): facing it, the feet planted; stepping back from it pulls
 * it a tile, walking into it pushes it.
 */
function holdObject(
  world: WorldState,
  map: ZoneMap,
  land: Land,
  tctx: TraverseContext,
  tideOpen: boolean,
  emit: (e: TraverseEvent) => void,
): boolean {
  const onFoot = world.onFoot;
  if (onFoot === null) return false;
  const p = onFoot.player;
  const m = marksOf(map).pushes.find((r) => r.id === p.grip);
  const near = m === undefined ? null : adjacentObject(world, map, tctx, m);
  if (m === undefined || near === null || onFoot.carrying !== null) {
    const object = p.grip ?? '';
    p.grip = null;
    emit({ type: 'GRIP_RELEASED', object });
    return false;
  }
  p.facing = facingOfAxis(near.d);
  p.moving = false;
  if (p.vel !== undefined) p.vel = { x: 0, y: 0 };
  emptyBand(world);
  const want = axisOf(p.intent.x, p.intent.y);
  if (want !== null && want[0] === -near.d[0] && want[1] === -near.d[1])
    startMove(world, map, land, tctx, m, near.o, near.d, true, tideOpen);
  else if (want !== null && want[0] === near.d[0] && want[1] === near.d[1])
    startMove(world, map, land, tctx, m, near.o, near.d, false, tideOpen);
  return true;
}

/** A heavy object beside the steerer's feet tile, by a side: its tile and the way to it. */
function adjacentObject(
  world: WorldState,
  map: ZoneMap,
  tctx: TraverseContext,
  m: PushMark,
): { o: Tile; d: Tile } | null {
  const p = world.onFoot?.player;
  if (p === undefined) return null;
  const ft = feetTile(map, p);
  const o = objectTile(world, tctx, map.zone, m);
  const d: Tile = [o[0] - ft.tx, o[1] - ft.ty];
  return Math.abs(d[0]) + Math.abs(d[1]) === 1 ? { o, d } : null;
}

/** Nobody's footprint (the steerer's or anyone's in the zone) lies on a tile. */
function tileFree(onFoot: OnFootState, map: ZoneMap, land: Pick<Land, 'rules'>, t: Tile): boolean {
  const T = map.tile;
  const f = land.rules.footprint;
  const hits = (x: number, y: number): boolean =>
    x + f.w / 2 > t[0] * T &&
    x - f.w / 2 < (t[0] + 1) * T &&
    y > t[1] * T &&
    y - f.h < (t[1] + 1) * T;
  if (hits(onFoot.player.x, onFoot.player.y)) return false;
  return !Object.values(onFoot.actors).some((a) => a.pose !== 'carried' && hits(a.x, a.y));
}

/**
 * Starts a push (walking into it, the steerer stepping on behind it) or a pull (stepping back from
 * it, it following): one tile along its line at pushSpeed. Refused, nothing happens: off its line,
 * onto anyone, without its fact, with the bar empty (Book 10 needsStamina), or, pulling, with no
 * ground to step back onto.
 */
function startMove(
  world: WorldState,
  map: ZoneMap,
  land: Land,
  tctx: TraverseContext,
  m: PushMark,
  o: Tile,
  d: Tile,
  pull: boolean,
  tideOpen: boolean,
): boolean {
  const onFoot = world.onFoot;
  if (onFoot?.carrying !== null) return false;
  const p = onFoot.player;
  if (m.fact !== undefined && world.facts[m.fact] !== true) return false;
  if (world.player.stamina.current <= 0) return false;
  const i = lineIndex(m, o);
  const to: Tile = pull ? [o[0] - d[0], o[1] - d[1]] : [o[0] + d[0], o[1] + d[1]];
  const j = lineIndex(m, to);
  if (i < 0 || j < 0 || Math.abs(i - j) !== 1) return false;
  const T = map.tile;
  if (pull) {
    // The steerer steps back a tile: that ground must be clear (and not another object's).
    const x = p.x - d[0] * T;
    const y = p.y - d[1] * T;
    if (!footprintClear(map, land.rules, x, y, tideOpen)) return false;
    const ex = moveExtras(world, map, land, tctx, { open: tideOpen, level: 0 }, false);
    if (ex.blocked?.(x, y) === true) return false;
  } else {
    if (!tileFree(onFoot, map, land, to)) return false;
    // Nothing else stands there: another object.
    const others = marksOf(map).pushes.filter((r) => r.id !== m.id);
    if (
      others.some((r) => {
        const t = objectTile(world, tctx, map.zone, r);
        return t[0] === to[0] && t[1] === to[1];
      })
    )
      return false;
  }
  const dir: Tile = pull ? [-d[0], -d[1]] : d;
  p.traverse = {
    verb: 'push',
    object: m.id,
    from: o,
    to,
    since: world.tick,
    ticks: Math.max(1, Math.round(TICKS_PER_SECOND / tctx.tb.pushSpeed)),
    start: { x: p.x, y: p.y },
    dir,
    pull,
  };
  return true;
}

/**
 * After ordinary movement: a walk pressed into a climb's foot or head, a crawl's mouth or a heavy
 * object starts that verb; marked deep water begins or ends a swim; a sinking swimmer drowns.
 */
export function afterMove(
  world: WorldState,
  map: ZoneMap,
  land: Land,
  tctx: TraverseContext,
  tide: TideNow,
  press: EdgePress | null,
  emit: (e: TraverseEvent) => void,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const p = onFoot.player;
  const marks = marksOf(map);
  if (!ownsMovement(p) && p.grip == null && press !== null && onFoot.carrying === null) {
    const d = axisOf(press.x, press.y, 0.5);
    const ft = feetTile(map, p);
    if (d !== null) {
      const ahead: Tile = [ft.tx + d[0], ft.ty + d[1]];
      const climb = marks.climbs.find(
        (c) => c.x === ft.tx && ((d[1] < 0 && c.foot === ft.ty) || (d[1] > 0 && c.head === ft.ty)),
      );
      if (climb !== undefined)
        startClimb(world, map, land, climb, d[1] < 0 ? 'FOOT' : 'HEAD', emit);
      else {
        const crawl = marks.crawls.find((c) => crawlEnd(c, [ft.tx, ft.ty], ahead) !== null);
        if (crawl !== undefined) startCrawl(world, map, land, crawl, [ft.tx, ft.ty], emit);
        else {
          const m = marks.pushes.find((r) => {
            const o = objectTile(world, tctx, map.zone, r);
            return o[0] === ahead[0] && o[1] === ahead[1];
          });
          if (m !== undefined) startMove(world, map, land, tctx, m, ahead, d, false, tide.open);
        }
      }
    }
  }
  // The swim begins and ends with marked deep water at the feet.
  const t = p.traverse;
  const deep = !ownsMovement(p) && inSwimWater(world, map, land, tide);
  if (deep && t == null) {
    p.traverse = { verb: 'swim' };
    p.aim = null;
    p.blocking = false;
    emit({ type: 'SWIM_STARTED' });
  } else if (!deep && t?.verb === 'swim') {
    if (t.sink !== undefined) emit({ type: 'SINK_ENDED' });
    p.traverse = null;
    emit({ type: 'SWIM_ENDED' });
  }
  stepSinking(world, tctx, emit);
}

/** Sinking: after Book 10's seconds without reaching the waist band, drowning at its rate. */
function stepSinking(
  world: WorldState,
  tctx: TraverseContext,
  emit: (e: TraverseEvent) => void,
): void {
  const t = world.onFoot?.player.traverse;
  if (t?.verb !== 'swim' || t.sink === undefined || world.gameOver !== null) return;
  if (world.tick - t.sink.since < Math.round(tctx.tb.sink.seconds * TICKS_PER_SECOND)) return;
  if (t.sink.drowning !== true) {
    t.sink.drowning = true;
    emit({ type: 'DROWNING' });
  }
  world.player.vitality = Math.max(
    0,
    world.player.vitality - tctx.tb.sink.drownPerSecond / TICKS_PER_SECOND,
  );
  if (world.player.vitality <= 0) {
    // Drowning is death; the steerer's is game over (Book 1 section 09).
    world.gameOver = { day: world.calendar.day, tick: world.tick, cause: 'DROWNED' };
    emit({ type: 'DROWNED' });
    emit({ type: 'STEERER_DIED', day: world.calendar.day });
  }
}

/** Which end of a crawl a mouth tile and the tile ahead of it open onto (0 or 1), or null. */
function crawlEnd(c: CrawlMark, mouth: Tile, ahead: Tile): 0 | 1 | null {
  const [m0, m1] = crawlMouths(c);
  const first = c.tiles[0];
  const last = c.tiles[c.tiles.length - 1];
  const same = (a: Tile | undefined, b: Tile): boolean => a?.[0] === b[0] && a[1] === b[1];
  if (same(m0, mouth) && same(first, ahead)) return 0;
  if (same(m1, mouth) && same(last, ahead)) return 1;
  return null;
}

function startClimb(
  world: WorldState,
  map: ZoneMap,
  land: Pick<Land, 'rules'>,
  c: ClimbMark,
  from: 'FOOT' | 'HEAD',
  emit: (e: TraverseEvent) => void,
): void {
  const p = world.onFoot?.player;
  if (p === undefined) return;
  const line = climbLine(map, land, c);
  p.x = line.x;
  p.y = from === 'FOOT' ? line.footY : line.headY;
  p.facing = 'n';
  p.aim = null;
  p.blocking = false;
  p.traverse = { verb: 'climb', route: c.id };
  if (p.vel !== undefined) p.vel = { x: 0, y: 0 };
  emit({ type: 'CLIMB_STARTED', route: c.id, from });
}

function startCrawl(
  world: WorldState,
  map: ZoneMap,
  land: Pick<Land, 'rules'>,
  c: CrawlMark,
  mouth: Tile,
  emit: (e: TraverseEvent) => void,
): void {
  const p = world.onFoot?.player;
  if (p === undefined) return;
  const path = crawlPath(map, land, c);
  const [m0] = crawlMouths(c);
  const at = m0[0] === mouth[0] && m0[1] === mouth[1] ? 0 : path.length;
  const here = along(path.points, at);
  p.x = here.at.x;
  p.y = here.at.y;
  p.aim = null;
  p.blocking = false;
  p.gait = 'sneak';
  p.traverse = { verb: 'crawl', crawl: c.id, at };
  if (p.vel !== undefined) p.vel = { x: 0, y: 0 };
  emit({ type: 'CRAWL_STARTED', crawl: c.id });
}

// ---------------------------------------------------------------------------- stamina

/** What the verbs drain this tick (Book 10 "Stamina in traversal"), for traversalTick. */
export function traverseDrains(
  world: WorldState,
  map: ZoneMap,
  land: Pick<Land, 'rules'>,
  tctx: TraverseContext,
): { climbing: boolean; swimming: boolean; pushPerSecond: number; noRegen: boolean } {
  const p = world.onFoot?.player;
  const t = p?.traverse;
  if (p === undefined || t == null)
    return { climbing: false, swimming: false, pushPerSecond: 0, noRegen: false };
  if (t.verb === 'climb') {
    const c = marksOf(map).climbs.find((r) => r.id === t.route);
    const rest = c === undefined || climbRests(map, land, c, p.y);
    const sliding = t.slide !== undefined;
    // On the face the bar drains and never refills (Regeneration: 0 while climbing).
    return { climbing: !rest && !sliding, swimming: false, pushPerSecond: 0, noRegen: !rest };
  }
  if (t.verb === 'swim')
    return { climbing: false, swimming: true, pushPerSecond: 0, noRegen: true };
  if (t.verb === 'push')
    return { climbing: false, swimming: false, pushPerSecond: tctx.tb.pushStamina, noRegen: false };
  return { climbing: false, swimming: false, pushPerSecond: 0, noRegen: false };
}

/**
 * The bar ran empty in a verb: on the face of a climb, the slide begins (climbEmpty); in deep
 * water, the sinking (swimEmpty).
 */
export function traverseEmptied(
  world: WorldState,
  map: ZoneMap,
  land: Pick<Land, 'rules'>,
  emptied: { readonly climb?: boolean; readonly swim?: boolean },
  emit: (e: TraverseEvent) => void,
): void {
  const p = world.onFoot?.player;
  const t = p?.traverse;
  if (p === undefined || t == null) return;
  if (emptied.climb === true && t.verb === 'climb' && t.slide === undefined) {
    const c = marksOf(map).climbs.find((r) => r.id === t.route);
    if (c === undefined || climbRests(map, land, c, p.y)) return;
    t.slide = { from: p.y, to: slideTarget(map, land, c, p.y) };
    emit({ type: 'CLIMB_SLIPPED', route: c.id });
  }
  if (emptied.swim === true && t.verb === 'swim' && t.sink === undefined) {
    t.sink = { since: world.tick };
    emit({ type: 'SINKING' });
  }
}

// ---------------------------------------------------------------------------- Interact

/** What Interact would do at a mark now: the nearest climb end, jump, crawl mouth or object. */
export function traverseOffer(
  world: WorldState,
  map: ZoneMap,
  land: Pick<Land, 'rules'>,
  tctx: TraverseContext,
): TraverseOffer | null {
  const onFoot = world.onFoot;
  if (onFoot === null) return null;
  const p = onFoot.player;
  if (p.grip != null) return { kind: 'gripping', object: p.grip };
  if (p.traverse != null) return null;
  const marks = marksOf(map);
  const ft = feetTile(map, p);
  const reach = land.rules.interactRadiusTiles * map.tile;
  const carrying = onFoot.carrying !== null;
  for (const c of marks.climbs) {
    if (carrying || c.x !== ft.tx) continue;
    if (c.foot === ft.ty) return { kind: 'climb', route: c.id, from: 'FOOT' };
    if (c.head === ft.ty) return { kind: 'climb', route: c.id, from: 'HEAD' };
  }
  let best: { offer: TraverseOffer; d: number } | null = null;
  const consider = (offer: TraverseOffer, at: Point): void => {
    const d = Math.hypot(at.x - p.x, at.y - p.y);
    if (d <= reach && (best === null || d < best.d)) best = { offer, d };
  };
  for (const j of marks.jumps) {
    for (const [end, other] of [
      [j.from, j.to],
      ...(j.oneWay === true ? [] : [[j.to, j.from] as const]),
    ] as const) {
      const at = standPoint(map, land, [end.x, end.y]);
      const land2 = standPoint(map, land, [other.x, other.y]);
      const refusal: TraverseRefusal | null = carrying
        ? 'HANDS_FULL'
        : world.player.stamina.current < tctx.tb.jumpStamina
          ? 'TOO_TIRED'
          : !footprintClear(map, land.rules, land2.x, land2.y, true) ||
              !tileFree(onFoot, map, land, [other.x, other.y])
            ? 'NO_ROOM'
            : null;
      consider({ kind: 'jump', mark: `${j.id}:${end === j.from ? 'a' : 'b'}`, refusal }, at);
    }
  }
  for (const c of marks.crawls) {
    const mouths = crawlMouths(c);
    for (const m of mouths) {
      if (m[0] !== ft.tx || m[1] !== ft.ty) continue;
      consider(
        { kind: 'crawl', crawl: c.id, refusal: carrying ? 'HANDS_FULL' : null },
        standPoint(map, land, m),
      );
    }
  }
  if (!carrying)
    for (const m of marks.pushes) {
      if (m.fact !== undefined && world.facts[m.fact] !== true) continue;
      const near = adjacentObject(world, map, tctx, m);
      if (near !== null) consider({ kind: 'grip', object: m.id }, standPoint(map, land, near.o));
    }
  return (best as { offer: TraverseOffer; d: number } | null)?.offer ?? null;
}

/**
 * Interact at a mark: starts a climb, a jump or a crawl, or takes hold of a heavy object. Returns
 * null when nothing is marked within reach, else the refusal (null inside when it started).
 */
export function traverseInteract(
  world: WorldState,
  map: ZoneMap,
  land: Land,
  tctx: TraverseContext,
  emit: (e: TraverseEvent) => void,
): { refusal: TraverseRefusal | null } | null {
  const offer = traverseOffer(world, map, land, tctx);
  const onFoot = world.onFoot;
  if (offer === null || onFoot === null) return null;
  const p = onFoot.player;
  const marks = marksOf(map);
  switch (offer.kind) {
    case 'climb': {
      const c = marks.climbs.find((r) => r.id === offer.route);
      if (c !== undefined) startClimb(world, map, land, c, offer.from, emit);
      return { refusal: null };
    }
    case 'jump': {
      if (offer.refusal !== null) return { refusal: offer.refusal };
      const [id, end] = offer.mark.split(':');
      const j = marks.jumps.find((r) => r.id === id);
      if (j === undefined) return null;
      const to = end === 'a' ? j.to : j.from;
      const at = standPoint(map, land, [to.x, to.y]);
      const st = world.player.stamina;
      st.current = Math.max(0, st.current - tctx.tb.jumpStamina);
      st.spentTick = world.tick;
      const dist = Math.hypot(at.x - p.x, at.y - p.y);
      const perTick = (land.movement.run * map.tile) / TICKS_PER_SECOND;
      p.traverse = {
        verb: 'jump',
        mark: j.id,
        from: { x: p.x, y: p.y },
        to: at,
        since: world.tick,
        ticks: Math.max(1, Math.ceil(dist / perTick)),
      };
      p.facing = facingOfAxis(axisOf(at.x - p.x, at.y - p.y, 0) ?? AXES[p.facing]);
      p.aim = null;
      p.blocking = false;
      emit({ type: 'JUMPED', mark: j.id });
      return { refusal: null };
    }
    case 'crawl': {
      if (offer.refusal !== null) return { refusal: offer.refusal };
      const c = marks.crawls.find((r) => r.id === offer.crawl);
      const ft = feetTile(map, p);
      if (c !== undefined) startCrawl(world, map, land, c, [ft.tx, ft.ty], emit);
      return { refusal: null };
    }
    case 'grip':
      p.grip = offer.object;
      emit({ type: 'GRIPPED', object: offer.object });
      return { refusal: null };
    case 'gripping':
      return { refusal: null };
  }
}

/** Interact let go (or held, from a bot): the hold on a heavy object ends or begins. */
export function setGrip(
  world: WorldState,
  map: ZoneMap,
  land: Land,
  tctx: TraverseContext,
  on: boolean,
  emit: (e: TraverseEvent) => void,
): void {
  const p = world.onFoot?.player;
  if (p === undefined) return;
  if (!on) {
    if (p.grip != null) {
      const object = p.grip;
      p.grip = null;
      emit({ type: 'GRIP_RELEASED', object });
    }
    return;
  }
  const offer = traverseOffer(world, map, land, tctx);
  if (offer?.kind === 'grip') {
    p.grip = offer.object;
    emit({ type: 'GRIPPED', object: offer.object });
  }
}

/** The animation a verb plays (Book 7 section 01; the Stage 14 people frames), or null. */
export function traverseAnim(p: OnFootPlayer): string | null {
  const t = p.traverse;
  if (t == null) return p.grip != null ? 'pull' : null;
  switch (t.verb) {
    case 'climb':
      return 'climb';
    case 'swim':
      return t.sink === undefined ? 'swim' : 'sink';
    case 'jump':
      return 'jump';
    case 'crawl':
      return 'crawl';
    case 'push':
      return t.pull ? 'pull' : 'push';
  }
}
