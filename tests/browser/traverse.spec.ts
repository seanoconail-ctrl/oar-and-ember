/**
 * Stage 14 in the browser: the movement verbs (Book 2 section 10, "Movement verbs and hazards";
 * Book 3 Stage 14, acceptance check 5). Wreck Strand is given a test zone's marks for the run (a
 * climb up its rock outcrop, a crawl through it, a jump over the outcrop on the flats' edge, a
 * heavy stone on the shingle and swimming water in the western sea), by the zone file's own
 * `traverse` shape (src/content/traverseMarks.ts), and each verb is played with the keys: the
 * steerer climbs facing the rock and comes out at the head, crawls through and out the far side,
 * jumps with Interact, pushes the stone a tile, swims, and, empty in the water, starts to sink and
 * reaches the shallows. The frames drawn are the verbs' own.
 *
 * Every test plays stepped (`capture`): the page advances only when stepped (`oeStep`).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { TraverseMarks } from '../../src/content/traverseMarks.ts';
import { attr, startPlay, step, stepUntil } from './strand.ts';

const T = 24;
const ZONE = 'ZONE_SK_STRAND';

/** The test marks on Wreck Strand's outcrop (rows 35 to 37), shingle and western sea. */
const MARKS: TraverseMarks = {
  climbs: [{ id: 'test.outcrop', x: 38, foot: 38, head: 34, ledges: [] }],
  swims: [{ x: 0, y: 23, w: 21, h: 24 }],
  jumps: [{ id: 'test.rock', from: { x: 62, y: 35 }, to: { x: 64, y: 35 } }],
  crawls: [
    {
      id: 'test.cleft',
      tiles: [
        [39, 35],
        [39, 36],
        [39, 37],
      ],
    },
  ],
  pushes: [
    {
      id: 'test.stone',
      line: [
        [30, 26],
        [31, 26],
        [32, 26],
      ],
      start: 0,
      sheet: 'prop_boulder',
      frame: 'lichen/-/0',
    },
  ],
  soft: [],
};

/** Opens play on the strand at (x, y) in tiles, with the test marks on the zone. */
async function open(page: Page, x: number, y: number): Promise<void> {
  await startPlay(page, 'A', `capture&camp=broch&time=10:00&zone=${ZONE}&at=${x},${y}`);
  await page.evaluate(
    ({ zone, marks }) => {
      const w = window as unknown as {
        oePlay: { land: { maps: Map<string, Record<string, unknown>> } };
      };
      const map = w.oePlay.land.maps.get(zone);
      if (map !== undefined) map['traverse'] = marks;
    },
    { zone: ZONE, marks: MARKS },
  );
  await step(page, 2);
  expect(await attr(page, 'zone')).toBe(ZONE);
}

/** Holds a key down for `frames` stepped frames. */
async function hold(page: Page, key: string, frames: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, frames);
  await page.keyboard.up(key);
  await step(page, 1);
}

/** A number from the steerer's own state in the page. */
async function state(page: Page, what: 'stamina' | 'vitality'): Promise<number> {
  return page.evaluate((key) => {
    const w = window as unknown as {
      oePlay: { sim: { state: { player: { vitality: number; stamina: { current: number } } } } };
    };
    const p = w.oePlay.sim.state.player;
    return key === 'stamina' ? p.stamina.current : p.vitality;
  }, what);
}

test.describe('Stage 14: the movement verbs', () => {
  test.setTimeout(240_000);

  test('traverse: the climb starts walking into its foot, faces the rock and comes out at its head', async ({
    page,
  }) => {
    await open(page, 38.5, 38.6);
    await page.keyboard.down('KeyW');
    await stepUntil(page, 'verb', 'climb', 5);
    expect(await attr(page, 'verb')).toBe('climb');
    await step(page, 6);
    expect(await attr(page, 'steerer-frame')).toMatch(/^climb\/n\/\d$/);
    // On the face the bar drains (Book 10 Climb: 6 a second).
    const before = await state(page, 'stamina');
    await step(page, 10);
    expect(await state(page, 'stamina')).toBeLessThan(before);
    await stepUntil(page, 'verb', '', 10);
    await page.keyboard.up('KeyW');
    await step(page, 1);
    expect(Number(await attr(page, 'py'))).toBeLessThan(35 * T);
  });

  test('traverse: the crawl goes through the cleft low and comes out the far side', async ({
    page,
  }) => {
    await open(page, 39.5, 34.4);
    await page.keyboard.down('KeyS');
    await stepUntil(page, 'verb', 'crawl', 5);
    expect(await attr(page, 'verb')).toBe('crawl');
    await step(page, 8);
    expect(await attr(page, 'steerer-frame')).toMatch(/^crawl\/s\/\d$/);
    expect(await attr(page, 'gait')).toBe('sneak');
    await stepUntil(page, 'verb', '', 20);
    await page.keyboard.up('KeyS');
    await step(page, 1);
    expect(Number(await attr(page, 'py'))).toBeGreaterThan(38 * T);
  });

  test('traverse: Interact at the take-off jumps the gap, and the stone moves a tile when walked into', async ({
    page,
  }) => {
    await open(page, 62.5, 35.6);
    await stepUntil(page, 'prompt', 'jump', 3);
    expect(await attr(page, 'prompt')).toBe('jump');
    await page.keyboard.press('KeyE');
    await stepUntil(page, 'verb', 'jump', 2);
    expect(await attr(page, 'steerer-frame')).toMatch(/^jump\/e\/\d$/);
    await stepUntil(page, 'verb', '', 3);
    expect(Math.floor(Number(await attr(page, 'px')) / T)).toBe(64);
    // The stone on the shingle: walking into it pushes it along its line.
    await open(page, 29.4, 26.6);
    await page.keyboard.down('KeyD');
    await stepUntil(page, 'verb', 'push', 5);
    expect(await attr(page, 'steerer-frame')).toMatch(/^push\/e\/\d$/);
    await stepUntil(page, 'verb', '', 5);
    await page.keyboard.up('KeyD');
    await step(page, 1);
    const at = await page.evaluate((zone) => {
      const w = window as unknown as {
        oePlay: { sim: { state: { regions: Record<string, { pushed?: Record<string, unknown> }> } } };
      };
      return Object.values(w.oePlay.sim.state.regions).find((r) => r.pushed !== undefined)?.pushed?.[
        `${zone}/test.stone`
      ];
    }, ZONE);
    expect(at).toEqual({ x: 31, y: 26 });
  });

  test('traverse: acceptance check 5, the swimmer run empty sinks and lives by reaching the shallows', async ({
    page,
  }) => {
    await open(page, 21.5, 30.6);
    await page.keyboard.down('KeyA');
    await stepUntil(page, 'verb', 'swim', 30);
    expect(await attr(page, 'verb')).toBe('swim');
    await step(page, 4);
    expect(await attr(page, 'steerer-frame')).toMatch(/^swim\/w\/\d$/);
    await page.keyboard.up('KeyA');
    // Spent in deep water: the sinking begins, drawn with its own frames.
    await page.evaluate(() => {
      const w = window as unknown as {
        oePlay: { sim: { state: { player: { stamina: { current: number } } } } };
      };
      w.oePlay.sim.state.player.stamina.current = 0.01;
    });
    await stepUntil(page, 'steerer-frame', /^sink\//, 3);
    expect(await attr(page, 'steerer-frame')).toMatch(/^sink\/\w\/\d$/);
    // Back east to the shallows within Book 10's six seconds: alive and unhurt.
    await page.keyboard.down('KeyD');
    await stepUntil(page, 'verb', '', 6);
    await page.keyboard.up('KeyD');
    await step(page, 1);
    expect(await attr(page, 'verb')).toBe('');
    expect(await state(page, 'vitality')).toBe(100);
  });
});
