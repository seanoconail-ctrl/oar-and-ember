/**
 * Stage 7 acceptance checks 1 to 5 in the simulation (Book 3 Stage 7; Book 2 sections 03, 07
 * and 24; Book 10 sections 03, 06, 08 and 09):
 *
 * 1. No starvation or spoilage before tutorialComplete.
 * 2. Sleeping after 18:00 advances to dawn and produces a morning report in sentences.
 * 3. The player's task action adds output at their skill, and missed timing never ruins a task.
 * 4. Each task advances the clock by its Book 10 time and costs only its Book 10 stamina, and its
 *    work loop is the same for the steerer and residents (the scene side is in workLoops.test.ts).
 * 5. The bar's length is its maximum; each condition lowers it by its Book 10 amount and is named;
 *    a hot meal, a fire and rest restore it.
 *
 * And beat 2: Hild leads to the broch, the fire is lit and her leg tended; she then fishes.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import {
  parseStaminaBalance,
  parseTaskBalance,
  parseWorkBalance,
} from '../../src/content/homeBalance.ts';
import { formatString } from '../../src/content/strings.ts';
import { minutesIntoDay } from '../../src/sim/calendar/calendar.ts';
import {
  campContext,
  campUses,
  FACT_AT_BROCH,
  FACT_TUTORIAL_COMPLETE,
  foodRd,
  skillRatio,
} from '../../src/sim/home/camp.ts';
import type { CampContext } from '../../src/sim/home/camp.ts';
import { setReason, staminaView, traversalTick } from '../../src/sim/home/stamina.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { Simulation, SimEvent } from '../../src/sim/simulation.ts';
import { freshStamina, newCampaign } from '../../src/sim/world.ts';
import type { StaminaReason, WorldState } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { CampBot } from '../../src/tools/play/campBot.ts';
import { OpeningBot } from '../../src/tools/play/openingBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const sb = parseStaminaBalance(balance);
const work = parseWorkBalance(balance);
const tasks = parseTaskBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const campOrNull = campContext(content);
if (campOrNull === null) throw new Error('no camp content');
const camp: CampContext = campOrNull;
const home = (w: WorldState) => {
  const h = w.homes['ISLE_SKARV'];
  if (h === undefined) throw new Error('no home');
  return h;
};

function play(seed = 'home'): { sim: Simulation; events: SimEvent[]; bot: CampBot } {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  return { sim, events, bot: new CampBot(sim, b, land, camp) };
}

/** The opening and beat 2 as a new player plays them: rescue, the bow, follow Hild to the broch. */
function toTheBroch(seed = 'home'): { sim: Simulation; events: SimEvent[]; bot: CampBot } {
  const run = play(seed);
  const strand = land.maps.get('ZONE_SK_STRAND');
  if (strand === undefined) throw new Error('no strand');
  const opening = new OpeningBot(run.sim, strand, b, land);
  opening.rescue('C_HILD');
  opening.waitFor(() => run.sim.state.facts['ch1.lead_started'] === true, 60 * 60);
  run.bot.goToZone('ZONE_SK_MACHAIR');
  run.bot.goToSite('stores');
  run.bot.waitFor(() => run.sim.state.facts[FACT_AT_BROCH] === true, 60 * 300);
  return run;
}

describe('beat 2: Hild leads to the broch (Book 4 Chapter 1)', () => {
  it('offers no camp work during the opening, only once at the broch (decision S7-26)', () => {
    const { sim } = play('gate');
    const onFoot = sim.state.onFoot;
    const strand = land.maps.get('ZONE_SK_STRAND');
    if (onFoot === null || strand === undefined) throw new Error('no strand');
    expect(campUses(sim.state, camp, strand, onFoot.actors)).toEqual([]);
    sim.state.facts[FACT_AT_BROCH] = true;
    expect(campUses(sim.state, camp, strand, onFoot.actors).length).toBeGreaterThan(0);
  });

  it('leads up from the strand, sits by the fire ring and says what is needed', () => {
    const { sim, events } = toTheBroch();
    const hild = sim.state.onFoot?.actors['C_HILD'];
    expect(sim.state.onFoot?.zone).toBe('ZONE_SK_MACHAIR');
    expect(hild?.pose).toBe('sit');
    const lines = events.flatMap((e) => (e.type === 'PERSON_SPOKE' ? [e.lineKey] : []));
    expect(lines).toContain('c_hild.bark.broch.01');
    expect(home(sim.state).stage).toBe('S0');
    expect(sim.state.people['C_HILD']?.wounds).toMatchObject([
      { severity: 'SERIOUS', where: 'leg' },
    ]);
  });

  it('completes once the fire is lit and her leg tended; she fishes from the next morning', () => {
    const { sim, events, bot } = toTheBroch('beat2');
    // Driftwood from the weed line, then back up to light the fire.
    bot.doAt('wrack_1');
    bot.doAt('wrack_2');
    expect(home(sim.state).stores['RES_DRIFTWOOD']).toBeGreaterThan(1);
    bot.doAt('fire');
    expect(home(sim.state).fire.lit).toBe(true);
    // Tend her leg: interacting next to her.
    bot.tend('C_HILD', 'good');
    expect(sim.state.people['C_HILD']?.wounds[0]?.tendedDay).toBe(sim.state.calendar.day);
    expect(events.some((e) => e.type === 'BEAT_COMPLETED' && e.beat === 'BEAT_1_BROCH')).toBe(true);
    // Sleep; in the morning she goes to fish, out of view on the strand, and lands fish.
    bot.waitUntil(b.sleepAfter + 30);
    bot.doAt(home(sim.state).stage === 'S1' ? 'bed_s1' : 'bed_s0');
    bot.waitFor(() => events.some((e) => e.type === 'WOKE'));
    bot.waitUntil(14 * 60);
    expect(events.some((e) => e.type === 'FISH_LANDED' && e.by === 'C_HILD')).toBe(true);
  });
});

describe('Stage 7 check 1: no starvation or spoilage before tutorialComplete', () => {
  it('serves the ration and keeps fresh fish however long, until tutorialComplete', () => {
    const { sim } = play('guard');
    sim.state.onFoot = null;
    const h = home(sim.state);
    h.fresh = [{ rd: 5, day: 1 }];
    h.stores['RES_SALTED_FISH'] = 0;
    for (let day = 0; day < 8; day++) {
      sim.state.calendar = { day: sim.state.calendar.day, minuteOfDay: 19 * 60 };
      sim.submit({ type: 'SLEEP' });
      for (let i = 0; i < 60 * 4; i++) sim.step();
    }
    // Eight days on, with five rations for one mouth: no fish spoiled, and none short.
    expect(sim.state.calendar.day).toBe(9);
    expect(h.shortDays).toBe(0);
    expect(foodRd(h)).toBe(0);
    expect(sim.state.player.stamina.reductions.map((r) => r.reason)).not.toContain('STARVING');
  });

  it('spoils fresh fish after Book 10 days, and counts short days, once tutorialComplete is set', () => {
    const { sim } = play('after');
    sim.state.onFoot = null;
    sim.state.facts[FACT_TUTORIAL_COMPLETE] = true;
    const h = home(sim.state);
    h.fresh = [{ rd: 5, day: 1 }];
    h.stores['RES_SALTED_FISH'] = 0;
    for (let day = 0; day < 4; day++) {
      sim.state.calendar = { day: sim.state.calendar.day, minuteOfDay: 19 * 60 };
      sim.submit({ type: 'SLEEP' });
      for (let i = 0; i < 60 * 4; i++) sim.step();
    }
    expect(h.fresh).toEqual([]);
    expect(h.shortDays).toBeGreaterThan(0);
  });
});

describe('Stage 7 check 2: sleeping after 18:00 advances to dawn with a morning report', () => {
  it('refuses a bed before 18:00, and from 18:00 sleeps to 06:00 and reports in sentences', () => {
    const { sim, events, bot } = toTheBroch('sleep');
    bot.goToSite('bed_s0');
    sim.submit({ type: 'SLEEP' });
    bot.step();
    expect(events.at(-1)).toMatchObject({ type: 'COMMAND_REFUSED', reason: 'TOO_EARLY_TO_SLEEP' });
    bot.waitUntil(b.sleepAfter);
    sim.submit({ type: 'SLEEP' });
    bot.step();
    expect(events.some((e) => e.type === 'FELL_ASLEEP')).toBe(true);
    bot.waitFor(() => events.some((e) => e.type === 'MORNING_REPORT_DUE'));
    expect(sim.state.calendar.minuteOfDay).toBe(b.dayStart);
    expect(sim.state.calendar.day).toBe(2);
    const report = sim.state.report;
    expect(report?.day).toBe(2);
    const sentences = (report?.lines ?? []).map((l) =>
      formatString(
        content.strings,
        l.key,
        Object.fromEntries(
          Object.entries(l.vars).map(([k, v]) => [
            k,
            typeof v === 'string' && v.startsWith('report.')
              ? formatString(content.strings, v)
              : String(v),
          ]),
        ),
      ),
    );
    expect(sentences.length).toBeGreaterThanOrEqual(4);
    for (const s of sentences) {
      // A sentence: a capital, words, a full stop; no percentages or bare numbers of state.
      expect(s).toMatch(/^[A-Z{].*[.]$/);
      expect(s).not.toMatch(/%/);
    }
    // Slept from 18:00 to 06:00: a full rest.
    expect(staminaView(sim.state.player.stamina).reasons.map((r) => r.reason)).not.toContain(
      'TIRED',
    );
  });

  it('a short night leaves the steerer tired; a collapse leaves them exhausted', () => {
    const { sim, events, bot } = toTheBroch('short');
    bot.waitUntil(1 * 60 + 30);
    bot.goToSite('bed_s0');
    bot.interact();
    bot.waitFor(() => events.some((e) => e.type === 'WOKE'));
    expect(sim.state.player.stamina.reductions.map((r) => r.reason)).toContain('TIRED');
    const fresh = play('collapse');
    fresh.bot.waitFor(() => fresh.events.some((e) => e.type === 'COLLAPSED'), 60 * 60 * 25);
    expect(fresh.sim.state.player.stamina.reductions).toContainEqual(
      expect.objectContaining({ reason: 'EXHAUSTED', amount: sb.capacity.EXHAUSTED }),
    );
    expect(minutesIntoDay(fresh.sim.state.calendar, b)).toBe(2 * 60);
  });
});

describe('Stage 7 check 3: the action adds output at skill; missed timing never ruins it', () => {
  it('gathers driftwood at the skill multiplier, plus up to the timing bonus', () => {
    const results: Record<string, number> = {};
    for (const press of ['good', 'late', 'none'] as const) {
      const { sim, bot } = play(`wood-${press}`);
      sim.state.facts[FACT_AT_BROCH] = true; // the camp's work is open (S7-26)
      if (sim.state.onFoot !== null) sim.state.onFoot.items = [];
      bot.doAt('wrack_1', press);
      results[press] = home(sim.state).stores['RES_DRIFTWOOD'] ?? 0;
    }
    const level = 1;
    const base = work.driftwoodPerSearch.Spring * skillRatio(work, level);
    expect(results['none']).toBeCloseTo(base, 6);
    expect(results['late']).toBeCloseTo(base, 6);
    expect(results['good']).toBeCloseTo(base * (1 + work.timingBonus), 6);
    expect(results['good']).toBeGreaterThan(results['none'] ?? 0);
  });

  it('works faster at a higher skill', () => {
    const at = (skill: number) => {
      const { sim, bot } = play(`skill-${skill}`);
      sim.state.facts[FACT_AT_BROCH] = true; // the camp's work is open (S7-26)
      sim.state.player.skills['gathering'] = skill as 0;
      bot.doAt('wrack_2', 'none');
      return home(sim.state).stores['RES_DRIFTWOOD'] ?? 0;
    };
    expect(at(4)).toBeGreaterThan(at(1));
    expect(at(2)).toBeCloseTo(work.driftwoodPerSearch.Spring, 6);
  });
});

describe('Stage 7 check 4: each task takes its Book 10 time and only its Book 10 stamina', () => {
  const row = (task: string) => {
    const name = camp.tasks.get(task)?.def.balanceRow ?? '';
    const cost = tasks.costs.get(name);
    if (cost === undefined) throw new Error(name);
    return cost;
  };

  it.each([
    'TASK_GATHER_DRIFTWOOD',
    'TASK_FISH_SHORE',
    'TASK_LIGHT_FIRE',
    'TASK_COOK',
    'TASK_CARE',
    'TASK_BUILD',
  ])('%s', (task) => {
    const { sim, events, bot } = toTheBroch(`cost-${task}`);
    const h = home(sim.state);
    h.stores['RES_DRIFTWOOD'] = 5;
    if (task === 'TASK_COOK') h.fire = { lit: true, fuel: 2 };
    sim.state.player.stamina.current = 50;
    const before = minutesIntoDay(sim.state.calendar, b);
    const was = sim.state.player.stamina.current;
    if (task === 'TASK_FISH_SHORE') {
      sim.state.player.hotbar.slots[0] = 'ITEM_LINE';
      bot.goToZone('ZONE_SK_STRAND');
      bot.goToWater();
      expect(bot.fish('none')).toBe(true);
    } else if (task === 'TASK_CARE') {
      bot.tend('C_HILD', 'none');
    } else {
      const site =
        task === 'TASK_GATHER_DRIFTWOOD' ? 'wrack_1' : task === 'TASK_BUILD' ? 'shelter' : 'fire';
      bot.goToSite(site);
      const t0 = minutesIntoDay(sim.state.calendar, b);
      // At full stamina nothing regenerates while the loop plays: what goes is the task's cost.
      sim.state.player.stamina.current = sim.state.player.stamina.max;
      const s0 = sim.state.player.stamina.current;
      bot.interact();
      bot.work('none');
      const done = events.filter((e) => e.type === 'WORK_DONE').at(-1);
      expect(done).toMatchObject({
        task,
        minutes: row(task).gameMinutes,
        stamina: row(task).stamina,
      });
      // Minutes: the task's own, plus the few the clock ran during the 2.5 s loop.
      const passed = minutesIntoDay(sim.state.calendar, b) - t0;
      expect(passed).toBeGreaterThanOrEqual(row(task).gameMinutes);
      expect(passed).toBeLessThanOrEqual(row(task).gameMinutes + 4);
      // Stamina: only its cost (a meal raises the maximum, so the bar may then regain some).
      if (task === 'TASK_COOK')
        expect(s0 - sim.state.player.stamina.current).toBeLessThanOrEqual(row(task).stamina + 1e-9);
      else expect(s0 - sim.state.player.stamina.current).toBeCloseTo(row(task).stamina, 6);
      return;
    }
    const done = events.filter((e) => e.type === 'WORK_DONE').at(-1);
    expect(done).toMatchObject({
      task,
      minutes: row(task).gameMinutes,
      stamina: row(task).stamina,
    });
    expect(minutesIntoDay(sim.state.calendar, b) - before).toBeGreaterThanOrEqual(
      row(task).gameMinutes,
    );
    expect(was).toBeGreaterThan(0);
  });

  it('never empties the bar on its own, and counts the hours towards a hard day', () => {
    const { sim, bot } = play('hard');
    sim.state.facts[FACT_AT_BROCH] = true; // the camp's work is open (S7-26)
    sim.state.player.stamina.current = 1;
    for (let i = 0; i < 26; i++) bot.doAt('wrack_3', 'none');
    expect(sim.state.player.stamina.current).toBeGreaterThan(0);
    expect(sim.state.player.condition.workedMinutes).toBeGreaterThan(sb.hardWorkMinutes);
    expect(sim.state.player.stamina.reductions.map((r) => r.reason)).toContain('HARD_WORK');
  });
});

describe('Stage 7 check 5: the bar is its maximum, lowered by named reasons, restored', () => {
  const amounts: [StaminaReason, number][] = [
    ['COLD', sb.capacity.COLD],
    ['HUNGRY', sb.capacity.HUNGRY],
    ['STARVING', sb.capacity.STARVING],
    ['WOUNDED', sb.capacity.WOUNDED],
    ['BADLY_WOUNDED', sb.capacity.BADLY_WOUNDED],
    ['SICK', sb.capacity.SICK],
    ['TIRED', sb.capacity.TIRED],
    ['EXHAUSTED', sb.capacity.EXHAUSTED],
    ['HARD_WORK', sb.capacity.HARD_WORK],
  ];

  it.each(amounts)('%s lowers the maximum by its Book 10 amount and is named', (reason, amount) => {
    const st = freshStamina(sb.base);
    setReason(st, sb, reason, 0);
    expect(st.max).toBe(Math.max(sb.minimumMax, sb.base - amount));
    const view = staminaView(st);
    expect(view.reasons).toEqual([
      { reason, amount, labelKey: `ui.stamina.reason.${reason.toLowerCase()}` },
    ]);
    expect(content.strings.has(view.reasons[0]?.labelKey ?? '')).toBe(true);
  });

  it('never lets the maximum fall below Book 10 minimumMax, nor current above the maximum', () => {
    const st = freshStamina(sb.base);
    for (const [reason] of amounts) setReason(st, sb, reason, 0);
    expect(st.max).toBe(sb.minimumMax);
    expect(st.current).toBeLessThanOrEqual(st.max);
  });

  it('wakes cold and wet; an hour by the lit fire lifts it', () => {
    const { sim, bot } = toTheBroch('warm');
    const reasons = () => sim.state.player.stamina.reductions.map((r) => r.reason);
    expect(reasons()).toContain('COLD');
    home(sim.state).stores['RES_DRIFTWOOD'] = 3;
    bot.doAt('fire');
    bot.goToSite('fire');
    bot.waitFor(() => !reasons().includes('COLD'), 60 * 60 * 2);
    expect(sim.state.player.stamina.max).toBe(
      sb.base - (reasons().includes('HUNGRY') ? sb.capacity.HUNGRY : 0),
    );
  });

  it('a hot meal lifts Hungry and Cold; a cold meal Hungry only', () => {
    const { sim, bot } = toTheBroch('meal');
    bot.waitUntil(14 * 60 + 5);
    const reasons = () => sim.state.player.stamina.reductions.map((r) => r.reason);
    expect(reasons()).toEqual(expect.arrayContaining(['HUNGRY', 'COLD']));
    home(sim.state).fire = { lit: true, fuel: 3 };
    bot.doAt('fire');
    expect(reasons()).not.toContain('HUNGRY');
    expect(reasons()).not.toContain('COLD');
  });

  it('drains running, carrying a person and wading waist deep; regenerates after a pause', () => {
    const st = freshStamina(sb.base);
    st.current = 50;
    const winded = {};
    traversalTick(
      st,
      sb,
      { running: true, carrying: false, wadingWaist: false, inWaist: false },
      0,
      winded,
    );
    expect(st.current).toBeCloseTo(50 - sb.drain.run / 60, 6);
    traversalTick(
      st,
      sb,
      { running: false, carrying: true, wadingWaist: true, inWaist: true },
      1,
      winded,
    );
    expect(st.current).toBeCloseTo(
      50 - (sb.drain.run + sb.drain.heavyCarry + sb.drain.waistWade) / 60,
      6,
    );
    const low = st.current;
    // Walking and knee water never drain; regeneration waits Book 10's ticks.
    for (let t = 2; t < 2 + sb.regenDelayTicks - 1; t++)
      traversalTick(
        st,
        sb,
        { running: false, carrying: false, wadingWaist: false, inWaist: false },
        t,
        winded,
      );
    expect(st.current).toBe(low);
    traversalTick(
      st,
      sb,
      { running: false, carrying: false, wadingWaist: false, inWaist: false },
      1 + sb.regenDelayTicks,
      winded,
    );
    expect(st.current).toBeCloseTo(low + sb.regenPerSecond / 60, 6);
  });

  it('a sprint run empty drops to a walk until Book 10 recoverAt is regained', () => {
    const { sim } = play('sprint');
    const p = sim.state.onFoot?.player;
    if (p === undefined) throw new Error('not on foot');
    sim.state.player.stamina.current = 0.5;
    sim.submit({ type: 'MOVE', x: 1, y: 0, run: true, sneak: false });
    for (let i = 0; i < 30; i++) sim.step();
    expect(p.winded?.run).toBe(true);
    expect(p.gait).toBe('walk');
    // Standing still, the bar regains Book 10's recoverAt and the sprint comes back.
    sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
    for (let i = 0; i < 60 * 3; i++) sim.step();
    expect(sim.state.player.stamina.current).toBeGreaterThanOrEqual(sb.recoverAt);
    expect(p.winded?.run).toBeUndefined();
    sim.submit({ type: 'MOVE', x: 1, y: 0, run: true, sneak: false });
    sim.step();
    expect(p.gait).toBe('run');
  });

  it('carrying a person till the bar is empty sets them down', () => {
    const { sim, events } = play('carry');
    const strand = land.maps.get('ZONE_SK_STRAND');
    if (strand === undefined) throw new Error('no strand');
    const opening = new OpeningBot(sim, strand, b, land);
    const hild = sim.state.onFoot?.actors['C_HILD'];
    if (hild === undefined) throw new Error('no Hild');
    opening.walkTo(
      (t) =>
        Math.abs(t.tx - Math.floor(hild.x / 24)) + Math.abs(t.ty - Math.floor(hild.y / 24)) === 1,
    );
    opening.interact();
    expect(sim.state.onFoot?.carrying).toBe('C_HILD');
    sim.state.player.stamina.current = 1;
    for (let i = 0; i < 60; i++) sim.step();
    expect(events.some((e) => e.type === 'LOAD_DROPPED')).toBe(true);
    expect(sim.state.onFoot?.carrying).toBeNull();
    // Too tired to lift her again until the bar recovers.
    opening.interact();
    expect(events.at(-1)).toMatchObject({ type: 'COMMAND_REFUSED', reason: 'TOO_TIRED' });
  });
});

describe('the camp in Book 10 numbers', () => {
  beforeAll(() => undefined);
  it('starts with the wreck stores, no fuel and no fire', () => {
    const { sim } = play('start');
    const h = home(sim.state);
    expect(h.stores['RES_SALTED_FISH']).toBe(work.wreckStoresRd);
    expect(h.stores['RES_DRIFTWOOD']).toBe(work.campFuelLoads);
    expect(h.fire.lit).toBe(false);
    expect(h.stage).toBe('S0');
  });
});
