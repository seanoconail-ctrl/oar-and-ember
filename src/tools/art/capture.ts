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
 * From Stage 7 (`stage-07`), the strand's clips give way to the broch at home (campCapture):
 *   broch-day.png, broch-night.png, broch-s1.png (and @2x)   the camp by day, by night with the
 *                    fire lit, and raised to S1, the steerer standing
 *   broch-*-motion.png, compare-day.png, compare-night.png   motion maps, and the approved mockup
 *                    (docs/art/mockups/stage-07/) beside the capture at 2x
 *   broch.mp4/.gif   10 seconds: the steerer walks to the fire ring and lights it (the kneel work
 *                    loop, a plain action with no timing ring), the flames and smoke rise, Hild at the fire
 *   sleep.mp4/.gif   a night's sleep after 18:00: lying down in the lean-to, the night passing, and
 *                    the morning report (the overlay shown)
 * Needs ffmpeg for the clip.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createServer } from 'vite';
import { parseTimeBalance, parseWaterBalance } from '../../content/balance.ts';
import { parseCombatBalance } from '../../content/combatBalance.ts';
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
const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
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
    if (SOUTH_LABELS.has(label)) {
      await page.close();
      const south = await southCapture(browser, out);
      writeFileSync(join(out, 'README.md'), southReadme(label, motion.share, south));
      return `${out}: strand motion ${pct(motion.share)}, ${south.views
        .map((v) => `${v.view.name} ${pct(v.share)}`)
        .join(', ')}; Hag's Seat clip ${(south.clipFrames / FPS).toFixed(1)} s`;
    }
    if (FIGHT_LABELS.has(label)) {
      await page.close();
      const fight = await fightCapture(browser, out);
      writeFileSync(join(out, 'README.md'), fightReadme(label, motion.share, fight));
      return `${out}: strand motion ${pct(motion.share)}, wreckers at work ${pct(fight.work)}, mid-fight ${pct(fight.fight)}, gore low ${pct(fight.low)}; fight clip ${(fight.clipFrames / FPS).toFixed(1)} s`;
    }
    if (CAMP_LABELS.has(label)) {
      await page.close();
      const camp = await campCapture(browser, out);
      const people = PEOPLE_LABELS.has(label) ? await peopleCapture(browser, out) : null;
      writeFileSync(join(out, 'README.md'), campReadme(label, motion.share, camp, people));
      return `${out}: strand motion ${pct(motion.share)}, broch by day ${pct(camp.day)}, by night ${pct(camp.night)}, S1 ${pct(camp.s1)}${
        people === null
          ? ''
          : `; Hild fishing ${pct(people.fishing)}, at supper ${pct(people.supper)}, at dusk ${pct(people.dusk)}`
      }`;
    }

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

/** Captures that show the broch at home instead of the strand's clips (Stage 7 onwards). */
const CAMP_LABELS = new Set(['stage-07', 'stage-08']);
/** Captures that add the household's day: Hild at her work, at supper and at dusk (Stage 8). */
const PEOPLE_LABELS = new Set(['stage-08']);
/** The approved Stage 7 mockup's figures (docs/art/mockups/stage-07/README.md). */
const CAMP_MOCKUP = {
  day: 'docs/art/mockups/stage-07/s0-day.png',
  night: 'docs/art/mockups/stage-07/s0-night.png',
  motion: { day: 0.998, dayFrozen: 0.927, night: 1.0, nightFrozen: 0.941 },
};

interface CampCaptureResult {
  readonly day: number;
  readonly night: number;
  readonly s1: number;
  readonly brochFrames: number;
  readonly sleepFrames: number;
}

/** The still with cells that do not keep moving tinted red. */
function motionMap(still: RgbaImage, motion: ReturnType<typeof continuousMotion>): RgbaImage {
  const marked = { width: still.width, height: still.height, data: Uint8Array.from(still.data) };
  motion.cells.forEach((moving, k) => {
    if (moving) return;
    const cx = (k % motion.cellsX) * MOTION_CELL;
    const cy = Math.floor(k / motion.cellsX) * MOTION_CELL;
    for (let y = cy; y < cy + MOTION_CELL; y++)
      for (let x = cx; x < cx + MOTION_CELL; x++) {
        const i = (y * still.width + x) * 4;
        marked.data[i] = Math.round((marked.data[i] ?? 0) * 0.3 + 140);
        marked.data[i + 1] = Math.round((marked.data[i + 1] ?? 0) * 0.3 + 28);
        marked.data[i + 2] = Math.round((marked.data[i + 2] ?? 0) * 0.3 + 28);
      }
  });
  return marked;
}

/** Opens play at the broch through the camp hooks (src/scenes/camp.ts). */
async function openCamp(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  query: string,
  overlay: boolean,
): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 2,
  });
  await page.goto(
    `http://localhost:5287/?capture&quality=full&view=play&name=Ash&body=A&camp=broch&${query}`,
  );
  await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 30_000 });
  if (!overlay)
    await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
  await step(page, 60);
  return page;
}

/** A still of the camp at 1x and 2x, its motion with the camera still, and its motion map. */
async function campStill(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  out: string,
  name: string,
  query: string,
  ready?: (page: Page) => Promise<boolean>,
): Promise<{ share: number; still2: RgbaImage }> {
  const page = await openCamp(browser, query, false);
  // Stage 8: wait for the people to be at what they are doing before the still.
  if (ready !== undefined)
    for (let i = 0; i < 600 && !(await ready(page)); i++) await step(page, 2);
  const still2 = await shot(page);
  writeFileSync(join(out, `${name}@2x.png`), encodePng(still2));
  const still1 = half(still2);
  writeFileSync(join(out, `${name}.png`), encodePng(still1));
  const stills: Uint8Array[] = [still1.data];
  for (let i = 0; i < 40; i++) {
    await step(page, 4);
    stills.push(half(await shot(page)).data);
  }
  const motion = continuousMotion(stills, 640, 360);
  writeFileSync(join(out, `${name}-motion.png`), encodePng(motionMap(still1, motion)));
  await page.close();
  return { share: motion.share, still2 };
}

/** Encodes recorded frames as an mp4 at 2x and a gif of the middle 320 x 180 at 12.5 fps. */
function encodeClip(dir: string, out: string, name: string): void {
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
    join(out, `${name}.mp4`),
  ]);
  execFileSync('ffmpeg', [
    ...input,
    '-vf',
    'fps=12.5,crop=640:360:320:180,split[a][b];[a]palettegen=max_colors=96:stats_mode=full[p];[b][p]paletteuse=dither=none',
    join(out, `${name}.gif`),
  ]);
}

/**
 * Stage 7: the broch by day, by night and at S1 (stills, motion, the mockup beside them), a
 * 10-second clip of the fire being lit, and a night's sleep to the morning report.
 */
async function campCapture(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  out: string,
): Promise<CampCaptureResult> {
  const camp = JSON.parse(readFileSync(join(REPO_ROOT, 'content/camp.json'), 'utf8')) as {
    sites: { key: string; x: number; y: number }[];
  };
  const site = (key: string): { x: number; y: number } => {
    const at = camp.sites.find((x) => x.key === key);
    if (at === undefined) throw new Error(`no camp site ${key}`);
    return at;
  };
  const day = await campStill(browser, out, 'broch-day', 'time=16:30&fire=lit&wood=3&tended=1');
  const night = await campStill(browser, out, 'broch-night', 'time=23:00&fire=lit&wood=3&tended=1');
  const s1 = await campStill(
    browser,
    out,
    'broch-s1',
    'time=16:30&stage=S1&fire=lit&wood=6&tended=1',
  );
  for (const [k, img] of [
    ['day', day.still2],
    ['night', night.still2],
  ] as const) {
    const mock = decodePng(readFileSync(join(REPO_ROOT, CAMP_MOCKUP[k])));
    writeFileSync(join(out, `compare-${k}.png`), encodePng(sideBySide(double(mock), img)));
  }

  // The fire lit: from where the steerer stands at the camp, to the ring, kneel and light it.
  const fire = site('fire');
  const record = async (
    page: Page,
    name: string,
    plan: (save: () => Promise<void>) => Promise<void>,
  ): Promise<number> => {
    const dir = join(out, `.${name}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    let frames = 0;
    await plan(async () => {
      writeFileSync(join(dir, `${String(frames).padStart(4, '0')}.png`), await page.screenshot());
      frames++;
    });
    encodeClip(dir, out, name);
    rmSync(dir, { recursive: true, force: true });
    return frames;
  };
  const attr = async (page: Page, name: string): Promise<string> =>
    (await page.locator('.oe-overlay').getAttribute(`data-${name}`)) ?? '';
  let page = await openCamp(browser, 'time=17:40&wood=3&tended=1', false);
  const brochFrames = await record(page, 'broch', async (save) => {
    const held = new Set<string>();
    const to = { x: fire.x * 24, y: (fire.y + 0.95) * 24 };
    for (let i = 0; i < FPS * 1.2; i++) {
      await step(page);
      await save();
    }
    for (let guard = 0; guard < FPS * 4; guard++) {
      if (await steer(page, held, to)) break;
      await step(page);
      await save();
    }
    for (const k of held) await page.keyboard.up(k);
    // Face the ring, then light it: a plain action, no ring and no press (decision PT-1).
    await page.keyboard.down('KeyW');
    await step(page);
    await page.keyboard.up('KeyW');
    await save();
    await page.keyboard.press('KeyE');
    for (let i = 0; i < FPS * 8; i++) {
      await step(page);
      await save();
    }
  });
  await page.close();

  // A night's sleep: lie down in the lean-to, the night passes, the morning report.
  const bed = site('bed_s0');
  page = await openCamp(
    browser,
    `time=21:00&fire=lit&wood=3&tended=1&at=${bed.x},${bed.y + 0.6}`,
    true,
  );
  const sleepFrames = await record(page, 'sleep', async (save) => {
    for (let i = 0; i < FPS * 0.6; i++) {
      await step(page);
      await save();
    }
    await page.keyboard.press('KeyE');
    for (let i = 0; i < FPS * 9; i++) {
      await step(page);
      await save();
      if ((await attr(page, 'report')) !== '' && i > FPS * 6) break;
    }
    for (let i = 0; i < FPS * 1.5; i++) {
      await step(page);
      await save();
    }
  });
  await page.close();
  return { day: day.share, night: night.share, s1: s1.share, brochFrames, sleepFrames };
}

interface PeopleCaptureResult {
  readonly fishing: number;
  readonly supper: number;
  readonly dusk: number;
  readonly talkFrames: number;
}

/**
 * Stage 8: the household's day. Stills of Hild at her work on the rocks below the path, at supper
 * by the fire (the eat loop) and walking the shore at dusk (her tendency), each with its motion and
 * motion map; and a 10-second clip of the steerer going up to her at the fire, the conversation
 * opening, her wound taken up and tended from the talk.
 */
async function peopleCapture(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  out: string,
): Promise<PeopleCaptureResult> {
  const camp = JSON.parse(readFileSync(join(REPO_ROOT, 'content/camp.json'), 'utf8')) as {
    people: { C_HILD: { camp: { x: number; y: number }; work: { x: number; y: number } } };
  };
  const household = JSON.parse(readFileSync(join(REPO_ROOT, 'content/household.json'), 'utf8')) as {
    places: { SHORE: { x: number; y: number } };
  };
  const hild = camp.people.C_HILD;
  const attr = async (page: Page, name: string): Promise<string> =>
    (await page.locator('.oe-overlay').getAttribute(`data-${name}`)) ?? '';
  /** A still once Hild is at what she is doing (walked there, settled). */
  const settled = async (name: string, query: string, state: string): Promise<number> =>
    (
      await campStill(
        browser,
        out,
        name,
        query,
        async (page) => (await attr(page, 'hild-state')) === state,
      )
    ).share;
  const fishing = await settled(
    'hild-fishing',
    `day=2&time=09:30&tended=1&fire=lit&wood=3&zone=ZONE_SK_STRAND&at=${hild.work.x + 1.6},${hild.work.y - 0.6}`,
    'work:fish',
  );
  const supper = await settled(
    'hild-supper',
    `day=2&time=17:40&tended=1&fire=lit&wood=3&at=${hild.camp.x + 1.4},${hild.camp.y + 1.2}`,
    'eat',
  );
  const shore = household.places.SHORE;
  const dusk = await settled(
    'hild-dusk',
    `day=2&time=19:25&tended=1&fire=lit&wood=3&zone=ZONE_SK_STRAND&at=${shore.x + 2},${shore.y - 0.8}`,
    'watch',
  );
  // The talk: up to Hild at the fire, E, her wound, "Let me see to it", and the tending.
  const dir = join(out, '.talk');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const page = await openCamp(
    browser,
    `time=18:45&fire=lit&wood=3&at=${hild.camp.x - 0.5},${hild.camp.y + 1.7}`,
    true,
  );
  let frames = 0;
  const save = async (): Promise<void> => {
    writeFileSync(join(dir, `${String(frames).padStart(4, '0')}.png`), await page.screenshot());
    frames++;
  };
  const held = new Set<string>();
  // Beside her on the side away from the fire, so the nearest thing to do is to talk to her.
  const to = { x: (hild.camp.x - 0.6) * 24, y: (hild.camp.y + 0.9) * 24 };
  for (let i = 0; i < FPS; i++) {
    await step(page);
    await save();
  }
  for (let guard = 0; guard < FPS * 3; guard++) {
    if (await steer(page, held, to)) break;
    await step(page);
    await save();
  }
  for (const k of held) await page.keyboard.up(k);
  await page.keyboard.press('KeyE');
  for (let i = 0; i < FPS * 1.6; i++) {
    await step(page);
    await save();
  }
  await page.keyboard.press('Digit1');
  for (let i = 0; i < FPS * 2.2; i++) {
    await step(page);
    await save();
  }
  await page.keyboard.press('Digit1');
  for (let i = 0; i < FPS * 3.6; i++) {
    await step(page);
    await save();
  }
  await page.close();
  encodeClip(dir, out, 'talk');
  rmSync(dir, { recursive: true, force: true });
  return { fishing, supper, dusk, talkFrames: frames };
}

/** Captures that show a fight on Wreck Strand with the wreck-scavengers (Stage 9). */
const FIGHT_LABELS = new Set(['stage-09']);

interface FightCaptureResult {
  readonly work: number;
  readonly fight: number;
  readonly low: number;
  readonly clipFrames: number;
}

/** A wrecker as the page reports it (id:state:vitality:x:y:ticks to its strike's active frames). */
interface Foe {
  readonly id: string;
  readonly state: string;
  readonly x: number;
  readonly y: number;
  readonly toActive: number;
}

/** The wreckers still in the fight. */
async function foes(page: Page): Promise<Foe[]> {
  const raw = (await page.locator('.oe-overlay').getAttribute('data-fighters')) ?? '';
  return raw
    .split(',')
    .filter((f) => f !== '')
    .map((f) => {
      const [id = '', state = '', , x = '0', y = '0', to = '-1'] = f.split(':');
      return { id, state, x: Number(x), y: Number(y), toActive: Number(to) };
    })
    .filter(
      (f) =>
        f.id.startsWith('E_') &&
        f.state !== '' &&
        !['dead', 'downed', 'surrendered'].includes(f.state),
    );
}

const COMBAT = parseCombatBalance(
  JSON.parse(readFileSync(join(REPO_ROOT, 'content/balance.json'), 'utf8')) as unknown,
);
const FACING_KEY = { e: 'KeyD', w: 'KeyA', s: 'KeyS', n: 'KeyW' } as const;

/**
 * One frame of the steerer's side of a fight, played as a careful player would (as the defending
 * player of tests/unit/combat.test.ts): turn to whoever winds up a strike and parry it just before
 * it lands (Q), strike into a foe's stagger or recovery (a click on them), close on the nearest
 * otherwise, and never swing into a guard. Keys and the button held last frame are let go first.
 */
async function fightBot(page: Page, held: Set<string>): Promise<void> {
  for (const k of held) {
    if (k === 'mouse') await page.mouse.up();
    else await page.keyboard.up(k);
  }
  held.clear();
  const over = (await page.locator('.oe-overlay').getAttribute('data-game-over')) ?? '';
  if (over !== '') return;
  const at = await where(page);
  const dist = (f: Foe): number => Math.hypot(f.x - at.x, f.y - at.y);
  const list = (await foes(page)).sort((a, b) => dist(a) - dist(b));
  const near = list[0];
  if (near === undefined) return;
  const cam = ((await page.locator('.oe-overlay').getAttribute('data-camera')) ?? '0,0')
    .split(',')
    .map(Number);
  const aimAt = async (f: Foe): Promise<void> => {
    await page.mouse.move(f.x - (cam[0] ?? 0), f.y - 18 - (cam[1] ?? 0));
  };
  const facingTo = (f: Foe): keyof typeof FACING_KEY => {
    const dx = f.x - at.x;
    const dy = f.y - at.y;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
  };
  const { startup, window } = COMBAT.parry;
  const coming = list.find((f) => f.toActive >= 0 && dist(f) < 60);
  if (coming !== undefined) {
    await aimAt(coming);
    if (coming.toActive > startup + window) {
      // Turn to it: a tap of its direction.
      const k = FACING_KEY[facingTo(coming)];
      await page.keyboard.down(k);
      held.add(k);
    } else if (coming.toActive > startup) await page.keyboard.press('KeyQ');
    return;
  }
  const punish = list.find(
    (f) =>
      dist(f) < 34 &&
      (['stagger', 'parryRecovery', 'blockStun', 'guardBroken'].includes(f.state) ||
        (/^(light|heavyRelease|riposte)/.test(f.state) && f.toActive < 0)),
  );
  if (punish !== undefined) {
    await aimAt(punish);
    await page.mouse.down();
    held.add('mouse');
    return;
  }
  await aimAt(near);
  if (dist(near) > 30) {
    await steer(page, held, { x: near.x + (near.x > at.x ? -20 : 20), y: near.y });
  }
}

/**
 * Stage 9: the wreck-scavengers on Wreck Strand. A still of them at work by the wreck (the camera
 * held on them), a still in the thick of the fight with the camera held, the same at gore low, each
 * with its motion and motion map; and a 10-second clip of the steerer, seax in hand, running at
 * them and fighting (the overlay shown).
 */
async function fightCapture(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  out: string,
): Promise<FightCaptureResult> {
  const fightQuery = 'kit=seax&time=10:00&zone=ZONE_SK_STRAND&secondwind=1';
  const work = (
    await campStill(browser, out, 'wreckers-at-work', `${fightQuery}&at=36,34.2&camera=28,34.6`)
  ).share;
  /** A still once the fight has gone on a while (the steerer fighting by the bot). */
  const midFight = async (name: string, gore: string): Promise<number> =>
    (
      await campStill(
        browser,
        out,
        name,
        `${fightQuery}&at=31.5,34.6&camera=27.5,34.8&gore=${gore}`,
        (() => {
          const held = new Set<string>();
          let n = 0;
          return async (page: Page) => {
            // Fine frames, as in the clip, so the parries land on time.
            for (let k = 0; k < 10; k++) {
              await fightBot(page, held);
              await step(page, 1, 1000 / FPS);
            }
            if (n++ < 8) return false;
            for (const k of held) {
              if (k === 'mouse') await page.mouse.up();
              else await page.keyboard.up(k);
            }
            return true;
          };
        })(),
      )
    ).share;
  const fight = await midFight('fight', 'full');
  const low = await midFight('fight-low', 'low');
  // The clip: from east of them, the steerer runs in and fights, the camera following.
  const dir = join(out, '.fight');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const page = await openCamp(browser, `${fightQuery}&at=33.5,34.6`, true);
  let frames = 0;
  const save = async (): Promise<void> => {
    writeFileSync(join(dir, `${String(frames).padStart(4, '0')}.png`), await page.screenshot());
    frames++;
  };
  const held = new Set<string>();
  while (frames < FPS * 10) {
    await fightBot(page, held);
    await step(page);
    await save();
  }
  for (const k of held) {
    if (k === 'mouse') await page.mouse.up();
    else await page.keyboard.up(k);
  }
  await page.close();
  encodeClip(dir, out, 'fight');
  rmSync(dir, { recursive: true, force: true });
  return { work, fight, low, clipFrames: frames };
}

/** Captures of the southern zones and the three searches (Stage 10). */
const SOUTH_LABELS = new Set(['stage-10']);

interface SouthView {
  readonly name: string;
  readonly what: string;
  readonly query: string;
  /** Whether a 4-second loop of it is made too (for the mockups in docs/art/mockups/stage-10/). */
  readonly loop?: boolean;
}

/** Each southern view: the camera held, the steerer standing, the searches open (`camp=broch`). */
const SOUTH_VIEWS: readonly SouthView[] = [
  {
    name: 'hagseat',
    what: "The Hag's Seat at 11:00: the standing stone weeping, the pale light by it, Runa hurt below it with her tools, the gale in the grass, the cliffs and the geo",
    query: 'time=11:00&zone=ZONE_SK_HAGSEAT&at=50.5,23.6&camera=47.5,21.5',
    loop: true,
  },
  {
    name: 'neck',
    what: "The Hag's neck at 11:00: the cliff path below, the rock ridges either side and the sea in the geo",
    query: 'time=11:00&zone=ZONE_SK_HAGSEAT&at=66.5,21.5&camera=60.5,23.5',
  },
  {
    name: 'fold',
    what: 'The sheepfold under the Hollow Cairn at 10:00: the wreck-scavengers at the gate, Bran inside guarding Thorkel, the sheep outside',
    query: 'time=10:00&zone=ZONE_SK_CAIRN&at=44.5,39.6&camera=36.5,35.5',
    loop: true,
  },
  {
    name: 'cairn',
    what: 'The Hollow Cairn at 10:00: the grassed mound and its kerb, the heath round it',
    query: 'time=10:00&zone=ZONE_SK_CAIRN&at=56.5,27.6&camera=60.5,20.5',
  },
  {
    name: 'kelda',
    what: 'The Kelda Spring on the machair at 14:00: the pool welling up, its stream running down to the burn',
    query: 'time=14:00&zone=ZONE_SK_MACHAIR&at=61.5,14.6&camera=57.5,12.5',
  },
];

interface SouthCaptureResult {
  readonly views: readonly { readonly view: SouthView; readonly share: number }[];
  readonly clipFrames: number;
  readonly loops: readonly string[];
}

/**
 * Stage 10: a still of each southern view with its motion (the camera held) and motion map, a
 * 4-second loop of the Hag's Seat and of the fold (the
 * camera held, at 1x), and a 10-second clip of the steerer walking the Hag's Seat headland past the
 * weeping stone and through the neck, the camera following.
 */
async function southCapture(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  out: string,
): Promise<SouthCaptureResult> {
  const views: { view: SouthView; share: number }[] = [];
  for (const view of SOUTH_VIEWS) {
    const { share } = await campStill(browser, out, view.name, view.query);
    views.push({ view, share });
  }
  // The loops: 4 seconds at 1x, the camera held (as the mockups' loops are made).
  const loops: string[] = [];
  for (const view of SOUTH_VIEWS.filter((v) => v.loop === true)) {
    const dir = join(out, `.loop-${view.name}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const page = await openCamp(browser, view.query, false);
    for (let k = 0; k < FPS * 4; k++) {
      await step(page);
      writeFileSync(
        join(dir, `${String(k).padStart(4, '0')}.png`),
        encodePng(half(await shot(page))),
      );
    }
    await page.close();
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(FPS),
      '-i',
      join(dir, '%04d.png'),
      '-vf',
      'split[a][b];[a]palettegen=max_colors=160:stats_mode=full[p];[b][p]paletteuse=dither=none',
      join(out, `${view.name}-loop.gif`),
    ]);
    rmSync(dir, { recursive: true, force: true });
    loops.push(`${view.name}-loop.gif`);
  }
  // The clip: from the heath west of the stone, east past Runa and the stone, through the neck.
  const dir = join(out, '.south');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const page = await openCamp(browser, 'time=11:00&zone=ZONE_SK_HAGSEAT&at=36.5,23.2', true);
  let frames = 0;
  await page.keyboard.down('KeyD');
  let up = false;
  while (frames < FPS * 10) {
    // Below Runa and the stone, then up onto the neck's turf between the rock ridges.
    const at = await where(page);
    const want = at.x > 50.5 * 24 && at.y > 20.6 * 24;
    if (want !== up) {
      if (want) await page.keyboard.down('KeyW');
      else await page.keyboard.up('KeyW');
      up = want;
    }
    await step(page);
    writeFileSync(join(dir, `${String(frames).padStart(4, '0')}.png`), await page.screenshot());
    frames++;
  }
  await page.keyboard.up('KeyD');
  if (up) await page.keyboard.up('KeyW');
  await page.close();
  encodeClip(dir, out, 'hagseat-walk');
  rmSync(dir, { recursive: true, force: true });
  return { views, clipFrames: frames, loops };
}

function southReadme(label: string, strand: number, c: SouthCaptureResult): string {
  const all = [strand, ...c.views.map((v) => v.share)];
  return [
    `# Capture: ${label}`,
    '',
    'Made by `npm run capture -- ' + label + '` (src/tools/art/capture.ts). Compare with',
    '`docs/art/reference/` (Book 7 section 14), the Stage 10 mockups in `docs/art/mockups/stage-10/`',
    'and the people sheets in `docs/art/stage-10/people/`.',
    '',
    '| File | What it is |',
    '|---|---|',
    '| `still.png`, `still@2x.png`, `motion.png`, `compare.png` | Wreck Strand where the steerer wakes (as at Stage 6), its motion map, and the reference beside it |',
    ...c.views.map((v) => `| \`${v.view.name}.png\` (and @2x, \`-motion.png\`) | ${v.view.what} |`),
    ...c.loops.map(
      (l) => `| \`${l}\` | 4 s at 1x, 25 fps, the camera held: the view above as it moves |`,
    ),
    `| \`hagseat-walk.mp4\`, \`hagseat-walk.gif\` | ${(c.clipFrames / FPS).toFixed(1)} s at 2x, 25 fps (gif 320 x 180 round the middle, 12.5 fps): the steerer walks east over the Hag's Seat headland, past Runa and the weeping stone, and into the neck, the camera following (the overlay shown) |`,
    '',
    '## Motion with the camera still',
    '',
    '| View | Continuous motion |',
    '|---|---|',
    `| Wreck Strand (41 frames over 6.4 s) | ${pct(strand)} |`,
    ...c.views.map((v) => `| ${v.view.name} | ${pct(v.share)} |`),
    `| Book 7 threshold | ${pct(MOTION_THRESHOLD)} |`,
    '',
    all.every((v) => v >= MOTION_THRESHOLD)
      ? 'Every view meets the threshold.'
      : '**A view is below the threshold: the stage is not done.**',
    '',
  ].join('\n');
}

function fightReadme(label: string, strand: number, f: FightCaptureResult): string {
  const all = [strand, f.work, f.fight, f.low];
  return [
    `# Capture: ${label}`,
    '',
    'Made by `npm run capture -- ' + label + '` (src/tools/art/capture.ts). Compare with',
    '`docs/art/reference/` (Book 7 section 14) and the people sheets in `docs/art/stage-09/`.',
    '',
    '| File | What it is |',
    '|---|---|',
    '| `still.png`, `still@2x.png`, `motion.png`, `compare.png` | Wreck Strand where the steerer wakes (as at Stage 6), its motion map, and the reference beside it |',
    '| `wreckers-at-work.png` (and @2x, `-motion.png`) | The three wreck-scavengers by the wreck on the strand, 10:00, unaware and at work (the camera held on them) |',
    '| `fight.png` (and @2x, `-motion.png`) | The fight on the strand at gore full, the steerer with the seax among them (the camera held): blood on the shingle, the fallen where they fell. Three on one, the wreckers strike one at a time (S9-29) |',
    '| `fight-low.png` (and @2x, `-motion.png`) | The same fight at gore low: fewer, darker stains and no pieces |',
    `| \`fight.mp4\`, \`fight.gif\` | ${(f.clipFrames / FPS).toFixed(1)} s at 2x, 25 fps (gif 320 x 180 round the middle, 12.5 fps): the steerer runs at them from the east, seax in hand, and fights, the camera following (the overlay shown) |`,
    '',
    '## Motion with the camera still',
    '',
    '| View | Continuous motion |',
    '|---|---|',
    `| Wreck Strand (41 frames over 6.4 s) | ${pct(strand)} |`,
    `| The wreckers at work | ${pct(f.work)} |`,
    `| The fight, gore full | ${pct(f.fight)} |`,
    `| The fight, gore low | ${pct(f.low)} |`,
    `| Book 7 threshold | ${pct(MOTION_THRESHOLD)} |`,
    '',
    all.every((v) => v >= MOTION_THRESHOLD)
      ? 'Every view meets the threshold.'
      : '**A view is below the threshold: the stage is not done.**',
    '',
  ].join('\n');
}

function campReadme(
  label: string,
  strand: number,
  c: CampCaptureResult,
  people: PeopleCaptureResult | null = null,
): string {
  const m = CAMP_MOCKUP.motion;
  const peopleRows =
    people === null
      ? []
      : [
          '| `hild-fishing.png`, `hild-supper.png`, `hild-dusk.png` (and @2x, `-motion.png`) | Stage 8: Hild at her work on the rocks below the path (the fish loop), at supper by the fire (the eat loop) and at dusk on the shore, watching the water (her tendency) |',
          `| \`talk.mp4\`, \`talk.gif\` | ${(people.talkFrames / FPS).toFixed(1)} s: the steerer goes up to Hild by the fire at evening; the conversation opens with her greeting, her wound is taken up and "Let me see to it" tends it in the kneel loop (the overlay shown) |`,
        ];
  const peopleMotion =
    people === null
      ? []
      : [
          `| Hild fishing on the rocks, day 2 09:30 | ${pct(people.fishing)} |`,
          `| Hild at supper by the fire, 17:40 | ${pct(people.supper)} |`,
          `| Hild on the shore at dusk, 19:25 | ${pct(people.dusk)} |`,
        ];
  const all = [
    strand,
    c.day,
    c.night,
    c.s1,
    ...(people === null ? [] : [people.fishing, people.supper, people.dusk]),
  ];
  return [
    `# Capture: ${label}`,
    '',
    'Made by `npm run capture -- ' + label + '` (src/tools/art/capture.ts). Compare with',
    '`docs/art/reference/` and the approved Stage 7 mockup `docs/art/mockups/stage-07/` (Book 7',
    'section 14).',
    '',
    '| File | What it is |',
    '|---|---|',
    '| `still.png`, `still@2x.png`, `motion.png`, `compare.png` | Wreck Strand where the steerer wakes (as at Stage 6), its motion map, and the reference beside it |',
    '| `broch-day.png`, `broch-day@2x.png` | The broch at S0, 16:30, as the mockup: the lean-to, the salvage, the fire burning in its ring with Hild by it, turf in the court and on the wall head, sheep outside |',
    '| `broch-night.png`, `broch-night@2x.png` | The same at 23:00, the fire lit: flames, smoke and the flickering warm pool under the night grade |',
    '| `broch-s1.png`, `broch-s1@2x.png` | The camp raised to S1 by day: the sail roof, beds, the kerbed hearth burning, the floor cleared to the flags, the door |',
    '| `broch-*-motion.png` | Each still with the cells that do not keep moving tinted red |',
    '| `compare-day.png`, `compare-night.png` | The approved mockup (left, S0 day and night) beside the capture (right), both at 2x |',
    `| \`broch.mp4\`, \`broch.gif\` | ${(c.brochFrames / FPS).toFixed(1)} s at 2x, 25 fps (gif 320 x 180 round the middle, 12.5 fps): the steerer walks to the fire ring, kneels and lights it in the kneel work loop, pressing on the mark; the flames take and the smoke rises |`,
    `| \`sleep.mp4\`, \`sleep.gif\` | ${(c.sleepFrames / FPS).toFixed(1)} s: at 21:00 the steerer lies down in the lean-to (the sleep loop), the night passes under a fade, and the morning report opens (the overlay shown) |`,
    ...peopleRows,
    '',
    '## Motion with the camera still',
    '',
    '| View | Continuous motion |',
    '|---|---|',
    `| Wreck Strand (41 frames over 6.4 s) | ${pct(strand)} |`,
    `| The broch by day, S0 | ${pct(c.day)} |`,
    `| The broch by night, S0, fire lit | ${pct(c.night)} |`,
    `| The broch by day, S1 | ${pct(c.s1)} |`,
    ...peopleMotion,
    `| Mockup: S0 day (clouds moving / frozen) | ${pct(m.day)} / ${pct(m.dayFrozen)} |`,
    `| Mockup: S0 night (clouds moving / frozen) | ${pct(m.night)} / ${pct(m.nightFrozen)} |`,
    `| Book 7 threshold | ${pct(MOTION_THRESHOLD)} |`,
    '',
    all.every((v) => v >= MOTION_THRESHOLD)
      ? 'Every view meets the threshold.'
      : '**A view is below the threshold: the stage is not done.**',
    '',
  ].join('\n');
}

if (import.meta.filename === process.argv[1]) {
  const label = process.argv[2];
  if (label === undefined || !/^[a-z0-9-]+$/.test(label)) {
    console.error('usage: npm run capture -- <label>   (e.g. stage-07)');
    process.exit(1);
  }
  console.log(await capture(label));
}
