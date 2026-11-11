/**
 * Missiles (Book 10 section 21, "Missiles" and "Arrows"; decisions DD-7 to DD-9): every shot is a
 * projectile in the simulation with travel time, a slight arc, a deterministic spread from the
 * draw, and what it meets on the way: people (it sticks in the body), a raised shield from the
 * front, cover (stone and the wreck's timber stop every missile; low cover only near the ground),
 * and at the end of its flight the ground (it sticks) or water (it is lost). At rest it may be
 * pulled free and used again, or it broke: the Book 10 shares, drawn on the `combat` stream.
 *
 * Positions are world pixels; heights are pixels above the ground track. Pure and deterministic:
 * the simulation calls these once per 60 Hz tick.
 */
import type {
  ArrowBalance,
  MissileBalance,
  MissileRest,
  WaterBalance,
} from '../../content/balance.ts';
import type { Elevation } from '../../content/terrain/elevation.ts';
import type { Id } from '../../core/ids.ts';
import { nextFloat } from '../../core/rng.ts';
import type { RngState } from '../../core/rng.ts';
import { TICKS_PER_SECOND } from './onFoot.ts';
import type {
  Aim,
  MissileKind,
  MissileStrike,
  OnFootRules,
  OnFootState,
  Projectile,
} from './onFoot.ts';
import { bandAt } from './water.ts';
import { terrainAt, tileOf } from './zoneMap.ts';
import type { ZoneMap } from './zoneMap.ts';

/** Missiles are drawn in 16 directions (0 east, clockwise; y runs south). */
export const MISSILE_DIRECTIONS = 16;

/** The steerer's id as a shooter and a target. */
export const STEERER: Id = 'P_STEERER';

export interface MissileContext {
  readonly rules: OnFootRules;
  readonly missiles: MissileBalance;
  readonly arrows: ArrowBalance;
  readonly water: WaterBalance;
  readonly elevations: ReadonlyMap<Id, Elevation>;
}

/** The nearest of the 16 directions to a vector. */
export function direction16(x: number, y: number): number {
  const a = Math.atan2(y, x);
  const step = (2 * Math.PI) / MISSILE_DIRECTIONS;
  return ((Math.round(a / step) % MISSILE_DIRECTIONS) + MISSILE_DIRECTIONS) % MISSILE_DIRECTIONS;
}

/** The weapon a missile kind is loosed from (Book 10 section 06). */
export function weaponOf(kind: MissileKind, m: MissileBalance): MissileBalance['bow'] {
  return kind === 'arrow' ? m.bow : m.spear;
}

/** Tiles per second. */
export function speedOf(kind: MissileKind, m: MissileBalance): number {
  return kind === 'arrow' ? m.arrowSpeed : m.spearSpeed;
}

/**
 * Degrees either side of the aim for a draw held `drawTicks`: spreadQuickDraw at the minimum draw,
 * narrowing evenly to the full-draw spread at the weapon's full draw (Book 10 section 21).
 */
export function spreadDegrees(kind: MissileKind, drawTicks: number, m: MissileBalance): number {
  const full = kind === 'arrow' ? m.spreadFullDraw.bow : m.spreadFullDraw.spear;
  const fullTicks = weaponOf(kind, m).drawTicks;
  const span = Math.max(1, fullTicks - m.minDrawTicks);
  const k = Math.max(0, Math.min(1, (drawTicks - m.minDrawTicks) / span));
  return m.spreadQuickDraw + (full - m.spreadQuickDraw) * k;
}

const round4096 = (v: number): number => Math.round(v * 4096) / 4096;

/**
 * Looses a missile from `from` (the shooter's feet) along `aim`, after a draw of `drawTicks`. The
 * shot flies to the aim point (at least a tile out) or, with no aim point, on to the weapon's full
 * range, and falls. The spread is one draw on the `combat` stream.
 */
export function launch(
  onFoot: OnFootState,
  rng: RngState,
  ctx: Pick<MissileContext, 'missiles'>,
  tile: number,
  shooter: Id,
  from: { readonly x: number; readonly y: number },
  aim: Aim,
  kind: MissileKind,
  drawTicks: number,
): Projectile {
  const m = ctx.missiles;
  const spread = (spreadDegrees(kind, drawTicks, m) * Math.PI) / 180;
  const offset = (nextFloat(rng) * 2 - 1) * spread;
  const a = Math.atan2(aim.y, aim.x) + offset;
  const full = weaponOf(kind, m).reachTiles * tile;
  const length = aim.dist === null ? full : Math.max(tile, Math.min(full, aim.dist * tile));
  const perTick = (speedOf(kind, m) * tile) / TICKS_PER_SECOND;
  const projectile: Projectile = {
    n: onFoot.nextMissile++,
    kind,
    shooter,
    x0: from.x,
    y0: from.y,
    ux: round4096(Math.cos(a)),
    uy: round4096(Math.sin(a)),
    length,
    ticks: Math.max(1, Math.round(length / perTick)),
    apex: m.arcApexTiles * tile * (length / full),
    t: 0,
    x: from.x,
    y: from.y,
    z: 0,
  };
  onFoot.projectiles.push(projectile);
  return projectile;
}

/** Where a projectile is at a fraction `f` of its flight: on its ground track, and its arc height. */
export function flightAt(p: Projectile, f: number): { x: number; y: number; z: number } {
  return {
    x: p.x0 + p.ux * p.length * f,
    y: p.y0 + p.uy * p.length * f,
    z: 4 * p.apex * f * (1 - f),
  };
}

/** How high above the ground a missile is drawn: its arc, plus the hand's height fading out. */
export function drawnHeight(p: Projectile, releaseHeight: number): number {
  const f = p.ticks > 0 ? p.t / p.ticks : 1;
  return p.z + releaseHeight * (1 - f);
}

export interface MissileEvent {
  readonly type: 'MISSILE_STRUCK';
  readonly n: number;
  readonly kind: MissileKind;
  readonly strike: MissileStrike;
  /** The point it came to rest (world pixels, on the ground). */
  readonly x: number;
  readonly y: number;
  readonly broken: boolean;
  readonly target?: Id;
}

/** Which recovery share applies where a missile came to rest (Book 10 section 21, "Arrows"). */
export function restOf(strike: MissileStrike): MissileRest {
  switch (strike) {
    case 'ground':
    case 'wood':
      return 'ground';
    case 'stone':
      return 'stone';
    case 'body':
      return 'body';
    case 'shield':
      return 'shield';
    case 'water':
      return 'water';
  }
}

interface Strike {
  readonly strike: MissileStrike;
  readonly x: number;
  readonly y: number;
  /** Height above the ground where it sits. */
  readonly h: number;
  readonly target?: Id;
}

/** Game minutes since the campaign began. */
export function gameMinute(calendar: {
  readonly day: number;
  readonly minuteOfDay: number;
}): number {
  return (calendar.day - 1) * 1440 + calendar.minuteOfDay;
}

/**
 * The angle between a shield's facing and where a missile comes from, against the shield's arc:
 * the missile travels along (ux, uy), so it comes from (-ux, -uy).
 */
export function shieldStops(
  facing: 's' | 'n' | 'e' | 'w',
  ux: number,
  uy: number,
  arcDegrees: number,
): boolean {
  const [fx, fy] = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[facing] as [number, number];
  const cos = -(fx * ux + fy * uy) / Math.max(1e-9, Math.hypot(ux, uy));
  return cos >= Math.cos(((arcDegrees / 2) * Math.PI) / 180) - 1e-9;
}

/** What a missile at (x, y), arc height z, meets there, if anything (people first, then cover). */
function strikeAt(
  onFoot: OnFootState,
  map: ZoneMap,
  ctx: MissileContext,
  p: Projectile,
  x: number,
  y: number,
  z: number,
  h: number,
  before: { readonly x: number; readonly y: number },
): Strike | null {
  const box = ctx.rules.missileHitBox;
  const people: [
    Id,
    { x: number; y: number; facing: 's' | 'n' | 'e' | 'w'; blocking?: boolean },
  ][] = [];
  if (p.shooter !== STEERER) people.push([STEERER, onFoot.player]);
  for (const [id, a] of Object.entries(onFoot.actors).sort(([a], [b]) => (a < b ? -1 : 1)))
    if (id !== p.shooter && a.pose !== 'carried') people.push([id, a]);
  for (const [id, who] of people) {
    if (Math.abs(x - who.x) > box.w / 2 || y > who.y + 0.5 || y < who.y - box.h) continue;
    const blocked =
      who.blocking === true && shieldStops(who.facing, p.ux, p.uy, ctx.missiles.shieldArcDegrees);
    const at = Math.max(6, Math.min(34, h));
    return { strike: blocked ? 'shield' : 'body', x: x - who.x, y: y - who.y, h: at, target: id };
  }
  // Cover: stone and banks in the terrain, and props that stop missiles.
  const { tx, ty } = tileOf(map, x, y);
  const terrain = terrainAt(map, tx, ty);
  const low = z < ctx.missiles.lowCoverTiles * map.tile;
  if (terrain === 'rock') return { strike: 'stone', x: before.x, y: before.y, h: 0 };
  if (terrain === 'bank' && low) return { strike: 'ground', x, y, h: 0 };
  for (const prop of map.props) {
    const cover = ctx.rules.cover[prop.sheet];
    if (cover === undefined || (!cover.tall && !low)) continue;
    const px = prop.x * map.tile;
    const py = prop.y * map.tile;
    if (Math.abs(x - px) > cover.w / 2 || y > py || y < py - cover.h) continue;
    return cover.material === 'stone'
      ? { strike: 'stone', x: before.x, y: before.y, h: 0 }
      : { strike: 'wood', x, y, h: Math.max(2, Math.min(18, h)) };
  }
  return null;
}

/** Where a missile that reached the end of its flight lands: water, or the ground. */
function landAt(map: ZoneMap, ctx: MissileContext, level: number, x: number, y: number): Strike {
  const { tx, ty } = tileOf(map, x, y);
  const terrain = terrainAt(map, tx, ty);
  if (terrain === 'sea' || terrain === 'stream') return { strike: 'water', x, y, h: 0 };
  if (terrain === 'rock') return { strike: 'stone', x, y, h: 0 };
  const elevation = ctx.elevations.get(map.zone);
  const band = elevation === undefined ? null : bandAt(ctx.water, elevation, x, y, level);
  if (band !== null && band.band !== 'WET') return { strike: 'water', x, y, h: 0 };
  return { strike: 'ground', x, y, h: 0 };
}

/** Advances every missile in flight by one tick, bringing to rest those that strike or land. */
export function stepProjectiles(
  onFoot: OnFootState,
  rng: RngState,
  map: ZoneMap,
  ctx: MissileContext,
  level: number,
  now: number,
  emit: (event: MissileEvent) => void,
): void {
  if (onFoot.projectiles.length === 0) return;
  const flying: Projectile[] = [];
  for (const p of onFoot.projectiles) {
    const before = { x: p.x, y: p.y, z: p.z };
    p.t = Math.min(p.ticks, p.t + 1);
    const at = flightAt(p, p.t / p.ticks);
    p.x = at.x;
    p.y = at.y;
    p.z = at.z;
    // Sample the tick's path every 2 px or less, so nothing thin is flown through.
    const steps = Math.max(1, Math.ceil(Math.hypot(at.x - before.x, at.y - before.y) / 2));
    let hit: Strike | null = null;
    let last = { x: before.x, y: before.y };
    for (let k = 1; k <= steps && hit === null; k++) {
      const s = k / steps;
      const x = before.x + (at.x - before.x) * s;
      const y = before.y + (at.y - before.y) * s;
      const z = before.z + (at.z - before.z) * s;
      const f = (p.t - 1 + s) / p.ticks;
      const h = z + ctx.rules.releaseHeightPx * (1 - f);
      hit = strikeAt(onFoot, map, ctx, p, x, y, z, h, last);
      last = { x, y };
    }
    if (hit === null && p.t >= p.ticks) hit = landAt(map, ctx, level, at.x, at.y);
    if (hit === null) {
      flying.push(p);
      continue;
    }
    rest(onFoot, rng, ctx, p, hit, now, emit);
  }
  onFoot.projectiles = flying;
}

function rest(
  onFoot: OnFootState,
  rng: RngState,
  ctx: MissileContext,
  p: Projectile,
  hit: Strike,
  now: number,
  emit: (event: MissileEvent) => void,
): void {
  const share =
    p.kind === 'spear' ? (hit.strike === 'water' ? 0 : 1) : ctx.arrows.recover[restOf(hit.strike)];
  // Only a real chance draws on the stream: a sure outcome leaves it untouched.
  const broken = share <= 0 ? true : share >= 1 ? false : nextFloat(rng) >= share;
  const target = hit.target;
  const worldX = target === undefined ? hit.x : hit.x + (personAt(onFoot, target)?.x ?? 0);
  const worldY = target === undefined ? hit.y : hit.y + (personAt(onFoot, target)?.y ?? 0);
  emit({
    type: 'MISSILE_STRUCK',
    n: p.n,
    kind: p.kind,
    strike: hit.strike,
    x: worldX,
    y: worldY,
    broken: hit.strike === 'water' ? true : broken,
    ...(target === undefined ? {} : { target }),
  });
  if (hit.strike === 'water') return;
  onFoot.stuck.push({
    n: p.n,
    kind: p.kind,
    x: hit.x,
    y: hit.y,
    h: hit.h,
    dir: direction16(p.ux, p.uy),
    in: hit.strike,
    ...(target === undefined ? {} : { target }),
    broken,
    at: now,
  });
  while (onFoot.stuck.length > ctx.missiles.stuckMax) onFoot.stuck.shift();
}

function personAt(onFoot: OnFootState, id: Id): { x: number; y: number } | undefined {
  return id === STEERER ? onFoot.player : onFoot.actors[id];
}

/** Missiles in the ground go after Book 10's day; those in props and bodies stay. */
export function expireStuck(
  onFoot: OnFootState,
  ctx: Pick<MissileContext, 'missiles'>,
  now: number,
): void {
  const life = ctx.missiles.stuckGroundDays * 1440;
  if (onFoot.stuck.some((s) => s.in === 'ground' && now - s.at >= life))
    onFoot.stuck = onFoot.stuck.filter((s) => s.in !== 'ground' || now - s.at < life);
}

/** The flight time in ticks for a missile flown `tiles` tiles (Book 10 speeds). */
export function flightTicks(kind: MissileKind, tiles: number, m: MissileBalance): number {
  return Math.max(1, Math.round((tiles * TICKS_PER_SECOND) / speedOf(kind, m)));
}
