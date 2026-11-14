/**
 * The first five minutes, captured from the real game (design addendum 2.4 sections 2 to 6; Book
 * 7 section 14):   npm run capture -- rework-2.4-opening   writes docs/art/rework-2.4/opening/
 *
 * The game runs in capture mode (?capture: the page advances only when stepped, a tick a step, so
 * every frame is exact). The cold open and the waking are played from the naming screen with the
 * keys; from the waking on, the opening's bot (src/tools/play/wreckBot.ts) plays in the page
 * through the same commands a player's input sends, each of its ticks a real frame of the game:
 * the seax, Hild cut from the net and carried up, Thorkel's chest dragged home, driftwood, the
 * first fire, Hild walking up, the sail raised. It writes:
 *   first-five-minutes.gif        the middle 320 x 180 of the view at 1x, 10 frames a second: the
 *                                 key moments at their own pace, the walking between sped up
 *   first-five-minutes-strip.png  the ten key frames, 5 x 2 at 1x
 *   first-five-minutes-strip@2x.png  the same at 2x
 *   views/*.png, *-motion.png     stills of the new places at 1x (Hild in the net, the camp with the
 *                                 sail raised by day, under it at night, the broch's door) and their
 *                                 motion maps with the camera still (Book 7: 80% of cells moving)
 *   README.md                     the figures
 * Needs ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { REPO_ROOT } from './loadTitleArt.ts';
import { continuousMotion, MOTION_CELL, MOTION_THRESHOLD } from './motion.ts';
import { decodePng, encodePng } from './png.ts';
import type { RgbaImage } from './png.ts';

const TICK = 1000 / 60;
const W = 640;
const H = 360;
const CROP = { w: 320, h: 180 };
const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

async function attr(page: Page, name: string): Promise<string> {
  return (await page.locator('.oe-overlay').getAttribute(`data-${name}`)) ?? '';
}

/**
 * Advances the page by `ticks` (in frames of up to 6 ticks: the game draws once a frame) and, if
 * asked, returns the canvas as drawn by the last frame (the middle `w` x `h` at 1x). The grab is
 * made in the same task as the draw: a WebGL canvas is cleared once it has been shown.
 */
async function advance(
  page: Page,
  ticks: number,
  keep: boolean,
  w: number = CROP.w,
  h: number = CROP.h,
): Promise<string> {
  return page.evaluate(
    ([k, ms, grabIt, cw, ch]) => {
      const win = window as unknown as { oeStep: (ms: number) => void };
      for (let left = k; left > 0; left -= 6) win.oeStep(Math.min(6, left) * ms);
      if (!grabIt) return '';
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
    [ticks, TICK, keep, w, h] as const,
  );
}

const fromDataUrl = (url: string): Buffer => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

interface Clip {
  frames: string[];
  keys: { name: string; frame: string }[];
}

/** The cold open and the waking, played with the keys from the naming screen. */
async function coldOpen(page: Page, clip: Clip): Promise<void> {
  await page.goto('http://localhost:5297/?capture&quality=full');
  await page.waitForSelector('canvas#screen[data-state=title]', { timeout: 30_000 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Ash');
  await page.locator('.oe-naming input').press('Enter');
  await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 30_000 });
  await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
  // Steering into the swell: the oar answers at once.
  await advance(page, 30, false);
  for (const [key, frames] of [
    ['KeyD', 12],
    ['KeyA', 12],
  ] as const) {
    await page.keyboard.down(key);
    for (let i = 0; i < frames; i++) {
      const f = await advance(page, 6, true);
      clip.frames.push(f);
      if (key === 'KeyA' && i === 6) clip.keys.push({ name: 'cold open', frame: f });
    }
    await page.keyboard.up(key);
  }
  // On to the strike (31 s in), then the black: 30 + 180 ticks played so far.
  await advance(page, Math.round(29.5 * 60) - 210, false);
  for (let i = 0; i < 50; i++) {
    const f = await advance(page, 6, true);
    if ((await attr(page, 'phase')) !== 'COLD_OPEN') break;
    clip.frames.push(f);
    if (i === 12) clip.keys.push({ name: 'the strike', frame: f });
  }
  // The waking in the surf: lying, coughing; then up at the first key.
  for (let i = 0; i < 600 && (await attr(page, 'phase')) !== 'WAKING'; i++)
    await advance(page, 6, false);
  for (let i = 0; i < 20; i++) {
    const f = await advance(page, 6, true);
    clip.frames.push(f);
    if (i === 12) clip.keys.push({ name: 'waking', frame: f });
  }
  await page.keyboard.down('KeyA');
  for (let i = 0; i < 8; i++) clip.frames.push(await advance(page, 6, true));
  await page.keyboard.up('KeyA');
  for (let i = 0; i < 60 && (await attr(page, 'phase')) !== 'PLAY'; i++)
    await advance(page, 6, false);
}

/**
 * The bot's play, in the page: each of its ticks is a frame of the game (oeStep); a frame is kept
 * every 6 ticks in a key moment and every 200 between them; a key frame is kept for each moment.
 */
async function botPlay(page: Page, clip: Clip): Promise<{ ticks: number; marks: string[] }> {
  // Frames come back as they are drawn, so the page holds none of them.
  await page.exposeFunction('oeFrame', (kind: string, name: string, frame: string) => {
    if (kind === 'frame') clip.frames.push(frame);
    else if (kind === 'key') clip.keys.push({ name, frame });
    else console.log(`  ${name} at tick ${frame}`);
  });
  const result = await page.evaluate(async () => {
    interface Sim {
      state: Record<string, unknown> & { tick: number; facts: Record<string, unknown> };
    }
    const w = window as unknown as {
      oeStep: (ms: number) => void;
      oeFrame: (kind: string, name: string, frame: string) => void;
      oePlay: {
        sim: Sim & Record<string, unknown>;
        land: { maps: Map<string, unknown> };
        b: unknown;
        content: unknown;
      };
    };
    const { sim, land, b, content } = w.oePlay;
    // Through the capture's dev server: the game's own modules.
    const at = (m: string): string => `/src/${m}.ts`;
    const { OpeningBot } = (await import(at('tools/play/openingBot'))) as {
      OpeningBot: new (...a: unknown[]) => { pickUp(k: string): void; rescue(id: string): void };
    };
    const { WreckBot } = (await import(at('tools/play/wreckBot'))) as {
      WreckBot: new (...a: unknown[]) => {
        waitFor(f: () => boolean, n: number): void;
        chestToCamp(): void;
        goToZone(z: string): void;
        firstFire(p: string[]): void;
        waitForHild(n?: number): void;
        raiseShelter(stages?: string): void;
        tend(id: string): void;
      };
    };
    const { campContext } = (await import(at('sim/home/camp'))) as {
      campContext: (c: unknown) => unknown;
    };
    const canvas = document.querySelector<HTMLCanvasElement>('canvas#screen');
    const out = document.createElement('canvas');
    out.width = 320;
    out.height = 180;
    const g = out.getContext('2d');
    const grabNow = (): string => {
      if (canvas === null || g === null) return '';
      g.imageSmoothingEnabled = false;
      g.drawImage(
        canvas,
        (canvas.width - 320) / 2,
        (canvas.height - 180) / 2,
        320,
        180,
        0,
        0,
        320,
        180,
      );
      return out.toDataURL('image/png');
    };
    const state = () =>
      sim.state as unknown as {
        tick: number;
        facts: Record<string, unknown>;
        onFoot: { carrying?: string; player: { work?: { task: string } | null } } | null;
      };
    // The key moments: dense frames while each lasts (from its first tick, for its length).
    const moments: { name: string; on: () => boolean; ticks: number; keyAt: number }[] = [
      {
        name: 'the net cut',
        on: () => state().onFoot?.player.work?.task === 'TASK_CUT_NET',
        ticks: 120,
        keyAt: 40,
      },
      {
        name: 'Hild carried up',
        on: () => state().onFoot?.carrying === 'C_HILD',
        ticks: 90,
        keyAt: 50,
      },
      {
        name: "Thorkel's chest",
        on: () => state().onFoot?.carrying === 'ITEM_THORKEL_CHEST',
        ticks: 90,
        keyAt: 60,
      },
      {
        name: 'the first fire',
        on: () => state().facts['ch1.fire_lit'] === true,
        ticks: 150,
        keyAt: 40,
      },
      {
        name: 'Hild walks up',
        on: () => state().facts['ch1.hild_walked_up'] === true,
        ticks: 90,
        keyAt: 30,
      },
      {
        name: 'the frame stood up',
        on: () => state().onFoot?.player.work?.task === 'TASK_SHELTER_FRAME',
        ticks: 300,
        keyAt: 290,
      },
      {
        name: 'the sail lashed over it',
        on: () => state().onFoot?.player.work?.task === 'TASK_SHELTER_SAIL',
        ticks: 300,
        keyAt: 290,
      },
    ];
    const started: Record<string, number> = {};
    let n = 0;
    const marks: string[] = [];
    // A frame is drawn (the page stepped) in a key moment and on each kept frame between them;
    // otherwise the simulation steps alone, as fast as it can, and the next drawn frame catches up.
    let dense = false;
    const proxy = new Proxy(sim, {
      get(target, prop) {
        if (prop === 'step')
          return () => {
            n++;
            if (dense || n % 200 === 0) w.oeStep(1000 / 60);
            else (target as unknown as { step: () => void }).step();
            const t = state().tick;
            dense = false;
            for (const m of moments) {
              if (started[m.name] === undefined && m.on()) {
                started[m.name] = t;
                marks.push(`${m.name} ${(t / 60).toFixed(1)} s`);
                w.oeFrame('log', m.name, String(t));
              }
              const s = started[m.name];
              if (s !== undefined && t - s < m.ticks) {
                dense = true;
                if (t - s === m.keyAt) w.oeFrame('key', m.name, grabNow());
              }
            }
            if (n % (dense ? 6 : 200) === 0) w.oeFrame('frame', '', grabNow());
            if (n % 1800 === 0) w.oeFrame('log', 'tick', String(t));
          };
        const v = Reflect.get(target, prop) as unknown;
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      },
    });
    const camp = campContext(content);
    const strand = land.maps.get('ZONE_SK_STRAND');
    const opening = new OpeningBot(proxy, strand, b, land);
    opening.pickUp('wreck_seax');
    opening.rescue('C_HILD');
    const bot = new WreckBot(
      proxy,
      b,
      land,
      camp,
      (land as unknown as { searches: unknown }).searches,
      (land as unknown as { repairs: unknown }).repairs,
    );
    bot.waitFor(() => state().facts['ch1.chest_named'] === true, 60 * 30);
    bot.chestToCamp();
    bot.goToZone('ZONE_SK_STRAND');
    bot.firstFire(['drift_west_rocks', 'drift_west_bank']);
    bot.waitForHild();
    bot.raiseShelter();
    // A last moment under the raised sail with the fire burning.
    dense = true;
    for (let i = 0; i < 60; i++) (proxy as unknown as { step: () => void }).step();
    w.oeFrame('key', 'under the sail', grabNow());
    return { ticks: state().tick, marks };
  });
  return { ticks: result.ticks, marks: result.marks };
}

/** A grid of the key frames at 1x. */
function strip(keys: readonly { frame: string }[], cols: number): RgbaImage {
  const rows = Math.ceil(keys.length / cols);
  const gap = 2;
  const width = cols * CROP.w + (cols - 1) * gap;
  const height = rows * CROP.h + (rows - 1) * gap;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data[i + 3] = 255;
  keys.forEach((k, i) => {
    const img = decodePng(fromDataUrl(k.frame));
    const ox = (i % cols) * (CROP.w + gap);
    const oy = Math.floor(i / cols) * (CROP.h + gap);
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++)
        for (let c = 0; c < 4; c++)
          data[((oy + y) * width + ox + x) * 4 + c] = img.data[(y * img.width + x) * 4 + c] ?? 0;
  });
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

/** The new places, stills at 1x with the camera still, and their motion (Book 7 section 14). */
const VIEWS = [
  { name: 'net', query: 'kit=seax&zone=ZONE_SK_STRAND&at=33.6,35.0' },
  { name: 'camp-day', query: 'camp=broch&time=11:00&fire=lit&at=35.4,32.2' },
  { name: 'shelter-night', query: 'camp=broch&time=21:30&fire=lit&at=33.0,30.2' },
  { name: 'broch-door', query: 'camp=broch&stage=S1&time=10:00&at=35.5,38.4' },
] as const;

async function views(browser: Browser, out: string): Promise<{ name: string; share: number }[]> {
  const dir = join(out, 'views');
  mkdirSync(dir, { recursive: true });
  const results: { name: string; share: number }[] = [];
  for (const v of VIEWS) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.goto(
      `http://localhost:5297/?capture&quality=full&view=play&name=Ash&body=A&${v.query}`,
    );
    await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 30_000 });
    await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
    await advance(page, 90, false);
    const first = decodePng(fromDataUrl(await advance(page, 1, true, W, H)));
    writeFileSync(join(dir, `${v.name}.png`), encodePng(first));
    writeFileSync(join(dir, `${v.name}@4x.png`), encodePng(double(double(first))));
    const stills: Uint8Array[] = [first.data];
    for (let i = 0; i < 40; i++)
      stills.push(decodePng(fromDataUrl(await advance(page, 10, true, W, H))).data);
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
    writeFileSync(join(dir, `${v.name}-motion.png`), encodePng(marked));
    results.push({ name: v.name, share: motion.share });
    await page.close();
  }
  return results;
}

export async function openingCapture(browser: Browser): Promise<string> {
  const out = join(REPO_ROOT, 'docs/art/rework-2.4/opening');
  const framesDir = join(out, '.frames');
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const clip: Clip = { frames: [], keys: [] };
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => {
    console.log(`page error: ${e.message}`);
  });
  page.on('crash', () => {
    console.log('the page crashed');
  });
  await coldOpen(page, clip);
  console.log(`cold open and waking: ${clip.frames.length} frames`);
  const play = await botPlay(page, clip);
  await page.close();
  clip.frames.forEach((f, i) => {
    writeFileSync(join(framesDir, `f${String(i).padStart(4, '0')}.png`), fromDataUrl(f));
  });
  const gif = join(out, 'first-five-minutes.gif');
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      '10',
      '-i',
      join(framesDir, 'f%04d.png'),
      '-vf',
      'split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
      gif,
    ],
    { stdio: 'inherit' },
  );
  rmSync(framesDir, { recursive: true, force: true });
  const s = strip(clip.keys.slice(0, 10), 5);
  writeFileSync(join(out, 'first-five-minutes-strip.png'), encodePng(s));
  writeFileSync(join(out, 'first-five-minutes-strip@2x.png'), encodePng(double(s)));
  const motion = await views(browser, out);
  const size = statSync(gif).size;
  const readme = [
    '# The first five minutes (design addendum 2.4), captured from the real game',
    '',
    'Written by `npm run capture -- rework-2.4-opening` (src/tools/art/captureOpening.ts). The cold',
    'open and the waking are played with the keys from the naming screen; from the waking on, the',
    "opening's bot plays in the page through a player's commands, each tick a real frame.",
    '',
    `- \`first-five-minutes.gif\`: ${clip.frames.length} frames at 10 a second (${(clip.frames.length / 10).toFixed(1)} s), ${(size / 1e6).toFixed(2)} MB; the middle 320 x 180 of the view at 1x. Key moments play at their own pace (a frame every 6 ticks); the walks between are sped up (a frame every 200 ticks).`,
    `- \`first-five-minutes-strip.png\` (and @2x): ${clip.keys
      .slice(0, 10)
      .map((k) => k.name)
      .join(', ')}.`,
    `- The bot's play ended at game tick ${play.ticks} (${(play.ticks / 3600).toFixed(2)} minutes of game time from the cold open's first frame, the cold open and waking included); moments, from the same start: ${play.marks.join('; ')}.`,
    '',
    '## Motion with the camera still (Book 7 section 14)',
    '',
    '| View | Moving cells |',
    '|---|---|',
    ...motion.map((m) => `| ${m.name} | ${pct(m.share)} |`),
    `| Book 7 threshold | ${pct(MOTION_THRESHOLD)} |`,
    '',
    motion.every((m) => m.share >= MOTION_THRESHOLD)
      ? 'Every view meets the threshold.'
      : '**A view is below the threshold.**',
    '',
  ].join('\n');
  writeFileSync(join(out, 'README.md'), readme);
  return `${out}: gif ${clip.frames.length} frames ${(size / 1e6).toFixed(2)} MB; ${motion
    .map((m) => `${m.name} ${pct(m.share)}`)
    .join(', ')}; ${play.marks.join('; ')}`;
}
