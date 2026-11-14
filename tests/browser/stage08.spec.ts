/**
 * Stage 8 in the browser (Book 3 Stage 8): Hild at work and always doing something, a
 * conversation with her about her wound in its panel (and tending it from there), barks as
 * subtitles in her voice, and Oddi's food-theft scene in a seeded world with Oddi (`oddi=theft`).
 *
 * Every test plays stepped (`capture`: the page advances only when stepped, by `oeStep`), and starts
 * at the broch through the camp hooks (`camp=broch`, `time=HH:MM`, `at=x,y`, ...; src/scenes/camp.ts).
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { attr, overlay, startPlay } from './strand.ts';

const camp = JSON.parse(readFileSync('content/camp.json', 'utf8')) as {
  sites: { key: string; x: number; y: number }[];
  people: { C_HILD: { camp: { x: number; y: number } } };
};
const fire = camp.sites.find((s) => s.key === 'fire') ?? { x: 35.4, y: 31.6 };
const seat = camp.people.C_HILD.camp;

async function step(page: Page, frames = 1, ms = 100): Promise<void> {
  await page.evaluate(
    ([n, d]) => {
      const w = window as unknown as { oeStep: (ms: number, draw?: boolean) => void };
      for (let i = 0; i < n; i++) w.oeStep(d, i === n - 1);
    },
    [frames, ms] as const,
  );
}

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

test.describe('Stage 8: crew agents, schedules and conversation', () => {
  test.setTimeout(180_000);

  test('Hild goes to her work from the camp at once, and is always doing something', async ({
    page,
  }) => {
    // Just after she has shown the camp (the hooks): it is work time, and her leg is not yet tended.
    await startPlay(page, 'A', 'capture&camp=broch&time=08:00&at=35.5,33.6');
    await step(page, 3);
    expect(await attr(page, 'hild-activity')).toBe('WORK');
    // She walks down to the rocks below the path, and works there with the fishing loop.
    await page.keyboard.down('KeyS');
    const zone = await stepUntil(page, 'zone', (z) => z === 'ZONE_SK_STRAND', 120, 250);
    await page.keyboard.up('KeyS');
    expect(zone).toBe('ZONE_SK_STRAND');
    const state = await stepUntil(page, 'hild-state', (s) => s === 'work:fish', 200, 250);
    expect(state).toBe('work:fish');
    // Every frame for the next few game hours, she is doing something: never idle and still.
    for (let i = 0; i < 40; i++) {
      await step(page, 4, 250);
      expect(await attr(page, 'hild-activity')).not.toBe('');
      const s = await attr(page, 'hild-state');
      expect(['work:fish', 'idle', 'sit', 'eat', 'watch', 'sleep', '']).toContain(s);
    }
  });

  test('talking to wounded Hild offers her wound, and tends it from the talk', async ({ page }) => {
    await startPlay(page, 'A', `capture&camp=broch&time=18:40&at=${seat.x + 0.9},${seat.y}`);
    await step(page, 3);
    await expect(overlay(page)).toHaveAttribute('data-prompt', 'talk');
    await page.keyboard.press('KeyE');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-talk', 'C_HILD');
    const options = (await attr(page, 'talk-options')).split('|');
    expect(options[0]).toBe('ui.talk.topic.wound');
    await expect(page.locator('[data-region=talk]')).toContainText('Your wound');
    // The panel names who it is with; time goes on while it is open.
    await expect(page.locator('[data-region=talk]')).toContainText('Talking with Hild');
    const clock = await attr(page, 'clock');
    await page.keyboard.press('Digit1');
    await step(page, 2);
    expect(await attr(page, 'talk-line')).toBe('c_hild.talk.wound.01');
    await expect(page.locator('[data-region=captions]')).toContainText('Hild:');
    await page.keyboard.press('Digit1');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-talk', '');
    await expect(overlay(page)).toHaveAttribute('data-work', 'TASK_CARE');
    await stepUntil(page, 'work', (w) => w === '', 60);
    expect(await attr(page, 'clock')).not.toBe(clock);
  });

  test('barks appear as subtitles, in earshot', async ({ page }) => {
    await startPlay(
      page,
      'A',
      `capture&camp=broch&time=18:30&fire=lit&tended=1&at=${fire.x + 1.5},${fire.y + 0.8}`,
    );
    await step(page, 3);
    // Book 10 idleBarkEvery: within 150 real seconds of play, a bark, shown as she speaks it.
    let heard = 0;
    for (let i = 0; i < 160 && heard === 0; i++) {
      await step(page, 4, 250);
      heard = Number(await attr(page, 'barks'));
    }
    expect(heard).toBeGreaterThan(0);
    await expect(page.locator('[data-region=captions]')).toContainText('Hild:');
  });

  test("Oddi's hidden food is found at the fire, and judged", async ({ page }) => {
    await startPlay(
      page,
      'A',
      `capture&camp=broch&time=20:25&fire=lit&tended=1&oddi=theft&at=${fire.x + 0.8},${fire.y + 1.0}`,
    );
    await step(page, 3);
    expect((await attr(page, 'residents')).split(',')).toContain('C_ODDI');
    const kind = await stepUntil(page, 'talk-kind', (k) => k === 'SCENE', 200, 250);
    expect(kind).toBe('SCENE');
    await expect(page.locator('[data-region=talk]')).toContainText('At the fire');
    // The finding, Oddi's word and Hild's, then the steerer's choices.
    const options = await stepUntil(page, 'talk-options', (o) => o !== '', 80, 250);
    expect(options.split('|')).toContain('p_steerer.scene.theft.fair');
    await expect(page.locator('[data-region=talk]')).toContainText('keep the tally');
    await page.keyboard.press('Digit1');
    await step(page, 2);
    expect(await attr(page, 'scene')).toBe('FAIR');
    const done = await stepUntil(page, 'talk', (t) => t === '', 80, 250);
    expect(done).toBe('');
  });
});
