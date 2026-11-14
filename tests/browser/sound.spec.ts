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
  steps?: { rms: number; peak: number; centroid: number; riseMs: number }[];
  likeness?: number[];
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
  for (const item of [
    'music:hearth',
    'music:skarvholm',
    'music:raid',
    'ambience:strand',
    'ambience:hearth',
  ])
    await expect(page.locator(`[data-play="${item}"]`)).toHaveCount(1);
  await expect(page.locator('[data-layer]')).toHaveCount(6 + 6);
  await expect(page.locator('[data-variant]')).toHaveCount(2);
  await expect(page.locator('[data-alarm]')).toHaveCount(1);
  // Starting weapons and missiles add eight: the arrow in flight and its five strikes, the empty
  // quiver and a pickup. Combat v2 adds ten (design addendum 2.4): the steerer's breath, the
  // grunt, the parry's ring, the riposte, the lunge, the backstab, the sidestep, the alert, binding
  // a wound and eating. Committed combat adds seven (design addendum 2.5): the three tells by
  // weight, the steerer's tell, exhausted breathing, a sidearm drawn and a shield split; and four
  // for commitment (DF-83): the parry's rasp, the block's creak, the dodge's landing, the whiff.
  // The user's third playtest adds the pause menu's click (DG-88), and four for the combat (DG-29):
  // the finisher, the let-go, the guard turned and the red blow's scrape.
  await expect(page.locator('[data-sound]')).toHaveCount(9 + 3 + 3 + 8 + 10 + 7 + 4 + 1 + 4);
  await expect(page.locator('[data-voice]')).toHaveCount(4);
  await expect(page.locator('[data-step]')).toHaveCount(6);
  await expect(page.locator('[data-step-all]')).toHaveCount(1);
  await expect(page.locator('[data-gait]')).toHaveCount(1);
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
    // The Stage 6 rework adds three: the wading splash, the bow's draw and its loose. Starting
    // weapons and missiles add eight: the arrow's flight, its strikes into wood, a shield, earth,
    // stone and water, the empty quiver and a pickup.
    expect(items.length).toBe(17 + 6 + 3 + 3 + 1 + 8);
    for (const item of items) {
      const seconds = item.startsWith('music') || item.startsWith('ambience') ? 12 : 6;
      const r = await render(page, item, seconds);
      expect(r.peak, item).toBeLessThan(0.99);
      // Footsteps are quiet by design (decision AU-10), so they have their own floor.
      expect(r.rms, item).toBeGreaterThan(item.startsWith('step') ? 0.001 : 0.004);
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

  // Stage 13 (decisions S13-60 to S13-74): the sea's three pieces loop without a gap at the
  // seam (a pass is 16 bars of 4/4 at 64 beats a minute: 60 s), and every sea item sounds.
  test('the sea music loops without a gap in each of its forms, and every sea item sounds', async ({
    page,
  }) => {
    await open(page);
    const layers = await page.evaluate(
      () =>
        (
          window as unknown as {
            oeSound: { seaPieces: [string, Record<string, boolean>][] };
          }
        ).oeSound.seaPieces,
    );
    expect(layers.map(([id]) => id)).toEqual(['MUS_SEA_CALM', 'MUS_SEA_WIND', 'MUS_SEA_STORM']);
    for (const [id, on] of layers) {
      const r = await render(page, 'music:sea', 64, { layers: on });
      const body = r.perSecond.slice(4, 58);
      const median = [...body].sort((a, b) => a - b)[Math.floor(body.length / 2)] ?? 0;
      for (const v of r.perSecond.slice(58, 63)) expect(v, id).toBeGreaterThan(median * 0.3);
      expect(r.peak, id).toBeLessThan(0.99);
      // Music sits about -21 to -24 dBFS (Book 11 section 09); allow a decibel either side.
      const db = 20 * Math.log10(r.rms);
      expect(db, id).toBeGreaterThan(-25);
      expect(db, id).toBeLessThan(-20);
    }
    const items = await page.evaluate(
      () => (window as unknown as { oeSound: { seaItems: string[] } }).oeSound.seaItems,
    );
    expect(items.length).toBe(1 + 4 + 1 + 7 + 3);
    for (const item of items.filter((i) => i !== 'music:sea')) {
      const r = await render(page, item, item.startsWith('sea:SFX') ? 5 : 12);
      expect(r.peak, item).toBeLessThan(0.99);
      expect(r.rms, item).toBeGreaterThan(0.004);
    }
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

  // Decision AU-10: footsteps soft, low and dull, no click, varied, and below the effects.
  test('footsteps are soft, dull, varied and below the effects that matter', async ({ page }) => {
    await open(page);
    const hit = await render(page, 'sfx:SFX_HIT_LIGHT', 2);
    const brightest: Record<string, number> = {
      grass: 1300,
      sand: 1300,
      wet_sand: 1100,
      rock: 1300,
      shingle: 2300,
      water: 1900,
    };
    for (const [surface, maxCentroid] of Object.entries(brightest)) {
      for (const gait of ['walk', 'run']) {
        const r = await render(page, `step:${surface}`, 6, { steps: 10, gait });
        const steps = r.steps ?? [];
        expect(steps.length).toBe(10);
        for (const step of steps) {
          // No sharp click: each step takes at least 2 ms to rise.
          expect(step.riseMs, `${surface} ${gait} rise`).toBeGreaterThanOrEqual(2);
          // Low and dull.
          expect(step.centroid, `${surface} ${gait} centroid`).toBeLessThan(maxCentroid);
          // Quieter than a light hit by at least 10 dB.
          expect(20 * Math.log10(step.peak / hit.peak), `${surface} ${gait} level`).toBeLessThan(
            -10,
          );
        }
        // No two steps the same.
        for (const l of r.likeness ?? [])
          expect(l, `${surface} ${gait} likeness`).toBeLessThan(0.9);
        console.log(
          `${surface} ${gait}: centroid ${Math.round(Math.max(...steps.map((x) => x.centroid)))} Hz, ` +
            `rise ${Math.min(...steps.map((x) => x.riseMs)).toFixed(1)} ms, ` +
            `level ${(20 * Math.log10(Math.max(...steps.map((x) => x.peak)) / hit.peak)).toFixed(1)} dB, ` +
            `likeness ${Math.max(...(r.likeness ?? [0])).toFixed(2)}`,
        );
      }
    }
  });
});
