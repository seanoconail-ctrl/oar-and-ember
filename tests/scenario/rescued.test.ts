/**
 * Design addendum 2.5 section 4 (decisions DE-22 and DE-82): everyone Chapter 1 rescues (Hild,
 * Oddi, Bran and Runa) gets up, walks to the camp, takes on work, eats, sleeps under the shelter
 * at night and answers when talked to, however the rescue was played. Each run is played through
 * the commands the input layer sends (src/tools/play/*), at a time of day, by a route, with the
 * steerer staying or leaving at once, and with a save and load or a checkpoint around it, then
 * followed for two in-game days.
 *
 * The playtest's bug (DE-82): Oddi set down above the tide line on his own strand stood up after
 * Book 10's rescueGetUp but had not joined the household (only a set-down off the strand rescues
 * him, S10-7), so no day ever moved him, talk refused him (not a resident) and, standing, he could
 * not be lifted again. The scripted searches always carried him straight off the strand.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { readSave, writeSave } from '../../src/persist/save.ts';
import type { SaveFile } from '../../src/persist/save.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { campaignMinute } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { findActor } from '../../src/sim/land/zoneLinks.ts';
import { aboveTideLine, terrainAt, tileBlocks, tileOf } from '../../src/sim/land/zoneMap.ts';
import { searchHolds } from '../../src/sim/narrative/searches.ts';
import { wreckHolds } from '../../src/sim/narrative/wreck.ts';
import { activityOf } from '../../src/sim/people/schedule.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent, Simulation } from '../../src/sim/simulation.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { OpeningBot } from '../../src/tools/play/openingBot.ts';
import type { Tile } from '../../src/tools/play/openingBot.ts';
import { WreckBot } from '../../src/tools/play/wreckBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
function needed<V>(v: V | null | undefined, what: string): V {
  if (v == null) throw new Error(`no ${what} content`);
  return v;
}
const camp = needed(land.camp, 'camp');
const searches = needed(land.searches, 'searches');
const repairs = needed(land.repairs, 'repairs');
const wreck = needed(land.wreck, 'opening');
const people = needed(land.people, 'people');
const T = 60;
const CAMP_ZONE = camp.def.zone;
const fire = wreck.camp?.fire ?? { x: 0, y: 0 };
const beds = camp.def.shelterBeds ?? [];
const getUpTicks = wreck.ob.searches.rescueGetUpSeconds * T;
/** Book 10 section 08 (decision DF-18): at the fire within rescueHome; stuck after rescueStuck. */
const homeMinutes = wreck.ob.searches.rescueHomeMinutes;
const stuckTicks = wreck.ob.searches.rescueStuckSeconds * T;
/** "The camp's fire": as near as the opening counts someone home by it (src/sim/narrative/wreck.ts). */
const fireTiles = wreck.rw.fireScene.nearTiles + 2;
/** Minutes since the campaign began, to measure game time across midnight. */
const gameMinutes = (w: WorldState): number => campaignMinute(w, b);
/**
 * Game minutes the land was played through: a night passed asleep (or a collapse at Book 10's
 * collapse hour) runs in one tick with no one walking (Book 2 section 03), so it is not counted.
 */
const played = new WeakMap<Seen, { last: number; total: number }>();
function playedMinutes(s: Seen, w: WorldState): number {
  const now = gameMinutes(w);
  const c = played.get(s) ?? { last: now, total: 0 };
  const d = now - c.last;
  if (d > 0 && d <= 2) c.total += d;
  c.last = now;
  played.set(s, c);
  return c.total;
}

type Who = 'C_HILD' | 'C_ODDI' | 'C_BRAN' | 'C_RUNA';
type After = 'stay' | 'leave' | 'sleep' | 'fight';
type Save = 'none' | 'load' | 'walkLoad' | 'fresh' | 'checkpoint' | 'campAutosave';

interface Run {
  readonly who: Who;
  readonly name: string;
  /** The minute of day the rescue is begun at (the bot waits, standing, until then). */
  readonly at: number;
  /** How the rescue is played, through commands; returns once the person is of the household. */
  readonly rescue: (play: Play) => void;
  readonly after: After;
  readonly save: Save;
}

/** A game being played: its simulation, a bot driving it and what was seen of the person. */
interface Play {
  sim: Simulation;
  bot: WreckBot;
  events: SimEvent[];
  readonly who: Who;
  seen: Seen;
}

interface Seen {
  /** The tick the rescue completed (the person of the household, not carried). */
  rescuedAt: number | null;
  /** Where they were when the rescue completed (zone, pixels). */
  from: { zone: string; x: number; y: number } | null;
  upAt: number | null;
  /** Game minutes (gameMinutes) when up and when first by the fire. */
  upMinute: number | null;
  campMinute: number | null;
  /** When the first fire was lit: Hild waits on the strand for its smoke (DE-62). */
  smokeMinute: number | null;
  campAt: number | null;
  /** Ticks awake, away from what their day asks, unmoved and unchanged (Book 10 rescueStuck). */
  still: number;
  stillMost: number;
  stillWhere: string;
  last: { x: number; y: number; zone: string; act: string } | null;
  walkedSeen: boolean;
  workedDays: Set<number>;
}

const world = (p: Play): WorldState => p.sim.state;
const at = (p: Play) => findActor(world(p).onFoot ?? (null as never), p.who);
const minute = (p: Play): number => world(p).calendar.minuteOfDay;
const hhmm = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const describeWho = (p: Play): string => {
  const f = at(p);
  const w = world(p);
  const person = w.people[p.who];
  return f === null
    ? `${p.who} nowhere`
    : `${p.who} ${f.zone} ${(f.actor.x / 24).toFixed(1)},${(f.actor.y / 24).toFixed(1)} ${f.actor.pose} ` +
        `act=${String(person?.life.activity)} day=${w.calendar.day} ${hhmm(w.calendar.minuteOfDay)} ` +
        `residents=${w.household.residents.join(',')} talk=${String(w.talk?.with ?? w.talk?.scene ?? null)}`;
};

/** Watches the person every tick: when they are up, at the camp, walking and working. */
function watch(p: Play): void {
  const inner = p.sim.step.bind(p.sim);
  p.sim.step = () => {
    inner();
    const s = p.seen;
    const w = p.sim.state;
    if (s.rescuedAt === null) return;
    const playedNow = playedMinutes(s, w);
    if (s.smokeMinute === null && w.facts['ch1.fire_lit'] === true) s.smokeMinute = playedNow;
    const f = findActor(w.onFoot ?? (null as never), p.who);
    if (f === null) return;
    const pose = f.actor.pose;
    // Up: on their feet, or gone from where they were set down (out of view they are where their
    // day puts them, sitting at the fire or abed).
    const moved =
      s.from !== null &&
      (f.zone !== s.from.zone || Math.hypot(f.actor.x - s.from.x, f.actor.y - s.from.y) > 24);
    if (s.upAt === null && pose !== 'carried' && (moved || (pose !== 'sit' && pose !== 'down'))) {
      s.upAt = w.tick;
      s.upMinute = playedNow;
    }
    if (
      s.campAt === null &&
      f.zone === CAMP_ZONE &&
      Math.hypot(f.actor.x / 24 - fire.x, f.actor.y / 24 - fire.y) <= fireTiles
    ) {
      s.campAt = w.tick;
      s.campMinute = playedNow;
    }
    // Stuck (Book 10 rescueStuck): awake, not talking, held by a scene or carried, away from the
    // place their day asks of them, and neither moving nor changing what they do.
    const act = activityOf(w, camp, people, p.who);
    const held =
      wreckHolds(w, wreck, p.who) ||
      searchHolds(w, searches, p.who) ||
      w.talk !== null ||
      pose === 'carried' ||
      pose === 'down' ||
      act.place === null ||
      act.kind === 'SLEEP' ||
      act.kind === 'BED';
    const place = act.place;
    const away =
      place !== null &&
      (place.zone !== f.zone || Math.hypot(place.x - f.actor.x, place.y - f.actor.y) > 24);
    const last = s.last;
    const same =
      last !== null &&
      last.zone === f.zone &&
      last.act === act.kind &&
      Math.abs(last.x - f.actor.x) < 0.01 &&
      Math.abs(last.y - f.actor.y) < 0.01;
    s.still = !held && away && same ? s.still + 1 : 0;
    if (s.still > s.stillMost) {
      s.stillMost = s.still;
      s.stillWhere = describeWho(p);
    }
    s.last = { x: f.actor.x, y: f.actor.y, zone: f.zone, act: act.kind };
    if (f.visible && f.actor.moving === true && pose !== 'carried') s.walkedSeen = true;
    if (w.people[p.who]?.life.activity === 'WORK' && pose === 'work')
      s.workedDays.add(w.calendar.day);
  };
}

function newPlay(who: Who, sim: Simulation): Play {
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  const bot = new WreckBot(sim, b, land, camp, searches, repairs);
  const play: Play = {
    sim,
    bot,
    events,
    who,
    seen: {
      rescuedAt: null,
      from: null,
      upAt: null,
      upMinute: null,
      campMinute: null,
      smokeMinute: null,
      campAt: null,
      still: 0,
      stillMost: 0,
      stillWhere: '',
      last: null,
      walkedSeen: false,
      workedDays: new Set(),
    },
  };
  watch(play);
  return play;
}

/** A new game, as the naming screen starts it (no hooks): waking on the strand. */
function newGame(who: Who, seed: string): Play {
  const w = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  return newPlay(who, createSimulation(b, w, land));
}

/** The camp at the broch after the opening (the searches' tests' start), the seax in hand. */
function atBroch(who: Who, seed: string, time: string): Play {
  const w = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(w, content, land, new URLSearchParams(`camp=broch&time=${time}`));
  w.player.hotbar.slots[0] = 'ITEM_SEAX';
  const play = newPlay(who, createSimulation(b, w, land));
  play.sim.step();
  return play;
}

/** Waits, standing, until a minute of day (the next one reached; never back in time). */
function waitUntil(p: Play, m: number): void {
  if (minute(p) === m) return;
  p.bot.waitUntil(m);
}

/** Plays out any conversation or scene that has opened (choosing to leave, or the first word). */
function settleTalk(p: Play): void {
  for (let k = 0; k < 400 && p.sim.state.talk !== null; k++) {
    const options = p.bot.options();
    if (options.length === 0) {
      p.bot.step(10);
      continue;
    }
    const leave = options.indexOf('ui.talk.leave');
    p.sim.submit({ type: 'TALK_CHOOSE', index: leave < 0 ? 0 : leave });
    p.bot.step(10);
  }
  if (p.sim.state.talk !== null) throw new Error(`a conversation would not end: ${describeWho(p)}`);
}

/**
 * Talks to the person wherever they are, as a player does: walks beside them (they may be walking)
 * and clicks on them. True once their conversation opens; it is then left.
 */
function talkOpens(p: Play): boolean {
  settleTalk(p);
  for (let tries = 0; tries < 12; tries++) {
    const f = at(p);
    if (f === null) return false;
    if (f.zone !== p.bot.onFoot.zone) p.bot.goToZone(f.zone);
    const a = p.bot.onFoot.actors[p.who];
    if (a === undefined) continue;
    const t = tileOf(p.bot.map, a.x, a.y - 0.001);
    const beside = (x: Tile): boolean =>
      Math.max(Math.abs(x.tx - t.tx), Math.abs(x.ty - t.ty)) === 1;
    p.bot.walkTo(beside, false, T * 20);
    const now = p.bot.onFoot.actors[p.who];
    if (now === undefined) continue;
    // A click on them: the tile their feet stand in (just above a tile's edge, as a use is placed).
    p.sim.submit({ type: 'INTERACT_AT', tile: tileOf(p.bot.map, now.x, now.y - 0.001) });
    p.bot.step();
    const talk = p.sim.state.talk;
    if (talk?.with === p.who) {
      settleTalk(p);
      return true;
    }
    settleTalk(p);
  }
  return false;
}

/** The person under the shelter: on a bed under the sail at S0, under the roof at S1. */
function underShelter(p: Play): boolean {
  const f = at(p);
  if (f?.zone !== CAMP_ZONE) return false;
  const x = f.actor.x / 24;
  const y = f.actor.y / 24;
  const roofed = world(p).homes[camp.def.home]?.stage === 'S1';
  return roofed
    ? Math.hypot(x - 35.5, y - 31.5) < 4.6
    : beds.some((bd) => Math.hypot(x - bd.x, y - bd.y) < 0.5);
}

/** The rescue has completed this tick: the person is of the household and not carried. */
function rescued(p: Play): boolean {
  return (
    world(p).household.residents.includes(p.who) &&
    p.bot.onFoot.carrying !== p.who &&
    at(p)?.actor.pose !== 'down'
  );
}

function markRescued(p: Play): void {
  if (!rescued(p)) throw new Error(`not rescued: ${describeWho(p)}`);
  p.seen.rescuedAt = world(p).tick;
  const f = at(p);
  p.seen.from = f === null ? null : { zone: f.zone, x: f.actor.x, y: f.actor.y };
}

/** A save written now and read back (Book 2 section 20), as the game writes and reads it. */
function saveNow(p: Play, label: string): SaveFile {
  return writeSave(p.sim.state, {
    build: 'test',
    kind: 'checkpoint',
    slot: `checkpoint:${label}`,
    label,
    sequence: 1,
    savedAt: '2026-11-12T00:00:00.000Z',
  });
}
const loaded = (file: SaveFile): WorldState =>
  readSave(JSON.parse(JSON.stringify(file)) as SaveFile).state;

// ------------------------------------------------------------------------------- the rescues

/** Carries `id` (lifting it again if a winded steerer drops it) to `zone` and sets it down at the first tile matching `goal`. */
function carryInto(p: Play, id: string, zone: string, goal: (t: Tile) => boolean): void {
  const bot = p.bot;
  for (let tries = 0; tries < 12; tries++) {
    bot.waitFor(() => bot.onFoot.player.winded?.carry !== true, T * 60);
    if (bot.onFoot.carrying !== id) bot.lift(id);
    bot.goToZone(zone);
    if (bot.onFoot.carrying !== id) continue;
    if (!bot.walkTo(goal, false, T * 300)) throw new Error(`no way to carry ${id} there`);
    if (bot.onFoot.carrying !== id) continue;
    bot.setDown();
    return;
  }
  throw new Error(`could not carry ${id} to ${zone}`);
}

/** Dry, open ground in the zone in view (and its neighbours), so a set-down is never refused. */
const dry =
  (p: Play) =>
  (t: Tile): boolean => {
    const map = p.bot.map;
    return (
      aboveTideLine(terrainAt(map, t.tx, t.ty)) &&
      [1, -1].every((d) => aboveTideLine(terrainAt(map, t.tx + d, t.ty))) &&
      aboveTideLine(terrainAt(map, t.tx, t.ty + 1)) &&
      !tileBlocks(map, t.tx, t.ty, false)
    );
  };
const nearFire = (p: Play) => (t: Tile) =>
  dry(p)(t) && Math.hypot(t.tx + 0.5 - fire.x, t.ty + 0.5 - (fire.y + 3)) < 1.5;

/** Hild: the seax, then cut free from the net and lifted (the opening's beat 1). */
function hildLifted(p: Play): OpeningBot {
  const strand = land.maps.get('ZONE_SK_STRAND');
  if (strand === undefined) throw new Error('no strand');
  const ob = new OpeningBot(p.sim, strand, b, land);
  ob.pickUp('wreck_seax');
  waitUntil(p, rescueMinute(p));
  // Out among the rocks at high water: a player waits for the tide to drop.
  const hildTile = (): Tile => {
    const hild = p.sim.state.onFoot?.actors['C_HILD'];
    if (hild === undefined) throw new Error('no Hild');
    return tileOf(strand, hild.x, hild.y);
  };
  const beside = (t: Tile): boolean => {
    const h = hildTile();
    return Math.abs(t.tx - h.tx) + Math.abs(t.ty - h.ty) === 1;
  };
  for (let wait = 0; !ob.walkTo(beside, { maxTicks: T * 40 }); wait++) {
    if (wait > 40) throw new Error('no way to Hild');
    ob.stop();
    p.bot.step(T * 8);
  }
  // A click on her where she lies now (Thorkel's chest washes up beside her, nearer to E).
  const click = (): void => {
    const now = p.sim.state.onFoot?.actors['C_HILD'];
    if (now === undefined) throw new Error('no Hild');
    p.sim.submit({ type: 'INTERACT_AT', tile: tileOf(strand, now.x, now.y) });
    ob.step();
  };
  click();
  ob.waitFor(() => p.sim.state.facts['ch1.net_free'] === true, T * 10);
  click();
  if (p.bot.onFoot.carrying !== 'C_HILD') throw new Error('Hild was not lifted');
  return ob;
}
const rescueMinutes = new WeakMap<Play, number>();
const rescueMinute = (p: Play): number => rescueMinutes.get(p) ?? minute(p);

const HILD = {
  /** The opening's way: up to the first dry shingle and set down there. */
  firstDry: (p: Play): void => {
    const ob = hildLifted(p);
    const strand = p.bot.map;
    const up = (t: Tile): boolean =>
      aboveTideLine(terrainAt(strand, t.tx, t.ty)) &&
      aboveTideLine(terrainAt(strand, t.tx, t.ty - 1));
    if (!ob.walkTo(up, { maxTicks: T * 120 })) throw new Error('no dry ground');
    ob.face(0, -1);
    ob.interact();
  },
  /** Carried all the way up off the strand and set down on the machair. */
  machair: (p: Play): void => {
    hildLifted(p);
    carryInto(p, 'C_HILD', CAMP_ZONE, dry(p));
  },
  /** Carried to the camp and set down by the fire. */
  fire: (p: Play): void => {
    hildLifted(p);
    carryInto(p, 'C_HILD', CAMP_ZONE, nearFire(p));
  },
};

const ODDI = {
  /** Off the strand at once and set down on the first dry ground of the machair (ODDI_FIRST). */
  oddiFirst: (p: Play): void => {
    p.bot.oddi('ODDI_FIRST');
  },
  /** The ship's silver carried off first, then Oddi (CHEST_FIRST). */
  chestFirst: (p: Play): void => {
    p.bot.oddi('CHEST_FIRST');
  },
  /**
   * The playtest's way: lifted, carried up the strand and set down there above the tide line, as
   * Hild was; then (he lies there, to be lifted again) carried off the strand.
   */
  strandFirst: (p: Play): void => {
    const bot = p.bot;
    bot.goToZone('ZONE_SK_STRAND');
    bot.lift('C_ODDI');
    const own = tileOf(bot.map, bot.onFoot.player.x, bot.onFoot.player.y);
    if (!bot.walkTo((t) => dry(p)(t) && t.ty <= own.ty - 3 && Math.abs(t.tx - own.tx) <= 3))
      throw new Error('no dry ground up the strand');
    bot.setDown();
    // Still on his strand: not yet rescued, and lying where he was put for the steerer to lift.
    bot.step(getUpTicks + 2 * T);
    const lying = at(p);
    expect(lying?.zone, describeWho(p)).toBe('ZONE_SK_STRAND');
    expect(lying?.actor.pose, describeWho(p)).toBe('down');
    expect(world(p).household.residents).not.toContain('C_ODDI');
    expect(world(p).facts['search.oddi']).toBeUndefined();
    carryInto(p, 'C_ODDI', CAMP_ZONE, dry(p));
  },
  /** Carried all the way to the camp's fire. */
  fire: (p: Play): void => {
    carryInto(p, 'C_ODDI', CAMP_ZONE, nearFire(p));
  },
  /** Carried past the camp into the cairn's valley (east) and set down there. */
  cairn: (p: Play): void => {
    carryInto(p, 'C_ODDI', 'ZONE_SK_CAIRN', dry(p));
  },
};

/** A downed ally carried into the camp's safe place (Book 10 broughtHome), lifted again if dropped. */
function broughtHome(p: Play, id: string): void {
  if (findActor(p.bot.onFoot, id)?.actor.pose !== 'down') return;
  const safe = land.fight?.def.safePlaces[0];
  if (safe === undefined) throw new Error('no safe place');
  carryInto(
    p,
    id,
    safe.zone,
    (t) => dry(p)(t) && Math.hypot(t.tx + 0.5 - safe.x, t.ty + 0.5 - safe.y) < safe.r - 1.5,
  );
}

const BRAN = {
  /** The fight at the fold; Bran, if downed in it, carried home (the bot's carry may drop him). */
  fight: (p: Play) => {
    p.bot.bran('FIGHT');
    broughtHome(p, 'C_BRAN');
  },
  sneak: (p: Play) => {
    p.bot.bran('SNEAK');
  },
  /** The fold's price is the ship's silver: Oddi's strongbox brought off his strand first. */
  bargain: (p: Play) => {
    p.bot.oddi('CHEST_FIRST');
    p.bot.bran('BARGAIN');
  },
};

const RUNA = {
  offering: (p: Play) => {
    p.bot.runa('OFFERING');
  },
  cliffPath: (p: Play) => {
    p.bot.runa('CLIFF_PATH');
  },
};

// ---------------------------------------------------------------------------------- the runs

/** Plays a run: the rescue, what the steerer does then, a save, then two days followed. */
function play(run: Run, seed: string): Play {
  let p = run.who === 'C_HILD' ? newGame(run.who, seed) : atBroch(run.who, seed, hhmm(run.at));
  rescueMinutes.set(p, run.at);
  if (run.save === 'campAutosave') {
    // The camp's autosave is the first reaching of the camp in a day (DE-53): the next day's,
    // waited for on the strand.
    p.bot.goToZone('ZONE_SK_STRAND');
    p.bot.step(T * 2);
  }
  if (run.who !== 'C_HILD') waitUntil(p, run.at);

  const saved: { checkpoint: SaveFile | null; campAutosave: SaveFile | null } = {
    checkpoint: null,
    campAutosave: null,
  };
  if (run.save === 'checkpoint')
    p.sim.events.onAny((e) => {
      if (e.type === 'CHECKPOINT' && e.label === 'search_oddi' && saved.checkpoint === null)
        saved.checkpoint = saveNow(p, 'search_oddi');
    });
  if (run.save === 'campAutosave')
    p.sim.events.onAny((e) => {
      if (
        e.type === 'CAMP_REACHED' &&
        p.bot.onFoot.carrying === run.who &&
        saved.campAutosave === null
      )
        saved.campAutosave = saveNow(p, 'camp');
    });

  run.rescue(p);
  // Bran and Runa join at the end of their search; Bran may be carrying his father home first.
  try {
    p.bot.waitFor(() => rescued(p), T * 600);
  } catch (e) {
    throw new Error(
      `never rescued: ${describeWho(p)} ${String(world(p).facts['search.bran'])} ${JSON.stringify(world(p).people[run.who]?.status)} carrying=${String(p.bot.onFoot.carrying)}`,
      { cause: e },
    );
  }
  markRescued(p);
  // A player closes the conversation the rescue ended in (the bargain's words with Ketill).
  settleTalk(p);

  if (run.save === 'load') {
    // Game over's reload into the same simulation (Book 2 section 20), straight after the rescue.
    p.sim.restore(loaded(saveNow(p, 'rescued')));
  } else if (run.save === 'fresh') {
    // The save opened in a new simulation (a reloaded page), straight after the rescue.
    const state = loaded(saveNow(p, 'rescued'));
    const fresh = newPlay(run.who, createSimulation(b, state, land));
    fresh.seen = p.seen;
    p = fresh;
  } else if (run.save === 'checkpoint') {
    // Killed after the rescue: back to the checkpoint taken when Oddi called; rescued again.
    if (saved.checkpoint === null) throw new Error('no checkpoint at Oddi’s call');
    p.sim.restore(loaded(saved.checkpoint));
    p.seen.rescuedAt = null;
    expect(world(p).household.residents).not.toContain(run.who);
    ODDI.oddiFirst(p);
    markRescued(p);
  } else if (run.save === 'campAutosave') {
    // Killed after the rescue: back to the camp's autosave, taken while carrying him in.
    if (saved.campAutosave === null) throw new Error('no camp autosave while carrying');
    p.sim.restore(loaded(saved.campAutosave));
    p.seen.rescuedAt = null;
    expect(p.bot.onFoot.carrying).toBe(run.who);
    p.bot.walkTo(nearFire(p), false, T * 120);
    p.bot.setDown();
    markRescued(p);
  }

  if (run.save === 'walkLoad') {
    // Saved on the walk home and loaded again (game over's reload, Book 2 section 20).
    p.bot.waitFor(() => p.seen.upAt !== null && at(p)?.actor.moving === true, T * 120);
    const walking = at(p);
    p.sim.restore(loaded(saveNow(p, 'walking')));
    expect(at(p)?.actor.x).toBe(walking?.actor.x);
  }

  if (run.after === 'leave') {
    // Off at once into another zone, and away for an hour of the day.
    const away = p.bot.onFoot.zone === 'ZONE_SK_STRAND' ? CAMP_ZONE : 'ZONE_SK_STRAND';
    p.bot.goToZone(away);
    p.bot.goToZone(away === CAMP_ZONE ? 'ZONE_SK_HAGSEAT' : 'ZONE_SK_STRAND');
    const back = (minute(p) + 60) % 1440;
    waitUntil(p, back);
  } else if (run.after === 'sleep') {
    // Straight to bed under the sail (the rescue is at night).
    p.bot.doAt('bed_s0');
    expect(p.bot.onFoot.player.sleep, 'the steerer asleep').not.toBeNull();
  } else if (run.after === 'fight') {
    // Straight off to fight the scavengers at the fold (Bran's search by a fight).
    BRAN.fight(p);
  } else p.bot.step(getUpTicks + 2 * T);

  follow(p, run);
  return p;
}

/** Two days after the rescue: up, to the camp, at work, fed, abed under the shelter, talking. */
function follow(p: Play, run: Run): void {
  const s = p.seen;
  const label = `${run.who} ${run.name}`;
  // 1. Up within a moment of the rescue (Book 10 rescueGetUp), wherever the steerer went.
  if (run.who === 'C_HILD' || run.who === 'C_ODDI') {
    p.bot.waitFor(() => s.upAt !== null, getUpTicks + 10 * T);
    expect(s.upAt, `${label}: up`).not.toBeNull();
  }
  // Responds to talk once home by the fire (the playtest's Oddi refused it; Bran carries his
  // father to the bier first), unless the household is abed by then.
  const rescueDay = world(p).calendar.day;
  if (run.who !== 'C_HILD') {
    const by = gameMinutes(world(p)) + homeMinutes;
    p.bot.waitFor(() => s.campAt !== null || gameMinutes(world(p)) > by, T * 60 * 60);
    const awake = minute(p) >= 7 * 60 && minute(p) < 21 * 60;
    if (awake && s.campAt !== null)
      expect(talkOpens(p), `${label}: talk once home: ${describeWho(p)}`).toBe(true);
  }

  for (let night = 0; night < 2; night++) {
    // Hild walks up at the first fire's smoke (DE-62): the camp's first work, as a player does it.
    if (run.who === 'C_HILD' && night === 0) hildCamp(p);
    const asleep = night === 0 && run.after === 'sleep';
    if (asleep) {
      // The steerer abed since the rescue: the night passes at once (Book 2 section 03), so the
      // night is checked by its record: spent at home, counted at dawn.
      const day = world(p).calendar.day;
      p.bot.waitFor(() => world(p).player.awake && world(p).calendar.day > day, T * 120);
      const record = world(p).people[p.who]?.life.night;
      expect(record?.day, `${label}: a night at home`).toBe(world(p).calendar.day);
      expect(s.campAt ?? s.upAt, `${label}: up before the night`).not.toBeNull();
    } else {
      p.bot.goToZone(CAMP_ZONE);
      // 4. At night, under the shelter. A scene that evening (Oddi's theft) is judged first.
      const nightCheck =
        night === 0 && minute(p) >= 22 * 60 ? (minute(p) + 120) % 1440 : 23 * 60 + 40;
      p.bot.goToSite('bed_s0');
      waitUntil(p, nightCheck);
      settleTalk(p);
      p.bot.step(T * 5);
      settleTalk(p);
    }
    if (!asleep) {
      p.bot.waitFor(() => at(p)?.actor.pose === 'sleep' && underShelter(p), T * 600);
      expect(
        underShelter(p),
        `${label}: under the shelter, night ${night}: ${describeWho(p)}`,
      ).toBe(true);
      expect(world(p).people[p.who]?.life.activity, `${label} night ${night}`).toBe('SLEEP');
      // 1. By then at the camp's fire, within Book 10's rescueHome of getting up.
      expect(s.campAt, `${label}: reached the camp`).not.toBeNull();
    }
    // Hild waits on the strand for the first fire's smoke (DE-62): counted from the later of the two.
    const from =
      run.who === 'C_HILD' ? Math.max(s.upMinute ?? 0, s.smokeMinute ?? 0) : (s.upMinute ?? 0);
    if (night === 0 && s.upMinute !== null && s.campMinute !== null)
      expect(s.campMinute - from, `${label}: at the fire within rescueHome`).toBeLessThanOrEqual(
        homeMinutes,
      );
    if (!asleep) {
      p.bot.doAt('bed_s0');
      p.bot.waitFor(() => minute(p) >= 6 * 60 && minute(p) < 7 * 60, T * 1200);
    }
    // 2. and 3. The day: at work, fed, and talking at the fire in the evening.
    const day = world(p).calendar.day;
    waitUntil(p, 12 * 60);
    settleTalk(p);
    waitUntil(p, 18 * 60 + 30);
    settleTalk(p);
    expect(s.workedDays.has(day), `${label}: at work on day ${day}: ${describeWho(p)}`).toBe(true);
    expect(talkOpens(p), `${label}: talk on day ${day}: ${describeWho(p)}`).toBe(true);
    waitUntil(p, 21 * 60);
    settleTalk(p);
    const meals = world(p).people[p.who]?.life.meals;
    expect(meals?.day === day && meals.count > 0, `${label}: ate on day ${day}`).toBe(true);
  }
  expect(world(p).calendar.day).toBeGreaterThanOrEqual(rescueDay + 2);
  if (run.after === 'stay') expect(s.walkedSeen, `${label}: seen walking`).toBe(true);
  // Never stuck (Book 10 rescueStuck), all two days.
  expect(s.stillMost, `${label}: stuck for ${s.stillMost} ticks at ${s.stillWhere}`).toBeLessThan(
    stuckTicks,
  );
}

/** The rest of the opening after Hild's rescue: the chest home, the sail up, the first fire. */
function hildCamp(p: Play): void {
  const bot = p.bot;
  if (world(p).facts['ch1.chest_home'] !== true) bot.chestToCamp();
  if (world(p).facts['ch1.shelter_raised'] !== true) bot.raiseShelter();
  if (world(p).facts['ch1.fire_lit'] !== true) {
    bot.goToZone('ZONE_SK_STRAND');
    bot.firstFire(['drift_west_rocks', 'drift_west_bank']);
  }
  bot.waitFor(
    () => world(p).facts['ch1.hild_walked_up'] === true || p.seen.campAt !== null,
    T * 600,
  );
}

const MORNING = 8 * 60;
const AFTERNOON = 14 * 60 + 30;
const DUSK = 19 * 60 + 15;
const NIGHT = 22 * 60 + 30;

const runs: Run[] = [
  // Hild: the opening's rescue, by its routes, at the times a player might reach her.
  {
    who: 'C_HILD',
    name: 'first dry shingle, morning, stays',
    at: MORNING,
    rescue: HILD.firstDry,
    after: 'stay',
    save: 'none',
  },
  {
    who: 'C_HILD',
    name: 'first dry shingle, afternoon, leaves at once',
    at: AFTERNOON,
    rescue: HILD.firstDry,
    after: 'leave',
    save: 'none',
  },
  {
    who: 'C_HILD',
    name: 'carried to the machair, evening, saved and loaded',
    at: 18 * 60,
    rescue: HILD.machair,
    after: 'stay',
    save: 'load',
  },
  {
    who: 'C_HILD',
    name: 'carried to the fire, night, a fresh load',
    at: NIGHT,
    rescue: HILD.fire,
    after: 'stay',
    save: 'fresh',
  },
  // Oddi: every way off his strand, the playtest's set-down on the strand among them.
  {
    who: 'C_ODDI',
    name: 'set down on the strand first, morning, stays',
    at: MORNING,
    rescue: ODDI.strandFirst,
    after: 'stay',
    save: 'none',
  },
  {
    who: 'C_ODDI',
    name: 'set down on the strand first, dusk, leaves at once',
    at: DUSK,
    rescue: ODDI.strandFirst,
    after: 'leave',
    save: 'none',
  },
  {
    who: 'C_ODDI',
    name: 'Oddi first, afternoon, leaves at once',
    at: AFTERNOON,
    rescue: ODDI.oddiFirst,
    after: 'leave',
    save: 'none',
  },
  {
    who: 'C_ODDI',
    name: 'Oddi first, night, saved and loaded',
    at: NIGHT,
    rescue: ODDI.oddiFirst,
    after: 'stay',
    save: 'load',
  },
  {
    who: 'C_ODDI',
    name: 'chest first, morning, a fresh load',
    at: MORNING,
    rescue: ODDI.chestFirst,
    after: 'stay',
    save: 'fresh',
  },
  {
    who: 'C_ODDI',
    name: 'chest first, dusk, back to the search checkpoint',
    at: DUSK,
    rescue: ODDI.chestFirst,
    after: 'stay',
    save: 'checkpoint',
  },
  {
    who: 'C_ODDI',
    name: 'carried to the fire, afternoon, stays',
    at: AFTERNOON,
    rescue: ODDI.fire,
    after: 'stay',
    save: 'none',
  },
  {
    who: 'C_ODDI',
    name: 'carried into the cairn, morning, leaves at once',
    at: MORNING,
    rescue: ODDI.cairn,
    after: 'leave',
    save: 'none',
  },
  {
    who: 'C_ODDI',
    name: 'carried to the fire, morning, back to the camp autosave',
    at: MORNING,
    rescue: ODDI.fire,
    after: 'stay',
    save: 'campAutosave',
  },
  {
    who: 'C_ODDI',
    name: 'carried to the fire, night, leaves at once',
    at: NIGHT,
    rescue: ODDI.fire,
    after: 'leave',
    save: 'none',
  },
  {
    who: 'C_ODDI',
    name: 'Oddi first, morning, then straight off to fight at the fold',
    at: MORNING,
    rescue: ODDI.oddiFirst,
    after: 'fight',
    save: 'none',
  },
  {
    who: 'C_ODDI',
    name: 'carried to the fire, night, the steerer straight to bed',
    at: NIGHT,
    rescue: ODDI.fire,
    after: 'sleep',
    save: 'none',
  },
  {
    who: 'C_ODDI',
    name: 'Oddi first, afternoon, saved and loaded on the walk home',
    at: AFTERNOON,
    rescue: ODDI.oddiFirst,
    after: 'stay',
    save: 'walkLoad',
  },
  // Bran: the fold's three ways.
  {
    who: 'C_BRAN',
    name: 'fight, morning, stays',
    at: MORNING,
    rescue: BRAN.fight,
    after: 'stay',
    save: 'none',
  },
  {
    who: 'C_BRAN',
    name: 'fight, night, the steerer straight to bed',
    at: NIGHT,
    rescue: BRAN.fight,
    after: 'sleep',
    save: 'none',
  },
  {
    who: 'C_BRAN',
    name: 'sneak, morning, saved and loaded on the walk home',
    at: MORNING,
    rescue: BRAN.sneak,
    after: 'stay',
    save: 'walkLoad',
  },
  {
    who: 'C_BRAN',
    name: 'sneak, afternoon, leaves at once',
    at: AFTERNOON,
    rescue: BRAN.sneak,
    after: 'leave',
    save: 'none',
  },
  {
    who: 'C_BRAN',
    name: 'bargain, dusk, saved and loaded',
    at: DUSK,
    rescue: BRAN.bargain,
    after: 'stay',
    save: 'load',
  },
  {
    who: 'C_BRAN',
    name: 'bargain, night, a fresh load',
    at: NIGHT,
    rescue: BRAN.bargain,
    after: 'stay',
    save: 'fresh',
  },
  // Runa: the offering or the cliff path.
  {
    who: 'C_RUNA',
    name: 'offering, morning, stays',
    at: MORNING,
    rescue: RUNA.offering,
    after: 'stay',
    save: 'none',
  },
  {
    who: 'C_RUNA',
    name: 'cliff path, afternoon, leaves at once',
    at: AFTERNOON,
    rescue: RUNA.cliffPath,
    after: 'leave',
    save: 'none',
  },
  {
    who: 'C_RUNA',
    name: 'offering, dusk, a fresh load',
    at: DUSK,
    rescue: RUNA.offering,
    after: 'stay',
    save: 'fresh',
  },
  {
    who: 'C_RUNA',
    name: 'offering, morning, saved and loaded on the walk home',
    at: MORNING,
    rescue: RUNA.offering,
    after: 'stay',
    save: 'walkLoad',
  },
  {
    who: 'C_RUNA',
    name: 'offering, night, the steerer straight to bed',
    at: NIGHT,
    rescue: RUNA.offering,
    after: 'sleep',
    save: 'none',
  },
  {
    who: 'C_RUNA',
    name: 'cliff path, morning, then straight off to fight at the fold',
    at: MORNING,
    rescue: RUNA.cliffPath,
    after: 'fight',
    save: 'none',
  },
  {
    who: 'C_RUNA',
    name: 'cliff path, night, saved and loaded',
    at: NIGHT,
    rescue: RUNA.cliffPath,
    after: 'stay',
    save: 'load',
  },
];

describe('everyone rescued walks to camp, works, eats, sleeps under the shelter and talks (DE-22, DE-82)', () => {
  for (const [i, run] of runs.entries())
    it(`${run.who}: ${run.name}`, () => {
      play(run, `rescued-${i}`);
    }, 240_000);
});
