/**
 * Combat v2 in the browser (design addendum 2.4 section 1; decisions DE-1 to DE-15): the scavengers
 * at dusk at the stern on Wreck Strand warn first and a walk away avoids the fight (with its
 * checkpoint first); the lock-on key takes Svart and the stance keeps facing him while backing off;
 * the sneak key toggles the crouch; a seax blow holds both fighters in hitstop; an arrow at a raised
 * shield sticks in the board.
 *
 * Every test plays stepped (`capture`: the page advances only when stepped, by `oeStep`), so a
 * slow machine (CI's Firefox at about 4 frames a second) plays exactly what a fast one does. A
 * moment of a fight is staged through the page's world (`oeWorld`, capture mode only), as the
 * unit tests stage it; people walking past (Hild, the household) change none of the checks.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { attr, startPlay, step, stepUntil } from './strand.ts';

const DUSK = 'capture&kit=seax,bow&camp=broch&time=18:35&zone=ZONE_SK_STRAND';
const SVART = 'E_WRECKER_SVART';

/** Svart's awareness and hitstop as the page reports them. */
async function svartAware(page: Page): Promise<{ state: string; hitstop: number }> {
  const raw = await attr(page, 'aware');
  const [, state = '', hitstop = '0'] =
    raw
      .split(',')
      .find((x) => x.startsWith(`${SVART}:`))
      ?.split(':') ?? [];
  return { state, hitstop: Number(hitstop) };
}

/**
 * Stages Svart through the page's world: alert of the steerer, held from choosing. `engaged` sets
 * the fight on already, so no later start of it lets him choose again.
 */
async function holdSvart(
  page: Page,
  opts: { shield?: boolean; x?: number; engaged?: boolean } = {},
): Promise<void> {
  await page.evaluate(
    ([id, o]) => {
      interface F {
        able: boolean;
        f: { shield: boolean; angle: number; facing: string; hitstop: number };
        ai: {
          next: number;
          aware: boolean;
          target: string | null;
          memory: unknown;
          awareness: { level: number; state: string; heard: number };
        };
      }
      const w = (
        window as unknown as {
          oeWorld: {
            tick: number;
            onFoot: {
              player: { x: number; y: number };
              battle: { engaged: boolean } | null;
              actors: Record<
                string,
                { x: number; pose: string; task?: string; facing: string; fight?: F }
              >;
            };
          };
        }
      ).oeWorld;
      for (const a of Object.values(w.onFoot.actors))
        if (a.fight !== undefined) {
          a.fight.ai.next = 1e12;
          a.fight.able = false;
        }
      if (o.engaged === true && w.onFoot.battle !== null) w.onFoot.battle.engaged = true;
      const a = w.onFoot.actors[id];
      if (a?.fight === undefined) return;
      if (o.x !== undefined) a.x = o.x * 24;
      a.fight.ai.awareness = { level: 100, state: 'ALERT', heard: w.tick };
      a.fight.ai.aware = true;
      a.fight.ai.target = 'P_STEERER';
      a.fight.ai.memory = { x: w.onFoot.player.x, y: w.onFoot.player.y, tick: w.tick, seen: true };
      a.fight.able = o.shield === true;
      if (o.shield !== undefined) a.fight.f.shield = o.shield;
      a.fight.f.angle = Math.PI;
      a.fight.f.facing = 'w';
      a.facing = 'w';
      delete a.task;
      a.pose = 'idle';
    },
    [SVART, opts] as const,
  );
}

/** Moves the mouse onto a fighter's body (its feet less 16 px), so the stance turns to it. */
async function pointAt(page: Page, id: string): Promise<void> {
  const fighter = (await attr(page, 'fighters')).split(',').find((x) => x.startsWith(`${id}:`));
  const [, , , sx = '0', sy = '0'] = fighter?.split(':') ?? [];
  const cam = (await attr(page, 'camera')).split(',').map(Number);
  const box = await page.locator('canvas#screen').boundingBox();
  if (box === null) throw new Error('no canvas');
  const k = box.width / 640;
  await page.mouse.move(
    box.x + (Number(sx) - (cam[0] ?? 0)) * k,
    box.y + (Number(sy) - 16 - (cam[1] ?? 0)) * k,
  );
}

test.describe('combat v2', () => {
  test.setTimeout(240_000);

  test('the scavengers at dusk: a checkpoint, warnings, and a walk away avoids the fight; sneak toggles', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${DUSK}&at=82,35.2`);
    await step(page, 2);
    expect(await attr(page, 'saves')).toContain('checkpoint:dusk');
    expect(await attr(page, 'fighters')).toContain(`${SVART}:`);
    // Walk east towards them on the shingle: seen, then warned, never yet fought.
    await page.keyboard.down('KeyD');
    await stepUntil(page, 'aware', new RegExp(`${SVART}:(SUSPICIOUS|ALERT)`), 6);
    await page.keyboard.up('KeyD');
    await stepUntil(page, 'aware', new RegExp(`${SVART}:ALERT`), 8);
    expect((await svartAware(page)).state).toBe('ALERT');
    expect(await attr(page, 'battle')).toBe('waiting');
    // Walk away west: they go back to their work, and no fight starts.
    await page.keyboard.down('KeyA');
    await step(page, 50);
    await page.keyboard.up('KeyA');
    await step(page, 10);
    expect(await attr(page, 'battle')).toBe('waiting');
    // The sneak key is a toggle (out of a fight: an engaged fight ends sneaking).
    await page.keyboard.press('KeyC');
    await step(page, 1);
    expect((await attr(page, 'stance')).split(':')[2]).toBe('1');
    await page.keyboard.press('KeyC');
    await step(page, 1);
    expect((await attr(page, 'stance')).split(':')[2]).toBe('0');
  });

  test('lock-on takes Svart, and the stance faces him while backing off', async ({ page }) => {
    await startPlay(page, 'A', `${DUSK}&at=90.6,35.2`);
    await step(page, 2);
    await holdSvart(page, { x: 92.6, engaged: true });
    // Turned to him first: the lock takes the foe nearest the facing (Conn works behind).
    await pointAt(page, SVART);
    await step(page, 20);
    await page.keyboard.press('KeyZ');
    await step(page, 2);
    expect((await attr(page, 'stance')).split(':')[1]).toBe(SVART);
    // Back off west for a second: the facing stays east, towards him.
    await page.keyboard.down('KeyA');
    await step(page, 10);
    await page.keyboard.up('KeyA');
    const facing = Number((await attr(page, 'stance')).split(':')[0]);
    const { bearing, backed } = await page.evaluate(
      ([id, from]) => {
        const o = (
          window as unknown as {
            oeWorld: {
              onFoot: {
                player: { x: number; y: number };
                actors: Record<string, { x: number; y: number }>;
              };
            };
          }
        ).oeWorld.onFoot;
        const t = o.actors[id] ?? o.player;
        return {
          bearing: (Math.atan2(t.y - o.player.y, t.x - o.player.x) * 180) / Math.PI,
          backed: from - o.player.x,
        };
      },
      [SVART, 90.6 * 24] as const,
    );
    expect(backed).toBeGreaterThan(12);
    expect(Math.abs(((facing - bearing + 540) % 360) - 180)).toBeLessThan(15);
  });

  test('a seax blow holds both fighters in hitstop', async ({ page }) => {
    await startPlay(page, 'A', `${DUSK}&at=92.9,35.2`);
    await step(page, 2);
    await holdSvart(page, { x: 93.8, engaged: true });
    await pointAt(page, SVART);
    await step(page, 20);
    await page.keyboard.press('KeyZ');
    await step(page, 2);
    await page.keyboard.down('KeyF');
    await step(page, 1, 1000 / 60);
    await page.keyboard.up('KeyF');
    // Tick by tick until the blow lands: both held for Book 10's seax hitstop (3 ticks).
    let held = 0;
    for (let i = 0; i < 40 && held === 0; i++) {
      await step(page, 1, 1000 / 60);
      held = (await svartAware(page)).hitstop;
    }
    expect(held).toBeGreaterThan(0);
    expect(Number(await attr(page, 'steerer-hitstop'))).toBeGreaterThan(0);
  });

  test('an arrow at a raised shield sticks in the board', async ({ page }) => {
    await startPlay(page, 'A', `${DUSK}&at=88.6,35.2`);
    await step(page, 2);
    await holdSvart(page, { x: 93.8, shield: true });
    await page.keyboard.press('Digit2');
    await step(page, 1);
    // Aim at his body and loose at full draw.
    await pointAt(page, SVART);
    await page.mouse.down();
    await step(page, 6);
    await page.mouse.up();
    await step(page, 10);
    const inShield = await page.evaluate(() =>
      (
        window as unknown as { oeWorld: { onFoot: { stuck: { in: string; target?: string }[] } } }
      ).oeWorld.onFoot.stuck
        .filter((s) => s.target === 'E_WRECKER_SVART')
        .map((s) => s.in),
    );
    expect(inShield).toEqual(['shield']);
  });
});
