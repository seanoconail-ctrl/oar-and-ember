import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { SearchBot } from '../../src/tools/play/searchBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const camp = land.camp!;
const search = land.searches!;
const TILE = 24;

function start(seed: string) {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams('camp=broch&time=10:00'));
  world.player.hotbar.slots[0] = 'ITEM_SEAX';
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  const bot = new SearchBot(sim, b, land, camp, search);
  sim.step();
  return { world: sim.state, sim, bot, events };
}

describe('probe', () => {
  for (const seed of ['p1', 'p2', 'p3', 'p4']) {
    it(`lift downed Bran at the fold ${seed}`, () => {
      const { world, sim, bot, events } = start(seed);
      bot.goToZone('ZONE_SK_CAIRN');
      const onFoot = world.onFoot!;
      const bran = onFoot.actors['C_BRAN']!;
      const home = { x: bran.x, y: bran.y };
      const slots = world.player.hotbar.slots;
      sim.submit({ type: 'SELECT_SLOT', slot: slots.indexOf('ITEM_SEAX') });
      bot.fightAll();
      bot.waitFor(() => world.facts['search.bran'] !== undefined, 60 * 30);
      console.log(seed, 'after fight bran', bran.pose, bran.fight?.f.state, (bran.x - home.x) / TILE, (bran.y - home.y) / TILE);
      if (bran.pose !== 'down') {
        // Down him where he stands, as a blow would.
        const fa = bran.fight;
        if (fa !== undefined) {
          fa.vitality = 0;
          fa.f.state = 'downed';
          fa.f.since = world.tick;
        }
        bran.pose = 'down';
        world.people['C_BRAN']!.status = 'downed';
      }
      const t0 = Date.now();
      let err: unknown = null;
      try {
        bot.lift('C_BRAN');
        for (let i = 0; i < 600; i++) {
          const s = Date.now();
          bot.step();
          if (Date.now() - s > 100) console.log('slow', i, Date.now() - s);
        }
      } catch (e) {
        err = e;
      }
      console.log(seed, 'lift', err, onFoot.carrying, Date.now() - t0, world.tick);
      console.log(events.filter((e) => e.type === 'COMMAND_REFUSED').slice(-3));
      expect(true).toBe(true);
    });
  }
});
