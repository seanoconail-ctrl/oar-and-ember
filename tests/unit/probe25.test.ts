import { carefulMemory, carefulTick } from '../../src/tools/play/carefulFighter.ts';
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import {
  MELEE_WEAPONS,
  parseAiBalance,
  parseCombatBalance,
} from '../../src/content/combatBalance.ts';
import { MemoryStore, SaveManager } from '../../src/persist/manager.ts';
import { hears, lightAt, sees, sightRange, stepNoise } from '../../src/sim/ai/perception.ts';
import {
  blowOf,
  charging,
  frameData,
  newFighter,
  pressAttack,
  pressDodge,
  pressParry,
  pressShove,
  releaseAttack,
  resolveBlow,
  setBlock,
  poiseHit,
  stepFighter,
  strikePhase,
  striking,
} from '../../src/sim/combat/fighter.ts';
import type { Fighter, StaminaPool } from '../../src/sim/combat/fighter.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { orderShot } from '../../src/sim/land/archer.ts';
import { crewFight, hurt, inAttack } from '../../src/sim/land/fight.ts';
import type { FightWorld } from '../../src/sim/land/fight.ts';
import { findActor, switchZone } from '../../src/sim/land/zoneLinks.ts';
import { createSimulation, stateHash } from '../../src/sim/simulation.ts';
import type { SimEvent, Simulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { campContext } from '../../src/sim/home/camp.ts';
import { CampBot } from '../../src/tools/play/campBot.ts';
import { repoFile } from './books.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const cb = parseCombatBalance(balance);
const ai = parseAiBalance(balance);
const { content } = loadContentFromDisk();
/**
 * Stage 9's fight on Wreck Strand, kept as this file's fixture: the mechanics are tested on the
 * open shingle where they were measured, with the scavengers where Stage 9 put them (decision
 * S9-11). Stage 10 moved them to the sheepfold (decision S10-5): the first test below checks the
 * real content puts them there; tests/scenario/searches.test.ts plays the fold.
 */
const stage9 = {
  ...content,
  searches: null,
  combat:
    content.combat === null
      ? null
      : {
          ...content.combat,
          encounters: [
            {
              id: 'SCN_SK_WRECKERS',
              zone: 'ZONE_SK_STRAND',
              after: 'ch1.at_broch',
              takesCaptives: false,
              checkpoint: 'wreckers',
              members: [
                {
                  person: 'E_WRECKER_KETILL',
                  x: 25.5,
                  y: 34.7,
                  facing: 'w' as const,
                  task: 'TASK_GATHER_DRIFTWOOD',
                },
                {
                  person: 'E_WRECKER_SVART',
                  x: 23.4,
                  y: 35.8,
                  facing: 's' as const,
                  task: 'TASK_GATHER_DRIFTWOOD',
                },
                { person: 'E_WRECKER_CONN', x: 30.6, y: 34.6, facing: 'w' as const },
              ],
            },
          ],
        },
};
const land = landContext(stage9, balance);
/** The game's own content: the scavengers at the sheepfold (Stage 10). */
const landNow = landContext(content, balance);
const TILE = 24;

const pool = (current = 100): StaminaPool => ({ current, spentTick: 0 });

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('missing');
  return value;
}
interface Fight {
  readonly world: WorldState;
  readonly sim: Simulation;
  readonly events: SimEvent[];
}

/**
 * A fight on Wreck Strand: the camp set up (Hild has led to the broch), the steerer at (x, y) on
 * the strand with the seax in hand; the wreck-scavengers come with the first tick.
 */
function strandFight(seed: string, at = '36,34.2', extra = ''): Fight {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams(`camp=broch&time=10:00&at=1,1${extra}`));
  const onFoot = world.onFoot;
  const strand = land.maps.get('ZONE_SK_STRAND');
  if (onFoot === null || strand === undefined) throw new Error('no strand');
  const [x, y] = at.split(',').map(Number);
  switchZone(onFoot, 'ZONE_SK_STRAND', { x: (x ?? 0) * TILE, y: (y ?? 0) * TILE });
  onFoot.player.facing = 'w';
  world.player.hotbar.slots[0] = 'ITEM_SEAX';
  world.player.hotbar.selected = 0;
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.step();
  return { world, sim, events };
}

const actor = (f: Fight, id: string) => {
  const a = f.world.onFoot?.actors[id];
  if (a === undefined) throw new Error(`no ${id}`);
  return a;
};

/** Holds the movement keys towards a point until within `stop` pixels. */
function walkTo(f: Fight, x: number, y: number, run = false, stop = 6, max = 2000): void {
  for (let i = 0; i < max; i++) {
    const p = f.world.onFoot?.player;
    if (p === undefined) return;
    const dx = x - p.x;
    const dy = y - p.y;
    if (Math.hypot(dx, dy) < stop) break;
    const l = Math.hypot(dx, dy);
    f.sim.submit({ type: 'MOVE', x: dx / l, y: dy / l, run, sneak: false });
    f.sim.step();
  }
  f.sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
  f.sim.step();
}

void carefulMemory; void carefulTick; void must; void pool;

function dusk(seed: string, at: [number, number], hand: string | null = null): Fight {
  const land = landContext(content, balance);
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, { name: 'Ash', bodyModel: 'A' });
  campHooks(world, content, land, new URLSearchParams('camp=broch&time=18:35'));
  const onFoot = world.onFoot!;
  switchZone(onFoot, 'ZONE_SK_STRAND', { x: at[0] * TILE, y: at[1] * TILE });
  world.player.hotbar.slots[0] = hand;
  world.player.hotbar.selected = 0;
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.step();
  return { world, sim, events };
}
describe('probe dusk', () => {
  it('dusk careful', () => {
    for (let n = 1; n <= 10; n++) {
      const f = dusk(`dusk-fight-${n}`, [92.6, 35.2], 'ITEM_SEAX');
      const onFoot = f.world.onFoot!;
      const svart = onFoot.actors['E_WRECKER_SVART']!;
      const mem = carefulMemory();
      for (let i = 0; i < 60 * 60 && f.world.gameOver === null; i++) {
        const p = onFoot.player;
        if (onFoot.battle?.engaged !== true) f.sim.submit({ type: 'MOVE', x: Math.sign(svart.x - p.x), y: 0, run: false, sneak: false });
        else for (const c of carefulTick(onFoot, cb, f.world.tick, f.world.player.stamina.current, f.world.player.stamina.max, mem)) f.sim.submit(c);
        f.sim.step();
        if (Object.values(onFoot.actors).every((a) => a.fight?.side !== 'ENEMY' || a.fight.dead !== null || a.fight.ai.mode === 'FLEE' || a.fight.f.state === 'surrendered')) break;
      }
      const count = (t: string) => f.events.filter((e) => e.type === t).length;
      const blows = f.events.filter((e) => e.type === 'BLOW') as any[];
      console.log(n, 'over', f.world.gameOver !== null, 'svart', svart.fight?.f.state, svart.fight?.vitality, 'conn', onFoot.actors['E_WRECKER_CONN']?.fight?.ai.mode, 'vit', f.world.player.vitality.toFixed(0), 'parried', blows.filter(b=>b.outcome==='PARRIED').length, 'rip', blows.filter(b=>b.kind==='riposte').length, 'hitsOnSteerer', blows.filter(b=>b.defender==='P_STEERER'&&b.outcome==='HIT').length, 'tele', count('TELEGRAPH'), 'ticks', f.world.tick);
    }
  });
});
describe('probe', () => {
  it('archer', () => {
    const f = strandFight('archer', '39,34.2');
    const conn = actor(f, 'E_WRECKER_CONN');
    walkTo(f, 35.5 * TILE, 34.2 * TILE, true, 6, 200);
    for (let i = 0; i < 600; i++) {
      f.sim.step();
      if (i % 30 === 0) {
        const fa = conn.fight!;
        console.log(i, Math.round(f.world.onFoot!.player.x), fa.ai.mode, fa.ai.mind.state, fa.ai.awareness.state, conn.archer?.phase, Math.round(conn.x), Math.round(conn.y), fa.f.state, fa.ai.target, fa.ai.hop !== null, fa.ai.sidearmAt);
      }
      f.world.player.vitality = 100;
    }
  });
});
describe('probe warn', () => {
  it('warn', () => {
    const f = dusk('warn-in', [78, 35.2]);
    const conn = f.world.onFoot!.actors['E_WRECKER_CONN']!;
    const pl = () => f.world.onFoot!.player;
    const mv = (x: number) => f.sim.submit({ type: 'MOVE', x, y: 0, run: false, sneak: false });
    const walkTo = (x: number): void => {
      for (let i = 0; i < 900; i++) { mv(pl().x < x * TILE ? 1 : 0); f.sim.step(); }
      mv(0);
      for (let i = 0; i < 200; i++) f.sim.step();
      console.log('at', (pl().x / TILE).toFixed(2), (conn.x / TILE).toFixed(2), conn.fight!.ai.mode, conn.fight!.ai.awareness.state, JSON.stringify(conn.fight!.ai.goal), conn.archer?.phase, conn.fight!.f.state, f.events.filter((e) => e.type === 'WARNED' || e.type === 'FIGHT_STARTED').map((e) => e.type + ':' + ((e as any).stage ?? '')).join(','));
    };
    walkTo(conn.x / TILE - 7.5);
    walkTo(conn.x / TILE - 4.5);
    walkTo(conn.x / TILE - 2.7);
  });
});
