/**
 * The shelter finished on day 2 in normal play (the user's third playtest, request 7: "a two-day
 * job in visible stages"; decisions DG-12, DG-90 and DG-91; Book 10 section 03, shelterFinish).
 *
 * The frame and the sail go up on day 1; on day 2 the household finishes it: Hild works it while
 * the stores, with the ship's stores still on the mast, hold the next day's food (DG-90), and
 * everyone else home joins as they come (Book 10: "others join as they come home"). Played here
 * as a player would, without lending a hand on the second morning: the searches at a player's
 * pace with the bow and the stores, or begun two hours late by the slow ways and without bringing
 * the stores down. Either way the shelter is finished before the household goes to bed on day 2,
 * and no one goes a day without eating on day 2 or day 3.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { campContext } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { Simulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { OpeningBot } from '../../src/tools/play/openingBot.ts';
import { WreckBot } from '../../src/tools/play/wreckBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const campOrNull = campContext(content);
const strandOrNone = land.maps.get('ZONE_SK_STRAND');
if (
  campOrNull === null ||
  strandOrNone === undefined ||
  land.searches == null ||
  land.repairs == null
)
  throw new Error('no camp, strand, searches or repairs');
const camp = campOrNull;
const strand = strandOrNone;
const searches = land.searches;
const repairs = land.repairs;

/** The household's sleep block (content household.json): "before bed" on day 2. */
const BED = 22 * 60;

interface Day2 {
  readonly sim: Simulation;
  readonly bot: WreckBot;
  /** The minute of day 2 the shelter was finished, or null. */
  finishedAt: number | null;
  /** Each resident's meals counted, by day. */
  readonly ate: Map<number, Set<string>>;
}

/** Day 1 as the chapter's scripted player plays it, to the first night's sleep (Book 4 beats 1 to 12). */
function toTheSecondMorning(seed: string): Day2 {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  const sim = createSimulation(b, world, land);
  const opening = new OpeningBot(sim, strand, b, land);
  opening.pickUp('wreck_seax');
  opening.rescue('C_HILD');
  const bot = new WreckBot(sim, b, land, camp, searches, repairs);
  bot.waitFor(() => sim.state.facts['ch1.chest_named'] === true, 60 * 30);
  bot.chestToCamp();
  bot.goToZone('ZONE_SK_STRAND');
  bot.firstFire(['drift_west_rocks', 'drift_west_bank']);
  bot.waitForHild();
  bot.raiseShelter();
  bot.tend('C_HILD');
  bot.waitUntil(19 * 60 + 40);
  bot.fireScene();
  bot.doAt('bed_s0');
  bot.waitFor(() => sim.state.player.awake && sim.state.calendar.day === 2, 60 * 120);
  const run: Day2 = { sim, bot, finishedAt: null, ate: new Map() };
  sim.events.onAny((e) => {
    if (e.type === 'WRECK' && e.what === 'SHELTER_FINISHED' && sim.state.calendar.day === 2)
      run.finishedAt = sim.state.calendar.minuteOfDay;
    if (e.type === 'MEAL_TAKEN' || e.type === 'MORNING_REPORT_DUE') noteMeals(run);
  });
  noteMeals(run);
  return run;
}

/** Who has eaten today (a dawn ration or a supper: Book 2 section 06). */
function noteMeals(run: Day2): void {
  const w = run.sim.state;
  for (const id of w.household.residents) {
    const m = w.people[id]?.life.meals;
    if (m === undefined || m.count === 0) continue;
    const seen = run.ate.get(m.day) ?? new Set<string>();
    seen.add(id);
    run.ate.set(m.day, seen);
  }
}

/** Plays on to `minute` of the present day (no later than the household's bed). */
function on(run: Day2, minute: number): void {
  if (run.sim.state.calendar.minuteOfDay < minute) run.bot.waitUntil(minute);
}

/** Everyone in the household that day has eaten by the evening. */
function everyoneAte(run: Day2, day: number): void {
  on(run, 21 * 60);
  noteMeals(run);
  const w = run.sim.state;
  expect(w.calendar.day).toBe(day);
  for (const id of w.household.residents)
    expect(run.ate.get(day)?.has(id) === true, `${id} ate on day ${day}`).toBe(true);
}

describe('the shelter is finished on day 2 in normal play (DG-90, DG-91)', () => {
  it('without a hand lent: the searches at a player’s pace, the bow and the stores, and everyone fed', () => {
    const run = toTheSecondMorning('shelter-day2-a');
    const { bot, sim } = run;
    expect(sim.state.calendar.day).toBe(2);
    expect(sim.state.facts['ch1.shelter']).toBe('SAIL');
    // No Build action by the steerer: the household does it.
    bot.oddi('CHEST_FIRST');
    bot.runa('OFFERING');
    bot.runaChestToCamp();
    bot.answerRuna('FIRE');
    bot.bran('BARGAIN');
    bot.waitFor(() => sim.state.facts['ch1.thorkel_body'] === 'CAMP', 60 * 600);
    bot.goToZone('ZONE_SK_MACHAIR');
    bot.takeKey();
    bot.openChest();
    bot.shootLashing({ x: 41.5, y: 27.5 });
    bot.storesToCamp();
    on(run, BED);
    expect(sim.state.calendar.day).toBe(2);
    expect(sim.state.facts['ch1.shelter']).toBe('FINISHED');
    expect(run.finishedAt, 'finished on day 2').not.toBeNull();
    expect(run.finishedAt ?? BED).toBeLessThan(BED);
    expect(sim.state.homes['ISLE_SKARV']?.stage).toBe('S1');
    // Fed on day 2 and day 3: the household is not made to go hungry for the shelter.
    everyoneAte(run, 2);
    bot.doAt('bed_s1');
    bot.waitFor(() => sim.state.player.awake && sim.state.calendar.day === 3, 60 * 120);
    everyoneAte(run, 3);
  }, 180_000);

  it('the slow ways and without the stores: the early morning elsewhere, Oddi home first, the cliff path, the sneak, the bow left', () => {
    const run = toTheSecondMorning('shelter-day2-b');
    const { bot, sim } = run;
    // The early morning spent on the strand (exploring, looking at the boat) to 08:00: two game
    // hours. (Begun after about 09:00 with every slow way, the finishing runs into the next
    // morning by about half an hour's work, unless the steerer lends a hand: DG-90.)
    bot.goToZone('ZONE_SK_STRAND');
    bot.waitUntil(8 * 60);
    bot.oddi('ODDI_FIRST');
    bot.runa('CLIFF_PATH');
    bot.runaChestToCamp();
    bot.answerRuna('FIRE');
    bot.bran('SNEAK');
    on(run, BED);
    expect(sim.state.calendar.day).toBe(2);
    expect(sim.state.facts['ch1.mast_stores']).not.toBe('CAMP');
    expect(sim.state.facts['ch1.shelter']).toBe('FINISHED');
    expect(run.finishedAt ?? BED).toBeLessThan(BED);
    everyoneAte(run, 2);
    bot.goToZone('ZONE_SK_MACHAIR');
    bot.doAt('bed_s1');
    bot.waitFor(() => sim.state.player.awake && sim.state.calendar.day === 3, 60 * 120);
    // Day 3 without the ship's stores: Hild fishes (the reckoning no longer holds), and there is
    // still something for everyone (Book 10 tutorialGuard; DG-56).
    everyoneAte(run, 3);
  }, 180_000);
});
