/**
 * Stage 13 in the browser (Book 3 Stage 13; Book 2 section 09; Book 7 sections 05, 10 and 14): the
 * sea map's plotting and voyage screen. From the island the map key opens the chart, which holds
 * time (a planning screen under the safe rule); a place picked shows its painted course, watches,
 * landfall and stores; refusals are said in words; setting sail starts the Carrick raid's gate;
 * the watches pass one per Book 10 seaWatchAnimSeconds with the token sailing and the clock running
 * on; the rising weather's choice holds the watches until it is answered; the landing at Carrick is
 * a stub that says the boat beaches, handed back to the voyage; and turning for home brings the
 * steerer back to the island. The chart keeps moving with the camera still, with and without
 * reduced motion.
 *
 * Every test plays stepped (`capture`). `camp=broch&crew=1&launch=done` starts in Chapter 2 with the
 * boat launched and drawn up (src/scenes/camp.ts), `weather=` sets today's weather at sea.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  MOTION_THRESHOLD,
  REDUCED_MOTION_THRESHOLD,
  continuousMotion,
} from '../../src/tools/art/motion.ts';
import { decodePng } from '../../src/tools/art/png.ts';
import { attr, reportPageErrors, startPlay, step, stepUntil } from './strand.ts';

const AT = 'capture&camp=broch&crew=1&launch=done&time=10:00&zone=ZONE_SK_STRAND';
/** Book 10 section 02: seaWatchAnimSeconds (4) and a watch of 6 game hours. */
const WATCH_SECONDS = 4;
const WATCH_MINUTES = 360;

async function minuteNow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = (window as unknown as { oeWorld: { calendar: { day: number; minuteOfDay: number } } })
      .oeWorld;
    return (w.calendar.day - 1) * 1440 + w.calendar.minuteOfDay;
  });
}

async function openChart(page: Page): Promise<void> {
  await step(page, 3);
  await page.keyboard.press('KeyM');
  await step(page, 2);
  await expect(page.locator('[data-panel=plot]')).toBeVisible();
}

/** Steps through the voyage until the chart shows `screen`, answering the wreck's stub on the way. */
async function sailUntil(page: Page, screen: string, seconds = 60): Promise<void> {
  for (let i = 0; i < seconds; i++) {
    await stepUntil(page, 'sea', new RegExp(`^(${screen}|landing|choice)$`), 1);
    const now = await attr(page, 'sea');
    if (now === screen) return;
    if (now === 'choice') {
      await page.keyboard.press('Digit1');
      await step(page, 2);
    } else if (now === 'landing' && screen !== 'landing') {
      // An interruption met on the way (the wreck) whose scene is not in place: sail on.
      await page.locator('[data-panel=landing] [data-action=stay]').click();
      await step(page, 2);
    } else if (now === 'landing') {
      return;
    }
  }
}

test.describe('Stage 13: sea-map travel and voyage events', () => {
  test.setTimeout(240_000);

  test('plotting a route: the course painted, its watches, landfall and stores, with time held', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${AT}&weather=clear`);
    await openChart(page);
    expect(await attr(page, 'sea')).toBe('plot');
    expect(await attr(page, 'menu')).toBe('map');
    // The weather in words beside its marks.
    await expect(page.locator('[data-words=wind]')).toContainText('Wind from the south-west');
    await expect(page.locator('[data-words=tide]')).toContainText(
      /Tide (flooding|ebbing)|Slack water/,
    );
    await expect(page.locator('[data-words=vis]')).toHaveText('Clear');
    await expect(page.locator('[data-words=forecast]')).toContainText('Tomorrow');
    const tick = await attr(page, 'tick');
    await step(page, 10);
    expect(await attr(page, 'tick')).toBe(tick);
    await page.locator('[data-panel=plot] [data-place=SITE_CARRICK]').click();
    await step(page, 2);
    const plot = page.locator('[data-panel=plot]');
    await expect(plot).toContainText('Skarvholm to Carrick Landing.');
    await expect(plot).toContainText(
      /At sea about \d watch(es)?; landfall about \d\d:\d\d on day \d/,
    );
    await expect(plot).toContainText(/Stores aboard: .* for 5\. The course eats about/);
    await expect(plot).toContainText('begins the raid on Carrick Landing');
    await expect(plot.locator('[data-action=sail]')).toBeEnabled();
    // No internal ID on screen.
    const text = await page.locator('[data-region=seamap]').innerText();
    expect(text).not.toMatch(/\b[A-Z]{2,}_[A-Z0-9_]+\b|\b[a-z]+\.[a-z_]+\.[a-z_]+\b/);
    // The token lies off Skarvholm with its sail furled.
    expect(await attr(page, 'sea-token')).toMatch(/,furled$/);
  });

  test('refusals in words: inland, and no known route', async ({ page }) => {
    await startPlay(page, 'A', `${AT}&weather=clear&dev`);
    await openChart(page);
    // The developer menu's chart (F3): every route and place known.
    await page.keyboard.press('F3');
    await step(page, 2);
    await page.locator('[data-panel=plot] [data-action=dev-chart]').click();
    await step(page, 3);
    await openChart(page);
    await page.locator('[data-panel=plot] [data-place=TOWN_ARDCARN]').click();
    await step(page, 2);
    await expect(page.locator('[data-panel=plot] .refusal')).toHaveText(
      'That place lies inland, out of reach of any boat.',
    );
    await expect(page.locator('[data-panel=plot] [data-action=sail]')).toBeDisabled();
    // Every edge can be chosen from the developer menu, from where the boat lies.
    await expect(page.locator('[data-panel=plot] [data-edge]')).toHaveCount(14);
    await page.locator('[data-panel=plot] [data-edge=SEA_SKARV_CAULDRON]').click();
    await step(page, 2);
    expect(await attr(page, 'sea-chosen')).toBe('GLEN_ARRA');
    await expect(page.locator('[data-panel=plot] .course')).toContainText('Glen Arra');
  });

  test('the choice holds the watches; a watch passes the clock six hours as the token sails', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${AT}&weather=rising`);
    await openChart(page);
    await page.locator('[data-panel=plot] [data-place=SITE_CARRICK]').click();
    await step(page, 2);
    await page.keyboard.press('KeyE');
    await stepUntil(page, 'sea', 'choice', 5);
    expect(await attr(page, 'sea')).toBe('choice');
    expect(await attr(page, 'gate')).not.toBe('');
    const choice = page.locator('[data-panel=choice]');
    await expect(choice).toContainText('The weather is rising.');
    await expect(choice.locator('[data-option=PRESS_ON]')).toContainText(
      /Cross now: .* Landfall about/,
    );
    await expect(choice.locator('[data-option=SHELTER]')).toContainText(/Wait here until 06:00/);
    await expect(choice).toContainText('The watches wait while you choose.');
    // Real time, no tactical pause, but the choice is a planning screen: the clock waits for it.
    const held = await minuteNow(page);
    await step(page, (WATCH_SECONDS * 1000 * 2) / 100);
    expect(await minuteNow(page)).toBe(held);
    expect(await attr(page, 'sea-watches')).toBe('0');
    await page.keyboard.press('Digit1');
    await stepUntil(page, 'sea-watches', '1', WATCH_SECONDS + 1);
    const after = await minuteNow(page);
    expect(after - held).toBeGreaterThan(0);
    expect(after - held).toBeLessThanOrEqual(WATCH_MINUTES);
    // The token sails the watch over its seconds, and the next watch follows.
    const t0 = await attr(page, 'sea-token');
    await step(page, (WATCH_SECONDS * 1000) / 2 / 100);
    const t1 = await attr(page, 'sea-token');
    expect(t1).not.toBe(t0);
    await stepUntil(page, 'sea-watches', /^[2-9]$/, WATCH_SECONDS + 2);
    expect(Number(await attr(page, 'sea-watches'))).toBeGreaterThanOrEqual(2);
  });

  test('the landing at Carrick is a stub handed back, and turning for home returns to the island', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${AT}&weather=clear`);
    await openChart(page);
    await page.locator('[data-panel=plot] [data-place=SITE_CARRICK]').click();
    await step(page, 2);
    await page.locator('[data-panel=plot] [data-action=sail]').click();
    await step(page, 2);
    expect(await attr(page, 'saves')).toMatch(/autosave/);
    await sailUntil(page, 'landing');
    const landing = page.locator('[data-panel=landing]');
    await expect(landing).toContainText('runs up on the shingle at Carrick Landing');
    expect(await attr(page, 'sea-at')).toBe('SITE_CARRICK');
    // The handoff returned: the boat lies at the landing, and a new course can be set.
    await landing.locator('[data-action=stay]').click();
    await step(page, 2);
    expect(await attr(page, 'sea')).toBe('anchored');
    await page.locator('[data-panel=plot] [data-place=ABBEY_KILBRECC]').click();
    await step(page, 2);
    await expect(page.locator('[data-panel=plot] .refusal')).toContainText(
      'No route you know leads there.',
    );
    await page.locator('[data-panel=plot] [data-action=home]').click();
    await sailUntil(page, '', 60);
    expect(await attr(page, 'sea')).toBe('');
    const zone = await page.evaluate(
      () =>
        (window as unknown as { oeWorld: { onFoot: { zone: string } | null } }).oeWorld.onFoot
          ?.zone,
    );
    expect(zone).toBe('ZONE_SK_STRAND');
  });
});

async function chartMotion(page: Page, query: string): Promise<number> {
  reportPageErrors(page);
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`./?view=play&name=Ash&body=A&${query}`);
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'play', {
    timeout: 15_000,
  });
  await openChart(page);
  // The words are interface, not the chart: hidden for the measure.
  await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
  const shots: Uint8Array[] = [];
  for (let i = 0; i < 41; i++) {
    await step(page, 1, 160);
    shots.push(decodePng(await page.screenshot()).data);
  }
  return continuousMotion(shots, 640, 360).share;
}

test.describe('the Book 7 standard on the chart', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'measured in Chromium');
  test.setTimeout(180_000);

  for (const weather of ['clear', 'fog', 'storm']) {
    test(`with the camera still, at least ${MOTION_THRESHOLD * 100}% of the chart moves (${weather})`, async ({
      page,
    }) => {
      const share = await chartMotion(page, `${AT}&weather=${weather}&quality=full`);
      console.log(`chart motion (${weather}): ${(share * 100).toFixed(1)}%`);
      expect(share).toBeGreaterThanOrEqual(MOTION_THRESHOLD);
    });
  }

  test('with reduced motion the chart still moves', async ({ page }) => {
    const share = await chartMotion(page, `${AT}&weather=fog&motion=reduced`);
    console.log(`chart motion, reduced: ${(share * 100).toFixed(1)}%`);
    expect(await attr(page, 'motion')).toBe('reduced');
    expect(share).toBeGreaterThanOrEqual(REDUCED_MOTION_THRESHOLD);
  });
});
