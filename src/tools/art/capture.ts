/**
 * Captures for the Book 7 standard (CLAUDE.md: every stage that adds or changes something
 * visible ends with a screenshot and a 10-second capture, compared with docs/art/reference/).
 *
 *   npm run capture -- stage-07            writes docs/art/captures/stage-07/
 *
 * The game runs in capture mode (?capture): the page advances only when told, one frame of a
 * fixed length at a time, so every frame is exact and the clip is real time at 25 frames a second
 * however slow the machine. It writes:
 *   still.png        the opening view at 1x (640 x 360), the steerer standing
 *   still@2x.png     the same at 2x
 *   walk.mp4         10 seconds at 2x: the steerer walks up the strand and onto the machair
 *   compare.png      the reference mockup beside the capture, both at 2x
 *   motion.png       the still view with cells that do not keep moving marked red
 *   README.md        the figures: motion with the camera still, against the reference
 * Needs ffmpeg for the clip.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createServer } from 'vite';
import { parseZoneMap, tileOf } from '../../sim/land/zoneMap.ts';
import { findPath } from '../play/openingBot.ts';
import type { Tile } from '../play/openingBot.ts';
import { REPO_ROOT } from './loadTitleArt.ts';
import { continuousMotion, MOTION_CELL, MOTION_THRESHOLD } from './motion.ts';
import { decodePng, encodePng } from './png.ts';
import type { RgbaImage } from './png.ts';

const FPS = 25;
const STEP_MS = 1000 / FPS;
const CLIP_SECONDS = 10;
/** The approved mockup's figures (docs/art/README.md). */
const REFERENCE = {
  image: 'docs/art/reference/wreck-strand-target.png',
  motion: 1.0,
  motionCloudsFrozen: 0.892,
};

/** Every other pixel of a 2x screenshot: the exact 1x frame. */
function half(img: RgbaImage): RgbaImage {
  const width = img.width / 2;
  const height = img.height / 2;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let c = 0; c < 4; c++)
        data[(y * width + x) * 4 + c] = img.data[(y * 2 * img.width + x * 2) * 4 + c] ?? 0;
  return { width, height, data };
}

function double(img: RgbaImage): RgbaImage {
  const width = img.width * 2;
  const height = img.height * 2;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let c = 0; c < 4; c++)
        data[(y * width + x) * 4 + c] = img.data[((y >> 1) * img.width + (x >> 1)) * 4 + c] ?? 0;
  return { width, height, data };
}

function sideBySide(a: RgbaImage, b: RgbaImage, gap = 16): RgbaImage {
  const width = a.width + gap + b.width;
  const height = Math.max(a.height, b.height);
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([24, 26, 30, 255], i * 4);
  const put = (img: RgbaImage, ox: number): void => {
    for (let y = 0; y < img.height; y++)
      data.set(img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4), (y * width + ox) * 4);
  };
  put(a, 0);
  put(b, a.width + gap);
  return { width, height, data };
}

async function shot(page: Page): Promise<RgbaImage> {
  return decodePng(await page.screenshot());
}

async function step(page: Page, frames = 1, ms = STEP_MS): Promise<void> {
  await page.evaluate(
    ([n, d]) => {
      const w = window as unknown as { oeStep: (ms: number) => void };
      for (let i = 0; i < n; i++) w.oeStep(d);
    },
    [frames, ms] as const,
  );
}

async function where(page: Page): Promise<{ x: number; y: number }> {
  const o = page.locator('.oe-overlay');
  return {
    x: Number(await o.getAttribute('data-px')),
    y: Number(await o.getAttribute('data-py')),
  };
}

/** Holds the keys that steer towards `to`; returns true once there. */
async function steer(
  page: Page,
  held: Set<string>,
  to: { x: number; y: number },
): Promise<boolean> {
  const at = await where(page);
  const dx = to.x - at.x;
  const dy = to.y - at.y;
  const want = new Set<string>();
  if (dx > 3) want.add('KeyD');
  if (dx < -3) want.add('KeyA');
  if (dy > 3) want.add('KeyS');
  if (dy < -3) want.add('KeyW');
  for (const k of held) if (!want.has(k)) await page.keyboard.up(k);
  for (const k of want) if (!held.has(k)) await page.keyboard.down(k);
  held.clear();
  for (const k of want) held.add(k);
  return want.size === 0;
}

export async function capture(label: string): Promise<string> {
  const out = join(REPO_ROOT, 'docs/art/captures', label);
  const framesDir = join(out, '.frames');
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const map = parseZoneMap(
    JSON.parse(
      readFileSync(join(REPO_ROOT, 'content/zones/zone_sk_strand.json'), 'utf8'),
    ) as unknown,
    'zone_sk_strand.json',
  );
  const server = await createServer({ root: REPO_ROOT, server: { port: 5287 }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 640, height: 360 },
      deviceScaleFactor: 2,
    });
    await page.goto('http://localhost:5287/?capture&quality=full');
    await page.waitForSelector('canvas#screen[data-state=title]', { timeout: 30_000 });
    await page.keyboard.press('Enter');
    await page.keyboard.type('Ash');
    await page.locator('.oe-naming input').press('Enter');
    await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 30_000 });
    await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
    await step(page, 60);

    // The still: the opening view, then motion with the camera still over 6.4 seconds.
    const still2 = await shot(page);
    writeFileSync(join(out, 'still@2x.png'), encodePng(still2));
    const still1 = half(still2);
    writeFileSync(join(out, 'still.png'), encodePng(still1));
    const stills: Uint8Array[] = [still1.data];
    for (let i = 0; i < 40; i++) {
      await step(page, 4);
      stills.push(half(await shot(page)).data);
    }
    const motion = continuousMotion(stills, 640, 360);
    const marked = { width: 640, height: 360, data: Uint8Array.from(still1.data) };
    motion.cells.forEach((moving, k) => {
      if (moving) return;
      const cx = (k % motion.cellsX) * MOTION_CELL;
      const cy = Math.floor(k / motion.cellsX) * MOTION_CELL;
      for (let y = cy; y < cy + MOTION_CELL; y++)
        for (let x = cx; x < cx + MOTION_CELL; x++) {
          const i = (y * 640 + x) * 4;
          marked.data[i] = Math.round((marked.data[i] ?? 0) * 0.3 + 140);
          marked.data[i + 1] = Math.round((marked.data[i + 1] ?? 0) * 0.3 + 28);
          marked.data[i + 2] = Math.round((marked.data[i + 2] ?? 0) * 0.3 + 28);
        }
    });
    writeFileSync(join(out, 'motion.png'), encodePng(marked));
    const reference = decodePng(readFileSync(join(REPO_ROOT, REFERENCE.image)));
    writeFileSync(join(out, 'compare.png'), encodePng(sideBySide(double(reference), still2)));

    // The wade (design addendum 2.2 section 2): running along the strand to Hild, wading out
    // beside her into the shallows, a pause, and back out, dripping (wade.mp4 and wade.gif at 2x).
    {
      const hild = { x: 31.5 * 24, y: 35.6 * 24 };
      const wadeDir = join(out, '.wade');
      rmSync(wadeDir, { recursive: true, force: true });
      mkdirSync(wadeDir, { recursive: true });
      const begin = await where(page);
      const route =
        findPath(map, false, tileOf(map, begin.x, begin.y), (t: Tile) => {
          const c = tileOf(map, hild.x + 30, hild.y + 6);
          return Math.abs(t.tx - c.tx) <= 0 && Math.abs(t.ty - c.ty) <= 0;
        }) ?? [];
      const targets = route
        .filter((_, i) => i % 2 === 0 || i === route.length - 1)
        .map((t) => ({ x: (t.tx + 0.5) * 24, y: (t.ty + 0.6) * 24 }));
      const keys = new Set<string>();
      let k = 0;
      let frame = 0;
      const save = async (): Promise<void> => {
        writeFileSync(
          join(wadeDir, `${String(frame).padStart(4, '0')}.png`),
          encodePng(await shot(page)),
        );
        frame++;
      };
      // Run until a few seconds out from Hild, recording the last stretch.
      await page.keyboard.down('ShiftLeft');
      for (let guard = 0; guard < 3000 && k < targets.length; guard++) {
        const to = targets[k];
        if (to !== undefined && (await steer(page, keys, to))) k++;
        await step(page);
        const at = await where(page);
        if (Math.hypot(at.x - hild.x, at.y - hild.y) < 9 * 24 && frame < 15 * FPS) await save();
        if (k === targets.length - 3) await page.keyboard.up('ShiftLeft');
      }
      await page.keyboard.up('ShiftLeft');
      // Into the water beside her, a pause, and back out.
      const near = await where(page);
      for (const to of [
        { x: hild.x + 26, y: hild.y + 2 },
        { x: hild.x + 26, y: hild.y + 2 },
        { x: near.x + 10, y: near.y + 40 },
      ]) {
        for (let guard = 0; guard < 160; guard++) {
          if (await steer(page, keys, to)) break;
          await step(page);
          await save();
        }
        for (let i = 0; i < FPS * 1.5; i++) {
          await step(page);
          await save();
        }
      }
      for (const key of keys) await page.keyboard.up(key);
      for (const [name, args] of [
        ['wade.mp4', ['-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p']],
        [
          'wade.gif',
          [
            '-vf',
            'fps=12.5,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none',
          ],
        ],
      ] as const) {
        execFileSync('ffmpeg', [
          '-y',
          '-loglevel',
          'error',
          '-framerate',
          String(FPS),
          '-i',
          join(wadeDir, '%04d.png'),
          ...args,
          join(out, name),
        ]);
      }
      rmSync(wadeDir, { recursive: true, force: true });
    }

    // The walk: up the strand from where the steerer wakes, through the cut onto the machair.
    const start = await where(page);
    const from = tileOf(map, start.x, start.y);
    const path =
      findPath(map, false, from, (t: Tile) => map.rows[t.ty]?.[t.tx] === ',' && t.ty <= 3) ?? [];
    const waypoints = path
      .filter((t, i) => {
        const a = path[i - 1];
        const b = path[i + 1];
        return (
          b === undefined ||
          a === undefined ||
          a.tx - t.tx !== t.tx - b.tx ||
          a.ty - t.ty !== t.ty - b.ty
        );
      })
      .map((t) => ({ x: (t.tx + 0.5) * 24, y: (t.ty + 0.7) * 24 }));
    const held = new Set<string>();
    let w = 0;
    // Walk unrecorded until the bank is ten tiles ahead, then record ten seconds.
    const firstGrass = path.findIndex((t) => map.rows[t.ty]?.[t.tx] === ',');
    const grassY = ((path[firstGrass]?.ty ?? 0) + 0.5) * 24;
    let recorded = 0;
    for (let guard = 0; guard < 4000 && recorded < CLIP_SECONDS * FPS; guard++) {
      const to = waypoints[w];
      if (to !== undefined && (await steer(page, held, to))) w++;
      await step(page);
      const at = await where(page);
      if (recorded > 0 || at.y - grassY < 10 * 24) {
        writeFileSync(
          join(framesDir, `${String(recorded).padStart(4, '0')}.png`),
          encodePng(await shot(page)),
        );
        recorded++;
      }
    }
    for (const k of held) await page.keyboard.up(k);
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(FPS),
      '-i',
      join(framesDir, '%04d.png'),
      '-c:v',
      'libx264',
      '-crf',
      '12',
      '-pix_fmt',
      'yuv420p',
      join(out, 'walk.mp4'),
    ]);
    rmSync(framesDir, { recursive: true, force: true });

    const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
    writeFileSync(
      join(out, 'README.md'),
      [
        `# Capture: ${label}`,
        '',
        'Made by `npm run capture -- ' + label + '` (src/tools/art/capture.ts). Compare with',
        '`docs/art/reference/` (Book 7 section 14).',
        '',
        '| File | What it is |',
        '|---|---|',
        '| `still.png`, `still@2x.png` | Wreck Strand where the steerer wakes, at 1x and 2x |',
        '| `walk.mp4` | 10 seconds at 2x, 25 fps: up the strand, through the cut, onto the machair |',
        '| `wade.mp4`, `wade.gif` | At 2x: running along the strand to Hild, wading out beside her, and back out |',
        '| `compare.png` | The approved reference (left) beside the capture (right), both at 2x |',
        '| `motion.png` | The still view; cells without continuous motion are marked red |',
        '',
        '## Motion with the camera still',
        '',
        '| Clip | Continuous motion |',
        '|---|---|',
        `| This capture (41 frames over 6.4 s) | ${pct(motion.share)} |`,
        `| Reference: Wreck Strand target | ${pct(REFERENCE.motion)} |`,
        `| Reference: Wreck Strand target, cloud shadows frozen | ${pct(REFERENCE.motionCloudsFrozen)} |`,
        `| Book 7 threshold | ${pct(MOTION_THRESHOLD)} |`,
        '',
        motion.share >= MOTION_THRESHOLD
          ? 'Meets the threshold.'
          : '**Below the threshold: the stage is not done.**',
        '',
      ].join('\n'),
    );
    return `${out}: motion ${pct(motion.share)}, ${recorded} frames`;
  } finally {
    await browser.close();
    await server.close();
  }
}

if (import.meta.filename === process.argv[1]) {
  const label = process.argv[2];
  if (label === undefined || !/^[a-z0-9-]+$/.test(label)) {
    console.error('usage: npm run capture -- <label>   (e.g. stage-07)');
    process.exit(1);
  }
  console.log(await capture(label));
}
