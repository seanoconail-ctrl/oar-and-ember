/**
 * The user's fourth playtest's story, captured from the real game (decisions DH-10 to DH-26):
 *   node src/tools/art/captureStory4.ts [base-url]   writes docs/art/playtest-4/story/
 *
 * Needs the production build served (default http://localhost:4173/, `npx vite preview`) and
 * ffmpeg. The game runs stepped (?capture); each frame is the page's own screenshot of the view at
 * 1x (640 x 360), so the prompts and captions drawn over the canvas are in it; the GIFs keep every
 * second frame, at 5 frames a second (real time), the view's middle 480 x 270. It writes:
 *   shelter-mark.gif      walking to the marked spot: the frame's prompt and mark, the frame going
 *                         up, the sail's prompt over the gathered stones, the sail lashed
 *   silver-snatch.gif     Oddi lifted on the strand: Conn breaks from the dune grass, hauls the
 *                         strongbox up while the steerer is held, Oddi shouts, Conn runs for the dunes
 *   thorkel-remark.gif    at Thorkel's bier: his key taken with the steerer's first word, then the next
 *   *-first.png, *@4x.png a key frame of each at 1x and 4x
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import { REPO_ROOT } from './loadTitleArt.ts';

const base = process.argv[2] ?? 'http://localhost:4173/';
const OUT = join(REPO_ROOT, 'docs/art/playtest-4/story');
const TICK = 1000 / 60;

async function frame(page: Page): Promise<Buffer> {
  const box = await page.locator('canvas#screen').boundingBox();
  if (box === null) throw new Error('no canvas');
  return page.screenshot({ clip: box, scale: 'css' });
}

/** Steps `ticks` (drawing the last) and returns the view as PNG. */
async function step(page: Page, ticks: number): Promise<Buffer> {
  await page.evaluate(
    ([k, ms]) => {
      const w = window as unknown as { oeStep: (ms: number, draw?: boolean) => void };
      for (let i = 0; i < k; i++) w.oeStep(ms, i === k - 1);
    },
    [ticks, TICK] as const,
  );
  return frame(page);
}

async function open(page: Page, query: string): Promise<void> {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`${base}?view=play&name=Ash&body=A&quality=full&capture&${query}`);
  await page.locator('canvas#screen[data-state="play"]').waitFor({ timeout: 30_000 });
  await step(page, 3);
}

/** Writes the frames as a 10 fps GIF at 1x, and the key frame at 1x and 4x. */
function gif(name: string, all: Buffer[], key: number, every = 1): void {
  const frames = all.filter((_, i) => i % every === 0);
  const tmp = join(OUT, `.${name}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  frames.forEach((f, i) => {
    writeFileSync(join(tmp, `${String(i).padStart(4, '0')}.png`), f);
  });
  const gifPath = join(OUT, `${name}.gif`);
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-framerate',
    String(10 / every),
    '-i',
    join(tmp, '%04d.png'),
    '-vf',
    'crop=480:270:80:45,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none',
    gifPath,
  ]);
  const k = all[Math.min(key, all.length - 1)];
  if (k !== undefined) {
    writeFileSync(join(OUT, `${name}-key.png`), k);
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      join(OUT, `${name}-key.png`),
      '-vf',
      'scale=2560:1440:flags=neighbor',
      join(OUT, `${name}@4x.png`),
    ]);
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log(
    `${name}.gif ${(statSync(gifPath).size / 1e6).toFixed(2)} MB, ${frames.length} frames`,
  );
}

async function hold(page: Page, key: string, ticks: number, frames: Buffer[]): Promise<void> {
  await page.keyboard.down(key);
  for (let t = 0; t < ticks; t += 6) frames.push(await step(page, 6));
  await page.keyboard.up(key);
}

async function shelterMark(page: Page): Promise<void> {
  await open(page, 'camp=broch&shelter=down&fire=lit&time=10:00&at=36.2,31.4');
  const frames: Buffer[] = [];
  for (let i = 0; i < 6; i++) frames.push(await step(page, 6));
  await hold(page, 'KeyW', 34, frames);
  for (let i = 0; i < 10; i++) frames.push(await step(page, 6));
  await page.keyboard.press('KeyE');
  for (let i = 0; i < 70; i++) frames.push(await step(page, 6));
  await page.keyboard.press('KeyE');
  for (let i = 0; i < 70; i++) frames.push(await step(page, 6));
  gif('shelter-mark', frames, 12, 2);
}

async function silverSnatch(page: Page): Promise<void> {
  await open(page, 'camp=broch&day=2&time=08:00&zone=ZONE_SK_STRAND&at=24.5,35.4');
  const frames: Buffer[] = [];
  for (let i = 0; i < 4; i++) frames.push(await step(page, 6));
  await hold(page, 'KeyA', 6, frames);
  await page.keyboard.press('KeyE');
  for (let i = 0; i < 70; i++) frames.push(await step(page, 6));
  await hold(page, 'KeyW', 90, frames);
  gif('silver-snatch', frames, 40, 2);
}

async function thorkelRemark(page: Page): Promise<void> {
  await open(page, 'camp=broch&crew=1&time=10:00&at=42.4,27.6');
  const frames: Buffer[] = [];
  for (let i = 0; i < 8; i++) frames.push(await step(page, 6));
  await page.keyboard.press('KeyE');
  for (let i = 0; i < 45; i++) frames.push(await step(page, 6));
  await page.keyboard.press('KeyE');
  for (let i = 0; i < 45; i++) frames.push(await step(page, 6));
  gif('thorkel-remark', frames, 20, 2);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const run of [shelterMark, silverSnatch, thorkelRemark]) {
    const page = await browser.newPage();
    await run(page);
    await page.close();
  }
} finally {
  await browser.close();
}
