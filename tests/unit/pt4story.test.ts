/**
 * The user's fourth playtest, the story and scenes (requests 1 to 8 and 22, and the shelter prompt;
 * decisions DH-10 to DH-39). Played through the simulation with the scripted players; the play
 * view's own choice of prompt (`placedUsesHere`, `campUseNear`, `useWins`) is read the way the view
 * reads it, so a prompt shown is what Interact does.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parseStory4Balance } from '../../src/content/story4Balance.ts';
import { campHooks, interactionPoint, useWins } from '../../src/scenes/camp.ts';
import { openingProps, SHELTER_MARK_SHEET, shelterMark } from '../../src/scenes/openingView.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { campContext, campUseNear, shelterStage } from '../../src/sim/home/camp.ts';
import type { SiteUse } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { interactionNow } from '../../src/sim/land/onFoot.ts';
import type { Interaction } from '../../src/sim/land/onFoot.ts';
import { interactFirst } from '../../src/sim/narrative/wreck.ts';
import { placedUsesHere } from '../../src/sim/narrative/uses.ts';
import { fireLines } from '../../src/sim/narrative/wreck.ts';
import { canSee } from '../../src/sim/narrative/story4.ts';
import { openWayFrom } from '../../src/sim/land/edges.ts';
import { topicsFor } from '../../src/sim/people/talk.ts';
import { stepAims } from '../../src/sim/narrative/aims.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent, Simulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { OpeningBot } from '../../src/tools/play/openingBot.ts';
import type { Tile } from '../../src/tools/play/openingBot.ts';
import { WreckBot } from '../../src/tools/play/wreckBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const s4 = parseStory4Balance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const campOrNull = campContext(content);
if (campOrNull === null || land.wreck == null || land.searches == null || land.repairs == null)
  throw new Error('no content');
const camp = campOrNull;
const wreck = land.wreck;
const searches = land.searches;
const repairs = land.repairs;
const machair = land.maps.get('ZONE_SK_MACHAIR');
const strand = land.maps.get('ZONE_SK_STRAND');
if (machair === undefined || strand === undefined) throw new Error('no maps');
const T = 60;

export function start(seed: string, hooks?: string) {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  if (hooks !== undefined) campHooks(world, content, land, new URLSearchParams(hooks));
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  return { sim, events, world: sim.state };
}

/** What the play view would offer for Interact where the steerer stands (the view's own choice). */
export function offered(world: WorldState): SiteUse | Interaction | null {
  const onFoot = world.onFoot;
  const map = onFoot === null ? undefined : land.maps.get(onFoot.zone);
  if (onFoot === null || map === undefined) return null;
  const uses = placedUsesHere(
    world,
    {
      camp,
      wreck,
      searches,
      repairs,
      remarks: land.story4?.remarks ?? null,
      finds: land.finds ?? null,
    },
    map,
  );
  const interaction = interactionNow(
    onFoot,
    map,
    land.rules,
    tideAt(world.calendar, b).tidalGroundOpen,
    world.facts,
    interactFirst(world, wreck),
  );
  const use =
    onFoot.carrying === null && onFoot.player.work == null
      ? campUseNear(uses, onFoot.player, land.rules.interactRadiusTiles * map.tile)
      : null;
  const at = interaction === null ? null : interactionPoint(onFoot, interaction, map.tile);
  if (use !== null && useWins(use, interaction, at, onFoot.player)) return use.use;
  return interaction;
}

const siteOf = (u: SiteUse | Interaction | null): string =>
  u === null ? '' : 'site' in u ? `${u.kind}:${u.site}` : u.kind;

/** The shelter's mark tile: where the frame and the sail are worked (Book 9; the lean-to's place). */
const mark = wreck.camp?.mark ?? { x: 0, y: 0 };
const markTile: Tile = { tx: Math.floor(mark.x), ty: Math.floor(mark.y) };
const buildSite = camp.def.sites.find((s) => s.kind === 'BUILD');
if (buildSite === undefined) throw new Error('no build site');

/**
 * Walks onto the mark and checks the prompt there is the stage's own, that the mark is drawn, and
 * that Interact (the key, not a click) does exactly that.
 */
function workAtMark(sim: Simulation, bot: WreckBot, stage: 'FRAME' | 'SAIL'): void {
  const world = sim.state;
  bot.goToZone('ZONE_SK_MACHAIR');
  expect(bot.walkTo((t: Tile) => t.tx === markTile.tx && t.ty === markTile.ty)).toBe(true);
  bot.step(2);
  const want = stage === 'FRAME' ? 'shelter_frame' : 'shelter_sail';
  expect(siteOf(offered(world))).toBe(`OPENING:${want}`);
  const drawn = openingProps(world, wreck, machair as never, camp.def.props.S0, world.tick);
  expect(
    drawn.some(
      (p) =>
        p.sheet === SHELTER_MARK_SHEET &&
        p.frame.startsWith(stage === 'FRAME' ? 'pegs/' : 'stones/'),
    ),
  ).toBe(true);
  sim.submit({ type: 'INTERACT' });
  bot.step();
  expect(world.onFoot?.player.work?.task).toBe(
    stage === 'FRAME' ? 'TASK_SHELTER_FRAME' : 'TASK_SHELTER_SAIL',
  );
  bot.waitFor(() => world.onFoot?.player.work == null, 60 * 30);
  expect(shelterStage(world)).toBe(stage);
}

function opening(seed: string) {
  const { sim, events, world } = start(seed);
  const o = new OpeningBot(sim, strand as never, b, land);
  o.pickUp('wreck_seax');
  o.rescue('C_HILD');
  const bot = new WreckBot(sim, b, land, camp, searches, repairs);
  bot.waitFor(() => world.facts['ch1.chest_named'] === true, 60 * 30);
  return { sim, events, world, bot };
}

describe('the shelter’s prompt shows at its spot whenever it can be worked (DH-4, DH-10)', () => {
  it('the usual order: the chest, the fire, Hild’s word, then the frame and the sail at the mark', () => {
    const { sim, world, bot } = opening('pt4-shelter-a');
    bot.chestToCamp();
    bot.goToZone('ZONE_SK_STRAND');
    bot.firstFire(['drift_west_rocks', 'drift_west_bank']);
    bot.waitForHild();
    bot.step(Math.round(wreck.rw.camp.nextLineSeconds * T) + 2);
    expect(shelterMark(world, shelterStage(world))).toBe('pegs');
    workAtMark(sim, bot, 'FRAME');
    workAtMark(sim, bot, 'SAIL');
    // Up, there is nothing more to do there on day 1: no prompt, no mark.
    expect(shelterMark(world, shelterStage(world))).toBeNull();
    expect(siteOf(offered(world))).not.toMatch(/shelter_/);
  });

  it('the frame before the fire is lit (Hild still on the strand), then the sail', () => {
    const { sim, world, bot } = opening('pt4-shelter-b');
    bot.chestToCamp();
    expect(world.facts['ch1.fire_lit']).not.toBe(true);
    workAtMark(sim, bot, 'FRAME');
    workAtMark(sim, bot, 'SAIL');
  });

  it('straight to the broch with nothing carried, the frame first and the chest after', () => {
    const { sim, world, bot } = opening('pt4-shelter-c');
    bot.goToZone('ZONE_SK_MACHAIR');
    bot.walkTo((t: Tile) => Math.abs(t.tx - markTile.tx) + Math.abs(t.ty - markTile.ty) <= 2);
    bot.step(5);
    expect(world.facts['ch1.at_broch']).toBe(true);
    workAtMark(sim, bot, 'FRAME');
    bot.chestToCamp();
    workAtMark(sim, bot, 'SAIL');
  });

  it('after dark, by the fire’s light, and after a save and load', () => {
    const { sim, world, bot } = opening('pt4-shelter-d');
    bot.chestToCamp();
    world.calendar = { ...world.calendar, minuteOfDay: 21 * 60 + 30 };
    workAtMark(sim, bot, 'FRAME');
    // A save and load in between: the same prompt at the same spot in the loaded world.
    const loaded = createSimulation(b, structuredClone(world), land);
    const bot2 = new WreckBot(loaded, b, land, camp, searches, repairs);
    workAtMark(loaded, bot2, 'SAIL');
  });

  it('on the second morning the finishing’s Build prompt and the turf mark are at its site', () => {
    const { world, sim } = start('pt4-shelter-e', 'camp=broch&fire=lit&tended=1&day=2&time=07:00');
    const bot = new WreckBot(sim, b, land, camp, searches, repairs);
    expect(shelterStage(world)).toBe('SAIL');
    // Hild's word on the second morning opens it (she says it in speech, then the turf mark shows).
    const h = world.onFoot?.actors['C_HILD'];
    const p = world.onFoot?.player;
    if (h === undefined || p === undefined) throw new Error('no one');
    h.x = p.x + 30;
    h.y = p.y;
    h.pose = 'idle';
    bot.step(3);
    expect(world.facts['ch1.shelter_finish_said']).toBe(true);
    expect(shelterMark(world, shelterStage(world))).toBe('turf');
    const drawn = openingProps(world, wreck, machair, camp.def.props.S0, world.tick, buildSite);
    const turf = drawn.find((d) => d.sheet === SHELTER_MARK_SHEET);
    expect(turf).toEqual(expect.objectContaining({ x: buildSite.x, y: buildSite.y }));
    const site = { tx: Math.floor(buildSite.x), ty: Math.floor(buildSite.y) };
    expect(bot.walkTo((t: Tile) => t.tx === site.tx && t.ty === site.ty)).toBe(true);
    bot.step(2);
    expect(siteOf(offered(world))).toBe('TASK:shelter');
  });
});

// ------------------------------------------------------------- the strongbox taken in sight

describe('the strongbox is taken in sight, never by magic (DH-12 to DH-16)', () => {
  const oddiAt = searches.def.oddi;
  const box = oddiAt.chest.id;
  const strandStart = (seed: string) => {
    const s = start(seed, 'camp=broch&day=2&time=08:00&zone=ZONE_SK_STRAND&at=27,34');
    const bot = new WreckBot(s.sim, b, land, camp, searches, repairs);
    // The searches open on the first tick: Oddi and the box are placed on the strand.
    bot.step(2);
    return { ...s, bot };
  };
  const snatches = (events: SimEvent[]) =>
    events.flatMap((e) => (e.type === 'SNATCH' ? [`${e.what}:${e.by}`] : []));

  it('leaving the strand with Oddi called and nothing carried takes nothing: the box waits', () => {
    const { world, bot } = strandStart('pt4-snatch-none');
    bot.goBeside(oddiAt.person);
    bot.step(10);
    expect(world.facts['search.oddi_found']).toBe(true);
    bot.goToZone('ZONE_SK_MACHAIR');
    bot.step(60 * 20);
    expect(world.facts['ch1.chest']).toBeUndefined();
    bot.goToZone('ZONE_SK_STRAND');
    expect(world.onFoot?.actors[box]).toBeDefined();
  });

  it('carrying Oddi: Conn breaks from the dune grass, the steerer held as he takes it, and off he goes', () => {
    const { world, sim, events, bot } = strandStart('pt4-snatch-away');
    bot.lift(oddiAt.person);
    const lifted = world.tick;
    bot.waitFor(() => snatches(events).length > 0, 60 * 5);
    expect(snatches(events)[0]).toBe('BEGAN:E_WRECKER_CONN');
    // Book 10 snatchAfter: 1.5 s of carrying.
    expect(world.tick - lifted).toBeGreaterThanOrEqual(Math.round(s4.snatch.afterSeconds * T) - 1);
    // The scene holds the steerer: a step asked for is not taken.
    const p = world.onFoot?.player;
    if (p === undefined) throw new Error('no steerer');
    const x0 = p.x;
    const y0 = p.y;
    sim.submit({ type: 'MOVE', x: 1, y: 0, run: true, sneak: false });
    bot.step(30);
    expect(Math.hypot(p.x - x0, p.y - y0)).toBeLessThan(1);
    bot.waitFor(() => snatches(events).includes('GRABBED:E_WRECKER_CONN'), 60 * 5);
    const lines = events.flatMap((e) => (e.type === 'PERSON_SPOKE' ? [e.lineKey] : []));
    expect(lines).toContain('e_wrecker_conn.snatch.grab');
    expect(lines).toContain('c_oddi.snatch.shout');
    // Within Book 10's hold the scene is over and the steerer free.
    sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
    // On with Oddi, off the strand: Conn is over the edge with the silver, and remembered.
    bot.goToZone('ZONE_SK_MACHAIR');
    bot.waitFor(() => world.facts['ch1.silver_snatch'] !== undefined, 60 * 40);
    expect(world.facts['ch1.silver_snatch']).toBe('TAKEN');
    expect(world.facts['ch1.chest']).toBe('LOST');
    expect(world.facts['ch1.silver_taken_by']).toBe('E_WRECKER_CONN');
    bot.setDown();
    const said = events.flatMap((e) => (e.type === 'PERSON_SPOKE' ? [e.lineKey] : []));
    expect(said).toContain('c_oddi.snatch.safe.conn');
    expect(world.facts['search.oddi']).toBe('ODDI_FIRST');
  });

  it('set Oddi down and run the thief down: he drops the box, and it can be carried home', () => {
    const { world, sim, events, bot } = strandStart('pt4-snatch-caught');
    bot.lift(oddiAt.person);
    bot.waitFor(() => snatches(events).includes('GRABBED:E_WRECKER_CONN'), 60 * 8);
    bot.setDown();
    expect(world.facts['search.oddi']).toBe('ODDI_FIRST');
    // The chase: run straight at him.
    for (let i = 0; i < 60 * 20 && world.facts['ch1.silver_snatch'] === undefined; i++) {
      const c = world.onFoot?.actors['E_WRECKER_CONN'];
      const p = world.onFoot?.player;
      if (c === undefined || p === undefined) break;
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      sim.submit({ type: 'MOVE', x: dx / d, y: dy / d, run: true, sneak: false });
      sim.step();
    }
    sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
    expect(world.facts['ch1.silver_snatch']).toBe('CAUGHT');
    expect(world.facts['ch1.chest']).toBeUndefined();
    const lines = events.flatMap((e) => (e.type === 'PERSON_SPOKE' ? [e.lineKey] : []));
    expect(lines).toContain('e_wrecker_conn.snatch.caught');
    expect(world.onFoot?.actors[box]?.pose).toBe('down');
    // He runs on empty-handed and is gone; nothing more is taken.
    bot.step(60 * 20);
    expect(world.onFoot?.actors['E_WRECKER_CONN']).toBeUndefined();
    bot.lift(box);
    bot.goToZone('ZONE_SK_MACHAIR');
    expect(world.facts['ch1.chest']).toBe('SAVED');
  });

  it('with none of the band free (met at the fold), nobody comes and the box stays', () => {
    const { world, events, bot } = strandStart('pt4-snatch-nobody');
    world.facts['ch1.wreckers'] = 'SEALCAVE';
    bot.lift(oddiAt.person);
    bot.step(60 * 4);
    expect(snatches(events)).toEqual([]);
    bot.setDown();
    const lines = events.flatMap((e) => (e.type === 'PERSON_SPOKE' ? [e.lineKey] : []));
    expect(lines).toContain('c_oddi.search.safe_left');
    expect(world.facts['ch1.chest']).toBeUndefined();
    expect(world.onFoot?.actors[box]).toBeDefined();
  });

  it('Conn dead at the dusk: Svart comes instead', () => {
    const { world, events, bot } = strandStart('pt4-snatch-svart');
    const conn = world.people['E_WRECKER_CONN'];
    if (conn === undefined) throw new Error('no Conn');
    conn.status = 'dead';
    bot.lift(oddiAt.person);
    bot.waitFor(() => snatches(events).length > 0, 60 * 5);
    expect(snatches(events)[0]).toBe('BEGAN:E_WRECKER_SVART');
  });

  it('the fold remembers who took it: the stolen silver is spoken of, the old ask for it is not', () => {
    const talk = content.combat?.talk;
    if (talk === undefined) throw new Error('no fold talk');
    const stolen = talk.exchanges.find((e) => e.id === 'stolen');
    const silver = talk.exchanges.find((e) => e.id === 'silver');
    expect(stolen).toEqual(
      expect.objectContaining({ fact: 'ch1.silver_taken_by', is: 'E_WRECKER_CONN' }),
    );
    expect(silver?.unless).toBe('ch1.silver_taken_by');
  });
});

// --------------------------------------------------------------- the steerer's word over a body

describe('the steerer’s word over a body (DH-24 to DH-26)', () => {
  const remarks = land.story4?.remarks;
  if (remarks == null) throw new Error('no remarks');
  const spoken = (events: SimEvent[]) =>
    events.flatMap((e) => (e.type === 'STEERER_SPOKE' ? [e.lineKey] : []));

  it('Thorkel first: at his bier, a line each look in order, then the rites’ words come back', () => {
    const { world, sim, events } = start('pt4-remark-thorkel', 'camp=broch&crew=1&time=10:00');
    const body = world.onFoot?.actors['C_THORKEL'];
    const p = world.onFoot?.player;
    if (body === undefined || p === undefined) throw new Error('no body');
    p.x = body.x + 18;
    p.y = body.y;
    sim.step();
    // His key still round his neck: taking it is his first word (DH-25).
    expect(siteOf(offered(world))).toBe('OPENING:take_key');
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(world.facts['ch1.key']).toBe('BODY');
    expect(spoken(events)).toEqual([remarks.thorkelLines[0]]);
    for (const key of remarks.thorkelLines.slice(1)) {
      expect(siteOf(offered(world))).toBe('OPENING:remark');
      sim.submit({ type: 'INTERACT' });
      sim.step();
      expect(spoken(events).at(-1)).toBe(key);
    }
    expect(siteOf(offered(world))).not.toBe('OPENING:remark');
    // No steerer line names a gender (Book 8 section 03): the content lint checks the strings.
    expect(remarks.thorkelLines.every((k) => k.startsWith('p_steerer.remark.'))).toBe(true);
  });

  it('a fallen foe gets one line, never the last one said twice running', () => {
    const { world, sim, events } = start(
      'pt4-remark-fallen',
      'camp=broch&time=10:00&zone=ZONE_SK_CAIRN&at=34,36',
    );
    sim.step();
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('no zone');
    const foes = ['E_WRECKER_SVART', 'E_WRECKER_KETILL'];
    for (const id of foes) {
      expect(onFoot.actors[id]?.fight?.side).toBe('ENEMY');
      sim.submit({ type: 'DEV_KILL', target: id });
      sim.step();
      expect(onFoot.actors[id]?.pose).toBe('dead');
    }
    const p = onFoot.player;
    const seen: string[] = [];
    // An arrow in Svart is pulled first; the word over him comes after (the combat build's rule).
    onFoot.stuck.push({
      n: 990,
      kind: 'arrow',
      x: 2,
      y: -2,
      h: 20,
      dir: 8,
      in: 'body',
      target: 'E_WRECKER_SVART',
      broken: false,
      at: 0,
    });
    for (const id of foes) {
      const a = onFoot.actors[id];
      if (a === undefined) throw new Error(`no ${id}`);
      p.x = a.x + 14;
      p.y = a.y + 2;
      sim.step();
      if (id === 'E_WRECKER_SVART') {
        expect(siteOf(offered(world))).toBe('PICK_UP');
        sim.submit({ type: 'INTERACT' });
        sim.step();
        expect(onFoot.stuck.some((s) => s.n === 990)).toBe(false);
        expect(spoken(events)).toEqual([]);
      }
      expect(siteOf(offered(world))).toBe('OPENING:remark');
      sim.submit({ type: 'INTERACT' });
      sim.step();
      const last = spoken(events).at(-1) ?? '';
      expect(remarks.fallenLines).toContain(last);
      seen.push(last);
      expect(world.facts[`remark.${id}`]).toBe(1);
    }
    expect(seen[0]).not.toBe(seen[1]);
  });
});

// ------------------------------------------------------- Hild and her father; the rites' music

describe('Hild on her father, by the facts; a word to start the rites; the rites’ music (DH-20 to DH-23)', () => {
  const peopleCtx = land.people;
  if (peopleCtx == null) throw new Error('no people');
  const topicLines = (world: WorldState): string[] =>
    topicsFor(world, peopleCtx, 'C_HILD').map((tp) => tp.id);

  it('before he is found she has not found him; once found she never says so again', () => {
    const { world, sim } = start('pt4-father', 'camp=broch&time=10:00');
    sim.step(); // she joins the household with what she remembers (the wreck, her father)
    expect(topicLines(world)).toContain('c_hild.father');
    world.facts['ch1.thorkel_body'] = 'CAMP';
    const found = topicLines(world);
    expect(found).not.toContain('c_hild.father');
    expect(found).toContain('c_hild.father_rites');
    world.facts['ch1.thorkel_body'] = 'LOST';
    expect(topicLines(world)).toContain('c_hild.father_lost');
    world.facts['ch1.thorkel_body'] = 'CAMP';
    world.facts['ch1.rites'] = 'SEA_BURIAL';
    expect(topicLines(world)).toContain('c_hild.father_sea');
    world.facts['ch1.rites'] = 'SHIP_SETTING';
    expect(topicLines(world)).toContain('c_hild.father_stones');
  });

  it('no line of Hild’s that could be said once he is found says he was never found', () => {
    const strings = content.strings;
    const talk = content.talk;
    if (talk == null) throw new Error('no talk');
    const never = /never found|not found father|haven't found|still looking/i;
    // Every topic that can be open with his body found, and every bark that can be said then.
    const audit = start('pt4-father-audit', 'camp=broch&time=10:00');
    audit.sim.step();
    const world = audit.world;
    world.facts['ch1.thorkel_body'] = 'CAMP';
    for (const tp of topicsFor(world, peopleCtx, 'C_HILD')) {
      const node = talk.nodes[tp.root];
      expect(strings.get(node?.line ?? '')?.text ?? '').not.toMatch(never);
    }
    const barks = talk.people['C_HILD']?.barks ?? [];
    for (const bk of barks) {
      const text = strings.get(bk.key)?.text ?? '';
      if (!never.test(text)) continue;
      expect(bk.when).toEqual([{ not: { fact: 'ch1.thorkel_body' } }]);
    }
    // The first night's lines, said with him already found.
    for (const key of fireLines(world, wreck))
      expect(strings.get(key)?.text ?? '').not.toMatch(
        /Bran will be with Father|went after Father/,
      );
  });

  it('with his body home, Hild’s “Your father’s rites” starts them wherever she is', () => {
    const { world, sim } = start('pt4-rites-talk', 'camp=broch&crew=1&time=10:00');
    const h = world.onFoot?.actors['C_HILD'];
    const p = world.onFoot?.player;
    if (h === undefined || p === undefined) throw new Error('no one');
    // Far from the bier.
    sim.step();
    h.x = p.x - 20;
    h.y = p.y;
    sim.submit({ type: 'TALK', person: 'C_HILD' });
    sim.step();
    expect(world.talk?.kind).toBe('TALK');
    const index = world.talk?.topics.indexOf('c_hild.father_rites') ?? -1;
    expect(index).toBeGreaterThanOrEqual(0);
    sim.submit({ type: 'TALK_CHOOSE', index });
    sim.step();
    expect(world.talk?.kind).toBe('SEARCH');
    expect(world.talk?.scene).toBe('hild.rites');
    for (let i = 0; i < 60 * 8 && (world.talk?.queue.length ?? 0) > 0; i++) sim.step();
    // The sea (the second of her choices).
    sim.submit({ type: 'TALK_CHOOSE', index: 1 });
    sim.step();
    expect(world.facts['rites.pending']).toBe('SEA');
  });

  it('the rites have their own music: two cues of the rites piece, in its mode, under eight voices', () => {
    const audio = content.audio;
    if (audio == null) throw new Error('no audio');
    const sea = audio.cues.find((c) => c.id === 'MUS_RITES_SEA');
    const stones = audio.cues.find((c) => c.id === 'MUS_RITES_STONES');
    expect(sea).toEqual(expect.objectContaining({ kind: 'music', piece: 'rites' }));
    expect(stones).toEqual(expect.objectContaining({ kind: 'music', piece: 'rites' }));
    const on = (c: typeof sea) => Object.values(c?.layers ?? {}).filter((v) => v).length;
    expect(on(sea)).toBeLessThanOrEqual(8);
    expect(on(stones)).toBeLessThanOrEqual(8);
  });
});

// ----------------------------------------------------------------- the broch's quarrel in view

describe('the quarrel in the broch starts only in view of its people (DH-29)', () => {
  it('heard from behind the wall it waits; in view of Oddi and Hild it starts', () => {
    const { world, sim } = start('pt4-quarrel', 'camp=broch&oddi=theft&fire=lit&time=20:40');
    const p = world.onFoot?.player;
    const oddi = world.onFoot?.actors['C_ODDI'];
    if (p === undefined || oddi === undefined) throw new Error('no one');
    // Outside the wall, west, within earshot of the fire.
    p.x = 27.5 * 24;
    p.y = 31.5 * 24;
    expect(canSee(s4, machair as never, p, oddi)).toBe(false);
    for (let i = 0; i < 60 * 8; i++) sim.step();
    expect(world.talk?.kind).not.toBe('SCENE');
    // Inside the court, by the fire: in view, and the quarrel begins at the next game minute.
    p.x = 36.5 * 24;
    p.y = 32.5 * 24;
    for (let i = 0; i < 60 * 8 && world.talk === null; i++) sim.step();
    expect(world.talk?.kind).toBe('SCENE');
  });
});

// ------------------------------------------------------------------------ Runa's tool chest

describe('Runa reminds the steerer to bring her tool chest into the broch (DH-31)', () => {
  it('after Book 10’s wait, then at its interval, at most its times; not once the chest is placed', () => {
    const { world, sim } = start('pt4-runa', 'camp=broch&crew=1&time=10:00');
    delete world.facts['runa.tools_at'];
    world.facts['rescue.C_RUNA.home'] = true;
    const runa = world.onFoot?.actors['C_RUNA'];
    const p = world.onFoot?.player;
    if (runa === undefined || p === undefined) throw new Error('no one');
    const heard: number[] = [];
    sim.events.onAny((e) => {
      if (e.type === 'PERSON_SPOKE' && e.lineKey.startsWith('c_runa.remind.'))
        heard.push(world.tick);
    });
    const reminders = () => heard;
    const stay = (seconds: number) => {
      for (let i = 0; i < seconds * T; i++) {
        p.x = runa.x + 30;
        p.y = runa.y;
        world.player.awake = true;
        sim.step();
      }
    };
    stay(s4.runaRemind.afterSeconds - 2);
    expect(reminders()).toEqual([]);
    stay(4);
    expect(reminders()).toHaveLength(1);
    stay(s4.runaRemind.everySeconds * (s4.runaRemind.times + 1));
    const at = reminders();
    expect(at).toHaveLength(s4.runaRemind.times);
    expect((at[1] ?? 0) - (at[0] ?? 0)).toBeGreaterThanOrEqual(s4.runaRemind.everySeconds * T);
  });
});

// ----------------------------------------------------------------- the stores' hint in place

describe('“Stand still. Aim at the rope” only where it helps (DH-35)', () => {
  const aimsCtx = land.aims;
  if (aimsCtx == null) throw new Error('no aims');
  const storesAim = aimsCtx.aims.find((a) => a.id === 'stores');
  if (storesAim === undefined) throw new Error('no stores aim');
  const only = { ...aimsCtx, aims: [storesAim] };
  const mast = wreck.rw.mast.foot;

  it('is read from Book 10 (storesHintNear) where the content places it', () => {
    const second = storesAim.hints[1];
    const near = second?.when?.find((c) => 'near' in c);
    expect(near).toEqual({
      near: { zone: 'ZONE_SK_STRAND', x: mast.x, y: mast.y, r: s4.storesHintNearTiles },
    });
  });

  it('waits at the camp; by the mast with the bow and the lashing whole it is said; cut, never', () => {
    const run = (where: 'camp' | 'mast', cut: boolean, bow: boolean): string[] => {
      const hooks =
        where === 'camp'
          ? 'camp=broch&crew=1&time=10:00'
          : `camp=broch&crew=1&time=10:00&zone=ZONE_SK_STRAND&at=${mast.x + 2},${mast.y - 4}`;
      const { world, sim } = start(`pt4-stores-${where}-${String(cut)}-${String(bow)}`, hooks);
      sim.step();
      world.facts['ch1.chest_opened'] = true;
      if (cut) world.facts['ch1.lashing_cut'] = true;
      if (bow) world.player.hotbar.slots[1] = 'ITEM_BOW';
      // Bran beside the steerer, wherever that is (the hint is his to give).
      const onFoot = world.onFoot;
      if (onFoot === null) throw new Error('no zone');
      const out: string[] = [];
      const emit = (ev: { type: string; lineKey?: string }) => {
        if (ev.lineKey !== undefined) out.push(ev.lineKey);
      };
      const g = aimsCtx.ob.guidance;
      const total = (g.stuckFirstSeconds + g.stuckSecondSeconds + g.stuckRepeatSeconds) * T + 10;
      for (let i = 0; i < total; i++) {
        world.tick++;
        for (const id of ['C_BRAN', 'C_HILD']) {
          const a = onFoot.actors[id];
          if (a !== undefined) {
            a.x = onFoot.player.x + 20;
            a.y = onFoot.player.y;
          } else
            onFoot.actors[id] = {
              x: onFoot.player.x + 20,
              y: onFoot.player.y,
              facing: 'w',
              pose: 'idle',
            };
        }
        stepAims(world, only, land.maps, emit);
      }
      return out;
    };
    const rope = (k: string[]) =>
      k.includes('c_bran.hint.stores.2') || k.includes('c_hild.hint.stores.2_alt');
    expect(rope(run('camp', false, true))).toBe(false);
    expect(rope(run('mast', false, false))).toBe(false);
    expect(rope(run('mast', true, true))).toBe(false);
    expect(rope(run('mast', false, true))).toBe(true);
  });
});

// ------------------------------------------------------------------------ "Nothing that way"

describe('“Nothing that way” names a real, open way when one exists (DH-36)', () => {
  const cairn = land.maps.get('ZONE_SK_CAIRN');
  const hag = land.maps.get('ZONE_SK_HAGSEAT');
  if (cairn === undefined || hag === undefined) throw new Error('no maps');
  it('on Wreck Strand’s west end the way is the broch, to the north', () => {
    const way = openWayFrom(strand, land.maps, { x: 2 * 24, y: 8.5 * 24 }, land.rules, true);
    expect(way?.to).toBe('ZONE_SK_MACHAIR');
    expect(way?.direction).toMatch(/^n/);
  });
  it('at the cairn’s north-west, where Seal Cave does not lie beyond, it names Seal Cave where it does', () => {
    const way = openWayFrom(cairn, land.maps, { x: 6 * 24, y: 2 * 24 }, land.rules, true);
    expect(way).not.toBeNull();
    // From Stage 14 Rook Hill and the bog lie north of the cairn too (decision S14-2).
    expect(['ZONE_SK_SEALCAVE', 'ZONE_SK_MACHAIR', 'ZONE_SK_ROOK', 'ZONE_SK_BOG']).toContain(
      way?.to,
    );
  });
  it('never names a way that does not really lead on', () => {
    const fake = { ...hag, links: [{ edge: 'w' as const, to: 'ZONE_SK_MACHAIR' }] };
    expect(openWayFrom(fake, land.maps, { x: 4 * 24, y: 10 * 24 }, land.rules, true)).toBeNull();
  });
  it('in the game: pressing against the end of the strand says it, with the way', () => {
    const { sim, events } = start(
      'pt4-edge',
      'camp=broch&time=10:00&zone=ZONE_SK_STRAND&at=0.6,8.5',
    );
    for (let i = 0; i < 60 * 2; i++) {
      sim.submit({ type: 'MOVE', x: -1, y: 0, run: false, sneak: false });
      sim.step();
    }
    const edge = events.find((e) => e.type === 'EDGE_CAPTION');
    expect(edge).toEqual(
      expect.objectContaining({
        kind: 'NOTHING',
        way: expect.objectContaining({ to: 'ZONE_SK_MACHAIR' }) as unknown,
      }),
    );
  });
});

// ------------------------------------------------------------------- Bran's shouts at the fold

describe('Bran shouts the way of each teaching foe at the right moment, never back to back (DH-32, DH-33)', () => {
  it('parry at Svart’s wind-up, dodge at Ketill’s red blow, at least Book 10’s gap apart', () => {
    const { world, sim } = start(
      'pt4-bran-advice',
      'camp=broch&time=10:00&zone=ZONE_SK_CAIRN&at=30.5,36.4',
    );
    world.player.hotbar.slots[0] = 'ITEM_SEAX';
    world.player.hotbar.selected = 0;
    const log: { tick: number; what: string }[] = [];
    sim.events.onAny((e) => {
      if (
        e.type === 'ATTACK_STARTED' &&
        (e.who === 'E_WRECKER_SVART' || e.who === 'E_WRECKER_KETILL')
      )
        log.push({ tick: world.tick, what: `${e.who}:${e.kind ?? 'plain'}` });
      if (
        e.type === 'PERSON_SPOKE' &&
        e.person === 'C_BRAN' &&
        e.lineKey.startsWith('c_bran.teach.')
      )
        log.push({ tick: world.tick, what: e.lineKey });
    });
    for (let i = 0; i < 60 * 90; i++) {
      world.player.vitality = Math.max(world.player.vitality, 60);
      sim.step();
      const said = log.map((l) => l.what);
      if (said.includes('c_bran.teach.svart_parry') && said.includes('c_bran.teach.red.01')) break;
    }
    const at = (w: string) => log.find((l) => l.what === w)?.tick;
    const parry = at('c_bran.teach.svart_parry');
    const red = at('c_bran.teach.red.01');
    expect(parry).toBeDefined();
    expect(red).toBeDefined();
    // Each at a wind-up of its foe, aimed at the steerer.
    expect(log.some((l) => l.tick === parry && l.what.startsWith('E_WRECKER_SVART:'))).toBe(true);
    expect(log.some((l) => l.tick === red && l.what === 'E_WRECKER_KETILL:red')).toBe(true);
    // Never back to back.
    const shouts = log.filter((l) => l.what.startsWith('c_bran.')).map((l) => l.tick);
    for (let k = 1; k < shouts.length; k++)
      expect((shouts[k] ?? 0) - (shouts[k - 1] ?? 0)).toBeGreaterThanOrEqual(
        Math.round(s4.branAdviceGapSeconds * T),
      );
  });
});
