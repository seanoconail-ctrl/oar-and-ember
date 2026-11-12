/**
 * Stage 11 (Book 4 section 08, beats 4 to 6): the three repairs, the steering oar by each of its
 * four ways, crew work while the steerer is away, one reversible fitting, and Thorkel's rites. A
 * scripted player (src/tools/play/repairBot.ts) plays each from the camp at the broch with the
 * searches done (`crew=1`), submitting commands as the input layer would. Check 3: no repair asks
 * for a count of a resource; each material is one load.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parseShipBalance } from '../../src/content/shipBalance.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { findActor } from '../../src/sim/land/zoneLinks.ts';
import { boatOf } from '../../src/sim/narrative/repairs.ts';
import { deriveStats } from '../../src/sim/ship/ship.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { RepairBot } from '../../src/tools/play/repairBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const ship = parseShipBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const camp = land.camp;
const search = land.searches;
const repairs = land.repairs;
if (camp == null || search == null || repairs == null) throw new Error('no content');

function start(seed: string, hooks = 'camp=broch&crew=1&time=08:00') {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams(hooks));
  world.player.hotbar.slots[0] = 'ITEM_SEAX';
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  if (camp == null || search == null || repairs == null) throw new Error('no content');
  const bot = new RepairBot(sim, b, land, camp, search, repairs);
  sim.step();
  return { world: sim.state, sim, bot, events };
}

/** Seal Cave at low water: set off from the broch in the afternoon (the flats open at 16:30). */
const CAVE = 'camp=broch&crew=1&time=15:40';

const done = (events: SimEvent[]) =>
  events.flatMap((e) => (e.type === 'REPAIR_DONE' ? [e.repair] : []));

describe('the boat lies wrecked on the strand (Book 4 beat 4)', () => {
  it('is the household’s T1 coastal boat, lacking hull boards, rigging and steering oar', () => {
    const { world } = start('wrecked');
    const boat = boatOf(world);
    expect(boat?.hull).toBe('HULL_COASTAL_BOAT');
    expect(boat?.lies.zone).toBe('ZONE_SK_STRAND');
    expect(boat?.integrity).toBe(ship.repairs.wreckedIntegrity);
    if (boat === null || land.repairs == null) throw new Error('no boat');
    const s = deriveStats(boat, land.repairs.ship, 4);
    expect(s.lacks).toEqual(['HULL', 'RIGGING', 'STEERING_OAR']);
    expect(s.seaworthy).toBe(false);
    // The salvaged boards lie in the debris, one load (check 3: no count to gather).
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('not on foot');
    expect(findActor(onFoot, 'ITEM_BOARDS')?.zone).toBe('ZONE_SK_STRAND');
  });
});

describe('the hull: the salvaged boards carried to the boat, then worked', () => {
  it('a resident with the shipwright’s job patches the hull while the steerer is away', () => {
    const { world, bot, events } = start('hull');
    bot.boards();
    expect(boatOf(world)?.repairs.HULL.stage).toBe('MATERIALS');
    expect(events).toContainEqual({ type: 'MATERIAL_LAID', repair: 'HULL' });
    // Runa takes up the boat (her next job once there is work at it); the steerer goes north to
    // the Kelda and waits there, out of sight of the strand.
    bot.goToZone('ZONE_SK_MACHAIR');
    bot.waitFor(() => boatOf(world)?.repairs.HULL.stage === 'DONE', 60 * 60 * 120);
    expect(done(events)).toEqual(['HULL']);
    expect(boatOf(world)?.integrity).toBe(ship.repairs.patchedIntegrity);
    expect(boatOf(world)?.history.map((h) => h.kind)).toEqual(['FOUND', 'REPAIRED']);
  });

  it('the steerer’s own hands add to it (a plain action, no timing)', () => {
    const { world, bot } = start('hull-hand');
    bot.boards();
    const before = boatOf(world)?.repairs.HULL.progress ?? 0;
    bot.workOnBoat();
    expect(boatOf(world)?.repairs.HULL.progress ?? 0).toBeGreaterThan(before);
  });
});

describe('the rigging: cut from the wreck on the skerry at low water', () => {
  it('is reached only at low water, cut in one action, and carried back as one load', () => {
    const { world, bot, events } = start('rigging');
    bot.rigging();
    expect(world.facts['repair.rigging_cut']).toBe(true);
    expect(events).toContainEqual({ type: 'RIGGING_CUT' });
    expect(boatOf(world)?.repairs.RIGGING.stage).toBe('MATERIALS');
    bot.workUntil(() => boatOf(world)?.repairs.RIGGING.stage === 'DONE', 400);
    expect(done(events)).toContain('RIGGING');
  });
});

describe('the steering oar from Seal Cave: fight, theft, trade or carving', () => {
  it('TRADE: the scavengers hold a parley; Thorkel’s silver buys the oar', () => {
    const { world, bot, events } = start('oar-trade', CAVE);
    bot.oar('TRADE');
    expect(world.facts['repair.oar']).toBe('TRADE');
    expect(world.facts['ch1.chest']).toBe('GIVEN');
    expect(boatOf(world)?.repairs.STEERING_OAR).toMatchObject({ stage: 'MATERIALS', how: 'TRADE' });
    expect(events).toContainEqual({ type: 'CHECKPOINT', label: 'sealcave' });
    expect(world.ledger.some((d) => d.tag === 'THEFT')).toBe(false);
  });

  it('THEFT: by night at low water, sneaking in over the flats unseen: a theft with no witness', () => {
    const { world, bot } = start('oar-theft', 'camp=broch&crew=1&time=02:20');
    bot.oar('THEFT');
    expect(world.facts['repair.oar']).toBe('THEFT');
    const theft = world.ledger.find((d) => d.tag === 'THEFT');
    expect(theft?.witnesses).toEqual([]);
    expect(world.onFoot?.battle?.engaged ?? false).toBe(false);
    expect(theft?.victims.length).toBe(3);
    expect(boatOf(world)?.repairs.STEERING_OAR.stage).toBe('MATERIALS');
  });

  it('a theft seen at the parley is a theft in plain sight: the fight is on', () => {
    const { world, bot, events } = start('oar-seen', CAVE);
    bot.meetScavengers();
    bot.takeOar();
    expect(world.facts['repair.oar']).toBe('THEFT');
    expect(world.ledger.find((d) => d.tag === 'THEFT')?.witnesses.length).toBeGreaterThan(0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'FIGHT_STARTED' }));
  });

  it('FIGHT: a threat at the parley, the scavenger beaten, the oar taken after', () => {
    // After the fight at the fold two lie dead there; the one who ran is at the skiff. A careful
    // player wins this fight in most seeds.
    let won = 0;
    for (const seed of ['oar-fight-1', 'oar-fight-2', 'oar-fight-3', 'oar-fight-4']) {
      const { world, bot } = start(seed, 'camp=broch&crew=1&wreckers=beaten&time=15:40');
      try {
        bot.oar('FIGHT');
      } catch {
        continue;
      }
      if (world.facts['repair.oar'] === 'FIGHT') won++;
    }
    expect(won).toBeGreaterThanOrEqual(2);
  }, 120_000);

  it('CARVE: Runa carves a new one over two days at her work; then it is shipped', () => {
    const { world, bot, events } = start('oar-carve');
    bot.oar('CARVE');
    expect(world.facts['repair.oar']).toBe('CARVED');
    expect(events).toContainEqual({ type: 'OAR_CARVED' });
    expect(world.calendar.day).toBeGreaterThanOrEqual(2);
    bot.waitFor(() => boatOf(world)?.repairs.STEERING_OAR.stage === 'DONE', 60 * 60 * 120);
    // Two game days of Runa's work: longer than five seconds on a shared CI runner.
  }, 60_000);
});

describe('one reversible fitting (Book 4 beat 5)', () => {
  it('an extended hold fitted changes deriveStats; taken off, the boat is as it was', () => {
    const { world, bot, events } = start('fit', 'camp=broch&crew=1&ship=hull,rig,oar&time=08:00');
    const boat = boatOf(world);
    if (boat === null || land.repairs == null) throw new Error('no boat');
    const bare = deriveStats(boat, land.repairs.ship, 4);
    bot.fit('HOLD');
    const held = deriveStats(boat, land.repairs.ship, 4);
    expect(held.cargoSlots).toBe(bare.cargoSlots + 1);
    expect(events).toContainEqual({ type: 'FITTING_DONE', fitting: 'FIT_EXTENDED_HOLD' });
    expect(world.oneShots['BEAT_1_CUSTOMISE']).toBeDefined();
    bot.unshipFitting();
    expect(deriveStats(boat, land.repairs.ship, 4)).toEqual(bare);
    bot.fit('BOW');
    expect(deriveStats(boat, land.repairs.ship, 4).boardingDefencePercent).toBeGreaterThan(0);
  });
});

describe('all three repairs make the boat seaworthy', () => {
  it('fires the beat and Hild’s line once the last is done', () => {
    const { world, bot, events } = start(
      'ready',
      'camp=broch&crew=1&ship=hull,rig&lay=oar&time=08:00',
    );
    bot.workUntil(() => world.facts['ch1.boat_ready'] === true, 40);
    expect(world.oneShots['BEAT_1_REPAIRS']).toBeDefined();
    expect(events).toContainEqual({ type: 'BOAT_READY' });
    const boat = boatOf(world);
    if (boat === null || land.repairs == null) throw new Error('no boat');
    expect(deriveStats(boat, land.repairs.ship, 4).seaworthy).toBe(true);
  });
});

describe('Thorkel’s rites (Book 4 beat 6)', () => {
  it.each([
    ['SETTING', 'SHIP_SETTING', 'HILD'],
    ['SEA', 'SEA_BURIAL', 'RAN'],
  ] as const)(
    '%s: Hild asks at the bier, the household gathers, the rite is remembered',
    (form, fact, ring) => {
      const { world, bot, events } = start(`rites-${form}`, 'camp=broch&crew=1&time=17:45');
      const hild = world.people['C_HILD'];
      const before = hild?.friendship ?? 0;
      bot.rites(form);
      expect(world.facts['ch1.rites']).toBe(fact);
      expect(world.facts['ch1.thorkel_ring']).toBe(ring);
      expect(world.oneShots['BEAT_1_RITES']).toBeDefined();
      expect(events).toContainEqual({ type: 'RITES_BEGAN', form });
      expect(events).toContainEqual({ type: 'RITES_DONE', form });
      // Hild (Kin 3) values the rite; everyone remembers it.
      expect(hild?.friendship ?? 0).toBeGreaterThan(before);
      expect(hild?.memories.some((m) => m.about === 'THORKEL_RITES')).toBe(true);
      const onFoot = world.onFoot;
      if (onFoot === null) throw new Error('not on foot');
      expect(findActor(onFoot, 'C_THORKEL')).toBeNull();
      if (form === 'SEA')
        expect(typeof (world.powers['POWER_RAN'] as { thorkelRing?: unknown }).thorkelRing).toBe(
          'number',
        );
    },
  );
});
