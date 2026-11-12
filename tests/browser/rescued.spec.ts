/**
 * Design addendum 2.5 section 4 (decision DE-82) in the browser: Oddi's rescue played with the
 * keys, stepped (`capture`), the way the user's playtest played it. Lifted from the shingle by the
 * wreck, he is first set down above the tide line on his own strand, as Hild was: there he is not
 * yet rescued, so he lies where he was put, to be lifted again (the playtest's Oddi stood up there,
 * not of the household, unanswering and out of reach). Carried on up into the machair and set
 * down, he joins, gets up, walks to the camp, and talks when spoken to.
 *
 * The page's world (`oeWorld`, capture mode only) is read, never written: the test plays only
 * through the keyboard.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { aboveTideLine, parseZoneMap, terrainAt, tileBlocks } from '../../src/sim/land/zoneMap.ts';
import type { ZoneMap } from '../../src/sim/land/zoneMap.ts';
import { findPath } from '../../src/tools/play/openingBot.ts';
import type { Tile } from '../../src/tools/play/openingBot.ts';
import { attr, overlay, startPlay, step, stepUntil, walkPath } from './strand.ts';

const T = 24;
const zone = (name: string): ZoneMap => {
  const file = `content/zones/${name}.json`;
  return parseZoneMap(JSON.parse(readFileSync(file, 'utf8')) as unknown, file);
};
const strand = zone('zone_sk_strand');
const machair = zone('zone_sk_machair');
const campSites = (
  JSON.parse(readFileSync('content/camp.json', 'utf8')) as {
    sites: { kind: string; x: number; y: number }[];
  }
).sites;
const fire = campSites.find((s) => s.kind === 'FIRE') ?? { x: 0, y: 0 };
/** Oddi lies on the shingle west of the wreck (content/searches.json); the steerer starts east. */
const START = 'capture&kit=seax&camp=broch&time=10:00&zone=ZONE_SK_STRAND&at=25.5,34.7';

interface Seen {
  zone: string;
  x: number;
  y: number;
  pose: string;
  moving: boolean;
  resident: boolean;
}

/** Where Oddi is, from the page's world (read only). */
async function oddi(page: Page): Promise<Seen | null> {
  return page.evaluate(() => {
    const w = (window as unknown as { oeWorld: WorldView }).oeWorld;
    interface ActorView {
      x: number;
      y: number;
      pose: string;
      moving?: boolean;
    }
    interface WorldView {
      onFoot: {
        zone: string;
        actors: Record<string, ActorView>;
        elsewhere?: Record<string, { actors: Record<string, ActorView> }>;
      };
      household: { residents: string[] };
    }
    const resident = w.household.residents.includes('C_ODDI');
    const here = w.onFoot.actors['C_ODDI'];
    const view = (z: string, a: ActorView) => ({
      zone: z,
      x: a.x / 24,
      y: a.y / 24,
      pose: a.pose,
      moving: a.moving === true,
      resident,
    });
    if (here !== undefined) return view(w.onFoot.zone, here);
    for (const [z, rest] of Object.entries(w.onFoot.elsewhere ?? {})) {
      const a = rest.actors['C_ODDI'];
      if (a !== undefined) return view(z, a);
    }
    return null;
  });
}

/** Dry, open ground (a set-down there is never refused for the tide or for room). */
const dry = (map: ZoneMap) => (t: Tile) =>
  !tileBlocks(map, t.tx, t.ty, false) &&
  [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].every(
    ([dx, dy]) =>
      aboveTideLine(terrainAt(map, t.tx + (dx ?? 0), t.ty + (dy ?? 0))) &&
      !tileBlocks(map, t.tx + (dx ?? 0), t.ty + (dy ?? 0), false),
  );

/** Walks with the keys, over dry ground, from where the steerer stands to the first `goal`. */
async function walkTo(page: Page, map: ZoneMap, goal: (t: Tile) => boolean): Promise<void> {
  const from = {
    tx: Math.floor(Number(await attr(page, 'px')) / T),
    ty: Math.floor(Number(await attr(page, 'py')) / T),
  };
  const walkable = (t: Tile): boolean =>
    !tileBlocks(map, t.tx, t.ty, false) && aboveTideLine(terrainAt(map, t.tx, t.ty));
  const path = findPath(map, false, from, goal, (t) => walkable(t) || goal(t));
  if (path === null) throw new Error(`no path from ${from.tx},${from.ty}`);
  await walkPath(page, path);
}

/** Holds a key for `frames` stepped frames. */
async function hold(page: Page, key: string, frames: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, frames);
  await page.keyboard.up(key);
  await step(page, 1);
}

/** Presses E with the prompt showing `kind`. */
async function interact(page: Page, kind: string): Promise<void> {
  await stepUntil(page, 'prompt', kind, 3);
  await expect(overlay(page)).toHaveAttribute('data-prompt', kind);
  await page.keyboard.press('KeyE');
  await step(page, 2);
}

test('Oddi set down on his strand lies to be lifted again; carried off it, he walks to the camp and talks', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await startPlay(page, 'A', START);
  await step(page, 2);
  expect(await attr(page, 'zone')).toBe('ZONE_SK_STRAND');
  const lying = await oddi(page);
  expect(lying?.pose).toBe('down');
  const at = { tx: Math.floor(lying?.x ?? 0), ty: Math.floor(lying?.y ?? 0) };

  // Beside him on the east (the ship's silver lies further west), and lift him.
  await walkTo(page, strand, (t) => t.tx === at.tx + 1 && t.ty === at.ty);
  await interact(page, 'lift');
  await expect(overlay(page)).toHaveAttribute('data-carrying', 'C_ODDI');

  // Up the strand above the tide line, and set down there, as Hild was.
  await walkTo(page, strand, (t) => dry(strand)(t) && t.ty <= at.ty - 4 && t.tx >= at.tx + 4);
  await hold(page, 'KeyW', 1);
  await interact(page, 'set_down');
  await expect(overlay(page)).toHaveAttribute('data-carrying', '');
  // Book 10's rescueGetUp and more: still on his strand he is not rescued. He lies there, not of
  // the household, and the prompt offers to lift him again.
  await step(page, 80);
  const onStrand = await oddi(page);
  expect(onStrand?.zone).toBe('ZONE_SK_STRAND');
  expect(onStrand?.pose).toBe('down');
  expect(onStrand?.resident).toBe(false);
  expect(await attr(page, 'searches')).toContain('search.oddi=|');

  // Lift him again and carry him off the strand, north into the machair.
  await interact(page, 'lift');
  await expect(overlay(page)).toHaveAttribute('data-carrying', 'C_ODDI');
  await walkTo(page, strand, (t) => t.ty === 1);
  await page.keyboard.down('KeyW');
  await stepUntil(page, 'zone', 'ZONE_SK_MACHAIR', 10);
  await page.keyboard.up('KeyW');
  await step(page, 1);
  await expect(overlay(page)).toHaveAttribute('data-zone', 'ZONE_SK_MACHAIR');
  await walkTo(page, machair, (t) => dry(machair)(t) && t.ty >= machair.height - 8);
  await hold(page, 'KeyW', 1);
  await interact(page, 'set_down');
  await expect(overlay(page)).toHaveAttribute('data-carrying', '');
  await expect(overlay(page)).toHaveAttribute('data-residents', /C_ODDI/);
  expect(await attr(page, 'searches')).toContain('search.oddi=ODDI_FIRST');

  // He gets up and walks to the camp (at a limp), seen walking on the way.
  let walked = false;
  let home: Seen | null = null;
  for (let s = 0; s < 240 && home === null; s++) {
    await step(page, 4, 250);
    const now = await oddi(page);
    if (now?.moving === true) walked = true;
    if (now?.zone === 'ZONE_SK_MACHAIR' && Math.hypot(now.x - fire.x, now.y - fire.y) <= 8)
      home = now;
  }
  expect(walked).toBe(true);
  expect(home, JSON.stringify(await oddi(page))).not.toBeNull();

  // Talking: beside him, Interact opens his conversation.
  await stepUntil(page, 'talk', '', 1);
  for (let tries = 0; tries < 4 && (await attr(page, 'talk')) !== 'C_ODDI'; tries++) {
    const now = await oddi(page);
    if (now === null) break;
    const o = { tx: Math.floor(now.x), ty: Math.floor(now.y - 0.001) };
    const sides = [
      { tx: o.tx + 1, ty: o.ty },
      { tx: o.tx - 1, ty: o.ty },
      { tx: o.tx, ty: o.ty + 1 },
      { tx: o.tx, ty: o.ty - 1 },
    ];
    const side = sides[tries % sides.length] ?? sides[0];
    if (side === undefined) break;
    try {
      await walkTo(page, machair, (t) => t.tx === side.tx && t.ty === side.ty);
    } catch {
      continue;
    }
    await stepUntil(page, 'prompt', 'talk', 2);
    if ((await page.locator('[data-region=prompt]').textContent())?.includes('Oddi') !== true)
      continue;
    await page.keyboard.press('KeyE');
    await step(page, 2);
  }
  await expect(overlay(page)).toHaveAttribute('data-talk', 'C_ODDI');
});
