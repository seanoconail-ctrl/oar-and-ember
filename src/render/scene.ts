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
}

export interface LightPool {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Added to the ambient light at full strength, 0 to 255 per channel. */
  readonly colour: readonly [number, number, number];
}

export interface Scene {
  /** Palette code behind everything. */
  readonly background: string;
  readonly sprites: readonly SceneSprite[];
  readonly phase: Phase;
  readonly pools: readonly LightPool[];
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
    const item: DrawItem = {
      sheet: sprite.sheet,
      frame: sprite.frame,
      x: Math.round(sprite.x) - sheet.pivot.x,
      y: footY - sheet.pivot.y,
      width: sheet.width,
      height: sheet.height,
      fade: 0,
    };
    return { sprite, item, footY, index };
  });
  placed.sort(
    (a, b) =>
      LAYER_ORDER[a.sprite.layer] - LAYER_ORDER[b.sprite.layer] ||
      (a.sprite.layer === 'actor' ? a.footY - b.footY || a.item.x - b.item.x : 0) ||
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
