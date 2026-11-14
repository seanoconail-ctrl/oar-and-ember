/**
 * The camp in the play view (Stage 7): what the prompt says for a camp use, the morning report's
 * sentences, and the test and capture hooks that start play at the broch (`?camp=broch`).
 */
import { boatDrawing } from './repairsScene.ts';
import type { Content } from '../content/registry.ts';
import { wreckHooks } from './seaWreck.ts';
import { parseShipBalance } from '../content/shipBalance.ts';
import { parseTimeBalance } from '../content/balance.ts';
import { parseSeaBalance } from '../content/seaBalance.ts';
import { ensureWeather } from '../sim/sea/weather.ts';
import type { DayWeather } from '../sim/sea/types.ts';
import {
  FACT_LAUNCHED,
  FACT_PHASE,
  FACT_SMOKE,
  markSail,
  nameShip,
  startLaunch,
} from '../sim/narrative/launch.ts';
import type { Id } from '../core/ids.ts';
import {
  FACT_AT_BROCH,
  FACT_FIRE_LIT,
  FACT_HILD_TENDED,
  FACT_TUTORIAL_COMPLETE,
} from '../sim/home/camp.ts';
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
  content: Pick<Content, 'camp' | 'searches'> & Partial<Pick<Content, 'repairs' | 'raid'>>,
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
      // A task is named from its string, never by its ID (DH-110).
      const def = content.camp?.tasks[use.task];
      const task = t(def === undefined ? 'ui.name.unknown' : def.nameKey);
      return { text: click('ui.prompt.task', { task }), kind: use.task.toLowerCase() };
    }
    case 'REPAIR':
      // Stage 11: the steering oar taken from the scavengers' skiff.
      return { text: click('ui.prompt.take_oar'), kind: 'take_oar' };
    case 'OPENING':
      // The user's fourth playtest (DH-24): the steerer's word over a body, named.
      if (use.site === 'remark')
        return { text: click('ui.prompt.remark', { name: nameOf(use.target) }), kind: 'remark' };
      // Design addendum 2.4: Thorkel's key and chest, and the sail raised between the oars.
      return { text: click(`ui.prompt.${use.site}`), kind: use.site };
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
      // A reason for the first raid (DH-130 on): the skin boat, a beaten scavenger, the council.
      const raid = content.raid;
      const raidTalks =
        raid == null
          ? []
          : [raid.skinBoat.talk, raid.council.talk, ...Object.values(raid.ask.beaten)];
      const talk = [
        ...(content.searches?.talks ?? []),
        ...(content.repairs?.talks ?? []),
        ...raidTalks,
      ].find((x) => x.id === use.site);
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
    case 'FIND':
      // The user's fourth playtest (DH-115): a find off the path, named from its string.
      return {
        text: click(use.take ? 'ui.prompt.find_take' : 'ui.prompt.find_look', {
          name: t(use.nameKey),
        }),
        kind: use.take ? 'find_take' : 'find_look',
      };
    case 'REFUSE':
      // The hour comes from Book 10's sleepAfter with the refusal, never written here (DH-101).
      if (use.reason === 'TOO_EARLY_TO_SLEEP')
        return { text: t('ui.prompt.too_early', { time: use.after ?? '' }), kind: 'too_early' };
      if (use.reason === 'NO_DRIFTWOOD')
        return { text: t('ui.prompt.need_wood'), kind: 'need_wood' };
      return { text: t('ui.refusal.no_food'), kind: 'no_food' };
  }
}

/**
 * Tests and captures only: start at the broch with Hild there (`?camp=broch`; the lean-to up unless
 * `shelter=down`), and set the
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
      // Design addendum 2.4: cut free of the net, walked up to the camp at the first fire.
      'ch1.hild_reached',
      'ch1.net_free',
      'ch1.chest_named',
      'ch1.hild_walking_up',
      'ch1.hild_walked_up',
      // The user's third playtest (DG-13): she has pointed the way to the old tower.
      'ch1.broch_said',
    ])
      world.facts[fact] = true;
    // The lean-to stands as before the rework, unless asked for down (`shelter=down`: the sail
    // folded) or at another stage (`shelter=frame`, the frame standing; DG-12).
    const shelter = params.get('shelter');
    world.facts['ch1.shelter'] =
      shelter === 'down' ? 'FOLDED' : shelter === 'frame' ? 'FRAME' : 'SAIL';
    // The searches' people are out there as Stage 10's tests found them at the broch, unless
    // asked to wait for the first dusk (`searches=dusk`; decision DE-16).
    if (params.get('searches') !== 'dusk') world.facts['ch1.searches_placed'] = true;
    // The first night's fire scene has been sat through, unless asked to play it (`scene=fire`).
    if (params.get('scene') !== 'fire') world.facts['ch1.fire_scene'] = true;
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
    if (world.facts['ch1.shelter'] !== undefined) world.facts['ch1.shelter'] = 'FINISHED';
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
  seedPeople4(world, content, params);
  // Stage 12 (tests and captures): the launch (`launch=open|naming|scene`): the boat ready and the
  // gate open; or the gate started with the boat to be named; or named (`name=`) and marked
  // (`mark=raven:woad`), so the scene plays from the first tick. The tide must be in (`time=`).
  const launchParam = params.get('launch');
  if (launchParam !== null) seedLaunch(world, content, land, launchParam, params);
  // Stage 13 (tests and captures): today's weather at sea (`weather=clear|rising|fog|storm|calm`).
  const weather = params.get('weather');
  if (weather !== null) seedWeather(world, content, weather);
  // Stage 8, captures: start in another zone than the camp's (`zone=ZONE_SK_STRAND`).
  const zone = params.get('zone');
  const zoneTo = zone === null ? undefined : land.maps.get(zone);
  if (zoneTo !== undefined && zoneTo.zone !== onFoot.zone)
    switchZone(onFoot, zoneTo.zone, { x: onFoot.player.x, y: onFoot.player.y });
  // Stage 13 (tests and captures): the wreck on Sgeir Dhubh standalone (`wreck=1`).
  wreckHooks(world, content, land, params);
  const scene = world.onFoot ?? onFoot;
  const at = /^(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/.exec(params.get('at') ?? '');
  const map = land.maps.get(scene.zone);
  if (at !== null && map !== undefined) {
    scene.player.x = Number(at[1]) * map.tile;
    scene.player.y = Number(at[2]) * map.tile;
  }
}

/** Where an interaction's target is, in pixels (to compare with a camp use's distance). */
/**
 * Whether the nearest use is what Interact does rather than the lift or pickup in reach (as the
 * simulation picks): the nearer of the two, and never while setting something down. The play view
 * names the winner as its prompt (the user's fourth playtest, DH-10).
 */
export function useWins(
  use: { readonly d: number },
  interaction: Interaction | null,
  at: { readonly x: number; readonly y: number } | null,
  player: { readonly x: number; readonly y: number },
): boolean {
  if (interaction === null) return true;
  if (interaction.kind === 'SET_DOWN') return false;
  return at === null || use.d < Math.hypot(at.x - player.x, at.y - player.y);
}

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
/**
 * The user's fourth playtest (tests and captures; DH-40 to DH-64): `boatwork=all` puts everyone
 * home on the boat; `hull=0.3` and `rig=0.6` set a laid repair's work done as a share of its labour;
 * `hurt=C_RUNA,...` gives each a serious wound, untended; `joined=N` dates everyone's joining.
 */
function seedPeople4(world: WorldState, content: Content, params: URLSearchParams): void {
  const ship = world.ships['flagship'];
  if (params.get('boatwork') === 'all')
    for (const id of world.household.residents) {
      const p = world.people[id];
      if (p !== undefined) p.job = { kind: 'SHIPWRIGHT', since: world.calendar.day, byOrder: true };
    }
  const drawing = content.repairs === null ? null : boatDrawing(content.balance);
  const labour: Record<string, number> = {
    hull: drawing?.hullLabour ?? 0,
    rig: drawing?.riggingLabour ?? 0,
  };
  for (const [key, repair] of [
    ['hull', 'HULL'],
    ['rig', 'RIGGING'],
  ] as const) {
    const share = Number(params.get(key) ?? '');
    const rep = ship?.repairs[repair];
    if (params.has(key) && Number.isFinite(share) && rep?.stage === 'MATERIALS')
      rep.progress = share * (labour[key] ?? 0);
  }
  for (const id of (params.get('hurt') ?? '').split(',').filter((x) => x !== '')) {
    const p = world.people[id];
    if (p !== undefined)
      p.wounds = [{ day: world.calendar.day, severity: 'SERIOUS', where: 'ankle' }];
  }
  const joined = Number(params.get('joined') ?? '');
  if (Number.isInteger(joined) && joined > 0)
    for (const id of world.household.residents) {
      const p = world.people[id];
      if (p?.life.joinedDay === null) p.life.joinedDay = joined;
    }
}

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
  // `rites=taken` (the user's third playtest, DG-14; tests and captures): the sea rite's last word
  // just said, Thorkel laid at the water's place, so the sea takes him from the next tick.
  if (rites === 'taken') {
    const r = repairs.rites;
    const onFoot = world.onFoot;
    world.facts['rites.pending'] = 'SEA';
    world.facts['rites.stage'] = 'RITE';
    world.facts['rites.since'] = 0;
    world.facts['rites.line'] = r.lines.sea.length;
    world.facts['rites.laid'] = true;
    world.facts['rites.raised'] = true;
    if (onFoot !== null)
      placeActor(onFoot, r.body, r.sea.zone, {
        x: r.sea.x * 24,
        y: r.sea.y * 24,
        facing: 'e',
        pose: 'dead',
      });
  }
  const fit = params.get('fit');
  if (fit === 'hold') ship.fittings['MIDSHIP'] = 'FIT_EXTENDED_HOLD';
  if (fit === 'bow') ship.fittings['BOW'] = 'FIT_RAISED_BOW_PLATFORM';
}

/** Stage 12 hooks: the launch open, started or under way (`launch=open|naming|scene`); Stage 13's
 * `launch=done`, Chapter 1 over with the boat drawn up. */
function seedLaunch(
  world: WorldState,
  content: Content,
  land: SimWorldContext,
  which: string,
  params: URLSearchParams,
): void {
  const ctx = land.launch ?? null;
  const ship = world.ships['flagship'];
  if (ctx === null || ship === undefined) return;
  for (const r of ['HULL', 'RIGGING', 'STEERING_OAR'] as const)
    ship.repairs[r] = { stage: 'DONE', progress: 0, day: 1 };
  ship.integrity = parseShipBalance(content.balance).repairs.patchedIntegrity;
  world.facts['ch1.boat_ready'] = true;
  world.facts['repair.open'] = true;
  // Hild's first days' lines are long said by the launch.
  world.facts['ch1.fishing_said'] = true;
  world.facts['ch1.evening_said'] = true;
  world.gates[ctx.def.gate] = {
    status: 'OPEN',
    openedDay: world.calendar.day,
    pressureSteps: 0,
    retriesUsed: 0,
  };
  // A reason for the first raid (DH-141): the launch waits for the council at the fire; these
  // hooks start past it (the household agreed to go quietly) unless `council=open` leaves it to
  // be held.
  if (params.get('council') !== 'open') {
    world.facts['ch1.council'] = params.get('council')?.toUpperCase() ?? 'QUIET';
    world.facts['council.required'] = true;
  }
  if (which === 'open') return;
  const b = parseTimeBalance(content.balance);
  const quiet = (): void => undefined;
  startLaunch(world, ctx, land, b, { advance: quiet, deed: quiet }, quiet);
  if (which === 'naming') return;
  nameShip(world, ctx, params.get('name') ?? 'Grey Seal', quiet);
  const [pattern = 'raven', dye = null] = (params.get('mark') ?? 'raven:woad').split(':');
  markSail(world, ctx, pattern, dye, quiet);
  if (which !== 'done') return;
  // Stage 13 (tests and captures): `launch=done`, Chapter 1 over as the sea map's closing leaves
  // it: the gate passed, the boat launched and drawn up again at the strand, the smoke at Carrick
  // seen, Chapter 2 open and the household on the shingle (what reveal() and closeSeaMap() set).
  const gate = world.gates[ctx.def.gate];
  if (gate !== undefined) gate.status = 'PASSED';
  ship.history.push({ day: world.calendar.day, kind: 'LAUNCHED', what: ship.name ?? '' });
  for (const place of ctx.def.seaMap.rumoured) world.knowledge.places[place] ??= 'RUMOURED';
  world.facts[FACT_PHASE] = 'DONE';
  world.facts['launch.aboard'] = '';
  world.facts['launch.steerer_aboard'] = false;
  world.facts[FACT_SMOKE] = true;
  world.facts[FACT_LAUNCHED] = true;
  world.facts[FACT_TUTORIAL_COMPLETE] = true;
  const ch = world.chapters[ctx.def.chapter];
  if (ch !== undefined) {
    ch.status = 'RESOLVED';
    ch.resolvedDay = world.calendar.day;
    ch.resolvedBy = [ctx.def.gate];
  }
  const next = world.chapters[ctx.def.next];
  if (next !== undefined) {
    next.status = 'ACTIVE';
    next.openedDay = world.calendar.day;
  }
}

/** Stage 13 hooks: today's weather and tomorrow's forecast set for the sea map's tests. */
function seedWeather(world: WorldState, content: Content, which: string): void {
  const sb = parseSeaBalance(content.balance);
  ensureWeather(world, sb, sb.forecastAccuracy);
  const day = world.calendar.day;
  const w = world.sea.weather.days[day];
  const f = world.sea.weather.forecasts[day + 1];
  if (w === undefined) return;
  const set = {
    clear: { windFrom: 'SW', strength: 2, visibility: 'CLEAR' },
    rising: { windFrom: 'SW', strength: sb.risingStrength, visibility: 'CLEAR' },
    fog: { windFrom: 'SW', strength: 1, visibility: 'FOG' },
    storm: { windFrom: 'W', strength: sb.weather.stormFrom, visibility: 'HAZE' },
    calm: { windFrom: 'SW', strength: 0, visibility: 'CLEAR' },
  }[which];
  if (set === undefined) return;
  const strength = set.strength as DayWeather['strength'];
  const windFrom = set.windFrom as DayWeather['windFrom'];
  const visibility = set.visibility as DayWeather['visibility'];
  world.sea.weather.days[day] = { ...w, windFrom, strength, visibility, named: null, calm: false };
  if (f !== undefined)
    world.sea.weather.forecasts[day + 1] = {
      ...f,
      windFrom,
      strength,
      visibility,
      storm: strength >= sb.weather.stormFrom,
      calm: false,
    };
}
