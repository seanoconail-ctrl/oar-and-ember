/**
 * Stage 7 in the browser (Book 3 Stage 7): the broch at home with its day clock and stamina bar,
 * the walk down to the strand through the broch's door, a task's work loop taking game time (a
 * plain action with no timing ring, decision PT-1), driftwood picked up where it lies on the strand
 * (PT-2), a night's sleep to the morning report, and the fire's light at night.
 *
 * Every test plays stepped (`capture`: the page advances only when stepped, by `oeStep`), and starts
 * at the broch through the camp hooks (`camp=broch`, `time=HH:MM`, `fire=lit`, `at=x,y` and so on;
 * src/scenes/camp.ts), so it plays the same on a slow machine as on a fast one.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { attr, overlay, startPlay } from './strand.ts';

const camp = JSON.parse(readFileSync('content/camp.json', 'utf8')) as {
  sites: { key: string; x: number; y: number }[];
  sleepSeconds: number;
};
const site = (key: string) => {
  const s = camp.sites.find((x) => x.key === key);
  if (s === undefined) throw new Error(`no camp site ${key}`);
  return s;
};

/** Steps the page `frames` frames of `ms` game milliseconds each. */
async function step(page: Page, frames = 1, ms = 100): Promise<void> {
  await page.evaluate(
    ([n, d]) => {
      const w = window as unknown as { oeStep: (ms: number, draw?: boolean) => void };
      for (let i = 0; i < n; i++) w.oeStep(d, i === n - 1);
    },
    [frames, ms] as const,
  );
}

/** Steps until the overlay's attribute matches, a frame at a time, up to `frames` frames. */
async function stepUntil(
  page: Page,
  name: string,
  match: (v: string) => boolean,
  frames: number,
  ms = 100,
): Promise<string> {
  for (let i = 0; i < frames; i++) {
    const v = await attr(page, name);
    if (match(v)) return v;
    await step(page, 1, ms);
  }
  return attr(page, name);
}

const minutes = (clock: string): number => {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  return h * 60 + m;
};

test.describe('Stage 7: day and night, shelter and first tasks', () => {
  test.setTimeout(180_000);

  test('the broch by day: the day clock, and a stamina bar its conditions have shortened', async ({
    page,
  }) => {
    await startPlay(page, 'A', 'capture&camp=broch&time=16:00');
    await step(page, 3);
    await expect(overlay(page)).toHaveAttribute('data-zone', 'ZONE_SK_MACHAIR');
    await expect(overlay(page)).toHaveAttribute('data-light', 'day');
    expect(minutes(await attr(page, 'clock'))).toBeGreaterThanOrEqual(16 * 60);
    await expect(page.locator('[data-region=clock]')).toContainText('16:0');
    // Wet from the wreck and unfed since: the bar is shorter, and says why.
    const reasons = await attr(page, 'reasons');
    expect(reasons).toContain('COLD');
    expect(Number(await attr(page, 'stamina-max'))).toBeLessThan(100);
    await expect(page.locator('[data-region=stamina]')).toContainText('Cold');
  });

  test('walks out of the broch door and down onto the strand, a zone away', async ({ page }) => {
    await startPlay(page, 'A', 'capture&camp=broch&time=10:00&at=35.5,33.6');
    await step(page, 3);
    await expect(overlay(page)).toHaveAttribute('data-zone', 'ZONE_SK_MACHAIR');
    await page.keyboard.down('KeyS');
    const zone = await stepUntil(page, 'zone', (z) => z === 'ZONE_SK_STRAND', 120, 250);
    await page.keyboard.up('KeyS');
    expect(zone).toBe('ZONE_SK_STRAND');
    // On the strand, at its top edge.
    expect(Number(await attr(page, 'y'))).toBeLessThan(4);
  });

  test('lights the fire: the work loop plays, and the clock moves on by the task', async ({
    page,
  }) => {
    const fire = site('fire');
    await startPlay(page, 'A', `capture&camp=broch&time=17:00&wood=2&at=${fire.x},${fire.y + 0.9}`);
    await step(page, 3);
    await expect(overlay(page)).toHaveAttribute('data-fire', 'out');
    // Hild may still be passing the ring on her way to her place (her talk is then the nearer
    // use): wait, in game time, until the fire is the nearest thing to hand.
    await stepUntil(page, 'prompt', (p) => p === 'task_light_fire', 60);
    await expect(overlay(page)).toHaveAttribute('data-prompt', 'task_light_fire');
    const before = minutes(await attr(page, 'clock'));
    await page.keyboard.press('KeyE');
    await step(page, 1);
    await expect(overlay(page)).toHaveAttribute('data-work', 'TASK_LIGHT_FIRE');
    await expect(overlay(page)).toHaveAttribute('data-work-loop', 'kneel');
    // A plain action (decision PT-1): no timing ring and no press asked for.
    await expect(overlay(page)).toHaveAttribute('data-timing-ring', 'false');
    await expect(overlay(page)).not.toHaveAttribute('data-prompt', 'timing');
    // The loop's frames advance while the work goes on.
    const frames = new Set<string>();
    for (let i = 0; i < 12; i++) {
      frames.add(await attr(page, 'steerer-frame'));
      await step(page, 1);
    }
    expect([...frames].every((f) => f.startsWith('kneel/'))).toBe(true);
    expect(frames.size).toBeGreaterThan(2);
    await stepUntil(page, 'work', (w) => w === '', 40);
    await expect(overlay(page)).toHaveAttribute('data-fire', 'lit');
    // Book 10 section 09: lighting a fire takes ten minutes.
    expect(minutes(await attr(page, 'clock')) - before).toBeGreaterThanOrEqual(10);
  });

  test('picks up driftwood where it lies on the strand: a stoop, no ring, its load at once', async ({
    page,
  }) => {
    // Decision PT-2: a piece by the rocks at the east end, the steerer just below it.
    const piece = site('drift_east_rocks');
    await startPlay(
      page,
      'A',
      `capture&camp=broch&time=10:00&wood=0&zone=ZONE_SK_STRAND&at=${piece.x},${piece.y + 0.8}`,
    );
    await step(page, 3);
    await expect(overlay(page)).toHaveAttribute('data-zone', 'ZONE_SK_STRAND');
    await expect(overlay(page)).toHaveAttribute('data-prompt', 'task_gather_driftwood');
    const lying = Number(await attr(page, 'driftwood'));
    expect(lying).toBeGreaterThan(0);
    expect(Number(await attr(page, 'wood'))).toBe(0);
    await page.keyboard.press('KeyE');
    await step(page, 1);
    await expect(overlay(page)).toHaveAttribute('data-work', 'TASK_GATHER_DRIFTWOOD');
    await expect(overlay(page)).toHaveAttribute('data-work-loop', 'gather');
    await expect(overlay(page)).toHaveAttribute('data-timing-ring', 'false');
    await expect(overlay(page)).not.toHaveAttribute('data-prompt', 'timing');
    // The stoop is short (Book 10: 0.8 s): done within a second or two of stepped play.
    expect(await stepUntil(page, 'work', (w) => w === '', 20)).toBe('');
    expect(Number(await attr(page, 'wood'))).toBeCloseTo(0.5, 2);
    expect(Number(await attr(page, 'driftwood'))).toBe(lying - 1);
  });

  test('sleeps after 18:00 to dawn, and the morning report is written in sentences', async ({
    page,
  }) => {
    const bed = site('bed_s0');
    await startPlay(
      page,
      'A',
      `capture&camp=broch&time=20:00&fire=lit&wood=3&at=${bed.x},${bed.y + 0.6}`,
    );
    await step(page, 3);
    await expect(overlay(page)).toHaveAttribute('data-prompt', 'sleep');
    await page.keyboard.press('KeyE');
    await step(page, 1);
    await expect(overlay(page)).toHaveAttribute('data-sleeping', 'true');
    const report = await stepUntil(page, 'report', (r) => r !== '', (camp.sleepSeconds + 3) * 10);
    expect(report).not.toBe('');
    await expect(overlay(page)).toHaveAttribute('data-day', '2');
    expect(minutes(await attr(page, 'clock'))).toBeGreaterThanOrEqual(6 * 60);
    expect(minutes(await attr(page, 'clock'))).toBeLessThan(7 * 60);
    // Every line is a sentence: a capital, words, and a full stop.
    for (const line of report.split('|')) expect(line).toMatch(/^[A-Z][^|]*[.!]$/);
    await expect(page.locator('[data-region=report]')).toBeVisible();
    await page.keyboard.press('Escape');
    await step(page, 1);
    await expect(overlay(page)).toHaveAttribute('data-report', '');
  });

  test('the fire lights the night: a warm pool round it', async ({ page }) => {
    await startPlay(page, 'A', 'capture&camp=broch&time=23:00&fire=lit');
    await step(page, 3);
    await expect(overlay(page)).toHaveAttribute('data-light', 'night');
    await expect(overlay(page)).toHaveAttribute('data-fire', 'lit');
    await expect(overlay(page)).toHaveAttribute('data-pools', '1');
  });
});
