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
import { plantSprite } from '../render/scene.ts';
import type {
  LightPool,
  Phase,
  PlantBatch,
  Scene,
  SceneEffects,
  SceneSprite,
  ShadowCaster,
  Wade,
} from '../render/scene.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport.ts';
import {
  gustCell,
  gustGridSize,
  gustSampled,
  gustValues,
  plantLean,
  STRAND_WIND,
  SWAY_CALM,
  SWAY_PERIOD,
} from '../render/wind.ts';
import type { Wind } from '../render/wind.ts';
import { itemShown } from '../sim/land/onFoot.ts';
import type { FactView, OnFootActor, OnFootState } from '../sim/land/onFoot.ts';
import { direction16, drawnHeight, MISSILE_DIRECTIONS } from '../sim/land/missiles.ts';
import type { ZoneMap } from '../sim/land/zoneMap.ts';
import type { DepthBand } from '../content/balance.ts';
import type { ZoneLife } from '../content/zoneMap.ts';
import { PLANT_KINDS } from '../content/zoneMap.ts';
import { shieldGone, shieldSlung, withoutShield, withSlungShield } from './people.ts';
import type { PeopleLook, PersonLook } from './people.ts';
import type { Fighter } from '../sim/combat/fighter.ts';
import { locked } from '../sim/combat/fighter.ts';

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
/** The household asleep under their blankets (the user's fourth playtest, request 15). */
export const SLEEPERS_SHEET = 'prop_sleepers';
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
  /**
   * The line it sorts on, if not its foot: turf on a raised thing (the cairn) sorts with it.
   * Always present (undefined when it sorts on its foot), so every plant has one shape.
   */
  readonly sort: number | undefined;
}
/**
 * Every plant of the zone in one set of typed arrays, row after row in the rows' order
 * (decision DH-161): plant i of row r is at rowStart[r] + i. `sort` is NaN for a plant that sorts
 * on its foot.
 */
interface FlatPlants {
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly phase: Float64Array;
  readonly s1: Float64Array;
  readonly c1: Float64Array;
  readonly s2: Float64Array;
  readonly c2: Float64Array;
  readonly tall: Uint8Array;
  readonly sort: Float64Array;
  /** Each plant's frames for leans -3..3, as the first of seven ids in `names`. */
  readonly frame0: Uint16Array;
  readonly names: readonly string[];
  readonly rowStart: Int32Array;
}
interface ZoneIndex {
  readonly decals: readonly (readonly (readonly [number, number, number])[])[];
  readonly plants: readonly (readonly IndexedPlant[])[];
  readonly flat: FlatPlants;
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
      sort: sort === undefined ? undefined : sort + 0.5,
    });
  }
  // Each row in the order the draw list sorts plants on (decision DH-161): the rounded foot line,
  // then the rounded x, then the exact position. The camera is always whole pixels (clampCamera),
  // so this is the drawn order and the draw list's sort meets one long run; plants that tie on
  // both rounded keys keep their exact (y, x) order, as before, so nothing is drawn differently.
  for (const row of plants)
    row.sort(
      (a, b) =>
        Math.round(a.y) - Math.round(b.y) ||
        Math.round(a.x) - Math.round(b.x) ||
        a.y - b.y ||
        a.x - b.x,
    );
  const total = plants.reduce((n, row) => n + row.length, 0);
  const flat: FlatPlants = {
    x: new Float64Array(total),
    y: new Float64Array(total),
    phase: new Float64Array(total),
    s1: new Float64Array(total),
    c1: new Float64Array(total),
    s2: new Float64Array(total),
    c2: new Float64Array(total),
    tall: new Uint8Array(total),
    sort: new Float64Array(total),
    frame0: new Uint16Array(total),
    names: [...names.values()].flat(),
    rowStart: new Int32Array(plants.length + 1),
  };
  // Each kind's seven frames lie together in `names`, in the order the kinds were first met.
  const first = new Map<readonly string[], number>();
  [...names.values()].forEach((frames, k) => first.set(frames, k * 7));
  let i = 0;
  plants.forEach((row, r) => {
    flat.rowStart[r] = i;
    for (const p of row) {
      flat.x[i] = p.x;
      flat.y[i] = p.y;
      flat.phase[i] = p.phase;
      flat.s1[i] = p.s1;
      flat.c1[i] = p.c1;
      flat.s2[i] = p.s2;
      flat.c2[i] = p.c2;
      flat.tall[i] = p.tall ? 1 : 0;
      flat.sort[i] = p.sort ?? Number.NaN;
      flat.frame0[i] = first.get(p.frames) ?? 0;
      i++;
    }
  });
  flat.rowStart[plants.length] = i;
  const index = { decals, plants, flat };
  indexCache.set(map, index);
  return index;
}

/**
 * The plants in view for a camera (decision DH-161): which plants, and where they are drawn and
 * sorted. These depend only on the camera, the share drawn and the cleared floor, so they are
 * kept while those stay the same (the camera often stands still); only the leans change a frame.
 */
interface PlantsInView {
  readonly key: string;
  readonly ids: Int32Array;
  /** Each plant's gust cell and weights on the view's gust grid (`gustCell`). */
  readonly cell: Int32Array;
  readonly tx: Float64Array;
  readonly ty: Float64Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly sort: Float64Array;
}
const inViewCache = new WeakMap<ZoneIndex, PlantsInView>();
/** The plants' gust grid: the view and a margin (as plantBatch samples it). */
const { cols: GUST_COLS, rows: GUST_ROWS } = gustGridSize(LOGICAL_WIDTH + 32, LOGICAL_HEIGHT + 48);
function plantsInView(
  index: ZoneIndex,
  camera: { x: number; y: number },
  share: number,
  cleared: { readonly x: number; readonly y: number; readonly r: number } | null,
): PlantsInView {
  const key = `${camera.x},${camera.y},${share},${
    cleared === null ? '' : `${cleared.x},${cleared.y},${cleared.r}`
  }`;
  const hit = inViewCache.get(index);
  if (hit?.key === key) return hit;
  const f = index.flat;
  const r0 = Math.max(0, Math.floor(camera.y / TILE) - 1);
  const r1 = Math.min(
    f.rowStart.length - 2,
    Math.floor((camera.y + LOGICAL_HEIGHT + 16) / TILE) + 1,
  );
  const from = f.rowStart[r0] ?? 0;
  const to = f.rowStart[r1 + 1] ?? from;
  const ids = new Int32Array(Math.max(0, to - from));
  const r2 = cleared === null ? 0 : cleared.r * cleared.r;
  let n = 0;
  for (let i = from; i < to; i++) {
    const x = f.x[i] ?? 0;
    const y = f.y[i] ?? 0;
    if (x < camera.x - 10 || x > camera.x + LOGICAL_WIDTH + 10) continue;
    if (share < 1 && (f.phase[i] ?? 0) >= share) continue;
    // Inside the cleared floor (squared, not Math.hypot).
    if (cleared !== null) {
      const cx = x - cleared.x;
      const cy = y - cleared.y;
      if (cx * cx + cy * cy < r2) continue;
    }
    ids[n++] = i;
  }
  const view: PlantsInView = {
    key,
    ids: ids.slice(0, n),
    cell: new Int32Array(n),
    tx: new Float64Array(n),
    ty: new Float64Array(n),
    x: new Float64Array(n),
    y: new Float64Array(n),
    sort: new Float64Array(n),
  };
  for (let k = 0; k < n; k++) {
    const i = view.ids[k] ?? 0;
    const x = f.x[i] ?? 0;
    const y = f.y[i] ?? 0;
    const sort = f.sort[i] ?? Number.NaN;
    view.x[k] = x - camera.x;
    view.y[k] = y - camera.y;
    const g = gustCell(GUST_COLS, GUST_ROWS, camera.x - 16, camera.y - 16, x, y);
    view.cell[k] = g.cell;
    view.tx[k] = g.tx;
    view.ty[k] = g.ty;
    // The draw list sorts an actor without its own sort by its rounded foot line: the same.
    view.sort[k] = Number.isNaN(sort) ? Math.round(y - camera.y) : sort - camera.y;
  }
  inViewCache.set(index, view);
  return view;
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

/**
 * Plants in view as one batch (decision DH-161), each leaning with the wind, its own sway and
 * anyone walking through it; `at` is where they stand among the scene's other sprites.
 */
export function plantBatch(
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
  at = 0,
): PlantBatch {
  const index = zoneIndex(map);
  const f = index.flat;
  const view = plantsInView(index, camera, share, cleared);
  const n = view.ids.length;
  const frameId = new Uint16Array(n);
  // The gust grid over the view, read at each plant's cell (as gustGrid's sampler does).
  const gv = gustValues(
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
  // Only plants within a walker's reach of someone can be pushed: the band of lines they span.
  let wy0 = Infinity;
  let wy1 = -Infinity;
  for (const w of walkers) {
    wy0 = Math.min(wy0, w.y - 8);
    wy1 = Math.max(wy1, w.y + 8);
  }
  const calm = reducedMotion ? 0.35 : SWAY_CALM;
  const gusted = reducedMotion ? 0 : 0.6;
  for (let k = 0; k < n; k++) {
    const i = view.ids[k] ?? 0;
    const x = f.x[i] ?? 0;
    const y = f.y[i] ?? 0;
    // The same lean as plantLean (render/wind.ts), inlined for the thousands of plants a
    // frame: the sway's sines by angle addition from the frame's own sin and cos.
    const g = gustSampled(gv, GUST_COLS, view.cell[k] ?? 0, view.tx[k] ?? 0, view.ty[k] ?? 0);
    const push = wind.dirX * wind.strength * (0.6 + ((f.tall[i] ?? 0) === 1 ? 2.6 : 1.9) * g);
    const sw =
      (sa1 * (f.c1[i] ?? 0) + ca1 * (f.s1[i] ?? 0)) * 0.7 +
      (sa2 * (f.c2[i] ?? 0) + ca2 * (f.s2[i] ?? 0)) * 0.3;
    let lean = push + sw * (calm + gusted * g);
    if (y > wy0 && y < wy1)
      for (const w of walkers) {
        if (!(Math.abs(w.x - x) < 12 && Math.abs(w.y - y) < 8)) continue;
        const dx = x - w.x;
        const dy = (y - w.y) * 1.6;
        const d = Math.hypot(dx, dy);
        if (d < 11) lean += Math.sign(Math.abs(dx) > 0.5 ? dx : 1) * ((11 - d) / 11) * 4.5;
      }
    lean = Math.max(-3, Math.min(3, Math.round(lean)));
    frameId[k] = (f.frame0[i] ?? 0) + UPRIGHT + lean;
  }
  return {
    sheet: PLANT_SHEET,
    count: n,
    frames: f.names,
    frameId,
    x: view.x,
    y: view.y,
    sort: view.sort,
    at,
  };
}

/** Plants in view as sprites (the batch, one sprite a plant). */
export function plantSprites(
  map: ZoneMap,
  camera: { x: number; y: number },
  seconds: number,
  wind: Wind,
  walkers: readonly Walker[],
  reducedMotion: boolean,
  share = 1,
  cleared: { readonly x: number; readonly y: number; readonly r: number } | null = null,
): SceneSprite[] {
  const b = plantBatch(map, camera, seconds, wind, walkers, reducedMotion, share, cleared);
  return Array.from({ length: b.count }, (_, j) => plantSprite(b, j));
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
  /**
   * Stage 12, the launch: people not drawn on foot (aboard the boat, drawn by its layers), whether
   * the steerer is aboard too, and the loop the steerer plays heaving at the boat.
   */
  readonly launch?: {
    readonly hidden: readonly Id[];
    readonly steererHidden: boolean;
    readonly steererLoop: string | null;
  };
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
  /** The user's third playtest (DG-4): the tick the steerer let a foe go (the gesture's start). */
  readonly steererSpare?: number;
  /**
   * The user's fourth playtest (Book 10 "The steerer's death", DH-71): the steerer's collapse, from
   * the killing blow's way (0 to 15, or null), with its buckle, its fall's frames and their ticks.
   */
  readonly steererCollapse?: {
    readonly from: number | null;
    readonly buckle: number;
    readonly frames: number;
    readonly frameTicks: number;
  };
  /** Stage 9: ticks a corpse takes to fade with the gore setting low (and off). */
  readonly corpseFade?: { readonly low: number; readonly off: number };
  /**
   * Combat v2 (Book 7 sections 10 and 12; decisions DE-3, DE-7, DE-8, DE-9), presentation only:
   * each person's knockback offset in px (P_STEERER too), the one-frame flash on those just hit,
   * the awareness marks, the thin bars over enemies (0 to 1), the locked target, and the hits'
   * sparks and stars in world pixels.
   */
  readonly combat?: CombatOverlay;
  /**
   * Design addendum 2.5: the walk's full speed in logical px a tick (Book 10 walk), against which a
   * fighter's eased speed picks its walk start and stop frames (rampFrame).
   */
  readonly walkPerTick?: number;
}

/**
 * The walk's start and stop frames (Book 7 section 01; Book 10 "Movement and acceleration";
 * decision DF-83): speeding up towards a walk wanted, the start's two frames by how near full
 * speed it is; with no walk wanted and still sliding, the stop's two. Null at full speed or still.
 */
export function rampFrame(
  speed: number,
  full: number,
  wanting: boolean,
  own: Readonly<Record<string, Anim>>,
): PersonAnim | null {
  if (full <= 0 || speed <= 1e-6) return null;
  const k = speed / full;
  if (wanting && k < 0.8 && own['walkstart'] !== undefined)
    return { state: 'walkstart', frame: k < 0.4 ? 0 : 1 };
  if (!wanting && own['walkstop'] !== undefined)
    return { state: 'walkstop', frame: k > 0.5 ? 0 : 1 };
  return null;
}

export interface CombatOverlay {
  readonly offsets: Readonly<Record<string, { readonly dx: number; readonly dy: number }>>;
  readonly flash: readonly string[];
  readonly marks: Readonly<Record<string, '?' | '!'>>;
  readonly bars: Readonly<Record<string, number>>;
  readonly lockOn: string | null;
  readonly fx: readonly {
    readonly frame: string;
    readonly x: number;
    readonly y: number;
    /** On the ground (a broken shield), drawn under people. */
    readonly decal?: boolean;
    /** Its sheet, if not the combat fx sheet (the red glint's, DG-10). */
    readonly sheet?: string;
  }[];
}

/** Combat v2's interface pieces in the world, and its hit effects (combat24_ui.py). */
export const UI_COMBAT_SHEET = 'ui_combat';
export const FX_COMBAT_SHEET = 'fx_combat';

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
  extra: {
    readonly piece?: string | null;
    readonly finishing?: boolean;
    /** The stance walk (Book 7 section 01): backing off or strafing while facing the foe. */
    readonly gait?: 'backoff' | 'strafe' | null;
    /** A death fall's way (Book 7 section 12): by the hit's direction against the facing. */
    readonly fall?: 'fall_fwd' | 'fall_back' | 'fall_crumple' | null;
    /** An archer's hop back under way: its ticks so far (Book 10 dashAway). */
    readonly hop?: number | null;
    /** Walking up to speed or slowing to a stop: its frame (rampFrame). */
    readonly ramp?: PersonAnim | null;
    /** The user's third playtest: ticks since a guard turned a blow (DG-9), or a let-go (DG-4). */
    readonly turned?: number | null;
    readonly spare?: number | null;
    /** The steerer's collapse (DH-71): the knees held, then the fall's frames, slower. */
    readonly collapse?: {
      readonly buckle: number;
      readonly frames: number;
      readonly frameTicks: number;
    };
  } = {},
): PersonAnim | null {
  const has = (s: string): boolean => own[s] !== undefined;
  const loop = (s: string): number => {
    const a = own[s];
    return a === undefined ? 0 : Math.floor(tick / a.ticks) % a.frames;
  };
  /** A state's frame by how far through `from` to `to` the tick is. */
  const through = (s: string, from: number, to: number): number => {
    const n = own[s]?.frames ?? 1;
    const t = (tick - from) / Math.max(1, to - from);
    return Math.max(0, Math.min(n - 1, Math.floor(t * n)));
  };
  if (extra.finishing === true && has('finish')) return { state: 'finish', frame: 0 };
  // Design addendum 2.5 (Book 7 section 01; Book 10 "Telegraphs"): the wind-up drawn back past
  // the ready pose by weight, held at the top for its last ticks; never blended into the blow.
  const wind = `windup_${f.weight === 'CHARGED' ? 'c' : f.weight === 'HEAVY' ? 'h' : 'l'}`;
  const phase3 = (s: string): PersonAnim | null => {
    if (!has(s)) return null;
    if (tick < f.activeAt) {
      // The draw-back, then the top held, then the strike's cocked frame just before the blow.
      if (f.activeAt - tick <= 3) return { state: s, frame: 0 };
      if (has(wind))
        return { state: wind, frame: tick - f.since < (f.activeAt - f.since) / 3 ? 0 : 1 };
      return { state: s, frame: 0 };
    }
    if (tick < f.activeEnd) return { state: s, frame: 1 };
    // A miss recovery (Book 7 section 01; decision DF-83): the overbalance's two frames, the
    // stagger forward that shows the punish window, then the follow-through to recover.
    if (f.missed && has('overbalance')) {
      const t = (tick - f.activeEnd) / Math.max(1, f.recoveryEnd - f.activeEnd);
      if (t < 0.7) return { state: 'overbalance', frame: t < 0.35 ? 0 : 1 };
    }
    return { state: s, frame: 2 };
  };
  // The crouch, the spring (while it moves), the landing low.
  if (extra.hop != null && has('hop'))
    return { state: 'hop', frame: extra.hop < 3 ? 0 : moving ? 1 : 2 };
  // A teaching foe's guard turning a blow (Book 7 section 01, DG-9): three frames, at ease or guarded.
  const turned = extra.turned ?? null;
  if (turned !== null && turned >= 0 && turned < 12 && has('guard_turn') && !locked(f))
    return { state: 'guard_turn', frame: Math.min(2, Math.floor(turned / 4)) };
  switch (f.state) {
    case 'reel':
      // A beaten stagger held (DG-2): on one knee, breathing hard.
      return has('reel')
        ? { state: 'reel', frame: loop('reel') }
        : has('stagger')
          ? { state: 'stagger', frame: 1 }
          : null;
    case 'finisher': {
      // One quick killing blow (DG-3): the wind-up and its held top, the blow, the follow-through
      // and the settle, by its weapon and variant (frame 0, the hold, is not shown: the hold is a
      // choosing, not an action).
      const kind = FINISH_ANIM[f.finish?.drawn ?? 'Seax'] ?? 'seax';
      const s = `fin_${kind}_${f.finish?.variant === 'LYING' ? 'l' : 's'}`;
      if (!has(s)) return phase3('light1');
      if (tick < f.activeAt) {
        const k = (tick - f.since) / Math.max(1, f.activeAt - f.since);
        return { state: s, frame: k < 1 / 3 ? 1 : k < 2 / 3 ? 2 : 3 };
      }
      if (tick < f.activeEnd) return { state: s, frame: 4 };
      const k = (tick - f.activeEnd) / Math.max(1, f.recoveryEnd - f.activeEnd);
      return { state: s, frame: k < 0.3 ? 5 : k < 0.75 ? 6 : 7 };
    }
    case 'idle': {
      // The let-go gesture (DG-4): the weapon swept aside, the head jerked: go.
      const spare = extra.spare ?? null;
      if (spare !== null && spare >= 0 && spare < 24 && has('spare'))
        return { state: 'spare', frame: Math.min(3, Math.floor(spare / 6)) };
      // Exhausted (Book 10 "Exhausted"): bent, blowing hard; the stance walk; a flinch.
      if (f.flinchUntil > tick && has('flinch'))
        return { state: 'flinch', frame: f.flinchUntil - tick > 4 ? 0 : 1 };
      if (f.exhausted && moving && has('exhausted_walk'))
        return { state: 'exhausted_walk', frame: loop('exhausted_walk') };
      if (f.exhausted && has('exhausted')) return { state: 'exhausted', frame: loop('exhausted') };
      if (moving && extra.gait != null && has(extra.gait))
        return { state: extra.gait, frame: loop(extra.gait) };
      // Speed building and dying (Book 7 section 01; Book 10 "Movement and acceleration"): the
      // walk's start and stop frames by how far the walk is from full speed.
      const ramp = extra.ramp ?? null;
      if (moving && ramp !== null && has(ramp.state)) return ramp;
      return null;
    }
    case 'chargeL0':
      if (has(wind)) return { state: wind, frame: tick - f.since < 4 ? 0 : 1 };
      return has('charge') ? { state: 'charge', frame: loop('charge') } : null;
    case 'chargeL1':
    case 'chargeL2':
      return has('charge') ? { state: 'charge', frame: loop('charge') } : null;
    case 'light1':
    case 'light2':
    case 'light3':
      return phase3(f.state);
    // Combat v2 (decisions DE-4, DE-5, DE-9): the riposte and the backstab, heavy and distinct;
    // the lunge's tell (the step and the dip) and then its reach.
    case 'riposte':
      return has('riposte') ? phase3('riposte') : phase3('light1');
    case 'backstab':
      return phase3('backstab');
    case 'lunge':
      return has('lunge')
        ? {
            state: 'lunge',
            frame: f.lunge !== null && tick < f.lunge.from ? 0 : tick < f.activeAt ? 0 : 1,
          }
        : null;
    case 'parried': {
      const t = (tick - f.since) / Math.max(1, f.recoveryEnd - f.since);
      return has('parried') ? { state: 'parried', frame: t < 0.4 ? 0 : 1 } : null;
    }
    case 'knockdown':
      if (has('knockdown'))
        return { state: 'knockdown', frame: through('knockdown', f.since, f.since + 18) };
      return has('downed') ? { state: 'downed', frame: 0 } : null;
    case 'getUp': {
      const t = (tick - f.since) / Math.max(1, f.recoveryEnd - f.since);
      return has('getup') ? { state: 'getup', frame: t < 0.5 ? 0 : 1 } : null;
    }
    case 'sidestep': {
      const s = has('sidestep') ? 'sidestep' : 'dodge';
      if (!has(s)) return null;
      if (tick < f.activeAt) return { state: s, frame: 0 };
      const t = (tick - f.activeAt) / Math.max(1, f.recoveryEnd - f.activeAt);
      return { state: s, frame: t < 0.6 ? 1 : 2 };
    }
    case 'heal': {
      const s =
        f.heal?.kind === 'EAT' && has('eat_ration') ? 'eat_ration' : has('bind') ? 'bind' : 'kneel';
      return has(s) ? { state: s, frame: loop(s) } : null;
    }
    case 'heavyRelease':
      // Ketill's red blow (DG-9, DG-10): two hands on the haft over the rim, held, the blow, and
      // an overbalanced miss with the axe in the turf.
      if (f.move === 'red' && has('red')) {
        if (tick < f.activeAt)
          return { state: 'red', frame: f.activeAt - tick > 6 && tick - f.since < 20 ? 0 : 1 };
        if (tick < f.activeEnd) return { state: 'red', frame: 2 };
        if (f.missed && has('red_miss'))
          return { state: 'red_miss', frame: through('red_miss', f.activeEnd, f.recoveryEnd) };
        return { state: 'red', frame: 3 };
      }
      return phase3('heavy');
    case 'shove':
      return phase3('shove');
    case 'parryWindup':
      return has('parry_windup')
        ? { state: 'parry_windup', frame: through('parry_windup', f.since, f.recoveryEnd) }
        : has('parry')
          ? { state: 'parry', frame: 0 }
          : null;
    case 'parry':
      return has('parry') ? { state: 'parry', frame: 0 } : null;
    case 'parryRecovery':
      return has('parry') ? { state: 'parry', frame: 1 } : null;
    case 'blockRaise':
      return has('block_raise')
        ? { state: 'block_raise', frame: through('block_raise', f.since, f.recoveryEnd) }
        : null;
    case 'blockLower':
      return has('block_raise')
        ? {
            state: 'block_raise',
            frame:
              (own['block_raise']?.frames ?? 1) -
              1 -
              through('block_raise', f.since, f.recoveryEnd),
          }
        : null;
    case 'block': {
      // The block walk (Book 7 section 01; DF-83): forward, backing off or strafing, shield up.
      const walk =
        extra.gait === 'backoff'
          ? 'block_backoff'
          : extra.gait === 'strafe'
            ? 'block_strafe'
            : 'block_walk';
      if (moving && has(walk)) return { state: walk, frame: loop(walk) };
      return has('block') ? { state: 'block', frame: 0 } : null;
    }
    case 'blockStun':
      return has('block') ? { state: 'block', frame: 1 } : null;
    case 'dodge': {
      if (!has('dodge')) return null;
      if (tick < f.activeAt) return { state: 'dodge', frame: 0 };
      const t = (tick - f.activeAt) / Math.max(1, f.recoveryEnd - f.activeAt);
      return { state: 'dodge', frame: t < 0.6 ? 1 : 2 };
    }
    case 'dodgeRecovery':
      return has('dodge_recover')
        ? { state: 'dodge_recover', frame: through('dodge_recover', f.since, f.recoveryEnd) }
        : has('dodge')
          ? { state: 'dodge', frame: 2 }
          : null;
    case 'recovery':
      return has('windup_l') ? { state: 'windup_l', frame: 0 } : null;
    case 'guardBroken': {
      // An emptied guard (Book 10 guardBreakEmpty): its own large stagger, the shield arm wide.
      if (f.recoveryEnd - f.since >= 60 && has('guard_break'))
        return { state: 'guard_break', frame: through('guard_break', f.since, f.recoveryEnd) };
      const t = (tick - f.since) / Math.max(1, f.recoveryEnd - f.since);
      return has('stagger') ? { state: 'stagger', frame: t < 0.5 ? 0 : 1 } : null;
    }
    case 'stagger': {
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
      // The fall (Book 7 section 12): two frames by the way of the hit, then the body settles.
      const fall = extra.fall ?? null;
      const age = tick - f.since;
      // The steerer's collapse (Book 10 "The steerer's death", DH-71): the knees go (the stagger's
      // second frame, held), then the fall at its own pace, then still.
      const c = extra.collapse;
      if (c !== undefined) {
        if (age < c.buckle && has('stagger')) return { state: 'stagger', frame: 1 };
        const k = Math.floor((age - c.buckle) / Math.max(1, c.frameTicks));
        if (fall !== null && has(fall) && k < c.frames)
          return { state: fall, frame: Math.min((own[fall]?.frames ?? 1) - 1, Math.max(0, k)) };
      } else if (fall !== null && has(fall) && age < 10)
        return { state: fall, frame: age < 5 ? 0 : 1 };
      const s = extra.piece == null ? 'dead' : `dead_${extra.piece}`;
      return has(s) ? { state: s, frame: 0 } : has('dead') ? { state: 'dead', frame: 0 } : null;
    }
    default:
      return null;
  }
}

/**
 * The way a fighter falls dead (Book 7 section 12: deaths vary by weapon and the hit's direction):
 * struck from in front it falls back, from behind forwards, and a blow (club, shove) or a hit from
 * the side crumples it.
 */
export function fallOf(
  angle: number,
  dir16: number,
  weapon: string | null,
): 'fall_fwd' | 'fall_back' | 'fall_crumple' {
  const hit = (dir16 * Math.PI) / 8;
  const d = Math.cos(hit - angle);
  if (weapon === 'Club or hammer' || Math.abs(d) < 0.4) return 'fall_crumple';
  return d > 0 ? 'fall_fwd' : 'fall_back';
}

/** A finisher's weapon (its Book 10 row) as its state's name on the people sheets (people48.py). */
const FINISH_ANIM: Readonly<Record<string, string>> = {
  Seax: 'seax',
  'Hand axe': 'axe',
  Spear: 'spear',
  Sword: 'sword',
  'Dane axe': 'dane',
  'Club or hammer': 'club',
};

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
    /** Stage 12: hold this frame rather than playing the state's loop (a sail being hoisted). */
    fixed?: boolean;
    /** Stage 12: never cut away over the steerer (the boat at the launch, the scene's subject). */
    opaque?: boolean;
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
  /**
   * The user's fourth playtest (request 23; DH-124): the hearth's hot core, a tighter, warmer pool
   * inside the wide one, and a soapstone lamp's small pool in its wall niche.
   */
  readonly core?: {
    readonly radius: Readonly<Record<Phase, number>>;
    readonly colour: Readonly<Record<Phase, readonly [number, number, number]>>;
  };
  readonly lamp?: {
    readonly radius: Readonly<Record<Phase, number>>;
    readonly colour: Readonly<Record<Phase, readonly [number, number, number]>>;
    readonly flicker: number;
  };
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
      // A lamp in its niche throws its own small warm pool (DH-124).
      const lamp = camp.light?.lamp;
      if (state === 'lamp' && lamp !== undefined) {
        const f = 1 + lamp.flicker * Math.sin(seconds * 9.1 + prop.x);
        const r = lamp.radius[input.phase] * f;
        if (r > 1) pools.push({ x, y: y - 10, radius: r, colour: lamp.colour[input.phase] });
      }
      const loop = prop.fixed !== true && (anims.get(prop.sheet)?.[state]?.frames ?? 1) > 1;
      const sprite: SceneSprite = {
        sheet: prop.sheet,
        frame: loop
          ? `${state}/${facing}/${frameIndex(anims, prop.sheet, state, reduced ? 0 : tick)}`
          : prop.frame,
        x,
        y,
        layer: 'actor',
        tall: prop.opaque !== true,
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
          const core = light.core;
          if (core !== undefined) {
            const r2 = core.radius[phase] * (2 - flick) * (low ? 0.6 : 1);
            if (r2 > 1) pools.push({ x, y: y - 4, radius: r2, colour: core.colour[phase] });
          }
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
    opts: { focus?: boolean; shadow?: boolean; sort?: number },
  ): SceneSprite | null => {
    let bodySprite: SceneSprite | null = null;
    for (const sheet of who.layers[facing] ?? [who.body]) {
      const sprite: SceneSprite = {
        sheet,
        frame,
        x,
        y,
        layer: 'actor',
        ...(opts.sort === undefined ? {} : { sort: opts.sort }),
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

  /**
   * The user's fourth playtest (request 15; DH-105): someone asleep is drawn lying under their own
   * blanket, the head on a rolled cloak, breathing (prop_sleepers), instead of the old lying frames.
   * Returns false when the sheet has no sleeper for this person (they are drawn as before).
   */
  const sleeper = (who: PersonLook, facing: string, x: number, y: number): boolean => {
    const key = who.body.replace(/^actor_/, '').replace(/^[pc]_/, '');
    const state = `${key}_${facing === 'n' || facing === 'w' ? 'w' : 'e'}`;
    const def = anims.get(SLEEPERS_SHEET)?.[state];
    if (def === undefined) return false;
    // Each sleeper breathes on their own phase.
    const phase = Math.floor(hash01(Math.round(x), Math.round(y), 31) * def.frames * def.ticks);
    const sprite: SceneSprite = {
      sheet: SLEEPERS_SHEET,
      frame: `${state}/-/${frameIndex(anims, SLEEPERS_SHEET, state, reduced ? 0 : tick + phase)}`,
      x,
      y,
      layer: 'actor',
    };
    sprites.push(sprite);
    cast(sprite);
    return true;
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
  // Stage 12: heaving at the boat with the household, the stoop of the gather loop.
  const heave = input.launch?.steererLoop ?? null;
  if (heave !== null && work == null) {
    state = heave;
    stepFrame = frameIndex(anims, body, heave, tick);
  }
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
    const st = p.stance;
    const fa = fightAnim(steererFight, tick, p.moving, anims.get(body) ?? {}, {
      gait: st === undefined || st.speed === 1 ? null : st.backing === true ? 'backoff' : 'strafe',
      spare: input.steererSpare === undefined ? null : tick - input.steererSpare,
      ...(input.steererCollapse === undefined || steererFight.state !== 'dead'
        ? {}
        : {
            collapse: input.steererCollapse,
            fall:
              input.steererCollapse.from === null
                ? 'fall_back'
                : fallOf(steererFight.angle, input.steererCollapse.from, null),
          }),
    });
    if (fa !== null) {
      state = fa.state;
      stepFrame = fa.frame;
    }
  }
  const steererLook =
    gore > 0 && input.steererBloodied === true ? look.steerer : withoutBlood(look.steerer);
  const combat = input.combat;
  const kick = (id: string): { dx: number; dy: number } => combat?.offsets[id] ?? { dx: 0, dy: 0 };
  const steererAsleep =
    state === 'sleep' &&
    input.hidePeople !== true &&
    sleeper(steererLook, p.facing, p.x - camera.x, p.y - camera.y);
  if (input.hidePeople !== true && input.launch?.steererHidden !== true && !steererAsleep)
    person(
      steererLook,
      `${state}/${p.facing}/${stepFrame}`,
      p.facing,
      p.x - camera.x + kick('P_STEERER').dx,
      p.y - camera.y + kick('P_STEERER').dy,
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
    const dressed = look.people[id];
    // A shield slung on the back while its fighter fights without it (decision DE-14).
    const who =
      dressed !== undefined && actor.fight !== undefined && shieldSlung(actor.fight.f)
        ? withSlungShield(dressed, (sheet) => anims.has(sheet))
        : dressed !== undefined && actor.fight !== undefined && shieldGone(actor.fight.f)
          ? withoutShield(dressed)
          : dressed;
    const x = actor.x - camera.x;
    const y = actor.y - camera.y;
    const fa = actor.fight;
    // A corpse fades with the gore setting low (after a minute) or off (Book 7 section 12).
    const faded =
      fa?.dead != null &&
      gore < 2 &&
      input.corpseFade !== undefined &&
      tick - fa.dead.tick >= (gore === 1 ? input.corpseFade.low : input.corpseFade.off);
    const aboard = input.launch?.hidden.includes(id) === true;
    if (who !== undefined && inView(x, y) && input.hidePeople !== true && !faded && !aboard) {
      const own = anims.get(who.body) ?? {};
      const bloodied = gore > 0 && fa !== undefined && (fa.bloodied || fa.dead !== null);
      const drawn = bloodied ? who : withoutBlood(who);
      const fightPose =
        fa === undefined
          ? null
          : fightAnim(fa.f, tick, actor.moving === true, own, {
              piece: gore === 2 ? (fa.dead?.piece?.toLowerCase() ?? null) : null,
              finishing: fa.finishing !== null,
              gait:
                fa.ai.goal?.face === undefined
                  ? null
                  : fa.ai.goal.away === true
                    ? 'backoff'
                    : 'strafe',
              fall:
                fa.dead !== null && fa.dead.piece === null
                  ? fallOf(fa.f.angle, fa.dead.dir, fa.f.weapon)
                  : null,
              hop: fa.ai.hop === null ? null : tick - fa.ai.hop.since,
              turned: fa.turnedAt === undefined ? null : tick - fa.turnedAt,
              ramp: ((): PersonAnim | null => {
                const goal = fa.ai.goal;
                if (input.walkPerTick === undefined || goal?.run === true) return null;
                const wanting =
                  goal !== null &&
                  (goal.away === true || Math.hypot(goal.x - actor.x, goal.y - actor.y) >= 2);
                const speed = Math.hypot(fa.vel?.x ?? 0, fa.vel?.y ?? 0);
                return rampFrame(speed, input.walkPerTick * (goal?.share ?? 1), wanting, own);
              })(),
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
          x + kick(id).dx,
          y + kick(id).dy,
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
          // Just in front of the carrier on its own line (the final pass, DH-165): half a pixel
          // lower alone tied with the carrier's rounded foot line whenever its y ran past a half,
          // and the tie went by their order (the strongbox behind Conn's back, facing north).
          { shadow: false, sort: Math.round(y) + 0.5 },
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
          // Just in front of the steerer, never tied with them (DH-165).
          { shadow: false, sort: Math.round(y) + 0.5 },
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
        const asleep = actor.pose === 'sleep' && sleeper(drawn, actor.facing, x, y);
        if (!asleep)
          person(
            drawn,
            `${st}/${actor.facing}/${frame}`,
            actor.facing,
            x,
            y,
            visual?.water[id],
            {},
          );
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
      // Combat v2: the mark over the head, the thin bar, the lock-on brackets at the feet.
      const mark = combat?.marks[id];
      if (mark !== undefined)
        sprites.push({
          sheet: UI_COMBAT_SHEET,
          frame:
            mark === '?'
              ? `mark_q/-/${Math.floor(tick / 12) % 2}`
              : `mark_x/-/${Math.floor(tick / 4) % 2}`,
          x: x - 6,
          y: y - 54,
          layer: 'actor',
          sort: y + 0.95,
        });
      const bar = combat?.bars[id];
      if (bar !== undefined) {
        const w = 14;
        const filled = Math.max(0, Math.min(w, Math.round(bar * w)));
        for (let k = -1; k <= w; k++)
          sprites.push({
            sheet: UI_COMBAT_SHEET,
            frame:
              k < 0 || k === w ? 'ebar_end/-/0' : k < filled ? 'ebar_fill/-/0' : 'ebar_empty/-/0',
            x: x - 7 + k,
            y: y - 45,
            layer: 'actor',
            sort: y + 0.96,
          });
      }
      if (combat?.lockOn === id)
        sprites.push({
          sheet: UI_COMBAT_SHEET,
          frame: `lock/-/${Math.floor(tick / 20) % 2}`,
          x: x - 6,
          y: y - 7,
          layer: 'decal',
        });
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
  // Combat v2 (decision DE-7): a one-frame flash on whoever was just hit; the sparks, splinters
  // and the parry's star where blows met.
  for (const id of combat?.flash ?? []) {
    const who = id === 'P_STEERER' ? p : onFoot.actors[id];
    if (who === undefined) continue;
    sprites.push({
      sheet: GORE_SHEET,
      frame: 'flash/-/0',
      x: who.x - camera.x + kick(id).dx,
      y: who.y - camera.y - 20 + kick(id).dy,
      layer: 'actor',
      sort: who.y - camera.y + 0.97,
    });
  }
  for (const fx of combat?.fx ?? [])
    sprites.push(
      fx.decal === true
        ? {
            sheet: fx.sheet ?? FX_COMBAT_SHEET,
            frame: fx.frame,
            x: fx.x - camera.x - 8,
            y: fx.y - camera.y - 8,
            layer: 'decal',
          }
        : {
            sheet: fx.sheet ?? FX_COMBAT_SHEET,
            frame: fx.frame,
            x: fx.x - camera.x - 8,
            y: fx.y - camera.y - 8,
            layer: 'actor',
            sort: fx.y - camera.y + 30,
          },
    );
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
  // The plants as one batch, placed here in the scene's order (decision DH-161).
  const plants = plantBatch(
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
    sprites.length,
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
    ...(plants.count === 0 ? {} : { plants }),
  };
}
