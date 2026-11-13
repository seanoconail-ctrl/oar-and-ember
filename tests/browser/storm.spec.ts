/**
 * The storm opening in the browser, design addendum 2.5 section 3 (Book 7 section 05; Book 10
 * section 25, "The storm"; decisions DF-15 to DF-17):
 *
 * - stepped a tick at a time through the cold open (DE-81: undrawn but the last), the storm as the
 *   page draws it: the lightning's double flicker, never more than two flashes in a second, thunder
 *   0.6 to 3 s after each flash, the camera's sway in whole pixels within 3 px and 2 px, the bow
 *   pitching within 4 px, the hull through its three roll frames, the rain and the mist;
 * - with the camera held still, at least 80% of the screen keeps moving (Book 7 section 14), and
 *   the script's share of a frame stays within the Book 2 budget (measured in real time).
 */
import { expect, test } from '@playwright/test';
import { MOTION_THRESHOLD, continuousMotion } from '../../src/tools/art/motion.ts';
import { decodePng } from '../../src/tools/art/png.ts';
import { reportPageErrors, startPlay } from './strand.ts';

interface Storm {
  t: number;
  flash: number;
  sway: [number, number];
  bow: number;
  roll: string;
  drops: number;
  mist: number;
  strikes: [number, number][];
  heard: [number, number][];
}

test('the storm: lightning and thunder, the sway, the pitch and the roll, rain and mist', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await startPlay(page, 'A', 'opening=full&capture');
  // Every tick of the cold open to the strike, read as the page draws it.
  const frames = await page.evaluate(() => {
    const w = window as unknown as { oeStep: (ms: number, draw?: boolean) => void };
    const o = document.querySelector('.oe-overlay');
    const out: string[] = [];
    for (let i = 0; i < 60 * 31.5; i++) {
      w.oeStep(1000 / 60, false);
      out.push(o?.getAttribute('data-storm') ?? '');
    }
    w.oeStep(0);
    return out;
  });
  // One reading a tick (a frame of 1/60 s can step none or two ticks of the fixed step).
  const storm = frames
    .filter((f) => f !== '')
    .map((f) => JSON.parse(f) as Storm)
    .filter((s, i, all) => i === 0 || s.t !== all[i - 1]?.t);
  expect(storm.length).toBeGreaterThan(60 * 29);
  const last = storm[storm.length - 1];
  if (last === undefined) throw new Error('no storm');
  // Lightning: one scripted strike about 25 s in; each a double flicker.
  expect(last.strikes.map(([at]) => at)).toContain(25);
  const onsets: number[] = [];
  let prev = 0;
  for (const s of storm) {
    if (s.flash >= 0.99 && prev < 0.99) onsets.push(s.t);
    prev = s.flash;
  }
  expect(onsets.length).toBe(last.strikes.length * 2);
  for (const t of onsets)
    expect(onsets.filter((u) => u >= t && u < t + 1).length).toBeLessThanOrEqual(2);
  // The scripted strike's ticks: bright 4, dim 3, bright 3.
  const at25 = storm.filter((s) => s.t >= 25 && s.t < 25 + 10 / 60 + 1e-6).map((s) => s.flash);
  expect(
    at25
      .slice(0, 10)
      .map((v) => (v >= 0.99 ? 'B' : v > 0 ? 'd' : '.'))
      .join(''),
  ).toBe('BBBBdddBBB');
  // Thunder after every flash before the strike, 0.6 to 3 s later.
  const heard = last.heard;
  expect(heard.length).toBe(last.strikes.filter(([, th]) => th <= last.t).length);
  for (const [flash, thunder] of heard) {
    expect(thunder - flash).toBeGreaterThanOrEqual(0.6);
    expect(thunder - flash).toBeLessThanOrEqual(3);
  }
  // The camera's sway: whole pixels, 3 px up and down, 2 px sideways.
  const sx = storm.map((s) => s.sway[0]);
  const sy = storm.map((s) => s.sway[1]);
  expect(sx.every((v) => Number.isInteger(v) && Math.abs(v) <= 2)).toBe(true);
  expect(sy.every((v) => Number.isInteger(v) && Math.abs(v) <= 3)).toBe(true);
  expect(Math.max(...sx.map(Math.abs))).toBe(2);
  expect(Math.max(...sy.map(Math.abs))).toBe(3);
  // The bow pitching up to 4 px, and the hull through its three roll frames.
  const bows = storm.map((s) => s.bow);
  expect(Math.max(...bows)).toBeGreaterThan(3.5);
  expect(Math.min(...bows)).toBeLessThan(-3.5);
  expect(Math.max(...bows.map(Math.abs))).toBeLessThanOrEqual(4);
  expect(new Set(storm.map((s) => s.roll))).toEqual(new Set(['port', 'level', 'starboard']));
  // Rain and mist all the while.
  expect(storm.every((s) => s.drops >= 80 && s.drops <= 120)).toBe(true);
  expect(storm.every((s) => s.mist > 0)).toBe(true);
});

test.describe('the storm against the Book 7 standard', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'measured in Chromium');

  test(`with the camera still, ${MOTION_THRESHOLD * 100}% of the cold open keeps moving, within the frame budget`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    reportPageErrors(page);
    await page.setViewportSize({ width: 640, height: 360 });
    await page.goto('./?quality=full&view=play&opening=full&camera=still&name=Ash&body=A');
    await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'play', {
      timeout: 15_000,
    });
    await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
    // The first frames upload the storm's atlases and compile the full-detail shaders as detail
    // steps up; the smoothed share is read once that has settled, still in the cold open.
    await page.waitForTimeout(7000);
    // The script's share of a frame, smoothed (Book 2 budget).
    const ms = Number(await page.locator('.oe-overlay').getAttribute('data-frame-ms'));
    console.log(`cold open, script per frame: ${ms.toFixed(2)} ms`);
    expect(await page.locator('.oe-overlay').getAttribute('data-phase')).toBe('COLD_OPEN');
    const shots: Uint8Array[] = [];
    for (let i = 0; i < 33; i++) {
      shots.push(decodePng(await page.screenshot()).data);
      await page.waitForTimeout(120);
    }
    const share = continuousMotion(shots, 640, 360).share;
    console.log(`cold open, continuous motion: ${(share * 100).toFixed(1)}%`);
    expect(share).toBeGreaterThanOrEqual(MOTION_THRESHOLD);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(5.5);
  });
});
