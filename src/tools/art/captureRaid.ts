/**
 * A reason for the first raid, captured from the real game (decisions DH-130 to DH-159; Book 7
 * section 14):   npm run capture -- playtest-4-raid-reason   writes docs/art/playtest-4/raid-reason/
 *
 * The game runs in capture mode (?capture: the page advances only when stepped, so every frame is
 * exact); the moments are played through the simulation's own commands, as a player's input sends
 * them, and each frame is the page as the player sees it (the speech and caption lines included).
 * It writes, at 1x:
 *   council.gif      the council at the fire: the call, the household walking to the fire, each
 *                    one's counsel, Hild's question, the steerer's choice and their answers
 *   pointout.gif     the Hag's Seat on a clear day: Runa points out the smoke and the fields on the
 *                    Irish coast, with the direction line
 *   skinboat.gif     the scavengers' skin boat in Seal Cave with its Carrick goods: looked into,
 *                    the goods taken, lifted and carried off
 *   *.png            a still of each (and @4x)
 *   README.md        the figures
 * Needs ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { REPO_ROOT } from './loadTitleArt.ts';
import { decodePng, encodePng } from './png.ts';
import type { RgbaImage } from './png.ts';

const TICK = 1000 / 60;
const W = 640;
const H = 360;
export const RAID_PORT = 5301;
const BASE = `http://localhost:${RAID_PORT}/?capture&quality=full&view=play&name=Ash&body=A`;
const OUT = join(REPO_ROOT, 'docs/art/playtest-4/raid-reason');

async function step(page: Page, ticks: number): Promise<void> {
  await page.evaluate(
    ([k, ms]) => {
      const win = window as unknown as { oeStep: (ms: number, draw?: boolean) => void };
      for (let left = k; left > 0; left -= 6) win.oeStep(Math.min(6, left) * ms, left <= 6);
    },
    [ticks, TICK] as const,
  );
}

async function shot(page: Page): Promise<Buffer> {
  return page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
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

function gif(frames: readonly Buffer[], name: string, fps: number, colours: number): number {
  const dir = join(OUT, `.${name}-frames`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  frames.forEach((f, i) => {
    writeFileSync(join(dir, `f${String(i).padStart(4, '0')}.png`), f);
  });
  const file = join(OUT, `${name}.gif`);
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

function still(frame: Buffer, name: string): void {
  writeFileSync(join(OUT, `${name}.png`), frame);
  writeFileSync(join(OUT, `${name}@4x.png`), encodePng(scale(decodePng(frame), 4)));
}

async function open(browser: Browser, query: string): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => {
    console.log(`page error: ${e.message}`);
  });
  await page.goto(`${BASE}&${query}`);
  await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 60_000 });
  await step(page, 30);
  return page;
}

/** Runs `fn` (a function body) in the page with the simulation (`sim`) and its state (`state`). */
async function play<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate<T>(
    `(() => { const sim = window.oePlay.sim; const state = sim.state; ${fn} })()`,
  );
}

/** The council at the fire, from the call to the household's answers. */
async function council(browser: Browser): Promise<{ frames: Buffer[]; key: Buffer | null }> {
  const page = await open(
    browser,
    'camp=broch&crew=1&ship=hull,rig,oar&launch=open&fire=lit&time=19:10&at=37.3,33.3',
  );
  const frames: Buffer[] = [];
  let key: Buffer | null = null;
  await play(page, "sim.submit({ type: 'INTERACT' });");
  let chose = false;
  let after = 0;
  for (let i = 0; i < 900 && after < 6; i++) {
    await step(page, 30);
    const f = await shot(page);
    frames.push(f);
    const s = await play<{ talk: boolean; queue: number; council: boolean; stage: string }>(
      page,
      "const t = state.talk; return { talk: t !== null && t.scene === 'council', queue: t === null ? 0 : t.queue.length, council: state.facts['ch1.council'] !== undefined, stage: String(state.facts['council.stage']) };",
    );
    if (s.talk && s.queue === 0 && !chose && !s.council) {
      // Hild has asked: the steerer's answer (the options are the four intents, in order).
      for (let k = 0; k < 3; k++) frames.push(await shot(page));
      key ??= frames.at(-1) ?? null;
      await play(page, "sim.submit({ type: 'TALK_CHOOSE', index: 0 });");
      chose = true;
    }
    if (chose && !s.talk) after++;
  }
  await page.close();
  return { frames, key };
}

/** The Hag's Seat on a clear day: Runa, still sitting there, points out the Irish coast. */
async function pointOut(browser: Browser): Promise<{ frames: Buffer[]; key: Buffer | null }> {
  // The stone dried before the steerer comes within earshot, so its mist has cleared; then the
  // steerer walks up to Runa from the west.
  const page = await open(browser, 'camp=broch&time=11:00&zone=ZONE_SK_HAGSEAT&at=31.0,21.6');
  await play(
    page,
    "state.powers['POWER_CAILLEACH'] = { stone: 'DRY', offering: 'CONFESSION', day: 1, passedBy: false };",
  );
  await step(page, 600);
  await play(page, "sim.submit({ type: 'MOVE', x: 1, y: 0, run: false, sneak: false });");
  const frames: Buffer[] = [];
  let key: Buffer | null = null;
  let after = 0;
  let walking = true;
  for (let i = 0; i < 200 && after < 22; i++) {
    await step(page, 12);
    if (walking && after > 0) {
      await play(page, "sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });");
      walking = false;
    }
    const f = await shot(page);
    frames.push(f);
    const pointed = await play<boolean>(page, "return state.facts['raid.pointed'] !== undefined;");
    if (pointed) {
      after++;
      if (after === 8) key = f;
    }
  }
  await page.close();
  return { frames, key };
}

/** The skin boat with its goods: looked into, the goods taken, lifted and carried off. */
async function skinBoat(browser: Browser): Promise<{ frames: Buffer[]; key: Buffer | null }> {
  const page = await open(
    browser,
    'camp=broch&crew=1&time=17:40&zone=ZONE_SK_SEALCAVE&at=55.0,21.2',
  );
  await play(
    page,
    "for (const id of ['E_WRECKER_KETILL','E_WRECKER_SVART','E_WRECKER_CONN']) { delete state.onFoot.actors[id]; state.people[id].status = 'dead'; } state.facts['ch1.chest_opened'] = true;",
  );
  const frames: Buffer[] = [];
  for (let i = 0; i < 10; i++) {
    await step(page, 12);
    frames.push(await shot(page));
  }
  const key = frames.at(-1) ?? null;
  await play(page, "sim.submit({ type: 'INTERACT' });");
  for (let i = 0; i < 30; i++) {
    await step(page, 24);
    frames.push(await shot(page));
  }
  await play(page, "sim.submit({ type: 'TALK_CHOOSE', index: 0 });");
  for (let i = 0; i < 10; i++) {
    await step(page, 24);
    frames.push(await shot(page));
  }
  await play(page, "sim.submit({ type: 'INTERACT' });");
  for (let i = 0; i < 10; i++) {
    await step(page, 12);
    frames.push(await shot(page));
  }
  await play(page, "sim.submit({ type: 'MOVE', x: -1, y: 0.3, run: false, sneak: false });");
  for (let i = 0; i < 16; i++) {
    await step(page, 12);
    frames.push(await shot(page));
  }
  await play(page, "sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });");
  await page.close();
  return { frames, key };
}

export async function raidCapture(browser: Browser): Promise<string> {
  mkdirSync(OUT, { recursive: true });
  const lines: string[] = [
    '# A reason for the first raid: captures',
    '',
    'Captured from the real game in capture mode (`npm run capture -- playtest-4-raid-reason`,',
    '`src/tools/art/captureRaid.ts`), each frame the page as the player sees it, at 1x.',
    '',
    '| File | What | Frames | Size |',
    '|---|---|---|---|',
  ];
  for (const [name, what, run, fps] of [
    ['council', 'The council at the fire (DH-140)', council, 2],
    ['pointout', 'The Hag’s Seat point-out on a clear day (DH-136)', pointOut, 5],
    [
      'skinboat',
      'The skin boat with its Carrick goods, looked into and taken (DH-137 to DH-139)',
      skinBoat,
      4,
    ],
  ] as const) {
    const { frames, key } = await run(browser);
    if (key !== null) still(key, name);
    const size = gif(frames, name, fps, 48);
    lines.push(`| ${name}.gif | ${what} | ${frames.length} | ${(size / 1e6).toFixed(2)} MB |`);
  }
  lines.push('');
  lines.push(
    'The sheets of the redrawn skin boat (`prop_skiff`) and the goods (`prop_carrick_goods`) are',
    '`prop_skiff-sheet.png` and `prop_carrick_goods-sheet.png`, at 1x and @4x, on a sand ground.',
    '',
  );
  writeFileSync(join(OUT, 'README.md'), lines.join('\n'));
  return lines.join('\n');
}
