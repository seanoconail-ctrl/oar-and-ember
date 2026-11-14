/**
 * Stage 14, package D in the browser (decisions S14-90 to S14-109): Kelda's stream in the machair
 * runs its own way with foam and keeps Book 7's 80% of the screen moving (half with reduced
 * motion); every island scene's WebGL frame differs between seasons, and a scene with a shore
 * between low and high water; and the island's ambience listens render without clipping or
 * silence. Measured in Chromium only (the art and the sound are the same in every browser).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseTimeBalance } from '../../src/content/balance.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import {
  MOTION_THRESHOLD,
  REDUCED_MOTION_THRESHOLD,
  continuousMotion,
} from '../../src/tools/art/motion.ts';
import { decodePng } from '../../src/tools/art/png.ts';
import { reportPageErrors } from './strand.ts';

const ROOT = join(import.meta.dirname, '../..');
const b = parseTimeBalance(JSON.parse(readFileSync(join(ROOT, 'content/balance.json'), 'utf8')));
/** Mid-season days (the calendar's 30-day seasons), outside the heather's bloom. */
const DAYS = { Spring: 10, Summer: 40, Autumn: 80, Winter: 100 } as const;
/** Kelda's stream below its pool, where it narrows past the stones. */
const KELDA = 'zone=ZONE_SK_MACHAIR&at=54,16&time=12:00';

interface Zone {
  zone: string;
  rows: string[];
  width: number;
  height: number;
  ground?: string;
}
const zones: Zone[] = readdirSync(join(ROOT, 'content/zones'))
  .filter((f) => f.startsWith('zone_sk_') && f.endsWith('.json') && !f.endsWith('.plan.json'))
  .map((f) => JSON.parse(readFileSync(join(ROOT, 'content/zones', f), 'utf8')) as Zone);
const seasonless = new Set(
  Object.keys(
    (
      JSON.parse(readFileSync(join(ROOT, 'assets/art/seasons.json'), 'utf8')) as {
        seasonless: Record<string, string>;
      }
    ).seasonless,
  ),
);

/** The tile at the middle of the view holding the most land, and for a shore the most shore. */
function viewOf(z: Zone, shore: boolean): { x: number; y: number } {
  let best = { n: -1, x: Math.floor(z.width / 2), y: Math.floor(z.height / 2) };
  for (let y = 7; y < z.height - 7; y += 2)
    for (let x = 13; x < z.width - 13; x += 2) {
      let land = 0;
      let wet = 0;
      for (let v = -7; v <= 7; v++)
        for (let u = -13; u <= 13; u++) {
          const c = z.rows[y + v]?.[x + u] ?? '~';
          if (',hpw:n'.includes(c)) land++;
          if ('-_'.includes(c)) wet++;
        }
      const n = shore ? Math.min(land, 60) + wet * 3 : land;
      if (n > best.n) best = { n, x, y };
    }
  return best;
}

async function open(page: Page, query: string): Promise<void> {
  reportPageErrors(page);
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`./?quality=full&view=play&name=Ash&body=A&${query}`);
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'play', {
    timeout: 60_000,
  });
  await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
}

async function motion(page: Page, frames: number): Promise<number> {
  const shots: Uint8Array[] = [];
  for (let i = 0; i < frames; i++) {
    shots.push(decodePng(await page.screenshot()).data);
    await page.waitForTimeout(120);
  }
  return continuousMotion(shots, 640, 360).share;
}

/** Sets the day and the hour, then runs the world for `seconds` so the drawn tide catches up. */
async function at(
  page: Page,
  day: number,
  minuteOfDay: number,
  seconds: number,
): Promise<Uint8Array> {
  await page.evaluate(
    ([d, m, s]) => {
      const w = window as unknown as {
        oeWorld: { calendar: { day: number; minuteOfDay: number } };
        oeStep: (ms: number, draw?: boolean) => void;
      };
      w.oeWorld.calendar = { day: d, minuteOfDay: m };
      const steps = Math.ceil((s * 1000) / 50);
      for (let i = 0; i < steps; i++) w.oeStep(50, i === steps - 1);
    },
    [day, minuteOfDay, seconds] as const,
  );
  return decodePng(await page.screenshot()).data;
}

/** The share of pixels that differ between two frames. */
function differ(a: Uint8Array, c: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < a.length; i += 4)
    if (a[i] !== c[i] || a[i + 1] !== c[i + 1] || a[i + 2] !== c[i + 2]) n++;
  return n / (a.length / 4);
}

/** The first minute of day `day` at low water (tidal ground open), or at high water. */
function tideMinute(day: number, low: boolean): number {
  for (let m = 6 * 60; m < 6 * 60 + 1440; m += 10) {
    const minuteOfDay = m % 1440;
    const t = tideAt({ day, minuteOfDay }, b);
    const high = Math.min(t.minutesToLowWater, t.minutesSinceLowWater) >= 330;
    if (low ? t.tidalGroundOpen : high) return minuteOfDay;
  }
  throw new Error(`no ${low ? 'low' : 'high'} water on day ${day}`);
}

test.describe('the island’s water and seasons (Stage 14)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'measured in Chromium');
  test.describe.configure({ timeout: 240_000 });

  test(`Kelda's stream flows with foam, and at least ${MOTION_THRESHOLD * 100}% of the machair keeps moving`, async ({
    page,
  }) => {
    await open(page, KELDA);
    await page.waitForTimeout(2500);
    const shots: Uint8Array[] = [];
    for (let i = 0; i < 30; i++) {
      shots.push(decodePng(await page.screenshot()).data);
      await page.waitForTimeout(120);
    }
    const m = continuousMotion(shots, 640, 360);
    console.log(`Kelda's stream: continuous motion ${(m.share * 100).toFixed(1)}%`);
    expect(m.share).toBeGreaterThanOrEqual(MOTION_THRESHOLD);
    // Foam on the stream: pale foam steps (the sea ramp's top three) along its banks and stones.
    const first = shots[0] ?? new Uint8Array();
    let foam = 0;
    for (let i = 0; i < first.length; i += 4) {
      const [r, g, bl] = [first[i], first[i + 1], first[i + 2]];
      if (
        (r === 0x93 && g === 0xb5 && bl === 0xb3) ||
        (r === 0xbf && g === 0xd4 && bl === 0xcd) ||
        (r === 0xe4 && g === 0xee && bl === 0xe8)
      )
        foam++;
    }
    console.log(`foam pixels: ${foam}`);
    expect(foam).toBeGreaterThan(300);
  });

  test(`with reduced motion the stream runs softer and ${REDUCED_MOTION_THRESHOLD * 100}% still moves`, async ({
    page,
  }) => {
    await open(page, `${KELDA}&motion=reduced`);
    await page.waitForTimeout(2500);
    const share = await motion(page, 30);
    console.log(`Kelda's stream, reduced motion: ${(share * 100).toFixed(1)}%`);
    expect(share).toBeGreaterThanOrEqual(REDUCED_MOTION_THRESHOLD);
  });

  for (const z of zones) {
    if (seasonless.has(z.zone)) continue;
    const tidal = z.rows.some((r) => r.includes('-') || r.includes('_'));
    test(`${z.zone}: its frame differs by season${tidal ? ' and by tide' : ''}`, async ({
      page,
    }) => {
      const v = viewOf(z, false);
      await open(page, `capture&zone=${z.zone}&at=${v.x},${v.y}&camera=${v.x},${v.y}&time=12:00`);
      const noon = 12 * 60;
      const frames = [];
      for (const day of Object.values(DAYS)) frames.push(await at(page, day, noon, 1));
      const names = Object.keys(DAYS);
      for (let a = 0; a < frames.length; a++)
        for (let c = a + 1; c < frames.length; c++) {
          const share = differ(frames[a] ?? new Uint8Array(), frames[c] ?? new Uint8Array());
          console.log(`${z.zone} ${names[a]}-${names[c]}: ${(share * 100).toFixed(1)}%`);
          expect(share, `${z.zone} ${names[a]}-${names[c]}`).toBeGreaterThan(0.02);
        }
      if (!tidal) return;
      const s = viewOf(z, true);
      await open(page, `capture&zone=${z.zone}&at=${s.x},${s.y}&camera=${s.x},${s.y}&time=12:00`);
      const day = DAYS.Spring;
      const low = await at(page, day, tideMinute(day, true), 12);
      const high = await at(page, day, tideMinute(day, false), 12);
      const share = differ(low, high);
      console.log(`${z.zone} low-high water: ${(share * 100).toFixed(1)}%`);
      expect(share).toBeGreaterThan(0.02);
    });
  }

  test('the island ambience listens render, none silent and none clipping', async ({ page }) => {
    await page.goto('./sound.html');
    await expect(page.locator('#sound')).toHaveAttribute('data-state', 'ready', {
      timeout: 15_000,
    });
    const items = await page.evaluate(
      () => (window as unknown as { oeSound: { islandItems: string[] } }).oeSound.islandItems,
    );
    expect(items.length).toBe(16 + 1);
    for (const item of items) {
      await expect(
        page.locator(
          `[data-island-play="${item.slice(7)}"], [data-island-sound="${item.slice(7)}"]`,
        ),
      ).toHaveCount(1);
      const r = await page.evaluate(
        async ([i]) => {
          const w = window as unknown as {
            oeSound: {
              render: (i: string, s: number, st: unknown) => Promise<{ peak: number; rms: number }>;
            };
          };
          return w.oeSound.render(i, 8, {});
        },
        [item] as const,
      );
      console.log(
        `${item}: peak ${r.peak.toFixed(3)}, rms ${(20 * Math.log10(r.rms)).toFixed(1)} dBFS`,
      );
      expect(r.peak, item).toBeLessThan(0.99);
      expect(r.rms, item).toBeGreaterThan(0.004);
    }
  });

  test("Kelda's stream at full detail stays within the frame budget @budget", async ({ page }) => {
    await open(page, KELDA);
    await page.waitForTimeout(2500);
    await motion(page, 33);
    const ms = Number(await page.locator('.oe-overlay').getAttribute('data-frame-ms'));
    console.log(`Kelda's stream, script per frame: ${ms.toFixed(2)} ms`);
    expect(ms).toBeGreaterThan(0);
    // Book 2's browser budget (as standard.spec.ts): a third of a 60 fps frame.
    expect(ms).toBeLessThan(5.5);
  });
});
