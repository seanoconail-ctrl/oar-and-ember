/**
 * The storm opening, captured from the real game (design addendum 2.5 section 3; Book 7 sections
 * 05 and 14):   npm run capture -- rework-2.5-storm   writes docs/art/rework-2.5/storm/
 *
 * The game runs in capture mode (?capture: the page advances only when stepped), the cold open
 * played from its first frame with the steering keys, every kept frame exact. It writes:
 *   storm-opening.gif        the middle 480 x 270 of the view at 1x, 10 frames a second, from the
 *                            first frame through the strike and the black to the waking
 *   storm-strip.png (@2x)    key frames: the storm, a wave breaking, green water, the bright frame
 *                            of the skerry's lightning, its dim frame, the mist, the strike
 *   views/*.png, @4x         stills of the whole view at 1x and 4x (the storm, the lightning), and
 *                            the cold open's motion map with the camera still (80% of cells)
 *   README.md                the figures: motion, frame cost, the strikes and their thunder
 * Needs ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { REPO_ROOT } from './loadTitleArt.ts';
import {
  continuousMotion,
  MOTION_CELL,
  MOTION_THRESHOLD,
  REDUCED_MOTION_THRESHOLD,
} from './motion.ts';
import { decodePng, encodePng } from './png.ts';
import type { RgbaImage } from './png.ts';

const TICK = 1000 / 60;
const W = 640;
const H = 360;
const CROP = { w: 320, h: 180 };
const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
const fromDataUrl = (url: string): Buffer => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

interface StormData {
  t: number;
  flash: number;
  sway: [number, number];
  bow: number;
  roll: string;
  drops: number;
  mist: number;
  strikes: [number, number][];
}

async function storm(page: Page): Promise<StormData | null> {
  const v = (await page.locator('.oe-overlay').getAttribute('data-storm')) ?? '';
  return v === '' ? null : (JSON.parse(v) as StormData);
}

/** Advances `ticks` (a frame each 6) and returns the last frame's middle `w` x `h`. */
async function advance(page: Page, ticks: number, w: number, h: number): Promise<string> {
  return page.evaluate(
    ([k, ms, cw, ch]) => {
      const win = window as unknown as { oeStep: (ms: number, draw?: boolean) => void };
      for (let left = k; left > 0; left -= 6) win.oeStep(Math.min(6, left) * ms, left <= 6);
      const c = document.querySelector<HTMLCanvasElement>('canvas#screen');
      if (c === null) return '';
      const out = document.createElement('canvas');
      out.width = cw;
      out.height = ch;
      const g = out.getContext('2d');
      if (g === null) return '';
      g.imageSmoothingEnabled = false;
      g.drawImage(c, (c.width - cw) / 2, (c.height - ch) / 2, cw, ch, 0, 0, cw, ch);
      return out.toDataURL('image/png');
    },
    [ticks, TICK, w, h] as const,
  );
}

function scale(img: RgbaImage, k: number): RgbaImage {
  const width = img.width * k;
  const height = img.height * k;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let c = 0; c < 4; c++)
        data[(y * width + x) * 4 + c] =
          img.data[(Math.floor(y / k) * img.width + Math.floor(x / k)) * 4 + c] ?? 0;
  return { width, height, data };
}

function strip(frames: readonly string[], cols: number): RgbaImage {
  const rows = Math.ceil(frames.length / cols);
  const gap = 2;
  const width = cols * CROP.w + (cols - 1) * gap;
  const height = rows * CROP.h + (rows - 1) * gap;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data[i + 3] = 255;
  frames.forEach((f, i) => {
    const img = decodePng(fromDataUrl(f));
    const ox = (i % cols) * (CROP.w + gap);
    const oy = Math.floor(i / cols) * (CROP.h + gap);
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++)
        for (let c = 0; c < 4; c++)
          data[((oy + y) * width + ox + x) * 4 + c] = img.data[(y * img.width + x) * 4 + c] ?? 0;
  });
  return { width, height, data };
}

async function open(browser: Browser, query: string): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => {
    console.log(`page error: ${e.message}`);
  });
  await page.goto(
    `http://localhost:5297/?capture&quality=full&view=play&opening=full&name=Ash&body=A${query}`,
  );
  await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 30_000 });
  await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
  return page;
}

/** The share of moving cells over 40 stills, with a motion map; the camera held still. */
async function motion(
  browser: Browser,
  query: string,
  dir: string,
  name: string,
): Promise<{ share: number; ms: number }> {
  const page = await open(browser, `&camera=still${query}`);
  await advance(page, 120, W, H);
  const first = decodePng(fromDataUrl(await advance(page, 1, W, H)));
  const stills: Uint8Array[] = [first.data];
  for (let i = 0; i < 40; i++)
    stills.push(decodePng(fromDataUrl(await advance(page, 10, W, H))).data);
  const m = continuousMotion(stills, W, H);
  const marked = { width: W, height: H, data: Uint8Array.from(first.data) };
  m.cells.forEach((moving, k) => {
    if (moving) return;
    const cx = (k % m.cellsX) * MOTION_CELL;
    const cy = Math.floor(k / m.cellsX) * MOTION_CELL;
    for (let y = cy; y < cy + MOTION_CELL; y++)
      for (let x = cx; x < cx + MOTION_CELL; x++) {
        const i = (y * W + x) * 4;
        marked.data[i] = Math.round((marked.data[i] ?? 0) * 0.3 + 140);
        marked.data[i + 1] = Math.round((marked.data[i + 1] ?? 0) * 0.3 + 28);
        marked.data[i + 2] = Math.round((marked.data[i + 2] ?? 0) * 0.3 + 28);
      }
  });
  writeFileSync(join(dir, `${name}-motion.png`), encodePng(marked));
  const ms = Number((await page.locator('.oe-overlay').getAttribute('data-frame-ms')) ?? 0);
  await page.close();
  return { share: m.share, ms };
}

export async function stormCapture(browser: Browser): Promise<string> {
  const out = join(REPO_ROOT, 'docs/art/rework-2.5/storm');
  const views = join(out, 'views');
  const framesDir = join(out, '.frames');
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  mkdirSync(views, { recursive: true });
  const page = await open(browser, '');
  const frames: string[] = [];
  const keys: { name: string; frame: string }[] = [];
  const want = new Map<string, (s: StormData, prev: StormData | null) => boolean>([
    ['the storm', (s) => s.t >= 3 && s.flash === 0],
    ['a wave breaking', (s) => s.t >= 2.5 && s.t < 3.4 && s.flash === 0],
    ['the lightning, bright', (s, p) => s.flash >= 1 && (p?.flash ?? 0) < 1 && s.t > 24],
    ['the lightning fading', (s) => s.t > 25.2 && s.flash > 0 && s.flash < 0.6],
    ['the mist and swells', (s) => s.t >= 14 && s.flash === 0],
    ['the strike', (s) => s.t >= 31.2],
  ]);
  let prev: StormData | null = null;
  let phase = 'COLD_OPEN';
  // The steering oar into the swell and back, then hands off: the storm plays to the strike.
  for (let i = 0; i < 420 && phase === 'COLD_OPEN'; i++) {
    if (i === 20) await page.keyboard.down('KeyD');
    if (i === 34) await page.keyboard.up('KeyD');
    if (i === 60) await page.keyboard.down('KeyA');
    if (i === 72) await page.keyboard.up('KeyA');
    // The lightning's bright frames are 4 and 3 ticks long: near a strike, a frame a tick.
    const s0 = await storm(page);
    const near = s0 !== null && s0.strikes.some(([at]) => s0.t > at - 0.12 && s0.t < at + 0.6);
    const f = await advance(page, near ? 2 : 8, CROP.w, CROP.h);
    const s = await storm(page);
    phase = (await page.locator('.oe-overlay').getAttribute('data-phase')) ?? '';
    if (s !== null) {
      if (!near || i % 4 === 0 || s.flash >= 1) frames.push(f);
      for (const [name, ok] of want)
        if (ok(s, prev)) {
          keys.push({ name, frame: f });
          want.delete(name);
          if (name === 'the lightning, bright')
            writeFileSync(join(views, 'lightning.png'), fromDataUrl(await advance(page, 1, W, H)));
          if (name === 'the mist and swells')
            writeFileSync(join(views, 'storm.png'), fromDataUrl(await advance(page, 1, W, H)));
        }
      prev = s;
    } else frames.push(f);
  }
  // The black, then a few frames of the waking.
  for (let i = 0; i < 30; i++) frames.push(await advance(page, 6, CROP.w, CROP.h));
  await page.close();
  frames.forEach((f, i) => {
    writeFileSync(join(framesDir, `f${String(i).padStart(4, '0')}.png`), fromDataUrl(f));
  });
  const gif = join(out, 'storm-opening.gif');
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      '7.5',
      '-i',
      join(framesDir, 'f%04d.png'),
      '-vf',
      'split[a][b];[a]palettegen=max_colors=40:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
      gif,
    ],
    { stdio: 'inherit' },
  );
  rmSync(framesDir, { recursive: true, force: true });
  const s = strip(
    keys.map((k) => k.frame),
    3,
  );
  writeFileSync(join(out, 'storm-strip.png'), encodePng(s));
  writeFileSync(join(out, 'storm-strip@2x.png'), encodePng(scale(s, 2)));
  for (const name of ['storm', 'lightning']) {
    try {
      const img = decodePng(execFileSync('cat', [join(views, `${name}.png`)]));
      writeFileSync(join(views, `${name}@4x.png`), encodePng(scale(img, 4)));
    } catch {
      console.log(`no ${name} still`);
    }
  }
  const full = await motion(browser, '', views, 'cold-open');
  const reduced = await motion(browser, '&motion=reduced&quality=low', views, 'cold-open-reduced');
  const size = statSync(gif).size;
  const readme = [
    '# The storm opening (design addendum 2.5 section 3), captured from the real game',
    '',
    'Written by `npm run capture -- rework-2.5-storm` (src/tools/art/captureStorm.ts) in capture mode,',
    'the cold open played with the steering keys from its first frame.',
    '',
    `- \`storm-opening.gif\`: ${frames.length} frames at 7.5 a second (a frame each 8 ticks), ${(size / 1e6).toFixed(2)} MB; the middle ${CROP.w} x ${CROP.h} of the view at 1x. Near each strike frames are kept a tick or two apart so the double flicker shows.`,
    `- \`storm-strip.png\` (and @2x): ${keys.map((k) => k.name).join(', ')}.`,
    '- `views/storm.png`, `views/lightning.png` (and @4x): the whole view at 1x.',
    '',
    '## Motion with the camera still (Book 7 section 14)',
    '',
    '| View | Moving cells | Script ms a frame (stepped, smoothed) |',
    '|---|---|---|',
    `| The cold open (full detail) | ${pct(full.share)} | ${full.ms.toFixed(2)} |`,
    `| The cold open (reduced motion, low detail) | ${pct(reduced.share)} | ${reduced.ms.toFixed(2)} |`,
    `| Book 7 thresholds | ${pct(MOTION_THRESHOLD)} (${pct(REDUCED_MOTION_THRESHOLD)} reduced) | |`,
    '',
  ].join('\n');
  writeFileSync(join(out, 'README.md'), readme);
  return `${out}: gif ${frames.length} frames ${(size / 1e6).toFixed(2)} MB; motion ${pct(full.share)} (reduced ${pct(reduced.share)}); ms ${full.ms.toFixed(2)}; keys ${keys.map((k) => k.name).join(', ')}`;
}
