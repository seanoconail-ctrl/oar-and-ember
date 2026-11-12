/**
 * Draws an on-foot zone (Book 7 sections 01, 13 and 14): the dual-grid ground under a camera that
 * follows the steerer, flat decoration, plants that lean in the wind and part round walkers, the
 * zone's props, its wildlife, the people with their idles, and footprints and particles, sorted by
 * their feet. With a visual state it also describes the living-world effects (water over the
 * tide, ground shadows, cloud shadows, grade) for the WebGL renderer.
 *
 * Pure: the browser view and the CPU render check both use it. Nothing here reads or changes the
 * simulation beyond the view it is given.
 */
import type { Id } from '../core/ids.ts';
import { phaseOf, TILE, tileState, visualCorners } from '../render/autotile.ts';
import { hash01 } from '../render/noise.ts';
import type { Anim } from '../render/sheet.ts';
import type {
  LightPool,
  Phase,
  Scene,
  SceneEffects,
  SceneSprite,
  ShadowCaster,
  Wade,
} from '../render/scene.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport.ts';
import { gustGrid, plantLean, STRAND_WIND, SWAY_CALM, SWAY_PERIOD } from '../render/wind.ts';
import type { Wind } from '../render/wind.ts';
import { itemShown } from '../sim/land/onFoot.ts';
import type { FactView, OnFootActor, OnFootState } from '../sim/land/onFoot.ts';
import { direction16, drawnHeight, MISSILE_DIRECTIONS } from '../sim/land/missiles.ts';
import type { ZoneMap } from '../sim/land/zoneMap.ts';
import type { DepthBand } from '../content/balance.ts';
import type { ZoneLife } from '../content/zoneMap.ts';
import { PLANT_KINDS } from '../content/zoneMap.ts';
import type { PeopleLook, PersonLook } from './people.ts';
import type { Fighter } from '../sim/combat/fighter.ts';

export type { PeopleLook, PersonLook } from './people.ts';

export const GROUND_SHEET = 'tile_strand';
export const PLANT_SHEET = 'plant_strand';
export const FX_SHEET = 'fx_strand';
/** People's own particles and prints: dust, splashes, ripple rings, drips, surf spray (Book 7 07). */
export const PEOPLE_FX_SHEET = 'fx_people';
export const MARKER_SHEET = 'ui_marker';
/** Missiles in flight and at rest (Book 10 section 21), and the glint on things to pick up. */
export const MISSILE_SHEET = 'fx_missile';
export const GLINT_SHEET = 'fx_glint';
/** The starting weapons lying on the strand: one state per item, named as its hotbar icon. */
export const PICKUP_SHEET = 'prop_pickup';
/** The broch and other buildings drawn in bands of ground rows (assets/art/buildings.json). */
export const BROCH_SHEET = 'bld_broch';
export const BROCH_FLOOR_SHEET = 'decal_broch';
export const CAMP_SHEET = 'prop_camp';
/** Pieces of driftwood lying to be picked up (decision PT-5). */
export const DRIFTWOOD_SHEET = 'prop_driftwood';
/** Stage 10: the Hag's Seat's light and the Kelda Spring's bubbles; the weeping stone. */
export const SOUTH_FX_SHEET = 'fx_south';
export const HAGSTONE_SHEET = 'prop_hagstone';
/** Stage 11: Seal Cave's cliff face (strips) and the dark inside its arch. */
export const SEALCAVE_SHEET = 'bld_sealcave';
export const SEALCAVE_FX_SHEET = 'fx_sealcave';
export const FIRE_SHEET = 'fx_fire';
/** Seconds between glints on something lying to be picked up. */
const GLINT_EVERY = 2.6;
/** The plant sheet's frames lean -3..3; frame 3 is upright. */
const UPRIGHT = 3;

export type SheetAnims = ReadonlyMap<string, Readonly<Record<string, Anim>>>;
export type SheetShadows = ReadonlyMap<string, { readonly w: number; readonly h: number } | null>;

function frameIndex(anims: SheetAnims, sheet: string, state: string, tick: number): number {
  const anim = anims.get(sheet)?.[state];
  if (anim === undefined) return 0;
  const i = Math.floor(tick / anim.ticks);
  return anim.loop ? i % anim.frames : Math.min(i, anim.frames - 1);
}

/** The camera's top-left corner in zone pixels: centred on the steerer, kept inside the zone. */
export function cameraFor(map: ZoneMap, at: { x: number; y: number }): { x: number; y: number } {
  return clampCamera(map, at.x - LOGICAL_WIDTH / 2, at.y - 20 - LOGICAL_HEIGHT / 2);
}

export function clampCamera(map: ZoneMap, x: number, y: number): { x: number; y: number } {
  const maxX = map.width * map.tile - LOGICAL_WIDTH;
  const maxY = map.height * map.tile - LOGICAL_HEIGHT;
  return {
    x: Math.round(Math.min(maxX, Math.max(0, x))),
    y: Math.round(Math.min(maxY, Math.max(0, y))),
  };
}

/** The dual-grid ground tiles in view, camera-relative (each visual tile sits half a tile up-left). */
/** Each visual tile's frame name, built once per map. */
const groundCache = new WeakMap<ZoneMap, string[]>();
function groundFrames(map: ZoneMap): string[] {
  let names = groundCache.get(map);
  if (names === undefined) {
    names = [];
    for (let j = 0; j <= map.height; j++)
      for (let i = 0; i <= map.width; i++)
        names.push(`${tileState(visualCorners(map.rows, i, j), phaseOf(i, j))}/-/0`);
    groundCache.set(map, names);
  }
  return names;
}

export function groundSprites(map: ZoneMap, camera: { x: number; y: number }): SceneSprite[] {
  const out: SceneSprite[] = [];
  const names = groundFrames(map);
  const i0 = Math.floor((camera.x + TILE / 2) / TILE);
  const j0 = Math.floor((camera.y + TILE / 2) / TILE);
  for (let j = j0; j <= j0 + Math.ceil(LOGICAL_HEIGHT / TILE); j++) {
    for (let i = i0; i <= i0 + Math.ceil(LOGICAL_WIDTH / TILE); i++) {
      if (i < 0 || j < 0 || i > map.width || j > map.height) continue;
      out.push({
        sheet: GROUND_SHEET,
        frame: names[j * (map.width + 1) + i] ?? '',
        x: i * TILE - TILE / 2 - camera.x,
        y: j * TILE - TILE / 2 - camera.y,
        layer: 'ground',
      });
    }
  }
  return out;
}

/**
 * Decals and plants bucketed by tile row, built once per map, so a frame reads only what is in
 * view. Plants in each row are sorted by their foot line (so the draw list's sort finds them in
 * order), and carry their sway phase and frame names precomputed.
 */
interface IndexedPlant {
  readonly x: number;
  readonly y: number;
  readonly phase: number;
  readonly tall: boolean;
  /** sin and cos of the two sway phases (swayAt, by angle addition: no trig per frame). */
  readonly s1: number;
  readonly c1: number;
  readonly s2: number;
  readonly c2: number;
  /** Frame names for leans -3..3. */
  readonly frames: readonly string[];
  /** The line it sorts on, if not its foot: turf on a raised thing (the cairn) sorts with it. */
  readonly sort?: number;
}
interface ZoneIndex {
  readonly decals: readonly (readonly (readonly [number, number, number])[])[];
  readonly plants: readonly (readonly IndexedPlant[])[];
}
const indexCache = new WeakMap<ZoneMap, ZoneIndex>();
function zoneIndex(map: ZoneMap): ZoneIndex {
  const hit = indexCache.get(map);
  if (hit !== undefined) return hit;
  const decals = Array.from({ length: map.height + 2 }, () => [] as [number, number, number][]);
  const plants = Array.from({ length: map.height + 2 }, () => [] as IndexedPlant[]);
  const names = new Map<string, string[]>();
  for (const d of map.decals) decals[Math.max(0, Math.floor(d[2] / TILE))]?.push([...d]);
  for (const [k, x, y, v, sort] of map.plants) {
    const kind = PLANT_KINDS[k] ?? 'grass';
    const state = `${kind}${v}`;
    let frames = names.get(state);
    if (frames === undefined) {
      frames = Array.from({ length: 7 }, (_, i) => `${state}/-/${i}`);
      names.set(state, frames);
    }
    plants[Math.max(0, Math.floor(y / TILE))]?.push({
      x,
      y,
      phase: hash01(x, y, 5),
      s1: Math.sin(hash01(x, y, 5) * 2 * Math.PI),
      c1: Math.cos(hash01(x, y, 5) * 2 * Math.PI),
      s2: Math.sin(hash01(x, y, 5) * 3.1 * 2 * Math.PI),
      c2: Math.cos(hash01(x, y, 5) * 3.1 * 2 * Math.PI),
      tall: kind === 'marram' || kind === 'tussock',
      frames,
      // Just after the band it grows on (Stage 10: the turf on the Hollow Cairn).
      ...(sort === undefined ? {} : { sort: sort + 0.5 }),
    });
  }
  for (const row of plants) row.sort((a, b) => a.y - b.y || a.x - b.x);
  const index = { decals, plants };
  indexCache.set(map, index);
  return index;
}

export interface Walker {
  readonly x: number;
  readonly y: number;
}

/** Flat decoration in view. */
export function decalSprites(map: ZoneMap, camera: { x: number; y: number }): SceneSprite[] {
  const out: SceneSprite[] = [];
  const index = zoneIndex(map);
  const r0 = Math.max(0, Math.floor(camera.y / TILE) - 1);
  const r1 = Math.floor((camera.y + LOGICAL_HEIGHT) / TILE) + 1;
  for (let r = r0; r <= r1; r++) {
    for (const [f, x, y] of index.decals[r] ?? []) {
      if (x < camera.x - 12 || x > camera.x + LOGICAL_WIDTH + 12) continue;
      const name = map.decalFrames[f];
      if (name === undefined) continue;
      const [sheet = '', frame = ''] = name.split(' ');
      out.push({ sheet, frame, x: x - camera.x, y: y - camera.y, layer: 'decal' });
    }
  }
  return out;
}

/** Plants in view, each leaning with the wind, its own sway and anyone walking through it. */
export function plantSprites(
  map: ZoneMap,
  camera: { x: number; y: number },
  seconds: number,
  wind: Wind,
  walkers: readonly Walker[],
  reducedMotion: boolean,
  /** Share of plants drawn (low effect detail draws fewer, AP-16). */
  share = 1,
  /** A circle of the world (px) where no plant grows: a cleared floor (Stage 7's S1 court). */
  cleared: { readonly x: number; readonly y: number; readonly r: number } | null = null,
): SceneSprite[] {
  const out: SceneSprite[] = [];
  const index = zoneIndex(map);
  const r0 = Math.max(0, Math.floor(camera.y / TILE) - 1);
  const r1 = Math.floor((camera.y + LOGICAL_HEIGHT + 16) / TILE) + 1;
  const near: Walker[] = [];
  const gust = gustGrid(
    wind,
    camera.x - 16,
    camera.y - 16,
    LOGICAL_WIDTH + 32,
    LOGICAL_HEIGHT + 48,
    seconds,
  );
  const a1 = (seconds / SWAY_PERIOD) * 2 * Math.PI;
  const a2 = (seconds / (SWAY_PERIOD * 0.47)) * 2 * Math.PI;
  const sa1 = Math.sin(a1);
  const ca1 = Math.cos(a1);
  const sa2 = Math.sin(a2);
  const ca2 = Math.cos(a2);
  for (let r = r0; r <= r1; r++) {
    for (const plant of index.plants[r] ?? []) {
      const { x, y } = plant;
      if (x < camera.x - 10 || x > camera.x + LOGICAL_WIDTH + 10) continue;
      if (share < 1 && plant.phase >= share) continue;
      if (cleared !== null && Math.hypot(x - cleared.x, y - cleared.y) < cleared.r) continue;
      near.length = 0;
      for (const w of walkers) if (Math.abs(w.x - x) < 12 && Math.abs(w.y - y) < 8) near.push(w);
      // The same lean as plantLean (render/wind.ts), inlined for the thousands of plants a
      // frame: the sway's sines by angle addition from the frame's own sin and cos.
      const g = gust(x, y);
      const push = wind.dirX * wind.strength * (0.6 + (plant.tall ? 2.6 : 1.9) * g);
      const sw = (sa1 * plant.c1 + ca1 * plant.s1) * 0.7 + (sa2 * plant.c2 + ca2 * plant.s2) * 0.3;
      let lean = push + sw * (reducedMotion ? 0.35 : SWAY_CALM + 0.6 * g);
      for (const w of near) {
        const dx = x - w.x;
        const dy = (y - w.y) * 1.6;
        const d = Math.hypot(dx, dy);
        if (d < 11) lean += Math.sign(Math.abs(dx) > 0.5 ? dx : 1) * ((11 - d) / 11) * 4.5;
      }
      lean = Math.max(-3, Math.min(3, Math.round(lean)));
      out.push({
        sheet: PLANT_SHEET,
        frame: plant.frames[UPRIGHT + lean] ?? '',
        x: x - camera.x,
        y: y - camera.y,
        layer: 'actor',
        ...(plant.sort === undefined ? {} : { sort: plant.sort - camera.y }),
      });
    }
  }
  return out;
}

/** A sprite of the wildlife and its shadow, at a moment of the visual clock. */
export interface LifeSprite {
  readonly sprite: SceneSprite;
  readonly lift: number;
}

/** Wildlife: gulls wheeling and standing, a cormorant drying its wings, a seal, crabs. */
export function lifeSprites(
  life: readonly ZoneLife[],
  camera: { x: number; y: number },
  seconds: number,
  night = false,
): LifeSprite[] {
  const out: LifeSprite[] = [];
  life.forEach((l, n) => {
    const cx = l.x * TILE;
    const cy = l.y * TILE;
    const seed = hash01(n, Math.round(cx), Math.round(cy));
    const t = seconds + seed * 100;
    if (l.kind === 'gull') {
      // Wheeling on the wind: a slow loop, gliding most of the way, flapping on the climb.
      const radius = (l.r ?? 3) * TILE;
      const speed = 0.18 + seed * 0.08;
      const a = t * speed * (n % 2 === 0 ? 1 : -1);
      const x = cx + Math.cos(a) * radius + Math.sin(a * 2.3) * 10;
      const y = cy + Math.sin(a) * radius * 0.55;
      const vx = -Math.sin(a) * (n % 2 === 0 ? 1 : -1);
      const climbing = Math.sin(a * 2 + seed * 6) > 0.2;
      const frame = climbing ? Math.floor(t * 9) % 4 : 1;
      const lift = 34 + Math.sin(a * 1.7) * 8;
      out.push({
        lift,
        sprite: {
          sheet: 'actor_gull',
          frame: `fly/${vx >= 0 ? 'e' : 'w'}/${frame}`,
          x: x - camera.x,
          y: y - lift - camera.y,
          layer: 'actor',
          sort: 1e6 + n,
        },
      });
      return;
    }
    if (l.kind === 'gull_standing') {
      const turn = Math.floor(t / 3.2) % 3 === 0 ? 1 : 0;
      const facing = Math.floor(t / 7.1) % 2 === 0 ? 'e' : 'w';
      out.push({
        lift: 0,
        sprite: {
          sheet: 'actor_gull',
          frame: `stand/${facing}/${turn}`,
          x: cx - camera.x,
          y: cy - camera.y,
          layer: 'actor',
        },
      });
      return;
    }
    if (l.kind === 'cormorant') {
      const stir = Math.floor(t / 1.4) % 5 === 0 ? 1 : 0;
      out.push({
        lift: 0,
        sprite: {
          sheet: 'actor_cormorant',
          frame: `dry/e/${stir}`,
          x: cx - camera.x,
          y: cy - camera.y,
          layer: 'actor',
        },
      });
      return;
    }
    if (l.kind === 'seal') {
      const up = Math.floor(t / 4.3) % 3 === 0 ? 1 : 0;
      out.push({
        lift: 0,
        sprite: {
          sheet: 'actor_seal',
          frame: `rest/e/${up}`,
          x: cx - camera.x,
          y: cy - camera.y,
          layer: 'actor',
        },
      });
      return;
    }
    if (l.kind === 'spring') {
      // Stage 10: the Kelda Spring welling up, bubbles rising through its pool (Book 7: springs bubble).
      for (let k = 0; k < 3; k++) {
        const f = Math.floor((t + k * 0.37) / 0.11) % 6;
        out.push({
          lift: 0,
          sprite: {
            sheet: SOUTH_FX_SHEET,
            frame: `bubble/-/${f}`,
            x: cx + (k - 1) * 9 - camera.x,
            y: cy + (k % 2) * 5 - camera.y,
            layer: 'decal',
          },
        });
      }
      return;
    }
    if (l.kind === 'sheep') {
      // A ewe of the half-wild flock: grazing as she drifts slowly over the turf, head dipping and
      // lifting; lying chewing at night (Book 7 section 14, Life).
      const a = t * 0.045 + seed * 6;
      const x = cx + Math.sin(a) * 26 + Math.sin(a * 2.7) * 6;
      const y = cy + Math.sin(a * 0.7 + 1) * 9;
      const vx = Math.cos(a) * 26 + Math.cos(a * 2.7) * 16;
      const facing = vx >= 0 ? 'e' : 'w';
      const state = night ? 'lie' : 'graze';
      const frame = night ? Math.floor(t / 2.4) % 2 : Math.floor(t / 0.6) % 4;
      out.push({
        lift: 0,
        sprite: {
          sheet: 'actor_sheep',
          frame: `${state}/${facing}/${frame}`,
          x: (night ? cx : x) - camera.x,
          y: (night ? cy : y) - camera.y,
          layer: 'actor',
        },
      });
      return;
    }
    // A crab: a scuttle sideways, a pause, a scuttle back.
    const cycle = (t % 9) / 9;
    const along =
      cycle < 0.3 ? cycle / 0.3 : cycle < 0.5 ? 1 : cycle < 0.8 ? 1 - (cycle - 0.5) / 0.3 : 0;
    const moving = (cycle < 0.3 || (cycle >= 0.5 && cycle < 0.8)) && Math.floor(t * 8) % 2 === 0;
    out.push({
      lift: 0,
      sprite: {
        sheet: 'actor_crab',
        frame: `scuttle/e/${moving ? 1 : 0}`,
        x: cx + along * 18 - 9 - camera.x,
        y: cy - camera.y,
        layer: 'actor',
      },
    });
  });
  return out;
}

/** A person's animation state and frame. */
export interface PersonAnim {
  readonly state: string;
  readonly frame: number;
}

/** A person's water this frame: masked at a band's waterline, and how wet and dark they are. */
export interface PersonWater {
  readonly wade?: Wade;
  readonly band?: DepthBand | null;
  readonly dark: number;
}

/** A particle or footprint from the visual state, camera-independent (world pixels). */
export interface VisualMark {
  readonly sheet: string;
  readonly frame: string;
  readonly x: number;
  readonly y: number;
  readonly layer: 'decal' | 'actor';
  readonly sort?: number;
}

/** What the visual state adds to a frame (camera, clock, effects); absent in plain renders. */
export interface ZoneVisualView {
  readonly camera: { readonly x: number; readonly y: number };
  readonly seconds: number;
  readonly wind: Wind;
  readonly reducedMotion: boolean;
  /**
   * The steerer's animation: gait frames from distance walked (feet stay planted), the run's
   * start and stop, the bow's draw and loose, or an idle (idle, shift, glance, idlewind).
   */
  readonly steerer: PersonAnim | null;
  /** Water and wetness per person: 'P_STEERER' and each actor's id. */
  readonly water: Readonly<Record<string, PersonWater>>;
  readonly marks: readonly VisualMark[];
  /** Effects without the parts this scene fills in (shadows, camera, clock, wind). */
  readonly effects: Omit<SceneEffects, 'shadows' | 'camera' | 'seconds' | 'wind'> | null;
}

export interface ZoneSceneInput {
  readonly map: ZoneMap;
  readonly onFoot: OnFootState;
  readonly tick: number;
  readonly tideOpen: boolean;
  readonly phase: Phase;
  readonly look: PeopleLook;
  readonly anims: SheetAnims;
  /** Contact shadow size per sheet (the `shadow:` header); sheets without one cast none. */
  readonly shadows?: SheetShadows;
  /** The interaction target to mark, if any. */
  readonly highlight: Id | null;
  readonly visual?: ZoneVisualView;
  /** Capture only (`?actors=none`): leave people out, for preview backgrounds of the place. */
  readonly hidePeople?: boolean;
  /** Facts the zone reads: an item lying there shows once its `after` fact holds. */
  readonly facts?: FactView;
  /** Stage 10: the Hag's Seat stone weeps (the first supernatural sign). */
  readonly stoneWeeps?: boolean;
  /** Missiles: the hand's height they leave at (px), and each item's icon. */
  readonly missiles?: {
    readonly releaseHeight: number;
    readonly icons: Readonly<Record<string, string>>;
  };
  /** The camp at home, where this zone has it (Stage 7). */
  readonly camp?: CampScene;
  /** Stage 9: the gore setting (Book 7 section 12; presentation only): 0 off, 1 low, 2 full. */
  readonly gore?: 0 | 1 | 2;
  /** Stage 9: crew orders just taken, shown as an icon over each (person to order). */
  readonly orders?: Readonly<Record<string, string>>;
  /** Stage 9: the steerer below Book 10's bloodiedBelow (drawn with the blood layer). */
  readonly steererBloodied?: boolean;
  /** Stage 9: ticks a corpse takes to fade with the gore setting low (and off). */
  readonly corpseFade?: { readonly low: number; readonly off: number };
}

/** Stage 9: the gore sheet (Book 7 section 12) and the crew's order icons. */
export const GORE_SHEET = 'fx_gore';
export const ORDER_SHEET = 'ui_order';

/**
 * The animation state and frame a fighter is drawn with (Book 2 section 12's states on the Stage 9
 * sheets): the raised weapon (the tell) while the charge begins, the charge held (or walked),
 * each strike's three frames by its phase, the defences, the stagger, the surrendered, the downed
 * and the dead (with its dismemberment); null when the fighter is at ease (walk, run and idle as
 * before).
 */
export function fightAnim(
  f: Fighter,
  tick: number,
  moving: boolean,
  own: Readonly<Record<string, Anim>>,
  extra: { readonly piece?: string | null; readonly finishing?: boolean } = {},
): PersonAnim | null {
  const has = (s: string): boolean => own[s] !== undefined;
  const loop = (s: string): number => {
    const a = own[s];
    return a === undefined ? 0 : Math.floor(tick / a.ticks) % a.frames;
  };
  if (extra.finishing === true && has('finish')) return { state: 'finish', frame: 0 };
  const phase3 = (): number => (tick < f.activeAt ? 0 : tick < f.activeEnd ? 1 : 2);
  switch (f.state) {
    case 'chargeL0':
      if (tick - f.since < 6 && has('windup'))
        return { state: 'windup', frame: tick - f.since < 3 ? 0 : 1 };
      return has('charge')
        ? {
            state: moving && has('chargewalk') ? 'chargewalk' : 'charge',
            frame: loop(moving ? 'chargewalk' : 'charge'),
          }
        : null;
    case 'chargeL1':
    case 'chargeL2':
      return has('charge')
        ? {
            state: moving && has('chargewalk') ? 'chargewalk' : 'charge',
            frame: loop(moving ? 'chargewalk' : 'charge'),
          }
        : null;
    case 'light1':
    case 'light2':
    case 'light3':
    case 'riposte': {
      const s = f.state === 'riposte' ? 'light1' : f.state;
      return has(s) ? { state: s, frame: phase3() } : null;
    }
    case 'heavyRelease':
      return has('heavy') ? { state: 'heavy', frame: phase3() } : null;
    case 'shove':
      return has('shove') ? { state: 'shove', frame: phase3() } : null;
    case 'parry':
      return has('parry') ? { state: 'parry', frame: 0 } : null;
    case 'parryRecovery':
      return has('parry') ? { state: 'parry', frame: 1 } : null;
    case 'block':
      return has('block') ? { state: 'block', frame: 0 } : null;
    case 'blockStun':
      return has('block') ? { state: 'block', frame: 1 } : null;
    case 'dodge': {
      const t = (tick - f.since) / Math.max(1, f.recoveryEnd - f.since);
      return has('dodge') ? { state: 'dodge', frame: t < 0.25 ? 0 : t < 0.7 ? 1 : 2 } : null;
    }
    case 'stagger':
    case 'guardBroken': {
      const t = (tick - f.since) / Math.max(1, f.recoveryEnd - f.since);
      return has('stagger') ? { state: 'stagger', frame: t < 0.5 ? 0 : 1 } : null;
    }
    case 'surrendered':
      return has('surrender') ? { state: 'surrender', frame: loop('surrender') } : null;
    case 'downed':
      return has('downed')
        ? { state: 'downed', frame: loop('downed') }
        : has('down')
          ? { state: 'down', frame: loop('down') }
          : null;
    case 'dead': {
      const s = extra.piece == null ? 'dead' : `dead_${extra.piece}`;
      return has(s) ? { state: s, frame: 0 } : has('dead') ? { state: 'dead', frame: 0 } : null;
    }
    default:
      return null;
  }
}

/** Whether a person is bloodied (Book 10 bloodiedBelow), and so drawn with their blood layer. */
function withoutBlood(look: PersonLook): PersonLook {
  const layers: Record<string, readonly string[]> = {};
  for (const [facing, sheets] of Object.entries(look.layers))
    layers[facing] = sheets.filter((n) => !n.startsWith('layer_blood_'));
  return { body: look.body, layers };
}

/** What the scene draws of the camp: the broch, the stage's props, the fire and its light. */
export interface CampScene {
  /** The props of the camp's stage in this zone (tiles, at the foot). */
  readonly props: readonly {
    sheet: string;
    frame: string;
    x: number;
    y: number;
    flat?: boolean;
    /** Stage 11: drawn this many px after its foot line (the boat's layers over its hull). */
    after?: number;
  }[];
  readonly stage: string;
  /** The fire, in tiles: lit or not, and its fuel in loads (it burns low as it runs out). */
  readonly fire: {
    readonly x: number;
    readonly y: number;
    readonly lit: boolean;
    readonly fuel: number;
  } | null;
  /** The camp's driftwood: where it is stacked (tiles) and how many loads. */
  readonly woodpile: { readonly x: number; readonly y: number; readonly loads: number } | null;
  /**
   * The pieces of driftwood lying in this zone (tiles, at the foot), each with its frame of
   * prop_driftwood (decision PT-2). A piece being picked up goes from the ground at the stoop's
   * lowest point.
   */
  readonly driftwood?: readonly {
    readonly key: string;
    readonly x: number;
    readonly y: number;
    readonly frame: string;
  }[];
  /** The work loop each task plays (Book 7 section 07): task ID to animation state. */
  readonly loops: Readonly<Record<string, string>>;
  /** The broch's bands: band height, the top band's offset from its centre, and how many. */
  readonly building: {
    readonly band: number;
    readonly top: number;
    readonly bands: number;
    /** The drawn parts of each band (assets/art/buildings.json), for the cutaway. */
    readonly boxes?: readonly (readonly (readonly [number, number, number, number])[])[];
    /** Grass and thrift on the wall head: [dx, dy] from the centre (px), band, kind (0 grass). */
    readonly tufts?: readonly (readonly [number, number, number, number])[];
  } | null;
  /** The fire's light by phase (assets/art/render.json): radius in px and colour added. */
  readonly light: FireLight | null;
}

export interface FireLight {
  readonly radius: Readonly<Record<Phase, number>>;
  readonly colour: Readonly<Record<Phase, readonly [number, number, number]>>;
  /** How much the radius flickers, as a share of it. */
  readonly flicker: number;
}

/** The frame a missile in flight is drawn with: its velocity on screen, the arc's rise included. */
export function flightFrame(
  p: OnFootState['projectiles'][number],
  releaseHeight: number,
): { dir: number; height: number } {
  const f = p.ticks > 0 ? p.t / p.ticks : 1;
  // d(height)/d(f): the arc's slope, and the hand's height fading out over the flight.
  const rise = 4 * p.apex * (1 - 2 * f) - releaseHeight;
  const vx = p.ux * p.length;
  const vy = p.uy * p.length - rise;
  return { dir: direction16(vx, vy), height: drawnHeight(p, releaseHeight) };
}

/** The frame of a missile at rest: what it is in, and its direction (in 8, or 4 lying). */
export function restFrame(s: OnFootState['stuck'][number]): string {
  const d8 = Math.round(s.dir / 2) % 8;
  if (s.broken) return `broken/-/${s.dir % 4}`;
  if (s.kind === 'spear') return `${s.in === 'ground' ? 'spear_ground' : 'spear_wood'}/-/${d8}`;
  switch (s.in) {
    case 'ground':
      return `stuck_ground/-/${d8}`;
    case 'stone':
      return `lying/-/${s.dir % 4}`;
    default:
      return `stuck_${s.in}/-/${d8}`;
  }
}

function steererState(onFoot: OnFootState): string {
  const p = onFoot.player;
  if (p.sleep != null) return 'sleep';
  if (onFoot.carrying !== null || p.gait === 'carry') return 'carry';
  if (p.aim !== null) return 'draw';
  if (!p.moving) return 'idle';
  return p.gait;
}

/** Where the target marker sits relative to the standard head height, by pose. */
const MARKER_OVER: Record<OnFootActor['pose'], { x: number; y: number }> = {
  idle: { x: 0, y: 0 },
  call: { x: 0, y: 0 },
  down: { x: 12, y: 22 },
  sit: { x: 0, y: 14 },
  carried: { x: 0, y: 0 },
  sleep: { x: 12, y: 22 },
  work: { x: 0, y: 6 },
  eat: { x: 0, y: 14 },
  watch: { x: 0, y: 0 },
  kneel: { x: 0, y: 6 },
  dead: { x: 12, y: 22 },
};

/** The animation state a pose is drawn with (a person calling waves and shouts: `call`). */
function poseState(
  actor: OnFootActor,
  anims: Readonly<Record<string, unknown>>,
  loops: Readonly<Record<string, string>>,
): string {
  const pose = actor.pose;
  if (pose === 'call') return anims['call'] === undefined ? 'idle' : 'call';
  // At work: the task's work loop, the same for the steerer and residents (Book 7 section 07).
  if (pose === 'work') {
    const loop = actor.task === undefined ? undefined : loops[actor.task];
    return loop !== undefined && anims[loop] !== undefined ? loop : 'idle';
  }
  if (pose === 'sleep' && anims['sleep'] === undefined) return 'down';
  // Stage 8: eating at the fire (sitting, if the sheet has no eating), watching from where they
  // stand braced in the wind, and kneeling at a habit.
  if (pose === 'eat') return anims['eat'] !== undefined ? 'eat' : 'sit';
  if (pose === 'watch') return anims['idlewind'] !== undefined ? 'idlewind' : 'idle';
  if (pose === 'kneel') return anims['kneel'] !== undefined ? 'kneel' : 'sit';
  return pose;
}

/** Ticks per second of the simulation (Book 2 section 06), for the plain renders' clock. */
const TICKS_PER_SECOND = 60;

export function zoneScene(input: ZoneSceneInput): Scene {
  const { map, onFoot, tick, anims, look } = input;
  const visual = input.visual;
  const p = onFoot.player;
  const camera = visual?.camera ?? cameraFor(map, p);
  const seconds = visual?.seconds ?? tick / TICKS_PER_SECOND;
  const wind = visual?.wind ?? STRAND_WIND;
  const reduced = visual?.reducedMotion ?? false;
  const shadowOf = (sheet: string) => input.shadows?.get(sheet) ?? null;
  const shadows: ShadowCaster[] = [];
  const cast = (sprite: SceneSprite, lift = 0): void => {
    const s = shadowOf(sprite.sheet);
    if (s === null) return;
    shadows.push({
      x: sprite.x,
      y: sprite.y,
      w: s.w,
      h: s.h,
      sheet: sprite.sheet,
      frame: sprite.frame,
      lift,
    });
  };

  const sprites: SceneSprite[] = groundSprites(map, camera);
  const pools: LightPool[] = [];
  sprites.push(...decalSprites(map, camera));
  const inView = (x: number, y: number): boolean =>
    x > -80 && y > -16 && x < LOGICAL_WIDTH + 80 && y < LOGICAL_HEIGHT + 100;
  for (const prop of map.props) {
    const x = prop.x * map.tile - camera.x;
    const y = prop.y * map.tile - camera.y;
    // Big built things (the cairn's bands) reach far above their foot.
    if (!(x > -260 && y > -16 && x < LOGICAL_WIDTH + 260 && y < LOGICAL_HEIGHT + 200)) continue;
    // Stage 10: the Hag's Seat weeps while her sign holds, the water running down it in a loop.
    let frame = prop.frame;
    if (prop.sheet === HAGSTONE_SHEET) {
      const state = input.stoneWeeps === true ? 'wet' : 'dry';
      frame = `${state}/-/${frameIndex(anims, HAGSTONE_SHEET, state, reduced ? 0 : tick)}`;
    }
    // Stage 11: the dark inside Seal Cave's mouth moves with light off the water.
    if (prop.sheet === SEALCAVE_FX_SHEET) {
      frame = `gloom/-/${frameIndex(anims, SEALCAVE_FX_SHEET, 'gloom', reduced ? 0 : tick)}`;
    }
    const built = prop.sheet === SEALCAVE_SHEET || prop.sheet === SEALCAVE_FX_SHEET;
    const sprite: SceneSprite = {
      sheet: prop.sheet,
      frame,
      x,
      y,
      layer: 'actor',
      tall: prop.sheet !== SEALCAVE_FX_SHEET,
      ...(prop.sort === undefined ? {} : { sort: prop.sort * map.tile - camera.y }),
    };
    sprites.push(sprite);
    // A cliff face and the dark in its mouth cast no shadow of their own on the cove.
    if (!built) cast(sprite);
    if (prop.sheet === HAGSTONE_SHEET && input.stoneWeeps === true) {
      // The pale light Runa followed, hanging by the stone and drifting (Book 7 section 09).
      const drift = Math.sin(seconds * 0.9) * 5;
      const bob = Math.sin(seconds * 1.7) * 3;
      const lx = x - 15 + drift;
      const ly = y - 34 + bob;
      sprites.push({
        sheet: SOUTH_FX_SHEET,
        frame: `wisp/-/${Math.floor(seconds / 0.1) % 8}`,
        x: lx,
        y: ly + 8,
        layer: 'actor',
        sort: y + 1,
      });
      pools.push({
        x: lx,
        y: ly,
        radius: 26 + 3 * Math.sin(seconds * 5.1),
        colour: [150, 210, 200],
      });
    }
  }
  for (const { sprite, lift } of lifeSprites(map.life, camera, seconds, input.phase === 'night')) {
    if (!inView(sprite.x, sprite.y + lift)) continue;
    sprites.push(sprite);
    cast(sprite, lift);
  }
  const camp = input.camp;
  const broch = map.broch;
  if (broch !== undefined && camp?.building != null) {
    // The broch in bands of ground rows, each sorted by its own foot (decision S7-12).
    const cx = broch.x * map.tile - camera.x;
    const cy = broch.y * map.tile - camera.y;
    const { band, top, bands } = camp.building;
    if (camp.stage !== 'S0')
      sprites.push({ sheet: BROCH_FLOOR_SHEET, frame: 'flags/-/0', x: cx, y: cy, layer: 'decal' });
    for (let k = 0; k < bands; k++) {
      const y = cy + top + band * k + band - 1;
      if (y < -40 || y > LOGICAL_HEIGHT + 140 || cx < -200 || cx > LOGICAL_WIDTH + 200) continue;
      sprites.push({
        sheet: BROCH_SHEET,
        frame: `wall/-/${k}`,
        x: cx,
        y,
        layer: 'actor',
        tall: true,
        ...(camp.building.boxes?.[k] === undefined ? {} : { boxes: camp.building.boxes[k] }),
      });
    }
    // The wall head's grass and thrift, in the full wind, each drawn just after its band.
    for (const [dx, dy, k, kind] of camp.building.tufts ?? []) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < -10 || x > LOGICAL_WIDTH + 10 || y < -10 || y > LOGICAL_HEIGHT + 10) continue;
      const phase = hash01(dx, dy, 7);
      const lean = plantLean(wind, x + camera.x, y + camera.y, seconds, phase, false, [], reduced);
      const v = Math.floor(hash01(dx, dy, 11) * 4);
      sprites.push({
        sheet: PLANT_SHEET,
        frame: `${kind === 1 ? 'thrift' : 'grass'}${v}/-/${UPRIGHT + lean}`,
        x,
        y,
        layer: 'actor',
        sort: cy + top + band * k + band - 1 + 0.5,
        tall: true,
      });
    }
  }
  if (camp !== undefined) {
    for (const prop of camp.props) {
      const x = prop.x * map.tile - camera.x;
      const y = prop.y * map.tile - camera.y;
      if (!inView(x, y)) continue;
      if (prop.flat === true) {
        // Flat on the ground: under the fire and anyone standing on it.
        sprites.push({ sheet: prop.sheet, frame: prop.frame, x, y, layer: 'decal' });
        continue;
      }
      // A prop with a loop of its own (the sails' ripples) plays it; others hold their frame.
      const [state = '', facing = '-'] = prop.frame.split('/');
      const loop = (anims.get(prop.sheet)?.[state]?.frames ?? 1) > 1;
      const sprite: SceneSprite = {
        sheet: prop.sheet,
        frame: loop
          ? `${state}/${facing}/${frameIndex(anims, prop.sheet, state, reduced ? 0 : tick)}`
          : prop.frame,
        x,
        y,
        layer: 'actor',
        tall: true,
        ...(prop.after === undefined ? {} : { sort: y + prop.after }),
      };
      sprites.push(sprite);
      cast(sprite);
    }
    for (const piece of camp.driftwood ?? []) {
      const x = piece.x * map.tile - camera.x;
      const y = piece.y * map.tile - camera.y;
      if (!inView(x, y)) continue;
      // Lifted at the stoop's lowest point: the work loop's third frame (Book 7 section 07).
      const w = p.work;
      if (w?.site === piece.key) {
        const loop = camp.loops[w.task] ?? 'gather';
        const per = anims.get(look.steerer.body)?.[loop]?.ticks ?? 8;
        if (tick - w.since >= per * 2) continue;
      }
      // The wrack caught on it stirs in the wind, out of step from piece to piece.
      const [state = 'log', facing = '-'] = piece.frame.split('/');
      const offset = Math.floor(hash01(piece.x, piece.y, 13) * 240);
      const sprite: SceneSprite = {
        sheet: DRIFTWOOD_SHEET,
        frame: `${state}/${facing}/${frameIndex(anims, DRIFTWOOD_SHEET, state, reduced ? 0 : tick + offset)}`,
        x,
        y,
        layer: 'actor',
      };
      sprites.push(sprite);
      cast(sprite);
    }
    const pile = camp.woodpile;
    if (pile !== null && pile.loads >= 1) {
      // The stack grows with the loads gathered: four sizes (prop_camp woodpile).
      const size = pile.loads >= 6 ? 3 : pile.loads >= 3 ? 2 : pile.loads >= 2 ? 1 : 0;
      const sprite: SceneSprite = {
        sheet: CAMP_SHEET,
        frame: `woodpile/-/${size}`,
        x: pile.x * map.tile - camera.x,
        y: pile.y * map.tile - camera.y,
        layer: 'actor',
      };
      sprites.push(sprite);
      cast(sprite);
    }
    const fire = camp.fire;
    if (fire !== null) {
      const x = fire.x * map.tile - camera.x;
      const y = fire.y * map.tile - camera.y;
      if (!fire.lit) {
        // Laid and ready, or a cold ring: the laid logs show once driftwood is at hand.
        if (pile !== null && pile.loads >= 1)
          sprites.push({
            sheet: CAMP_SHEET,
            frame: 'laid/-/0',
            x,
            y: y - 1,
            layer: 'actor',
            sort: y + 0.2,
          });
      } else {
        const low = fire.fuel < 0.25;
        sprites.push({
          sheet: CAMP_SHEET,
          frame: 'laid/-/0',
          x,
          y: y - 1,
          layer: 'actor',
          sort: y + 0.2,
        });
        const state = low ? 'embers' : 'flames';
        const f = frameIndex(anims, FIRE_SHEET, state, tick);
        sprites.push({
          sheet: FIRE_SHEET,
          frame: `${state}/-/${f}`,
          x,
          y: y + 1,
          layer: 'actor',
          sort: y + 0.3,
        });
        // Its light: a warm pool that flickers (Book 7 section 14), bigger in the dark.
        const light = camp.light;
        if (light !== null) {
          const phase = input.phase;
          const flick =
            1 +
            light.flicker *
              (0.6 * Math.sin(seconds * 11.3) +
                0.3 * Math.sin(seconds * 23.7 + 1.3) +
                0.1 * Math.sin(seconds * 41.1));
          const radius = light.radius[phase] * flick * (low ? 0.6 : 1);
          if (radius > 1) pools.push({ x, y: y - 6, radius, colour: light.colour[phase] });
        }
      }
    }
  }

  /**
   * A person as their layers (Book 2 section 19): every sheet of the facing's order at the same
   * anchor and frame, pushed together so the draw list's stable sort keeps them in order. The
   * body casts the person's one shadow.
   */
  const person = (
    who: PersonLook,
    frame: string,
    facing: string,
    x: number,
    y: number,
    water: PersonWater | undefined,
    opts: { focus?: boolean; shadow?: boolean },
  ): SceneSprite | null => {
    let bodySprite: SceneSprite | null = null;
    for (const sheet of who.layers[facing] ?? [who.body]) {
      const sprite: SceneSprite = {
        sheet,
        frame,
        x,
        y,
        layer: 'actor',
        ...(opts.focus === true && sheet === who.body ? { focus: true } : {}),
        ...(water?.wade === undefined ? {} : { wade: water.wade }),
        ...(water === undefined || water.dark <= 0 ? {} : { dark: water.dark }),
      };
      sprites.push(sprite);
      if (sheet === who.body) bodySprite = sprite;
    }
    if (bodySprite !== null && opts.shadow !== false) cast(bodySprite);
    return bodySprite;
  };

  // The steerer, and while carrying, the carried person drawn over their shoulders.
  const body = look.steerer.body;
  let state = steererState(onFoot);
  let stepFrame = p.moving ? frameIndex(anims, body, state, tick) : 0;
  const loops = input.camp?.loops ?? {};
  const work = p.work;
  if (work != null) {
    // A task under way: its work loop from when it began (feet planted).
    state = loops[work.task] ?? 'idle';
    stepFrame = frameIndex(anims, body, state, tick - work.since);
  } else if (state === 'sleep') {
    stepFrame = frameIndex(anims, body, 'sleep', tick);
  } else if (visual?.steerer != null) {
    state = visual.steerer.state;
    stepFrame = visual.steerer.frame;
  } else if (state === 'idle' || state === 'draw') stepFrame = frameIndex(anims, body, state, tick);
  // A cast line's end in the water: a ring where it went in (Book 7 section 07: casting and hauling).
  if (work != null && loops[work.task] === 'fish') {
    const ring = frameIndex(anims, PEOPLE_FX_SHEET, 'ripple', tick - work.since);
    sprites.push({
      sheet: PEOPLE_FX_SHEET,
      frame: `ripple/-/${ring}`,
      x: work.at.x - camera.x,
      y: work.at.y - camera.y,
      layer: 'decal',
    });
  }
  // Stage 9: the steerer's fight (a blow, a defence, the downed and the dead) over the gait.
  const gore = input.gore ?? 2;
  const steererFight = p.fight ?? null;
  if (steererFight !== null && work == null && p.sleep == null) {
    const fa = fightAnim(steererFight, tick, p.moving, anims.get(body) ?? {});
    if (fa !== null) {
      state = fa.state;
      stepFrame = fa.frame;
    }
  }
  const steererLook =
    gore > 0 && input.steererBloodied === true ? look.steerer : withoutBlood(look.steerer);
  if (input.hidePeople !== true)
    person(
      steererLook,
      `${state}/${p.facing}/${stepFrame}`,
      p.facing,
      p.x - camera.x,
      p.y - camera.y,
      visual?.water['P_STEERER'],
      { focus: true },
    );
  /** The charged heavy's two tells over the raised weapon (Book 2 section 12). */
  const chargeTell = (f: Fighter, x: number, y: number): void => {
    if (f.state !== 'chargeL1' && f.state !== 'chargeL2') return;
    const level2 = f.state === 'chargeL2';
    const i = Math.floor((tick - f.since) / 4);
    const sheet = level2 ? GORE_SHEET : GLINT_SHEET;
    const frames = level2 ? 4 : 5;
    const k = level2 ? i % frames : Math.min(frames - 1, i % (frames + 3));
    if (k >= frames) return;
    const side = f.facing === 'w' ? -6 : f.facing === 'e' ? 6 : f.facing === 'n' ? 5 : -5;
    sprites.push({
      sheet,
      frame: `${level2 ? 'tell' : 'glint'}/-/${k}`,
      x: x + side,
      y: y - 34,
      layer: 'actor',
      sort: y + 0.9,
    });
  };
  if (steererFight !== null && input.hidePeople !== true)
    chargeTell(steererFight, p.x - camera.x, p.y - camera.y);
  const walkers: Walker[] = [{ x: p.x, y: p.y }];
  for (const [id, actor] of Object.entries(onFoot.actors)) {
    const who = look.people[id];
    const x = actor.x - camera.x;
    const y = actor.y - camera.y;
    const fa = actor.fight;
    // A corpse fades with the gore setting low (after a minute) or off (Book 7 section 12).
    const faded =
      fa?.dead != null &&
      gore < 2 &&
      input.corpseFade !== undefined &&
      tick - fa.dead.tick >= (gore === 1 ? input.corpseFade.low : input.corpseFade.off);
    if (who !== undefined && inView(x, y) && input.hidePeople !== true && !faded) {
      const own = anims.get(who.body) ?? {};
      const bloodied = gore > 0 && fa !== undefined && (fa.bloodied || fa.dead !== null);
      const drawn = bloodied ? who : withoutBlood(who);
      const fightPose =
        fa === undefined
          ? null
          : fightAnim(fa.f, tick, actor.moving === true, own, {
              piece: gore === 2 ? (fa.dead?.piece?.toLowerCase() ?? null) : null,
              finishing: fa.finishing !== null,
            });
      if (fa?.dead != null && gore > 0) {
        // The pool under the dead grows (Book 7 section 12): fewer and darker with gore low.
        const age = tick - fa.dead.tick;
        const pool = gore === 2 ? 'pool' : 'pool_low';
        sprites.push({
          sheet: GORE_SHEET,
          frame: `${pool}/-/${Math.min(4, Math.floor(age / 50))}`,
          x: x + (actor.facing === 'w' || actor.facing === 'n' ? -3 : 3),
          y: y - 2,
          layer: 'decal',
        });
        // The piece a dismembering blow took: thrown, a bounce, then still.
        const piece = fa.dead.piece;
        if (piece !== null && gore === 2) {
          const a = (fa.dead.dir / 16) * 2 * Math.PI;
          const t = Math.min(1, age / 24);
          const lift =
            age < 24
              ? Math.sin(t * Math.PI) * 6
              : age < 36
                ? Math.sin(((age - 24) / 12) * Math.PI) * 2
                : 0;
          person(
            who,
            `piece_${piece.toLowerCase()}/${actor.facing}/0`,
            actor.facing,
            x + Math.cos(a) * 16 * t,
            y + Math.sin(a) * 8 * t - lift,
            undefined,
            { shadow: false },
          );
        }
      } else if (fa?.f.state === 'downed' && gore > 0) {
        sprites.push({
          sheet: GORE_SHEET,
          frame: `${gore === 2 ? 'pool' : 'pool_low'}/-/1`,
          x,
          y: y - 2,
          layer: 'decal',
        });
      }
      if (fightPose !== null && actor.pose !== 'carried') {
        person(
          drawn,
          `${fightPose.state}/${actor.facing}/${fightPose.frame}`,
          actor.facing,
          x,
          y,
          visual?.water[id],
          {},
        );
        walkers.push({ x: actor.x, y: actor.y });
      } else if (actor.pose === 'carried' && onFoot.carrying !== id) {
        // Carried by someone else (a crew order to carry): over their shoulders.
        const carrier = Object.values(onFoot.actors).find((o) => o.carries === id);
        const f = carrier?.facing ?? actor.facing;
        person(
          drawn,
          `carried/${f}/${Math.min(frameIndex(anims, who.body, 'carried', tick), (own['carried']?.frames ?? 1) - 1)}`,
          f,
          x,
          y + 0.5,
          undefined,
          { shadow: false },
        );
      } else if (actor.pose === 'carried') {
        // Carried across the shoulders, in step with the carry walk; drawn just in front.
        const carriedFrame = Math.min(stepFrame, (own['carried']?.frames ?? 1) - 1);
        person(
          who,
          `carried/${p.facing}/${carriedFrame}`,
          p.facing,
          x,
          y + 0.5,
          visual?.water['P_STEERER'],
          { shadow: false },
        );
      } else {
        // A wader stepping to keep their footing walks; otherwise the pose's own animation.
        // Carrying someone (Bran with Thorkel, Stage 10): the carry walk.
        const st0 =
          actor.carries !== undefined && own['carry'] !== undefined
            ? 'carry'
            : actor.moving === true && own['walk'] !== undefined
              ? 'walk'
              : poseState(actor, own, input.camp?.loops ?? {});
        // A pose the sheet has no drawing for (a chest set down) is drawn lying, or standing.
        const st = own[st0] !== undefined ? st0 : own['down'] !== undefined ? 'down' : 'idle';
        const frame = frameIndex(anims, who.body, st, tick);
        person(drawn, `${st}/${actor.facing}/${frame}`, actor.facing, x, y, visual?.water[id], {});
        walkers.push({ x: actor.x, y: actor.y });
      }
      // A crew order taken: its icon a moment over the head.
      const order = input.orders?.[id];
      if (order !== undefined)
        sprites.push({
          sheet: ORDER_SHEET,
          frame: `${order}/-/0`,
          x,
          y: y - 10,
          layer: 'actor',
          sort: y + 0.8,
        });
      // The charge's tells (Book 10: a glint at level 1, a flash at level 2) on the weapon.
      if (fa !== undefined) chargeTell(fa.f, x, y);
    }
    if (input.highlight === id && actor.pose !== 'carried') {
      const bob = frameIndex(anims, MARKER_SHEET, 'bob', tick);
      // The marker sits over the head: lower for someone lying or sitting (art layout).
      const over = MARKER_OVER[actor.pose];
      sprites.push({
        sheet: MARKER_SHEET,
        frame: `bob/-/${bob}`,
        x: actor.x - camera.x + over.x * (actor.facing === 'w' ? -1 : 1),
        y: actor.y - camera.y + 1 - 8 + over.y,
        layer: 'actor',
      });
    }
  }
  // Items lying to be picked up, with a glint every few seconds.
  const facts = input.facts ?? {};
  for (const item of onFoot.items) {
    if (!itemShown(item, facts)) continue;
    const x = item.x * map.tile - camera.x;
    const y = item.y * map.tile - camera.y;
    if (!inView(x, y)) continue;
    // The item's hotbar icon names its state; without the table, its ID does (ITEM_SEAX: seax).
    const icon = input.missiles?.icons[item.item] ?? item.item.replace(/^ITEM_/, '').toLowerCase();
    const sprite: SceneSprite = { sheet: PICKUP_SHEET, frame: `${icon}/-/0`, x, y, layer: 'actor' };
    sprites.push(sprite);
    cast(sprite);
    if (item.glint === true) {
      const g = anims.get(GLINT_SHEET)?.['glint'];
      const frames = g?.frames ?? 5;
      const phase = (seconds + hash01(item.x, item.y, 9) * GLINT_EVERY) % GLINT_EVERY;
      const i = Math.floor((phase * TICKS_PER_SECOND) / (g?.ticks ?? 4));
      if (i < frames)
        sprites.push({
          sheet: GLINT_SHEET,
          frame: `glint/-/${i}`,
          x: x + 4,
          y: y - 6,
          layer: 'actor',
          sort: y + 0.5,
        });
    }
  }
  // Missiles at rest: in the ground, in props, at the foot of stone, and in people.
  const personAt = (id: string): { x: number; y: number } | undefined =>
    id === 'P_STEERER' ? p : onFoot.actors[id];
  for (const st of onFoot.stuck) {
    const who = st.target === undefined ? undefined : personAt(st.target);
    if (st.target !== undefined && who === undefined) continue;
    if (
      who !== undefined &&
      st.target !== undefined &&
      onFoot.actors[st.target]?.pose === 'carried'
    )
      continue;
    const gx = st.x + (who?.x ?? 0);
    const gy = st.y + (who?.y ?? 0);
    const x = gx - camera.x;
    const y = gy - camera.y;
    if (!inView(x, y)) continue;
    sprites.push({
      sheet: MISSILE_SHEET,
      frame: restFrame(st),
      x,
      y: y - st.h,
      layer: 'actor',
      // In a person, drawn just in front of them; otherwise by its own foot.
      sort: gy - camera.y + (who === undefined ? 0 : 0.6),
    });
  }
  // Missiles in flight: drawn above their ground track, with a soft shadow under them.
  const missiles = input.missiles;
  for (const pr of onFoot.projectiles) {
    const release = missiles?.releaseHeight ?? 0;
    const { dir, height } = flightFrame(pr, release);
    const x = pr.x - camera.x;
    const y = pr.y - camera.y;
    if (!inView(x, y)) continue;
    sprites.push({
      sheet: MISSILE_SHEET,
      frame: `${pr.kind}/-/${dir % MISSILE_DIRECTIONS}`,
      x,
      y: y - height,
      layer: 'actor',
      sort: y + 0.7,
    });
    // The soft 3 x 1 shadow (Book 10 section 21) on the ground under it, offset by its height.
    sprites.push({ sheet: MISSILE_SHEET, frame: 'shadow/-/0', x, y, layer: 'decal' });
  }
  const detail = visual?.effects?.detail ?? 2;
  sprites.push(
    ...plantSprites(
      map,
      camera,
      seconds,
      wind,
      walkers,
      reduced,
      detail === 0 ? 0.45 : 1,
      // At S1 the court is cleared to its old flagged floor.
      map.broch !== undefined && camp !== undefined && camp.stage !== 'S0'
        ? { x: map.broch.x * map.tile, y: map.broch.y * map.tile, r: map.broch.inner * map.tile }
        : null,
    ),
  );
  for (const m of visual?.marks ?? []) {
    const x = m.x - camera.x;
    const y = m.y - camera.y;
    if (x < -8 || y < -8 || x > LOGICAL_WIDTH + 8 || y > LOGICAL_HEIGHT + 8) continue;
    const sprite: SceneSprite = { sheet: m.sheet, frame: m.frame, x, y, layer: m.layer };
    sprites.push(m.sort === undefined ? sprite : { ...sprite, sort: m.sort - camera.y });
  }

  const fx = visual?.effects;
  const effects: SceneEffects | undefined =
    fx == null ? undefined : { ...fx, shadows, camera, seconds, wind };
  return {
    background: 'D',
    sprites,
    phase: input.phase,
    pools,
    ...(effects === undefined ? {} : { effects }),
  };
}
