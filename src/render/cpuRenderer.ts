/**
 * The CPU reference renderer: draws a scene's draw list exactly as the WebGL renderer does, into
 * RGBA bytes. It is the render-to-image tool for visual checks (Book 2 section 19) and the
 * reference the browser tests compare the WebGL output against.
 */
import { createIndexedImage, NO_PIXEL, toRgba } from './indexedImage.ts';
import { paletteIndex } from './palette.ts';
import type { Palette } from './palette.ts';
import {
  buildDrawList,
  fadeDrops,
  lightAt,
  lit,
  RIM_MIX,
  rimWobble,
  STREAK_MIX,
  streakRow,
  WET_DARKEN,
} from './scene.ts';
import type { RenderStyle, Scene } from './scene.ts';
import type { Sheet } from './sheet.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './viewport.ts';

export function renderSceneCpu(
  scene: Scene,
  sheets: ReadonlyMap<string, Sheet>,
  palette: Palette,
  style: RenderStyle,
  width = LOGICAL_WIDTH,
  height = LOGICAL_HEIGHT,
): Uint8Array {
  const frame = createIndexedImage(width, height, paletteIndex(palette, scene.background));
  /** Colours that are not palette entries (water over a wading person, a wet sprite). */
  const mixed = new Map<number, readonly [number, number, number]>();
  const t = scene.effects?.seconds ?? 0;
  const rim = rimColour(palette);
  const recolour = scene.recolour;
  for (const item of buildDrawList(scene, sheets, style.cutawayFade)) {
    const image = sheets.get(item.sheet)?.frames.get(item.frame);
    if (image === undefined) throw new Error(`No frame ${item.sheet} ${item.frame}`);
    const seasonal = recolour?.sheets.has(item.sheet) === true ? recolour.index : null;
    for (let sy = 0; sy < image.height; sy++) {
      const y = item.y + sy;
      if (y < 0 || y >= height) continue;
      for (let sx = 0; sx < image.width; sx++) {
        const x = item.x + sx;
        if (x < 0 || x >= width) continue;
        const raw = image.pixels[sy * image.width + sx] ?? NO_PIXEL;
        if (raw === NO_PIXEL || (item.fade > 0 && fadeDrops(x, y, item.fade))) continue;
        const value = seasonal === null ? raw : (seasonal[raw] ?? raw);
        frame.pixels[y * width + x] = value;
        mixed.delete(y * width + x);
        const rgb = palette.entries[value]?.rgb ?? [0, 0, 0];
        let out: [number, number, number] | null = null;
        if (item.dark !== undefined && item.dark > 0) {
          const k = 1 - WET_DARKEN * item.dark;
          out = [rgb[0] * k, rgb[1] * k, rgb[2] * k];
        }
        const base: readonly number[] = out ?? [rgb[0], rgb[1], rgb[2]];
        if (item.cutY !== undefined && item.water !== undefined) {
          const wob = rimWobble(x, t);
          if (y === item.cutY + wob)
            out = [0, 1, 2].map(
              (c) => (base[c] ?? 0) * (1 - RIM_MIX) + (rim[c] ?? 0) * RIM_MIX,
            ) as [number, number, number];
          else if (y >= item.cutY) {
            const k = streakRow(y - item.cutY, t) ? STREAK_MIX : 0;
            out = [0, 1, 2].map((c) => (item.water?.[c] ?? 0) * (1 - k) + (base[c] ?? 0) * k) as [
              number,
              number,
              number,
            ];
          }
        }
        if (out !== null)
          mixed.set(y * width + x, [Math.floor(out[0]), Math.floor(out[1]), Math.floor(out[2])]);
      }
    }
  }
  const rgba = toRgba(frame, palette);
  for (const [i, [r, g, b]] of mixed) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
  }
  const ambient = style.phases[scene.phase].ambient;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [lr, lg, lb] = lightAt(x, y, ambient, scene.pools, style.poolBands);
      const i = (y * width + x) * 4;
      rgba[i] = lit(rgba[i] ?? 0, lr);
      rgba[i + 1] = lit(rgba[i + 1] ?? 0, lg);
      rgba[i + 2] = lit(rgba[i + 2] ?? 0, lb);
    }
  }
  return rgba;
}

/** The waterline rim's colour: the lightest step of the sea ramp (its foam). */
export function rimColour(palette: Palette): readonly [number, number, number] {
  const sea = palette.ramps.get('sea') ?? [];
  const top = sea[sea.length - 1];
  const rgb = top === undefined ? undefined : palette.entries[top]?.rgb;
  return rgb === undefined ? [214, 236, 236] : [rgb[0], rgb[1], rgb[2]];
}
