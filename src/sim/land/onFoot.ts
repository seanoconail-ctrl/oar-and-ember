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
import type {
  ArrowBalance,
  ControlsBalance,
  MissileBalance,
  MovementBalance,
  WaterBalance,
} from '../../content/balance.ts';
import type { Elevation } from '../../content/terrain/elevation.ts';
import type { Id } from '../../core/ids.ts';
import { heightAt } from '../../content/terrain/elevation.ts';
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

/**
 * A bow or thrown spear being drawn: the aim vector (quantised), the tick the draw began, and how
 * far away the aim point is in tiles (null: on to the weapon's full range).
 */
export interface Aim {
  readonly x: number;
  readonly y: number;
  readonly since: number;
  readonly dist: number | null;
}

/**
 * Book 10 section 21, drawPlantsFeet: while a bow is drawn or a spear held to throw, movement is
 * ignored, for anyone with an aim (the steerer, crew and enemies alike). They turn to the aim and
 * can only loose or cancel.
 */
export function feetPlanted(who: { readonly aim?: Aim | null }): boolean {
  return who.aim != null;
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
  /** Stepping this tick (a wader keeping their footing as the tide moves); absent when still. */
  moving?: boolean;
  /** The walk this person wants (crew and enemies from Stage 9); absent when standing. */
  intent?: MoveIntent;
  /** A bow drawn or a spear held to throw: the feet are planted (feetPlanted). */
  aim?: Aim | null;
  /** A shield held up (blocking or in a shield wall): it stops missiles from the front. */
  blocking?: boolean;
  /** An archer's stop, draw, loose, move (src/sim/combat/archer.ts). */
  archer?: ArcherState;
}

/** Where an archer is in its stop, draw, loose and move. */
export interface ArcherState {
  phase: 'stopping' | 'drawing' | 'moving';
  /** The aim point, in world pixels. */
  readonly target: { readonly x: number; readonly y: number };
  /** The walk it takes once it has loosed. */
  readonly then: MoveIntent;
}

export type MissileKind = 'arrow' | 'spear';

/** What a missile struck: the ground, a prop's wood, stone, a raised shield, a body, or water. */
export type MissileStrike = 'ground' | 'wood' | 'stone' | 'shield' | 'body' | 'water';

/**
 * A missile in flight (Book 10 section 21, "Missiles"). Its ground track runs straight from the
 * shooter's feet towards the aim point at the missile's speed; its height `z` above that track is
 * a parabola, 0 at both ends with its apex half way. Positions are world pixels.
 */
export interface Projectile {
  readonly n: number;
  readonly kind: MissileKind;
  readonly shooter: Id;
  readonly x0: number;
  readonly y0: number;
  /** Unit direction of the ground track (after the spread), rounded to 1/4096. */
  readonly ux: number;
  readonly uy: number;
  /** Length of the ground track in pixels, and the ticks it takes to fly it. */
  readonly length: number;
  readonly ticks: number;
  /** Height of the arc at its middle, in pixels. */
  readonly apex: number;
  /** Ticks flown so far, and where it is now. */
  t: number;
  x: number;
  y: number;
  z: number;
}

/**
 * A missile that has come to rest: stuck in the ground, a prop or a body, lying at the foot of
 * stone, or broken. In a body or shield its position is relative to that person's feet.
 */
export interface StuckMissile {
  readonly n: number;
  readonly kind: MissileKind;
  readonly x: number;
  readonly y: number;
  /** Height above the ground where it sits, in pixels (0 in the ground). */
  readonly h: number;
  /** Its flight direction, one of 16 (0 east, clockwise). */
  readonly dir: number;
  readonly in: Exclude<MissileStrike, 'water'>;
  /** The person it is in (a body or a shield). */
  readonly target?: Id;
  readonly broken: boolean;
  /** Game minutes since the campaign began, when it struck (in the ground it lasts a day). */
  readonly at: number;
}

/** An item lying in the zone to be picked up (right-click or Interact within reach). */
export interface GroundItem {
  readonly key: string;
  readonly item: Id;
  readonly count: number;
  /** Arrows in a quiver found with it. */
  readonly arrows?: number;
  /** Tile coordinates of its foot, as zone props are placed. */
  readonly x: number;
  readonly y: number;
  /** A fact that must be true before it shows (the bow, after Hild is safe). */
  readonly after?: string;
  /** A glint marks it (Book 7 section 14: a glint on a ledge). */
  readonly glint?: boolean;
}

export interface OnFootState {
  zone: Id;
  player: OnFootPlayer;
  actors: Record<Id, OnFootActor>;
  /** The person being carried, if any. */
  carrying: Id | null;
  /** Items lying in the zone (version 4). */
  items: GroundItem[];
  /** Missiles in flight, and the serial of the next one (version 4). */
  projectiles: Projectile[];
  nextMissile: number;
  /** Missiles at rest in the zone, oldest first (Book 10 stuckArrows: at most 40). */
  stuck: StuckMissile[];
}

/** Controller settings that are not Book 10 tuning numbers (content/onfoot.json). */
export interface OnFootRules {
  readonly interactRadiusTiles: number;
  /** The shared collision footprint of people (Book 7 section 07), in pixels, centred on the foot. */
  readonly footprint: { readonly w: number; readonly h: number };
  /** How far ahead of the steerer a carried person is set down, in pixels. */
  readonly setDownReach: number;
  /** How each item is used: drawn and aimed (a bow), used at a tile within reach, or ammunition. */
  readonly items: Readonly<Record<Id, ItemRules>>;
  /** The height a missile leaves the hand at, in pixels above the feet (the art's draw pose). */
  readonly releaseHeightPx: number;
  /** A person's body as a missile meets it: width and depth on the ground, in pixels. */
  readonly missileHitBox: { readonly w: number; readonly h: number };
  /** Props that stop missiles, by sheet: a footprint round the foot, and what they are made of. */
  readonly cover: Readonly<Record<string, CoverRule>>;
}

export interface ItemRules {
  readonly use: ItemUse;
  /** An aimed item's missile, and the item each shot spends (the bow's arrows). */
  readonly missile?: MissileKind;
  readonly ammo?: Id;
}

/** A prop that stops missiles: tall cover stops every missile, low cover only near the ground. */
export interface CoverRule {
  readonly w: number;
  readonly h: number;
  readonly material: 'wood' | 'stone';
  readonly tall: boolean;
}

/**
 * AIM: drawn and aimed freely (a bow); MELEE: struck towards a facing; TOOL: used at a tile; AMMO:
 * carried in the inventory and spent by another item (arrows).
 */
export type ItemUse = 'AIM' | 'MELEE' | 'TOOL' | 'AMMO';

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
  /** Book 10 section 21, "Missiles" (with the bow and thrown spear of section 06), and "Arrows". */
  readonly missiles: MissileBalance;
  readonly arrows: ArrowBalance;
}

/** The tide as movement needs it: whether the tidal ground is open, and the still water level. */
export interface TideNow {
  readonly open: boolean;
  readonly level: number;
}

export const TICKS_PER_SECOND = 60;

export function placeOnFoot(
  map: ZoneMap,
  people: readonly Id[],
  pose: Pose = 'down',
  items: readonly GroundItem[] = [],
): OnFootState {
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
    items: items.map((i) => ({ ...i })),
    projectiles: [],
    nextMissile: 1,
    stuck: [],
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
  // While drawing, the steerer faces the aim (snapped to the nearest facing) and stands still:
  // the movement wanted is kept, but not walked, until the bow is loosed or lowered.
  const planted = feetPlanted(p);
  const { x: ix, y: iy } = planted ? { x: 0, y: 0 } : p.intent;
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

/**
 * Someone standing in the shallows waiting for rescue (Hild in the opening: knee to waist deep,
 * Book 1 section 15, Book 9) keeps their footing as the tide moves: when the water at their feet
 * comes within a tenth of the knee and waist bands' span of leaving them, they step at their
 * wading pace up or down the slope of the shore until it is back inside that margin. A step
 * never goes onto rock. Deterministic: the still water level and the baked ground height only.
 */
export function keepFooting(
  actor: OnFootActor,
  map: ZoneMap,
  ctx: Pick<LandContext, 'movement' | 'water' | 'elevations'>,
  level: number,
): void {
  delete actor.moving;
  const elevation = ctx.elevations.get(map.zone);
  const knee = ctx.water.bands.find((b) => b.band === 'KNEE');
  const waist = ctx.water.bands.find((b) => b.band === 'WAIST');
  const ankle = ctx.water.bands.find((b) => b.band === 'ANKLE');
  if (elevation === undefined || knee === undefined || waist === undefined || ankle === undefined)
    return;
  const lo = ankle.upTo;
  const hi = waist.upTo;
  const margin = (hi - lo) / 10;
  const depth = level - heightAt(elevation, actor.x, actor.y);
  // -1: too shallow, step seaward (down the slope); 1: too deep, step shoreward (up the slope).
  const way = depth < lo + margin ? -1 : depth > hi - margin ? 1 : 0;
  if (way === 0) return;
  const gx = heightAt(elevation, actor.x + 4, actor.y) - heightAt(elevation, actor.x - 4, actor.y);
  const gy = heightAt(elevation, actor.x, actor.y + 4) - heightAt(elevation, actor.x, actor.y - 4);
  const g = Math.hypot(gx, gy);
  if (g < 1e-6) return;
  const band = bandAt(ctx.water, elevation, actor.x, actor.y, level);
  const pace =
    (ctx.movement.wade * (band?.speedFactor ?? knee.speedFactor ?? 1) * map.tile) /
    TICKS_PER_SECOND;
  const x = actor.x + (way * gx * pace) / g;
  const y = actor.y + (way * gy * pace) / g;
  const { tx, ty } = tileOf(map, x, y);
  if (terrainAt(map, tx, ty) === 'rock') return;
  actor.x = x;
  actor.y = y;
  actor.moving = true;
}

/**
 * One tick of a person's own walk (crew and enemies, Stage 9): their intent at walking pace, axis
 * by axis against the terrain, never while their feet are planted to draw or throw.
 */
export function stepActor(
  actor: OnFootActor,
  map: ZoneMap,
  ctx: Pick<LandContext, 'movement' | 'rules'>,
  tidalGroundOpen: boolean,
): void {
  const intent = actor.intent;
  if (intent === undefined || NEEDS_LIFT.includes(actor.pose) || actor.pose === 'carried') return;
  if (feetPlanted(actor)) {
    delete actor.moving;
    if (actor.aim != null) actor.facing = facingOf(actor.aim.x, actor.aim.y, actor.facing);
    return;
  }
  const perTick = (ctx.movement.walk * map.tile) / TICKS_PER_SECOND;
  const before = { x: actor.x, y: actor.y };
  const dx = intent.x * perTick;
  const dy = intent.y * perTick;
  if (dx !== 0 && footprintClear(map, ctx.rules, actor.x + dx, actor.y, tidalGroundOpen))
    actor.x += dx;
  if (dy !== 0 && footprintClear(map, ctx.rules, actor.x, actor.y + dy, tidalGroundOpen))
    actor.y += dy;
  actor.facing = facingOf(intent.x, intent.y, actor.facing);
  if (actor.x !== before.x || actor.y !== before.y) actor.moving = true;
  else delete actor.moving;
}

/** Facts the zone reads: an item shows once its `after` fact is true. */
export type FactView = Readonly<Record<string, string | number | boolean>>;

/** Whether a ground item can be seen and picked up now. */
export function itemShown(item: GroundItem, facts: FactView): boolean {
  return item.after === undefined || facts[item.after] === true;
}

/** A missile at rest that can be pulled free and used again (not broken, not in a person). */
export function stuckRecoverable(s: StuckMissile): boolean {
  return !s.broken && s.target === undefined;
}

/** Where something to pick up lies, in world pixels: its key, and its foot. */
export interface PickupSpot {
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

/** Everything that can be picked up now: items shown, and missiles that can be pulled free. */
export function pickupSpots(state: OnFootState, map: ZoneMap, facts: FactView): PickupSpot[] {
  const out: PickupSpot[] = [];
  for (const item of state.items)
    if (itemShown(item, facts))
      out.push({ key: item.key, x: item.x * map.tile, y: item.y * map.tile });
  for (const s of state.stuck)
    if (stuckRecoverable(s)) out.push({ key: `stuck:${s.n}`, x: s.x, y: s.y });
  return out;
}

export type RefusalReason = 'BELOW_TIDE_LINE' | 'NO_ROOM';

export type Interaction =
  | { readonly kind: 'LIFT'; readonly target: Id }
  | { readonly kind: 'PICK_UP'; readonly key: string }
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
  facts: FactView = {},
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
  // Something lying nearer than anyone to lift is picked up instead.
  let pick: { key: string; d: number } | null = null;
  for (const spot of pickupSpots(state, map, facts)) {
    const d = Math.hypot(spot.x - p.x, spot.y - p.y);
    if (d <= reach && (pick === null || d < pick.d)) pick = { key: spot.key, d };
  }
  if (pick !== null && (best === null || pick.d < best.d)) return { kind: 'PICK_UP', key: pick.key };
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
  facts: FactView = {},
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
  // Something lying on the tile (or just below it: a click on a tall thing counts).
  for (const spot of pickupSpots(state, map, facts)) {
    const at = tileOf(map, spot.x, spot.y - 0.001);
    if (at.tx === tile.tx && (at.ty === tile.ty || at.ty === tile.ty + 1))
      return { kind: 'PICK_UP', key: spot.key };
  }
  return null;
}

const OPPOSITE: Record<Facing, Facing> = { s: 'n', n: 's', e: 'w', w: 'e' };

/** Applies a lift or set-down that `interactionNow` allowed (picking up is the simulation's). */
export function applyInteraction(state: OnFootState, interaction: Interaction): void {
  if (interaction.kind === 'PICK_UP') return;
  const actor = state.actors[interaction.target];
  if (actor === undefined) return;
  delete actor.moving;
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
