/**
 * Chapter 1 from waking to the launch, played through the simulation's commands by the scripted
 * players of Stages 6 to 12, for the telemetry of Book 3 Stage 12's check 1 ("Chapter 1 takes 45
 * to 60 minutes for a new player, with combat inside 25 minutes"; decision S12-12).
 *
 * The bots walk straight to each goal; a new player does not. The human pace adds what the
 * simulation can know of a person at the keys: a pause to read and think before each choice in a
 * conversation, a look round on arriving in a new zone, the morning report read, the readiness
 * screen, the name, the mark and the sea map read (time held by a menu). It cannot add the
 * finding of the way, which is the larger part of a new player's time; the stage report reckons
 * that apart.
 *
 *   node src/tools/play/chapterRun.ts [seed] [bot|human]
 */
import { parsePeopleBasics, parseTimeBalance } from '../../content/balance.ts';
import { campContext } from '../../sim/home/camp.ts';
import { landContext } from '../../sim/land/context.ts';
import { findActor } from '../../sim/land/zoneLinks.ts';
import { telemetryReport } from '../../sim/narrative/telemetry.ts';
import { createSimulation } from '../../sim/simulation.ts';
import type { Simulation } from '../../sim/simulation.ts';
import { newCampaign } from '../../sim/world.ts';
import type { WorldState } from '../../sim/world.ts';
import { loadContentFromDisk } from '../content/loadContentFiles.ts';
import { OpeningBot } from './openingBot.ts';
import { WreckBot } from './wreckBot.ts';

/** How a player's own time is added (real seconds). */
export interface Pace {
  readonly name: 'bot' | 'human';
  /** Reading the line and choosing, before each choice in a conversation. */
  readonly choose: number;
  /** Looking round on first coming into a zone. */
  readonly arrive: number;
  /** Reading the morning report (time held). */
  readonly report: number;
  /** The readiness screen, the name and the mark (time held). */
  readonly launchScreens: number;
  /** The sea map (time held). */
  readonly seaMap: number;
}

export const BOT_PACE: Pace = {
  name: 'bot',
  choose: 0,
  arrive: 0,
  report: 0,
  launchScreens: 0,
  seaMap: 0,
};
export const HUMAN_PACE: Pace = {
  name: 'human',
  choose: 4,
  arrive: 6,
  report: 15,
  launchScreens: 75,
  seaMap: 20,
};

/** A launch bot that takes a person's time over its choices and arrivals. */
class PacedBot extends WreckBot {
  pace: Pace = BOT_PACE;
  readonly #seen = new Set<string>();

  override choose(key: string): void {
    this.step(Math.round(this.pace.choose * 60));
    super.choose(key);
  }

  /** Someone passing may answer first (a resident at the boat): leave them and look again. */
  override lookAtBoat(): void {
    for (let k = 0; ; k++) {
      try {
        super.lookAtBoat();
        return;
      } catch (error) {
        if (k >= 4) throw error;
        if (this.sim.state.talk !== null) this.sim.submit({ type: 'TALK_END' });
        this.step(60);
      }
    }
  }

  /** The same for work at the boat: a resident there may be talked to instead; try again. */
  override workOnBoat(): void {
    for (let k = 0; ; k++) {
      try {
        super.workOnBoat();
        return;
      } catch (error) {
        if (k >= 4) throw error;
        if (this.sim.state.talk !== null) this.sim.submit({ type: 'TALK_END' });
        this.step(60);
      }
    }
  }

  override goToZone(zone: string): void {
    super.goToZone(zone);
    if (!this.#seen.has(zone)) {
      this.#seen.add(zone);
      this.step(Math.round(this.pace.arrive * 60));
    }
  }
}

export interface ChapterRun {
  readonly world: WorldState;
  readonly report: ReturnType<typeof telemetryReport>;
  /** Fights at the sheepfold lost and taken again from their checkpoint. */
  readonly retries: number;
}

/**
 * Plays Chapter 1: the rescue, the seax and the bow; the broch, the fire, Hild's leg; the three
 * searches (Oddi chest first, Runa by an offering, Bran by a fight: the first combat); the
 * repairs (the boards, the rigging at low water, the oar taken from the skiff); a fitting; the
 * rites at evening; the launch. Nights pass where the waiting takes them.
 */
export function playChapter(seed: string, pace: Pace = BOT_PACE): ChapterRun {
  const { content, issues } = loadContentFromDisk();
  if (issues.length > 0) throw new Error('content has problems; run npm run content:lint');
  const balance = content.balance;
  const b = parseTimeBalance(balance);
  const land = landContext(content, balance);
  const camp = campContext(content);
  const strand = land.maps.get('ZONE_SK_STRAND');
  if (camp === null || strand === undefined || land.searches == null || land.repairs == null)
    throw new Error('no camp, strand, searches or repairs');
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  const sim = createSimulation(b, world, land);
  // The morning report holds the game while it is read.
  sim.events.onAny((e) => {
    if (e.type === 'MORNING_REPORT_DUE' && pace.report > 0)
      sim.submit({ type: 'TIME_HELD', ms: pace.report * 1000 });
  });
  const opening = new OpeningBot(sim, strand, b, land);
  opening.pickUp('wreck_seax');
  opening.rescue('C_HILD');
  const bot = new PacedBot(sim, b, land, camp, land.searches, land.repairs);
  bot.pace = pace;
  // Design addendum 2.4: Thorkel's chest up to its outline at the camp, driftwood and the first
  // fire, Hild walking up, the shelter's frame and the sail over it (DG-12), her leg tended.
  bot.waitFor(() => sim.state.facts['ch1.chest_named'] === true, 60 * 30);
  bot.chestToCamp();
  bot.goToZone('ZONE_SK_STRAND');
  bot.firstFire(['drift_west_rocks', 'drift_west_bank']);
  bot.waitForHild();
  bot.raiseShelter();
  bot.tend('C_HILD');
  // The first dusk: the scavengers at the stern are left alone (they go to the fold at dark), and
  // the first night's fire with Hild gives the morning's aims; then sleep.
  bot.waitUntil(19 * 60 + 40);
  bot.fireScene();
  bot.doAt('bed_s0');
  // The second morning: Hild's word on finishing the shelter, and a hand with it (DG-12, DG-66).
  bot.waitFor(() => sim.state.player.awake, 60 * 120);
  bot.step(60 * 3);
  bot.finishShelter(4);
  // The three searches; Bran's by fighting the scavengers at the fold (the first combat).
  bot.oddi('CHEST_FIRST');
  bot.runa('OFFERING');
  bot.runaChestToCamp();
  bot.answerRuna('FIRE');
  const retries = fightForBran(sim, bot);
  // Bran downed in the fight is carried home to the fire, as a player must (Book 1 section 09).
  const bran = sim.state.onFoot === null ? null : findActor(sim.state.onFoot, 'C_BRAN');
  if (bran !== null && bran.actor.pose === 'down') {
    bot.goToZone(bran.zone);
    bot.carryHome('C_BRAN');
  }
  bot.waitFor(() => sim.state.facts['ch1.thorkel_body'] === 'CAMP', 60 * 600);
  // His key (from Bran at the bier, or from his body), his chest opened: the bow.
  bot.goToZone('ZONE_SK_MACHAIR');
  bot.waitFor(() => sim.state.facts['ch1.key'] !== undefined || bot.ticks % 600 === 599, 60 * 30);
  bot.takeKey();
  bot.openChest();
  // The bow's first use: the stores on the broken mast.
  bot.shootLashing({ x: 41.5, y: 27.5 });
  bot.storesToCamp();
  // The repairs, a fitting, the rites, the launch.
  const trace = (what: string): void => {
    if (process.env['TRACE'] !== undefined)
      console.log(
        `${what}: day ${sim.state.calendar.day} ${sim.state.calendar.minuteOfDay}, ${(sim.state.tick / 3600).toFixed(1)} min`,
      );
  };
  trace('home');
  if (process.env['TRACE'] !== undefined)
    console.log(
      ['E_WRECKER_KETILL', 'E_WRECKER_SVART', 'E_WRECKER_CONN']
        .map((id) => `${id}:${sim.state.people[id]?.status}`)
        .join(' '),
      sim.state.facts['ch1.wreckers'],
    );
  bot.boards();
  trace('boards');
  bot.rigging();
  trace('rigging');
  // After a fight at the fold any scavenger left is at the skiff: the oar is taken unseen, or
  // traded for if they were paid or slipped past.
  bot.oar(sim.state.facts['ch1.wreckers'] === 'BEATEN' ? 'THEFT' : 'TRADE');
  trace('oar');
  bot.workUntil(() => sim.state.facts['ch1.boat_ready'] === true, 400);
  trace('ready');
  bot.fit('HOLD');
  bot.goToZone('ZONE_SK_MACHAIR');
  if (sim.state.calendar.minuteOfDay > 18 * 60 + 30) {
    bot.waitUntil(5 * 60);
  }
  bot.waitUntil(18 * 60 + 30);
  bot.rites('SEA');
  bot.goToZone('ZONE_SK_STRAND');
  bot.waitForWater();
  bot.askToLaunch();
  if (pace.launchScreens > 0) sim.submit({ type: 'TIME_HELD', ms: pace.launchScreens * 1000 });
  bot.launch('Grey Seal', 'raven', 'woad', pace.seaMap);
  return { world: sim.state, report: telemetryReport(sim.state), retries };
}

/**
 * Bran's fight, taken again from the fold's checkpoint if the steerer falls (a player reloads the
 * checkpoint, Book 2 section 20). The time lost in a lost fight counts: it is played time.
 */
function fightForBran(sim: Simulation, bot: PacedBot): number {
  let retries = 0;
  for (;;) {
    const saved = structuredClone(sim.state);
    try {
      bot.bran('FIGHT');
      return retries;
    } catch {
      if (sim.state.gameOver === null || retries >= 6) throw new Error('Bran could not be had');
      retries++;
      // The lost fight's time is kept: the reload goes back to before it, later on the clock.
      const lost = sim.state.tick;
      const held = sim.state.telemetry;
      sim.restore(structuredClone(saved));
      sim.state.tick = lost;
      sim.state.telemetry = held;
      sim.state.rng.combat = [retries * 7919, retries * 104729, 17, retries + 3];
    }
  }
}

if (import.meta.filename === process.argv[1]) {
  const seed = process.argv[2] ?? 'chapter-1';
  const pace = process.argv[3] === 'human' ? HUMAN_PACE : BOT_PACE;
  const run = playChapter(seed, pace);
  const fmt = (s: number): string => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
  console.log(`Chapter 1, ${pace.name} pace, seed ${seed}: ${fmt(run.report.now)} played`);
  console.log(`  held by menus: ${fmt(run.report.held)}; fights at the fold lost: ${run.retries}`);
  for (const m of run.report.marks) {
    const at = run.world.telemetry.marks[m.key];
    const clock =
      at === undefined
        ? ''
        : `day ${at.day} ${String(Math.floor(at.minute / 60)).padStart(2, '0')}:${String(at.minute % 60).padStart(2, '0')}`;
    console.log(`  ${m.key.padEnd(13)} ${fmt(m.seconds).padEnd(14)} ${clock}`);
  }
  console.log(`  day ${run.world.calendar.day}, ${run.world.calendar.minuteOfDay} minutes`);
}
