/**
 * Stage 10 acceptance check 1: each of the three searches (Book 4 section 08, beat 3) has at
 * least two viable approaches, and records its decision as a fact. A scripted player
 * (src/tools/play/searchBot.ts) plays each approach from the camp at the broch, submitting commands
 * as the input layer would. Also: the rescued join the household through Stage 8's people systems,
 * and Oddi's theft scene (decision S8-21) comes in normal play once he is home.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { findActor } from '../../src/sim/land/zoneLinks.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { SearchBot } from '../../src/tools/play/searchBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const camp = land.camp;
const search = land.searches;
if (camp == null || search == null) throw new Error('no camp or searches content');

/** A campaign at the broch, Hild having led there (beat 2), the seax in hand's reach. */
function start(seed: string, hooks = 'camp=broch&time=10:00') {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams(hooks));
  world.player.hotbar.slots[0] = 'ITEM_SEAX';
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  if (camp == null || search == null) throw new Error('no content');
  const bot = new SearchBot(sim, b, land, camp, search);
  sim.step();
  return { world: sim.state, sim, bot, events };
}

const resolved = (events: SimEvent[]) =>
  events.flatMap((e) => (e.type === 'SEARCH_RESOLVED' ? [`${e.search}:${e.outcome}`] : []));

describe('the searches’ people are placed at the first dusk (Book 4 Chapter 1 beat 12; DE-16)', () => {
  it('places Oddi and the ship’s silver by the wreck, Bran and Thorkel in the fold, Runa and her tools at the Hag’s Seat at 19:00 on day 1', () => {
    const { world, bot } = start('open', 'camp=broch&time=18:50&searches=dusk');
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('not on foot');
    const where = (id: string) => findActor(onFoot, id)?.zone;
    expect(where('C_ODDI')).toBeUndefined();
    bot.waitUntil(19 * 60 + 1);
    expect(where('C_ODDI')).toBe('ZONE_SK_STRAND');
    // Oddi's dilemma is over the ship's silver in its strongbox (DE-17).
    expect(where('ITEM_SHIP_SILVER')).toBe('ZONE_SK_STRAND');
    expect(where('C_BRAN')).toBe('ZONE_SK_CAIRN');
    expect(where('C_THORKEL')).toBe('ZONE_SK_CAIRN');
    expect(where('C_RUNA')).toBe('ZONE_SK_HAGSEAT');
    expect(where('ITEM_RUNA_TOOLS')).toBe('ZONE_SK_HAGSEAT');
    expect(world.people['C_ODDI']?.wounds[0]?.severity).toBe('SERIOUS');
    expect(world.people['C_RUNA']?.wounds[0]?.severity).toBe('SERIOUS');
    expect(world.household.residents).toEqual(['C_HILD']);
  });
});

describe('Oddi near the wreck: the chest now, or Oddi home first', () => {
  it('CHEST_FIRST: the chest carried off the strand is saved; then Oddi home joins the household', () => {
    const { world, bot, events } = start('oddi-chest');
    bot.oddi('CHEST_FIRST');
    expect(world.facts['search.oddi']).toBe('CHEST_FIRST');
    expect(world.facts['ch1.chest']).toBe('SAVED');
    expect(findActor(world.onFoot ?? (null as never), 'ITEM_SHIP_SILVER')).not.toBeNull();
    expect(world.household.residents).toContain('C_ODDI');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'RESIDENT_JOINED', person: 'C_ODDI' }),
    );
    expect(events).toContainEqual({ type: 'CHECKPOINT', label: 'search_oddi' });
    expect(world.oneShots['BEAT_1_SEARCH_ODDI']).toBeDefined();
  });

  it('ODDI_FIRST: carried home first, the scavengers have the chest; he says so', () => {
    const { world, bot, events } = start('oddi-first');
    bot.oddi('ODDI_FIRST');
    expect(world.facts['search.oddi']).toBe('ODDI_FIRST');
    expect(world.facts['ch1.chest']).toBe('LOST');
    expect(world.household.residents).toContain('C_ODDI');
    expect(resolved(events)).toEqual(['ODDI:ODDI_FIRST']);
    expect(events).toContainEqual({ type: 'SEARCH_INFO', key: 'caption.search.chest_lost' });
  });
});

describe('Runa at the Hag’s Seat: an offering, or the slower cliff path', () => {
  it('OFFERING: a confession at the stone dries it, the neck opens, and Runa comes home', () => {
    const { world, bot, events } = start('runa-offering');
    bot.runa('OFFERING');
    expect(world.facts['search.runa']).toBe('OFFERING');
    expect(world.facts['hagseat.offering']).toBe('CONFESSION');
    expect(world.powers['POWER_CAILLEACH']).toMatchObject({ stone: 'DRY', offering: 'CONFESSION' });
    expect(world.household.residents).toContain('C_RUNA');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'OMEN_ANSWERED', omen: 'OMEN_HAGSEAT_STONE' }),
    );
    expect(events).toContainEqual({ type: 'CHECKPOINT', label: 'search_runa' });
  });

  it('CLIFF_PATH: no offering; the gale refuses the neck to a load, and the cliff path brings her home', () => {
    const { world, bot, events } = start('runa-cliff');
    bot.runa('CLIFF_PATH');
    expect(world.facts['search.runa']).toBe('CLIFF_PATH');
    expect(world.powers['POWER_CAILLEACH']).toMatchObject({ stone: 'WEEPING', passedBy: true });
    expect(world.household.residents).toContain('C_RUNA');
    expect(resolved(events)).toEqual(['RUNA:CLIFF_PATH']);
  });

  it('the gale holds a steerer carrying anything on the neck while the stone weeps', () => {
    const { world, bot, events } = start('runa-gale');
    bot.goToZone('ZONE_SK_HAGSEAT');
    bot.lift('ITEM_RUNA_TOOLS');
    const neck = search.def.runa.neck;
    // Straight for the neck's middle, then hold the key: the steerer goes no further than its edge.
    bot.walkTo((t) => t.tx === neck.x0 - 2 && t.ty === 21);
    const before = world.onFoot?.player.x ?? 0;
    for (let i = 0; i < 240; i++) {
      bot.sim.submit({ type: 'MOVE', x: 1, y: 0, run: false, sneak: false });
      bot.step();
    }
    const x = (world.onFoot?.player.x ?? 0) / 24;
    expect(x).toBeLessThan(neck.x0 + 0.5);
    expect(x * 24).toBeGreaterThanOrEqual(before);
    expect(events).toContainEqual({ type: 'SEARCH_INFO', key: 'caption.search.neck_gale' });
  });
});

describe('Bran guarding Thorkel’s body: fight, sneak or bargain', () => {
  it('FIGHT: with the seax and Bran beside, a careful player beats them; Bran’s fall is carried home', () => {
    // Eight seeded fights played by Stage 9's careful scripted player (no help, no option). The
    // fight is the dangerous way (Book 1 section 05: every approach has a cost): it was won in 4 of
    // these 8 when written, Bran downed in each win and carried home.
    let won = 0;
    for (let n = 1; n <= 8; n++) {
      const { world, bot, events } = start(`fight-${n}`);
      try {
        bot.bran('FIGHT');
      } catch {
        // The steerer fell: game over (Book 1 section 09), the search undecided.
        expect(world.gameOver).not.toBeNull();
        expect(world.facts['search.bran']).toBeUndefined();
        continue;
      }
      won++;
      expect(world.facts['search.bran']).toBe('FIGHT');
      expect(world.facts['ch1.wreckers']).toBe('BEATEN');
      expect(events).toContainEqual({
        type: 'ENCOUNTER_STARTED',
        scene: 'SCN_SK_WRECKERS',
        checkpoint: 'wreckers',
      });
      bot.waitFor(() => world.facts['ch1.thorkel_body'] !== undefined, 60 * 400);
      expect(world.facts['ch1.thorkel_body']).toBe('CAMP');
      expect(world.household.residents).toContain('C_BRAN');
    }
    expect(won).toBeGreaterThanOrEqual(3);
  });

  it('SNEAK: round the fold unseen to the back wall; over it with the body, no blow struck', () => {
    const { world, bot, events } = start('bran-sneak');
    bot.bran('SNEAK');
    expect(world.facts['search.bran']).toBe('SNEAK');
    expect(world.facts['ch1.wreckers']).toBe('SEALCAVE');
    expect(events.some((e) => e.type === 'FIGHT_STARTED')).toBe(false);
    bot.waitFor(() => world.facts['ch1.thorkel_body'] !== undefined, 60 * 400);
    expect(world.facts['ch1.thorkel_body']).toBe('CAMP');
    // Gone to their skiff once the steerer has left the fold.
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('not on foot');
    bot.goToZone('ZONE_SK_MACHAIR');
    bot.step(2);
    expect(findActor(onFoot, 'E_WRECKER_KETILL')).toBeNull();
  });

  it('BARGAIN: with the chest saved, open hands and Thorkel’s silver buy the body; they go', () => {
    const { world, bot, events } = start('bran-bargain');
    bot.oddi('CHEST_FIRST');
    bot.bran('BARGAIN');
    expect(world.facts['search.bran']).toBe('BARGAIN');
    expect(world.facts['ch1.chest']).toBe('GIVEN');
    expect(world.facts['ch1.wreckers']).toBe('PAID');
    expect(events.some((e) => e.type === 'FIGHT_STARTED')).toBe(false);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'PERSON_SPOKE',
        person: 'E_WRECKER_KETILL',
        lineKey: 'e_wrecker_ketill.bark.parley.01',
      }),
    );
    bot.waitFor(() => world.facts['ch1.thorkel_body'] !== undefined, 60 * 400);
    expect(world.facts['ch1.thorkel_body']).toBe('CAMP');
  });

  it('without the chest there is no silver to offer: the bargain is not among Ketill’s answers', () => {
    const { world, bot } = start('bran-no-chest');
    bot.goToZone('ZONE_SK_CAIRN');
    const slots = world.player.hotbar.slots;
    bot.sim.submit({ type: 'SELECT_SLOT', slot: slots.indexOf(null) });
    bot.walkTo((t) => t.tx === 30 && t.ty === 30);
    bot.waitFor(() => world.onFoot?.battle?.parley != null, 60 * 10);
    const ketill = world.onFoot?.actors['E_WRECKER_KETILL'];
    if (ketill === undefined) throw new Error('no Ketill');
    bot.walkTo((t) => t.tx === Math.floor(ketill.x / 24) && t.ty === Math.floor(ketill.y / 24) - 1);
    bot.interact();
    bot.waitFor(() => bot.options().length > 0, 60 * 10);
    expect(bot.options()).toEqual([
      'p_steerer.search.ketill.threat',
      'p_steerer.search.ketill.leave',
    ]);
  });
});

describe('the rescued join the household (Stage 8’s people systems)', () => {
  it('all three done completes the beat; Oddi’s theft is found on his second night at home', () => {
    const { world, bot, events } = start('home', 'camp=broch&time=09:00&fire=lit&tended=1&wood=6');
    bot.oddi('ODDI_FIRST');
    bot.runa('OFFERING');
    bot.bran('SNEAK');
    bot.waitFor(() => world.facts['ch1.thorkel_body'] !== undefined, 60 * 400);
    expect(world.oneShots['BEAT_1_SEARCHES']).toBeDefined();
    expect([...world.household.residents].sort()).toEqual(['C_BRAN', 'C_HILD', 'C_ODDI', 'C_RUNA']);
    for (const id of ['C_ODDI', 'C_BRAN', 'C_RUNA'])
      expect(world.people[id]?.life.joinedDay).toBe(world.calendar.day);
    // Two nights at the broch, the steerer by the fire in the evenings (S8-21's conditions).
    bot.goToZone('ZONE_SK_MACHAIR');
    for (let night = 0; night < 2 && !events.some((e) => e.type === 'DISPUTE_RAISED'); night++) {
      bot.waitUntil(20 * 60 + 40);
      bot.goToSite('fire');
      bot.waitUntil(21 * 60 + 50);
      if (events.some((e) => e.type === 'DISPUTE_RAISED')) break;
      bot.goToSite('bed_s0');
      bot.sim.submit({ type: 'SLEEP' });
      const day = world.calendar.day;
      bot.waitFor(() => world.calendar.day === day + 1);
    }
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'DISPUTE_RAISED', scene: 'BEAT_1_ODDI_THEFT' }),
    );
  });
});
