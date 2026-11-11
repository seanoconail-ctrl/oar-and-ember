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
  Phase,
  Scene,
  SceneEffects,
  SceneSprite,
  ShadowCaster,
  Wade,
} from '../render/scene.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport.ts';
import { gustGrid, STRAND_WIND, SWAY_PERIOD } from '../render/wind.ts';
import type { Wind } from '../render/wind.ts';
import type { OnFootActor, OnFootState } from '../sim/land/onFoot.ts';
import type { ZoneMap } from '../sim/land/zoneMap.ts';
import type { DepthBand } from '../content/balance.ts';
import type { ZoneLife } from '../content/zoneMap.ts';
import { PLANT_KINDS } from '../content/zoneMap.ts';
import type { PeopleLook, PersonLook } from './people.ts';

export type { PeopleLook, PersonLook } from './people.ts';

export const GROUND_SHEET = 'tile_strand';
export const PLANT_SHEET = 'plant_strand';
export const FX_SHEET = 'fx_strand';
/** People's own particles and prints: dust, splashes, ripple rings, drips, surf spray (Book 7 07). */
export const PEOPLE_FX_SHEET = 'fx_people';
export const MARKER_SHEET = 'ui_marker';
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
  for (const [k, x, y, v] of map.plants) {
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
      near.length = 0;
      for (const w of walkers) if (Math.abs(w.x - x) < 12 && Math.abs(w.y - y) < 8) near.push(w);
      // The same lean as plantLean (render/wind.ts), inlined for the thousands of plants a
      // frame: the sway's sines by angle addition from the frame's own sin and cos.
      const g = gust(x, y);
      const push = wind.dirX * wind.strength * (0.6 + (plant.tall ? 2.6 : 1.9) * g);
      const sw = (sa1 * plant.c1 + ca1 * plant.s1) * 0.7 + (sa2 * plant.c2 + ca2 * plant.s2) * 0.3;
      let lean = push + sw * (reducedMotion ? 0.35 : 0.8 + 0.6 * g);
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
}

function steererState(onFoot: OnFootState): string {
  const p = onFoot.player;
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
};

/** The animation state a pose is drawn with (a person calling waves and shouts: `call`). */
function poseState(pose: OnFootActor['pose'], anims: Readonly<Record<string, unknown>>): string {
  if (pose === 'call') return anims['call'] === undefined ? 'idle' : 'call';
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
  sprites.push(...decalSprites(map, camera));
  const inView = (x: number, y: number): boolean =>
    x > -80 && y > -16 && x < LOGICAL_WIDTH + 80 && y < LOGICAL_HEIGHT + 100;
  for (const prop of map.props) {
    const x = prop.x * map.tile - camera.x;
    const y = prop.y * map.tile - camera.y;
    if (!inView(x, y)) continue;
    const sprite: SceneSprite = {
      sheet: prop.sheet,
      frame: prop.frame,
      x,
      y,
      layer: 'actor',
      tall: true,
    };
    sprites.push(sprite);
    cast(sprite);
  }
  for (const { sprite, lift } of lifeSprites(map.life, camera, seconds)) {
    if (!inView(sprite.x, sprite.y + lift)) continue;
    sprites.push(sprite);
    cast(sprite, lift);
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
  if (visual?.steerer != null) {
    state = visual.steerer.state;
    stepFrame = visual.steerer.frame;
  } else if (state === 'idle' || state === 'draw') stepFrame = frameIndex(anims, body, state, tick);
  if (input.hidePeople !== true)
    person(
      look.steerer,
      `${state}/${p.facing}/${stepFrame}`,
      p.facing,
      p.x - camera.x,
      p.y - camera.y,
      visual?.water['P_STEERER'],
      { focus: true },
    );
  const walkers: Walker[] = [{ x: p.x, y: p.y }];
  for (const [id, actor] of Object.entries(onFoot.actors)) {
    const who = look.people[id];
    const x = actor.x - camera.x;
    const y = actor.y - camera.y;
    if (who !== undefined && inView(x, y) && input.hidePeople !== true) {
      const own = anims.get(who.body) ?? {};
      if (actor.pose === 'carried') {
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
        const st =
          actor.moving === true && own['walk'] !== undefined ? 'walk' : poseState(actor.pose, own);
        const frame = frameIndex(anims, who.body, st, tick);
        person(who, `${st}/${actor.facing}/${frame}`, actor.facing, x, y, visual?.water[id], {});
        walkers.push({ x: actor.x, y: actor.y });
      }
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
  const detail = visual?.effects?.detail ?? 2;
  sprites.push(
    ...plantSprites(map, camera, seconds, wind, walkers, reduced, detail === 0 ? 0.45 : 1),
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
    pools: [],
    ...(effects === undefined ? {} : { effects }),
  };
}
