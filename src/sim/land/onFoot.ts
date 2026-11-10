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
import type { MovementBalance } from '../../content/balance.ts';
import type { Id } from '../../core/ids.ts';
import { aboveTideLine, blocksMovement, terrainAt, tileOf } from './zoneMap.ts';
import type { Facing, Terrain, ZoneMap } from './zoneMap.ts';

export type Gait = 'walk' | 'run' | 'sneak' | 'carry';
export type Pose = 'down' | 'idle' | 'sit' | 'carried';

export interface MoveIntent {
  /** -1 to 1 on each axis, length at most 1 (a stick can ask for less than full speed). */
  x: number;
  y: number;
  run: boolean;
  sneak: boolean;
}

export interface OnFootPlayer {
  x: number;
  y: number;
  facing: Facing;
  gait: Gait;
  moving: boolean;
  intent: MoveIntent;
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
}

export interface LandContext {
  readonly maps: ReadonlyMap<Id, ZoneMap>;
  readonly movement: MovementBalance;
  readonly rules: OnFootRules;
}

export const TICKS_PER_SECOND = 60;

export function placeOnFoot(map: ZoneMap, people: readonly Id[]): OnFootState {
  const steerer = map.spawns['P_STEERER'];
  if (steerer === undefined) throw new Error(`${map.zone} has no P_STEERER spawn`);
  const px = (t: number): number => t * map.tile;
  const actors: Record<Id, OnFootActor> = {};
  for (const id of people) {
    const s = map.spawns[id];
    if (s !== undefined) actors[id] = { x: px(s.x), y: px(s.y), facing: s.facing, pose: 'down' };
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

function facingOf(x: number, y: number, current: Facing): Facing {
  if (x === 0 && y === 0) return current;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'e' : 'w';
  return y > 0 ? 's' : 'n';
}

/** One tick of movement. Each axis moves on its own, so the steerer slides along walls. */
export function stepMovement(
  state: OnFootState,
  map: ZoneMap,
  ctx: Pick<LandContext, 'movement' | 'rules'>,
  tidalGroundOpen: boolean,
): void {
  const p = state.player;
  p.gait = gaitFor(state);
  const { x: ix, y: iy } = p.intent;
  p.facing = facingOf(ix, iy, p.facing);
  const perTick = (speedTilesPerSecond(p.gait, ctx.movement) * map.tile) / TICKS_PER_SECOND;
  const dx = ix * perTick;
  const dy = iy * perTick;
  const before = { x: p.x, y: p.y };
  if (dx !== 0 && footprintClear(map, ctx.rules, p.x + dx, p.y, tidalGroundOpen)) p.x += dx;
  if (dy !== 0 && footprintClear(map, ctx.rules, p.x, p.y + dy, tidalGroundOpen)) p.y += dy;
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
    if (actor.pose !== 'down') continue;
    const d = Math.hypot(actor.x - p.x, actor.y - p.y);
    if (d <= reach && (best === null || d < best.d)) best = { id, d };
  }
  return best === null ? null : { kind: 'LIFT', target: best.id };
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
    (['lightAttack', 'heavy', 'finisher', 'shove', 'parry', 'block'] as const).map((a) => [
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
