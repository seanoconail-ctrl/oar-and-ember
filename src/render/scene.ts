/**
 * A renderable scene and its draw list (Book 7 section 01): positions snapped to whole logical
 * pixels; the ground first, then the decal layer (blood), then actors and props sorted by their
 * foot anchor's y. A tall object drawn in front of the focus actor (the player) and overlapping it
 * is cut away with an ordered-dither fade, so the player is never hidden.
 *
 * The CPU reference renderer and the WebGL renderer both draw exactly this list.
 */

export type Layer = 'ground' | 'decal' | 'actor';
export type Phase = 'day' | 'dusk' | 'night';

export interface SceneSprite {
  readonly sheet: string;
  /** Frame key "state/facing/index". */
  readonly frame: string;
  /** World position of the sprite's pivot, in logical pixels (may be fractional). */
  readonly x: number;
  readonly y: number;
  readonly layer: Layer;
  /** A tall object that can hide what stands behind it. */
  readonly tall?: boolean;
  /** The actor the camera follows; tall objects in front of it are cut away. */
  readonly focus?: boolean;
  /** Sort line within the actor layer, if not the foot (a bird in flight sorts over everything). */
  readonly sort?: number;
}

export interface LightPool {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Added to the ambient light at full strength, 0 to 255 per channel. */
  readonly colour: readonly [number, number, number];
}

/** A ground shadow: a soft contact ellipse under the feet, and a long cast shadow at low sun. */
export interface ShadowCaster {
  /** Foot position on screen, logical pixels. */
  readonly x: number;
  readonly y: number;
  /** Contact ellipse, from the sheet's `shadow: WxH` header. */
  readonly w: number;
  readonly h: number;
  /** The sprite whose silhouette is cast along the ground when the sun is low. */
  readonly sheet?: string;
  readonly frame?: string;
  /** Height above the ground (a bird in flight): the shadow falls this far below. */
  readonly lift?: number;
}

/**
 * The living-world layers of a zone (Book 7 section 14). Visual only, computed from the
 * simulation's view and a visual clock; the WebGL renderer draws them. The CPU reference renderer
 * ignores them: it is the exact reference for the indexed sprite pass and the light, and the
 * effects are checked by the browser captures instead (decision AP-9).
 */
export interface SceneEffects {
  /** Visual clock, seconds. */
  readonly seconds: number;
  /** World pixel at the screen's top-left corner. */
  readonly camera: { readonly x: number; readonly y: number };
  /** Water over the zone's height field, or null for no water. */
  readonly water: {
    readonly zone: string;
    /** Drawn tide height, 0 (low water) to 1 (high). */
    readonly tide: number;
    /** The highest the water has been drawn recently: sand below it is still drying. */
    readonly wetTo: number;
  } | null;
  readonly wind: { readonly dirX: number; readonly dirY: number; readonly strength: number };
  readonly shadows: readonly ShadowCaster[];
  /** Cast-shadow direction per pixel of height (screen axes), and its strength 0..1. */
  readonly sun: { readonly x: number; readonly y: number; readonly strength: number };
  /** Cloud cover 0..1: drifting cloud shadows. */
  readonly clouds: number;
  /** Colour grade: out = colour * gain + lift (0..255 scale for lift). */
  readonly grade: {
    readonly gain: readonly [number, number, number];
    readonly lift: readonly [number, number, number];
  };
  /** Light shafts through broken cloud, 0..1. */
  readonly shafts: number;
  /** Lightning flash 0..1 (reduced flashes caps it). */
  readonly flash: number;
  /** Mist 0..1. */
  readonly fog: number;
  /** Effect detail: 2 full, 1 lite, 0 low, stepped down on a machine too slow for full. */
  readonly detail?: 0 | 1 | 2;
}

export interface Scene {
  /** Palette code behind everything. */
  readonly background: string;
  readonly sprites: readonly SceneSprite[];
  readonly phase: Phase;
  readonly pools: readonly LightPool[];
  readonly effects?: SceneEffects;
}

export interface SheetGeometry {
  readonly width: number;
  readonly height: number;
  readonly pivot: { readonly x: number; readonly y: number };
}

export interface DrawItem {
  readonly sheet: string;
  readonly frame: string;
  /** Top-left corner, in whole logical pixels. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** 0 draws every pixel; 0.5 drops half of them in an ordered-dither pattern (a cutaway). */
  readonly fade: number;
  readonly layer: Layer;
}

const LAYER_ORDER: Record<Layer, number> = { ground: 0, decal: 1, actor: 2 };

function overlaps(a: DrawItem, b: DrawItem): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function buildDrawList(
  scene: Scene,
  sheets: ReadonlyMap<string, SheetGeometry>,
  cutawayFade: number,
): DrawItem[] {
  const placed = scene.sprites.map((sprite, index) => {
    const sheet = sheets.get(sprite.sheet);
    if (sheet === undefined) throw new Error(`Scene uses unknown sheet "${sprite.sheet}"`);
    const footY = Math.round(sprite.y);
    const sortY = sprite.sort ?? footY;
    const item: DrawItem = {
      sheet: sprite.sheet,
      frame: sprite.frame,
      x: Math.round(sprite.x) - sheet.pivot.x,
      y: footY - sheet.pivot.y,
      width: sheet.width,
      height: sheet.height,
      fade: 0,
      layer: sprite.layer,
    };
    return { sprite, item, sortY, index };
  });
  placed.sort(
    (a, b) =>
      LAYER_ORDER[a.sprite.layer] - LAYER_ORDER[b.sprite.layer] ||
      (a.sprite.layer === 'actor' ? a.sortY - b.sortY || a.item.x - b.item.x : 0) ||
      a.index - b.index,
  );
  const focusAt = placed.findIndex((p) => p.sprite.focus === true);
  const focus = placed[focusAt];
  return placed.map((p, i) => {
    if (
      focus !== undefined &&
      i > focusAt &&
      p.sprite.tall === true &&
      overlaps(p.item, focus.item)
    ) {
      return { ...p.item, fade: cutawayFade };
    }
    return p.item;
  });
}

/** 4 x 4 Bayer thresholds, shared with the backdrop and the WebGL shader. */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** Whether a faded sprite drops its pixel at screen position (x, y). */
export function fadeDrops(x: number, y: number, fade: number): boolean {
  return (BAYER4[(y & 3) * 4 + (x & 3)] ?? 0) < Math.round(fade * 16);
}

export interface RenderStyle {
  readonly phases: Readonly<Record<Phase, { readonly ambient: readonly [number, number, number] }>>;
  readonly poolBands: number;
  readonly cutawayFade: number;
}

export function parseRenderStyle(json: unknown): RenderStyle {
  const j = json as Partial<RenderStyle> | null;
  const ok = (c: unknown): c is [number, number, number] =>
    Array.isArray(c) && c.length === 3 && c.every((v) => Number.isInteger(v) && v >= 0 && v <= 255);
  // The file is untrusted until checked, so read it as possibly missing anything.
  const phases = j?.phases as Partial<Record<Phase, { ambient?: unknown }>> | undefined;
  for (const phase of ['day', 'dusk', 'night'] as const) {
    if (!ok(phases?.[phase]?.ambient))
      throw new Error(`render.json: phases.${phase}.ambient must be [r, g, b] from 0 to 255`);
  }
  if (!Number.isInteger(j?.poolBands) || (j?.poolBands ?? 0) < 1)
    throw new Error('render.json: poolBands must be a whole number');
  if (typeof j?.cutawayFade !== 'number' || j.cutawayFade < 0 || j.cutawayFade > 1) {
    throw new Error('render.json: cutawayFade must be between 0 and 1');
  }
  return j as RenderStyle;
}

/**
 * The light reaching a pixel: ambient plus each pool in `bands` steps, per channel, capped at 255.
 * Pixel centres are at (x + 0.5, y + 0.5).
 */
export function lightAt(
  x: number,
  y: number,
  ambient: readonly [number, number, number],
  pools: readonly LightPool[],
  bands: number,
): [number, number, number] {
  let [r, g, b] = ambient;
  for (const pool of pools) {
    const d = Math.hypot(x + 0.5 - pool.x, y + 0.5 - pool.y);
    if (d >= pool.radius) continue;
    const band = Math.ceil(bands * (1 - d / pool.radius)) / bands;
    r += pool.colour[0] * band;
    g += pool.colour[1] * band;
    b += pool.colour[2] * band;
  }
  return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
}

/** A colour channel under light `factor` (0 to 255). */
export function lit(channel: number, factor: number): number {
  return Math.floor((channel * factor) / 255 + 1e-6);
}
