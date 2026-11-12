/**
 * Design addendum 2.4's opening, guidance, world fixes and music fades (Book 4 section 08; Book 2
 * sections 10, 16 and 23; Book 10 section 25; decisions DE-16 to DE-31): the net and the cut, the
 * chest's outline and home, his key and chest, the mast shot, Runa's question, Hild walking up,
 * the shelter raised, the rescued joining the household, the aims and their stuck help, edges,
 * doors, the Hag's Stone, the cold open, and the music's gain envelopes.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parseOpeningBalance } from '../../src/content/openingBalance.ts';
import { referentsOf, steererWordingProblems } from '../../src/content/steererWords.ts';
import { fadeGain, layerJoinAt, MusicDirector, musicCues } from '../../src/audio/music.ts';
import type { MusicAction } from '../../src/audio/music.ts';
import { AudioRouter } from '../../src/audio/router.ts';
import { RecordingSink } from '../../src/audio/webAudio.ts';
import { PiecePlayer } from '../../src/audio/synth/sequencer.ts';
import { PIECES } from '../../src/audio/synth/cues.ts';
import { campContext } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { doorBlocks, doorBlocksPoint } from '../../src/sim/land/doors.ts';
import { sees } from '../../src/sim/ai/perception.ts';
import { findActor } from '../../src/sim/land/zoneLinks.ts';
import { journalLine, nextHintAfter } from '../../src/sim/narrative/aims.ts';
import { hagNow, hagPhases, lashingHit } from '../../src/sim/narrative/wreck.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { bandAt, stillWaterLevel } from '../../src/sim/land/water.ts';
import { migrateOpening } from '../../src/persist/openingMigration.ts';
import { activityOf } from '../../src/sim/people/schedule.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { openingProps, stagePropsNow } from '../../src/scenes/openingView.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { OpeningBot } from '../../src/tools/play/openingBot.ts';
import { playToCamp, WreckBot } from '../../src/tools/play/wreckBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const ob = parseOpeningBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const campOrNull = campContext(content);
if (campOrNull === null || land.wreck == null || land.aims == null) throw new Error('no content');
const camp = campOrNull;
const wreck = land.wreck;
const aims = land.aims;
const strand = land.maps.get('ZONE_SK_STRAND');
const machair = land.maps.get('ZONE_SK_MACHAIR');
if (strand === undefined || machair === undefined) throw new Error('no maps');
const T = 60;

function start(seed: string, coldOpen = false) {
  const world = newCampaign(
    seed,
    b,
    parsePeopleBasics(balance),
    content,
    { name: 'Ash', bodyModel: 'A' },
    { coldOpen },
  );
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  return { sim, events, world: sim.state };
}
const spoke = (events: SimEvent[], key: string) =>
  events.some(
    (e) => (e.type === 'PERSON_SPOKE' || e.type === 'PERSON_CALLED') && e.lineKey === key,
  );
const wrecked = (events: SimEvent[], what: string) =>
  events.some((e) => e.type === 'WRECK' && e.what === what);

describe('the cold open and the waking (Book 4 beats 1 and 2; DE-30)', () => {
  it('is played for Book 10’s coldOpen, steered from the first second, then waking in the surf', () => {
    const { sim, events, world } = start('cold', true);
    expect(world.facts['ch1.phase']).toBe('COLD_OPEN');
    // Control within seconds: the steering oar answers the first second's move.
    sim.submit({ type: 'MOVE', x: 1, y: 0, run: false, sneak: false });
    for (let i = 0; i < T; i++) sim.step();
    expect(Number(world.facts['ch1.cold_oar'])).toBeGreaterThan(0.5);
    const len = wreck.rw.coldOpen.seconds;
    expect(len).toBeGreaterThanOrEqual(ob.firstMinutes.coldOpen[0]);
    expect(len).toBeLessThanOrEqual(ob.firstMinutes.coldOpen[1]);
    const minute = world.calendar.minuteOfDay;
    for (let i = 0; i < (len - 2) * T; i++) sim.step();
    expect(world.calendar.minuteOfDay).toBe(minute);
    for (let i = 0; i < 2 * T; i++) sim.step();
    // The strike, the black and the waking happened in order.
    expect(events.flatMap((e) => (e.type === 'WRECK' ? [e.what] : []))).toEqual(
      expect.arrayContaining(['COLD_START', 'COLD_SHOUT', 'COLD_STRIKE', 'COLD_BLACK', 'WOKE']),
    );
    expect(world.facts['ch1.phase']).toBe('WAKING');
    // Waking: the steerer lies until the first input, and is up at once after it.
    const p = world.onFoot?.player;
    const x0 = p?.x ?? 0;
    sim.submit({ type: 'MOVE', x: -1, y: 0, run: false, sneak: false });
    for (let i = 0; i < wreck.rw.waking.getUpTicks + 30; i++) sim.step();
    expect(world.facts['ch1.phase']).toBe('PLAY');
    expect((p?.x ?? 0) < x0).toBe(true);
    expect(wreck.rw.waking.getUpTicks / T).toBeLessThan(ob.firstMinutes.firstInputSeconds);
    // Hild's first call within Book 10's hildCallBy of waking.
    const woke = Number(world.facts['ch1.woke_at']);
    const calls: number[] = [];
    sim.events.onAny((e) => {
      if (e.type === 'PERSON_CALLED') calls.push(sim.state.tick);
    });
    for (let i = 0; i < 16 * T; i++) sim.step();
    expect((calls[0] ?? Infinity) - woke).toBeLessThanOrEqual(ob.firstMinutes.hildCallSeconds * T);
  });
});

describe('Hild in the net and the seax (beats 3 to 5; DE-16)', () => {
  it('without a blade she says so; with the seax a hold-to-cut frees her, kept if let go', () => {
    const { sim, events, world } = start('net');
    const onFoot = world.onFoot;
    const hild = onFoot?.actors['C_HILD'];
    if (onFoot == null || hild === undefined) throw new Error('no Hild');
    onFoot.player.x = hild.x + 28;
    onFoot.player.y = hild.y;
    sim.step();
    expect(spoke(events, 'c_hild.net.no_blade')).toBe(true);
    // Thorkel's chest washes into place 2 tiles west of her once she is reached.
    const chest = findActor(onFoot, 'ITEM_THORKEL_CHEST');
    expect(chest?.zone).toBe('ZONE_SK_STRAND');
    expect((chest?.actor.x ?? 0) / 24).toBeCloseTo(29.5, 1);
    world.player.hotbar.slots[0] = 'ITEM_SEAX';
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(onFoot.player.work?.task).toBe('TASK_CUT_NET');
    const hold = ob.firstMinutes.cutHoldSeconds * T;
    for (let i = 0; i < hold / 2; i++) sim.step();
    sim.submit({ type: 'CANCEL_WORK' });
    sim.step();
    const kept = Number(world.facts['ch1.net_cut']);
    expect(kept).toBeGreaterThan(hold * 0.4);
    expect(world.facts['ch1.net_free']).toBeUndefined();
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(onFoot.player.work?.ticks).toBeLessThanOrEqual(hold - kept + 1);
    for (let i = 0; i < hold; i++) sim.step();
    expect(world.facts['ch1.net_free']).toBe(true);
    expect(wrecked(events, 'NET_CUT')).toBe(true);
    expect(spoke(events, 'c_hild.net.cut')).toBe(true);
    for (let i = 0; i < wreck.rw.net.jokeSeconds * T + 2; i++) sim.step();
    expect(spoke(events, 'c_hild.net.joke')).toBe(true);
    // A wave washes over her every netWaves seconds while she is caught.
    const w = start('waves');
    for (let i = 0; i < 2 * ob.firstMinutes.netWaveSeconds * T; i++) w.sim.step();
    expect(w.events.filter((e) => e.type === 'WRECK' && e.what === 'NET_WAVE').length).toBe(2);
  });

  it('a scripted new player meets Book 10’s first-minutes targets on the way to the shelter', () => {
    const { sim, world } = start('targets');
    const bot = playToCamp(sim, b, land, camp, { raise: false });
    bot.goToZone('ZONE_SK_STRAND');
    bot.firstFire(['drift_west_rocks', 'drift_west_bank']);
    bot.waitForHild();
    bot.raiseShelter();
    const at = (k: string) => (world.telemetry.marks[k]?.tick ?? Infinity) / T / 60;
    const m = ob.firstMinutes;
    console.log(
      `seax ${at('seax').toFixed(2)} hild ${at('hild_freed').toFixed(2)} chest ${at('chest_at_camp').toFixed(2)} fire ${at('fire').toFixed(2)} shelter ${at('shelter').toFixed(2)} min`,
    );
    expect(at('seax')).toBeLessThanOrEqual(m.seaxBy);
    expect(at('hild_freed')).toBeLessThanOrEqual(m.hildFreedBy);
    expect(at('chest_at_camp')).toBeLessThanOrEqual(m.chestAtCampBy);
    expect(at('fire')).toBeLessThanOrEqual(m.firstFireBy);
    expect(at('shelter')).toBeLessThanOrEqual(m.shelterBy);
  });
});

describe('Thorkel’s chest, its outline and home, his key and the bow (DE-17, DE-18)', () => {
  it('shows its outline when carried near its home and settles there; Hild walks up at the fire', () => {
    const { sim, events, world } = start('chest');
    const opening = new OpeningBot(sim, strand, b, land);
    opening.pickUp('wreck_seax');
    opening.rescue('C_HILD');
    const bot = new WreckBot(
      sim,
      b,
      land,
      camp,
      land.searches ?? (null as never),
      land.repairs ?? (null as never),
    );
    bot.waitFor(() => world.facts['ch1.chest_named'] === true, T * 30);
    expect(spoke(events, 'c_hild.chest.first')).toBe(true);
    bot.lift('ITEM_THORKEL_CHEST');
    bot.goToZone('ZONE_SK_MACHAIR');
    let outlined = false;
    const c = wreck.rw.chest;
    for (let i = 0; i < T * 60 && world.facts['ch1.chest_home'] !== true; i++) {
      const p = world.onFoot?.player;
      if (p === undefined) break;
      const near =
        Math.hypot(p.x / 24 - c.home.x, p.y / 24 - c.home.y) <= ob.feedback.homeOutlineTiles;

      outlined ||= near;
      break;
    }
    bot.chestToCamp();
    expect(outlined).toBe(true);
    expect(world.homes['ISLE_SKARV']?.placed).toEqual(['ITEM_THORKEL_CHEST']);
    expect(wrecked(events, 'CHEST_HOME')).toBe(true);
    // Hild is still on the strand at her work; the first fire's smoke brings her up.
    expect(world.facts['ch1.hild_walked_up']).toBeUndefined();
    bot.goToZone('ZONE_SK_STRAND');
    bot.firstFire(['drift_west_rocks', 'drift_west_bank']);
    bot.waitForHild();
    expect(spoke(events, 'c_hild.camp.walk_up')).toBe(true);
    // The shelter, raised in one visible action: the sail hauled up, filling, then the lean-to.
    const home = world.homes['ISLE_SKARV'];
    if (home === undefined) throw new Error('no home');
    const s0 = camp.def.props.S0;
    expect(
      openingProps(world, wreck, machair, s0, world.tick).some((p) => p.frame === 'folded/-/0'),
    ).toBe(true);
    expect(stagePropsNow(world, s0, world.tick).some((p) => p.sheet === 'prop_sail_leanto')).toBe(
      false,
    );
    const frames = new Set<string>();
    sim.events.onAny(() => undefined);
    const site = wreck.camp?.shelter ?? { x: 0, y: 0 };
    bot.walkTo(
      (t) => Math.abs(t.tx - Math.floor(site.x)) + Math.abs(t.ty - Math.floor(site.y)) <= 1,
    );
    sim.submit({ type: 'INTERACT_AT', tile: { tx: Math.floor(site.x), ty: Math.floor(site.y) } });
    for (let i = 0; i < ob.camp.shelterRaise.seconds * T + 70; i++) {
      sim.step();
      for (const p of openingProps(world, wreck, machair, s0, world.tick))
        if (p.sheet === 'prop_sail_raise') frames.add(p.frame.split('/')[0] ?? '');
    }
    expect([...frames].sort()).toEqual(['fill', 'raise']);
    expect(world.facts['ch1.shelter_raised']).toBe(true);
    expect(stagePropsNow(world, s0, world.tick).some((p) => p.sheet === 'prop_sail_leanto')).toBe(
      true,
    );
    expect(wrecked(events, 'SHELTER_RAISED')).toBe(true);
    expect(
      events.some(
        (e) => e.type === 'WRECK' && e.what === 'SHELTER_RAISED' && e.key === 'caption.action.sail',
      ),
    ).toBe(true);
  });

  it('cannot be opened without his key; the key opens it on the bow, a quiver, his chart and things', () => {
    const { sim, events, world } = start('key');
    campHooks(world, content, land, new URLSearchParams('camp=broch'));
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('no onFoot');
    const c = wreck.rw.chest;
    delete onFoot.actors['C_HILD'];
    onFoot.actors[c.id] = { x: c.home.x * 24, y: c.home.y * 24, facing: 'e', pose: 'idle' };
    onFoot.player.x = (c.home.x + 1) * 24;
    onFoot.player.y = c.home.y * 24;
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(world.facts['ch1.chest_opened']).toBeUndefined();
    expect(onFoot.carrying).toBeNull();
    sim.submit({ type: 'CANCEL_WORK' });
    sim.step();
    world.player.inventory[c.key] = 1;
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(world.facts['ch1.chest_opened']).toBe(true);
    expect(world.player.hotbar.slots).toContain('ITEM_BOW');
    expect(world.player.inventory['ITEM_ARROW']).toBe(wreck.startingArrows);
    expect(world.player.inventory['ITEM_CHART_FRAGMENT']).toBe(1);
    // Three bindings (Book 10 bindingsFound), carried by number for combat v2's healing.
    expect(world.player.inventory['ITEM_BINDING']).toBe(
      c.contents.find((t) => t.item === 'ITEM_BINDING')?.count,
    );
    expect(world.player.inventory[c.key]).toBeUndefined();
    // The bow's pickup shows its tooltip (the first of its kind), and Hild's line.
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'ITEM_PICKED_UP', item: 'ITEM_BOW', first: true }),
    );
    expect(spoke(events, 'c_hild.chest.bow')).toBe(true);
    expect(content.onFoot?.items['ITEM_BOW']?.tipKey).toBe('ui.tip.bow');
  });

  it('the camp’s salvage holds Book 10’s bindingsAtCamp, picked up by number up to healCarry', () => {
    const { sim, world } = start('bindings');
    campHooks(world, content, land, new URLSearchParams('camp=broch'));
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('no onFoot');
    expect(onFoot.zone).toBe('ZONE_SK_MACHAIR');
    const lying = onFoot.items.find((i) => i.key === 'camp_bindings');
    expect(lying?.item).toBe('ITEM_BINDING');
    expect(lying?.count).toBe(ob.camp.bindingsAtCamp);
    if (lying === undefined) return;
    const cap = land.fight?.cb.heal.maxBindings ?? 0;
    // Nearly full: only what fits is taken, and the rest stays lying.
    world.player.inventory['ITEM_BINDING'] = cap - 1;
    onFoot.player.x = lying.x * 24;
    onFoot.player.y = (lying.y + 0.6) * 24;
    sim.submit({ type: 'INTERACT_AT', tile: { tx: Math.floor(lying.x), ty: Math.floor(lying.y) } });
    sim.step();
    expect(world.player.inventory['ITEM_BINDING']).toBe(cap);
    expect(onFoot.items.find((i) => i.key === 'camp_bindings')?.count).toBe(
      ob.camp.bindingsAtCamp - 1,
    );
  });

  it('his key reaches the steerer however Bran’s search ends: from Bran at the bier, or the body', () => {
    for (const outcome of ['BARGAIN', 'LOST'] as const) {
      const { sim, world } = start(`key-${outcome}`);
      campHooks(world, content, land, new URLSearchParams('camp=broch'));
      const onFoot = world.onFoot;
      if (onFoot === null) throw new Error('no onFoot');
      world.facts['search.bran'] = outcome;
      if (outcome === 'BARGAIN') {
        world.facts['ch1.thorkel_body'] = 'CAMP';
        onFoot.actors['C_BRAN'] = {
          x: onFoot.player.x + 30,
          y: onFoot.player.y,
          facing: 'w',
          pose: 'idle',
        };
        onFoot.actors['C_THORKEL'] = {
          x: onFoot.player.x + 50,
          y: onFoot.player.y,
          facing: 'w',
          pose: 'dead',
        };
        sim.step();
        expect(world.facts['ch1.key']).toBe('BRAN');
      } else {
        onFoot.actors['C_THORKEL'] = {
          x: onFoot.player.x + 20,
          y: onFoot.player.y,
          facing: 'w',
          pose: 'dead',
        };
        sim.submit({ type: 'INTERACT' });
        sim.step();
        expect(world.facts['ch1.key']).toBe('BODY');
      }
      expect(world.player.inventory['ITEM_THORKEL_KEY']).toBe(1);
    }
  });
});

describe('the bow’s first use: the stores on the mast (DE-19)', () => {
  it('a missile drawn through the lashing cuts it, the bundle falls and is carried up as one load', () => {
    const { sim, events, world } = start('mast');
    world.player.hotbar.slots[0] = 'ITEM_BOW';
    world.player.inventory['ITEM_ARROW'] = 6;
    world.facts['ch1.at_broch'] = true;
    const bot = new WreckBot(
      sim,
      b,
      land,
      camp,
      land.searches ?? (null as never),
      land.repairs ?? (null as never),
    );
    const spent = bot.shootLashing({ x: 41.5, y: 27.5 }, 6);
    expect(world.facts['ch1.lashing_cut']).toBe(true);
    expect(spent).toBeLessThanOrEqual(6);
    expect(wrecked(events, 'LASHING_CUT')).toBe(true);
    expect(wrecked(events, 'BUNDLE_SPLASH')).toBe(true);
    // The salt fish at the camp, counting what combat v2 packs as rations there (each 1 rd).
    const fish = (): number =>
      (world.homes['ISLE_SKARV']?.stores['RES_SALTED_FISH'] ?? 0) +
      (world.player.inventory['ITEM_RATION'] ?? 0);
    const before = fish();
    bot.storesToCamp();
    expect(world.facts['ch1.mast_stores']).toBe('CAMP');
    expect(fish()).toBe(before + ob.camp.mastStoresRd);
  });

  it('the bundle lands in wading depth at any tide, in view while aiming from the shot (DF-82)', () => {
    const m = wreck.rw.mast;
    const elev = land.elevations.get(m.zone);
    if (elev === undefined) throw new Error('no strand');
    for (const level of [0, 0.25, 0.5, 0.75, 1]) {
      const band = bandAt(land.water, elev, m.fall.x * 24, m.fall.y * 24, level)?.band ?? 'DRY';
      expect(['DRY', 'WET', 'ANKLE', 'KNEE'], `level ${level}`).toContain(band);
    }
    // A tile below the lashing, and in view from the bot's shooting spot while aiming (Book 10
    // lookAheadAiming: the view leads 5 tiles towards the aim, half a view is 13.3 x 7.5 tiles).
    // Off the outcrop's foot, in the shallows at every state of the tide (not dry, never deep).
    for (const level of [0, 0.5, 1])
      expect(['ANKLE', 'KNEE']).toContain(
        bandAt(land.water, elev, m.fall.x * 24, m.fall.y * 24, level)?.band ?? 'DRY',
      );
    expect(Math.hypot(m.fall.x - m.foot.x, m.fall.y - m.foot.y)).toBeLessThan(3.5);
    const shot = { x: 41.5, y: 27.5 };
    expect(Math.abs(m.fall.x - shot.x)).toBeLessThan(13.3);
    expect(Math.abs(m.fall.y - (shot.y + 5))).toBeLessThan(7.5);
  });

  it('the bundle is waded for at high water with no wait for the ebb (DF-82)', () => {
    const { sim, world } = start('mast-high');
    world.player.hotbar.slots[0] = 'ITEM_BOW';
    world.player.inventory['ITEM_ARROW'] = 6;
    world.facts['ch1.at_broch'] = true;
    const bot = new WreckBot(
      sim,
      b,
      land,
      camp,
      land.searches ?? (null as never),
      land.repairs ?? (null as never),
    );
    bot.shootLashing({ x: 41.5, y: 27.5 }, 6);
    expect(world.facts['ch1.lashing_cut']).toBe(true);
    // Wait for high water, then go for the bundle at once.
    bot.waitFor(() => stillWaterLevel(tideAt(world.calendar, b)) > 0.95, 60 * 60 * 30);
    expect(stillWaterLevel(tideAt(world.calendar, b))).toBeGreaterThan(0.95);
    const before = world.tick;
    bot.lift(wreck.rw.mast.bundle);
    expect(world.onFoot?.carrying).toBe(wreck.rw.mast.bundle);
    expect(stillWaterLevel(tideAt(world.calendar, b))).toBeGreaterThan(0.8);
    expect(world.tick - before).toBeLessThan(60 * 60);
  });

  it('a missile that passes beside the lashing does not cut it', () => {
    const m = wreck.rw.mast;
    const p = {
      n: 1,
      kind: 'arrow' as const,
      shooter: 'P_STEERER',
      x0: m.lashing.x * 24 + 40,
      y0: 27 * 24,
      ux: 0,
      uy: 1,
      length: 200,
      ticks: 30,
      apex: 4,
      t: 10,
      x: 0,
      y: 0,
      z: 0,
    };
    expect(lashingHit(p, m, 24, 26)).toBe(false);
  });
});

describe('Runa’s tool chest: “Where have you put it?” (DE-21)', () => {
  const setUp = (seed: string) => {
    const { sim, events, world } = start(seed);
    campHooks(world, content, land, new URLSearchParams('camp=broch&time=10:00'));
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('no onFoot');
    world.household.residents.push('C_RUNA');
    world.facts['runa.tools_at'] = 'FIRE';
    onFoot.actors['C_RUNA'] = {
      x: onFoot.player.x + 20,
      y: onFoot.player.y,
      facing: 'w',
      pose: 'idle',
    };
    return { sim, events, world };
  };
  it('the truth satisfies her and is never found out', () => {
    const { sim, events, world } = setUp('runa-truth');
    const before = world.people['C_RUNA']?.friendship ?? 0;
    sim.submit({ type: 'TALK', person: 'C_RUNA' });
    sim.step();
    expect(world.talk?.scene).toBe('runa.where');
    for (let i = 0; i < 4 * T; i++) sim.step();
    sim.submit({ type: 'TALK_CHOOSE', index: 0 });
    for (let i = 0; i < 6 * T; i++) sim.step();
    expect(world.people['C_RUNA']?.friendship).toBe(before + ob.searches.runaTruthFriendship);
    expect(spoke(events, 'c_runa.chest.truth')).toBe(true);
    for (let i = 0; i < 60 * T; i++) sim.step();
    expect(world.facts['runa.lie_found']).toBeUndefined();
  });
  it('a lie is found out within a day, and costs her Word', () => {
    const { sim, world } = setUp('runa-lie');
    const before = world.people['C_RUNA']?.friendship ?? 0;
    sim.submit({ type: 'TALK', person: 'C_RUNA' });
    sim.step();
    for (let i = 0; i < 4 * T; i++) sim.step();
    sim.submit({ type: 'TALK_CHOOSE', index: 2 });
    for (let i = 0; i < 6 * T; i++) sim.step();
    world.calendar = { ...world.calendar, day: world.calendar.day + 1 };
    sim.step();
    expect(world.facts['runa.lie_found']).toBe(true);
    const word = world.people['C_RUNA']?.values.WORD ?? 0;
    expect(world.people['C_RUNA']?.friendship).toBe(before - ob.searches.runaLiePerWord * word);
  });
});

describe('everyone rescued gets up and joins the household (DE-22)', () => {
  it('Hild, Oddi, Bran and Runa reach the camp and sleep under the shelter, two nights running', () => {
    const { sim, world } = start('rescued');
    const bot = playToCamp(sim, b, land, camp);
    bot.goToZone('ZONE_SK_STRAND');
    bot.firstFire(['drift_west_rocks', 'drift_west_bank']);
    bot.waitForHild();
    bot.waitUntil(19 * 60 + 5);
    bot.oddi('CHEST_FIRST');
    bot.runa('OFFERING');
    bot.bran('BARGAIN');
    bot.waitFor(() => world.facts['ch1.thorkel_body'] === 'CAMP', T * 600);
    for (const id of ['C_HILD', 'C_ODDI', 'C_BRAN', 'C_RUNA'])
      expect(world.household.residents).toContain(id);
    // Never left sitting where they were found: a moment after being set down they are up.
    expect(world.facts['rescue.C_ODDI.up']).toBe(true);
    const beds = camp.def.shelterBeds ?? [];
    for (let night = 0; night < 2; night++) {
      bot.goToZone('ZONE_SK_MACHAIR');
      bot.waitUntil(23 * 60 + 30);
      // A scene that night (Oddi's theft found, Stage 8) is judged first; then they are abed.
      if (world.talk !== null) {
        for (let k = 0; k < 20 && sim.state.talk !== null; k++) {
          sim.submit({ type: 'TALK_CHOOSE', index: 0 });
          bot.step(T * 3);
        }
        bot.waitUntil(30);
      }
      for (const id of ['C_HILD', 'C_ODDI', 'C_BRAN', 'C_RUNA']) {
        const f = findActor(world.onFoot ?? (null as never), id);
        expect(f?.zone, `${id} night ${night}`).toBe('ZONE_SK_MACHAIR');
        const a = f?.actor;
        // Under the lean-to's furs at S0; once residents have put the S1 sail roof over the court
        // (Book 7 section 06), anywhere under it.
        const roofed = world.homes['ISLE_SKARV']?.stage === 'S1';
        const under = roofed
          ? Math.hypot((a?.x ?? 0) / 24 - 35.5, (a?.y ?? 0) / 24 - 31.5) < 4.6
          : beds.some((bd) => Math.hypot((a?.x ?? 0) / 24 - bd.x, (a?.y ?? 0) / 24 - bd.y) < 0.5);
        expect(
          under,
          `${id} under the shelter on night ${night}: ${f?.zone} ${((a?.x ?? 0) / 24).toFixed(1)},${((a?.y ?? 0) / 24).toFixed(1)} ${a?.pose} ${world.homes['ISLE_SKARV']?.stage} ${world.calendar.day} ${world.people[id]?.life.activity} ${JSON.stringify(world.talk?.scene ?? world.talk?.kind ?? null)}`,
        ).toBe(true);
        expect(a?.pose).toBe('sleep');
        expect(world.people[id]?.life.activity).toBe('SLEEP');
      }
      bot.doAt('bed_s0');
      bot.waitFor(
        () => world.calendar.minuteOfDay >= 6 * 60 && world.calendar.minuteOfDay < 7 * 60,
        T * 120,
      );
      bot.waitUntil(12 * 60);
      // Through the day, they eat and work.
      for (const id of ['C_HILD', 'C_ODDI', 'C_BRAN', 'C_RUNA'])
        expect(world.people[id]?.life.meals.count, id).toBeGreaterThan(0);
    }
  }, 240_000);
});

describe('aims, the journal and stuck help (DE-23, DE-24; Book 8 section 13)', () => {
  it('every Chapter 1 aim has its journal line and two hints in the strings', () => {
    expect(aims.aims.length).toBe(19);
    for (const a of aims.aims) {
      expect(content.strings.has(a.journalKey), a.id).toBe(true);
      expect(a.hints).toHaveLength(2);
      for (const h of a.hints) {
        expect(content.strings.has(h.textKey), h.textKey).toBe(true);
        if (h.alt !== undefined)
          expect(content.strings.has(h.alt.textKey), h.alt.textKey).toBe(true);
      }
    }
  });

  it('gives the first hint at stuckFirst, the clearer at stuckSecond more, then repeats', () => {
    expect(nextHintAfter(ob, 0)).toBe(ob.guidance.stuckFirstSeconds * T);
    expect(nextHintAfter(ob, 1)).toBe(
      (ob.guidance.stuckFirstSeconds + ob.guidance.stuckSecondSeconds) * T,
    );
    expect(nextHintAfter(ob, 2)).toBe(
      (ob.guidance.stuckFirstSeconds +
        ob.guidance.stuckSecondSeconds +
        ob.guidance.stuckRepeatSeconds) *
        T,
    );
    expect(nextHintAfter(ob, 1 + ob.guidance.stuckRepeatTimes + 1)).toBeNull();
    const { sim, events, world } = start('stuck');
    const sp = world.onFoot?.player;
    if (sp === undefined) throw new Error('no player');
    // Within a call's carry of Hild (Book 10 callCarry), away from the aim's places.
    sp.x = 52 * 24;
    sp.y = 37 * 24;
    sim.step();
    expect(journalLine(world, aims)).toBe('ui.journal.aim.find_hild');
    // Standing still is no progress: the first hint comes at stuckFirst, as a call with direction.
    const hints: { tick: number; hint: number; called: boolean }[] = [];
    sim.events.onAny((e) => {
      if (e.type === 'AIM_HINT')
        hints.push({ tick: sim.state.tick, hint: e.hint, called: e.called });
    });
    for (
      let i = 0;
      i < (ob.guidance.stuckFirstSeconds + ob.guidance.stuckSecondSeconds) * T + 10;
      i++
    )
      sim.step();
    expect(hints.map((h) => h.hint)).toEqual([0, 1]);
    expect(hints[0]?.tick).toBe(ob.guidance.stuckFirstSeconds * T);
    expect(hints[1]?.tick).toBe(
      (ob.guidance.stuckFirstSeconds + ob.guidance.stuckSecondSeconds) * T,
    );
    expect(hints.every((h) => h.called)).toBe(true);
    expect(spoke(events, 'c_hild.hint.find_hild.1')).toBe(true);
    // Progress restarts the count: a place along the way reached.
    const p = world.onFoot?.player;
    if (p === undefined) throw new Error('no player');
    p.x = 64.5 * 24;
    p.y = 34.6 * 24;
    sim.step();
    expect(world.aims?.since).toBe(world.tick - 1);
  });

  it('no hint during a talk or a scene', () => {
    const { sim, world } = start('quiet');
    sim.step();
    world.talk = {
      kind: 'SEARCH',
      with: 'C_HILD',
      scene: 'test',
      node: null,
      topics: [],
      topic: null,
      queue: [],
      nextLineTick: Infinity,
      line: null,
      chosen: null,
      ending: false,
      since: 0,
    };
    let hinted = false;
    sim.events.onAny((e) => {
      if (e.type === 'AIM_HINT') hinted = true;
    });
    for (let i = 0; i < (ob.guidance.stuckFirstSeconds + 5) * T; i++) sim.step();
    expect(hinted).toBe(false);
  });
});

describe('"Nothing that way" (DE-25)', () => {
  const press = (seed: string, x: number, y: number, mx: number, my: number, seconds: number) => {
    const { sim, events, world } = start(seed);
    const p = world.onFoot?.player;
    if (p === undefined) throw new Error('no player');
    p.x = x * 24;
    p.y = y * 24;
    const from = { x: p.x, y: p.y };
    sim.submit({ type: 'MOVE', x: mx, y: my, run: false, sneak: false });
    for (let i = 0; i < seconds * T; i++) sim.step();
    const edge = events.flatMap((e) => (e.type === 'EDGE_CAPTION' ? [e] : []));
    return { from, p, edge, world };
  };

  it('stops at deep water with its caption (DEEP), once in the cooldown, with no sliding', () => {
    // Straight into the sea from the waking place's shingle (south), then diagonally into it.
    const r = press('edge-deep', 70.5, 37.9, 0.25, 1, 6);
    expect(r.edge[0]?.kind).toBe('DEEP');
    expect(r.edge.length).toBe(Math.ceil(6 / ob.feedback.edgeCaptionCooldownSeconds));
    // More than 45 degrees into the edge: stopped, not slid along it.
    expect(Math.abs(r.p.x - r.from.x)).toBeLessThan(24);
  });

  it('gives STEEP at rock and NOTHING at the zone’s end with no link', () => {
    const rock = press('edge-steep', 63, 34.6, 0, 1, 2);
    expect(rock.edge[0]?.kind).toBe('STEEP');
    const end = press('edge-nothing', 94.5, 30, 1, 0, 2);
    expect(end.edge[0]?.kind).toBe('NOTHING');
  });

  it('moves along an edge pressed at a shallow angle (a walk beside the shore is not caught)', () => {
    const r = press('edge-along', 70.5, 37.9, -1, 0.3, 1);
    expect(r.from.x - r.p.x).toBeGreaterThan(20);
  });
});

describe('doors (DE-26)', () => {
  it('a closed door blocks movement and sight until opened; it opens when walked into and closes after', () => {
    const { sim, events, world } = start('doors');
    campHooks(world, content, land, new URLSearchParams('camp=broch&stage=S1'));
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('no onFoot');
    const door = machair.doors?.find((d) => d.id === 'broch_door');
    if (door === undefined) throw new Error('no broch door');
    sim.step();
    expect(onFoot.doors?.map((d) => d.id)).toContain('broch_door');
    const at = { x: door.pos.x * 24, y: door.pos.y * 24 };
    // Closed: the doorway blocks a footprint, and a line of sight through it.
    expect(doorBlocks(onFoot, machair, at.x, at.y - 2, land.rules.footprint)).toBe(true);
    expect(doorBlocksPoint(onFoot, machair, at.x, at.y - 4)).toBe(true);
    const ai = { sight: { coneDegrees: 360 } } as Parameters<typeof sees>[0];
    const solid = (x: number, y: number) => doorBlocksPoint(onFoot, machair, x, y);
    expect(
      sees(ai, { x: at.x, y: at.y + 60, facing: 'n' }, { x: at.x, y: at.y - 60 }, 20, 24, solid),
    ).toBe(false);
    // Walked into from outside, it opens in Book 10's openTicks.
    onFoot.player.x = at.x;
    onFoot.player.y = at.y + 12;
    sim.submit({ type: 'MOVE', x: 0, y: -1, run: false, sneak: false });
    for (let i = 0; i < ob.doors.openTicks + 2; i++) sim.step();
    expect(onFoot.doors?.find((d) => d.id === 'broch_door')?.open).toBe(1);
    expect(events.some((e) => e.type === 'DOOR' && e.what === 'OPENING')).toBe(true);
    expect(doorBlocksPoint(onFoot, machair, at.x, at.y - 4)).toBe(false);
    expect(
      sees(ai, { x: at.x, y: at.y + 60, facing: 'n' }, { x: at.x, y: at.y - 60 }, 20, 24, solid),
    ).toBe(true);
    // Through, then away: closeAfter seconds after the doorway is clear it swings shut.
    for (let i = 0; i < 3 * T; i++) sim.step();
    sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
    for (let i = 0; i < (ob.doors.closeAfterSeconds + 1) * T + ob.doors.closeTicks; i++) sim.step();
    expect(onFoot.doors?.find((d) => d.id === 'broch_door')?.open).toBe(0);
    expect(events.some((e) => e.type === 'DOOR' && e.what === 'SHUT')).toBe(true);
  });

  it('the shelter’s flap exists only once the sail is raised', () => {
    const { sim, world } = start('flap');
    campHooks(world, content, land, new URLSearchParams('camp=broch&shelter=down'));
    sim.step();
    expect(world.onFoot?.doors ?? []).toEqual([]);
    world.facts['ch1.shelter_raised'] = true;
    sim.step();
    expect(world.onFoot?.doors?.map((d) => d.id)).toEqual(['shelter_flap']);
  });
});

describe('the Hag’s Stone (DE-28)', () => {
  it('lasts 6 to 10 s in its phases, plays near the weeping stone, never explained', () => {
    for (let n = 1; n <= 4; n++) {
      const hold = wreck.rw.hagStone.holds[n - 1] ?? ob.stone.holdDefaultSeconds;
      const phases = hagPhases(ob, hold);
      const total = phases[phases.length - 1]?.at ?? 0;
      expect(total).toBeGreaterThanOrEqual(6);
      expect(total).toBeLessThanOrEqual(10);
    }
    const { sim, events, world } = start('hag');
    campHooks(
      world,
      content,
      land,
      new URLSearchParams('camp=broch&time=10:00&zone=ZONE_SK_HAGSEAT&at=4,24'),
    );
    sim.step();
    const stone = wreck.stone;
    const p = world.onFoot?.player;
    if (stone === null || p === undefined) throw new Error('no stone');
    expect(world.onFoot?.zone).toBe('ZONE_SK_HAGSEAT');
    p.x = (stone.x + 3) * 24;
    p.y = (stone.y + 2) * 24;
    sim.step();
    expect(hagNow(world, wreck)?.what).toBe('HAG_HUSH');
    const whats: string[] = [];
    sim.events.onAny((e) => {
      if (e.type === 'WRECK') whats.push(e.what);
    });
    for (let i = 0; i < 11 * T; i++) sim.step();
    expect(whats).toEqual(['HAG_COLD', 'HAG_HOLD', 'HAG_GUST', 'HAG_SETTLE', 'HAG_DONE']);
    expect(hagNow(world, wreck)).toBeNull();
    // Once a visit: staying near does not play it again.
    for (let i = 0; i < 5 * T; i++) sim.step();
    expect(events.filter((e) => e.type === 'WRECK' && e.what === 'HAG_HUSH').length).toBe(1);
    // Its captions are information, none explains it.
    for (const k of Object.values(wreck.rw.hagStone.captions))
      expect(content.strings.get(k)?.tags).toEqual(['INFO']);
  });
});

describe('music fades (DE-29)', () => {
  const table = content.audio;
  if (table === null) throw new Error('no audio');
  const fades = {
    fadeIn: ob.music.fadeInSeconds,
    fadeOut: ob.music.fadeOutSeconds,
    layersJoin: 25,
  };

  it('every start fades in, every stop fades out, and a change cross-fades', () => {
    const director = new MusicDirector(musicCues(table.cues), fades);
    const actions = [...director.update(0)];
    director.request('MUS_HOME_DAY', 0);
    actions.push(...director.update(0));
    director.request('MUS_ISLAND_EXPLORE', 3);
    for (let t = 3; t < 12; t += 0.5) actions.push(...director.update(t));
    director.silence(20);
    for (let t = 20; t < 30; t += 0.5) actions.push(...director.update(t));
    const starts = actions.filter((a) => a.type === 'start');
    const stops = actions.filter((a) => a.type === 'stop');
    expect(starts.length).toBe(2);
    expect(stops.length).toBe(2);
    for (const s of starts) {
      expect('fadeIn' in s ? s.fadeIn : null).toBe(ob.music.fadeInSeconds);
      expect(fadeGain('in', 0, ob.music.fadeInSeconds)).toBe(0);
    }
    for (const s of stops) expect('fadeOut' in s ? s.fadeOut : null).toBe(ob.music.fadeOutSeconds);
    // The change: the old stops as the new starts, on the same bar line.
    expect(stops[0]?.at).toBe(starts[1]?.at);
    expect(ob.music.fadeInSeconds).toBeGreaterThanOrEqual(ob.music.fadeInRange[0]);
    expect(ob.music.fadeOutSeconds).toBeLessThanOrEqual(ob.music.fadeOutRange[1]);
  });

  it('the mixer’s gain rises from silence and falls to it, never stepping at full volume', () => {
    const automation: { kind: string; v: number; t: number }[] = [];
    const param = () => ({
      value: 1,
      setValueAtTime: (v: number, t: number) => automation.push({ kind: 'set', v, t }),
      linearRampToValueAtTime: (v: number, t: number) => automation.push({ kind: 'ramp', v, t }),
      setTargetAtTime: () => undefined,
    });
    const node = () => ({ gain: param(), connect: (n: unknown) => n });
    const engine = {
      ctx: { createGain: node },
      buses: { music: {} },
      setEcho: () => undefined,
      playNote: () => 0,
    } as unknown as ConstructorParameters<typeof PiecePlayer>[0];
    const piece = PIECES['hearth'] ?? Object.values(PIECES)[0];
    if (piece === undefined) throw new Error('no piece');
    const player = new PiecePlayer(engine, piece, null);
    automation.length = 0;
    player.start(10, fades.fadeIn, fades.layersJoin);
    // The piece's master gain: set to 0 at the start, ramped to 1 over the fade.
    expect(automation[0]).toEqual({ kind: 'set', v: 0, t: 10 });
    expect(automation.find((a) => a.kind === 'ramp')).toEqual({
      kind: 'ramp',
      v: 1,
      t: 10 + fades.fadeIn,
    });
    automation.length = 0;
    player.stop(fades.fadeOut);
    player.schedule(10 + 60);
    const ramp = automation.find((a) => a.kind === 'ramp' && a.v === 0);
    expect(ramp).toBeDefined();
    const set = automation.find((a) => a.kind === 'set' && a.v === 1);
    expect((ramp?.t ?? 0) - (set?.t ?? 0)).toBeCloseTo(fades.fadeOut, 5);
    expect(player.stopped).toBe(true);
    // One layer first; the others join over the first layersJoin seconds, on bar lines.
    const bar = player.barSeconds;
    expect(layerJoinAt(0, 4, 25, bar)).toBe(0);
    expect(layerJoinAt(3, 4, 25, bar)).toBeGreaterThanOrEqual(25 - 1e-9);
    expect(layerJoinAt(3, 4, 25, bar)).toBeLessThan(25 + bar);
  });
  it('in the game’s router, every music cue starts and stops faded; only stingers are sharp', () => {
    // The fades as the game gives them to the router (src/scenes/playView.ts: Book 10 section 25).
    const m = land.wreck?.ob.music;
    if (m === undefined) throw new Error('no music fades');
    const gameFades = {
      fadeIn: m.fadeInSeconds,
      fadeOut: m.fadeOutSeconds,
      layersJoin: (m.layersJoin[0] + m.layersJoin[1]) / 2,
    };
    expect(gameFades.fadeIn).toBeGreaterThan(0);
    expect(gameFades.fadeOut).toBeGreaterThan(0);
    const musicOf = (sink: RecordingSink): MusicAction[] =>
      sink.calls.flatMap((c) => (c.kind === 'music' ? [c.detail as MusicAction] : []));
    const music = table.cues.filter((c) => c.kind === 'music');
    expect(music.length).toBeGreaterThan(0);
    for (const cue of music) {
      // Started from silence, changed to another piece, and silenced: never at full volume.
      const sink = new RecordingSink();
      const router = new AudioRouter(table, content.strings, sink, gameFades);
      const other = music.find((c) => c.id !== cue.id);
      router.play(cue.id, 0);
      router.update(0);
      if (other !== undefined) {
        router.play(other.id, 5);
        for (let t = 5; t < 30; t += 0.5) router.update(t);
        router.play(cue.id, 30);
        for (let t = 30; t < 60; t += 0.5) router.update(t);
      }
      router.silence(60);
      for (let t = 60; t < 120; t += 0.5) router.update(t);
      const actions = musicOf(sink);
      const starts = actions.filter((a) => a.type === 'start');
      const stops = actions.filter((a) => a.type === 'stop');
      expect(starts.length, cue.id).toBeGreaterThan(0);
      expect(stops.length, cue.id).toBe(starts.length);
      for (const a of starts) expect(a.fadeIn, `${cue.id} start`).toBe(gameFades.fadeIn);
      for (const a of stops) expect(a.fadeOut, `${cue.id} stop`).toBe(gameFades.fadeOut);
      expect(fadeGain('in', 0, gameFades.fadeIn)).toBe(0);
      expect(fadeGain('out', gameFades.fadeOut, gameFades.fadeOut)).toBe(0);
    }
    // A stinger plays at once as a one-shot over the music, which only ducks: no fade, no start.
    const stingers = table.cues.filter((c) => c.kind === 'stinger');
    expect(stingers.length).toBeGreaterThan(0);
    for (const cue of stingers) {
      const sink = new RecordingSink();
      const router = new AudioRouter(table, content.strings, sink, gameFades);
      router.play(cue.id, 3);
      expect(sink.calls, cue.id).toContainEqual({
        kind: 'oneShot',
        detail: { cue: cue.id, at: 3, pan: 0 },
      });
      expect(
        musicOf(sink).map((a) => a.type),
        cue.id,
      ).toEqual(['duck']);
    }
  });
});

describe('REFERS lines (DE-31)', () => {
  it('allows only the words that fit the referent, never with {steerer}', () => {
    const tags = ['ADDRESS_STEERER', 'REFERS:c_thorkel'];
    expect(steererWordingProblems('He wore the key round his neck.', tags)).toEqual([]);
    expect(steererWordingProblems('She wore the key round her neck.', tags).length).toBe(1);
    expect(steererWordingProblems('{steerer}, he wore it.', tags).length).toBeGreaterThan(0);
    expect(
      steererWordingProblems('Her keel.', ['ADDRESS_STEERER', 'REFERS:nobody']).length,
    ).toBeGreaterThan(0);
    expect(referentsOf(tags)).toEqual(['c_thorkel']);
    // The user's own lines carry their referents.
    for (const key of [
      'c_hild.chest.first',
      'c_hild.camp.old_boat',
      'c_hild.fire.aims.01',
      'c_hild.chest.bow',
    ])
      expect(referentsOf(content.strings.get(key)?.tags ?? []).length, key).toBe(1);
  });
});

describe('2.4 work finished by 2.5 (DF-21)', () => {
  it("a save from before version 11 gains the camp's bindings with the balance context (DF-51)", () => {
    const { world } = start('old-save');
    const state = structuredClone(world) as unknown as Record<string, unknown>;
    const onFoot = state['onFoot'] as {
      zone: string;
      items: { key: string }[];
      elsewhere: Record<string, { items: { key: string }[] }>;
    };
    // A save from before 2.4 had no bindings lying at the camp.
    for (const rest of Object.values(onFoot.elsewhere))
      rest.items = rest.items.filter((i) => i.key !== 'camp_bindings');
    onFoot.items = onFoot.items.filter((i) => i.key !== 'camp_bindings');
    const without = migrateOpening(structuredClone(state));
    const withCtx = migrateOpening(structuredClone(state), { balance });
    const found = (s: Record<string, unknown>) => {
      const o = s['onFoot'] as typeof onFoot;
      return [...o.items, ...Object.values(o.elsewhere).flatMap((r) => r.items)].filter(
        (i) => i.key === 'camp_bindings',
      ) as unknown as { count: number; item: string }[];
    };
    expect(found(without)).toHaveLength(0);
    expect(found(withCtx)).toEqual([
      expect.objectContaining({ item: 'ITEM_BINDING', count: ob.camp.bindingsAtCamp }),
    ]);
    // Not twice.
    expect(found(migrateOpening(withCtx, { balance }))).toHaveLength(1);
  });

  it("Runa, seriously wounded, works the boat seated beside it, off the steerer's spot (DF-52)", () => {
    const { world } = start('runa-hurt');
    const people = land.people;
    if (people == null) throw new Error('no people');
    world.household.residents.push('C_RUNA');
    const runa = world.people['C_RUNA'];
    if (runa === undefined) throw new Error('no Runa');
    runa.job = { kind: 'SHIPWRIGHT', since: world.calendar.day, byOrder: false };
    runa.wounds = [{ severity: 'SERIOUS' } as (typeof runa.wounds)[number]];
    const job = people.household.jobs['SHIPWRIGHT'];
    const seat = job?.hurtSpots?.[0];
    if (seat === undefined) throw new Error('no seated place');
    const work = content.repairs?.boat.work;
    if (work === undefined) throw new Error('no boat');
    // Off the steerer's work spot at the boat by more than the interact reach.
    expect(Math.hypot(seat.x - work.x, seat.y - work.y)).toBeGreaterThan(2);
    // In the working day, with work at the boat for her (the hull's boards laid by it).
    (world.calendar as { minuteOfDay: number }).minuteOfDay = 10 * 60;
    const ship = world.ships['flagship'];
    if (ship === undefined) throw new Error('no boat');
    (ship.repairs.HULL as { stage: string }).stage = 'MATERIALS';
    const act = activityOf(world, camp, people, 'C_RUNA');
    expect(act.kind).toBe('WORK');
    expect(act.job).toBe('SHIPWRIGHT');
    expect(act.place?.pose).toBe('sit');
    expect(act.half).toBe(true);
    expect(act.place?.x).toBeCloseTo(seat.x * 24);
    // Healed, she works at the boat's own spot again.
    runa.wounds = [];
    expect(activityOf(world, camp, people, 'C_RUNA').place?.pose).toBe('work');
  });
});
