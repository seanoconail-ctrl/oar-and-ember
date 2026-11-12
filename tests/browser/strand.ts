/** Wreck Strand for the browser tests: the zone, its water at the opening, and walking it. */
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseTimeBalance, parseWaterBalance } from '../../src/content/balance.ts';
import { bakeElevation } from '../../src/content/terrain/elevation.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { bandAt, stillWaterLevel } from '../../src/sim/land/water.ts';
import { parseZoneMap, tileOf } from '../../src/sim/land/zoneMap.ts';
import type { Tile } from '../../src/tools/play/openingBot.ts';

const zoneJson = JSON.parse(readFileSync('content/zones/zone_sk_strand.json', 'utf8')) as {
  spawns: Record<string, { x: number; y: number }>;
};
export const map = parseZoneMap(zoneJson, 'content/zones/zone_sk_strand.json');
const balance = JSON.parse(readFileSync('content/balance.json', 'utf8')) as unknown;
const water = parseWaterBalance(balance);
const elevation = bakeElevation(map.rows);
/** The opening's still water level: high water, which holds for the opening's first hours. */
const level = stillWaterLevel(tideAt({ day: 1, minuteOfDay: 6 * 60 }, parseTimeBalance(balance)));
/**
 * A tile the keys can walk through: no deeper than the knee where the walk aims for, so a late
 * key release on a slow machine never carries the steerer into deep water.
 */
export const wadeable = (t: Tile): boolean => {
  const band = bandAt(water, elevation, (t.tx + 0.5) * 24, (t.ty + 0.7) * 24, level)?.band;
  return band !== 'WAIST' && band !== 'DEEP';
};
export const hildSpawn = zoneJson.spawns['C_HILD'] ?? { x: 0, y: 0 };

export const overlay = (page: Page) => page.locator('.oe-overlay');
export const attr = async (page: Page, name: string): Promise<string> =>
  (await overlay(page).getAttribute(`data-${name}`)) ?? '';

/**
 * Prints the page's uncaught errors and console errors into the test's output, so a failure on a
 * CI browser that cannot be run here says what the game itself reported.
 */
export function reportPageErrors(page: Page): void {
  page.on('pageerror', (error) => {
    console.log(`page error: ${error.message}\n${error.stack ?? ''}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error')
      console.log(`page console ${message.type()}: ${message.text()}`);
  });
}

/**
 * Opens play directly. `extra` adds query parameters: `kit=bow,seax` starts with those items (the
 * bow with its starting arrows), `capture` makes the page advance only when stepped (oeStep).
 */
export async function startPlay(page: Page, body: 'A' | 'B' = 'A', extra = ''): Promise<void> {
  reportPageErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`./?view=play&name=Ash&body=${body}${extra === '' ? '' : `&${extra}`}`);
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'play', {
    timeout: 15_000,
  });
}

/**
 * Stepped play (`capture`): the page advances only when the test steps it, a frame of a fixed
 * length at a time, so a slow machine (CI's software-rendered browsers) plays exactly what a fast
 * one does. A frame is 100 ms of game time: the longest the visuals take in one frame (camera,
 * animation), and never counted as fast or slow by the detail check (AP-16), so a stepped page
 * keeps the detail it starts with. Each frame costs a full draw on the test machine, so a test
 * steps no more frames than it needs.
 */
export const STEP_MS = 100;
/** A walking frame: the longest the simulation catches up in one frame (MAX_FRAME_MS). */
const WALK_MS = 250;
/** The last pixels of a walk go a tick at a time, so it stops within two pixels. */
const TICK = 1000 / 60;

/** True when the page was opened with `capture` (it has `window.oeStep`). */
export async function isStepped(page: Page): Promise<boolean> {
  return page.evaluate(() => 'oeStep' in window);
}

/** Advances a stepped page by `frames` frames of `ms` milliseconds each. */
export async function step(page: Page, frames = 1, ms = STEP_MS): Promise<void> {
  await page.evaluate(
    ({ n, length }) => {
      const w = window as unknown as { oeStep: (ms: number, draw?: boolean) => void };
      // Only the last frame is drawn: the simulation and overlay run on every one (DE-81).
      for (let i = 0; i < n; i++) w.oeStep(length, i === n - 1);
    },
    { n: frames, length: ms },
  );
}

/**
 * Steps a stepped page until `data-<name>` on the overlay matches `want` (exactly, or a pattern),
 * for at most `seconds` of game time. It returns nothing: the caller asserts the attribute, so a
 * miss fails with the value the game ended on.
 */
export async function stepUntil(
  page: Page,
  name: string,
  want: string | RegExp,
  seconds = 10,
): Promise<void> {
  await page.evaluate(
    ({ attribute, exact, source, flags, frames, length }) => {
      const w = window as unknown as { oeStep: (ms: number, draw?: boolean) => void };
      const o = document.querySelector('.oe-overlay');
      const pattern = source === null ? null : new RegExp(source, flags);
      const ok = (): boolean => {
        const v = o?.getAttribute(attribute) ?? '';
        return pattern === null ? v === exact : pattern.test(v);
      };
      for (let i = 0; i < frames && !ok(); i++) w.oeStep(length, false);
      w.oeStep(0);
    },
    {
      attribute: `data-${name}`,
      exact: typeof want === 'string' ? want : '',
      source: typeof want === 'string' ? null : want.source,
      flags: typeof want === 'string' ? '' : want.flags,
      frames: Math.ceil((seconds * 1000) / STEP_MS),
      length: STEP_MS,
    },
  );
}

/** Steps a stepped page until an element matching `selector` contains `text`. */
export async function stepUntilText(
  page: Page,
  selector: string,
  text: string,
  seconds = 10,
): Promise<void> {
  await page.evaluate(
    ({ css, words, frames, length }) => {
      const w = window as unknown as { oeStep: (ms: number, draw?: boolean) => void };
      const ok = (): boolean =>
        [...document.querySelectorAll(css)].some((e) => e.textContent.includes(words));
      for (let i = 0; i < frames && !ok(); i++) w.oeStep(length, false);
      w.oeStep(0);
    },
    { css: selector, words: text, frames: Math.ceil((seconds * 1000) / STEP_MS), length: STEP_MS },
  );
}

/**
 * Stepped: holds the key down while stepping until the feet are within two pixels of `target`
 * (shorter frames as it nears, and single ticks for the last pixels, so it never overshoots), or
 * until blocked (no progress for a second of game time); then lets go and steps one tick.
 */
async function walkAxisStepped(
  page: Page,
  axis: 'x' | 'y',
  target: number,
  key: string,
): Promise<void> {
  await page.keyboard.down(key);
  await page.evaluate(
    ({ name, goal, walk, tick }) => {
      const w = window as unknown as { oeStep: (ms: number, draw?: boolean) => void };
      const o = document.querySelector('.oe-overlay');
      const now = (): number => Number(o?.getAttribute(name) ?? 0);
      const forward = goal > now();
      let still = 0;
      for (let i = 0; i < 4000; i++) {
        const at = now();
        const left = forward ? goal - at : at - goal;
        if (left <= 2) break;
        // A walk covers at most 0.8 px a tick, so a frame never carries it past the goal.
        const length = left > 14 ? walk : left > 5 ? 4 * tick : tick;
        w.oeStep(length, false);
        if (now() === at) {
          still += length;
          if (still > 1000) break;
        } else still = 0;
      }
    },
    { name: axis === 'x' ? 'data-px' : 'data-py', goal: target, walk: WALK_MS, tick: TICK },
  );
  await page.keyboard.up(key);
  await step(page, 1, TICK);
}

/** Holds the key for one axis until the steerer's feet reach `target` along it. */
export async function walkAxis(page: Page, axis: 'x' | 'y', target: number): Promise<void> {
  const now = async (): Promise<number> => Number(await attr(page, axis === 'x' ? 'px' : 'py'));
  if (await isStepped(page)) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const at = await now();
      if (Math.abs(target - at) < 4) return;
      const forward = target > at;
      const key = axis === 'x' ? (forward ? 'KeyD' : 'KeyA') : forward ? 'KeyS' : 'KeyW';
      await walkAxisStepped(page, axis, target, key);
    }
    return;
  }
  // A player who overshoots steps back: on a slow machine the key may be released late, so
  // correct up to a few times, each run shorter.
  for (let attempt = 0; attempt < 4; attempt++) {
    let at = await now();
    if (Math.abs(target - at) < 4) return;
    const forward = target > at;
    const key = axis === 'x' ? (forward ? 'KeyD' : 'KeyA') : forward ? 'KeyS' : 'KeyW';
    await page.keyboard.down(key);
    const deadline = Date.now() + 15_000;
    // Stop pushing when blocked (deep water, a rock): no progress for a second.
    let last = at;
    let lastMoved = Date.now();
    while (Date.now() < deadline) {
      at = await now();
      if (forward ? at >= target - 2 : at <= target + 2) break;
      if (at !== last) {
        last = at;
        lastMoved = Date.now();
      } else if (Date.now() - lastMoved > 1000) break;
    }
    await page.keyboard.up(key);
    // Let the last frames land before checking again.
    await page.waitForTimeout(150);
  }
}

/** Walks a tile path by straight runs, the way a player steers with the keys. */
export async function walkPath(page: Page, path: readonly Tile[]): Promise<void> {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const next = path[i + 1];
    if (a === undefined || b === undefined) continue;
    const axis = a.tx !== b.tx ? 'x' : 'y';
    const turns = next === undefined || (axis === 'x' ? next.ty !== b.ty : next.tx !== b.tx);
    if (!turns) continue;
    await walkAxis(page, axis, axis === 'x' ? (b.tx + 0.5) * 24 : (b.ty + 0.7) * 24);
    // Correct a late release along the other axis before the next run.
    if (axis === 'x') await walkAxis(page, 'y', (b.ty + 0.7) * 24);
    else await walkAxis(page, 'x', (b.tx + 0.5) * 24);
  }
}

export async function here(page: Page): Promise<Tile> {
  return tileOf(map, Number(await attr(page, 'px')), Number(await attr(page, 'py')));
}

/** Walks to within a few pixels of a point, correcting along each axis as a player would. */
export async function approach(page: Page, x: number, y: number): Promise<void> {
  for (let round = 0; round < 3; round++) {
    const px = Number(await attr(page, 'px'));
    const py = Number(await attr(page, 'py'));
    if (Math.abs(px - x) < 5 && Math.abs(py - y) < 5) return;
    await walkAxis(page, 'x', x);
    await walkAxis(page, 'y', y);
  }
}
