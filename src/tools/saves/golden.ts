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
 * - Golden save 4 (schema 4, starting weapons and missiles): the steerer wakes empty-handed, picks
 *   up the seax from the wreck's debris, rescues Hild, fetches the bow and quiver she names from
 *   the wreck's stern, looses one arrow into the stern's timber, and then the same two days.
 *
 *   node src/tools/saves/golden.ts        rewrites tests/golden-saves/golden-04.json
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePeopleBasics, parseTimeBalance } from '../../content/balance.ts';
import { writeSave } from '../../persist/save.ts';
import type { SaveFile } from '../../persist/save.ts';
import { landContext } from '../../sim/land/context.ts';
import { createSimulation } from '../../sim/simulation.ts';
import { newCampaign } from '../../sim/world.ts';
import type { WorldState } from '../../sim/world.ts';
import { REPO_ROOT } from '../art/loadTitleArt.ts';
import { loadBalanceJson } from '../content/loadBalance.ts';
import { loadContentFromDisk } from '../content/loadContentFiles.ts';
import { OpeningBot } from '../play/openingBot.ts';

export const GOLDEN_01 = 'tests/golden-saves/golden-01.json';
export const GOLDEN_02 = 'tests/golden-saves/golden-02.json';
export const GOLDEN_03 = 'tests/golden-saves/golden-03.json';
export const GOLDEN_04 = 'tests/golden-saves/golden-04.json';

export function goldenWorld04(): WorldState {
  const balance = loadBalanceJson();
  const b = parseTimeBalance(balance);
  const { content, issues } = loadContentFromDisk();
  if (issues.length > 0)
    throw new Error(`content has ${issues.length} problem(s); run npm run content:lint`);
  const world = newCampaign('golden-04', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'B',
  });
  const land = landContext(content, balance);
  const sim = createSimulation(b, world, land);
  const strand = land.maps.get('ZONE_SK_STRAND');
  if (strand === undefined) throw new Error('no Wreck Strand map');
  const bot = new OpeningBot(sim, strand, b, land);
  bot.pickUp('wreck_seax');
  bot.rescue('C_HILD');
  bot.waitFor(() => sim.state.facts['ch1.bow_named'] === true);
  bot.pickUp('stern_bow');
  bot.selectItem('ITEM_BOW');
  // One arrow loosed at a full draw into the stern's timber, east of the bow.
  bot.shoot(0, 3.5, land.missiles.bow.drawTicks);
  bot.waitFor(() => sim.state.onFoot?.projectiles.length === 0);
  // Day 1: play to 19:00 and sleep.
  while (sim.state.calendar.minuteOfDay !== 19 * 60) sim.step();
  sim.submit({ type: 'SLEEP' });
  sim.step();
  // Day 2: stay up until the collapse at 02:00; wake at 08:00 on day 3.
  while (sim.state.calendar.day < 3) sim.step();
  return sim.state;
}

export function goldenSave04(): SaveFile {
  return writeSave(goldenWorld04(), {
    build: 'golden',
    kind: 'checkpoint',
    slot: 'checkpoint:golden-04',
    label: 'golden-04',
    sequence: 1,
    savedAt: '2026-11-10T00:00:00.000Z',
  });
}

if (import.meta.filename === process.argv[1]) {
  writeFileSync(join(REPO_ROOT, GOLDEN_04), `${JSON.stringify(goldenSave04(), null, 2)}\n`);
  console.log(`wrote ${GOLDEN_04}`);
}
