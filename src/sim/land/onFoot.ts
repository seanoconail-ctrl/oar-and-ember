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
import type { WalkGoal } from './path.ts';
import { bandAt, isDeep } from './water.ts';
import type { WadeAt } from './water.ts';
import { aboveTideLine, solidAt, springGround, terrainAt, tileBlocks, tileOf } from './zoneMap.ts';
import type { Facing, Terrain, ZoneMap } from './zoneMap.ts';
import { dashStep, facingLocked, facingOfAngle, locked } from '../combat/fighter.ts';
import type { AccelMode, CombatBalance } from '../../content/combatBalance.ts';
import type { Fighter } from '../combat/fighter.ts';
import type { ActorFight, Battle, Stance } from './fight.ts';
import { doorOverlap } from './doors.ts';
import type { DoorState } from './doors.ts';
import { edgePressAt, edgeStep } from './edges.ts';
import type { EdgePress } from './edges.ts';
import type { TraverseState } from './traverse.ts';

export type Gait = 'walk' | 'run' | 'sneak' | 'carry';
/**
 * How a person in the zone is placed: lying down, standing calling for help (Hild in the
 * shallows, too hurt to wade out alone), standing, sitting, or carried.
 */
export type Pose =
  | 'down'
  | 'call'
  | 'idle'
  | 'sit'
  | 'carried'
  | 'sleep'
  | 'work'
  /** Stage 8: eating at the fire, and standing still watching (a tendency). */
  | 'eat'
  | 'watch'
  /** Kneeling at a habit (praying at dawn): the kneel work loop. */
  | 'kneel'
  /** Stage 9: dead where they fell (a corpse stays for the scene; at home until buried). */
  | 'dead';
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
  /** A hands-on task under way (Stage 7): the feet are planted while its work loop plays. */
  work?: Work | null;
  /** Lying down to sleep at a bed: the night passes after the camp's sleepSeconds. */
  sleep?: { readonly since: number; readonly site: string } | null;
  /** Traversals that ran the bar empty, until Book 10's recoverAt is regained. */
  winded?: { run?: boolean; carry?: boolean; wade?: boolean };
  /** Stage 9: the steerer's fighter state machine (src/sim/combat/fighter.ts). */
  fight?: Fighter | null;
  /** A shield held up: it stops missiles from the front (as for anyone, Book 10 shieldBlock). */
  blocking?: boolean;
  /** Combat v2: the stance (facing, lock-on, sneaking; Book 2 section 12, decision DE-2). */
  stance?: Stance;
  /**
   * Design addendum 2.5 (Book 2 section 12's Motion; Book 10 "Movement and acceleration",
   * decision DF-2): the velocity in logical px a tick, eased towards the speed wanted, and the
   * mode it last moved in (its ticks to stop).
   */
  vel?: { x: number; y: number };
  motion?: AccelMode;
  /**
   * Stage 14 (decision S14-14; src/sim/land/traverse.ts): the movement verb under way (a climb, a
   * swim, a jump, a crawl, a push or pull), and the heavy object held with Interact.
   */
  traverse?: TraverseState | null;
  grip?: string | null;
}

/**
 * Stage 14: how the movement verbs change a step of ordinary movement (src/sim/land/traverse.ts,
 * moveExtras): ground they open (marked swimming water) and close (a heavy object, a crawl), deep
 * water that may be entered, the swim speed and the soft ground's factor.
 */
export interface MoveExtras {
  readonly passable?: (x: number, y: number) => boolean;
  readonly blocked?: (x: number, y: number) => boolean;
  readonly deepOk?: (x: number, y: number) => boolean;
  /** Tiles a second while swimming (Book 10 Swim), in place of the band's wading pace. */
  readonly swimSpeed?: number;
  /** A factor on the speed (Book 10 bogSoftRain). */
  readonly factor?: number;
}

/**
 * A player's hands-on action (Book 2 section 07): its task and where, when it began and how long
 * its work loop plays (Book 10 actionSeconds, in ticks), the tick of the timing press if any, and
 * the person tended or the water fished.
 */
export interface Work {
  readonly task: Id;
  readonly site: string;
  readonly since: number;
  readonly ticks: number;
  press: number | null;
  readonly target?: Id;
  /** Where the work is done (the cast line's water, the fire), in pixels. */
  readonly at: { readonly x: number; readonly y: number };
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
  /** A walk under way to a place (Stage 7: residents going about the camp and to work). */
  walk?: WalkGoal;
  /** The task a resident is working at (pose 'work'): its work loop plays (Book 7 section 07). */
  task?: Id;
  /** Stage 9: their part in a fight (src/sim/land/fight.ts). */
  fight?: ActorFight;
  /** A downed ally they carry (the CARRY order). */
  carries?: Id;
}

/** An archer's settle, draw and recovery ticks (Book 10 "Archers", standStill; "Enemy attacks", Bow). */
export interface ArcherTiming {
  readonly settle: number;
  readonly draw: number;
  readonly recover: number;
}

/** Where an archer is in its stop, settle, draw, loose, recovery and move. */
export interface ArcherState {
  phase: 'stopping' | 'settling' | 'drawing' | 'recovering' | 'moving';
  /** When its settle or recovery began. */
  since?: number;
  /** Its ticks (design addendum 2.5); without, Book 10's draw and no settle or recovery. */
  readonly timing?: ArcherTiming;
  /** The aim point, in world pixels. */
  readonly target: { readonly x: number; readonly y: number };
  /** The walk it takes once it has loosed. */
  readonly then: MoveIntent;
  /** A thrown spear rather than an arrow (Stage 9). */
  readonly kind?: MissileKind;
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
  /**
   * The zones out of view (version 5): who is there, what lies there and what is stuck there,
   * kept as they were left, so walking back finds them.
   */
  elsewhere?: Record<Id, ZoneRest>;
  /** Stage 9: the fight under way in this zone (its morale, Second wind, whether it is over). */
  battle?: Battle | null;
  /** Design addendum 2.4 (version 11, decision DE-26): the doors of the zone in view. */
  doors?: DoorState[];
}

export interface ZoneRest {
  actors: Record<Id, OnFootActor>;
  items: GroundItem[];
  stuck: StuckMissile[];
  /** A fight still held there (Stage 9). */
  battle?: Battle | null;
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
  /** A tool used at castReach (a line cast into water) rather than toolReach. */
  readonly cast?: boolean;
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
 * carried in the inventory and spent by another item (arrows); VALUABLE: worth silver, it goes
 * into the household's silver when picked up (design addendum 2.4: the arm-ring in the rock pool).
 */
export type ItemUse = 'AIM' | 'MELEE' | 'TOOL' | 'AMMO' | 'VALUABLE';

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
  /** Stage 9: how fighting moves the steerer (Book 10 Charge (heavy) speed; the dodge). */
  /** Design addendum 2.4: Book 10's edgeStopAngle (decision DE-25); absent, the old sliding. */
  readonly edgeStopDegrees?: number;
  readonly combatMove?: {
    readonly dodgeTiles: number;
    readonly dodgeStart: number;
    readonly dodgeDash: number;
    /** Book 10 "Movement and acceleration" (design addendum 2.5, decision DF-2). */
    readonly accel: CombatBalance['accel'];
  };
}

/** The tide as movement needs it: whether the tidal ground is open, and the still water level. */
export interface TideNow {
  readonly open: boolean;
  readonly level: number;
  /**
   * Stage 14 (decision S14-110): a spring-tide day, so the causeway and the caves' floors open with
   * the window (`springOpen`); and the bands the zone's plan sets (src/sim/land/zoneWater.ts).
   */
  readonly spring?: boolean;
  readonly wade?: WadeAt;
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
      stance: {
        facing: { e: 0, s: Math.PI / 2, w: Math.PI, n: -Math.PI / 2 }[steerer.facing],
        lockOn: null,
        sneaking: false,
        want: null,
        lockHeld: null,
        lostSince: null,
        speed: 1,
      },
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
  if (state.player.intent.sneak || state.player.stance?.sneaking === true) return 'sneak';
  // Exhausted (Book 10 "Exhausted", decision DF-3): no run until the bar recovers; nor with the
  // shield up (Book 10 "Block").
  if (state.player.fight?.exhausted === true) return 'walk';
  if (state.player.blocking === true) return 'walk';
  if (state.player.intent.run) return 'run';
  return 'walk';
}

export function speedTilesPerSecond(gait: Gait, movement: MovementBalance): number {
  return movement[gait];
}

/**
 * The ground as a step reads it (Stage 14, decision S14-110): whether the tidal ground is open,
 * whether a spring low has opened the causeway and the caves' floors, and the ground the closing
 * tide has caught someone on, which stays wading water for them until they leave it (Book 10 "No
 * trap", tideClosing): the flats, or spring ground, each on its own, so standing on the flats never
 * opens the causeway.
 */
interface Ground {
  readonly open: boolean;
  readonly spring: boolean;
  readonly caughtFlats?: boolean;
  readonly caughtSpring?: boolean;
}

function groundBlocks(map: ZoneMap, tx: number, ty: number, g: Ground): boolean {
  if (g.caughtFlats === true || g.caughtSpring === true) {
    const t = terrainAt(map, tx, ty);
    if ((g.caughtFlats === true && t === 'flats') || (g.caughtSpring === true && springGround(t)))
      return solidAt(map, tx, ty);
  }
  return tileBlocks(map, tx, ty, g.open, g.spring);
}

function footClear(
  map: ZoneMap,
  rules: Pick<OnFootRules, 'footprint'>,
  x: number,
  y: number,
  g: Ground,
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
    if (groundBlocks(map, tx, ty, g)) return false;
  }
  return true;
}

function areaBlocked(
  map: ZoneMap,
  rules: Pick<OnFootRules, 'footprint'>,
  x: number,
  y: number,
  g: Ground,
): number {
  const left = x - rules.footprint.w / 2;
  const right = x + rules.footprint.w / 2;
  const top = y - rules.footprint.h;
  const t = map.tile;
  let area = 0;
  for (let ty = Math.floor(top / t); ty <= Math.floor((y - 0.001) / t); ty++)
    for (let tx = Math.floor(left / t); tx <= Math.floor((right - 0.001) / t); tx++) {
      const out = tx < 0 || ty < 0 || tx >= map.width || ty >= map.height;
      if (!out && !groundBlocks(map, tx, ty, g)) continue;
      const w = Math.min(right, (tx + 1) * t) - Math.max(left, tx * t);
      const h = Math.min(y, (ty + 1) * t) - Math.max(top, ty * t);
      if (w > 0 && h > 0) area += w * h;
    }
  return area;
}

/**
 * Whether a footprint centred on foot (x, y) is clear of blocking terrain, under the tide (and,
 * from Stage 14, a spring low's opening of the causeway and the caves' floors).
 */
export function footprintClear(
  map: ZoneMap,
  rules: Pick<OnFootRules, 'footprint'>,
  x: number,
  y: number,
  tidalGroundOpen: boolean,
  springOpen = false,
): boolean {
  return footClear(map, rules, x, y, { open: tidalGroundOpen, spring: springOpen });
}

/**
 * How much of a footprint centred on foot (x, y) lies over blocking ground, in square pixels:
 * blocking tiles under the tide, built things, and anything past the zone's edge (Book 10 "No
 * trap"). Zero exactly when footprintClear holds.
 */
export function blockedArea(
  map: ZoneMap,
  rules: Pick<OnFootRules, 'footprint'>,
  x: number,
  y: number,
  tidalGroundOpen: boolean,
  springOpen = false,
): number {
  return areaBlocked(map, rules, x, y, { open: tidalGroundOpen, spring: springOpen });
}

/** Whether any corner of a footprint (those footprintClear reads) stands on ground that holds. */
function footOn(
  map: ZoneMap,
  rules: Pick<OnFootRules, 'footprint'>,
  x: number,
  y: number,
  on: (t: Terrain) => boolean,
): boolean {
  const left = x - rules.footprint.w / 2;
  const right = x + rules.footprint.w / 2 - 0.001;
  const top = y - rules.footprint.h;
  const bottom = y - 0.001;
  for (const [cx, cy] of [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
  ] as const) {
    const { tx, ty } = tileOf(map, cx, cy);
    if (on(terrainAt(map, tx, ty))) return true;
  }
  return false;
}

/** Whether any of a footprint stands on the tidal flats (the corners footprintClear reads). */
export function onTidalGround(
  map: ZoneMap,
  rules: Pick<OnFootRules, 'footprint'>,
  x: number,
  y: number,
): boolean {
  return footOn(map, rules, x, y, (t) => t === 'flats');
}

/**
 * Stage 14: whether any of a footprint stands on ground only a spring low opens (the causeway, a
 * cave's wet floor), which the closing tide catches people on as it does the flats.
 */
export function onSpringGround(
  map: ZoneMap,
  rules: Pick<OnFootRules, 'footprint'>,
  x: number,
  y: number,
): boolean {
  return footOn(map, rules, x, y, springGround);
}

/**
 * Whether a step from `from` to (x, y) may be taken: the no-trap rule (Book 2 section 10; Book 10
 * section 25, "No trap"; decision DG-20). The footprint must be clear there, as ever, except that
 *
 * - **tideClosing**: tidal ground that closed under someone counts for them as wading water (it
 *   is open to them) until their footprint has left it (from Stage 14, the spring ground too); and
 * - **neverFrozen**: a body already overlapping blocking ground (and closed doorways, through
 *   `doorArea`) may move any way that does not deepen the overlap.
 *
 * A step that footprintClear allowed before is allowed still, so nothing that never overlapped
 * moves differently. Pure and deterministic.
 */
export function stepClear(
  map: ZoneMap,
  rules: Pick<OnFootRules, 'footprint'>,
  from: { readonly x: number; readonly y: number },
  x: number,
  y: number,
  tidalGroundOpen: boolean,
  doorArea?: (x: number, y: number) => number,
  springOpen = false,
): boolean {
  const g: Ground = {
    open: tidalGroundOpen,
    spring: springOpen,
    caughtFlats: !tidalGroundOpen && onTidalGround(map, rules, from.x, from.y),
    caughtSpring: !(tidalGroundOpen && springOpen) && onSpringGround(map, rules, from.x, from.y),
  };
  const doors = doorArea ?? ((): number => 0);
  if (footClear(map, rules, x, y, g) && doors(x, y) <= 0) return true;
  const was = areaBlocked(map, rules, from.x, from.y, g) + doors(from.x, from.y);
  if (was <= 0) return false;
  return areaBlocked(map, rules, x, y, g) + doors(x, y) <= was + 1e-6;
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
  wade?: WadeAt,
): number {
  const p = state.player;
  const elevation = ctx.elevations.get(map.zone);
  const band =
    elevation === undefined ? null : bandAt(ctx.water, elevation, p.x, p.y, level, wade);
  const inWater = band !== null && band.band !== 'WET';
  const base = p.gait === 'walk' && inWater ? ctx.movement.wade : ctx.movement[p.gait];
  // Deep water has no wading pace of its own: whoever is in it (risen round them, decision
  // DG-20) moves at the deepest wading band's.
  const deepest = ctx.water.bands.find((x) => x.band === 'WAIST')?.speedFactor ?? 1;
  const factor = band?.band === 'DEEP' ? deepest : (band?.speedFactor ?? 1);
  const carry = band?.band === 'WAIST' && p.gait === 'carry' ? ctx.water.waistCarryFactor : 1;
  // Waist deep with the bar run empty: the band's factor again (Book 10 waistWadeEmpty).
  const tired = band?.band === 'WAIST' && p.winded?.wade === true ? (band.speedFactor ?? 1) : 1;
  return base * factor * carry * tired;
}

/** One tick of movement. Each axis moves on its own, so the steerer slides along walls. */
export function stepMovement(
  state: OnFootState,
  map: ZoneMap,
  ctx: Pick<
    LandContext,
    'movement' | 'rules' | 'water' | 'elevations' | 'combatMove' | 'edgeStopDegrees'
  >,
  tide: TideNow,
  tick?: number,
  extras: MoveExtras = {},
): EdgePress | null {
  const p = state.player;
  p.gait = gaitFor(state);
  // While drawing, the steerer faces the aim (snapped to the nearest facing) and stands still:
  // the movement wanted is kept, but not walked, until the bow is loosed or lowered. A task's
  // work loop and lying down to sleep plant the feet too, and so does a blow, a parry, a block
  // or a stagger (Stage 9); a charge walks at Book 10's charge speed, and a dodge moves on its own.
  const fight = p.fight ?? null;
  const tickNow = tick ?? 0;
  // A dodge moves on its own over its dash, eased out (Book 10 "Dodge"); a blow, a parry, a block
  // raised or lowered, a charge or any other action plants the feet at once (Book 10
  // "Commitment": locked, stopOnAttack). A held guard walks at half speed.
  const cm = ctx.combatMove;
  const dodging = fight !== null && fight.state === 'dodge' && fight.dodge !== null;
  const planted =
    feetPlanted(p) ||
    p.work != null ||
    p.sleep != null ||
    (fight !== null && (locked(fight) || fight.hitstop > 0) && !dodging);
  // Combat v2: the stance owns the facing (drawn in the nearest of four, decision DE-2).
  const stance = p.stance;
  const { x: wx, y: wy } = planted || dodging ? { x: 0, y: 0 } : p.intent;
  if (stance !== undefined && (stance.want !== null || stance.lockOn !== null || p.aim !== null))
    p.facing = facingOfAngle(stance.facing);
  else if (fight !== null && facingLocked(fight)) p.facing = fight.facing;
  else
    p.facing = p.aim === null ? facingOf(wx, wy, p.facing) : facingOf(p.aim.x, p.aim.y, p.facing);
  if (fight !== null && !facingLocked(fight) && stance === undefined) fight.facing = p.facing;
  // The stance's share: forward, strafe or backing off (Book 10 "Stance and lock-on"); half
  // exhausted or with the shield up (Book 10 "Exhausted", "Block").
  const exhausted = fight?.exhausted === true;
  const blocking = p.blocking === true && !dodging;
  const share =
    (stance?.speed ?? 1) *
    (exhausted && cm !== undefined ? cm.accel.exhaustedSpeed : 1) *
    (blocking && cm !== undefined ? cm.accel.blockingSpeed : 1);
  const pace = extras.swimSpeed ?? speedAt(state, map, ctx, tide.level, tide.wade);
  const full = (pace * (extras.factor ?? 1) * map.tile * share) / TICKS_PER_SECOND;
  let ix: number;
  let iy: number;
  let perTick: number;
  if (dodging && cm !== undefined) {
    // The dash, eased out; the start and the rest of the dodge stand.
    const k = tickNow - fight.since - cm.dodgeStart;
    perTick = dashStep(k, cm.dodgeDash, cm.dodgeTiles) * map.tile;
    ix = fight.dodge?.x ?? 0;
    iy = fight.dodge?.y ?? 0;
    if (p.vel !== undefined) p.vel = { x: 0, y: 0 };
  } else if (cm === undefined) {
    perTick = full;
    ix = wx;
    iy = wy;
  } else if (planted) {
    // stopOnAttack: the speed goes to zero at once.
    if (p.vel !== undefined) p.vel = { x: 0, y: 0 };
    perTick = 0;
    ix = 0;
    iy = 0;
  } else {
    // Grounded movement (Book 10 "Movement and acceleration"): ease towards the speed wanted.
    const mode = accelMode(p, state, exhausted, blocking);
    const moving = Math.hypot(wx, wy) > 1e-6;
    const ticks = accelTicks(cm.accel, moving ? mode : (p.motion ?? mode), fight, p);
    const v = easeVelocity(p.vel ?? { x: 0, y: 0 }, { x: wx * full, y: wy * full }, full, ticks);
    // At rest with nothing wanted, the state is left as it was (no velocity until it moves).
    if (p.vel !== undefined || v.x !== 0 || v.y !== 0) p.vel = v;
    if (moving) p.motion = mode;
    const sp = Math.hypot(v.x, v.y);
    perTick = sp;
    ix = sp < 1e-9 ? 0 : v.x / sp;
    iy = sp < 1e-9 ? 0 : v.y / sp;
  }
  const dx = ix * perTick;
  const dy = iy * perTick;
  const before = { x: p.x, y: p.y };
  const elevation = ctx.elevations.get(map.zone);
  // Deep water is the edge of the walkable ground (no scene allows swimming yet); someone already
  // in it may still move towards the shallows. Caught on tidal ground by the closing tide, its
  // water is wading water for them until they leave it, however deep the flood has risen round
  // them (Book 10 "No trap", tideClosing; decision DG-20).
  const springOpen = tide.open && tide.spring === true;
  const caughtOn = (x: number, y: number): boolean =>
    (!tide.open && onTidalGround(map, ctx.rules, x, y)) ||
    (!springOpen && onSpringGround(map, ctx.rules, x, y));
  const caught = caughtOn(p.x, p.y);
  const depthOk = (x: number, y: number): boolean => {
    if (elevation === undefined) return true;
    const to = bandAt(ctx.water, elevation, x, y, tide.level, tide.wade);
    if (!isDeep(to)) return true;
    // Stage 14: marked swimming water, nothing carried (src/sim/land/traverse.ts).
    if (extras.deepOk?.(x, y) === true) return true;
    if (isDeep(bandAt(ctx.water, elevation, p.x, p.y, tide.level, tide.wade))) return true;
    return caught && caughtOn(x, y);
  };
  // Design addendum 2.4: a closed door's doorway blocks like a wall (decision DE-26). No shape
  // ever traps the steerer (decision DG-20): ground that closed under them, or a door shut on
  // them, never holds them where they stand (stepClear).
  const doorArea = (x: number, y: number): number =>
    doorOverlap(state, map, x, y, ctx.rules.footprint);
  const clear = (x: number, y: number): boolean =>
    (stepClear(map, ctx.rules, before, x, y, tide.open, doorArea, tide.spring === true) ||
      (extras.passable?.(x, y) === true && doorArea(x, y) <= 0)) &&
    depthOk(x, y) &&
    extras.blocked?.(x, y) !== true;
  let press: EdgePress | null = null;
  if (ctx.edgeStopDegrees === undefined) {
    if (dx !== 0 && clear(p.x + dx, p.y)) p.x += dx;
    if (dy !== 0 && clear(p.x, p.y + dy)) p.y += dy;
  } else {
    // Edges stop the steerer cleanly, with no sliding along an invisible wall (decision DE-25).
    const step = edgeStep(p.x, p.y, dx, dy, clear, ctx.edgeStopDegrees);
    if (step.blocked && !dodging) press = edgePressAt(map, ctx.rules, p, dx, dy, depthOk);
    p.x = step.x;
    p.y = step.y;
  }
  p.moving = p.x !== before.x || p.y !== before.y;
  // Against a wall the speed is lost (no stored speed to burst out with).
  if (p.vel !== undefined && !p.moving) p.vel = { x: 0, y: 0 };
  const carried = state.carrying === null ? undefined : state.actors[state.carrying];
  if (carried !== undefined) {
    carried.x = p.x;
    carried.y = p.y;
    carried.facing = p.facing;
  }
  return press;
}

/**
 * The mode the steerer moves in (Book 10 "Movement and acceleration"): carrying, exhausted, the
 * shield up, sneaking, running, or in the stance backing off or strafing, else walking.
 */
function accelMode(
  p: OnFootPlayer,
  state: OnFootState,
  exhausted: boolean,
  blocking: boolean,
): AccelMode {
  if (state.carrying !== null) return 'carry';
  if (exhausted) return 'exhausted';
  if (blocking) return 'blocking';
  if (p.gait === 'sneak') return 'sneak';
  if (p.gait === 'run') return 'run';
  const share = p.stance?.speed ?? 1;
  const st = p.stance;
  if (st !== undefined && share !== 1 && st.backing === true) return 'backOff';
  if (st !== undefined && share !== 1) return 'strafe';
  return 'walk';
}

/**
 * Ticks to full speed and to stop for a mode: x the mail's and the heavy build's factors (both:
 * Book 10's own); the run from a walk builds over its shorter ticks.
 */
export function accelTicks(
  a: CombatBalance['accel'],
  mode: AccelMode,
  f: { readonly armour: string; readonly heavy: boolean } | null,
  p?: { readonly vel?: { x: number; y: number }; readonly motion?: AccelMode },
): { up: number; stop: number } {
  const m = a.modes[mode];
  const mail = f?.armour === 'MAIL';
  const heavy = f?.heavy === true;
  const k = mail && heavy ? a.both : mail ? a.mail : heavy ? a.heavy : 1;
  const fromWalk =
    mode === 'run' &&
    p?.motion === 'walk' &&
    p.vel !== undefined &&
    Math.hypot(p.vel.x, p.vel.y) > 1e-6;
  return { up: (fromWalk ? a.runFromWalk : m.up) * k, stop: m.stop * k };
}

/**
 * One tick of grounded movement (Book 10 "Movement and acceleration"): the velocity eases towards
 * the one wanted, up at the full speed over its ticks to full speed, down over its ticks to stop;
 * what is across or against the way wanted slows first, so a reversal passes through a stop.
 */
export function easeVelocity(
  v: { readonly x: number; readonly y: number },
  want: { readonly x: number; readonly y: number },
  full: number,
  ticks: { readonly up: number; readonly stop: number },
): { x: number; y: number } {
  const up = full / Math.max(1, ticks.up);
  const down = full / Math.max(1, ticks.stop);
  const wl = Math.hypot(want.x, want.y);
  const shrink = (x: number, y: number, by: number): { x: number; y: number } => {
    const l = Math.hypot(x, y);
    if (l <= by || l < 1e-9) return { x: 0, y: 0 };
    return { x: x - (x / l) * by, y: y - (y / l) * by };
  };
  if (wl < 1e-9) return shrink(v.x, v.y, down);
  const ux = want.x / wl;
  const uy = want.y / wl;
  let par = v.x * ux + v.y * uy;
  const perp = shrink(v.x - par * ux, v.y - par * uy, down);
  if (par < 0) par = Math.min(0, par + down);
  else if (par < wl) par = Math.min(wl, par + up);
  else par = Math.max(wl, par - down);
  return { x: par * ux + perp.x, y: par * uy + perp.y };
}

/**
 * Someone standing in the shallows waiting for rescue (Hild in the opening: knee to waist deep,
 * Book 1 section 15, Book 9) keeps their footing as the tide moves: when the water at their feet
 * comes within a tenth of the knee and waist bands' span of leaving them, they step at their
 * wading pace up or down the slope of the shore until it is back inside that margin. A step
 * never goes onto rock, the tidal flats or the sea (DE-87). Deterministic: the still water level
 * and the baked ground height only.
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
  // Caught out of their depth by the rising tide, they climb at the knee's pace, not the deep's.
  const factor = band === null || band.band === 'DEEP' ? knee.speedFactor : band.speedFactor;
  const pace = (ctx.movement.wade * (factor ?? 1) * map.tile) / TICKS_PER_SECOND;
  const x = actor.x + (way * gx * pace) / g;
  const y = actor.y + (way * gy * pace) / g;
  const { tx, ty } = tileOf(map, x, y);
  // Never onto rock, nor out onto the tidal flats or the sea, which the rising tide closes: the
  // steerer must always be able to wade to them (decision DE-87).
  const ground = terrainAt(map, tx, ty);
  if (ground === 'rock' || ground === 'flats' || ground === 'sea') return;
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
  // A fighter walks by its fight (src/sim/land/fight.ts).
  if (actor.fight !== undefined) return;
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
  // No shape traps anyone (decision DG-20): stepClear, as for the steerer.
  if (dx !== 0 && stepClear(map, ctx.rules, actor, actor.x + dx, actor.y, tidalGroundOpen))
    actor.x += dx;
  if (dy !== 0 && stepClear(map, ctx.rules, actor, actor.x, actor.y + dy, tidalGroundOpen))
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
export function stuckRecoverable(s: StuckMissile, state?: OnFootState): boolean {
  if (s.broken) return false;
  if (s.target === undefined) return true;
  // In a person or a shield: pulled free after the fight (Book 2 section 12, decision S9-14): from
  // the dead at any time, from anyone else once no fight is under way; never from the steerer.
  if (state === undefined || s.target === 'P_STEERER') return false;
  const who = state.actors[s.target];
  if (who === undefined) return false;
  if (who.pose === 'dead') return true;
  const battle = state.battle ?? null;
  return battle === null || battle.over || !battle.engaged;
}

/** Where a stuck missile is in the world (in a person: their feet plus its offset). */
export function stuckAt(s: StuckMissile, state: OnFootState): { x: number; y: number } {
  if (s.target === undefined) return { x: s.x, y: s.y };
  const who = s.target === 'P_STEERER' ? state.player : state.actors[s.target];
  return { x: s.x + (who?.x ?? 0), y: s.y + (who?.y ?? 0) };
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
    if (stuckRecoverable(s, state)) out.push({ key: `stuck:${s.n}`, ...stuckAt(s, state) });
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
  /** Someone to lift before anyone or anything nearer, when in reach (Hild in the net, DE-86). */
  first: Id | null = null,
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
  const firstActor = first === null ? undefined : state.actors[first];
  if (
    first !== null &&
    firstActor !== undefined &&
    NEEDS_LIFT.includes(firstActor.pose) &&
    Math.hypot(firstActor.x - p.x, firstActor.y - p.y) <= reach
  )
    return { kind: 'LIFT', target: first };
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
  if (pick !== null && (best === null || pick.d < best.d))
    return { kind: 'PICK_UP', key: pick.key };
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

/**
 * Actions the steerer cannot take right now, with the reason (Book 10: carrying disables attacks;
 * Book 2 section 10: no weapon and no fighting in a movement verb, Stage 14).
 */
export function disabledActions(
  state: OnFootState,
): ReadonlyMap<string, 'CARRYING' | 'TRAVERSING'> {
  const reason =
    state.carrying !== null
      ? ('CARRYING' as const)
      : state.player.traverse != null || state.player.grip != null
        ? ('TRAVERSING' as const)
        : null;
  if (reason === null) return new Map();
  const actions =
    reason === 'CARRYING'
      ? (['useItem', 'finisher', 'shove', 'parry', 'block'] as const)
      : (['useItem', 'finisher', 'shove', 'parry', 'block', 'dodge', 'heal'] as const);
  return new Map(actions.map((a) => [a, reason]));
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
