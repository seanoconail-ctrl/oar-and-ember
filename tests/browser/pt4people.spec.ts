/**
 * The user's fourth playtest's people in the browser (requests 9 to 14; decisions DH-40 to DH-66):
 * the boat's workers spread round it and its drawing stepping on as they work, Runa refusing a
 * binding in the talk panel, the household's talk among themselves as speech lines, a nudge, and
 * the household keeping its own hours when the steerer lies down.
 *
 * Every test plays stepped (`capture`, `window.oeStep`) from the camp hooks (src/scenes/camp.ts);
 * a moment is staged through the page's world (`window.oeWorld`), as the captures do.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { attr, overlay, startPlay, step, stepUntil } from './strand.ts';

interface Who {
  id: string;
  activity: string;
  pose: string;
  zone: string;
  x: number;
  y: number;
}

/** data-people: each resident's activity, pose, zone and tile. */
async function people(page: Page): Promise<Who[]> {
  return (await attr(page, 'people'))
    .split('|')
    .filter((s) => s !== '')
    .map((s) => {
      const [id = '', activity = '', pose = '', where = ''] = s.split(':');
      const [zone = '', at = ''] = where.split('@');
      const [x = 'NaN', y = 'NaN'] = at.split(',');
      return { id, activity, pose, zone, x: Number(x), y: Number(y) };
    });
}

/** Puts the steerer beside a resident (staged through the page's world). */
async function besides(page: Page, id: string, dx = 0.9): Promise<void> {
  await page.evaluate(
    ([who, d]) => {
      const w = (
        window as unknown as {
          oeWorld: {
            onFoot: {
              player: { x: number; y: number };
              actors: Record<string, { x: number; y: number }>;
            };
          };
        }
      ).oeWorld.onFoot;
      const a = w.actors[who];
      if (a !== undefined) {
        w.player.x = a.x + d * 24;
        w.player.y = a.y;
      }
    },
    [id, dx] as const,
  );
  await step(page, 2);
}

/**
 * Talks to a resident: beside them, Interact, as a player does. The ground items lying at the
 * fire (the hand line, the bindings) are moved off first, so Interact is not taken by them.
 */
async function talkTo(page: Page, id: string): Promise<void> {
  await page.evaluate(() => {
    const w = (window as unknown as { oeWorld: { onFoot: { items: unknown[] } } }).oeWorld;
    w.onFoot.items = [];
  });
  await besides(page, id);
  await page.keyboard.press('KeyE');
  await step(page, 2);
}

test.describe("The fourth playtest's people (DH-40 to DH-66)", () => {
  test.setTimeout(240_000);

  test('boat workers spread round the boat, each at a spot of their own, and it changes as they work', async ({
    page,
  }) => {
    await startPlay(
      page,
      'A',
      'capture&camp=broch&crew=1&lay=boards&boatwork=all&hull=0.05&time=09:00&day=4&joined=2&zone=ZONE_SK_STRAND&at=42,31',
    );
    await step(page, 3);
    expect(await attr(page, 'boat')).toMatch(/^hull_wrecked/);
    // Everyone walks down to the boat.
    await stepUntil(
      page,
      'people',
      /^(?:[^|]*:WORK:(?:work|kneel|sit):ZONE_SK_STRAND@[^|]*\|?){4}$/,
      120,
    );
    const at = await people(page);
    expect(at.map((w) => w.activity)).toEqual(['WORK', 'WORK', 'WORK', 'WORK']);
    const tiles = at.map((w) => `${w.x},${w.y}`);
    expect(new Set(tiles).size).toBe(4);
    for (let i = 0; i < at.length; i++)
      for (let j = i + 1; j < at.length; j++) {
        const a = at[i];
        const b = at[j];
        if (a === undefined || b === undefined) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} and ${b.id}`).toBeGreaterThanOrEqual(1);
      }
    // Standing and kneeling at the work, not one loop for all.
    expect(new Set(at.map((w) => w.pose)).size).toBeGreaterThan(1);
    // The patch goes on: the hull's drawing steps on from as found to the trimmed holes.
    await stepUntil(page, 'boat', /^hull_trim/, 240);
    expect(await attr(page, 'boat')).toMatch(/^hull_trim/);
  });

  test('asked about the boat, Runa says what it needs next', async ({ page }) => {
    await startPlay(page, 'A', 'capture&camp=broch&crew=1&time=10:00&day=4&joined=2');
    await step(page, 3);
    await page.evaluate(() => {
      const w = (window as unknown as { oeWorld: { facts: Record<string, unknown> } }).oeWorld;
      w.facts['repair.open'] = true;
    });
    await talkTo(page, 'C_RUNA');
    await expect(overlay(page)).toHaveAttribute('data-talk', 'C_RUNA');
    const options = (await attr(page, 'talk-options')).split('|');
    expect(options).toContain('ui.talk.topic.boat');
    await page.keyboard.press(`Digit${String(options.indexOf('ui.talk.topic.boat') + 1)}`);
    await step(page, 3);
    expect(await attr(page, 'spoken')).toMatch(/c_runa\.boat\.boards/);
  });

  test('Runa refuses a binding, and lets it be done holding the end', async ({ page }) => {
    await startPlay(
      page,
      'A',
      'capture&camp=broch&crew=1&hurt=C_RUNA&fire=lit&tended=1&time=18:40&day=3&joined=2',
    );
    await step(page, 5);
    await talkTo(page, 'C_RUNA');
    await expect(overlay(page)).toHaveAttribute('data-talk', 'C_RUNA');
    let options = (await attr(page, 'talk-options')).split('|');
    await page.keyboard.press(`Digit${String(options.indexOf('ui.talk.topic.wound') + 1)}`);
    await step(page, 2);
    options = (await attr(page, 'talk-options')).split('|');
    await page.keyboard.press(`Digit${String(options.indexOf('p_steerer.talk.tend') + 1)}`);
    await step(page, 2);
    expect(await attr(page, 'spoken')).toMatch(/c_runa\.care\.refuse/);
    expect(await attr(page, 'work')).toBe('');
    options = (await attr(page, 'talk-options')).split('|');
    expect(options[0]).toBe('p_steerer.talk.care.hold_end');
    await page.keyboard.press('Digit1');
    await step(page, 2);
    expect(await attr(page, 'spoken')).toMatch(/c_runa\.care\.persuaded/);
    // Bound where she sits, still.
    expect(await attr(page, 'work')).toMatch(/TASK_CARE/);
    const before = (await people(page)).find((w) => w.id === 'C_RUNA');
    await step(page, 10);
    const during = (await people(page)).find((w) => w.id === 'C_RUNA');
    expect(during?.activity).toBe('TENDED');
    expect(during?.pose).toBe('sit');
    expect([during?.x, during?.y]).toEqual([before?.x, before?.y]);
  });

  test('the household talks among itself in the evening, as speech lines', async ({ page }) => {
    await startPlay(
      page,
      'A',
      'capture&camp=broch&crew=1&fire=lit&tended=1&time=18:30&day=3&joined=2',
    );
    await step(page, 3);
    await besides(page, 'C_BRAN', 1.2);
    await stepUntil(page, 'spoken', /\.chat\./, 120);
    const spoken = (await attr(page, 'spoken')).split('|');
    const line = spoken.find((k) => k.includes('.chat.')) ?? '';
    expect(line).toMatch(/^c_[a-z]+\.chat\.[a-z_]+\.1$/);
    // Shown as a speech line: "Name: words".
    expect(await attr(page, 'caption-speech')).toMatch(/^[A-Z][a-z]+: /);
  });

  test('a nudge towards the next person to find, in the speaker’s own voice', async ({ page }) => {
    await startPlay(page, 'A', 'capture&camp=broch&fire=lit&tended=1&time=08:00&day=2');
    await step(page, 3);
    await page.evaluate(() => {
      const w = (
        window as unknown as {
          oeWorld: { facts: Record<string, unknown>; homes: Record<string, { placed?: string[] }> };
        }
      ).oeWorld;
      w.facts['ch1.dusk_over'] = true;
      const home = w.homes['ISLE_SKARV'];
      if (home !== undefined) home.placed = ['ITEM_THORKEL_CHEST'];
    });
    await step(page, 2);
    expect(await attr(page, 'aim')).toBe('find_oddi');
    await besides(page, 'C_HILD');
    await stepUntil(page, 'spoken', /c_hild\.nudge\.find_oddi/, 60);
    expect(await attr(page, 'spoken')).toMatch(/c_hild\.nudge\.find_oddi/);
  });

  test('when the steerer lies down, the household keeps its own evening', async ({ page }) => {
    await startPlay(
      page,
      'A',
      'capture&camp=broch&crew=1&fire=lit&tended=1&time=18:40&day=3&joined=2&at=33.3,29.6',
    );
    await step(page, 3);
    await page.keyboard.press('KeyE');
    await step(page, 3);
    expect(await attr(page, 'sleeping')).toBe('true');
    // Lying down, nobody else is abed.
    for (const w of await people(page)) expect(w.activity, w.id).not.toBe('SLEEP');
  });
});
