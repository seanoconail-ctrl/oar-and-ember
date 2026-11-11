/**
 * Backgrounds for the Stage 6 rework's approval renders (Book 3: a redrawn character is shown
 * rendered before it is wired into the game). The game runs in capture mode with its people left
 * out (`?actors=none`) and the camera held (`?camera=tx,ty`); every frame is saved at 1x with the
 * drawn tide and clock, and the water depth under every pixel, so the compositor
 * (assets/art/authoring/preview48.py) can stand the proposed people in the real scene, masked at
 * the real waterline.
 *
 *   node src/tools/art/preview48.ts <name> <tx,ty> <frames> [fps] [body]
 *
 * writes <scratch>/<name>/frame-NNN.png, depth-NNN.u8 (640 x 360 bytes: depth in height units x 250, capped at 1) and
 * meta.json ({ camera, tide, seconds } per frame) under docs/art/stage-06-rework/.work/.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { bakeElevation, waterDepthAt } from '../../render/elevation.ts';
import { parseZoneMap } from '../../sim/land/zoneMap.ts';
import { REPO_ROOT } from './loadTitleArt.ts';
import { decodePng, encodePng } from './png.ts';

const WORK = 'docs/art/stage-06-rework/.work';

async function main(): Promise<void> {
  const [name = 'bg', camera = '30,40', framesText = '1', fpsText = '25', body = 'A'] =
    process.argv.slice(2);
  const frames = Number(framesText);
  const stepMs = 1000 / Number(fpsText);
  const out = join(REPO_ROOT, WORK, name);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const map = parseZoneMap(
    JSON.parse(
      readFileSync(join(REPO_ROOT, 'content/zones/zone_sk_strand.json'), 'utf8'),
    ) as unknown,
    'zone_sk_strand.json',
  );
  const elevation = bakeElevation(map.rows);
  const server = await createServer({ root: REPO_ROOT, server: { port: 5288 }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 640, height: 360 },
      deviceScaleFactor: 1,
    });
    await page.goto(
      `http://localhost:5288/?view=play&capture&quality=full&actors=none&camera=${camera}&body=${body}`,
    );
    await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 60_000 });
    await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
    const step = async (n: number): Promise<void> => {
      await page.evaluate(
        ([k, d]) => {
          const w = window as unknown as { oeStep: (ms: number) => void };
          for (let i = 0; i < k; i++) w.oeStep(d);
        },
        [n, stepMs] as const,
      );
    };
    await step(Math.round(2000 / stepMs));
    const meta: { camera: number[]; tide: number; seconds: number }[] = [];
    const o = page.locator('.oe-overlay');
    for (let f = 0; f < frames; f++) {
      if (f > 0) await step(1);
      const png = decodePng(await page.screenshot());
      const tag = String(f).padStart(3, '0');
      writeFileSync(join(out, `frame-${tag}.png`), encodePng(png));
      const cam = ((await o.getAttribute('data-camera')) ?? '0,0').split(',').map(Number);
      const tide = Number(await o.getAttribute('data-tide'));
      const seconds = Number(await o.getAttribute('data-seconds'));
      meta.push({ camera: cam, tide, seconds });
      const depth = new Uint8Array(640 * 360);
      for (let y = 0; y < 360; y++)
        for (let x = 0; x < 640; x++)
          depth[y * 640 + x] = Math.round(
            Math.min(
              1,
              waterDepthAt(elevation, x + (cam[0] ?? 0), y + (cam[1] ?? 0), tide, seconds),
            ) * 250,
          );
      writeFileSync(join(out, `depth-${tag}.u8`), depth);
    }
    writeFileSync(join(out, 'meta.json'), JSON.stringify(meta));
    console.log(
      `${name}: ${frames} frames, camera ${meta[0]?.camera.join(',')}, tide ${meta[0]?.tide}`,
    );
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
