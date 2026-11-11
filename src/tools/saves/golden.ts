/**
 * Golden saves (Book 2 section 20): fixed scenarios saved to tests/golden-saves/ so every later
 * schema change must migrate them.
 *
 * - Golden save 1 (schema 1, Stage 3) is frozen: a new campaign played through two on-foot days
 *   (a sleep after 18:00, then a collapse at 02:00) with the opening one-shot fired. It is never
 *   rewritten; it must load through the migration chain.
 * - Golden save 2 (schema 2, Stage 6) is frozen: the steerer named and embodied, Hild carried
 *   above the tide line by the scripted player, then the same two days. It must load through the
 *   migration chain.
 * - Golden save 3 (schema 3, the Stage 6 rework) is frozen: the same scenario with the hotbar
 *   (the bow and seax the steerer then woke with), Hild standing in the shallows and the water's
 *   depth bands. It must load through the migration chain.
 * - Golden save 4 (schema 4, starting weapons and missiles) is frozen: the steerer wakes
 *   empty-handed, picks up the seax, rescues Hild, fetches the bow and quiver she names, looses
 *   one arrow into the stern's timber, and then the same two days. It must load through the
 *   migration chain.
 * - Golden save 5 (schema 5, Stage 7): the opening as golden 4 played it to the bow, then Hild leads
 *   to the broch; driftwood is gathered on the strand, the fire lit, her leg tended, a hot meal
 *   cooked, the hand line picked up and a start made on the sail shelter; the steerer sleeps by the
 *   fire and wakes to the morning report, then fishes from the shore on day 2 while Hild fishes from
 *   the rocks, and the save is made at 15:00.
 *
 *   node src/tools/saves/golden.ts        rewrites tests/golden-saves/golden-05.json
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePeopleBasics, parseTimeBalance } from '../../content/balance.ts';
import { writeSave } from '../../persist/save.ts';
import type { SaveFile } from '../../persist/save.ts';
import { campContext } from '../../sim/home/camp.ts';
import { landContext } from '../../sim/land/context.ts';
import { createSimulation } from '../../sim/simulation.ts';
import { newCampaign } from '../../sim/world.ts';
import type { WorldState } from '../../sim/world.ts';
import { REPO_ROOT } from '../art/loadTitleArt.ts';
import { loadBalanceJson } from '../content/loadBalance.ts';
import { loadContentFromDisk } from '../content/loadContentFiles.ts';
import { CampBot } from '../play/campBot.ts';
import { OpeningBot } from '../play/openingBot.ts';

export const GOLDEN_01 = 'tests/golden-saves/golden-01.json';
export const GOLDEN_02 = 'tests/golden-saves/golden-02.json';
export const GOLDEN_03 = 'tests/golden-saves/golden-03.json';
export const GOLDEN_04 = 'tests/golden-saves/golden-04.json';
export const GOLDEN_05 = 'tests/golden-saves/golden-05.json';

export function goldenWorld05(): WorldState {
  const balance = loadBalanceJson();
  const b = parseTimeBalance(balance);
  const { content, issues } = loadContentFromDisk();
  if (issues.length > 0)
    throw new Error(`content has ${issues.length} problem(s); run npm run content:lint`);
  const world = newCampaign('golden-05', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'B',
  });
  const land = landContext(content, balance);
  const camp = campContext(content);
  const strand = land.maps.get('ZONE_SK_STRAND');
  if (strand === undefined || camp === null) throw new Error('no Wreck Strand or camp');
  const sim = createSimulation(b, world, land);
  const opening = new OpeningBot(sim, strand, b, land);
  opening.pickUp('wreck_seax');
  opening.rescue('C_HILD');
  opening.waitFor(() => sim.state.facts['ch1.bow_named'] === true);
  opening.pickUp('stern_bow');
  const bot = new CampBot(sim, b, land, camp);
  // Driftwood from the weed line, then up to the broch Hild has led to.
  bot.doAt('wrack_1');
  bot.doAt('wrack_2', 'late');
  bot.goToZone('ZONE_SK_MACHAIR');
  bot.goToSite('stores');
  bot.waitFor(() => sim.state.facts['ch1.at_broch'] === true);
  bot.doAt('fire');
  bot.tend('C_HILD');
  bot.doAt('fire');
  // The hand line in the salvage, and a start on the sail shelter.
  bot.goToSite('stores');
  const line = sim.state.onFoot?.items.find((i) => i.key === 'camp_line');
  if (line !== undefined) {
    bot.walkTo((t) => t.tx === Math.floor(line.x) && t.ty === Math.floor(line.y - 0.001));
    bot.interact();
  }
  bot.doAt('shelter');
  bot.doAt('shelter', 'none');
  // Night by the fire.
  bot.waitUntil(b.sleepAfter + 15);
  bot.goToSite('bed_s0');
  sim.submit({ type: 'SLEEP' });
  bot.waitFor(() => sim.state.calendar.day === 2);
  // Day 2: down to the shore to fish while Hild fishes from the rocks.
  bot.goToZone('ZONE_SK_STRAND');
  bot.goToWater();
  bot.fish();
  bot.fish('late');
  bot.waitUntil(15 * 60);
  return sim.state;
}

export function goldenSave05(): SaveFile {
  return writeSave(goldenWorld05(), {
    build: 'golden',
    kind: 'checkpoint',
    slot: 'checkpoint:golden-05',
    label: 'golden-05',
    sequence: 1,
    savedAt: '2026-11-11T00:00:00.000Z',
  });
}

if (import.meta.filename === process.argv[1]) {
  writeFileSync(join(REPO_ROOT, GOLDEN_05), `${JSON.stringify(goldenSave05(), null, 2)}\n`);
  console.log(`wrote ${GOLDEN_05}`);
}
