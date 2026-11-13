/**
 * The user's fourth playtest's world and art (requests 15, 23, 24 and 26; decisions DH-100 to
 * DH-129), captured from the real game:
 *
 *   npm run capture -- playtest-4-world-before   the broch interior as it was (run once, first)
 *   npm run capture -- playtest-4-world          the broch after, the bed, the points of interest
 *
 * Both write docs/art/playtest-4/world/. The game runs in capture mode (?capture: the page advances
 * only when stepped, a tick a step, so every frame is exact). It writes:
 *   broch-<when>-<view>.png and @4x   the broch's interior at S0 and S1, by day and night, the
 *                                     whole 640 x 360 view with the camera still
 *   broch-<when>-<view>-motion.png    cells that do not keep moving marked red (Book 7 section 14)
 *   broch-<when>.gif                  about 4 s of the S1 interior at night, 320 x 180 at 1x
 *   broch-compare.png (and @2x)       before above after, each view side by side (after only)
 *   bed-<view>.png and @4x            the steerer's bed and its mark, by day and night, the prompt
 *   poi-<key>.png and @4x             each new point of interest, as found
 *   README.md                         the figures
 * Needs ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { REPO_ROOT } from './loadTitleArt.ts';
import { continuousMotion, MOTION_CELL, MOTION_THRESHOLD } from './motion.ts';
import { decodePng, encodePng } from './png.ts';
import type { RgbaImage } from './png.ts';

const TICK = 1000 / 60;
const W = 640;
const H = 360;
export const WORLD_PORT = 5299;
const BASE = `http://localhost:${WORLD_PORT}/?capture&quality=full&view=play&name=Ash&body=A`;
const OUT = 'docs/art/playtest-4/world';
const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
const fromDataUrl = (url: string): Buffer => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

/** Advances `ticks` (a drawn frame each 6) and returns the last frame's middle `w` x `h`. */
async function advance(page: Page, ticks: number, w: number, h: number, dy = 0): Promise<string> {
  return page.evaluate(
    ([k, ms, cw, ch, oy]) => {
      const win = window as unknown as { oeStep: (ms: number) => void };
      for (let left = k; left > 0; left -= 6) win.oeStep(Math.min(6, left) * ms);
      const c = document.querySelector<HTMLCanvasElement>('canvas#screen');
      if (c === null) return '';
      const out = document.createElement('canvas');
      out.width = cw;
      out.height = ch;
      const g = out.getContext('2d');
      if (g === null) return '';
      g.imageSmoothingEnabled = false;
      g.drawImage(c, (c.width - cw) / 2, (c.height - ch) / 2 + oy, cw, ch, 0, 0, cw, ch);
      return out.toDataURL('image/png');
    },
    [ticks, TICK, w, h, dy] as const,
  );
}

export function scale(img: RgbaImage, k: number): RgbaImage {
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

/** Images laid side by side (a row each), with a 4 px dark gap. */
function grid(rows: readonly (readonly RgbaImage[])[]): RgbaImage {
  const gap = 4;
  const cols = Math.max(...rows.map((r) => r.length));
  const w0 = rows[0]?.[0]?.width ?? 1;
  const h0 = rows[0]?.[0]?.height ?? 1;
  const width = cols * w0 + (cols - 1) * gap;
  const height = rows.length * h0 + (rows.length - 1) * gap;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 20;
    data[i + 1] = 18;
    data[i + 2] = 24;
    data[i + 3] = 255;
  }
  rows.forEach((row, r) => {
    row.forEach((img, c) => {
      const ox = c * (w0 + gap);
      const oy = r * (h0 + gap);
      for (let y = 0; y < img.height; y++)
        for (let x = 0; x < img.width; x++)
          for (let k = 0; k < 4; k++)
            data[((oy + y) * width + ox + x) * 4 + k] = img.data[(y * img.width + x) * 4 + k] ?? 0;
    });
  });
  return { width, height, data };
}

function gif(frames: readonly string[], dir: string, file: string, fps: number): number {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  frames.forEach((f, i) => {
    writeFileSync(join(dir, `f${String(i).padStart(4, '0')}.png`), fromDataUrl(f));
  });
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(fps),
      '-i',
      join(dir, 'f%04d.png'),
      '-vf',
      'split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
      file,
    ],
    { stdio: 'inherit' },
  );
  rmSync(dir, { recursive: true, force: true });
  return statSync(file).size;
}

async function open(browser: Browser, query: string, overlay = false): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => {
    console.log(`page error: ${e.message}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`page: ${m.text()}`);
  });
  await page.goto(`${BASE}&${query}`);
  await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 60_000 });
  if (!overlay)
    await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
  await advance(page, 30, 8, 8);
  return page;
}

/** The broch's interior views: the camera still on the court (Book 7 section 14). */
const BROCH_VIEWS = [
  { name: 's0-day', query: 'camp=broch&fire=lit&time=11:00&at=35.6,34.6' },
  { name: 's0-night', query: 'camp=broch&fire=lit&time=21:30&at=35.6,34.6' },
  { name: 's1-day', query: 'camp=broch&stage=S1&fire=lit&day=2&time=14:00&crew=1&at=35.6,34.6' },
  { name: 's1-night', query: 'camp=broch&stage=S1&fire=lit&day=2&time=21:30&crew=1&at=35.6,32.2' },
] as const;

interface ViewResult {
  readonly name: string;
  readonly share: number;
}

/** A still at 1x and 4x, and its motion over 40 frames 10 ticks apart, with the motion map. */
async function still(page: Page, dir: string, file: string): Promise<{ share: number }> {
  await advance(page, 90, 8, 8);
  const first = decodePng(fromDataUrl(await advance(page, 1, W, H)));
  writeFileSync(join(dir, `${file}.png`), encodePng(first));
  writeFileSync(join(dir, `${file}@4x.png`), encodePng(scale(first, 4)));
  const stills: Uint8Array[] = [first.data];
  for (let i = 0; i < 40; i++)
    stills.push(decodePng(fromDataUrl(await advance(page, 10, W, H))).data);
  const motion = continuousMotion(stills, W, H);
  const marked = { width: W, height: H, data: Uint8Array.from(first.data) };
  motion.cells.forEach((moving, k) => {
    if (moving) return;
    const cx = (k % motion.cellsX) * MOTION_CELL;
    const cy = Math.floor(k / motion.cellsX) * MOTION_CELL;
    for (let y = cy; y < cy + MOTION_CELL; y++)
      for (let x = cx; x < cx + MOTION_CELL; x++) {
        const i = (y * W + x) * 4;
        marked.data[i] = Math.round((marked.data[i] ?? 0) * 0.3 + 140);
        marked.data[i + 1] = Math.round((marked.data[i + 1] ?? 0) * 0.3 + 28);
        marked.data[i + 2] = Math.round((marked.data[i + 2] ?? 0) * 0.3 + 28);
      }
  });
  writeFileSync(join(dir, `${file}-motion.png`), encodePng(marked));
  return { share: motion.share };
}

async function brochViews(browser: Browser, dir: string, when: string): Promise<ViewResult[]> {
  const results: ViewResult[] = [];
  for (const v of BROCH_VIEWS) {
    const page = await open(browser, v.query);
    const { share } = await still(page, dir, `broch-${when}-${v.name}`);
    results.push({ name: v.name, share });
    await page.close();
  }
  return results;
}

/** About 4 s of the S1 interior at night, 320 x 180 of the view's middle, 10 frames a second. */
async function brochGif(browser: Browser, dir: string, when: string): Promise<number> {
  const v = BROCH_VIEWS[3];
  const page = await open(browser, v.query);
  await advance(page, 60, 8, 8);
  const frames: string[] = [];
  for (let i = 0; i < 40; i++) frames.push(await advance(page, 6, 320, 180, -30));
  await page.close();
  return gif(frames, join(dir, '.frames'), join(dir, `broch-${when}.gif`), 10);
}

function readme(dir: string, when: string, results: readonly ViewResult[], gifBytes: number): void {
  const path = join(dir, `broch-${when}.md`);
  const text = [
    `# The broch's interior, ${when} (the user's fourth playtest, request 23)`,
    '',
    `Written by \`npm run capture -- playtest-4-world${when === 'before' ? '-before' : ''}\` (src/tools/art/captureWorld.ts).`,
    '',
    '| View | Moving cells (camera still) |',
    '|---|---|',
    ...results.map((r) => `| ${r.name} | ${pct(r.share)} |`),
    `| Book 7 threshold | ${pct(MOTION_THRESHOLD)} |`,
    '',
    `\`broch-${when}.gif\`: 40 frames at 10 a second of the S1 interior at night, ${(gifBytes / 1e6).toFixed(2)} MB.`,
    '',
  ].join('\n');
  writeFileSync(path, text);
}

/** Before above after, view by view, at 1x (and 2x): the compare image for the user. */
function compare(dir: string): void {
  const row = (when: string): RgbaImage[] =>
    BROCH_VIEWS.map((v) => {
      const f = join(dir, `broch-${when}-${v.name}.png`);
      const img = decodePng(readFileSync(f));
      // The court: the broch's middle 320 x 200 of the view.
      const cw = 320;
      const ch = 200;
      const ox = (img.width - cw) / 2;
      const oy = (img.height - ch) / 2 - 20;
      const data = new Uint8Array(cw * ch * 4);
      for (let y = 0; y < ch; y++)
        for (let x = 0; x < cw; x++)
          for (let k = 0; k < 4; k++)
            data[(y * cw + x) * 4 + k] = img.data[((oy + y) * img.width + ox + x) * 4 + k] ?? 0;
      return { width: cw, height: ch, data };
    });
  if (!BROCH_VIEWS.every((v) => existsSync(join(dir, `broch-before-${v.name}.png`)))) return;
  const img = grid([row('before'), row('after')]);
  writeFileSync(join(dir, 'broch-compare.png'), encodePng(img));
  writeFileSync(join(dir, 'broch-compare@2x.png'), encodePng(scale(img, 2)));
}

/** The steerer's bed and its mark (requests 15 and 26), with the prompt shown when near. */
const BED_VIEWS = [
  { name: 'bed-s0-day', query: 'camp=broch&fire=lit&time=11:00&at=33.3,31.4', overlay: false },
  { name: 'bed-s0-night', query: 'camp=broch&fire=lit&time=21:30&at=33.3,30.3', overlay: true },
  {
    name: 'bed-s1-day',
    query: 'camp=broch&stage=S1&fire=lit&day=2&time=14:00&crew=1&at=34.0,31.4',
    overlay: false,
  },
  {
    name: 'bed-s1-night',
    query: 'camp=broch&stage=S1&fire=lit&day=2&time=21:30&crew=1&at=33.3,30.3',
    overlay: true,
  },
] as const;

async function bedViews(browser: Browser, dir: string): Promise<ViewResult[]> {
  const out: ViewResult[] = [];
  for (const v of BED_VIEWS) {
    const page = await open(browser, v.query, v.overlay);
    const { share } = await still(page, dir, v.name);
    out.push({ name: v.name, share });
    await page.close();
  }
  return out;
}

/** The sleepers at night: the steerer lying in the bed, breathing, the household asleep. */
async function sleepGif(browser: Browser, dir: string): Promise<number> {
  // The household asleep in their beds after 22:00, the steerer standing by the fire.
  const page = await open(
    browser,
    'camp=broch&stage=S1&fire=lit&day=2&time=23:10&crew=1&at=35.0,31.2',
  );
  await advance(page, 60, 8, 8);
  const frames: string[] = [];
  for (let i = 0; i < 50; i++) frames.push(await advance(page, 12, 320, 180, -30));
  const full = decodePng(fromDataUrl(await advance(page, 1, W, H)));
  writeFileSync(join(dir, 'sleepers-night.png'), encodePng(full));
  writeFileSync(join(dir, 'sleepers-night@4x.png'), encodePng(scale(full, 4)));
  await page.close();
  // The steerer lying down in their own bed (the night passes after Book 10's sleep seconds).
  const bed = await open(
    browser,
    'camp=broch&stage=S1&fire=lit&day=2&time=23:10&crew=1&at=33.3,29.6',
  );
  await bed.evaluate(() => {
    const w = window as unknown as { oePlay: { sim: { submit: (c: unknown) => void } } };
    w.oePlay.sim.submit({ type: 'INTERACT' });
  });
  const lying = decodePng(fromDataUrl(await advance(bed, 40, W, H)));
  writeFileSync(join(dir, 'steerer-asleep.png'), encodePng(lying));
  writeFileSync(join(dir, 'steerer-asleep@4x.png'), encodePng(scale(lying, 4)));
  await bed.close();
  return gif(frames, join(dir, '.frames'), join(dir, 'sleepers.gif'), 10);
}

/** Each point of interest of the fourth playtest (request 24): a still where it lies. */
async function poiViews(browser: Browser, dir: string): Promise<string[]> {
  const pois = JSON.parse(readFileSync(join(REPO_ROOT, 'content/finds.json'), 'utf8')) as {
    finds: { key: string; zone: string; x: number; y: number }[];
  };
  const done: string[] = [];
  for (const f of pois.finds) {
    const page = await open(
      browser,
      `camp=broch&crew=1&time=12:00&zone=${f.zone}&at=${f.x},${(f.y + 1.6).toFixed(2)}`,
    );
    await advance(page, 60, 8, 8);
    const img = decodePng(fromDataUrl(await advance(page, 1, W, H)));
    writeFileSync(join(dir, `poi-${f.key}.png`), encodePng(img));
    const crop = (cw: number, ch: number): RgbaImage => {
      const data = new Uint8Array(cw * ch * 4);
      const ox = (W - cw) / 2;
      const oy = (H - ch) / 2;
      for (let y = 0; y < ch; y++)
        for (let x = 0; x < cw; x++)
          for (let k = 0; k < 4; k++)
            data[(y * cw + x) * 4 + k] = img.data[((oy + y) * W + ox + x) * 4 + k] ?? 0;
      return { width: cw, height: ch, data };
    };
    writeFileSync(join(dir, `poi-${f.key}@4x.png`), encodePng(scale(crop(160, 90), 4)));
    done.push(f.key);
    await page.close();
  }
  return done;
}

export async function worldCapture(browser: Browser, before: boolean): Promise<string> {
  const dir = join(REPO_ROOT, OUT);
  mkdirSync(dir, { recursive: true });
  if (before) {
    const views = await brochViews(browser, dir, 'before');
    const size = await brochGif(browser, dir, 'before');
    readme(dir, 'before', views, size);
    return `${dir}: before ${views.map((v) => `${v.name} ${pct(v.share)}`).join(', ')}`;
  }
  // OE_WORLD_PARTS=beds re-takes only the bed, the sleepers and the finds (the broch's after
  // views kept from the last full run).
  const brochToo = process.env['OE_WORLD_PARTS'] !== 'beds';
  const views = brochToo ? await brochViews(browser, dir, 'after') : [];
  const size = brochToo ? await brochGif(browser, dir, 'after') : 0;
  if (brochToo) {
    readme(dir, 'after', views, size);
    compare(dir);
  }
  const beds = await bedViews(browser, dir);
  const sleepers = await sleepGif(browser, dir);
  const pois = await poiViews(browser, dir);
  const text = [
    "# The user's fourth playtest: the world and art, captured from the real game",
    '',
    'Written by `npm run capture -- playtest-4-world` (src/tools/art/captureWorld.ts); the "before"',
    'views by `npm run capture -- playtest-4-world-before`, run once before the rework.',
    '',
    '- `broch-before-*.png`, `broch-after-*.png` (and @4x, -motion): the interior at S0 and S1, by',
    '  day and by night; `broch-before.gif`, `broch-after.gif`: the S1 interior at night;',
    '  `broch-compare.png` (and @2x): before (top row) and after (bottom row), view by view.',
    "- `bed-*.png` (and @4x): the steerer's bed and its mark, by day and night, with the prompt.",
    `- \`sleepers.gif\` (${(sleepers / 1e6).toFixed(2)} MB) and \`sleepers-night.png\` (and @4x): the household asleep, breathing under their blankets.`,
    `- \`poi-*.png\` (and @4x): the new points of interest: ${pois.join(', ')}.`,
    '',
    '## Motion with the camera still (Book 7 section 14)',
    '',
    '| View | Moving cells |',
    '|---|---|',
    ...[...views.map((v) => ({ ...v, name: `broch-after-${v.name}` })), ...beds].map(
      (v) => `| ${v.name} | ${pct(v.share)} |`,
    ),
    `| Book 7 threshold | ${pct(MOTION_THRESHOLD)} |`,
    '',
  ].join('\n');
  writeFileSync(join(dir, 'README.md'), text);
  return `${dir}: after ${views.map((v) => `${v.name} ${pct(v.share)}`).join(', ')}; beds ${beds.map((v) => `${v.name} ${pct(v.share)}`).join(', ')}; broch gif ${(size / 1e6).toFixed(2)} MB`;
}
