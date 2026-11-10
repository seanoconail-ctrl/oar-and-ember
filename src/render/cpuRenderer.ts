/**
 * The CPU reference renderer: draws a scene's draw list exactly as the WebGL renderer does, into
 * RGBA bytes. It is the render-to-image tool for visual checks (Book 2 section 19) and the
 * reference the browser tests compare the WebGL output against.
 */
import { createIndexedImage, NO_PIXEL, toRgba } from './indexedImage.ts';
import { paletteIndex } from './palette.ts';
import type { Palette } from './palette.ts';
import { buildDrawList, fadeDrops, lightAt, lit } from './scene.ts';
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
  for (const item of buildDrawList(scene, sheets, style.cutawayFade)) {
    const image = sheets.get(item.sheet)?.frames.get(item.frame);
    if (image === undefined) throw new Error(`No frame ${item.sheet} ${item.frame}`);
    for (let sy = 0; sy < image.height; sy++) {
      const y = item.y + sy;
      if (y < 0 || y >= height) continue;
      for (let sx = 0; sx < image.width; sx++) {
        const x = item.x + sx;
        if (x < 0 || x >= width) continue;
        const value = image.pixels[sy * image.width + sx] ?? NO_PIXEL;
        if (value === NO_PIXEL || (item.fade > 0 && fadeDrops(x, y, item.fade))) continue;
        frame.pixels[y * width + x] = value;
      }
    }
  }
  const rgba = toRgba(frame, palette);
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
