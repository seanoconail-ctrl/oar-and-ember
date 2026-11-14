import { parsePeopleBasics, parseTimeBalance } from '../content/balance.ts';
import { campHooks } from '../scenes/camp.ts';
import { campUseNear } from '../sim/home/camp.ts';
import { landContext } from '../sim/land/context.ts';
import { placedUsesHere } from '../sim/narrative/uses.ts';
import { createSimulation } from '../sim/simulation.ts';
import { newCampaign } from '../sim/world.ts';
import { loadBalanceJson } from './content/loadBalance.ts';
import { loadContentFromDisk } from './content/loadContentFiles.ts';
const balance = loadBalanceJson(); const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk(); const land = landContext(content, balance);
for (const q of process.argv.slice(2)) {
  const world = newCampaign('x', b, parsePeopleBasics(balance), content, { name: 'Ash', bodyModel: 'A' });
  const sim = createSimulation(b, world, land);
  campHooks(sim.state, content, land, new URLSearchParams(q));
  const ev: string[] = []; sim.events.onAny((e) => ev.push(JSON.stringify(e).slice(0, 140)));
  sim.step();
  const map = land.maps.get(sim.state.onFoot!.zone)!; const p = sim.state.onFoot!.player;
  const uses = placedUsesHere(sim.state, { camp: land.camp, searches: land.searches, finds: land.finds, island: land.island, raid: land.raid }, map);
  console.log(q, sim.state.calendar, 'near:', JSON.stringify(campUseNear(uses, p, land.rules.interactRadiusTiles * map.tile)?.use));
  ev.length = 0; sim.submit({ type: 'INTERACT' }); sim.step(); console.log(ev.join('\n'));
}
