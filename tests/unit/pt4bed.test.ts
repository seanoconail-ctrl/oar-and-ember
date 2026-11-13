/**
 * The user's fourth playtest: the steerer's bed (decision DH-3; built as DH-100 to DH-104).
 *
 * The user could not go to bed somewhere (their screenshot did not arrive). Investigated from the
 * game, the ways the steerer could fail to sleep when they should were:
 *
 * 1. On the second evening, with the shelter finished (S1), the steerer's bed moved from the
 *    lean-to by the west wall to the middle of the north row, unmarked, and the first resident
 *    without a place of their own was given the same spot to sleep in: the steerer found their bed
 *    gone from where they had slept, and the one in the north row taken.
 * 2. The bed counted only from its foot point: standing on the drawn bedding nearer the lean-to's
 *    sail, the shelter's frame or a set-down load, Interact did that instead of sleeping, while
 *    the prompt (which does not see the opening's uses) said "sleep".
 * 3. "Too early to sleep" was hidden whenever a person or a task was within reach, and its hour was
 *    written into the prompt, not read from Book 10.
 *
 * These tests walk to the bed from every side, before and after the shelter is finished, and stand
 * anywhere on it.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { campHooks, campUseLabel } from '../../src/scenes/camp.ts';
import { clockText } from '../../src/sim/calendar/calendar.ts';
import { campContext, campUseNear, campUses, useDistance } from '../../src/sim/home/camp.ts';
import type { CampContext, PlacedUse } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { bedOf } from '../../src/sim/people/schedule.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { Simulation, SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { CampBot } from '../../src/tools/play/campBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const campOrNull = campContext(content);
if (campOrNull === null) throw new Error('no camp content');
const camp: CampContext = campOrNull;
const T = 24;

const bedSite = (key: string) => {
  const s = camp.def.sites.find((x) => x.key === key);
  if (s?.area === undefined) throw new Error(`${key} has no area`);
  return { ...s, area: s.area };
};

function start(query: string): { sim: Simulation; events: SimEvent[]; bot: CampBot } {
  const world = newCampaign('bed', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  const sim = createSimulation(b, world, land);
  campHooks(sim.state, content, land, new URLSearchParams(query));
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  for (let i = 0; i < 20; i++) sim.step();
  return { sim, events, bot: new CampBot(sim, b, land, camp) };
}

/** Walks by the path to the bed's tiles, then steps onto the point (in tiles), and stops. */
function walkOnto(sim: Simulation, bot: CampBot, x: number, y: number): void {
  const tx = Math.floor(x);
  const ty = Math.floor(y - 0.001);
  bot.walkTo((t) => Math.abs(t.tx - tx) <= 1 && Math.abs(t.ty - ty) <= 1);
  const p = () => {
    const pl = sim.state.onFoot?.player;
    if (pl === undefined) throw new Error('not on foot');
    return pl;
  };
  for (let i = 0; i < 600; i++) {
    const dx = x * T - p().x;
    const dy = y * T - p().y;
    const l = Math.hypot(dx, dy);
    if (l < 1.5) break;
    const k = Math.min(1, l / 10 + 0.2);
    sim.submit({ type: 'MOVE', x: (dx / l) * k, y: (dy / l) * k, run: false, sneak: false });
    sim.step();
  }
  bot.stop();
}

/** The camp's uses as the prompt sees them. */
function uses(sim: Simulation): PlacedUse[] {
  const onFoot = sim.state.onFoot;
  const map = onFoot === null ? undefined : land.maps.get(onFoot.zone);
  if (onFoot === null || map === undefined) return [];
  return campUses(sim.state, camp, map, onFoot.actors);
}

const STAGES = [
  { name: 'the lean-to up, the first night', query: 'camp=broch&fire=lit', bed: 'bed_s0' },
  { name: 'the sail still folded', query: 'camp=broch&fire=lit&shelter=down', bed: 'bed_s0' },
  { name: 'only the frame standing', query: 'camp=broch&fire=lit&shelter=frame', bed: 'bed_s0' },
  {
    name: 'the shelter finished, the household home',
    query: 'camp=broch&fire=lit&stage=S1&day=2&crew=1',
    bed: 'bed_s1',
  },
  { name: 'the lean-to, the household home', query: 'camp=broch&fire=lit&crew=1', bed: 'bed_s0' },
] as const;

/** Eight sides, three tiles out from the bed's middle, inside the broch's court where it can be. */
const SIDES: readonly [string, number, number][] = [
  ['north', 0, -1],
  ['north-east', 1, -1],
  ['east', 1, 0],
  ['south-east', 1, 1],
  ['south', 0, 1],
  ['south-west', -1, 1],
  ['west', -1, 0],
  ['north-west', -1, -1],
];

describe("the steerer's bed: reachable and usable from every side (the user's fourth playtest, DH-3)", () => {
  for (const stage of STAGES) {
    for (const [side, sx, sy] of SIDES) {
      it(`${stage.name}: walked to from the ${side} at 21:30 and slept in`, () => {
        const bed = bedSite(stage.bed);
        const cx = (bed.area.x0 + bed.area.x1) / 2;
        const cy = (bed.area.y0 + bed.area.y1) / 2;
        const { sim, events, bot } = start(
          `${stage.query}&time=21:30&at=${(35.5 + sx * 2.5).toFixed(2)},${(32.0 + sy * 2.5).toFixed(2)}`,
        );
        // The near edge of the bed from that side (the last step onto it).
        const x = Math.min(bed.area.x1 - 0.1, Math.max(bed.area.x0 + 0.1, cx + sx * 1.2));
        const y = Math.min(bed.area.y1 - 0.05, Math.max(bed.area.y0 + 0.15, cy + sy * 0.6));
        walkOnto(sim, bot, x, y);
        const p = sim.state.onFoot?.player;
        if (p === undefined) throw new Error('not on foot');
        const near = campUseNear(uses(sim), p, land.rules.interactRadiusTiles * T);
        expect(
          near?.use.kind,
          `the prompt at (${(p.x / T).toFixed(2)}, ${(p.y / T).toFixed(2)})`,
        ).toBe('SLEEP');
        sim.submit({ type: 'INTERACT' });
        sim.step();
        expect(events.some((e) => e.type === 'FELL_ASLEEP')).toBe(true);
        // Lying in the bed itself.
        const lying = sim.state.onFoot?.player;
        expect(lying?.sleep).not.toBeNull();
        expect(Math.hypot((lying?.x ?? 0) - bed.x * T, (lying?.y ?? 0) - bed.y * T)).toBeLessThan(
          1,
        );
      });
    }
  }

  it('anywhere on the bed sleeps there, by a key or a click, whatever lies beside it', () => {
    const bed = bedSite('bed_s0');
    // The sail folded at night: the frame's use lies 0.4 tiles from the bed's foot.
    for (const [x, y] of [
      [bed.area.x0 + 0.15, bed.area.y0 + 0.15],
      [bed.area.x1 - 0.15, bed.area.y0 + 0.15],
      [bed.area.x0 + 0.15, bed.area.y1 - 0.05],
      [bed.area.x1 - 0.15, bed.area.y1 - 0.05],
      [(bed.area.x0 + bed.area.x1) / 2, (bed.area.y0 + bed.area.y1) / 2],
    ] as const) {
      const { sim, events } = start(
        `camp=broch&fire=lit&shelter=down&time=22:00&at=${x.toFixed(2)},${y.toFixed(2)}`,
      );
      sim.submit({ type: 'INTERACT' });
      sim.step();
      expect(
        events.some((e) => e.type === 'FELL_ASLEEP'),
        `at (${x}, ${y})`,
      ).toBe(true);
      // Clicking any tile the bed covers.
      const c = start(
        `camp=broch&fire=lit&shelter=down&time=22:00&at=${x.toFixed(2)},${(y + 0.3).toFixed(2)}`,
      );
      c.sim.submit({ type: 'INTERACT_AT', tile: { tx: Math.floor(x), ty: Math.floor(y - 0.001) } });
      c.sim.step();
      expect(
        c.events.some((e) => e.type === 'FELL_ASLEEP'),
        `click at (${x}, ${y})`,
      ).toBe(true);
    }
  });

  it('before 18:00 the bed says when it can be slept in, from Book 10, even with Hild beside it', () => {
    const bed = bedSite('bed_s0');
    const { sim, events } = start(`camp=broch&fire=lit&time=15:00&at=${bed.x},${bed.y - 0.2}`);
    const p = sim.state.onFoot?.player;
    if (p === undefined) throw new Error('not on foot');
    const all = uses(sim);
    const onBed = all.find((u) => u.use.kind === 'REFUSE' && u.use.reason === 'TOO_EARLY_TO_SLEEP');
    expect(onBed).toBeDefined();
    if (onBed === undefined) return;
    expect(useDistance(onBed, p)).toBe(0);
    const label = campUseLabel(
      onBed.use,
      content,
      (k, v) => `${k}:${JSON.stringify(v ?? {})}`,
      (id) => id,
      'E',
      false,
    );
    expect(label.text).toContain(clockText(b.sleepAfter));
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(events.some((e) => e.type === 'FELL_ASLEEP')).toBe(false);
  });

  it("the bed is in the same place before and after the shelter is finished, and it is the steerer's alone", () => {
    const s0 = bedSite('bed_s0');
    const s1 = bedSite('bed_s1');
    expect([s1.x, s1.y]).toEqual([s0.x, s0.y]);
    expect(s1.area).toEqual(s0.area);
    // Nobody else's sleeping place falls on it, at either stage.
    const people = land.people;
    if (people == null) throw new Error('no people context');
    for (const q of [
      'camp=broch&crew=1&time=23:00',
      'camp=broch&crew=1&stage=S1&day=2&time=23:00',
    ]) {
      const { sim } = start(q);
      for (const id of sim.state.household.residents) {
        const spot = bedOf(sim.state, camp, people, id);
        const margin = 0.3;
        const inside =
          spot.x > s0.area.x0 - margin &&
          spot.x < s0.area.x1 + margin &&
          spot.y > s0.area.y0 - margin * 0.5 &&
          spot.y < s0.area.y1 - 0.15;
        expect(inside, `${id} sleeps at (${spot.x}, ${spot.y}) (${q})`).toBe(false);
      }
    }
  });

  it('the first evening of the finished shelter: sleeping where the steerer slept the night before', () => {
    const s0 = bedSite('bed_s0');
    // The lean-to's night slept; the shelter finished on day 2 in the afternoon.
    const { sim, events, bot } = start('camp=broch&fire=lit&crew=1&day=2&time=17:50&at=35.5,33.0');
    const home = sim.state.homes[camp.def.home];
    if (home === undefined) throw new Error('no home');
    home.stage = 'S1';
    sim.state.facts['ch1.shelter'] = 'FINISHED';
    if (!home.buildings.includes(camp.def.shelter.building))
      home.buildings.push(camp.def.shelter.building);
    bot.waitUntil(18 * 60 + 5);
    walkOnto(sim, bot, s0.x, s0.y - 0.3);
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(events.some((e) => e.type === 'FELL_ASLEEP')).toBe(true);
  });
});
