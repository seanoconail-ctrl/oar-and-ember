/**
 * Design addendum 2.5's combat clips, captured from the real game (Book 7 sections 01, 12 and 14;
 * decisions DF-1 to DF-9):   npm run capture -- rework-2.5-combat   writes
 * docs/art/rework-2.5/combat/
 *
 * Played in capture mode as combat v2's clips are (captureCombat2.ts: two ticks a frame, every
 * frame exact) at the stern on Wreck Strand at the first dusk. A moment is staged through the
 * page's world, then played with the keys and the mouse, reading the fighters' drawn state the
 * way a player reads it (the telegraph's flash, the poses). Each is a GIF at 1x (the middle
 * 320 x 180, 30 frames a second) and a still at 4x of its key moment:
 *   punish-miss      Svart's blow, dodged back out of reach, misses; stepped in on and struck in
 *                    his miss recovery (the punish's heavier hitstop)
 *   parry-predictive the parry pressed in Svart's wind-up, 18 ticks after his flash, so its live
 *                    frames meet the blow; the stun, then the riposte
 *   guard-break      Svart's raised shield taking a blow with his bar nearly empty: the guard
 *                    breaks with the large stagger, the shield arm flung wide
 *   circle-wait      Svart circling just outside his range and waiting; the steerer's bar run
 *                    empty (bent, blowing) is the opening he steps in on
 *   archer-backs-off Conn shooting standing still; walked at, he hops back once, then, still
 *                    too close, draws his seax
 * Needs ffmpeg.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { Clip, FPS, lockSvart, open, screen, stage, tick } from './captureCombat2.ts';
import { REPO_ROOT } from './loadTitleArt.ts';

const SVART = 'E_WRECKER_SVART';
const CONN = 'E_WRECKER_CONN';
/** Book 10 "Parry": the press that centres the live ticks on the blow (wind-up 6 + 8 / 2). */
const PARRY_LEAD = 10;
/** Book 10 "Telegraphs", flash: its lead before the blow. */
const FLASH_LEAD = 28;

interface Seen {
  readonly tick: number;
  readonly state: string;
  readonly activeAt: number;
  readonly since: number;
  readonly flashAt: number;
  readonly missed: boolean;
  readonly x: number;
  readonly y: number;
  readonly px: number;
  readonly py: number;
  readonly mine: string;
  readonly riposte: number;
}

/** What a player sees of one foe now: its drawn state and its tell (the world's own record). */
async function look(page: Page, id: string): Promise<Seen> {
  return page.evaluate((who) => {
    interface F {
      state: string;
      activeAt: number;
      since: number;
      flashAt: number;
      missed: boolean;
      riposteUntil: number;
    }
    const w = (
      window as unknown as {
        oeWorld: {
          tick: number;
          onFoot: {
            player: { x: number; y: number; fight?: F | null };
            actors: Record<string, { x: number; y: number; fight?: { f: F } }>;
          };
        };
      }
    ).oeWorld;
    const a = w.onFoot.actors[who];
    const f = a?.fight?.f;
    const p = w.onFoot.player;
    return {
      tick: w.tick,
      state: f?.state ?? '',
      activeAt: f?.activeAt ?? -1,
      since: f?.since ?? -1,
      flashAt: f?.flashAt ?? -1,
      missed: f?.missed ?? false,
      x: a?.x ?? 0,
      y: a?.y ?? 0,
      px: p.x,
      py: p.y,
      mine: p.fight?.state ?? 'idle',
      riposte: p.fight?.riposteUntil ?? -1,
    };
  }, id);
}

/** The first active tick of the blow being told, read off its tell, or null. */
function landsAt(s: Seen): number | null {
  const striking = ['light1', 'light2', 'light3', 'heavyRelease', 'lunge', 'shove'].includes(
    s.state,
  );
  if (striking && s.tick < s.activeAt) return s.activeAt;
  if (s.state.startsWith('charge') && s.flashAt >= s.since) return s.flashAt + FLASH_LEAD;
  return null;
}

async function heal(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { oeWorld: { player: { vitality: number } } }).oeWorld.player.vitality =
      100;
  });
}

/** A click at a foe (the mouse aims the stance; locked on, the blow goes at the lock anyway). */
async function strikeAt(page: Page, s: Seen): Promise<void> {
  const at = await screen(page, s.x, s.y - 18);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await tick(page);
  await page.mouse.up();
}

async function punishMiss(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, [92.0, 35.1], [93, 35]);
  await stage(page, { x: 93.6, y: 35.1, alert: true, engaged: true, angle: Math.PI });
  const clip = new Clip(page, 'punish-miss', out);
  await clip.aim();
  await lockSvart(page);
  let dodged = false;
  let struck = false;
  let after = 0;
  for (let i = 0; i < FPS * 14 && after < FPS * 2; i++) {
    const s = await look(page, SVART);
    const at = landsAt(s);
    // In his wind-up, a dodge straight back out of his reach.
    if (!dodged && at !== null && at - s.tick <= 16 && at - s.tick >= 8) {
      await page.keyboard.down('KeyA');
      await page.keyboard.press('Space');
      await tick(page, 2);
      await page.keyboard.up('KeyA');
      dodged = true;
    }
    // He missed: step in on him and strike while he recovers.
    if (dodged && !struck && s.missed && s.mine === 'idle') {
      const d = Math.hypot(s.x - s.px, s.y - s.py);
      if (d > 26) await page.keyboard.down('KeyD');
      else {
        await page.keyboard.up('KeyD');
        await strikeAt(page, s);
        struck = true;
      }
    }
    if (dodged && s.state === 'idle' && !struck && !s.missed && i > FPS * 6) dodged = false;
    if (struck) after++;
    await clip.frame(struck && after > 6 && after < 12);
    await heal(page);
  }
  await page.keyboard.up('KeyD');
  const bytes = clip.write(Math.max(0, clip.frames - FPS * 5));
  await page.close();
  return `punish-miss.gif ${(bytes / 1e6).toFixed(2)} MB (dodged ${String(dodged)}, struck in the miss ${String(struck)})`;
}

async function parryPredictive(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, [92.3, 35.1], [93, 35]);
  await stage(page, { x: 93.9, y: 35.1, alert: true, engaged: true, angle: Math.PI });
  const clip = new Clip(page, 'parry-predictive', out);
  await clip.aim();
  await lockSvart(page);
  let pressed = false;
  let stunned = false;
  let riposted = 0;
  for (let i = 0; i < FPS * 14 && riposted < FPS * 1.5; i++) {
    const s = await look(page, SVART);
    const at = landsAt(s);
    // The press comes in his wind-up, PARRY_LEAD ticks before the blow: a frame is two ticks.
    if (!stunned && at !== null && at - s.tick >= PARRY_LEAD && at - s.tick <= PARRY_LEAD + 1) {
      await tick(page, at - s.tick - PARRY_LEAD);
      await page.keyboard.press('KeyQ');
      pressed = true;
    }
    if (s.state === 'parried') stunned = true;
    // The riposte once the settle is over, while he reels.
    if (stunned && riposted === 0 && s.mine === 'idle' && s.riposte > s.tick) {
      const d = Math.hypot(s.x - s.px, s.y - s.py);
      if (d > 30) await page.keyboard.down('KeyD');
      else {
        await page.keyboard.up('KeyD');
        await strikeAt(page, s);
        riposted = 1;
      }
    }
    if (riposted > 0) riposted++;
    await clip.frame(stunned && s.state === 'parried');
    await heal(page);
  }
  await page.keyboard.up('KeyD');
  const bytes = clip.write(Math.max(0, clip.frames - FPS * 5));
  await page.close();
  return `parry-predictive.gif ${(bytes / 1e6).toFixed(2)} MB (pressed ${String(pressed)}, stunned ${String(stunned)}, riposte ${String(riposted > 0)})`;
}

async function guardBreak(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, [92.5, 35.1], [93, 35]);
  await stage(page, {
    x: 93.6,
    y: 35.1,
    alert: true,
    held: true,
    able: false,
    shield: true,
    angle: Math.PI,
  });
  // His shield raised, his bar nearly spent: the next blow on it empties it.
  await page.evaluate((id) => {
    const w = (
      window as unknown as {
        oeWorld: {
          tick: number;
          onFoot: {
            actors: Record<
              string,
              {
                fight?: {
                  f: { state: string; guard: boolean; since: number };
                  stamina: { current: number; spentTick: number };
                };
              }
            >;
          };
        };
      }
    ).oeWorld;
    const fa = w.onFoot.actors[id]?.fight;
    if (fa === undefined) return;
    fa.f.state = 'block';
    fa.f.guard = true;
    fa.f.since = w.tick;
    fa.stamina.current = 6;
    fa.stamina.spentTick = w.tick + 1e9;
  }, SVART);
  const clip = new Clip(page, 'guard-break', out);
  await clip.aim();
  await lockSvart(page);
  let broke = false;
  let after = 0;
  let pressed = false;
  for (let i = 0; i < FPS * 6 && after < FPS * 2.5; i++) {
    const s = await look(page, SVART);
    if (!pressed && i > 8) {
      await strikeAt(page, s);
      pressed = true;
    }
    if (s.state === 'guardBroken') broke = true;
    if (broke) after++;
    await clip.frame(broke && after > 8);
    await heal(page);
  }
  const bytes = clip.write();
  await page.close();
  return `guard-break.gif ${(bytes / 1e6).toFixed(2)} MB (broken ${String(broke)})`;
}

async function circleWait(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, [91.4, 35.3], [92.5, 35]);
  await stage(page, { x: 94.0, y: 35.1, alert: true, engaged: true, angle: Math.PI });
  const clip = new Clip(page, 'circle-wait', out);
  await clip.aim();
  await lockSvart(page);
  let waited = 0;
  let stepped = false;
  let after = 0;
  for (let i = 0; i < FPS * 12 && after < FPS * 2; i++) {
    // Patient for the clip: he waits for an opening rather than losing patience.
    const st = await page.evaluate((id) => {
      const w = (
        window as unknown as {
          oeWorld: {
            tick: number;
            player: { stamina: { current: number; spentTick: number } };
            onFoot: {
              actors: Record<
                string,
                { fight?: { ai: { mind: { state: string; patienceUntil: number } } } }
              >;
            };
          };
        }
      ).oeWorld;
      const m = w.onFoot.actors[id]?.fight?.ai.mind;
      if (m === undefined) return '';
      if (m.state === 'WAIT_FOR_OPENING') m.patienceUntil = w.tick + 1e9;
      return m.state;
    }, SVART);
    if (st === 'WAIT_FOR_OPENING' || st === 'CIRCLE') waited++;
    // After four seconds of it, the steerer's bar runs empty: the opening he takes.
    if (waited === FPS * 4)
      await page.evaluate(() => {
        const w = (
          window as unknown as {
            oeWorld: { tick: number; player: { stamina: { current: number; spentTick: number } } };
          }
        ).oeWorld;
        w.player.stamina.current = 0;
        w.player.stamina.spentTick = w.tick;
      });
    if (st === 'ATTACK' && waited >= FPS * 4) stepped = true;
    if (stepped) after++;
    await clip.frame(waited === FPS * 3);
    await heal(page);
  }
  const bytes = clip.write(Math.max(0, clip.frames - FPS * 9));
  await page.close();
  return `circle-wait.gif ${(bytes / 1e6).toFixed(2)} MB (waited ${String(waited)} frames, stepped in ${String(stepped)})`;
}

async function archerBacksOff(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, [86.0, 35.4], [88.5, 35]);
  // Svart held out of the way; Conn alert in the open, his bow ready.
  await stage(page, { x: 97.5, y: 36.0, held: true, able: false });
  await page.evaluate(
    ([id]) => {
      const w = (
        window as unknown as {
          oeWorld: {
            tick: number;
            onFoot: {
              player: { x: number; y: number };
              battle: { engaged: boolean } | null;
              actors: Record<
                string,
                {
                  x: number;
                  y: number;
                  pose: string;
                  task?: string;
                  fight?: {
                    able: boolean;
                    ai: {
                      next: number;
                      aware: boolean;
                      target: string | null;
                      mode: string;
                      memory: unknown;
                      awareness: { level: number; state: string; heard: number };
                      home: { x: number; y: number; facing: string };
                    };
                  };
                }
              >;
            };
          };
        }
      ).oeWorld;
      const a = w.onFoot.actors[id];
      if (a?.fight === undefined) return;
      a.x = 91.5 * 24;
      a.y = 35.4 * 24;
      a.fight.ai.home = { ...a.fight.ai.home, x: a.x, y: a.y };
      a.fight.able = true;
      a.fight.ai.next = w.tick;
      a.fight.ai.awareness = { level: 100, state: 'ALERT', heard: w.tick };
      a.fight.ai.aware = true;
      a.fight.ai.target = 'P_STEERER';
      a.fight.ai.mode = 'FIGHT';
      a.fight.ai.memory = { x: w.onFoot.player.x, y: w.onFoot.player.y, tick: w.tick, seen: true };
      delete a.task;
      a.pose = 'idle';
      if (w.onFoot.battle !== null) w.onFoot.battle.engaged = true;
    },
    [CONN] as const,
  );
  const clip = new Clip(page, 'archer-backs-off', out);
  const c0 = await look(page, CONN);
  clip.focus = await screen(page, (c0.x + c0.px) / 2, (c0.y + c0.py) / 2 - 16);
  let hopped = false;
  let sidearm = false;
  let after = 0;
  let walking = false;
  for (let i = 0; i < FPS * 12 && after < FPS * 2; i++) {
    const s = await look(page, CONN);
    // Two seconds of him shooting, then walk straight at him.
    if (i === FPS * 2 && !walking) {
      await page.keyboard.down('KeyD');
      walking = true;
    }
    const hop = await page.evaluate((id) => {
      const a = (
        window as unknown as {
          oeWorld: {
            onFoot: {
              actors: Record<string, { fight?: { ai: { hop: unknown; sidearmAt: number } } }>;
            };
          };
        }
      ).oeWorld.onFoot.actors[id]?.fight?.ai;
      return { hop: a?.hop != null, sidearm: (a?.sidearmAt ?? -1) >= 0 };
    }, CONN);
    if (hop.hop) hopped = true;
    if (hop.sidearm) sidearm = true;
    if (sidearm) after++;
    if (walking && Math.hypot(s.x - s.px, s.y - s.py) < 30) await page.keyboard.up('KeyD');
    await clip.frame(hop.hop);
    await heal(page);
  }
  await page.keyboard.up('KeyD');
  const bytes = clip.write(Math.max(0, clip.frames - FPS * 7));
  await page.close();
  return `archer-backs-off.gif ${(bytes / 1e6).toFixed(2)} MB (hopped ${String(hopped)}, sidearm ${String(sidearm)})`;
}

/** Captures every clip; returns a line for each. */
export async function combat25Capture(browser: Browser): Promise<string> {
  const out = join(REPO_ROOT, 'docs/art/rework-2.5/combat');
  mkdirSync(out, { recursive: true });
  const lines: string[] = [];
  // OE_CLIP=<name>[,<name>] captures those clips alone (while working on them).
  const only = process.env['OE_CLIP'];
  for (const f of [punishMiss, parryPredictive, guardBreak, circleWait, archerBacksOff])
    if (only === undefined || only.split(',').includes(f.name)) lines.push(await f(browser, out));
  return lines.join('\n');
}
