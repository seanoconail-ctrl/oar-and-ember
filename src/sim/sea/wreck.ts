/**
 * The wreck on Sgeir Dhubh (`SCN_SEA_WRECK`; Book 6 section 19; Stage 13, work package C,
 * decisions S13-40 to S13-59): the playable voyage interruption on the Skarvholm to Carrick
 * crossing. The sea simulation hands off `ON_FOOT` to this scenario (src/sim/sea/handoff.ts); the
 * steerer walks the reef, speaks with the three survivors, may lift and carry one, and at the
 * boat's side answers Hild's question. The answer becomes the handoff's result.
 *
 * Everything here is deterministic: the scene, the words offered and the result follow only from
 * the world and content (no clock, no `Math.random`). Progress is kept in facts (`sea.wreck.*`,
 * saved with the world) and in the handed-off scene's actors.
 *
 * - `beginWreck` puts the scene in place (`beginHandoffScene`) when the handoff is the wreck's.
 * - `wreckUses` and `wreckInteract`: where Interact speaks with a survivor or opens Hild's question.
 * - `wreckOptions` and `chooseWreck`: the answers on offer and the one taken; a final answer is kept
 *   in `sea.wreck.choice` and the words play out through the simulation's talk (`talkTick`).
 * - `wreckResult` (pure): what an answer gives the voyage, as Book 2's `HandoffResult`.
 * - `finishWreck`: once the words have played (`wreckReady`), the deeds are written, survivors taken
 *   aboard become people of the world, the scene ends (`endHandoffScene`) and the result is
 *   returned to send as `SEA_HANDOFF_RETURN`.
 * - `stepWreck`: each tick, survivors who can turn their heads look at the steerer near them.
 */
import type { Id } from '../../core/ids.ts';
import type { Content, PersonDef } from '../../content/registry.ts';
import { parsePeopleBasics } from '../../content/balance.ts';
import { parseWreckBalance } from '../../content/wreckBalance.ts';
import type { WreckBalance } from '../../content/wreckBalance.ts';
import type { WreckChoice, WreckDef, WreckSurvivorDef } from '../../content/wreckSchema.ts';
import type { ZoneMap } from '../../content/zoneMap.ts';
import { setFact } from '../ledger/ledger.ts';
import { placeOnFoot } from '../land/onFoot.ts';
import type { OnFootState } from '../land/onFoot.ts';
import { householdDeed, remember } from '../people/deeds.ts';
import type { PeopleContext } from '../people/context.ts';
import type { Emit as PeopleEmit } from '../people/day.ts';
import { newPerson } from '../people/person.ts';
import { deriveStats, FLAGSHIP, shipDefsOf } from '../ship/ship.ts';
import type { ShipDefs } from '../ship/ship.ts';
import type { FactValue, TalkState, WorldState } from '../world.ts';
import { beginHandoffScene, currentHandoff, endHandoffScene } from './handoff.ts';
import type { HandoffResult } from './types.ts';

export type { WreckChoice };

/** The facts the wreck writes (Book 6 section 19, "Facts later stages read"). */
export const WRECK_FACTS = {
  met: 'sea.wreck.met',
  choice: 'sea.wreck.choice',
  survivors: 'sea.wreck.survivors',
  iron: 'sea.wreck.iron',
  cask: 'sea.wreck.cask',
  goods: 'sea.wreck.goods',
  word: 'sea.wreck.word',
  wordDay: 'sea.wreck.word_day',
  warned: 'sea.wreck.warned',
  askedConn: 'sea.wreck.asked_conn',
  overloaded: 'sea.wreck.overloaded',
  /** The day the result was handed back (the scene is over). */
  done: 'sea.wreck.done',
} as const;

/** The talk site of Hild's question at the boat's side; a survivor's is `wreck.<id>`. */
export const ASK_SITE = 'wreck.ask';

export interface SeaWreckContext {
  readonly def: WreckDef;
  readonly b: WreckBalance;
  readonly survivors: ReadonlyMap<Id, WreckSurvivorDef>;
  readonly ship: ShipDefs;
  /** The starting vitality of an adult (Book 10 section 06), for the survivors as people. */
  readonly vitality: number;
  readonly balance: unknown;
  /** The household's people (deeds and memories); null in trimmed tests. */
  readonly people: PeopleContext | null;
}

/** The wreck's context from loaded content, or null when the wreck's content is not loaded. */
export function seaWreckContext(
  content: Pick<Content, 'wreck' | 'hulls' | 'fittings' | 'balance'>,
  people: PeopleContext | null = null,
): SeaWreckContext | null {
  const def = content.wreck;
  if (def === null) return null;
  return {
    def,
    b: parseWreckBalance(content.balance),
    survivors: new Map(def.survivors.map((s) => [s.id, s])),
    ship: shipDefsOf(content),
    vitality: parsePeopleBasics(content.balance).vitality,
    balance: content.balance,
    people,
  };
}

/** Whether the voyage's handoff waiting now is the wreck's. */
export function wreckWaiting(world: WorldState, ctx: SeaWreckContext): boolean {
  const req = currentHandoff(world);
  return req !== null && req.kind === 'ON_FOOT' && req.scenarioId === ctx.def.scenario;
}

/** Whether the steerer is on the reef now (the wreck's scene in place). */
export function inWreck(world: WorldState, ctx: SeaWreckContext): boolean {
  return wreckWaiting(world, ctx) && world.onFoot?.zone === ctx.def.zone;
}

/**
 * The scene on the reef: the steerer ashore beside the boat (the zone's `P_STEERER` spawn), the
 * three survivors where Book 9 section 15 puts them, in their poses (Fínán holding the hull,
 * Derbáil braced on the rocks, Ívar lying hurt). Nothing lies to be picked up.
 */
export function wreckScene(ctx: SeaWreckContext, map: ZoneMap): OnFootState {
  const scene = placeOnFoot(map, [], 'idle');
  for (const s of ctx.def.survivors)
    scene.actors[s.id] = {
      x: s.at.x * map.tile,
      y: s.at.y * map.tile,
      facing: s.at.facing,
      pose: s.pose,
    };
  return scene;
}

/**
 * Puts the wreck's scene in place when its handoff waits (the home's scene stays kept in
 * `sea.stash`). Returns false, changing nothing, when the handoff is not the wreck's or the scene
 * is already in place.
 */
export function beginWreck(world: WorldState, ctx: SeaWreckContext, map: ZoneMap): boolean {
  if (!wreckWaiting(world, ctx) || world.onFoot !== null || map.zone !== ctx.def.zone)
    return false;
  if (!beginHandoffScene(world, wreckScene(ctx, map))) return false;
  setFact(world, WRECK_FACTS.met, world.calendar.day);
  return true;
}

/** A place where Interact opens the wreck's words: a survivor, or Hild's question. */
export interface WreckUse {
  readonly site: string;
  readonly target: Id;
  /** In pixels. */
  readonly x: number;
  readonly y: number;
  readonly reach: number;
}

/** The wreck's uses now: each survivor not being carried, and the boat's side. None mid-talk. */
export function wreckUses(world: WorldState, ctx: SeaWreckContext, tile: number): WreckUse[] {
  const onFoot = world.onFoot;
  if (onFoot === null || !inWreck(world, ctx) || world.talk !== null) return [];
  if (world.facts[WRECK_FACTS.choice] !== undefined) return [];
  const out: WreckUse[] = [];
  for (const s of ctx.def.survivors) {
    const a = onFoot.actors[s.id];
    if (a === undefined || a.pose === 'carried' || onFoot.carrying === s.id) continue;
    out.push({ site: `wreck.${s.id}`, target: s.id, x: a.x, y: a.y, reach: ctx.b.talkReachTiles * tile });
  }
  out.push({
    site: ASK_SITE,
    target: ctx.def.asker,
    x: ctx.def.board.x * tile,
    y: ctx.def.board.y * tile,
    reach: ctx.b.boardReachTiles * tile,
  });
  return out;
}

/** The nearest use in reach of the steerer, or null. */
export function nearestWreckUse(
  world: WorldState,
  ctx: SeaWreckContext,
  tile: number,
): WreckUse | null {
  const p = world.onFoot?.player;
  if (p === undefined) return null;
  let best: WreckUse | null = null;
  let bestD = Infinity;
  for (const u of wreckUses(world, ctx, tile)) {
    const d = Math.hypot(u.x - p.x, u.y - p.y);
    if (d <= u.reach && d < bestD) {
      best = u;
      bestD = d;
    }
  }
  return best;
}

/** The words of a site: a survivor's, or Hild's question. */
function talkOf(ctx: SeaWreckContext, site: string): { with: Id; talk: WreckDef['ask'] } | null {
  if (site === ASK_SITE) return { with: ctx.def.asker, talk: ctx.def.ask };
  const s = ctx.survivors.get(site.slice('wreck.'.length));
  return s === undefined ? null : { with: s.id, talk: s.talk };
}

/** The events the wreck's words emit (part of SimEvent). */
export type WreckEvent =
  | { readonly type: 'TALK_STARTED'; readonly person: Id; readonly kind: 'SEARCH' }
  | { readonly type: 'PERSON_SPOKE'; readonly person: Id; readonly lineKey: string };
export type WreckEmit = (e: WreckEvent) => void;

/** Opens a site's words (`world.talk`, a search's kind). False if none or a talk is open. */
export function openWreckTalk(
  world: WorldState,
  ctx: SeaWreckContext,
  site: string,
  emit: WreckEmit,
): boolean {
  const t = talkOf(ctx, site);
  if (t === null || world.talk !== null || !inWreck(world, ctx)) return false;
  const talk: TalkState = {
    kind: 'SEARCH',
    with: t.with,
    scene: site,
    node: null,
    topics: [],
    topic: null,
    queue: [],
    nextLineTick: world.tick,
    line: { speaker: t.with, key: t.talk.open },
    chosen: null,
    ending: false,
    since: world.tick,
  };
  world.talk = talk;
  emit({ type: 'TALK_STARTED', person: t.with, kind: 'SEARCH' });
  emit({ type: 'PERSON_SPOKE', person: t.with, lineKey: t.talk.open });
  return true;
}

/** Interact on the reef: opens the nearest use's words. Returns the site opened, or null. */
export function wreckInteract(
  world: WorldState,
  ctx: SeaWreckContext,
  tile: number,
  emit: WreckEmit,
): string | null {
  const use = nearestWreckUse(world, ctx, tile);
  if (use === null) return null;
  return openWreckTalk(world, ctx, use.site, emit) ? use.site : null;
}

/** The answers on offer in the open words (none while lines are still to come). */
export function wreckOptions(world: WorldState, ctx: SeaWreckContext): { key: string }[] {
  const talk = world.talk;
  if (talk?.kind !== 'SEARCH' || talk.queue.length > 0 || talk.ending) return [];
  const t = talkOf(ctx, talk.scene ?? '');
  if (t === null) return [];
  // An answer that only asks is offered once; leaving and the four answers always.
  return t.talk.choices
    .filter((c) => c.do !== undefined || !talk.topics.includes(c.key))
    .map((c) => ({ key: c.key }));
}

const FINAL: readonly string[] = ['ABOARD', 'ASHORE', 'SALVAGE', 'LEAVE'];

/**
 * The steerer takes answer `index` of the open words. Its replies are queued for the talk to play;
 * a survivor's question may set a fact (the reveal heard); closing or "not yet" ends the words; one
 * of the four answers is kept (`sea.wreck.choice`), with the reactions after Hild's reply, and the
 * words end. Returns the final answer when one was taken, else null.
 */
export function chooseWreck(
  world: WorldState,
  ctx: SeaWreckContext,
  index: number,
): WreckChoice | null {
  const talk = world.talk;
  if (talk?.kind !== 'SEARCH') return null;
  const t = talkOf(ctx, talk.scene ?? '');
  const key = wreckOptions(world, ctx)[index]?.key;
  const choice = t?.talk.choices.find((c) => c.key === key);
  if (t === null || choice === undefined) return null;
  talk.topics.push(choice.key);
  for (const r of choice.reply ?? []) talk.queue.push({ speaker: t.with, key: r });
  if (choice.fact !== undefined) setFact(world, choice.fact, true);
  const what = choice.do;
  if (what === undefined) return null;
  if (what === 'TALK_LEAVE' || what === 'NOT_YET') {
    talk.ending = true;
    return null;
  }
  if (!FINAL.includes(what)) return null;
  const final = what as WreckChoice;
  setFact(world, WRECK_FACTS.choice, final);
  const rescued = final === 'ABOARD' || final === 'ASHORE';
  // Fínán pays for a passage with what his boat carried (decision S13-51).
  if (rescued)
    for (const r of ctx.def.reactions['GIFT'] ?? []) talk.queue.push({ speaker: r.person, key: r.key });
  for (const r of ctx.def.reactions[final] ?? []) talk.queue.push({ speaker: r.person, key: r.key });
  talk.ending = true;
  return final;
}

/** Whether an answer was taken and its words have played: the scene can end. */
export function wreckReady(world: WorldState, ctx: SeaWreckContext): boolean {
  return (
    inWreck(world, ctx) &&
    world.facts[WRECK_FACTS.choice] !== undefined &&
    world.facts[WRECK_FACTS.done] === undefined &&
    world.talk === null
  );
}

/** The berths free aboard now: the hull's berths less everyone aboard, the steerer included. */
export function freeBerths(world: WorldState, ctx: SeaWreckContext): number {
  const v = world.sea.voyage;
  const ship = world.ships[FLAGSHIP];
  if (v === null || ship === undefined) return 0;
  const aboard = v.aboard.length + 1;
  return Math.max(0, deriveStats(ship, ctx.ship, aboard).berths - aboard);
}

/** The next day's wind strength (drawn a day ahead by the sea's weather), or today's. */
function windTomorrow(world: WorldState): number {
  const day = world.calendar.day;
  const days = world.sea.weather.days;
  return days[day + 1]?.strength ?? days[day]?.strength ?? 0;
}

/** What an answer means beyond the handoff's result (for the report and the tests). */
export interface WreckOutcome {
  readonly choice: WreckChoice;
  readonly result: HandoffResult;
  /** Where the survivors end up. */
  readonly survivors: 'ABOARD' | 'ASHORE' | 'TAKEN_OFF' | 'DROWNED';
  /** Survivors beyond the free berths (each Book 10 passengerSlots cargo slots). */
  readonly overloaded: number;
  /** What the sea map says after (a string key). */
  readonly textKey: string;
}

/**
 * What answer `choice` gives the voyage now (pure: the world is only read). Taking the survivors
 * aboard or ashore joins them to the voyage; with the salvage (and with them, as Fínán's gift) the
 * cask adds Book 10 caskStoresRd to the stores and the iron its lots (a fact for later stages);
 * left on the reef, they live if the next day's wind is below Book 10 leftTakenOffBelow. The voyage
 * always goes on (`CONTINUE`): the wreck is no gate.
 */
export function wreckResult(
  world: WorldState,
  ctx: SeaWreckContext,
  choice: WreckChoice,
): WreckOutcome {
  const b = ctx.b;
  const rescued = choice === 'ABOARD' || choice === 'ASHORE';
  const goods = rescued || choice === 'SALVAGE';
  const ids = ctx.def.survivors.map((s) => s.id);
  const lives = windTomorrow(world) < b.leftTakenOffBelow;
  const survivors: WreckOutcome['survivors'] = rescued
    ? choice
    : lives
      ? 'TAKEN_OFF'
      : 'DROWNED';
  const word: string =
    choice === 'ASHORE'
      ? 'SAVED'
      : rescued
        ? 'NONE'
        : !lives
          ? 'NONE'
          : choice === 'SALVAGE'
            ? 'ROBBED'
            : 'LEFT';
  const overloaded = rescued ? Math.max(0, ids.length - freeBerths(world, ctx)) : 0;
  const day = world.calendar.day;
  const facts: Record<string, FactValue> = {
    [WRECK_FACTS.choice]: choice,
    [WRECK_FACTS.survivors]: survivors,
    [WRECK_FACTS.iron]: goods ? b.ironLots : 0,
    [WRECK_FACTS.cask]: goods,
    [WRECK_FACTS.goods]: rescued ? 'GIVEN' : goods ? 'TAKEN' : 'NONE',
    [WRECK_FACTS.word]: word,
    [WRECK_FACTS.warned]: choice === 'ASHORE',
    [WRECK_FACTS.overloaded]: overloaded,
    [WRECK_FACTS.done]: day,
  };
  if (word !== 'NONE') facts[WRECK_FACTS.wordDay] = day + (choice === 'ASHORE' ? 0 : 1) + b.wordDays;
  return {
    choice,
    survivors,
    overloaded,
    textKey: ctx.def.done[choice] ?? '',
    result: {
      outcome: 'CONTINUE',
      facts,
      aboardChanges: { join: rescued ? ids : [], leave: [] },
      storesDelta: goods ? b.caskStoresRd : 0,
    },
  };
}

/** A survivor as a person of the world (Book 5 section 01): the person model, outside the roster. */
function survivorPerson(ctx: SeaWreckContext, s: WreckSurvivorDef, day: number) {
  const def: PersonDef = {
    id: s.id,
    // Refugees are outside the roster (Book 1 section 01); the person model is the residents'
    // (Book 5 section 02, "Generated residents"), so the person is made as one and is then alive,
    // not missing, and is never in the household's residents (decision S13-44).
    kind: 'RESIDENT',
    nameKey: s.nameKey,
    values: s.values,
    origin: s.origin,
    codes: s.codes,
    codeStance: s.codeStance,
    traits: s.traits,
    ties: (s.ties ?? []).map((t) => ({ to: t.to, kind: t.kind })),
  };
  const p = newPerson(def, ctx.vitality, ctx.balance);
  p.status = s.wound === undefined ? 'alive' : 'wounded';
  if (s.wound !== undefined) p.wounds.push({ day, severity: s.wound.severity, where: s.wound.where });
  return p;
}

/**
 * Ends the wreck once its words have played: writes the deeds (a rescue, or a theft from the
 * living, judged by the crew aboard who saw it), the crew's memory of the voices left behind,
 * survivors taken aboard as people of the world, then ends the scene (the steerer back aboard).
 * Returns the outcome; its `result` is sent as `SEA_HANDOFF_RETURN`. Null if not ready.
 */
export function finishWreck(
  world: WorldState,
  ctx: SeaWreckContext,
  emit: PeopleEmit = () => undefined,
): WreckOutcome | null {
  if (!wreckReady(world, ctx)) return null;
  const choice = world.facts[WRECK_FACTS.choice] as WreckChoice;
  const outcome = wreckResult(world, ctx, choice);
  const crew = [...(world.sea.voyage?.aboard ?? [])];
  const ids = ctx.def.survivors.map((s) => s.id);
  const placeId = ctx.def.zone;
  if (ctx.people !== null) {
    if (choice === 'ABOARD' || choice === 'ASHORE')
      householdDeed(world, ctx.people, { tag: 'RESCUE', placeId, victims: ids }, crew, emit);
    else if (choice === 'SALVAGE')
      householdDeed(world, ctx.people, { tag: 'THEFT', placeId, victims: ids }, crew, emit);
  }
  if (choice === 'SALVAGE' || choice === 'LEAVE') remember(world, crew, 'WRECK_LEFT');
  for (const id of outcome.result.aboardChanges.join) {
    const s = ctx.survivors.get(id);
    if (s !== undefined && world.people[id] === undefined)
      world.people[id] = survivorPerson(ctx, s, world.calendar.day);
  }
  // The facts are the result's to set (the voyage sets them); `done` now, so this runs once.
  setFact(world, WRECK_FACTS.done, world.calendar.day);
  endHandoffScene(world);
  return outcome;
}

/** Each tick on the reef: a survivor standing or lying turns to look at the steerer near them. */
export function stepWreck(world: WorldState, ctx: SeaWreckContext, tile: number): void {
  const onFoot = world.onFoot;
  if (onFoot === null || !inWreck(world, ctx)) return;
  const p = onFoot.player;
  for (const s of ctx.def.survivors) {
    const a = onFoot.actors[s.id];
    // Fínán keeps hold of the hull; the carried are turned by their carrier.
    if (a === undefined || a.pose !== 'watch') continue;
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    if (Math.hypot(dx, dy) > 6 * tile) {
      a.facing = s.at.facing;
      continue;
    }
    a.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
  }
}
