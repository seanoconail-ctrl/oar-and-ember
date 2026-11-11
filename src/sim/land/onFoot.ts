/**
 * The on-foot controller (Book 2 sections 10 and 21; Book 10 section 02 movement): walk, run,
 * sneak and carry at Book 10 speeds, collision against the zone's terrain under the current tide,
 * and interaction with a generous radius and the nearest target highlighted. Carrying a person
 * slows the steerer to carry speed and disables attacks; a person is set down only on dry ground
 * above the high-tide line, and every refusal carries its reason.
 *
 * Positions are logical pixels; an actor's (x, y) is its foot anchor. Pure and deterministic:
 * the simulation calls these once per 60 Hz tick.
 */
import type { ControlsBalance, MovementBalance, WaterBalance } from '../../content/balance.ts';
import type { Elevation } from '../../content/terrain/elevation.ts';
import type { Id } from '../../core/ids.ts';
import { bandAt, isDeep } from './water.ts';
import { aboveTideLine, blocksMovement, terrainAt, tileOf } from './zoneMap.ts';
import type { Facing, Terrain, ZoneMap } from './zoneMap.ts';

export type Gait = 'walk' | 'run' | 'sneak' | 'carry';
/**
 * How a person in the zone is placed: lying down, standing calling for help (Hild in the
 * shallows, too hurt to wade out alone), standing, sitting, or carried.
 */
export type Pose = 'down' | 'call' | 'idle' | 'sit' | 'carried';
/** Poses of someone who needs lifting. */
export const NEEDS_LIFT: readonly Pose[] = ['down', 'call'];

export interface MoveIntent {
  /** -1 to 1 on each axis, length at most 1 (a stick can ask for less than full speed). */
  x: number;
  y: number;
  run: boolean;
  sneak: boolean;
}

/** A bow or thrown spear being drawn: the aim vector (quantised) and the tick the draw began. */
export interface Aim {
  readonly x: number;
  readonly y: number;
  readonly since: number;
}

export interface OnFootPlayer {
  x: number;
  y: number;
  facing: Facing;
  gait: Gait;
  moving: boolean;
  intent: MoveIntent;
  /** Drawing a bow, or null (Book 2 section 21, AIM). */
  aim: Aim | null;
}

export interface OnFootActor {
  x: number;
  y: number;
  facing: Facing;
  pose: Pose;
}

export interface OnFootState {
  zone: Id;
  player: OnFootPlayer;
  actors: Record<Id, OnFootActor>;
  /** The person being carried, if any. */
  carrying: Id | null;
}

/** Controller settings that are not Book 10 tuning numbers (content/onfoot.json). */
export interface OnFootRules {
  readonly interactRadiusTiles: number;
  /** The shared collision footprint of people (Book 7 section 07), in pixels, centred on the foot. */
  readonly footprint: { readonly w: number; readonly h: number };
  /** How far ahead of the steerer a carried person is set down, in pixels. */
  readonly setDownReach: number;
  /** How each hotbar item is used: drawn and aimed (a bow), or used at a tile within reach. */
  readonly items: Readonly<Record<Id, { readonly use: ItemUse }>>;
}

/** AIM: drawn and aimed freely (a bow); MELEE: struck towards a facing; TOOL: used at a tile. */
export type ItemUse = 'AIM' | 'MELEE' | 'TOOL';

export interface LandContext {
  readonly maps: ReadonlyMap<Id, ZoneMap>;
  readonly movement: MovementBalance;
  readonly rules: OnFootRules;
  /** Book 10 section 02, water depth bands and effects. */
  readonly water: WaterBalance;
  /** Book 10 section 21: reach and the hotbar. */
  readonly controls: ControlsBalance;
  /** Each zone's baked ground height (the water's depth comes from it). */
  readonly elevations: ReadonlyMap<Id, Elevation>;
}

/** The tide as movement needs it: whether the tidal ground is open, and the still water level. */
export interface TideNow {
  readonly open: boolean;
  readonly level: number;
}

export const TICKS_PER_SECOND = 60;

export function placeOnFoot(map: ZoneMap, people: readonly Id[], pose: Pose = 'down'): OnFootState {
  const steerer = map.spawns['P_STEERER'];
  if (steerer === undefined) throw new Error(`${map.zone} has no P_STEERER spawn`);
  const px = (t: number): number => t * map.tile;
  const actors: Record<Id, OnFootActor> = {};
  for (const id of people) {
    const s = map.spawns[id];
    if (s !== undefined) actors[id] = { x: px(s.x), y: px(s.y), facing: s.facing, pose };
  }
  return {
    zone: map.zone,
    player: {
      x: px(steerer.x),
      y: px(steerer.y),
      facing: steerer.facing,
      gait: 'walk',
      moving: false,
      intent: { x: 0, y: 0, run: false, sneak: false },
      aim: null,
    },
    actors,
    carrying: null,
  };
}

/** The gait the steerer moves at: carrying overrides running and sneaking. */
export function gaitFor(state: OnFootState): Gait {
  if (state.carrying !== null) return 'carry';
  if (state.player.intent.sneak) return 'sneak';
  if (state.player.intent.run) return 'run';
  return 'walk';
}

export function speedTilesPerSecond(gait: Gait, movement: MovementBalance): number {
  return movement[gait];
}

/** Whether a footprint centred on foot (x, y) is clear of blocking terrain. */
export function footprintClear(
  map: ZoneMap,
  rules: OnFootRules,
  x: number,
  y: number,
  tidalGroundOpen: boolean,
): boolean {
  const left = x - rules.footprint.w / 2;
  const right = x + rules.footprint.w / 2 - 0.001;
  const top = y - rules.footprint.h;
  const bottom = y - 0.001;
  if (left < 0 || top < 0 || right >= map.width * map.tile || bottom >= map.height * map.tile)
    return false;
  for (const [cx, cy] of [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
  ] as const) {
    const { tx, ty } = tileOf(map, cx, cy);
    if (blocksMovement(terrainAt(map, tx, ty), tidalGroundOpen)) return false;
  }
  return true;
}

/** The nearest of the four facings to a direction (melee and aim facing, Book 10 section 21). */
export function facingOf(x: number, y: number, current: Facing): Facing {
  if (x === 0 && y === 0) return current;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'e' : 'w';
  return y > 0 ? 's' : 'n';
}

/** The speed in tiles a second at a point, after the water's band (Book 10 section 02). */
export function speedAt(
  state: OnFootState,
  map: ZoneMap,
  ctx: Pick<LandContext, 'movement' | 'water' | 'elevations'>,
  level: number,
): number {
  const p = state.player;
  const elevation = ctx.elevations.get(map.zone);
  const band = elevation === undefined ? null : bandAt(ctx.water, elevation, p.x, p.y, level);
  const inWater = band !== null && band.band !== 'WET';
  const base = p.gait === 'walk' && inWater ? ctx.movement.wade : ctx.movement[p.gait];
  const factor = band?.speedFactor ?? 1;
  const carry = band?.band === 'WAIST' && p.gait === 'carry' ? ctx.water.waistCarryFactor : 1;
  return base * factor * carry;
}

/** One tick of movement. Each axis moves on its own, so the steerer slides along walls. */
export function stepMovement(
  state: OnFootState,
  map: ZoneMap,
  ctx: Pick<LandContext, 'movement' | 'rules' | 'water' | 'elevations'>,
  tide: TideNow,
): void {
  const p = state.player;
  p.gait = gaitFor(state);
  const { x: ix, y: iy } = p.intent;
  // While drawing, the steerer faces the aim (snapped to the nearest facing).
  p.facing = p.aim === null ? facingOf(ix, iy, p.facing) : facingOf(p.aim.x, p.aim.y, p.facing);
  const perTick = (speedAt(state, map, ctx, tide.level) * map.tile) / TICKS_PER_SECOND;
  const dx = ix * perTick;
  const dy = iy * perTick;
  const before = { x: p.x, y: p.y };
  const elevation = ctx.elevations.get(map.zone);
  // Deep water is the edge of the walkable ground (no scene allows swimming yet); someone already
  // in it may still move towards the shallows.
  const depthOk = (x: number, y: number): boolean => {
    if (elevation === undefined) return true;
    const to = bandAt(ctx.water, elevation, x, y, tide.level);
    if (!isDeep(to)) return true;
    return isDeep(bandAt(ctx.water, elevation, p.x, p.y, tide.level));
  };
  const clear = (x: number, y: number): boolean =>
    footprintClear(map, ctx.rules, x, y, tide.open) && depthOk(x, y);
  if (dx !== 0 && clear(p.x + dx, p.y)) p.x += dx;
  if (dy !== 0 && clear(p.x, p.y + dy)) p.y += dy;
  p.moving = p.x !== before.x || p.y !== before.y;
  const carried = state.carrying === null ? undefined : state.actors[state.carrying];
  if (carried !== undefined) {
    carried.x = p.x;
    carried.y = p.y;
    carried.facing = p.facing;
  }
}

export type RefusalReason = 'BELOW_TIDE_LINE' | 'NO_ROOM';

export type Interaction =
  | { readonly kind: 'LIFT'; readonly target: Id }
  | {
      readonly kind: 'SET_DOWN';
      readonly target: Id;
      readonly at: { readonly x: number; readonly y: number };
      /** Null when the spot is fine. */
      readonly refusal: RefusalReason | null;
      readonly terrain: Terrain;
    };

const AHEAD: Record<Facing, readonly [number, number]> = {
  s: [0, 1],
  n: [0, -1],
  e: [1, 0],
  w: [-1, 0],
};

/** What pressing Interact would do now: the nearest target within reach, or setting down. */
export function interactionNow(
  state: OnFootState,
  map: ZoneMap,
  rules: OnFootRules,
  tidalGroundOpen: boolean,
): Interaction | null {
  const p = state.player;
  if (state.carrying !== null) {
    const [ax, ay] = AHEAD[p.facing];
    const at = { x: p.x + ax * rules.setDownReach, y: p.y + ay * rules.setDownReach };
    const { tx, ty } = tileOf(map, at.x, at.y);
    const terrain = terrainAt(map, tx, ty);
    let refusal: RefusalReason | null = null;
    if (!footprintClear(map, rules, at.x, at.y, tidalGroundOpen)) refusal = 'NO_ROOM';
    else if (!aboveTideLine(terrain)) refusal = 'BELOW_TIDE_LINE';
    return { kind: 'SET_DOWN', target: state.carrying, at, refusal, terrain };
  }
  const reach = rules.interactRadiusTiles * map.tile;
  let best: { id: Id; d: number } | null = null;
  for (const [id, actor] of Object.entries(state.actors).sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!NEEDS_LIFT.includes(actor.pose)) continue;
    const d = Math.hypot(actor.x - p.x, actor.y - p.y);
    if (d <= reach && (best === null || d < best.d)) best = { id, d };
  }
  return best === null ? null : { kind: 'LIFT', target: best.id };
}

export interface TilePos {
  readonly tx: number;
  readonly ty: number;
}

/**
 * How far a tile is from the steerer, in tiles: centre to centre from the steerer's own tile
 * (Book 10 section 21: a reach of 1.5 tiles is the steerer's tile and the eight around it).
 */
export function tileDistance(map: ZoneMap, at: { x: number; y: number }, tile: TilePos): number {
  const own = tileOf(map, at.x, at.y);
  return Math.hypot(tile.tx - own.tx, tile.ty - own.ty);
}

export function inReach(
  map: ZoneMap,
  at: { x: number; y: number },
  tile: TilePos,
  reachTiles: number,
): boolean {
  return tileDistance(map, at, tile) <= reachTiles + 1e-9;
}

/**
 * What interacting at a tile would do (right-click, Book 2 section 21): set the carried person
 * down there, or lift the person standing on it (their feet on the tile, or on the tile below:
 * a click on their body counts). Reach is checked by the caller.
 */
export function interactionAt(
  state: OnFootState,
  map: ZoneMap,
  rules: OnFootRules,
  tidalGroundOpen: boolean,
  tile: TilePos,
): Interaction | null {
  if (state.carrying !== null) {
    const at = { x: (tile.tx + 0.5) * map.tile, y: (tile.ty + 0.7) * map.tile };
    const terrain = terrainAt(map, tile.tx, tile.ty);
    let refusal: RefusalReason | null = null;
    if (!footprintClear(map, rules, at.x, at.y, tidalGroundOpen)) refusal = 'NO_ROOM';
    else if (!aboveTideLine(terrain)) refusal = 'BELOW_TIDE_LINE';
    return { kind: 'SET_DOWN', target: state.carrying, at, refusal, terrain };
  }
  for (const [id, actor] of Object.entries(state.actors).sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!NEEDS_LIFT.includes(actor.pose)) continue;
    const feet = tileOf(map, actor.x, actor.y);
    if (feet.tx === tile.tx && (feet.ty === tile.ty || feet.ty === tile.ty + 1))
      return { kind: 'LIFT', target: id };
  }
  return null;
}

const OPPOSITE: Record<Facing, Facing> = { s: 'n', n: 's', e: 'w', w: 'e' };

/** Applies an interaction that `interactionNow` allowed. */
export function applyInteraction(state: OnFootState, interaction: Interaction): void {
  const actor = state.actors[interaction.target];
  if (actor === undefined) return;
  if (interaction.kind === 'LIFT') {
    state.carrying = interaction.target;
    actor.pose = 'carried';
    actor.x = state.player.x;
    actor.y = state.player.y;
    return;
  }
  state.carrying = null;
  actor.pose = 'sit';
  actor.x = interaction.at.x;
  actor.y = interaction.at.y;
  actor.facing = OPPOSITE[state.player.facing];
}

/** Actions the steerer cannot take right now, with the reason (Book 10: carrying disables attacks). */
export function disabledActions(state: OnFootState): ReadonlyMap<string, 'CARRYING'> {
  if (state.carrying === null) return new Map();
  return new Map(
    (['useItem', 'finisher', 'shove', 'parry', 'block'] as const).map((a) => [
      a,
      'CARRYING' as const,
    ]),
  );
}

/** Eight-way compass direction from one point to another (y runs south, Book 9 section 01). */
export function compass(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const sector = Math.round(angle / (Math.PI / 4));
  return (['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const)[(sector + 8) % 8] ?? 'e';
}
