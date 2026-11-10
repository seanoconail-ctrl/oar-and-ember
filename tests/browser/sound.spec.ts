/**
 * The sound test page (Book 11 audio standard, step 1): it loads in every browser, and in
 * Chromium every item is rendered offline and measured, so the checks need no speaker:
 * - nothing is silent and nothing clips;
 * - the hearth theme loops with no gap at the seam;
 * - the raid's alarm lands on the bar line after it is raised, not before.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface Result {
  peak: number;
  rms: number;
  perSecond: number[];
}

async function render(
  page: Page,
  item: string,
  seconds: number,
  settings: object = {},
): Promise<Result> {
  return page.evaluate(
    async ([i, s, st]) => {
      const w = window as unknown as {
        oeSound: { render: (i: string, s: number, st: unknown) => Promise<Result> };
      };
      return w.oeSound.render(i, s, st);
    },
    [item, seconds, settings] as const,
  );
}

async function open(page: Page): Promise<void> {
  await page.goto('./sound.html');
  await expect(page.locator('#sound')).toHaveAttribute('data-state', 'ready', { timeout: 15_000 });
}

test('the sound test page offers every item, with captions and sliders', async ({ page }) => {
  await open(page);
  for (const item of ['music:hearth', 'music:skarvholm', 'music:raid', 'ambience:strand'])
    await expect(page.locator(`[data-play="${item}"]`)).toHaveCount(1);
  await expect(page.locator('[data-layer]')).toHaveCount(6 + 6);
  await expect(page.locator('[data-variant]')).toHaveCount(2);
  await expect(page.locator('[data-alarm]')).toHaveCount(1);
  await expect(page.locator('[data-sound]')).toHaveCount(9);
  await expect(page.locator('[data-voice]')).toHaveCount(4);
  await expect(page.locator('[data-bus]')).toHaveCount(6);
  await expect(page.locator('[data-mono]')).toHaveCount(1);
  await expect(page.locator('[data-wind]')).toHaveCount(1);
  await expect(page.locator('[data-tide]')).toHaveCount(1);
  // A sound's caption appears when it plays.
  await page.locator('[data-sound="SFX_PARRY"]').click();
  await expect(page.locator('#captions')).toContainText('Parry');
});

test.describe('rendered offline', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'rendered in Chromium');
  test.setTimeout(180_000);

  test('every item sounds, and nothing clips', async ({ page }) => {
    await open(page);
    const items = await page.evaluate(
      () => (window as unknown as { oeSound: { items: string[] } }).oeSound.items,
    );
    expect(items.length).toBe(17);
    for (const item of items) {
      const seconds = item.startsWith('music') || item.startsWith('ambience') ? 12 : 6;
      const r = await render(page, item, seconds);
      expect(r.peak, item).toBeLessThan(0.99);
      expect(r.rms, item).toBeGreaterThan(0.004);
    }
  });

  test('the hearth theme loops without a gap', async ({ page }) => {
    await open(page);
    // One pass is 16 bars of 6/8 at 54 dotted crotchets a minute: 35.6 seconds.
    const r = await render(page, 'music:hearth', 42);
    const seam = r.perSecond.slice(34, 38);
    const body = r.perSecond.slice(4, 34);
    const median = [...body].sort((a, b) => a - b)[Math.floor(body.length / 2)] ?? 0;
    for (const v of seam) expect(v).toBeGreaterThan(median * 0.3);
  });

  test('the alarm comes in on the bar line after it is raised', async ({ page }) => {
    await open(page);
    // Raised half-way through bar 4 (a bar is 2.857 s at 84 beats a minute), it lands at bar 5.
    const r = await render(page, 'music:raid', 20, {
      change: { atBar: 4, layers: { alarm: true, calm: false } },
    });
    const bar = (4 * 60) / 84;
    const before = r.perSecond.slice(1, Math.floor(bar * 4) - 1);
    const after = r.perSecond.slice(Math.ceil(bar * 4) + 1, 19);
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(after)).toBeGreaterThan(mean(before) * 1.25);
    // Still calm in the half-bar after it was raised: nothing lands before the bar line.
    const raised = Math.floor(bar * 3.5);
    expect(r.perSecond[raised + 1] ?? 0).toBeLessThan(mean(after));
  });
});
