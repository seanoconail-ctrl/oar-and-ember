/**
 * Draws an on-foot zone (Book 7 sections 01 and 13): the ground tiles under a camera that follows
 * the steerer, the edge tiles where one terrain laps over another (foam at the water, wrack at the
 * high-tide line), the zone's props, and the people, sorted by their feet. The tidal flats show as
 * shallow water while the tidal ground is closed. Pure: the browser view and the CPU render check
 * both use it.
 */
import type { Id } from '../core/ids.ts';
import type { Anim } from '../render/sheet.ts';
import type { Phase, Scene, SceneSprite } from '../render/scene.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport.ts';
import type { OnFootActor, OnFootState } from '../sim/land/onFoot.ts';
import { terrainAt } from '../sim/land/zoneMap.ts';
import type { Terrain, ZoneMap } from '../sim/land/zoneMap.ts';

export const GROUND_SHEET = 'tile_strand';
export const MARKER_SHEET = 'ui_marker';

/** The terrain as drawn: flats under the flood show as shallow water. */
type Shown = 'sea' | 'flood' | 'flats' | 'stream' | 'foreshore' | 'shingle' | 'machair' | 'rock';

/** Draw order of edges: a terrain laps over every terrain before it. */
export const EDGE_ORDER: readonly Shown[] = [
  'sea',
  'flood',
  'flats',
  'stream',
  'foreshore',
  'shingle',
  'machair',
  'rock',
];
const WATER: ReadonlySet<Shown> = new Set(['sea', 'flood', 'stream']);
const VARIANTS = 6;
const EDGE_VARIANTS = 3;

function shown(terrain: Terrain, tideOpen: boolean): Shown {
  return terrain === 'flats' && !tideOpen ? 'flood' : terrain;
}

export type SheetAnims = ReadonlyMap<string, Readonly<Record<string, Anim>>>;

function frameIndex(anims: SheetAnims, sheet: string, state: string, tick: number): number {
  const anim = anims.get(sheet)?.[state];
  if (anim === undefined) return 0;
  const i = Math.floor(tick / anim.ticks);
  return anim.loop ? i % anim.frames : Math.min(i, anim.frames - 1);
}

/** The camera's top-left corner in zone pixels: centred on the steerer, kept inside the zone. */
export function cameraFor(map: ZoneMap, at: { x: number; y: number }): { x: number; y: number } {
  const maxX = map.width * map.tile - LOGICAL_WIDTH;
  const maxY = map.height * map.tile - LOGICAL_HEIGHT;
  return {
    x: Math.round(Math.min(maxX, Math.max(0, at.x - LOGICAL_WIDTH / 2))),
    y: Math.round(Math.min(maxY, Math.max(0, at.y - 20 - LOGICAL_HEIGHT / 2))),
  };
}

/** A stable variant for a tile, so the ground does not shimmer as the camera moves. */
function variantAt(tx: number, ty: number, count = VARIANTS, salt = 0): number {
  let h = Math.imul(tx, 0x27d4eb2d) ^ Math.imul(ty, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) % count;
}

const ORTHOGONAL = [
  ['n', 0, -1],
  ['s', 0, 1],
  ['e', 1, 0],
  ['w', -1, 0],
] as const;
const DIAGONAL = [
  ['ne', 1, -1],
  ['nw', -1, -1],
  ['se', 1, 1],
  ['sw', -1, 1],
] as const;

/** The ground and edge tiles in view, camera-relative. */
export function groundSprites(
  map: ZoneMap,
  camera: { x: number; y: number },
  tideOpen: boolean,
  tick: number,
  anims: SheetAnims,
): SceneSprite[] {
  const at = (tx: number, ty: number): Shown => shown(terrainAt(map, tx, ty), tideOpen);
  const order = (s: Shown): number => EDGE_ORDER.indexOf(s);
  const base: SceneSprite[] = [];
  const edges: { sprite: SceneSprite; order: number }[] = [];
  const t0x = Math.floor(camera.x / map.tile);
  const t0y = Math.floor(camera.y / map.tile);
  for (let ty = t0y; ty <= t0y + Math.ceil(LOGICAL_HEIGHT / map.tile); ty++) {
    for (let tx = t0x; tx <= t0x + Math.ceil(LOGICAL_WIDTH / map.tile); tx++) {
      const here = at(tx, ty);
      const x = tx * map.tile - camera.x;
      const y = ty * map.tile - camera.y;
      const state = `${here}${variantAt(tx, ty)}`;
      base.push({
        sheet: GROUND_SHEET,
        frame: `${state}/-/${frameIndex(anims, GROUND_SHEET, state, tick)}`,
        x,
        y,
        layer: 'ground',
      });
      const wet = WATER.has(here) ? 'wet' : 'dry';
      const mine = order(here);
      for (const [dir, dx, dy] of ORTHOGONAL) {
        const upper = at(tx + dx, ty + dy);
        if (order(upper) > mine)
          edges.push({
            order: order(upper),
            sprite: {
              sheet: GROUND_SHEET,
              frame: `edge_${upper}_${wet}_${dir}/-/${variantAt(tx, ty, EDGE_VARIANTS, dir.charCodeAt(0) + dir.length * 7)}`,
              x,
              y,
              layer: 'ground',
            },
          });
      }
      for (const [dir, dx, dy] of DIAGONAL) {
        const upper = at(tx + dx, ty + dy);
        const u = order(upper);
        if (u <= mine) continue;
        // Only where neither side of the corner already carries a band of this height or more.
        if (order(at(tx + dx, ty)) >= u || order(at(tx, ty + dy)) >= u) continue;
        edges.push({
          order: u,
          sprite: {
            sheet: GROUND_SHEET,
            frame: `edge_${upper}_${wet}_${dir}/-/${variantAt(tx, ty, EDGE_VARIANTS, dir.charCodeAt(0) + dir.length * 7)}`,
            x,
            y,
            layer: 'ground',
          },
        });
      }
    }
  }
  edges.sort((a, b) => a.order - b.order);
  return [...base, ...edges.map((e) => e.sprite)];
}

export interface PeopleLook {
  /** The steerer's sheet (body model A or B). */
  readonly steerer: string;
  /** Sheet per person id, e.g. C_HILD: actor_c_hild. */
  readonly people: Readonly<Record<Id, string>>;
}

export interface ZoneSceneInput {
  readonly map: ZoneMap;
  readonly onFoot: OnFootState;
  readonly tick: number;
  readonly tideOpen: boolean;
  readonly phase: Phase;
  readonly look: PeopleLook;
  readonly anims: SheetAnims;
  /** The interaction target to mark, if any. */
  readonly highlight: Id | null;
}

function steererState(onFoot: OnFootState): string {
  const p = onFoot.player;
  if (onFoot.carrying !== null || p.gait === 'carry') return 'carry';
  if (!p.moving) return 'idle';
  return p.gait;
}

/** Where the target marker sits relative to the standard head height, by pose. */
const MARKER_OVER: Record<OnFootActor['pose'], { x: number; y: number }> = {
  idle: { x: 0, y: 0 },
  down: { x: 12, y: 22 },
  sit: { x: 0, y: 14 },
  carried: { x: 0, y: 0 },
};

export function zoneScene(input: ZoneSceneInput): Scene {
  const { map, onFoot, tick, anims, look } = input;
  const p = onFoot.player;
  const camera = cameraFor(map, p);
  const sprites: SceneSprite[] = groundSprites(map, camera, input.tideOpen, tick, anims);
  const inView = (x: number, y: number): boolean =>
    x > -64 && y > -16 && x < LOGICAL_WIDTH + 64 && y < LOGICAL_HEIGHT + 72;
  for (const prop of map.props) {
    const x = prop.x * map.tile - camera.x;
    const y = prop.y * map.tile - camera.y;
    if (inView(x, y))
      sprites.push({ sheet: prop.sheet, frame: prop.frame, x, y, layer: 'actor', tall: true });
  }
  // The steerer, and while carrying, the carried person drawn over their shoulders.
  const state = steererState(onFoot);
  const moving = p.moving || state === 'idle';
  const stepFrame = moving ? frameIndex(anims, look.steerer, state, tick) : 0;
  sprites.push({
    sheet: look.steerer,
    frame: `${state}/${p.facing}/${stepFrame}`,
    x: p.x - camera.x,
    y: p.y - camera.y,
    layer: 'actor',
    focus: true,
  });
  const actorFrame = (id: Id, actor: OnFootActor): SceneSprite | null => {
    const sheet = look.people[id];
    if (sheet === undefined) return null;
    const x = actor.x - camera.x;
    const y = actor.y - camera.y;
    if (!inView(x, y)) return null;
    if (actor.pose === 'carried') {
      return { sheet, frame: `carried/${p.facing}/${stepFrame}`, x, y: y + 0.5, layer: 'actor' };
    }
    const frame = frameIndex(anims, sheet, actor.pose, tick);
    return { sheet, frame: `${actor.pose}/${actor.facing}/${frame}`, x, y, layer: 'actor' };
  };
  for (const [id, actor] of Object.entries(onFoot.actors)) {
    const sprite = actorFrame(id, actor);
    if (sprite !== null) sprites.push(sprite);
    if (input.highlight === id && actor.pose !== 'carried') {
      const bob = frameIndex(anims, MARKER_SHEET, 'bob', tick);
      // The marker sits over the head: lower for someone lying or sitting (art layout).
      const over = MARKER_OVER[actor.pose];
      sprites.push({
        sheet: MARKER_SHEET,
        frame: `bob/-/${bob}`,
        x: actor.x - camera.x + over.x * (actor.facing === 'w' ? -1 : 1),
        y: actor.y - camera.y + 1 + over.y,
        layer: 'actor',
      });
    }
  }
  return { background: 'D', sprites, phase: input.phase, pools: [] };
}
