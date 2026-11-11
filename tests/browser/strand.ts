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

export async function startPlay(page: Page, body: 'A' | 'B' = 'A'): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`./?view=play&name=Ash&body=${body}`);
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'play', {
    timeout: 15_000,
  });
}

/** Holds the key for one axis until the steerer's feet reach `target` along it. */
export async function walkAxis(page: Page, axis: 'x' | 'y', target: number): Promise<void> {
  const now = async (): Promise<number> => Number(await attr(page, axis === 'x' ? 'px' : 'py'));
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
