/**
 * The user's fourth playtest's people, captured from the real game (requests 9, 10 and 14;
 * decisions DH-40 to DH-64):   node src/tools/art/capturePeople4.ts   writes
 * docs/art/playtest-4/people/
 *
 * Played in capture mode (the page advances only when stepped, every frame exact), with the
 * overlay shown (the speech lines and the talk panel are part of what the clips show). A moment is
 * staged through the camp hooks and the page's world, then played. Each is a GIF at 1x of a crop of
 * the view (30 frames a second) and a still at 4x:
 *   boat-work      everyone on the boat: spread round it, standing and kneeling at the work
 *   boat-changes   the same work in time-lapse: the patch going on stage by stage, then the mast
 *   exchange       an evening at the fire: two or three of the household talking among themselves
 *   refusal        Runa refusing a binding, then letting it be done holding the end, sitting still
 * Needs ffmpeg.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { createServer } from 'vite';
import { Clip, screen, tick } from './captureCombat2.ts';
import { REPO_ROOT } from './loadTitleArt.ts';

const PORT = 5313;
const OUT = 'docs/art/playtest-4/people';
/** A build already served (PEOPLE4_HOST, e.g. a `vite preview`), or the dev server started here. */
const HOST = process.env['PEOPLE4_HOST'] ?? `http://localhost:${String(PORT)}/`;
const BASE = `${HOST}?capture&quality=full&view=play&name=Ash&body=A&camp=broch&crew=1&joined=2`;

async function open(browser: Browser, params: string): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 2,
  });
  page.on('pageerror', (e) => {
    console.log(`page error: ${e.message}`);
  });
  page.on('crash', () => {
    console.log('page crashed');
  });
  await page.goto(`${BASE}&${params}`);
  await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 60_000 });
  await tick(page, 30);
  return page;
}

/** Advances `n` ticks in chunks, so no one evaluation runs for long. */
async function run(page: Page, n: number): Promise<void> {
  // Undrawn ticks (the simulation and overlay only), then one drawn: time passing between frames.
  await page.evaluate((k) => {
    const w = window as unknown as { oeStep: (ms: number, draw?: boolean) => void };
    for (let i = 0; i < k; i++) w.oeStep(1000 / 60, i === k - 1);
  }, n);
}

interface World {
  onFoot: {
    player: { x: number; y: number };
    actors: Record<string, { x: number; y: number }>;
  };
  company?: { nextExchange: number };
  tick: number;
}

/** The view's point (game pixels) of a place on the zone, for the crops. */
async function focusOn(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return screen(page, x, y);
}

async function boatWork(browser: Browser, out: string): Promise<string> {
  const page = await open(
    browser,
    'lay=boards&boatwork=all&hull=0.2&time=09:00&day=4&zone=ZONE_SK_STRAND&at=42,31.5',
  );
  // Let everyone walk down to their spots.
  await run(page, 60 * 40);
  const clip = new Clip(page, 'boat-work', out);
  clip.focus = await focusOn(page, 42 * 24, 26 * 24);
  for (let i = 0; i < 30 * 5; i++) await clip.frame(i === 60);
  const size = clip.write(0, [320, 180]);
  await page.close();
  return `boat-work.gif ${(size / 1e6).toFixed(2)} MB`;
}

async function boatChanges(browser: Browser, out: string): Promise<string> {
  const page = await open(
    browser,
    'lay=boards,rig&boatwork=all&hull=0.1&time=07:00&day=4&zone=ZONE_SK_STRAND&at=42,31.5',
  );
  await run(page, 60 * 30);
  const clip = new Clip(page, 'boat-changes', out);
  clip.focus = await focusOn(page, 42 * 24, 25 * 24);
  let last = '';
  let changes = 0;
  for (let i = 0; i < 30 * 9; i++) {
    await run(page, 150);
    const boat = (await page.locator('.oe-overlay').getAttribute('data-boat')) ?? '';
    if (boat !== last) {
      changes++;
      last = boat;
    }
    await clip.frame(boat.includes('rigwork') || boat.includes('rig'));
    if (boat.includes('+rig') && !boat.includes('rigwork')) break;
  }
  const size = clip.write(0, [320, 180]);
  await page.close();
  return `boat-changes.gif ${(size / 1e6).toFixed(2)} MB, ${String(changes)} drawn stages`;
}

async function exchange(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, 'fire=lit&tended=1&time=18:30&day=3&at=36.4,33.2');
  await run(page, 60 * 8);
  // The next exchange due now (staged), the steerer by the fire with them.
  await page.evaluate(() => {
    const w = (window as unknown as { oeWorld: World }).oeWorld;
    if (w.company !== undefined) w.company.nextExchange = w.tick + 60;
  });
  const clip = new Clip(page, 'exchange', out);
  clip.focus = await focusOn(page, 35.4 * 24, 31.6 * 24);
  let heard = 0;
  for (let i = 0; i < 30 * 12 && heard < 30 * 3; i++) {
    await clip.frame(i === 100);
    const spoken = (await page.locator('.oe-overlay').getAttribute('data-spoken')) ?? '';
    if (spoken.includes('.chat.') && /\.chat\.[a-z_]+\.[23]$/.test(spoken)) heard++;
  }
  const size = clip.write(0, [640, 360]);
  await page.close();
  return `exchange.gif ${(size / 1e6).toFixed(2)} MB`;
}

async function refusal(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, 'hurt=C_RUNA&fire=lit&tended=1&time=18:40&day=3');
  await run(page, 60 * 5);
  // Beside Runa on whichever side makes her the one Interact talks to (the others sit close).
  const place = async (dx: number, dy: number): Promise<{ x: number; y: number }> =>
    page.evaluate(
      ([ox, oy]) => {
        const w = (window as unknown as { oeWorld: World & { onFoot: { items: unknown[] } } })
          .oeWorld.onFoot;
        w.items = [];
        const a = w.actors['C_RUNA'] ?? w.player;
        w.player.x = a.x + ox;
        w.player.y = a.y + oy;
        return { x: a.x, y: a.y };
      },
      [dx, dy] as const,
    );
  const talk = async (): Promise<string> =>
    (await page.locator('.oe-overlay').getAttribute('data-talk')) ?? '';
  let runa = { x: 0, y: 0 };
  for (const [dx, dy] of [
    [-16, 0],
    [0, 14],
    [16, 0],
    [0, -14],
  ] as const) {
    runa = await place(dx, dy);
    await tick(page, 4);
    await page.keyboard.press('KeyE');
    await tick(page, 4);
    if ((await talk()) === 'C_RUNA') break;
    if ((await talk()) !== '') await page.keyboard.press('Space');
    await tick(page, 4);
  }
  // Out of the talk again, to record it from the start.
  await page.keyboard.press('Space');
  await tick(page, 10);
  const clip = new Clip(page, 'refusal', out);
  clip.focus = await focusOn(page, runa.x, runa.y);
  const options = async (): Promise<string[]> =>
    ((await page.locator('.oe-overlay').getAttribute('data-talk-options')) ?? '').split('|');
  const choose = async (key: string): Promise<void> => {
    const i = (await options()).indexOf(key);
    if (i >= 0) await page.keyboard.press(`Digit${String(i + 1)}`);
  };
  for (let i = 0; i < 15; i++) await clip.frame();
  await page.keyboard.press('KeyE');
  for (let i = 0; i < 30; i++) await clip.frame();
  await choose('ui.talk.topic.wound');
  for (let i = 0; i < 60; i++) await clip.frame();
  await choose('p_steerer.talk.tend');
  for (let i = 0; i < 75; i++) await clip.frame(i === 20);
  await choose('p_steerer.talk.care.hold_end');
  for (let i = 0; i < 30 * 5; i++) await clip.frame();
  const size = clip.write(0, [640, 360]);
  await page.close();
  return `refusal.gif ${(size / 1e6).toFixed(2)} MB`;
}

export async function people4Capture(browser: Browser): Promise<string> {
  const out = join(REPO_ROOT, OUT);
  mkdirSync(out, { recursive: true });
  const lines: string[] = [];
  const only = process.env['PEOPLE4_ONLY']?.split(',') ?? null;
  const clips = { boatWork, boatChanges, exchange, refusal };
  for (const [name, make] of Object.entries(clips))
    if (only === null || only.includes(name)) lines.push(await make(browser, out));
  return lines.join('\n');
}

if (import.meta.filename === process.argv[1] && process.env['PEOPLE4_HOST'] !== undefined) {
  const browser = await chromium.launch();
  try {
    console.log(await people4Capture(browser));
  } finally {
    await browser.close();
  }
} else if (import.meta.filename === process.argv[1]) {
  const server = await createServer({
    root: REPO_ROOT,
    server: { port: PORT, strictPort: true, hmr: false, watch: null },
    logLevel: 'error',
  });
  await server.listen();
  const browser = await chromium.launch();
  try {
    console.log(await people4Capture(browser));
  } finally {
    await browser.close();
    await server.close();
  }
}
