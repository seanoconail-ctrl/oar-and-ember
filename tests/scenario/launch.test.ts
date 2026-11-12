/**
 * Stage 12 (Book 4 section 08, beat 8; Book 6 section 15; Book 2 section 16): the launch, the
 * first story gate. Played through the simulation's commands by the scripted player
 * (src/tools/play/launchBot.ts) from the camp with the searches done and the boat ready
 * (`crew=1&launch=open`), as the interface would send them.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { readinessView } from '../../src/sim/narrative/launch.ts';
import { landContext } from '../../src/sim/land/context.ts';
import {
  floatLine,
  launchPhase,
  launchView,
  minutesToFloat,
} from '../../src/sim/narrative/launch.ts';
import { DEPTH_BANDS } from '../../src/content/balance.ts';
import { bandAt, stillWaterLevel } from '../../src/sim/land/water.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { createSimulation, stateHash } from '../../src/sim/simulation.ts';
import type { SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { LaunchBot } from '../../src/tools/play/launchBot.ts';
import { BOT_PACE, HUMAN_PACE, playChapter } from '../../src/tools/play/chapterRun.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const camp = land.camp;
const search = land.searches;
const repairs = land.repairs;
const launch = land.launch;
if (camp == null || search == null || repairs == null || launch == null)
  throw new Error('no content');

function start(seed: string, hooks = 'camp=broch&crew=1&launch=open&time=10:00') {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams(hooks));
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  if (camp == null || search == null || repairs == null) throw new Error('no content');
  const bot = new LaunchBot(sim, b, land, camp, search, repairs);
  return { world: sim.state, sim, bot, events };
}

describe('the launch gate (Book 6 section 15)', () => {
  it('opens only when the boat is ready and the three searches are decided, never starting itself', () => {
    const { world, sim } = start('closed', 'camp=broch&time=10:00');
    expect(world.gates['BEAT_1_LAUNCH']?.status).toBe('CLOSED');
    for (let i = 0; i < 600; i++) sim.step();
    expect(world.gates['BEAT_1_LAUNCH']?.status).toBe('CLOSED');
    const open = start('open');
    for (let i = 0; i < 60 * 60; i++) open.sim.step();
    // Open, offered at the boat, and still waiting for the player after a game hour and more.
    expect(open.world.gates['BEAT_1_LAUNCH']?.status).toBe('OPEN');
    expect(launchPhase(open.world)).toBeNull();
  });

  it('is offered by looking the boat over, which asks for the readiness screen', () => {
    const { bot, events } = start('offered');
    bot.askToLaunch();
    expect(events.some((e) => e.type === 'READINESS_ASKED')).toBe(true);
  });

  it('shows the boat, the tide, the crew, the stores, the weapons, allies and the rites, with the warning', () => {
    const { world } = start('readiness');
    const view = readinessView(world, launch, land, b);
    expect(view.lines.map((l) => l.measure)).toEqual([
      'BOAT',
      'TIDE',
      'CREW',
      'FOOD',
      'WEAPONS',
      'ALLIES',
      'RITES',
    ]);
    expect(view.pointOfNoReturnKey).toBe('ui.gate.launch.warning');
    expect(content.strings.get('ui.gate.launch.warning')?.text).toMatch(/no going back/);
    // Only what the household knows: every line is the interface's own words (ui.gate.*).
    for (const line of view.lines) expect(line.textKey).toMatch(/^ui\.gate\.launch\./);
    expect(view.lines.find((l) => l.measure === 'BOAT')?.state).toBe('READY');
    expect(view.lines.find((l) => l.measure === 'RITES')?.state).toBe('SHORT');
    expect(view.lines.find((l) => l.measure === 'ALLIES')?.state).toBe('UNKNOWN');
    expect(view.lines.find((l) => l.measure === 'CREW')?.list?.ids).toEqual(
      expect.arrayContaining(['C_HILD', 'C_ODDI', 'C_BRAN', 'C_RUNA']),
    );
    expect(view.canStart).toBe(true);
  });

  it('waits for the tide: out, the readiness says when it floats the boat and the start is refused', () => {
    // Day 1 at 17:30 the tide is out at the strand (Book 10 section 22, floats: Knee).
    const { world, sim, events } = start('tide', 'camp=broch&crew=1&launch=open&time=17:30');
    expect(floatLine(world, launch, land, b)).toBeNull();
    const view = readinessView(world, launch, land, b);
    const tide = view.lines.find((l) => l.measure === 'TIDE');
    expect(tide?.state).toBe('SHORT');
    expect(view.canStart).toBe(false);
    const wait = minutesToFloat(world, launch, land, b);
    expect(wait).not.toBeNull();
    expect(wait).toBeGreaterThan(0);
    sim.submit({ type: 'START_GATE', gate: 'BEAT_1_LAUNCH' });
    sim.step();
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'COMMAND_REFUSED',
        reason: 'GATE_REFUSED',
        detail: 'TIDE_OUT',
      }),
    );
    expect(world.gates['BEAT_1_LAUNCH']?.status).toBe('OPEN');
  });

  it('starts on the player’s command: the checkpoint, Thorkel unburied as a deed, the boat named and marked', () => {
    const { world, sim, events } = start('start');
    sim.submit({ type: 'START_GATE', gate: 'BEAT_1_LAUNCH' });
    sim.submit({ type: 'NAME_SHIP', name: '  Grey   Seal{steerer}!7 ' });
    sim.submit({ type: 'MARK_SAIL', pattern: 'raven', dye: 'woad' });
    sim.step();
    expect(world.gates['BEAT_1_LAUNCH']).toMatchObject({ status: 'STARTED', startedDay: 1 });
    expect(events).toContainEqual({ type: 'CHECKPOINT', label: 'launch' });
    // Book 6 RITES_DENIED: Thorkel's rites never given are decided at the launch (S11-14).
    expect(world.ledger.map((d) => d.tag)).toContain('RITES_DENIED');
    expect(world.facts['ch1.rites']).toBe('DENIED');
    expect(world.ships['flagship']?.name).toBe('Grey Sealsteerer');
    expect(world.ships['flagship']?.marks.sail).toBe('raven:woad');
  });

  it('with the rites given, no deed is written at the launch', () => {
    const { world, sim } = start('rites', 'camp=broch&crew=1&launch=open&time=10:00&rites=sea');
    sim.submit({ type: 'START_GATE', gate: 'BEAT_1_LAUNCH' });
    sim.step();
    expect(world.ledger.map((d) => d.tag)).not.toContain('RITES_DENIED');
  });
});

describe('the launch scene and the sea map (Book 4 beat 8)', () => {
  it('runs the boat down to where it floats, crews it, sets the sail, rows out and shows the map', () => {
    const { world, sim, bot, events } = start('scene');
    const boat = world.ships['flagship'];
    if (boat === undefined) throw new Error('no boat');
    const berth = { ...boat.lies };
    const float = floatLine(world, launch, land, b);
    expect(float).not.toBeNull();
    sim.submit({ type: 'START_GATE', gate: 'BEAT_1_LAUNCH' });
    sim.submit({ type: 'NAME_SHIP', name: 'Skarfr' });
    sim.submit({ type: 'MARK_SAIL', pattern: 'stripes_broad', dye: 'madder' });
    const phases: string[] = [];
    let afloatAt: { x: number; y: number } | null = null;
    for (let i = 0; i < 60 * 60 && launchPhase(world) !== 'MAP'; i++) {
      sim.step();
      const p = launchPhase(world);
      if (p !== null && phases[phases.length - 1] !== p) phases.push(p);
      if (p === 'BOARD' && afloatAt === null) afloatAt = { ...boat.lies };
      // The steerer is the scene's: movement is not taken while it plays.
      if (p === 'SLIDE') sim.submit({ type: 'MOVE', x: 1, y: 0, run: true, sneak: false });
    }
    // Named and marked in the tick the gate starts, so the scene begins at once.
    expect(phases).toEqual(['HEAVE', 'SLIDE', 'BOARD', 'HOIST', 'ROW', 'MAP']);
    // It floats where the water at its keel is at least Book 10's band, on its own line.
    expect(afloatAt?.y).toBeCloseTo(float ?? 0, 5);
    const elevation = land.elevations.get('ZONE_SK_STRAND');
    if (elevation === undefined) throw new Error('no strand');
    const level = stillWaterLevel(tideAt(world.calendar, b));
    for (const dx of [-2.6, 0, 2.6]) {
      const band = bandAt(land.water, elevation, (berth.x + dx) * 24, (float ?? 0) * 24, level);
      expect(DEPTH_BANDS.indexOf(band?.band ?? 'WET')).toBeGreaterThanOrEqual(
        DEPTH_BANDS.indexOf('KNEE'),
      );
    }
    const view = launchView(world, { def: launch.def });
    expect(view).toMatchObject({ afloat: true, rowing: true, steererAboard: true });
    expect(view?.aboard).toEqual(expect.arrayContaining(['C_HILD', 'C_ODDI', 'C_BRAN', 'C_RUNA']));
    for (const t of ['LAUNCH_GATHERED', 'LAUNCH_SLIDE', 'LAUNCH_AFLOAT', 'SAIL_SET', 'OAR_STROKE'])
      expect(events.some((e) => e.type === t)).toBe(true);
    // The map: the coast, the smoke at Carrick; Chapter 1 resolved, Chapter 2 open.
    expect(events.some((e) => e.type === 'SEA_MAP_REVEALED')).toBe(true);
    expect(world.knowledge.places['SITE_CARRICK']).toBe('RUMOURED');
    expect(world.facts['ch1.carrick_smoke']).toBe(true);
    expect(world.facts['tutorialComplete']).toBe(true);
    expect(world.chapters['CH_1_WRECK']?.status).toBe('RESOLVED');
    expect(world.chapters['CH_2_FIRST_RAID']?.status).toBe('ACTIVE');
    expect(world.gates['BEAT_1_LAUNCH']?.status).toBe('PASSED');
    // Closing the map ends the chapter: the trial row's time, the boat drawn up at its berth.
    const minute = world.calendar.day * 1440 + world.calendar.minuteOfDay;
    sim.submit({ type: 'CLOSE_SEA_MAP' });
    sim.step();
    expect(launchPhase(world)).toBe('DONE');
    expect(world.ships['flagship']?.lies).toMatchObject({ x: berth.x, y: berth.y });
    const after = world.calendar.day * 1440 + world.calendar.minuteOfDay;
    expect(after - minute).toBeGreaterThanOrEqual(60);
    expect(events).toContainEqual({
      type: 'CHAPTER_ENDED',
      chapter: 'CH_1_WRECK',
      save: 'chapter-1-end',
    });
    expect(world.ships['flagship']?.history.map((h) => h.kind)).toEqual(
      expect.arrayContaining(['NAMED', 'LAUNCHED']),
    );
    // And the household goes back to its day.
    for (let i = 0; i < 600; i++) bot.step();
    expect(launchView(world, { def: launch.def })).toBeNull();
  });

  it('plays the same from the same world (deterministic)', () => {
    const run = (): string => {
      const { sim } = start('same');
      sim.submit({ type: 'START_GATE', gate: 'BEAT_1_LAUNCH' });
      sim.submit({ type: 'NAME_SHIP', name: 'Cormorant' });
      sim.submit({ type: 'MARK_SAIL', pattern: 'plain', dye: null });
      for (let i = 0; i < 60 * 30; i++) sim.step();
      return stateHash(sim.state);
    };
    expect(run()).toBe(run());
  });
});

describe('Chapter 1 timed by telemetry (Book 3 Stage 12 check 1)', () => {
  it('records the chapter’s time, the first fight and every beat, played through by the scripted player', () => {
    const run = playChapter('chapter-1', BOT_PACE);
    const marks = Object.fromEntries(run.report.marks.map((m) => [m.key, m.seconds]));
    for (const key of [
      'seax',
      'hild_safe',
      'bow',
      'at_broch',
      'fire',
      'hild_tended',
      'search_oddi',
      'search_runa',
      'search_bran',
      'first_combat',
      'hull',
      'rigging',
      'oar',
      'fitting',
      'rites',
      'boat_ready',
      'gate_open',
      'launch',
      'chapter_end',
    ])
      expect(marks[key], key).toBeDefined();
    expect(marks['first_combat']).toBeLessThan(marks['chapter_end'] ?? 0);
    expect(marks['chapter_end']).toBeCloseTo(run.report.now, 0);
    expect(run.world.telemetry.start).toBe(0);
  }, 120_000);

  it('counts the time menus hold the game (the human pace reads the screens)', () => {
    const human = playChapter('chapter-1', HUMAN_PACE);
    expect(human.report.held).toBeGreaterThan(HUMAN_PACE.launchScreens + HUMAN_PACE.seaMap - 1);
    expect(human.report.now).toBeGreaterThan(human.report.held);
  }, 120_000);
});
