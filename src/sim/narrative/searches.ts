/**
 * Chapter 1 beat 3, the three searches (Book 4 section 08; Book 5 section 02; Stage 10). They open
 * once Hild has led the steerer to the broch, and can be taken in any order; each teaches
 * something different across real island ground, and each records its decision as a fact.
 *
 * - **Oddi**, hurt in the wash by the wreck on Wreck Strand, with Thorkel's chest further down in
 *   the surf: carrying teaches the choice. Lift him first and the sea takes the chest; carry the
 *   chest up first and he lies in the cold a while longer (`search.oddi`: ODDI_FIRST or
 *   CHEST_FIRST).
 * - **Bran**, keeping Thorkel's body in the sheepfold under the Hollow Cairn against the three
 *   wreck-scavengers (decision S9-11's beat, moved here): fight them with Bran beside you; come
 *   round unseen and take the body away over the back wall; or walk up with empty hands and buy the
 *   body with Thorkel's silver, if the chest was saved (`search.bran`: FIGHT, SNEAK or BARGAIN; LOST
 *   if Bran is left behind downed).
 * - **Runa**, hurt by the Hag's Seat after following a light, her tool chest beside her; the first
 *   supernatural sign: the Cailleach's stone weeps and the gale holds the neck (content/searches.json,
 *   OMEN_HAGSEAT_STONE: sign, rule, response, consequence). Leave the stone an offering and the neck
 *   opens; or carry the chest and walk her round by the slower cliff path (`search.runa`: OFFERING
 *   or CLIFF_PATH).
 *
 * Rescued people join the household through Stage 8's people systems. Pure and deterministic: no
 * random stream is drawn here.
 */
import type { SearchBalance } from '../../content/searchBalance.ts';
import { parseSearchBalance } from '../../content/searchBalance.ts';
import type { Content, SearchesDef, SearchTalkDef } from '../../content/registry.ts';
import type { Id } from '../../core/ids.ts';
import { FACT_ARRIVED_SAID } from '../home/camp.ts';
import type { PlacedUse } from '../home/camp.ts';
import { fireOneShot, setFact } from '../ledger/ledger.ts';
import type { LandContext, OnFootActor, OnFootState } from '../land/onFoot.ts';
import { TICKS_PER_SECOND } from '../land/onFoot.ts';
import { planWalk, walkAlong } from '../land/path.ts';
import type { TileXY } from '../land/path.ts';
import { findActor, placeActor } from '../land/zoneLinks.ts';
import { tileOf } from '../land/zoneMap.ts';
import type { ZoneMap } from '../land/zoneMap.ts';
import { stepResident } from '../people/residents.ts';
import type { TalkState, WorldState } from '../world.ts';
import { repairChoiceOpen } from './repairs.ts';
import type { RepairsContext } from './repairs.ts';

export const FACT_SEARCHES_OPEN = 'search.open';
export const FACT_ODDI = 'search.oddi';
export const FACT_BRAN = 'search.bran';
export const FACT_RUNA = 'search.runa';
/**
 * The ship's silver in its strongbox by Oddi (Thorkel's chest before design addendum 2.4, decision
 * DE-17): SAVED (carried off the strand), LOST (to the scavengers), GIVEN (the bargain).
 */
export const FACT_CHEST = 'ch1.chest';
/** The wreck-scavengers after the sheepfold: BEATEN, SEALCAVE (gone unaware) or PAID. */
export const FACT_WRECKERS = 'ch1.wreckers';
/** Thorkel's body: CAMP (laid by the broch) or LOST (taken by the scavengers). */
export const FACT_BODY = 'ch1.thorkel_body';
/** What the Cailleach was given at the Hag's Seat: CONFESSION, ITEM_SEAX or ITEM_BOW. */
export const FACT_OFFERING = 'hagseat.offering';
const FACT_TOLD = 'search.told';
const FACT_ARRIVED_AT = 'search.arrived_at';
const FACT_ODDI_FOUND = 'search.oddi_found';
/** Oddi has said he will wait while the strongbox is carried up first (decision DE-85). */
const FACT_CHEST_SAID = 'search.oddi_chest_said';
const FACT_RUNA_SEEN = 'search.runa_seen';
const FACT_TOOLS_SAFE = 'search.runa_tools_safe';
const FACT_BRAN_HOME = 'search.bran_home';
const FACT_GALE_SAID = 'search.gale_at';

/** The Cailleach's saved state (`world.powers.POWER_CAILLEACH`; Book 2 section 17's true state). */
export interface CailleachState {
  stone: 'WEEPING' | 'DRY';
  offering: 'CONFESSION' | 'ITEM_SEAX' | 'ITEM_BOW' | null;
  day: number | null;
  /** Whether Runa was walked round by the cliff path with the stone still weeping. */
  passedBy: boolean;
}
export const CAILLEACH = 'POWER_CAILLEACH';

export interface SearchContext {
  readonly def: SearchesDef;
  readonly b: SearchBalance;
  /** The searches' talks, and (Stage 11) the repairs' words, which play the same way. */
  readonly talks: ReadonlyMap<string, SearchTalkDef>;
  /** Stage 11: the repairs, for their choices' conditions. */
  readonly repairs: RepairsContext | null;
}

export function searchContext(
  content: Pick<Content, 'searches' | 'balance'>,
  repairs: RepairsContext | null = null,
): SearchContext | null {
  const def = content.searches;
  if (def == null) return null;
  return {
    def,
    b: parseSearchBalance(content.balance),
    talks: new Map([
      ...def.talks.map((t): [string, SearchTalkDef] => [t.id, t]),
      ...(repairs === null ? [] : [...repairs.talks]),
    ]),
    repairs,
  };
}

export type SearchEvent =
  /** A checkpoint before a search's danger (Book 2 section 20). */
  | { readonly type: 'CHECKPOINT'; readonly label: string }
  /** An information caption from a search (Book 2 section 18): a sound, a sign, a refusal's why. */
  | { readonly type: 'SEARCH_INFO'; readonly key: string }
  | {
      readonly type: 'SEARCH_RESOLVED';
      readonly search: 'ODDI' | 'BRAN' | 'RUNA';
      readonly outcome: string;
    }
  /** The Hag's Seat answered: the stone dries and the gale falls. */
  | { readonly type: 'OMEN_ANSWERED'; readonly omen: Id; readonly offering: string }
  | {
      readonly type: 'PERSON_SPOKE';
      readonly person: Id;
      readonly lineKey: string;
      readonly bark?: string;
    }
  | { readonly type: 'TALK_STARTED'; readonly person: Id; readonly kind: 'SEARCH' }
  | { readonly type: 'TALK_ENDED'; readonly person: Id }
  | { readonly type: 'TALK_INFO'; readonly key: string };

export type SearchEmit = (e: SearchEvent) => void;

/** The Cailleach's state, as saved (a fresh one before the headland is reached). */
export function cailleach(world: WorldState): CailleachState {
  const s = world.powers[CAILLEACH] as CailleachState | undefined;
  if (s !== undefined) return s;
  const fresh: CailleachState = { stone: 'WEEPING', offering: null, day: null, passedBy: false };
  world.powers[CAILLEACH] = fresh;
  return fresh;
}

/** Whether the Hag's Seat stone weeps now (the sign; the neck held by the gale). */
export function stoneWeeps(world: WorldState): boolean {
  if (world.facts[FACT_SEARCHES_OPEN] !== true) return false;
  return (world.powers[CAILLEACH] as CailleachState | undefined)?.stone !== 'DRY';
}

const inRect = (
  r: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number },
  tx: number,
  ty: number,
): boolean => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;

/** Whether a tile is the Hag's neck (the gale holds it while the stone weeps). */
export function onNeck(ctx: SearchContext, map: ZoneMap, t: TileXY): boolean {
  return map.zone === ctx.def.runa.zone && inRect(ctx.def.runa.neck, t.tx, t.ty);
}

/**
 * Whether the gale on the neck stops the steerer stepping to (x, y): carrying anything across it
 * while the stone weeps (the sign's rule). The caller holds the step and says why.
 */
export function galeHolds(
  world: WorldState,
  ctx: SearchContext,
  map: ZoneMap,
  x: number,
  y: number,
): boolean {
  const onFoot = world.onFoot;
  if (onFoot?.carrying == null || !stoneWeeps(world)) return false;
  return onNeck(ctx, map, tileOf(map, x, y));
}

/** Says the gale's refusal at most once every few seconds. */
export function galeRefused(world: WorldState, emit: SearchEmit, ctx: SearchContext): void {
  const at = world.facts[FACT_GALE_SAID];
  if (typeof at === 'number' && world.tick - at < 4 * TICKS_PER_SECOND) return;
  setFact(world, FACT_GALE_SAID, world.tick);
  emit({ type: 'SEARCH_INFO', key: ctx.def.runa.info['gale'] ?? '' });
}

function joinHousehold(world: WorldState, id: Id): void {
  if (!world.household.residents.includes(id)) world.household.residents.push(id);
}

function hurt(world: WorldState, id: Id, where: string): void {
  const p = world.people[id];
  if (p === undefined) return;
  p.status = 'wounded';
  if (!p.wounds.some((w) => w.where === where))
    p.wounds.push({ day: world.calendar.day, severity: 'SERIOUS', where });
}

/** Opens the searches once Hild has led the steerer to the broch: everyone is placed. */
function open(world: WorldState, ctx: SearchContext): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const d = ctx.def;
  const T = 24;
  const put = (
    id: Id,
    zone: Id,
    at: { x: number; y: number; facing: string },
    pose: OnFootActor['pose'],
  ): void => {
    if (findActor(onFoot, id) !== null) return;
    placeActor(onFoot, id, zone, {
      x: at.x * T,
      y: at.y * T,
      facing: at.facing as OnFootActor['facing'],
      pose,
    });
  };
  // Someone already at home (a test's seeded household) is not out there to be found.
  const home = (id: Id): boolean => world.household.residents.includes(id);
  if (!home(d.oddi.person)) {
    put(d.oddi.person, d.oddi.zone, d.oddi.at, 'down');
    put(d.oddi.chest.id, d.oddi.zone, d.oddi.chest, 'down');
    hurt(world, d.oddi.person, d.oddi.wound);
  }
  if (!home(d.bran.person)) {
    put(d.bran.person, d.bran.zone, d.bran.at, 'idle');
    put(d.bran.body.id, d.bran.zone, d.bran.body, 'dead');
  }
  if (!home(d.runa.person)) {
    put(d.runa.person, d.runa.zone, d.runa.at, 'sit');
    put(d.runa.tools.id, d.runa.zone, d.runa.tools, 'down');
    hurt(world, d.runa.person, d.runa.wound);
  }
  cailleach(world);
  setFact(world, FACT_SEARCHES_OPEN, true);
}

/** What the steerer is near enough to talk to in a search (its words open on interact). */
export interface SearchUse {
  readonly talk: string;
  readonly target: Id;
  readonly x: number;
  readonly y: number;
  readonly reach: number;
}

/** Whether no enemy in the zone is aware of the household (the sneak's condition). */
function unseen(onFoot: OnFootState): boolean {
  return !Object.values(onFoot.actors).some(
    (a) => a.fight?.side === 'ENEMY' && a.fight.ai.aware && a.fight.dead === null,
  );
}

/** The search words as camp uses (the same list for the simulation and the prompt). */
export function searchPlacedUses(world: WorldState, ctx: SearchContext, map: ZoneMap): PlacedUse[] {
  return searchUses(world, ctx, map).map((u) => ({
    use: { kind: 'SEARCH', site: u.talk, target: u.target },
    x: u.x,
    y: u.y,
    reach: u.reach,
  }));
}

/** The search words that can be opened in the zone in view. */
export function searchUses(world: WorldState, ctx: SearchContext, map: ZoneMap): SearchUse[] {
  const onFoot = world.onFoot;
  if (onFoot === null || world.facts[FACT_SEARCHES_OPEN] !== true || world.talk !== null) return [];
  const out: SearchUse[] = [];
  const d = ctx.def;
  const add = (talk: string, target: Id, x: number, y: number): void => {
    const t = ctx.talks.get(talk);
    if (t !== undefined) out.push({ talk, target, x, y, reach: t.reachTiles * map.tile });
  };
  const battle = onFoot.battle ?? null;
  if (onFoot.zone === d.bran.zone && world.facts[FACT_BRAN] === undefined) {
    const bran = onFoot.actors[d.bran.person];
    if (bran?.pose === 'idle' && battle?.engaged !== true)
      add('bran.guard', d.bran.person, bran.x, bran.y);
    const ketill = onFoot.actors['E_WRECKER_KETILL'];
    if (ketill !== undefined && battle?.parley != null && !battle.parley.done)
      add('ketill.parley', 'E_WRECKER_KETILL', ketill.x, ketill.y);
  }
  if (onFoot.zone === d.runa.zone) {
    const runa = onFoot.actors[d.runa.person];
    if (runa?.pose === 'sit' && !world.household.residents.includes(d.runa.person))
      add('runa.found', d.runa.person, runa.x, runa.y);
    if (stoneWeeps(world))
      add(
        'stone.offer',
        'OMEN_HAGSEAT_STONE',
        d.runa.stone.x * map.tile,
        d.runa.stone.y * map.tile,
      );
  }
  return out;
}

/** Whether a choice can be taken now. */
function choiceOpen(world: WorldState, when: string | undefined, ctx: SearchContext): boolean {
  const onFoot = world.onFoot;
  if (when !== undefined && ctx.repairs !== null) {
    const open = repairChoiceOpen(world, ctx.repairs, when);
    if (open !== null) return open;
  }
  switch (when) {
    case undefined:
      return true;
    case 'UNSEEN':
      return onFoot !== null && unseen(onFoot);
    case 'CHEST_SAVED':
      return world.facts[FACT_CHEST] === 'SAVED';
    case 'HAS_SEAX':
      return world.player.hotbar.slots.includes('ITEM_SEAX');
    case 'HAS_BOW':
      return world.player.hotbar.slots.includes('ITEM_BOW');
    default:
      return false;
  }
}

/** A search's choices now (the talk panel's options): those whose condition holds, not yet said. */
export function searchOptions(world: WorldState, ctx: SearchContext): { key: string }[] {
  const talk = world.talk;
  if (talk?.kind !== 'SEARCH' || talk.queue.length > 0 || talk.ending) return [];
  const def = ctx.talks.get(talk.scene ?? '');
  if (def === undefined) return [];
  return def.choices
    .filter(
      (c) => choiceOpen(world, c.when, ctx) && !(c.once === true && talk.topics.includes(c.key)),
    )
    .map((c) => ({ key: c.key }));
}

/** Opens a search's words with someone (or something: the stone). */
export function startSearchTalk(
  world: WorldState,
  ctx: SearchContext,
  talkId: string,
  emit: SearchEmit,
): boolean {
  const def = ctx.talks.get(talkId);
  if (def === undefined || world.talk !== null) return false;
  const person = world.people[def.with] !== undefined;
  const talk: TalkState = {
    kind: 'SEARCH',
    with: def.with,
    scene: talkId,
    node: null,
    topics: [],
    topic: null,
    queue: [],
    nextLineTick: world.tick,
    line: null,
    chosen: null,
    ending: false,
    since: world.tick,
  };
  world.talk = talk;
  emit({ type: 'TALK_STARTED', person: def.with, kind: 'SEARCH' });
  talk.line = { speaker: person ? def.with : null, key: def.open };
  if (person) emit({ type: 'PERSON_SPOKE', person: def.with, lineKey: def.open });
  else emit({ type: 'TALK_INFO', key: def.open });
  return true;
}

/** What the simulation does for a search's actions beyond the search itself. */
export interface SearchHooks {
  /** The steerer offered a tool on the stone: it leaves the hotbar. */
  readonly giveUp: (item: Id) => void;
  /** Start the fight at the sheepfold now (Bran's call, or a threat). */
  readonly fight: () => void;
  /** The scavengers take the silver and go. */
  readonly bargain: () => void;
  /** Stage 11: a repairs' choice (a fitting, the carving, a trade, the rites). */
  readonly repair?: (action: string) => void;
  /** Design addendum 2.4 (decision DE-21): the place named for Runa's tool chest. */
  readonly runa?: (place: string) => void;
}

/** The steerer chooses option `index` of a search's words. */
export function chooseSearch(
  world: WorldState,
  ctx: SearchContext,
  index: number,
  hooks: SearchHooks,
  emit: SearchEmit,
): void {
  const talk = world.talk;
  if (talk?.kind !== 'SEARCH') return;
  const def = ctx.talks.get(talk.scene ?? '');
  const key = searchOptions(world, ctx)[index]?.key;
  const choice = def?.choices.find((c) => c.key === key);
  if (def === undefined || choice === undefined) return;
  talk.topics.push(choice.key);
  const speaker = world.people[def.with] !== undefined ? def.with : '';
  for (const r of choice.reply ?? []) talk.queue.push({ speaker, key: r });
  const end = (): void => {
    talk.ending = true;
  };
  switch (choice.do) {
    case undefined:
      return;
    case 'LEAVE':
      end();
      return;
    case 'SNEAK':
      sneakAway(world, ctx, emit);
      end();
      return;
    case 'FIGHT':
      end();
      hooks.fight();
      return;
    case 'BARGAIN':
      end();
      hooks.bargain();
      resolveBran(world, ctx, 'BARGAIN', emit);
      setFact(world, FACT_CHEST, 'GIVEN');
      setFact(world, FACT_WRECKERS, 'PAID');
      return;
    case 'FIT_HOLD':
    case 'FIT_BOW':
    case 'UNSHIP':
    case 'CARVE':
    case 'TRADE_SILVER':
    case 'TRADE_FOOD':
    case 'RITES_SETTING':
    case 'RITES_SEA':
    case 'LAUNCH':
      end();
      hooks.repair?.(choice.do);
      return;
    case 'RUNA_FIRE':
    case 'RUNA_SHELTER':
    case 'RUNA_BOAT':
      end();
      hooks.runa?.(choice.do.slice('RUNA_'.length));
      return;
    case 'OFFER_CONFESSION':
    case 'OFFER_SEAX':
    case 'OFFER_BOW': {
      const offering =
        choice.do === 'OFFER_CONFESSION'
          ? 'CONFESSION'
          : choice.do === 'OFFER_SEAX'
            ? 'ITEM_SEAX'
            : 'ITEM_BOW';
      if (offering !== 'CONFESSION') hooks.giveUp(offering);
      answerStone(world, ctx, offering, emit);
      end();
      return;
    }
  }
}

/** The stone given its due: it dries, the gale falls, and the Cailleach's state is saved. */
function answerStone(
  world: WorldState,
  ctx: SearchContext,
  offering: CailleachState['offering'] & string,
  emit: SearchEmit,
): void {
  const c = cailleach(world);
  c.stone = 'DRY';
  c.offering = offering;
  c.day = world.calendar.day;
  setFact(world, FACT_OFFERING, offering);
  const omen = ctx.def.omens[0]?.id ?? 'OMEN_HAGSEAT_STONE';
  emit({ type: 'OMEN_ANSWERED', omen, offering });
  emit({ type: 'SEARCH_INFO', key: ctx.def.runa.info['dried'] ?? '' });
  const runa = world.onFoot?.actors[ctx.def.runa.person];
  const line = ctx.def.runa.lines['offered'];
  if (runa !== undefined && line !== undefined)
    emit({ type: 'PERSON_SPOKE', person: ctx.def.runa.person, lineKey: line });
  // Runa saw it given: she remembers it, the confession's words with it.
  const p = world.people[ctx.def.runa.person];
  if (p !== undefined && runa !== undefined)
    p.memories.push({
      day: world.calendar.day,
      kind: 'EVENT',
      about: 'CAILLEACH_ANSWERED',
      source: 'SAW',
      detail: offering,
    });
}

/** Bran takes the body over the back wall, unseen: the search is done (SNEAK). */
function sneakAway(world: WorldState, ctx: SearchContext, emit: SearchEmit): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const d = ctx.def.bran;
  const bran = onFoot.actors[d.person];
  const body = onFoot.actors[d.body.id];
  if (bran === undefined || body === undefined) return;
  bran.x = d.over.x * 24;
  bran.y = d.over.y * 24;
  bran.facing = 'e';
  body.x = bran.x;
  body.y = bran.y;
  // After his answer, as they go over the wall.
  world.talk?.queue.push({ speaker: d.person, key: d.lines['sneakAway'] ?? '' });
  resolveBran(world, ctx, 'SNEAK', emit);
  setFact(world, FACT_WRECKERS, 'SEALCAVE');
}

/** Bran's search is decided: he joins, lifts Thorkel and carries him home. */
function resolveBran(
  world: WorldState,
  ctx: SearchContext,
  outcome: 'FIGHT' | 'SNEAK' | 'BARGAIN' | 'LOST',
  emit: SearchEmit,
): void {
  if (world.facts[FACT_BRAN] !== undefined) return;
  const d = ctx.def.bran;
  setFact(world, FACT_BRAN, outcome);
  emit({ type: 'SEARCH_RESOLVED', search: 'BRAN', outcome });
  fireOneShot(world, d.beat, () => undefined);
  if (outcome === 'LOST') {
    setFact(world, FACT_BODY, 'LOST');
    return;
  }
  joinHousehold(world, d.person);
  const onFoot = world.onFoot;
  const bran = onFoot?.actors[d.person];
  const body = onFoot?.actors[d.body.id];
  if (bran !== undefined && body !== undefined && bran.pose !== 'down' && bran.pose !== 'dead') {
    // Out of the fight's hands (he is the household's now; a later fight arms him again).
    if (bran.fight !== undefined && bran.fight.f.state !== 'downed') delete bran.fight;
    bran.carries = d.body.id;
    body.pose = 'carried';
    if (outcome !== 'SNEAK')
      emit({ type: 'PERSON_SPOKE', person: d.person, lineKey: d.lines['joined'] ?? '' });
  }
}

/** Whether a search moves this resident rather than their day (Bran carrying Thorkel home). */
export function searchHolds(world: WorldState, ctx: SearchContext | null, id: Id): boolean {
  if (ctx === null || world.onFoot === null || id !== ctx.def.bran.person) return false;
  const outcome = world.facts[FACT_BRAN];
  if (outcome === undefined || outcome === 'LOST' || world.facts[FACT_BRAN_HOME] === true)
    return false;
  return findActor(world.onFoot, id)?.actor.carries !== undefined;
}

/**
 * Oddi lifted first: he knows what it means for the chest (once). The strongbox lifted first while
 * he lies there: he says he will wait (once; decision DE-85).
 */
export function searchLifted(
  world: WorldState,
  ctx: SearchContext,
  target: Id,
  emit: SearchEmit,
): void {
  const d = ctx.def.oddi;
  if (
    target === d.chest.id &&
    world.facts[FACT_ODDI] === undefined &&
    world.facts[FACT_ODDI_FOUND] === true &&
    world.facts[FACT_CHEST_SAID] !== true
  ) {
    setFact(world, FACT_CHEST_SAID, true);
    emit({ type: 'PERSON_SPOKE', person: d.person, lineKey: d.lines['chestSaved'] ?? '' });
    return;
  }
  if (target !== d.person || world.facts[FACT_CHEST] !== undefined) return;
  if (world.facts['search.oddi_lifted'] === true) return;
  setFact(world, 'search.oddi_lifted', true);
  emit({ type: 'PERSON_SPOKE', person: d.person, lineKey: d.lines['liftedFirst'] ?? '' });
}

/**
 * Something set down (where the steerer may set it down). Oddi set down anywhere is safe and
 * joins the household (above the tide line, on his strand or off it; decision DE-85), and the
 * scavengers go for the strongbox if it still lies on the strand; the chest above the tide line is
 * saved; Runa's tools on the landward side are safe. Call before the rescue's deed, so Oddi is a
 * resident when it is weighed.
 */
export function searchSetDown(
  world: WorldState,
  ctx: SearchContext,
  target: Id,
  map: ZoneMap,
  emit: SearchEmit,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const d = ctx.def;
  const actor = onFoot.actors[target];
  // A chest is set down lying where it was put, not sitting like a person.
  if (actor !== undefined && (target === d.oddi.chest.id || target === d.runa.tools.id))
    actor.pose = 'down';
  if (target === d.oddi.person && world.facts[FACT_ODDI] === undefined) {
    const outcome = world.facts[FACT_CHEST] === 'SAVED' ? 'CHEST_FIRST' : 'ODDI_FIRST';
    setFact(world, FACT_ODDI, outcome);
    joinHousehold(world, target);
    // Oddi seen to first: the scavengers have the strongbox if it is still on the strand.
    if (world.facts[FACT_CHEST] === undefined) chestTaken(world, ctx, emit);
    emit({
      type: 'PERSON_SPOKE',
      person: target,
      lineKey:
        (outcome === 'CHEST_FIRST' ? d.oddi.lines['safeChest'] : d.oddi.lines['safeNoChest']) ?? '',
    });
    emit({ type: 'SEARCH_RESOLVED', search: 'ODDI', outcome });
    fireOneShot(world, d.oddi.beat, () => undefined);
    return;
  }
  if (target === d.runa.tools.id && actor !== undefined && map.zone === d.runa.zone) {
    const t = tileOf(map, actor.x, actor.y);
    if (inRect(d.runa.safe, t.tx, t.ty) && world.facts[FACT_TOOLS_SAFE] !== true) {
      setFact(world, FACT_TOOLS_SAFE, true);
      if (onFoot.actors[d.runa.person] !== undefined)
        emit({
          type: 'PERSON_SPOKE',
          person: d.runa.person,
          lineKey: d.runa.lines['toolsSafe'] ?? '',
        });
    }
  }
}

/** Removes an actor wherever it is. */
function remove(onFoot: OnFootState, id: Id): void {
  onFoot.actors = Object.fromEntries(Object.entries(onFoot.actors).filter(([k]) => k !== id));
  for (const rest of Object.values(onFoot.elsewhere ?? {}))
    rest.actors = Object.fromEntries(Object.entries(rest.actors).filter(([k]) => k !== id));
}

const WRECKERS = ['E_WRECKER_KETILL', 'E_WRECKER_SVART', 'E_WRECKER_CONN'] as const;

/**
 * One tick of the searches: they open; Hild tells of them; Oddi calls; checkpoints; Runa limps to
 * her tools by the open way; Bran carries Thorkel home; the paid scavengers walk off; the fight at
 * the fold decides Bran's search; all three done completes the beat.
 */
export function stepSearches(
  world: WorldState,
  ctx: SearchContext,
  land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  tidalGroundOpen: boolean,
  hild: Id | null,
  emit: SearchEmit,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const d = ctx.def;
  if (world.facts[FACT_SEARCHES_OPEN] !== true) {
    if (world.facts[d.opensAfter] !== true) return;
    open(world, ctx);
  }
  const p = onFoot.player;
  const map = land.maps.get(onFoot.zone);
  const tile = map?.tile ?? 24;
  // Hild tells of the three a few seconds after she has shown the camp.
  // (Before design addendum 2.4: since it she names them at the first night's fire, DE-16.)
  if (
    world.facts[FACT_TOLD] !== true &&
    hild !== null &&
    world.facts[FACT_ARRIVED_SAID] === true &&
    world.facts['ch1.phase'] === undefined
  ) {
    const at = world.facts[FACT_ARRIVED_AT];
    if (typeof at !== 'number') setFact(world, FACT_ARRIVED_AT, world.tick);
    else if (world.tick - at >= 5 * TICKS_PER_SECOND) {
      setFact(world, FACT_TOLD, true);
      emit({ type: 'PERSON_SPOKE', person: hild, lineKey: d.tell });
    }
  }
  // Oddi calls when the steerer comes near: the search's checkpoint.
  const oddi = onFoot.actors[d.oddi.person];
  if (
    world.facts[FACT_ODDI_FOUND] !== true &&
    oddi?.pose === 'down' &&
    Math.hypot(oddi.x - p.x, oddi.y - p.y) <= ctx.b.oddiCallTiles * tile
  ) {
    setFact(world, FACT_ODDI_FOUND, true);
    emit({ type: 'CHECKPOINT', label: d.oddi.checkpoint });
    emit({ type: 'SEARCH_INFO', key: d.oddi.info['calling'] ?? '' });
    emit({ type: 'PERSON_SPOKE', person: d.oddi.person, lineKey: d.oddi.lines['call'] ?? '' });
  }
  stepChest(world, ctx, emit);
  // The headland reached: the Hag's Seat's checkpoint.
  if (onFoot.zone === d.runa.zone && world.facts[FACT_RUNA_SEEN] !== true) {
    setFact(world, FACT_RUNA_SEEN, true);
    emit({ type: 'CHECKPOINT', label: d.runa.checkpoint });
  }
  stepRuna(world, ctx, land, tidalGroundOpen, emit);
  stepBran(world, ctx, land, tidalGroundOpen, emit);
  // All three done: the beat.
  if (
    world.facts[FACT_ODDI] !== undefined &&
    world.facts[FACT_BRAN] !== undefined &&
    world.facts[FACT_RUNA] !== undefined
  )
    fireOneShot(world, d.beat, () => undefined);
}

/**
 * Thorkel's chest: carried off the strand, it is saved; left lying there once Oddi has called, the
 * wreck-scavengers have it as soon as the steerer is off the strand without it (the order is the
 * search's decision; decision S10-3).
 */
function stepChest(world: WorldState, ctx: SearchContext, emit: SearchEmit): void {
  const onFoot = world.onFoot;
  const d = ctx.def.oddi;
  if (onFoot === null || world.facts[FACT_CHEST] !== undefined) return;
  const chest = findActor(onFoot, d.chest.id);
  if (chest === null) return;
  if (chest.zone !== d.zone) {
    setFact(world, FACT_CHEST, 'SAVED');
    // Oddi still out there sees the haul saved first (Gain).
    const oddi = world.people[d.person];
    if (oddi !== undefined && world.facts[FACT_ODDI] === undefined) {
      oddi.friendship += ctx.b.chestFirstFriendship;
      oddi.memories.push({
        day: world.calendar.day,
        kind: 'EVENT',
        about: 'CHEST_FIRST',
        source: 'SAW',
      });
    }
    return;
  }
  if (
    world.facts[FACT_ODDI_FOUND] === true &&
    onFoot.zone !== d.zone &&
    onFoot.carrying !== d.chest.id
  )
    chestTaken(world, ctx, emit);
}

/** The wreck-scavengers have the ship's silver: gone from the strand, and Oddi sorry for it. */
function chestTaken(world: WorldState, ctx: SearchContext, emit: SearchEmit): void {
  const onFoot = world.onFoot;
  const d = ctx.def.oddi;
  if (onFoot === null || world.facts[FACT_CHEST] !== undefined) return;
  if (findActor(onFoot, d.chest.id)?.zone !== d.zone) return;
  remove(onFoot, d.chest.id);
  setFact(world, FACT_CHEST, 'LOST');
  emit({ type: 'SEARCH_INFO', key: d.info['chestLost'] ?? '' });
  const oddi = world.people[d.person];
  if (oddi !== undefined) oddi.friendship += ctx.b.chestLostFriendship;
}

/** Runa limps to her tools once they are safe, by the way the stone allows; there she joins. */
function stepRuna(
  world: WorldState,
  ctx: SearchContext,
  land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  tidalGroundOpen: boolean,
  emit: SearchEmit,
): void {
  const onFoot = world.onFoot;
  const d = ctx.def.runa;
  if (
    onFoot === null ||
    world.facts[FACT_TOOLS_SAFE] !== true ||
    world.facts[FACT_RUNA] !== undefined
  )
    return;
  const found = findActor(onFoot, d.person);
  const tools = findActor(onFoot, d.tools.id);
  const map = found === null ? undefined : land.maps.get(found.zone);
  if (found === null || tools === null || map === undefined) return;
  const runa = found.actor;
  const goal = tools.actor;
  const near =
    found.zone === tools.zone && Math.hypot(goal.x - runa.x, goal.y - runa.y) <= 1.2 * map.tile;
  if (!near && found.visible && found.zone === tools.zone) {
    // On her feet, at a limp; never over the neck while the stone weeps.
    const weeping = stoneWeeps(world);
    const closed = weeping ? (t: TileXY): boolean => onNeck(ctx, map, t) : undefined;
    if (runa.pose === 'sit') runa.pose = 'idle';
    if (runa.walk === undefined || Math.hypot(runa.walk.x - goal.x, runa.walk.y - goal.y) > 2) {
      const walk = planWalk(runa, map, goal.x - 10, goal.y, tidalGroundOpen, closed);
      if (walk === null) return;
      runa.walk = walk;
    }
    runa.moving = true;
    const arrived = walkAlong(runa, runa.walk, map, land, ctx.b.limpSpeed, tidalGroundOpen);
    if (arrived) delete runa.walk;
    return;
  }
  if (!near && !found.visible) {
    // Out of view, she gets there in her own time.
    runa.x = goal.x - 10;
    runa.y = goal.y;
  }
  // At her tools: she takes them up and joins the household.
  delete runa.walk;
  delete runa.moving;
  runa.pose = 'idle';
  // Design addendum 2.4 (decision DE-21): her tool chest stays where it was set down past the
  // neck, for the steerer to bring somewhere safe; she walks home and asks where it went.
  if (world.facts['ch1.phase'] === undefined) remove(onFoot, d.tools.id);
  const c = cailleach(world);
  const outcome = c.stone === 'DRY' ? 'OFFERING' : 'CLIFF_PATH';
  if (outcome === 'CLIFF_PATH') c.passedBy = true;
  setFact(world, FACT_RUNA, outcome);
  setFact(world, 'ch1.runa_tools', 'SAVED');
  const person = world.people[d.person];
  if (person !== undefined) {
    person.friendship +=
      outcome === 'OFFERING' ? ctx.b.offeringFriendship : ctx.b.cliffPathFriendship;
    person.memories.push({
      day: world.calendar.day,
      kind: 'EVENT',
      about: outcome === 'OFFERING' ? 'HAGSEAT_OFFERING' : 'HAGSEAT_CLIFF_PATH',
      source: 'SAW',
    });
  }
  joinHousehold(world, d.person);
  emit({ type: 'PERSON_SPOKE', person: d.person, lineKey: d.lines['home'] ?? '' });
  emit({ type: 'SEARCH_RESOLVED', search: 'RUNA', outcome });
  fireOneShot(world, d.beat, () => undefined);
}

/** The fold: the fight decides; Bran carries Thorkel home; the scavengers leave as they must. */
function stepBran(
  world: WorldState,
  ctx: SearchContext,
  land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  tidalGroundOpen: boolean,
  emit: SearchEmit,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const d = ctx.def.bran;
  const outcome = world.facts[FACT_BRAN];
  const battle = onFoot.zone === d.zone ? (onFoot.battle ?? null) : null;
  // The fight at the fold is won: no scavenger still fights.
  if (outcome === undefined && battle !== null && battle.engaged && battle.over) {
    resolveBran(world, ctx, 'FIGHT', emit);
    setFact(world, FACT_WRECKERS, 'BEATEN');
  }
  // A version 7 save fought them on the strand already: Bran has no one left to hold off.
  if (outcome === undefined && world.facts[FACT_WRECKERS] === 'BEATEN' && onFoot.zone === d.zone)
    resolveBran(world, ctx, 'FIGHT', emit);
  // Bran fell and was left: the scavengers had the body (the draugr's anchor, Book 4 section 07).
  if (outcome === undefined && world.people[d.person]?.status === 'dead')
    resolveBran(world, ctx, 'LOST', emit);
  // The paid scavengers walk off east and are gone.
  if (world.facts[FACT_WRECKERS] === 'PAID') {
    for (const id of WRECKERS) {
      const found = findActor(onFoot, id);
      // Stage 11: only those still at the fold (at Seal Cave they are the cave's).
      if (found?.zone !== d.zone) continue;
      const map = land.maps.get(found.zone);
      if (!found.visible || map === undefined) {
        remove(onFoot, id);
        continue;
      }
      const a = found.actor;
      const end = d.leave[d.leave.length - 1] ?? [95.6, 41];
      if (a.walk === undefined) {
        const walk = planWalk(
          a,
          map,
          (end[0] ?? 95.6) * map.tile,
          (end[1] ?? 41) * map.tile,
          tidalGroundOpen,
        );
        if (walk === null) {
          remove(onFoot, id);
          continue;
        }
        a.walk = walk;
      }
      a.moving = true;
      if (walkAlong(a, a.walk, map, land, land.movement.walk, tidalGroundOpen)) remove(onFoot, id);
    }
  }
  // Gone unaware to their skiff in Seal Cave once the steerer has left the fold.
  if (world.facts[FACT_WRECKERS] === 'SEALCAVE' && onFoot.zone !== d.zone)
    for (const id of WRECKERS) if (findActor(onFoot, id)?.zone === d.zone) remove(onFoot, id);
  // Bran carries Thorkel home to the bier by the broch; there he lays him down.
  if (outcome === undefined || outcome === 'LOST' || world.facts[FACT_BRAN_HOME] === true) return;
  const bran = findActor(onFoot, d.person);
  const body = findActor(onFoot, d.body.id);
  if (bran === null || body === null) return;
  if (bran.actor.carries === undefined) {
    // Bran downed in the fight and brought home: the household fetches Thorkel to the camp, out
    // of the steerer's sight.
    if (!body.visible) layBody(world, ctx, onFoot, emit, false);
    return;
  }
  const away = outcome === 'SNEAK' && bran.zone === d.zone;
  const legs = away ? d.away : [];
  const legAt = Number(world.facts['search.bran_leg'] ?? 0);
  const leg = legs[legAt];
  if (leg !== undefined) {
    // Away round the back of the fold, out of the scavengers' sight, before home.
    const map = land.maps.get(bran.zone);
    if (map !== undefined) {
      const tx = (leg[0] ?? 0) * map.tile;
      const ty = (leg[1] ?? 0) * map.tile;
      stepResident(
        onFoot,
        d.person,
        { zone: bran.zone, x: tx, y: ty, facing: 'w', pose: 'idle' },
        land.maps,
        land,
        tidalGroundOpen,
        false,
        land.movement.carry,
      );
      const now = findActor(onFoot, d.person);
      if (now !== null && Math.hypot(now.actor.x - tx, now.actor.y - ty) < 2)
        setFact(world, 'search.bran_leg', legAt + 1);
    }
  } else {
    const T = 24;
    stepResident(
      onFoot,
      d.person,
      { zone: d.bier.zone, x: d.bier.x * T + 18, y: d.bier.y * T, facing: 'w', pose: 'idle' },
      land.maps,
      land,
      tidalGroundOpen,
      false,
      land.movement.carry,
    );
  }
  const now = findActor(onFoot, d.person);
  if (now === null) return;
  now.actor.carries = d.body.id;
  if (now.actor.walk !== undefined) now.actor.moving = true;
  // The body goes with him, over his shoulders.
  const b = findActor(onFoot, d.body.id);
  if (b !== null) {
    const moved = {
      ...b.actor,
      x: now.actor.x,
      y: now.actor.y,
      facing: now.actor.facing,
      pose: 'carried' as const,
    };
    placeActor(onFoot, d.body.id, now.zone, moved);
  }
  const T = 24;
  if (
    now.zone === d.bier.zone &&
    Math.hypot(now.actor.x - (d.bier.x * T + 18), now.actor.y - d.bier.y * T) < 1
  )
    layBody(world, ctx, onFoot, emit, now.visible);
}

/** Thorkel laid on his bier by the broch: Bran's day takes him from here. */
function layBody(
  world: WorldState,
  ctx: SearchContext,
  onFoot: OnFootState,
  emit: SearchEmit,
  say: boolean,
): void {
  const d = ctx.def.bran;
  const T = 24;
  const bran = findActor(onFoot, d.person);
  if (bran !== null) {
    delete bran.actor.carries;
    delete bran.actor.walk;
    delete bran.actor.moving;
    bran.actor.pose = 'idle';
  }
  placeActor(onFoot, d.body.id, d.bier.zone, {
    x: d.bier.x * T,
    y: d.bier.y * T,
    facing: d.bier.facing,
    pose: 'dead',
  });
  setFact(world, FACT_BRAN_HOME, true);
  setFact(world, FACT_BODY, 'CAMP');
  if (say) emit({ type: 'PERSON_SPOKE', person: d.person, lineKey: d.lines['laid'] ?? '' });
}
