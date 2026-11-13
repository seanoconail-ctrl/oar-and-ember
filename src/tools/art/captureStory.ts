/**
 * The user's third playtest's story, captured from the real game (decisions DG-12 and DG-14; Book 7
 * section 14):   npm run capture -- playtest-3-story   writes docs/art/playtest-3/story/
 *
 * The game runs in capture mode (?capture: the page advances only when stepped, a tick a step, so
 * every frame is exact); the chapter's own bots play in the page through the commands a player's
 * input sends. It writes:
 *   thorkel-taken.gif          the sea burial at 1x, 10 frames a second, from the lament's last word
 *                              to control returning: the bier borne down, the three waves, the drift,
 *                              the sink and the ring of foam (the middle 480 x 270 of the view)
 *   thorkel-taken@4x.png       the second wave over the bier, the whole view at 4x
 *   thorkel-taken-strip.png    its key frames at 1x (and @2x)
 *   shelter-stages.gif         the shelter's three stages: the frame going up with Hild steadying
 *                              the oars, the sail hauled over and lashed, and on the second day the
 *                              finishing to the S1 shelter (its work sped up)
 *   views/*.png, @4x, -motion  the frame standing by day, the lean-to at night, the finished
 *                              shelter by day and under its roof at night, with their motion maps
 *                              (camera still: Book 7's 80% of cells moving)
 *   README.md                  the figures
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
const PORT = 5298;
const BASE = `http://localhost:${PORT}/?capture&quality=full&view=play&name=Ash&body=A`;
const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
const fromDataUrl = (url: string): Buffer => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

/** Advances `ticks` (a drawn frame each 6) and returns the last frame's middle `w` x `h`. */
async function advance(page: Page, ticks: number, w: number, h: number): Promise<string> {
  return page.evaluate(
    ([k, ms, cw, ch]) => {
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

function strip(keys: readonly string[], cols: number, w: number, h: number): RgbaImage {
  const rows = Math.ceil(keys.length / cols);
  const gap = 2;
  const width = cols * w + (cols - 1) * gap;
  const height = rows * h + (rows - 1) * gap;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data[i + 3] = 255;
  keys.forEach((k, i) => {
    const img = decodePng(fromDataUrl(k));
    const ox = (i % cols) * (w + gap);
    const oy = Math.floor(i / cols) * (h + gap);
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++)
        for (let c = 0; c < 4; c++)
          data[((oy + y) * width + ox + x) * 4 + c] = img.data[(y * img.width + x) * 4 + c] ?? 0;
  });
  return { width, height, data };
}

function gif(
  frames: readonly string[],
  dir: string,
  file: string,
  fps: number,
  colours: number,
): number {
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
      `split[a][b];[a]palettegen=max_colors=${colours}:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`,
      file,
    ],
    { stdio: 'inherit' },
  );
  rmSync(dir, { recursive: true, force: true });
  return statSync(file).size;
}

async function open(browser: Browser, query: string): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => {
    console.log(`page error: ${e.message}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.text().startsWith('story:')) console.log(`page: ${m.text()}`);
  });
  await page.goto(`${BASE}&${query}`);
  await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 30_000 });
  await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
  await advance(page, 30, 8, 8);
  return page;
}

interface Played {
  frames: string[];
  keys: { name: string; frame: string; full: string }[];
  log: string[];
}

/**
 * The sea burial (DG-14): the household brings the rite to the strand; from the lament's last
 * word a frame every 6 ticks (10 a second) until control has been back a moment.
 */
async function burial(browser: Browser, cw: number, ch: number): Promise<Played> {
  const page = await open(browser, 'camp=broch&crew=1&ship=hull,rig,oar&time=17:45');
  const played: Played = { frames: [], keys: [], log: [] };
  await page.exposeFunction('oeFrame', (kind: string, name: string, a: string, b: string) => {
    if (kind === 'frame') played.frames.push(a);
    else if (kind === 'key') played.keys.push({ name, frame: a, full: b });
    else played.log.push(`${name} ${a}`);
  });
  await page.evaluate(
    async ([cw0, ch0]) => {
      const w = window as unknown as {
        oeStep: (ms: number) => void;
        oeFrame: (kind: string, name: string, a: string, b: string) => void;
        oePlay: { sim: Record<string, unknown>; land: Record<string, unknown>; b: unknown };
      };
      const { sim, land, b } = w.oePlay;
      const state = (): { tick: number; facts: Record<string, unknown> } =>
        sim['state'] as { tick: number; facts: Record<string, unknown> };
      const { RepairBot } = (await import(['/src/tools/play/repairBot', 'ts'].join('.'))) as {
        RepairBot: new (...a: unknown[]) => { rites(f: string): void; step(n?: number): void };
      };
      const canvas = document.querySelector<HTMLCanvasElement>('canvas#screen');
      const grab = (gw: number, gh: number): string => {
        const out = document.createElement('canvas');
        out.width = gw;
        out.height = gh;
        const g = out.getContext('2d');
        if (canvas === null || g === null) return '';
        g.imageSmoothingEnabled = false;
        g.drawImage(
          canvas,
          (canvas.width - gw) / 2,
          (canvas.height - gh) / 2,
          gw,
          gh,
          0,
          0,
          gw,
          gh,
        );
        return out.toDataURL('image/png');
      };
      // The scene's moments to keep as stills, seconds after the bier is lifted.
      const keysAt: [string, number][] = [
        ['the bier borne down', 2.0],
        ['set at the water', 4.8],
        ['the first wave round it', 6.1],
        ['the second over it', 8.6],
        ['the third lifts it', 11.4],
        ['drifting, riding lower', 15.0],
        ['sinking', 18.4],
        ['the ring of foam', 19.9],
      ];
      let n = 0;
      let after = -1;
      const proxy = new Proxy(sim, {
        get(target, prop) {
          if (prop === 'step')
            return () => {
              n++;
              const at = state().facts['rites.taken_at'];
              const dense = typeof at === 'number' || (after >= 0 && after < 120);
              if (dense) w.oeStep(1000 / 60);
              else (target as { step: () => void }).step();
              if (typeof at === 'number') {
                const t = state().tick - at;
                if (t % 6 === 0) w.oeFrame('frame', '', grab(cw0, ch0), '');
                for (const [name, s] of keysAt)
                  if (t === Math.round(s * 60))
                    w.oeFrame('key', name, grab(cw0, ch0), grab(640, 360));
                if (t === 0) w.oeFrame('log', 'the bier lifted at tick', String(state().tick), '');
              } else if (after >= 0) {
                after++;
                if (after % 6 === 0) w.oeFrame('frame', '', grab(cw0, ch0), '');
              } else if (state().facts['rites.stage'] === 'DONE') after = 0;
            };
          const v = Reflect.get(target, prop) as unknown;
          return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
        },
      });
      console.log('story: the rites begin');
      const bot = new RepairBot(proxy, b, land, land['camp'], land['searches'], land['repairs']);
      bot.rites('SEA');
      console.log('story: the rites done');
      after = Math.max(after, 0);
      for (let i = 0; i < 120; i++) (proxy as { step: () => void }).step();
      w.oeFrame('log', 'the rite done, tick', String(state().tick), '');
    },
    [cw, ch] as const,
  );
  await page.close();
  return played;
}

/**
 * The shelter's three stages (DG-12): the frame and the sail at the camp on day 1, every frame of
 * their work loops; then the second day's finishing, sped up (a frame each 30 ticks), to S1.
 */
async function shelter(browser: Browser, cw: number, ch: number): Promise<Played> {
  const page = await open(
    browser,
    'camp=broch&shelter=down&fire=lit&tended=1&time=10:00&at=34.2,31.0',
  );
  const played: Played = { frames: [], keys: [], log: [] };
  await page.exposeFunction('oeFrame', (kind: string, name: string, a: string, b: string) => {
    if (kind === 'frame') played.frames.push(a);
    else if (kind === 'key') played.keys.push({ name, frame: a, full: b });
    else played.log.push(`${name} ${a}`);
  });
  await page.evaluate(
    async ([cw0, ch0]) => {
      const w = window as unknown as {
        oeStep: (ms: number) => void;
        oeFrame: (kind: string, name: string, a: string, b: string) => void;
        oePlay: { sim: Record<string, unknown>; land: Record<string, unknown>; b: unknown };
      };
      const { sim, land, b } = w.oePlay;
      type St = {
        tick: number;
        facts: Record<string, unknown>;
        calendar: { day: number; minuteOfDay: number };
        onFoot: { player: { work?: { task: string } | null } } | null;
      };
      const state = (): St => sim['state'] as St;
      const { WreckBot } = (await import(['/src/tools/play/wreckBot', 'ts'].join('.'))) as {
        WreckBot: new (...a: unknown[]) => {
          raiseShelter(s?: string): void;
          finishShelter(n: number): void;
          step(n?: number): void;
        };
      };
      const canvas = document.querySelector<HTMLCanvasElement>('canvas#screen');
      const grab = (gw: number, gh: number): string => {
        const out = document.createElement('canvas');
        out.width = gw;
        out.height = gh;
        const g = out.getContext('2d');
        if (canvas === null || g === null) return '';
        g.imageSmoothingEnabled = false;
        g.drawImage(
          canvas,
          (canvas.width - gw) / 2,
          (canvas.height - gh) / 2,
          gw,
          gh,
          0,
          0,
          gw,
          gh,
        );
        return out.toDataURL('image/png');
      };
      let every = 6;
      let n = 0;
      let last = '';
      const proxy = new Proxy(sim, {
        get(target, prop) {
          if (prop === 'step')
            return () => {
              n++;
              const task = state().onFoot?.player.work?.task ?? '';
              const busy = task.startsWith('TASK_SHELTER') || task === 'TASK_BUILD';
              if (busy || n % every === 0) w.oeStep(1000 / 60);
              else (target as { step: () => void }).step();
              if ((busy && n % every === 0) || (!busy && n % 60 === 0))
                w.oeFrame('frame', '', grab(cw0, ch0), '');
              const stage = String(state().facts['ch1.shelter'] ?? '');
              if (stage !== last) {
                last = stage;
                w.oeFrame('key', stage, grab(cw0, ch0), grab(640, 360));
              }
            };
          const v = Reflect.get(target, prop) as unknown;
          return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
        },
      });
      const bot = new WreckBot(proxy, b, land, land['camp'], land['searches'], land['repairs']);
      bot.raiseShelter('SAIL');
      for (let i = 0; i < 90; i++) (proxy as { step: () => void }).step();
      // The second morning (the night between is not shown: the clock is set to the dawn).
      const s = state();
      s.calendar = { day: 2, minuteOfDay: 6 * 60 + 30 };
      every = 30;
      bot.finishShelter(40);
      every = 6;
      for (let i = 0; i < 120; i++) (proxy as { step: () => void }).step();
      w.oeFrame('log', 'finished on day', String(state().calendar.day), '');
    },
    [cw, ch] as const,
  );
  await page.close();
  return played;
}

/** Views with the camera still and their motion (Book 7 section 14: 80% of cells moving). */
const VIEWS = [
  { name: 'frame-day', query: 'camp=broch&shelter=frame&fire=lit&time=11:00&at=34.2,31.0' },
  { name: 'leanto-night', query: 'camp=broch&fire=lit&time=21:30&at=33.0,30.2' },
  { name: 's1-day', query: 'camp=broch&stage=S1&fire=lit&day=2&time=14:00&at=35.0,32.6' },
  { name: 's1-under-night', query: 'camp=broch&stage=S1&fire=lit&day=2&time=21:30&at=35.0,30.2' },
] as const;

async function views(browser: Browser, out: string): Promise<{ name: string; share: number }[]> {
  const dir = join(out, 'views');
  mkdirSync(dir, { recursive: true });
  const results: { name: string; share: number }[] = [];
  for (const v of VIEWS) {
    const page = await open(browser, v.query);
    await advance(page, 90, 8, 8);
    const first = decodePng(fromDataUrl(await advance(page, 1, W, H)));
    writeFileSync(join(dir, `${v.name}.png`), encodePng(first));
    writeFileSync(join(dir, `${v.name}@4x.png`), encodePng(scale(first, 4)));
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
    writeFileSync(join(dir, `${v.name}-motion.png`), encodePng(marked));
    results.push({ name: v.name, share: motion.share });
    await page.close();
  }
  return results;
}

export async function storyCapture(browser: Browser): Promise<string> {
  const out = join(REPO_ROOT, 'docs/art/playtest-3/story');
  mkdirSync(out, { recursive: true });
  // Thorkel taken by the sea.
  const sea = await burial(browser, 480, 270);
  const seaGif = join(out, 'thorkel-taken.gif');
  const seaSize = gif(sea.frames, join(out, '.frames'), seaGif, 10, 64);
  const under = sea.keys.find((k) => k.name === 'the second over it') ?? sea.keys[0];
  if (under !== undefined)
    writeFileSync(
      join(out, 'thorkel-taken@4x.png'),
      encodePng(scale(decodePng(fromDataUrl(under.full)), 4)),
    );
  const seaStrip = strip(
    sea.keys.map((k) => k.frame),
    4,
    480,
    270,
  );
  writeFileSync(join(out, 'thorkel-taken-strip.png'), encodePng(seaStrip));
  writeFileSync(join(out, 'thorkel-taken-strip@2x.png'), encodePng(scale(seaStrip, 2)));
  // The shelter's three stages.
  const sh = await shelter(browser, 320, 180);
  const shGif = join(out, 'shelter-stages.gif');
  const shSize = gif(sh.frames, join(out, '.frames'), shGif, 10, 64);
  const shStrip = strip(
    sh.keys.map((k) => k.frame),
    sh.keys.length,
    320,
    180,
  );
  writeFileSync(join(out, 'shelter-stages-strip.png'), encodePng(shStrip));
  writeFileSync(join(out, 'shelter-stages-strip@2x.png'), encodePng(scale(shStrip, 2)));
  const motion = await views(browser, out);
  const readme = [
    "# The user's third playtest: the story, captured from the real game",
    '',
    'Written by `npm run capture -- playtest-3-story` (src/tools/art/captureStory.ts). The bots play',
    "in the page through a player's commands; every kept frame is a real frame of the game.",
    '',
    `- \`thorkel-taken.gif\`: ${sea.frames.length} frames at 10 a second (${(sea.frames.length / 10).toFixed(1)} s), ${(seaSize / 1e6).toFixed(2)} MB; the middle 480 x 270 of the view at 1x, from the bier lifted at the rite's place to a moment after control returns. ${sea.log.join('; ')}.`,
    `- \`thorkel-taken@4x.png\`: the second wave over the bier, the whole view at 4x.`,
    `- \`thorkel-taken-strip.png\` (and @2x): ${sea.keys.map((k) => k.name).join(', ')}.`,
    `- \`shelter-stages.gif\`: ${sh.frames.length} frames at 10 a second, ${(shSize / 1e6).toFixed(2)} MB; the middle 320 x 180 at 1x: the frame and the sail at their own pace (a frame every 6 ticks), the second day's finishing sped up (a frame every 30 ticks of its work). The night between is skipped by setting the clock to the second dawn. ${sh.log.join('; ')}.`,
    `- \`shelter-stages-strip.png\` (and @2x): each stage as it was reached (${sh.keys.map((k) => k.name).join(', ')}).`,
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
  return `${out}: thorkel-taken ${sea.frames.length} frames ${(seaSize / 1e6).toFixed(2)} MB; shelter ${sh.frames.length} frames ${(shSize / 1e6).toFixed(2)} MB; ${motion.map((m) => `${m.name} ${pct(m.share)}`).join(', ')}`;
}

export { PORT as STORY_PORT };
