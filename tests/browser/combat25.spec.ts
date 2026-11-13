/**
 * Design addendum 2.5 section 1 in the browser (decisions DF-1 to DF-10, DF-81): committed actions
 * (the keys neither move nor turn nor dodge out of an attack), locked-on attacks going at the
 * enemy with the cursor elsewhere, exhaustion at an empty bar (no dodge, half speed), the
 * predictive parry pressed in Svart's wind-up off his tell, and an archer hopping back once.
 *
 * Every test plays stepped (`capture`: the page advances only when stepped, by `oeStep`; the
 * helpers in strand.ts draw only the last frame of a batch, DE-81). A moment of a fight is staged
 * through the page's world (`oeWorld`, capture mode only), as the unit tests stage it.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { attr, startPlay, step } from './strand.ts';

const DUSK = 'capture&kit=seax,bow&camp=broch&time=18:35&zone=ZONE_SK_STRAND';
const SVART = 'E_WRECKER_SVART';
const CONN = 'E_WRECKER_CONN';
const TICK = 1000 / 60;

interface Seen {
  tick: number;
  px: number;
  py: number;
  angle: number;
  mine: string;
  stamina: number;
  exhausted: boolean;
  x: number;
  y: number;
  state: string;
  activeAt: number;
  since: number;
  flashAt: number;
  hopAt: number;
  sidearmAt: number;
}

/** The world as the test reads it: the steerer and one fighter. */
async function seen(page: Page, id: string): Promise<Seen> {
  return page.evaluate((who) => {
    interface F {
      state: string;
      angle: number;
      activeAt: number;
      since: number;
      flashAt: number;
      exhausted: boolean;
    }
    const w = (
      window as unknown as {
        oeWorld: {
          tick: number;
          player: { stamina: { current: number } };
          onFoot: {
            player: { x: number; y: number; fight?: F | null };
            actors: Record<
              string,
              { x: number; y: number; fight?: { f: F; ai: { hopAt: number; sidearmAt: number } } }
            >;
          };
        };
      }
    ).oeWorld;
    const p = w.onFoot.player;
    const a = w.onFoot.actors[who];
    return {
      tick: w.tick,
      px: p.x,
      py: p.y,
      angle: p.fight?.angle ?? 0,
      mine: p.fight?.state ?? 'idle',
      stamina: w.player.stamina.current,
      exhausted: p.fight?.exhausted ?? false,
      x: a?.x ?? 0,
      y: a?.y ?? 0,
      state: a?.fight?.f.state ?? '',
      activeAt: a?.fight?.f.activeAt ?? -1,
      since: a?.fight?.f.since ?? -1,
      flashAt: a?.fight?.f.flashAt ?? -1,
      hopAt: a?.fight?.ai.hopAt ?? -1,
      sidearmAt: a?.fight?.ai.sidearmAt ?? -1,
    };
  }, id);
}

/** Sets a fighter alert of the steerer and in the fight; `free` lets it choose. */
async function stageFoe(
  page: Page,
  id: string,
  o: { x: number; y?: number; free: boolean; others?: 'held' },
): Promise<void> {
  await page.evaluate(
    ([who, opts]) => {
      interface A {
        x: number;
        y: number;
        pose: string;
        task?: string;
        facing: string;
        fight?: {
          able: boolean;
          f: { angle: number; facing: string };
          ai: {
            next: number;
            mode: string;
            aware: boolean;
            target: string | null;
            memory: unknown;
            awareness: { level: number; state: string; heard: number };
            home: { x: number; y: number; facing: string };
          };
        };
      }
      const w = (
        window as unknown as {
          oeWorld: {
            tick: number;
            onFoot: {
              player: { x: number; y: number };
              battle: { engaged: boolean } | null;
              actors: Record<string, A>;
            };
          };
        }
      ).oeWorld;
      for (const [k, a] of Object.entries(w.onFoot.actors))
        if (a.fight !== undefined && k !== who) {
          a.fight.ai.next = 1e12;
          a.fight.able = false;
        }
      if (w.onFoot.battle !== null) w.onFoot.battle.engaged = true;
      const a = w.onFoot.actors[who];
      if (a?.fight === undefined) return;
      a.x = opts.x * 24;
      if (opts.y !== undefined) a.y = opts.y * 24;
      a.fight.ai.home = { ...a.fight.ai.home, x: a.x, y: a.y };
      a.fight.ai.awareness = { level: 100, state: 'ALERT', heard: w.tick };
      a.fight.ai.aware = true;
      a.fight.ai.target = 'P_STEERER';
      a.fight.ai.mode = 'FIGHT';
      a.fight.ai.memory = { x: w.onFoot.player.x, y: w.onFoot.player.y, tick: w.tick, seen: true };
      a.fight.ai.next = opts.free ? w.tick : 1e12;
      a.fight.able = opts.free;
      a.fight.f.angle = Math.PI;
      a.fight.f.facing = 'w';
      a.facing = 'w';
      delete a.task;
      a.pose = 'idle';
    },
    [id, o] as const,
  );
}

/** The mouse at a world point (game pixels), so the stance turns to it. */
async function pointAtWorld(page: Page, x: number, y: number): Promise<void> {
  const cam = (await attr(page, 'camera')).split(',').map(Number);
  const box = await page.locator('canvas#screen').boundingBox();
  if (box === null) throw new Error('no canvas');
  const k = box.width / 640;
  await page.mouse.move(box.x + (x - (cam[0] ?? 0)) * k, box.y + (y - 16 - (cam[1] ?? 0)) * k);
}

test.describe('combat 2.5', () => {
  test.setTimeout(240_000);

  test('locked on, an attack goes at the enemy with the cursor elsewhere; and it commits', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${DUSK}&at=92.9,35.2`);
    await step(page, 2);
    await stageFoe(page, SVART, { x: 93.9, free: false });
    let s = await seen(page, SVART);
    await pointAtWorld(page, s.x, s.y);
    await step(page, 20);
    await page.keyboard.press('KeyZ');
    await step(page, 2);
    expect((await attr(page, 'stance')).split(':')[1]).toBe(SVART);
    // The cursor far to the south-west, away from him.
    s = await seen(page, SVART);
    await pointAtWorld(page, s.px - 120, s.py + 80);
    await step(page, 1, TICK);
    await page.keyboard.down('KeyF');
    await step(page, 1, TICK);
    await page.keyboard.up('KeyF');
    await step(page, 1, TICK);
    s = await seen(page, SVART);
    const bearing = Math.atan2(s.y - s.py, s.x - s.px);
    expect(Math.cos(s.angle - bearing)).toBeGreaterThan(0.99);
    expect(s.mine).not.toBe('idle');
    // Committed: the keys move it nowhere and a dodge is refused while the attack plays out.
    const x0 = s.px;
    const y0 = s.py;
    await page.keyboard.down('KeyS');
    await page.keyboard.press('Space');
    const states: string[] = [];
    for (let i = 0; i < 30; i++) {
      await step(page, 1, TICK);
      const now = await seen(page, SVART);
      states.push(now.mine);
      if (now.mine === 'idle') break;
      // The only ground covered is the attack's own step, along its fixed facing (none sideways).
      const across = (now.px - x0) * Math.sin(s.angle) - (now.py - y0) * Math.cos(s.angle);
      expect(Math.abs(across)).toBeLessThan(0.01);
      expect(Math.hypot(now.px - x0, now.py - y0)).toBeLessThan(0.16 * 24 + 0.01);
    }
    await page.keyboard.up('KeyS');
    expect(states).not.toContain('dodge');
  });

  test('exhausted at an empty bar: no dodge, and half speed until the bar is back', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${DUSK}&at=80,35.2`);
    await step(page, 2);
    const walk = async (): Promise<number> => {
      await page.keyboard.down('KeyA');
      await step(page, 6);
      const x0 = (await seen(page, SVART)).px;
      await step(page, 6);
      const x1 = (await seen(page, SVART)).px;
      await page.keyboard.up('KeyA');
      await step(page, 4);
      return x0 - x1;
    };
    const fresh = await walk();
    await page.evaluate(() => {
      const w = (
        window as unknown as {
          oeWorld: { tick: number; player: { stamina: { current: number; spentTick: number } } };
        }
      ).oeWorld;
      w.player.stamina.current = 0;
      w.player.stamina.spentTick = w.tick;
    });
    await step(page, 1, TICK);
    expect((await seen(page, SVART)).exhausted).toBe(true);
    await page.keyboard.press('Space');
    await step(page, 2, TICK);
    expect((await seen(page, SVART)).mine).toBe('idle');
    const tired = await walk();
    expect(tired / fresh).toBeGreaterThan(0.4);
    expect(tired / fresh).toBeLessThan(0.6);
  });

  test('the predictive parry: pressed in Svart’s wind-up off his tell, it stuns him', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${DUSK}&at=92.4,35.2`);
    await step(page, 2);
    await stageFoe(page, SVART, { x: 93.9, free: true });
    let s = await seen(page, SVART);
    await pointAtWorld(page, s.x, s.y);
    await step(page, 10);
    await page.keyboard.press('KeyZ');
    await step(page, 1, TICK);
    let pressed = false;
    let parried = false;
    for (let i = 0; i < 900 && !parried; i++) {
      s = await seen(page, SVART);
      if (s.state === 'parried') parried = true;
      const striking = ['light1', 'heavyRelease', 'lunge'].includes(s.state);
      const lands =
        striking && s.tick < s.activeAt
          ? s.activeAt
          : s.state.startsWith('charge') && s.flashAt >= s.since
            ? s.flashAt + 28
            : null;
      // Book 10 "Parry": its 6-tick wind-up, then 8 live ticks centred on the blow.
      if (!pressed && lands !== null && lands - s.tick === 10) {
        await page.keyboard.press('KeyQ');
        pressed = true;
      }
      await page.evaluate(() => {
        (
          window as unknown as { oeWorld: { player: { vitality: number } } }
        ).oeWorld.player.vitality = 100;
      });
      await step(page, 1, TICK);
      if (pressed && !parried && s.state === 'idle' && i % 60 === 0) pressed = false;
    }
    expect(pressed).toBe(true);
    expect(parried).toBe(true);
  });

  test('an archer stands still to shoot, hops back once when crowded, then draws its seax', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${DUSK}&at=86,35.4`);
    await step(page, 2);
    await stageFoe(page, CONN, { x: 91.5, y: 35.4, free: true });
    await step(page, 20);
    await page.keyboard.down('KeyD');
    let hops = 0;
    let lastHop = -1;
    for (let i = 0; i < 60; i++) {
      await step(page, 1);
      const c = await seen(page, CONN);
      if (c.hopAt >= 0 && c.hopAt !== lastHop) {
        hops++;
        lastHop = c.hopAt;
      }
      if (Math.hypot(c.x - c.px, c.y - c.py) < 30) await page.keyboard.up('KeyD');
      if (c.sidearmAt >= 0 && i > 30) break;
      await page.evaluate(() => {
        (
          window as unknown as { oeWorld: { player: { vitality: number } } }
        ).oeWorld.player.vitality = 100;
      });
    }
    await page.keyboard.up('KeyD');
    expect(hops).toBe(1);
    expect((await seen(page, CONN)).sidearmAt).toBeGreaterThanOrEqual(0);
  });
});
