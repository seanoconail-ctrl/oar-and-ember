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
 * - Golden save 5 (schema 5, Stage 7) is frozen: the opening as golden 4 played it to the bow, then
 *   Hild leads to the broch; driftwood is gathered on the strand, the fire lit, her leg tended, a
 *   hot meal cooked, the hand line picked up and a start made on the sail shelter; the steerer
 *   sleeps by the fire and wakes to the morning report, then fishes from the shore on day 2 while
 *   Hild fishes from the rocks, and the save is made at 15:00. It must load through the migration.
 * - Golden save 6 (schema 6, Stage 8): the same day, played with Stage 8's people: Hild goes to her
 *   work from the camp at once; her leg is tended through the talk about it; at dawn on day 2 the
 *   steerer talks with her by the fire about her father and asks her to keep the camp instead of
 *   fishing, then fishes from the shore; the save is made at 15:00.
 *
 *   It is frozen from Stage 9 and must load through the migration chain.
 * - Golden save 7 (schema 7, Stage 9): the same day played again, with Second wind turned on; on the
 *   strand after the broch the three wreck-scavengers are there by the wreck at the west end, out
 *   of sight of the steerer fishing at the east end; the steerer takes the seax in hand, strikes
 *   once at nothing, parries and dodges, and the save is made at 15:00. Since the playtest change
 *   (decisions PT-1 to PT-4) the driftwood is picked up where it lies at the east end (three
 *   pieces, kept in the region's resource nodes, two of them washed up again at dawn) and the
 *   camp's other work is a plain action; the save's shape is unchanged.
 *
 * - Golden save 8 (schema 8, Stage 10): the opening, then the three searches (Oddi chest first, a
 *   confession at the Hag's Seat, the silver for Thorkel's body). Frozen from Stage 11.
 * - Golden save 9 (schema 9, Stage 11): golden 8's day played on: the salvaged boards carried to the
 *   boat, the rigging cut from the wreck at low water and carried back, the steering oar traded for
 *   salt fish at Seal Cave, the boat worked by hand and by Runa until all three repairs are done,
 *   and an extended hold fitted.
 *
 *   Frozen from Stage 12.
 * - Golden save 10 (schema 10, Stage 12): golden 9's day played on: Thorkel given to the sea with
 *   his ring, the launch asked for at the boat, the tide waited for, the boat named Grey Seal and
 *   its sail marked with broad madder stripes, the scene played to the sea map, the map closed: the
 *   chapter-end save (Book 3 Stage 12's "golden save 2", numbered 10 after the frozen nine,
 *   decision S12-20).
 *
 *   node src/tools/saves/golden.ts        rewrites tests/golden-saves/golden-10.json
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
import { playToCamp, WreckBot } from '../play/wreckBot.ts';
import { SearchBot } from '../play/searchBot.ts';
import { LaunchBot } from '../play/launchBot.ts';

export const GOLDEN_01 = 'tests/golden-saves/golden-01.json';
export const GOLDEN_02 = 'tests/golden-saves/golden-02.json';
export const GOLDEN_03 = 'tests/golden-saves/golden-03.json';
export const GOLDEN_04 = 'tests/golden-saves/golden-04.json';
export const GOLDEN_05 = 'tests/golden-saves/golden-05.json';
export const GOLDEN_06 = 'tests/golden-saves/golden-06.json';
export const GOLDEN_07 = 'tests/golden-saves/golden-07.json';
export const GOLDEN_08 = 'tests/golden-saves/golden-08.json';
export const GOLDEN_09 = 'tests/golden-saves/golden-09.json';
export const GOLDEN_10 = 'tests/golden-saves/golden-10.json';

export function goldenWorld06(): WorldState {
  return goldenDay('golden-06', null);
}

/** Golden save 7 (Stage 9): golden 6's day with Second wind on and a few blows into the air. */
export function goldenWorld07(): WorldState {
  return goldenDay('golden-07', (sim) => {
    sim.submit({ type: 'SELECT_SLOT', slot: 0 });
    sim.step();
    sim.submit({ type: 'MELEE', facing: 'e' });
    sim.step();
    sim.submit({ type: 'MELEE_RELEASE' });
    for (let i = 0; i < 60; i++) sim.step();
    sim.submit({ type: 'PARRY' });
    for (let i = 0; i < 40; i++) sim.step();
    sim.submit({ type: 'DODGE', x: 0, y: -1 });
    for (let i = 0; i < 40; i++) sim.step();
  });
}

/**
 * Golden save 8 (Stage 10): the opening played, Hild led to the broch, then the three searches:
 * Thorkel's chest carried off the strand before Oddi, a confession at the Hag's Seat and Runa home
 * over the neck, and the chest's silver for Thorkel's body at the sheepfold; Bran lays him by the
 * broch.
 */
export function goldenWorld08(): WorldState {
  const balance = loadBalanceJson();
  const b = parseTimeBalance(balance);
  const { content, issues } = loadContentFromDisk();
  if (issues.length > 0)
    throw new Error(`content has ${issues.length} problem(s); run npm run content:lint`);
  const world = newCampaign('golden-08', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  const land = landContext(content, balance);
  const camp = campContext(content);
  const strand = land.maps.get('ZONE_SK_STRAND');
  const searches = land.searches;
  if (strand === undefined || camp === null || searches == null)
    throw new Error('no Wreck Strand, camp or searches');
  const sim = createSimulation(b, world, land);
  // Design addendum 2.4: the seax, Hild cut free, Thorkel's chest to the camp, the sail raised;
  // the searches' people are out there from the first dusk (decision DE-16).
  playToCamp(sim, b, land, camp);
  const bot = new SearchBot(sim, b, land, camp, searches);
  bot.waitUntil(19 * 60 + 5);
  bot.oddi('CHEST_FIRST');
  bot.runa('OFFERING');
  bot.bran('BARGAIN');
  bot.waitFor(() => sim.state.facts['ch1.thorkel_body'] === 'CAMP', 60 * 600);
  return sim.state;
}

/** Golden save 9 (Stage 11): golden 8's searches, then the repairs, the oar and a fitting. */
export function goldenWorld09(): WorldState {
  const balance = loadBalanceJson();
  const b = parseTimeBalance(balance);
  const { content } = loadContentFromDisk();
  const land = landContext(content, balance);
  const camp = campContext(content);
  if (camp === null || land.searches == null || land.repairs == null)
    throw new Error('no camp, searches or repairs');
  const world = goldenWorld08();
  const sim = createSimulation(b, world, land);
  const bot = new WreckBot(sim, b, land, camp, land.searches, land.repairs);
  // Design addendum 2.4: his key, his chest opened on the bow, and the stores shot down from the
  // mast (Book 4 beats 14 and 15), before the repairs.
  bot.goToZone('ZONE_SK_MACHAIR');
  bot.takeKey();
  bot.openChest();
  bot.shootLashing({ x: 41.5, y: 27.5 });
  bot.storesToCamp();
  bot.boards();
  bot.rigging();
  bot.oar('TRADE');
  bot.workUntil(() => sim.state.facts['ch1.boat_ready'] === true, 400);
  bot.fit('HOLD');
  return sim.state;
}

/** Golden save 10 (Stage 12): golden 9's day on to the rites, the launch and the chapter's end. */
export function goldenWorld10(): WorldState {
  const balance = loadBalanceJson();
  const b = parseTimeBalance(balance);
  const { content } = loadContentFromDisk();
  const land = landContext(content, balance);
  const camp = campContext(content);
  if (camp === null || land.searches == null || land.repairs == null)
    throw new Error('no camp, searches or repairs');
  const world = goldenWorld09();
  const sim = createSimulation(b, world, land);
  const bot = new LaunchBot(sim, b, land, camp, land.searches, land.repairs);
  // In the evening Hild is by the camp's fire, near her father on his bier.
  bot.goToZone('ZONE_SK_MACHAIR');
  bot.waitUntil(18 * 60 + 30);
  bot.rites('SEA');
  bot.goToZone('ZONE_SK_STRAND');
  bot.waitForWater();
  bot.askToLaunch();
  bot.launch('Grey Seal', 'stripes_broad', 'madder', 20);
  bot.step(60);
  return sim.state;
}

export function goldenSave10(): SaveFile {
  return writeSave(goldenWorld10(), {
    build: 'golden',
    kind: 'checkpoint',
    slot: 'checkpoint:golden-10',
    label: 'golden-10',
    sequence: 1,
    savedAt: '2026-11-12T12:00:00.000Z',
  });
}

export function goldenSave09(): SaveFile {
  return writeSave(goldenWorld09(), {
    build: 'golden',
    kind: 'checkpoint',
    slot: 'checkpoint:golden-09',
    label: 'golden-09',
    sequence: 1,
    savedAt: '2026-11-12T00:00:00.000Z',
  });
}

export function goldenSave08(): SaveFile {
  return writeSave(goldenWorld08(), {
    build: 'golden',
    kind: 'checkpoint',
    slot: 'checkpoint:golden-08',
    label: 'golden-08',
    sequence: 1,
    savedAt: '2026-11-11T00:00:00.000Z',
  });
}

function goldenDay(
  seed: string,
  stage9: ((sim: ReturnType<typeof createSimulation>) => void) | null,
): WorldState {
  const balance = loadBalanceJson();
  const b = parseTimeBalance(balance);
  const { content, issues } = loadContentFromDisk();
  if (issues.length > 0)
    throw new Error(`content has ${issues.length} problem(s); run npm run content:lint`);
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'B',
  });
  if (stage9 !== null) world.options.secondWind = true;
  const land = landContext(content, balance);
  const camp = campContext(content);
  const strand = land.maps.get('ZONE_SK_STRAND');
  if (strand === undefined || camp === null) throw new Error('no Wreck Strand or camp');
  const sim = createSimulation(b, world, land);
  // Design addendum 2.4: the seax, Hild cut free, Thorkel's chest carried up to the camp and the
  // sail raised; back down to pick up driftwood where it lies (decision PT-2: two pieces make the
  // first fire's load, a third for the stack), and up again.
  const bot: CampBot = playToCamp(sim, b, land, camp);
  bot.goToZone('ZONE_SK_STRAND');
  bot.pickUp('drift_east_rocks');
  bot.pickUp('drift_east_tide');
  bot.pickUp('drift_east_bank');
  bot.goToZone('ZONE_SK_MACHAIR');
  bot.doAt('fire');
  // Hild walks up at the fire's smoke (decision DE-16), and her leg is seen to.
  bot.waitFor(() => sim.state.facts['ch1.hild_walked_up'] === true, 60 * 240);
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
  // Day 2, at dawn by the fire (Stage 8): a word with Hild about her father over the morning
  // meal, and her work changed from fishing to keeping the camp.
  bot.talkTo('C_HILD');
  bot.choose('ui.talk.topic.father');
  bot.choose('p_steerer.talk.what_like');
  bot.choose('p_steerer.talk.we_look');
  bot.choose('ui.talk.topic.job');
  bot.choose('p_steerer.talk.job.camp');
  // Down to the shore to fish while Hild keeps the camp.
  bot.goToZone('ZONE_SK_STRAND');
  bot.goToWater();
  bot.fish();
  bot.fish('late');
  if (stage9 !== null) stage9(sim);
  bot.waitUntil(15 * 60);
  return sim.state;
}

export function goldenSave06(): SaveFile {
  return writeSave(goldenWorld06(), {
    build: 'golden',
    kind: 'checkpoint',
    slot: 'checkpoint:golden-06',
    label: 'golden-06',
    sequence: 1,
    savedAt: '2026-11-11T00:00:00.000Z',
  });
}

export function goldenSave07(): SaveFile {
  return writeSave(goldenWorld07(), {
    build: 'golden',
    kind: 'checkpoint',
    slot: 'checkpoint:golden-07',
    label: 'golden-07',
    sequence: 1,
    savedAt: '2026-11-11T00:00:00.000Z',
  });
}

if (import.meta.filename === process.argv[1]) {
  // Golden saves 1 to 9 are frozen (Book 2 section 20): only the newest is written.
  writeFileSync(join(REPO_ROOT, GOLDEN_10), `${JSON.stringify(goldenSave10(), null, 2)}\n`);
  console.log(`wrote ${GOLDEN_10}`);
}
