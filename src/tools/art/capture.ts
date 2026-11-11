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
 *   wade.mp4/.gif    about 12 seconds: along the strand to Hild, wading beside her, and back out
 *   arrows.mp4/.gif  about 6 seconds: the bow drawn standing still and three arrows loosed, into
 *                    the shingle, against the rock outcrop and into the shallows
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
import { parseTimeBalance, parseWaterBalance } from '../../content/balance.ts';
import { bakeElevation } from '../../content/terrain/elevation.ts';
import { tideAt } from '../../sim/calendar/calendar.ts';
import { bandAt, stillWaterLevel } from '../../sim/land/water.ts';
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
  // No file watching and no hot reload: an edit anywhere in the repository while the capture runs
  // (another session at work) would otherwise reload the page and cut the capture off.
  const server = await createServer({
    root: REPO_ROOT,
    server: { port: 5287, hmr: false, watch: null },
    logLevel: 'error',
  });
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

    // The wade (design addendum 2.2 section 2): from where the steerer wakes, along the strand to
    // Hild, into the shallows beside her, and back out onto the shingle.
    const waded = await wadeClip(page, map, out);

    // The arrows: a second page, the bow already found, three shots from where the steerer wakes.
    const arrowFrames = await arrowsClip(browser, out);

    // The walk: up the strand from beside Hild, through the cut onto the machair.
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
          await page.screenshot(),
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
      '20',
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
        '| `walk.mp4` | 10 seconds at 2x, 25 fps: up the strand from beside Hild, through the cut, onto the machair |',
        `| \`wade.mp4\`, \`wade.gif\` | ${(waded / FPS).toFixed(1)} s: running along the strand to Hild, wading out beside her, a pause, and back out onto the shingle (mp4 at 2x; gif 320 x 180 round the action at 2x, 12.5 fps) |`,
        `| \`arrows.mp4\`, \`arrows.gif\` | ${(arrowFrames / FPS).toFixed(1)} s: the bow drawn standing still and three arrows loosed (into the shingle, against the rock outcrop, into the shallows), each a projectile with its shadow that sticks, breaks or splashes (mp4 at 2x; gif 320 x 180 round the steerer at 2x, 12.5 fps) |`,
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

/**
 * The arrows: the steerer wakes with the bow already found (`kit=bow`, a capture and test hook),
 * draws standing still and looses three arrows, one after another: east onto the shingle, west
 * against the rock outcrop, and south into the shallows. Each draw is held to a full draw. Writes
 * arrows.mp4 (2x) and arrows.gif (320 x 180 round the steerer, 2x, 12.5 fps). Returns the frames.
 */
async function arrowsClip(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  out: string,
): Promise<number> {
  const page = await browser.newPage({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 2,
  });
  await page.goto('http://localhost:5287/?capture&quality=full&view=play&name=Ash&body=A&kit=bow');
  await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 30_000 });
  await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
  await step(page, 30);
  const dir = join(out, '.arrows');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let frames = 0;
  const save = async (): Promise<void> => {
    writeFileSync(join(dir, `${String(frames).padStart(4, '0')}.png`), await page.screenshot());
    frames++;
  };
  const o = page.locator('.oe-overlay');
  const p = {
    x: Number(await o.getAttribute('data-px')),
    y: Number(await o.getAttribute('data-py')),
  };
  const pageAt = async (wx: number, wy: number): Promise<{ x: number; y: number }> => {
    const [cx = 0, cy = 0] = ((await o.getAttribute('data-camera')) ?? '0,0')
      .split(',')
      .map(Number);
    return { x: wx - cx, y: wy - cy };
  };
  for (const target of [
    { x: p.x + 5 * 24, y: p.y - 4 },
    { x: p.x - 6.5 * 24, y: p.y - 30 },
    { x: p.x + 1.5 * 24, y: p.y + 3.5 * 24 },
  ]) {
    const at = await pageAt(target.x, target.y);
    await page.mouse.move(at.x, at.y);
    await step(page);
    await page.mouse.down();
    // A full draw (30 ticks) is under a second: frames of 40 ms, 25 a second.
    for (let i = 0; i < 22; i++) {
      await step(page);
      await save();
    }
    await page.mouse.up();
    for (let i = 0; i < 28; i++) {
      await step(page);
      await save();
    }
  }
  await page.close();
  const input = [
    '-y',
    '-loglevel',
    'error',
    '-framerate',
    String(FPS),
    '-i',
    join(dir, '%04d.png'),
  ];
  execFileSync('ffmpeg', [
    ...input,
    '-c:v',
    'libx264',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    join(out, 'arrows.mp4'),
  ]);
  execFileSync('ffmpeg', [
    ...input,
    '-vf',
    'fps=12.5,crop=640:360:320:180,split[a][b];[a]palettegen=max_colors=96:stats_mode=full[p];[b][p]paletteuse=dither=none',
    join(out, 'arrows.gif'),
  ]);
  rmSync(dir, { recursive: true, force: true });
  return frames;
}

/** The longest the wade clip may run, in frames (about 12 s). */
const WADE_FRAMES = 12 * FPS;

/**
 * The wade: the steerer runs along the strand towards Hild (out of deep and waist water, by a
 * tile path), walks the last stretch, wades out to stand knee to waist deep beside her, turns to
 * face her, pauses, and walks back out onto the shingle, dripping. Records at most WADE_FRAMES
 * frames, from a few tiles out, and writes wade.mp4 (2x) and wade.gif (320 x 180 round the
 * action, 2x, 12.5 fps, one palette). Returns the frames recorded.
 */
async function wadeClip(
  page: Page,
  map: ReturnType<typeof parseZoneMap>,
  out: string,
): Promise<number> {
  const balance = JSON.parse(
    readFileSync(join(REPO_ROOT, 'content/balance.json'), 'utf8'),
  ) as unknown;
  const water = parseWaterBalance(balance);
  const b = parseTimeBalance(balance);
  const elevation = bakeElevation(map.rows);
  const o = page.locator('.oe-overlay');
  const minute =
    6 * 60 + Math.round(Number(await o.getAttribute('data-seconds')) / (b.secondsPerHour / 60));
  const level = stillWaterLevel(tideAt({ day: 1, minuteOfDay: minute }, b));
  const band = (x: number, y: number) => bandAt(water, elevation, x, y, level)?.band ?? null;
  const shallow = (t: Tile): boolean => {
    const at = band((t.tx + 0.5) * 24, (t.ty + 0.7) * 24);
    return at !== 'WAIST' && at !== 'DEEP';
  };
  const hild = {
    x: Number(await o.getAttribute('data-hild-px')),
    y: Number(await o.getAttribute('data-hild-py')),
  };
  // Where to stand: knee or waist water just east of her (on the side the steerer comes from),
  // the nearest such point to her at her own row or a little in front.
  let spot: { x: number; y: number } | null = null;
  // At least 10 px east of her feet so the two figures read apart; nearest first. The water must
  // be knee or waist deep all round the spot (the steering stops within a few pixels of it).
  const wading = (x: number, y: number): boolean =>
    [
      [0, 0],
      [4, 0],
      [-4, 0],
      [0, 4],
      [0, -4],
    ].every(([dx = 0, dy = 0]) => {
      const at = band(x + dx, y + dy);
      return at === 'KNEE' || at === 'WAIST';
    });
  let best = Infinity;
  for (let dx = 10; dx <= 30; dx += 1)
    for (let dy = -2; dy <= 24; dy += 1) {
      const d = Math.hypot(dx, dy * 1.5);
      if (d < best && wading(hild.x + dx, hild.y + dy)) {
        best = d;
        spot = { x: hild.x + dx, y: hild.y + dy };
      }
    }
  if (spot === null)
    throw new Error(`no knee or waist water beside Hild at ${hild.x},${hild.y} (level ${level})`);
  const wadeTo = spot;
  // The stand-off on dry ground a little up the beach from that spot, reached by a tile path that
  // keeps out of waist and deep water.
  let ashorePoint = { x: wadeTo.x + 30, y: wadeTo.y - 14 };
  for (let up = 14; up < 60 && band(ashorePoint.x, ashorePoint.y) !== null; up += 2)
    ashorePoint = { x: wadeTo.x + 30, y: wadeTo.y - up };
  const goal = tileOf(map, ashorePoint.x, ashorePoint.y);
  const begin = await where(page);
  const route =
    findPath(
      map,
      false,
      tileOf(map, begin.x, begin.y),
      (t) => t.tx === goal.tx && t.ty === goal.ty,
      shallow,
    ) ?? [];
  if (route.length === 0) throw new Error('no path to Hild');
  const waypoints = [
    ...route.slice(1, -1).map((t) => ({ x: (t.tx + 0.5) * 24, y: (t.ty + 0.7) * 24 })),
    ashorePoint,
  ];
  const wadeDir = join(out, '.wade');
  rmSync(wadeDir, { recursive: true, force: true });
  mkdirSync(wadeDir, { recursive: true });
  const keys = new Set<string>();
  let frames = 0;
  const save = async (): Promise<void> => {
    if (frames >= WADE_FRAMES) return;
    writeFileSync(join(wadeDir, `${String(frames).padStart(4, '0')}.png`), await page.screenshot());
    frames++;
  };
  const release = async (): Promise<void> => {
    for (const k of keys) await page.keyboard.up(k);
    keys.clear();
  };
  // Run along the strand; walk the last few tiles; record from about four seconds out.
  let k = 1;
  let running = false;
  for (let guard = 0; guard < 4000 && k < waypoints.length; guard++) {
    const left = waypoints.length - k;
    const run = left > 3;
    if (run !== running) {
      if (run) await page.keyboard.down('ShiftLeft');
      else await page.keyboard.up('ShiftLeft');
      running = run;
    }
    const to = waypoints[k];
    if (to !== undefined && (await steer(page, keys, to))) k++;
    await step(page);
    if (left <= 9) await save();
  }
  if (running) await page.keyboard.up('ShiftLeft');
  const go = async (to: { x: number; y: number }, limit: number): Promise<void> => {
    for (let guard = 0; guard < limit; guard++) {
      if (await steer(page, keys, to)) break;
      await step(page);
      await save();
    }
    await release();
  };
  // Out into the water beside her, a turn to face her, a pause, and back out onto the shingle.
  await go(wadeTo, 120);
  await page.keyboard.down('KeyA');
  await step(page);
  await page.keyboard.up('KeyA');
  for (let i = 0; i < FPS * 2.5; i++) {
    await step(page);
    await save();
  }
  await go(ashorePoint, 120);
  await go({ x: ashorePoint.x + 10, y: ashorePoint.y - 24 }, 80);
  for (let i = 0; i < FPS && frames < WADE_FRAMES; i++) {
    await step(page);
    await save();
  }
  const input = [
    '-y',
    '-loglevel',
    'error',
    '-framerate',
    String(FPS),
    '-i',
    join(wadeDir, '%04d.png'),
  ];
  execFileSync('ffmpeg', [
    ...input,
    '-c:v',
    'libx264',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    join(out, 'wade.mp4'),
  ]);
  // The gif: the middle of the view (the camera keeps the steerer centred), 320 x 180 at 2x.
  execFileSync('ffmpeg', [
    ...input,
    '-vf',
    'fps=12.5,crop=640:360:320:200,split[a][b];[a]palettegen=max_colors=96:stats_mode=full[p];[b][p]paletteuse=dither=none',
    join(out, 'wade.gif'),
  ]);
  rmSync(wadeDir, { recursive: true, force: true });
  return frames;
}

if (import.meta.filename === process.argv[1]) {
  const label = process.argv[2];
  if (label === undefined || !/^[a-z0-9-]+$/.test(label)) {
    console.error('usage: npm run capture -- <label>   (e.g. stage-07)');
    process.exit(1);
  }
  console.log(await capture(label));
}
