/**
 * The camp in the play view (Stage 7): what the prompt says for a camp use, the morning report's
 * sentences, and the test and capture hooks that start play at the broch (`?camp=broch`).
 */
import type { Content } from '../content/registry.ts';
import { parseShipBalance } from '../content/shipBalance.ts';
import type { Id } from '../core/ids.ts';
import { FACT_AT_BROCH, FACT_FIRE_LIT, FACT_HILD_TENDED } from '../sim/home/camp.ts';
import type { SiteUse } from '../sim/home/camp.ts';
import type { Interaction, OnFootState } from '../sim/land/onFoot.ts';
import { fireOneShot } from '../sim/ledger/ledger.ts';
import { placeActor, switchZone } from '../sim/land/zoneLinks.ts';
import { FACT_LEAD_STARTED } from '../sim/narrative/broch.ts';
import {
  FACT_BOW_NAMED,
  FACT_HILD_FOUND,
  FACT_HILD_SAFE,
  FACT_HILD_SAFE_AT,
} from '../sim/narrative/opening.ts';
import type { SimWorldContext } from '../sim/simulation.ts';
import type { MorningReport, WorldState } from '../sim/world.ts';

type Translate = (key: string, vars?: Record<string, string>) => string;

/** The morning report as sentences: names and the report's own words filled in. */
export function reportSentences(
  report: MorningReport,
  t: Translate,
  nameOf: (id: Id) => string,
): string[] {
  return report.lines.map((line) => {
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(line.vars)) {
      if (k === 'name' && typeof v === 'string') vars[k] = nameOf(v);
      else if (typeof v === 'string' && /^(report|trait|job)\./.test(v)) vars[k] = t(v);
      else vars[k] = String(v);
    }
    return t(line.key, vars);
  });
}

/** The prompt for a camp use, for the device in use. */
export function campUseLabel(
  use: SiteUse,
  content: Pick<Content, 'camp' | 'searches'> & Partial<Pick<Content, 'repairs'>>,
  t: Translate,
  nameOf: (id: Id) => string,
  key: string,
  mouse: boolean,
): { text: string; kind: string } {
  const click = (k: string, vars: Record<string, string> = {}): string =>
    mouse ? t(`${k}_click`, vars) : t(k, { key, ...vars });
  switch (use.kind) {
    case 'TASK': {
      if (use.task === 'TASK_CARE')
        return { text: click('ui.prompt.tend', { name: nameOf(use.target ?? '') }), kind: 'tend' };
      // Stage 11: cutting the rigging free of the wreck is a ship repair with its own words.
      if (use.site === 'rigging_cut')
        return { text: click('ui.prompt.cut_rigging'), kind: 'cut_rigging' };
      const def = content.camp?.tasks[use.task];
      const task = def === undefined ? use.task : t(def.nameKey);
      return { text: click('ui.prompt.task', { task }), kind: use.task.toLowerCase() };
    }
    case 'REPAIR':
      // Stage 11: the steering oar taken from the scavengers' skiff.
      return { text: click('ui.prompt.take_oar'), kind: 'take_oar' };
    case 'FEED_FIRE':
      return { text: click('ui.prompt.feed_fire'), kind: 'feed_fire' };
    case 'SLEEP':
      return { text: click('ui.prompt.sleep'), kind: 'sleep' };
    case 'EAT':
      return { text: click('ui.prompt.eat'), kind: 'eat' };
    case 'TALK':
      return { text: click('ui.prompt.talk', { name: nameOf(use.target) }), kind: 'talk' };
    case 'SEARCH': {
      // Stage 10: a search's words: talk to Bran, Ketill or Runa; leave an offering at the stone.
      const talk = [...(content.searches?.talks ?? []), ...(content.repairs?.talks ?? [])].find(
        (x) => x.id === use.site,
      );
      const prompt = talk?.promptKey ?? 'ui.prompt.talk';
      return {
        text: click(prompt, { name: nameOf(use.target) }),
        kind:
          prompt === 'ui.prompt.talk'
            ? 'talk'
            : prompt === 'ui.prompt.offering'
              ? 'offering'
              : prompt.replace('ui.prompt.', ''),
      };
    }
    case 'REFUSE':
      if (use.reason === 'TOO_EARLY_TO_SLEEP')
        return { text: t('ui.prompt.too_early', { time: '18:00' }), kind: 'too_early' };
      if (use.reason === 'NO_DRIFTWOOD')
        return { text: t('ui.prompt.need_wood'), kind: 'need_wood' };
      return { text: t('ui.refusal.no_food'), kind: 'no_food' };
  }
}

/**
 * Tests and captures only: start at the broch after beat 2's lead (`?camp=broch`), and set the
 * hour (`time=HH:MM`), the day (`day=N`), the fire (`fire=lit`), Hild's leg tended (`tended=1`),
 * the camp's stage (`stage=S1`), its driftwood (`wood=N`), the hand line in hand (`line=1`), Oddi
 * in the household (`oddi=1`, or `oddi=theft`: his theft due that evening; Stage 8), the zone to
 * start in (`zone=ZONE_SK_STRAND`) and where the steerer stands in it (`at=x,y` in tiles).
 */
export function campHooks(
  world: WorldState,
  content: Content,
  land: SimWorldContext,
  params: URLSearchParams,
): void {
  const camp = content.camp;
  const onFoot = world.onFoot;
  const home = camp === null ? undefined : world.homes[camp.home];
  if (camp === null || onFoot === null || home === undefined) return;
  const day = Number(params.get('day') ?? '');
  if (Number.isInteger(day) && day > 0) world.calendar = { ...world.calendar, day };
  const time = /^(\d{2}):(\d{2})$/.exec(params.get('time') ?? '');
  if (time !== null)
    world.calendar = { ...world.calendar, minuteOfDay: Number(time[1]) * 60 + Number(time[2]) };
  if (params.get('camp') === 'broch') {
    const hild = 'C_HILD';
    for (const fact of [
      FACT_HILD_FOUND,
      FACT_HILD_SAFE,
      FACT_BOW_NAMED,
      FACT_LEAD_STARTED,
      FACT_AT_BROCH,
      'ch1.arrived_said',
    ])
      world.facts[fact] = true;
    world.facts[FACT_HILD_SAFE_AT] = 0;
    fireOneShot(world, 'BEAT_1_WAKE', () => undefined);
    if (!world.household.residents.includes(hild)) world.household.residents.push(hild);
    const person = world.people[hild];
    if (person !== undefined) {
      person.status = 'wounded';
      if (person.wounds.length === 0)
        person.wounds.push({ day: 1, severity: 'SERIOUS', where: 'leg' });
    }
    const map = land.maps.get(camp.zone);
    const spawn = map?.spawns['P_STEERER'];
    if (map !== undefined && spawn !== undefined) {
      const actor = onFoot.actors[hild];
      switchZone(onFoot, camp.zone, { x: spawn.x * map.tile, y: spawn.y * map.tile });
      const spot = camp.people[hild]?.camp;
      if (actor !== undefined && spot !== undefined) {
        actor.pose = 'sit';
        actor.x = spot.x * map.tile;
        actor.y = spot.y * map.tile;
        actor.facing = spot.facing;
        placeActor(onFoot, hild, camp.zone, actor);
      }
      onFoot.player.facing = spawn.facing;
    }
    world.player.condition.wokeAt = 0;
  }
  if (params.get('fire') === 'lit') {
    home.fire = { lit: true, fuel: 2 };
    world.facts[FACT_FIRE_LIT] = true;
  }
  if (params.get('tended') === '1') {
    for (const w of world.people['C_HILD']?.wounds ?? []) w.tendedDay = 1;
    world.facts[FACT_HILD_TENDED] = true;
  }
  if (params.get('stage') === 'S1') {
    home.stage = 'S1';
    if (!home.buildings.includes(camp.shelter.building)) home.buildings.push(camp.shelter.building);
  }
  const wood = Number(params.get('wood') ?? '');
  if (Number.isFinite(wood) && wood >= 0 && params.has('wood')) home.stores['RES_DRIFTWOOD'] = wood;
  if (params.get('line') === '1') {
    const slots = world.player.hotbar.slots;
    const free = slots.indexOf(null);
    if (!slots.includes('ITEM_LINE') && free >= 0) slots[free] = 'ITEM_LINE';
    if (!world.player.tipsSeen.includes('ITEM_LINE')) world.player.tipsSeen.push('ITEM_LINE');
    onFoot.items = onFoot.items.filter((i) => i.item !== 'ITEM_LINE');
    for (const rest of Object.values(onFoot.elsewhere ?? {}))
      rest.items = rest.items.filter((i) => i.item !== 'ITEM_LINE');
  }
  // Stage 8, a seeded world (`oddi=1`): Oddi in the household at the fire, as Stage 10's search
  // will bring him; `oddi=theft` with food already hidden in his bedding and his first night slept,
  // so his theft is found that evening (Book 5 section 02).
  const oddi = params.get('oddi');
  if ((oddi === '1' || oddi === 'theft') && world.people['C_ODDI'] !== undefined) {
    const person = world.people['C_ODDI'];
    person.status = 'alive';
    if (!world.household.residents.includes('C_ODDI')) world.household.residents.push('C_ODDI');
    const seat = content.household?.seats[0];
    const zoneMap = land.maps.get(camp.zone);
    if (seat !== undefined && zoneMap !== undefined)
      placeActor(onFoot, 'C_ODDI', seat.zone, {
        x: seat.x * zoneMap.tile,
        y: seat.y * zoneMap.tile,
        facing: seat.facing,
        pose: 'sit',
      });
    if (oddi === 'theft') {
      person.life.nights = 1;
      person.life.stash = 1;
      person.life.lastTheftDay = world.calendar.day;
      home.stores['RES_SALTED_FISH'] = Math.max(0, (home.stores['RES_SALTED_FISH'] ?? 0) - 1);
    }
  }
  // Stage 9 (tests and captures): the campaign's options (`secondwind=1`, `ransmercy=1`). From
  // Stage 10 the wreck-scavengers hold the sheepfold under the cairn (S9-11), and the three
  // searches open once Hild has led to the broch, so `camp=broch` with `zone=ZONE_SK_CAIRN&at=x,y`
  // starts by the fight, and `zone=ZONE_SK_HAGSEAT` by the weeping stone.
  if (params.get('secondwind') === '1') world.options.secondWind = true;
  if (params.get('ransmercy') === '1') world.options.ransMercy = true;
  // Stage 9 (tests only): the steerer starts this hurt (`vitality=N`), for a quick game over.
  const vitality = Number(params.get('vitality') ?? '');
  if (Number.isFinite(vitality) && vitality > 0) world.player.vitality = vitality;
  // Stage 11 (tests and captures): the three searches done (`crew=1`): Oddi, Bran and Runa at
  // home, Thorkel on his bier by the broch, the chest's silver saved and the wreck-scavengers gone
  // to their skiff in Seal Cave (`wreckers=fold` leaves them at the sheepfold, `wreckers=beaten`
  // has two of them dead there and the third gone to the skiff); the boat's state
  // (`ship=hull,rig,oar` repairs done, `fit=hold|bow`, `lay=boards,rig,oar` materials by it).
  if (params.get('crew') === '1') seedCrew(world, content, land, params.get('wreckers') ?? 'cave');
  seedShip(world, content, params);
  // Stage 8, captures: start in another zone than the camp's (`zone=ZONE_SK_STRAND`).
  const zone = params.get('zone');
  const zoneTo = zone === null ? undefined : land.maps.get(zone);
  if (zoneTo !== undefined && zoneTo.zone !== onFoot.zone)
    switchZone(onFoot, zoneTo.zone, { x: onFoot.player.x, y: onFoot.player.y });
  const at = /^(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/.exec(params.get('at') ?? '');
  const map = land.maps.get(onFoot.zone);
  if (at !== null && map !== undefined) {
    onFoot.player.x = Number(at[1]) * map.tile;
    onFoot.player.y = Number(at[2]) * map.tile;
  }
}

/** Where an interaction's target is, in pixels (to compare with a camp use's distance). */
export function interactionPoint(
  onFoot: OnFootState,
  interaction: Interaction,
  tile: number,
): { x: number; y: number } | null {
  if (interaction.kind === 'SET_DOWN') return interaction.at;
  if (interaction.kind === 'LIFT') return onFoot.actors[interaction.target] ?? null;
  const item = onFoot.items.find((i) => i.key === interaction.key);
  if (item !== undefined) return { x: item.x * tile, y: item.y * tile };
  return onFoot.stuck.find((st) => `stuck:${st.n}` === interaction.key) ?? null;
}

/** Stage 11 hooks: the searches done and the crew at home (`crew=1`). */
function seedCrew(
  world: WorldState,
  content: Content,
  land: SimWorldContext,
  wreckers: string,
): void {
  const onFoot = world.onFoot;
  const search = content.searches;
  if (onFoot === null || search === null) return;
  const seats = content.household?.seats ?? [];
  ['C_ODDI', 'C_BRAN', 'C_RUNA'].forEach((id, i) => {
    const person = world.people[id];
    if (person === undefined) return;
    person.status = 'alive';
    if (!world.household.residents.includes(id)) world.household.residents.push(id);
    const seat = seats[(i + 1) % Math.max(1, seats.length)];
    const map = seat === undefined ? undefined : land.maps.get(seat.zone);
    if (seat !== undefined && map !== undefined)
      placeActor(onFoot, id, seat.zone, {
        x: seat.x * map.tile + (i - 1) * 14,
        y: seat.y * map.tile + 10,
        facing: seat.facing,
        pose: 'sit',
      });
  });
  const facts: Record<string, string | boolean> = {
    'search.open': true,
    'search.told': true,
    'search.oddi_found': true,
    'search.runa_seen': true,
    'search.runa_tools_safe': true,
    'search.bran_home': true,
    'search.oddi': 'CHEST_FIRST',
    'search.runa': 'OFFERING',
    'search.bran': 'SNEAK',
    'ch1.chest': 'SAVED',
    'ch1.runa_tools': 'SAVED',
    'hagseat.offering': 'CONFESSION',
    'ch1.thorkel_body': 'CAMP',
  };
  if (wreckers !== 'fold') {
    facts['ch1.wreckers'] = wreckers === 'beaten' ? 'BEATEN' : 'SEALCAVE';
    facts['enc.SCN_SK_WRECKERS'] = true;
  }
  // `wreckers=beaten`: the fight at the fold was won; Ketill and Svart fell, Conn ran.
  if (wreckers === 'beaten')
    for (const id of ['E_WRECKER_KETILL', 'E_WRECKER_SVART']) {
      const p = world.people[id];
      if (p !== undefined) p.status = 'dead';
    }
  for (const [k, v] of Object.entries(facts)) world.facts[k] = v;
  world.powers['POWER_CAILLEACH'] = {
    stone: 'DRY',
    offering: 'CONFESSION',
    day: 1,
    passedBy: false,
  };
  for (const beat of [
    'BEAT_1_SEARCH_ODDI',
    'BEAT_1_SEARCH_BRAN',
    'BEAT_1_SEARCH_RUNA',
    'BEAT_1_SEARCHES',
  ])
    fireOneShot(world, beat, () => undefined);
  const bier = search.bran.bier;
  const map = land.maps.get(bier.zone);
  if (map !== undefined)
    placeActor(onFoot, search.bran.body.id, bier.zone, {
      x: bier.x * map.tile,
      y: bier.y * map.tile,
      facing: bier.facing,
      pose: 'dead',
    });
}

/** Stage 11 hooks: the boat's repairs done, its fitting, and materials laid by it. */
function seedShip(world: WorldState, content: Content, params: URLSearchParams): void {
  const ship = world.ships['flagship'];
  const repairs = content.repairs;
  if (ship === undefined || repairs === null) return;
  const done = (params.get('ship') ?? '').split(',');
  const lay = (params.get('lay') ?? '').split(',');
  const kinds = { hull: 'HULL', rig: 'RIGGING', oar: 'STEERING_OAR' } as const;
  const laid = { hull: 'boards', rig: 'rig', oar: 'oar' } as const;
  for (const [k, r] of Object.entries(kinds)) {
    if (done.includes(k)) ship.repairs[r] = { stage: 'DONE', progress: 0, day: 1 };
    else if (lay.includes(laid[k as keyof typeof laid]))
      ship.repairs[r] = { stage: 'MATERIALS', progress: 0 };
  }
  if (done.includes('hull'))
    ship.integrity = parseShipBalance(content.balance).repairs.patchedIntegrity;
  if (done.includes('rig') || lay.includes('rig')) world.facts['repair.rigging_cut'] = true;
  if (done.includes('oar') || lay.includes('oar')) world.facts['repair.oar'] = 'TRADE';
  // `rites=setting|sea`: Thorkel's rites given (captures of the ship of stones).
  const rites = params.get('rites');
  if (rites === 'setting' || rites === 'sea') {
    world.facts['ch1.rites'] = rites === 'setting' ? 'SHIP_SETTING' : 'SEA_BURIAL';
    world.facts['rites.stage'] = 'DONE';
    const onFoot = world.onFoot;
    if (onFoot !== null)
      onFoot.actors = Object.fromEntries(
        Object.entries(onFoot.actors).filter(([k]) => k !== repairs.rites.body),
      );
  }
  const fit = params.get('fit');
  if (fit === 'hold') ship.fittings['MIDSHIP'] = 'FIT_EXTENDED_HOLD';
  if (fit === 'bow') ship.fittings['BOW'] = 'FIT_RAISED_BOW_PLATFORM';
}
