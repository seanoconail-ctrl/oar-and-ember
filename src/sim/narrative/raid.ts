/**
 * A reason for the first raid (the user's request; decisions DH-130 to DH-159; Book 4 section 08,
 * "Needs before aims"; Book 6 sections 02 and 18; Book 8 sections 05 and 07 to 09; Book 10
 * section 22, "Reasons for the first raid").
 *
 * - **Needs felt and spoken.** The household lacks iron, grain, cloth and salt from day 1. Each is
 *   felt while its store is under Book 10's "enough" (`need.felt.<NEED>` facts, which the talk
 *   topics read). Now and then a resident in earshot says so, in their own voice and tied to what
 *   they are doing (`needBarkTick`): never two need lines within needLineGap, never more than
 *   needLinesPerDay a day, and under Book 8's bark rules. The morning report counts the grain down
 *   (with the days to the autumn storms every stormsEvery mornings) and notes the one thing that
 *   ran low (`needReportLines`). Grain is food: the ship's meal-sack is put among the salvage once,
 *   and the morning porridge is eaten from it (src/sim/home/camp.ts, grainShare).
 * - **The mainland pointed out.** At the Hag's Seat on a clear day, someone of the household (or
 *   Runa, still sitting there) points out the smoke and fields on the Irish coast, once.
 * - **Carrick's clues** (`addClue`): Thorkel's chart, which Oddi keeps and reads; the scavengers'
 *   skin boat and its Carrick-marked sack; a scavenger asked where they came from; the smoke seen.
 *   Each writes `carrick.clue.<SOURCE>`, and what the sources tell between them is kept as
 *   `carrick.intel.<ITEM>` (RUMOUR, or LIKELY from Book 10's likelyFrom sources), for Stage 15.
 * - **The skin boat** (the skiff in Seal Cave): looked into, it shows the goods and their mark;
 *   taken, the goods are one load carried home, and set down by the fire they go into the stores.
 * - **The council at the fire** before the launch: called at the fire once the launch's gate is
 *   open, the household walks to the fire, each speaks their counsel, and the steerer chooses the
 *   intent (`ch1.council`), which everyone present remembers; the launch waits for it.
 *
 * Pure and deterministic: no random stream is drawn here; the state is in facts and the stores.
 */
import type { Content, SearchTalkDef, TalkDef, TopicDef } from '../../content/registry.ts';
import type { RaidBalance } from '../../content/raidBalance.ts';
import { parseRaidBalance } from '../../content/raidBalance.ts';
import { CLUE_SOURCES, INTENTS, NEEDS } from '../../content/raidSchema.ts';
import type {
  AimCondition,
  ClueSource,
  Intent,
  Need,
  NeedBark,
  NeedLow,
  RaidDef,
  Special,
} from '../../content/raidSchema.ts';
import type { Id } from '../../core/ids.ts';
import { parsePeopleBalance } from '../../content/peopleBalance.ts';
import type { CampContext, PlacedUse } from '../home/camp.ts';
import { FACT_AT_BROCH } from '../home/camp.ts';
import { appendDeed, setFact } from '../ledger/ledger.ts';
import { beatenOf } from '../land/fight.ts';
import type { LandContext, OnFootActor } from '../land/onFoot.ts';
import { TICKS_PER_SECOND } from '../land/onFoot.ts';
import { findActor, placeActor } from '../land/zoneLinks.ts';
import type { ZoneMap } from '../land/zoneMap.ts';
import type { PeopleContext } from '../people/context.ts';
import { clampMeasures } from '../people/measures.ts';
import { stepResident } from '../people/residents.ts';
import { activityOf } from '../people/schedule.ts';
import { LINE_SECONDS } from '../people/talk.ts';
import type { ReportLine, WorldState } from '../world.ts';
import { holds } from './aims.ts';
import { GATE_LAUNCH } from './gates.ts';
import { stoneWeeps } from './searches.ts';
import { fightNear } from './wreck.ts';

export type { Intent, Need };

/** The household's intent, chosen at the council (QUIET, THREAT, TRADE or FORCE). */
export const FACT_COUNCIL = 'ch1.council';
/** The launch waits for the council (set while content/raid.json is loaded). */
export const FACT_COUNCIL_REQUIRED = 'council.required';
/** The launch's gate is open and the council not yet held (the council's aim opens on it). */
export const FACT_COUNCIL_OPEN = 'council.open';
const FACT_STAGE = 'council.stage';
const FACT_SINCE = 'council.since';
/** The skin boat's goods: in the boat (unset), TAKEN (a load), CAMP (in the stores). */
export const FACT_GOODS = 'carrick.goods';
/** How the goods were come by: FOUND (no scavenger left), THEFT or FIGHT. */
export const FACT_GOODS_HOW = 'carrick.goods_how';
/** The mainland was pointed out from the Hag's Seat (the day). */
export const FACT_POINTED = 'raid.pointed';
const FACT_MEAL_SACK = 'need.meal_sack';
const FACT_RUNA_NAILS = 'need.runa_nails';
const FACT_LAST_LINE = 'need.last';
const FACT_CHEST_OPENED = 'ch1.chest_opened';

export const clueFact = (s: ClueSource): string => `carrick.clue.${s}`;
export const feltFact = (n: string): string => `need.felt.${n}`;
const lowFact = (id: string): string => `need.low.${id}`;
const catchFact = (day: number): string => `need.catch.${day}`;
const linesFact = (day: number): string => `need.lines.${day}`;

const WRECKERS = ['E_WRECKER_KETILL', 'E_WRECKER_SVART', 'E_WRECKER_CONN'] as const;
const CARRICK = 'SITE_CARRICK';
const HOME = 'ISLE_SKARV';

export interface RaidContext {
  readonly def: RaidDef;
  readonly b: RaidBalance;
  /** The talks this adds to the searches' (the skin boat, the council, a beaten scavenger). */
  readonly talks: readonly SearchTalkDef[];
  /** A choice added to a searches' or repairs' talk, by its id (asking where they came from). */
  readonly extraChoices: Readonly<Record<string, SearchTalkDef['choices'][number]>>;
  /** Book 10 section 08's bark rules (earshot, the same line and the same speaker). */
  readonly earshotTiles: number;
  readonly sameSpeakerSeconds: number;
  readonly sameLineSeconds: number;
  readonly barkEverySeconds: readonly [number, number];
}

export function raidContext(content: Pick<Content, 'raid' | 'balance'>): RaidContext | null {
  const def = content.raid;
  if (def === null) return null;
  const talk = parsePeopleBalance(content.balance).talk;
  return {
    def,
    b: parseRaidBalance(content.balance),
    talks: [def.skinBoat.talk, def.council.talk, ...Object.values(def.ask.beaten)].map(
      (t) => t as SearchTalkDef,
    ),
    extraChoices: def.ask.parleys,
    earshotTiles: talk.earshotTiles,
    sameSpeakerSeconds: talk.sameSpeakerSeconds,
    sameLineSeconds: talk.sameLineSeconds,
    barkEverySeconds: talk.barkEverySeconds,
  };
}

/** What the first raid's systems tell the rest of the game. */
export type RaidEvent =
  | { readonly type: 'SEARCH_INFO'; readonly key: string }
  | {
      readonly type: 'PERSON_SPOKE';
      readonly person: Id;
      readonly lineKey: string;
      readonly bark?: string;
    }
  /** A Carrick clue came in (Stage 15 reads the facts). */
  | { readonly type: 'CLUE_FOUND'; readonly source: ClueSource }
  /** The smoke on the Irish coast pointed out from the Hag's Seat. */
  | { readonly type: 'MAINLAND_POINTED'; readonly person: Id }
  /** The skin boat's goods set down by the fire: into the stores (their sound). */
  | { readonly type: 'GOODS_STORED' }
  /** The household called to the fire; the council held, with its intent. */
  | { readonly type: 'COUNCIL_CALLED' }
  | { readonly type: 'COUNCIL_HELD'; readonly intent: Intent };

export type RaidEmit = (e: RaidEvent) => void;

/** What the simulation does for the first raid's actions beyond them. */
export interface RaidHooks {
  /** Opens a talk by its id (the searches' startSearchTalk). */
  readonly openTalk: (id: string) => boolean;
  /** The fight at the cave starts now (the goods taken in sight). */
  readonly fight: () => void;
  /** The camp's fire (zone and tiles), where the council sits and the goods are stored. */
  readonly fire: { readonly zone: Id; readonly x: number; readonly y: number } | null;
}

// ----------------------------------------------------------------------------------------- needs

const mouthsOf = (world: WorldState): number => 1 + world.household.residents.length;

/** Days of grain left at the morning porridge for every mouth (Book 10 grainShare). */
export function grainDays(world: WorldState, ctx: RaidContext): number {
  const grain = world.homes[HOME]?.stores['RES_GRAIN'] ?? 0;
  const perDay = mouthsOf(world) * ctx.b.grainShare;
  return perDay <= 0 ? 0 : Math.floor(grain / perDay + 1e-9);
}

/** Whether a need is felt now (its store under Book 10's "enough"). */
export function needFelt(world: WorldState, ctx: RaidContext, need: Need): boolean {
  const stores = world.homes[HOME]?.stores ?? {};
  switch (need) {
    case 'GRAIN':
      return grainDays(world, ctx) < ctx.b.grainEnoughDays;
    case 'IRON':
      return (stores['RES_IRON'] ?? 0) < ctx.b.ironEnough;
    case 'CLOTH':
      return (stores['RES_CLOTH'] ?? 0) < ctx.b.clothEnough;
    case 'SALT':
      return (stores['RES_SALT'] ?? 0) < ctx.b.saltEnough;
  }
}

/** A day's catch, for the report's "poor day's fishing" (FISH_LANDED). */
export function noteCatch(world: WorldState, count: number): void {
  const key = catchFact(world.calendar.day);
  setFact(world, key, Number(world.facts[key] ?? 0) + count);
}

function caughtOn(world: WorldState, day: number): number {
  return Number(world.facts[catchFact(day)] ?? 0);
}

/** No clean linen: no bindings in hand or lying in view. */
function noLinen(world: WorldState): boolean {
  if ((world.player.inventory['ITEM_BINDING'] ?? 0) > 0) return false;
  return !(world.onFoot?.items ?? []).some((i) => i.item === 'ITEM_BINDING');
}

function anyWounded(world: WorldState): boolean {
  return world.household.residents.some((id) => (world.people[id]?.wounds.length ?? 0) > 0);
}

/** Whether a special condition holds now (`day`: the report's day, for yesterday's catch). */
function special(world: WorldState, ctx: RaidContext, s: Special, day: number): boolean {
  switch (s) {
    case 'POOR_CATCH': {
      const caught = caughtOn(world, day - 1);
      return caught > 0 && caught < ctx.b.poorCatch;
    }
    case 'CAUGHT':
      return caughtOn(world, day - 1) > 0 || caughtOn(world, day) > 0;
    case 'NO_LINEN':
      return noLinen(world);
    case 'WOUNDED_NO_LINEN':
      return noLinen(world) && anyWounded(world);
    case 'CHART':
      return world.facts[clueFact('CHART')] !== undefined;
  }
}

function lineFits(
  world: WorldState,
  ctx: RaidContext,
  line: {
    readonly need: Need;
    readonly special?: Special;
    readonly when?: readonly AimCondition[];
    readonly fromDay?: number;
  },
  day: number,
): boolean {
  if (!needFelt(world, ctx, line.need)) return false;
  if (line.fromDay !== undefined && day < line.fromDay) return false;
  if (line.special !== undefined && !special(world, ctx, line.special, day)) return false;
  return (line.when ?? []).every((c) => holds(world, c));
}

/**
 * The morning report's need lines (Book 10 reportNeedLines): the grain counted down, with the
 * days to the autumn storms on the first report and every stormsEvery mornings, and the one thing
 * that ran low (the first not yet reported whose conditions hold). Called on waking, after the
 * day's ration is served.
 */
export function needReportLines(world: WorldState, ctx: RaidContext): ReportLine[] {
  const lines: ReportLine[] = [];
  const day = world.calendar.day;
  const r = ctx.def.report;
  const grain = world.homes[HOME]?.stores['RES_GRAIN'] ?? 0;
  const days = grainDays(world, ctx);
  const first = world.facts['need.reported'] === undefined;
  const yearDay = ((day - 1) % 120) + 1;
  const toStorms = ctx.b.stormsAtDay - yearDay;
  const storms =
    toStorms > 0 &&
    (first || Number(world.facts['need.storms_day'] ?? 0) + ctx.b.stormsEveryDays <= day);
  if (grain <= 1e-9) lines.push({ key: r.grainNone, vars: {} });
  else if (days <= 1) lines.push({ key: r.grainOne, vars: {} });
  else if (storms) {
    lines.push({ key: r.storms, vars: { days, storms: toStorms } });
    setFact(world, 'need.storms_day', day);
  } else lines.push({ key: r.grainDays, vars: { days } });
  setFact(world, 'need.reported', day);
  if (lines.length >= ctx.b.reportNeedLines) return lines;
  const low = ctx.def.lows.find(
    (l: NeedLow) => world.facts[lowFact(l.id)] === undefined && lineFits(world, ctx, l, day),
  );
  if (low !== undefined) {
    setFact(world, lowFact(low.id), day);
    lines.push({ key: low.key, vars: { fish: caughtOn(world, day - 1) } });
  }
  return lines.slice(0, ctx.b.reportNeedLines);
}

/** A need line that could be said now: who, how far, which, and when they last said it. */
interface NeedChoice {
  readonly id: Id;
  readonly d: number;
  readonly bark: NeedBark;
  readonly said: number;
}

/**
 * The household's need lines (Book 8 section 08), each tick after the ordinary barks: a resident
 * in earshot, doing what a line is tied to, says one of theirs, at most one within needLineGap and
 * needLinesPerDay a day; never the same line from them within barkSameSpeaker or from anyone within
 * barkSameLine; the least recently said first (no random stream is drawn).
 */
export function needBarkTick(
  world: WorldState,
  ctx: RaidContext,
  camp: CampContext,
  people: PeopleContext,
  tile: number,
  emit: RaidEmit,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null || world.talk !== null || !world.player.awake) return;
  if (onFoot.player.sleep != null || world.facts[FACT_AT_BROCH] !== true) return;
  const tps = TICKS_PER_SECOND;
  const last = Number(world.facts[FACT_LAST_LINE] ?? -Infinity);
  if (world.tick - last < ctx.b.needLineGapSeconds * tps) return;
  const day = world.calendar.day;
  if (Number(world.facts[linesFact(day)] ?? 0) >= ctx.b.needLinesPerDay) return;
  if (fightNear(world)) return;
  // Never over the household's own exchange, nor straight over another speech line (Book 8).
  if (world.company?.exchange != null) return;
  if (world.company !== undefined && world.tick - world.company.lastSpeech < LINE_SECONDS * tps)
    return;
  const p = onFoot.player;
  let best: NeedChoice | null = null;
  for (const id of world.household.residents) {
    const a = onFoot.actors[id];
    const person = world.people[id];
    if (a === undefined || person === undefined || person.life.joinedDay === null) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y) / tile;
    if (d > ctx.earshotTiles) continue;
    const act = activityOf(world, camp, people, id).kind;
    if (act === 'SLEEP' || act === 'TALK' || act === 'SCENE' || act === 'BED') continue;
    // A need line is one of their barks: never sooner than Book 10's idleBarkEvery after their last.
    const theirs = Object.values(world.barks.bySpeaker[id] ?? {});
    const lastTheirs = theirs.length === 0 ? -Infinity : Math.max(...theirs);
    if (world.tick - lastTheirs < ctx.barkEverySeconds[0] * tps) continue;
    for (const bark of ctx.def.barks) {
      if (bark.speaker !== id) continue;
      if (bark.activity !== undefined && bark.activity !== act) continue;
      if (!lineFits(world, ctx, bark, day)) continue;
      const mine = world.barks.bySpeaker[id]?.[bark.key];
      if (mine !== undefined && world.tick - mine < ctx.sameSpeakerSeconds * tps) continue;
      const any = world.barks.byLine[bark.key];
      if (any !== undefined && world.tick - any < ctx.sameLineSeconds * tps) continue;
      const said = mine ?? -Infinity;
      if (best === null || said < best.said || (said === best.said && d < best.d))
        best = { id, d, bark, said };
    }
  }
  if (best === null) return;
  const mine = (world.barks.bySpeaker[best.id] ??= {});
  mine[best.bark.key] = world.tick;
  world.barks.byLine[best.bark.key] = world.tick;
  setFact(world, FACT_LAST_LINE, world.tick);
  setFact(world, linesFact(day), Number(world.facts[linesFact(day)] ?? 0) + 1);
  // Their ordinary barks wait a while after it, so two lines never come together.
  const speaker = world.people[best.id];
  if (speaker !== undefined)
    speaker.life.nextBark = Math.max(
      speaker.life.nextBark,
      world.tick + ctx.barkEverySeconds[0] * tps,
    );
  emit({ type: 'PERSON_SPOKE', person: best.id, lineKey: best.bark.key, bark: 'NEED' });
}

// ----------------------------------------------------------------------------------------- clues

const SOURCE_LIST: readonly ClueSource[] = CLUE_SOURCES;

/** The Carrick lead as the household knows it (Book 6 section 02, Lead and Known intel). */
export interface CarrickLead {
  /** A clue names Carrick (the chart, the boat's mark read against it, or a scavenger). */
  readonly named: boolean;
  readonly sources: readonly ClueSource[];
  /** What is told of it, each item a rumour or likely by how many sources tell it. */
  readonly intel: Readonly<Record<string, 'RUMOUR' | 'LIKELY'>>;
}

export function carrickLead(world: WorldState, ctx: RaidContext): CarrickLead {
  const sources = SOURCE_LIST.filter((s) => world.facts[clueFact(s)] !== undefined);
  const count = new Map<string, number>();
  // The boat's sack names Carrick only read against Thorkel's chart, or by Oddi, who knows the
  // storehouse's mark from the coast's trade (DH-138).
  const boatNames =
    world.facts[clueFact('CHART')] !== undefined || world.facts['carrick.boat_by'] === 'C_ODDI';
  for (const s of sources)
    for (const item of ctx.def.clues.tells[s] ?? []) {
      if (s === 'BOAT' && item === 'PLACE' && !boatNames) continue;
      count.set(item, (count.get(item) ?? 0) + 1);
    }
  const intel: Record<string, 'RUMOUR' | 'LIKELY'> = {};
  for (const [item, n] of count) intel[item] = n >= ctx.b.likelyFrom ? 'LIKELY' : 'RUMOUR';
  return { named: count.has('PLACE'), sources, intel };
}

/** Oddi, if at home, says it is on Thorkel's chart once a second source agrees (the user's ask). */
function oddiOwes(world: WorldState, key: string): void {
  const oddi = world.people['C_ODDI'];
  if (oddi === undefined || !world.household.residents.includes('C_ODDI')) return;
  if (!oddi.life.owed.includes(key)) oddi.life.owed.push(key);
}

/**
 * A Carrick clue came in: its fact, the intel the sources tell between them (for Stage 15), the
 * place rumoured on the household's knowledge, and Oddi's word from the chart.
 */
export function addClue(
  world: WorldState,
  ctx: RaidContext,
  source: ClueSource,
  emit: RaidEmit,
  by?: Id,
): void {
  if (world.facts[clueFact(source)] !== undefined) return;
  setFact(world, clueFact(source), world.calendar.day);
  if (by !== undefined) setFact(world, `carrick.${source.toLowerCase()}_by`, by);
  const lead = carrickLead(world, ctx);
  for (const [item, conf] of Object.entries(lead.intel))
    setFact(world, `carrick.intel.${item}`, conf);
  if (lead.named && world.knowledge.places[CARRICK] === undefined)
    world.knowledge.places[CARRICK] = 'RUMOURED';
  emit({ type: 'CLUE_FOUND', source });
  if (source === 'CHART') oddiOwes(world, ctx.def.clues.chart.key);
  // Oddi's chart confirms it: the chart and one more source that names the place.
  const chart = world.facts[clueFact('CHART')] !== undefined;
  const other = (['BOAT', 'TOLD'] as const).some((s) => world.facts[clueFact(s)] !== undefined);
  if (chart && other && world.facts['carrick.confirmed'] === undefined) {
    setFact(world, 'carrick.confirmed', world.calendar.day);
    oddiOwes(world, ctx.def.clues.confirm.key);
  }
}

// -------------------------------------------------------------------------------------- the boat

/** Whether the skin boat's goods are still in it. */
export function goodsInBoat(world: WorldState): boolean {
  return world.facts[FACT_GOODS] === undefined;
}

function wreckerHere(world: WorldState): { alive: Id[]; seen: Id[] } {
  const onFoot = world.onFoot;
  const alive: Id[] = [];
  const seen: Id[] = [];
  if (onFoot === null) return { alive, seen };
  for (const id of WRECKERS) {
    const a = onFoot.actors[id];
    if (a === undefined || world.people[id]?.status === 'dead') continue;
    if (a.fight?.dead != null || a.pose === 'dead') continue;
    alive.push(id);
    if (a.fight?.ai.aware === true) seen.push(id);
  }
  return { alive, seen };
}

/** A condition of the first raid's talk choices (registry.ts SEARCH_WHEN), or null if not ours. */
export function raidWhen(world: WorldState, when: string): boolean | null {
  return when === 'GOODS_THERE' ? goodsInBoat(world) && world.onFoot?.carrying == null : null;
}

// ------------------------------------------------------------------------------------ the uses

const ENEMY_FIGHTING = (a: OnFootActor): boolean => {
  const f = a.fight;
  if (f?.side !== 'ENEMY' || f.dead !== null || f.spared !== undefined) return false;
  if (beatenOf(f) !== null) return false;
  return f.ai.aware;
};

/** The uses in the zone in view: the skin boat, a beaten scavenger to ask, the council's call. */
export function raidPlacedUses(
  world: WorldState,
  ctx: RaidContext,
  map: ZoneMap,
  fire: RaidHooks['fire'],
): PlacedUse[] {
  const onFoot = world.onFoot;
  if (onFoot === null || world.talk !== null || onFoot.carrying !== null) return [];
  const out: PlacedUse[] = [];
  const T = map.tile;
  const d = ctx.def;
  if (map.zone === d.skinBoat.zone)
    out.push({
      use: { kind: 'SEARCH', site: d.skinBoat.talk.id, target: d.skinBoat.talk.with },
      x: d.skinBoat.look.x * T,
      y: d.skinBoat.look.y * T,
      reach: d.skinBoat.talk.reachTiles * T,
    });
  // A beaten scavenger (begging or downed), with no one else still fighting: ask them.
  const fighting = Object.values(onFoot.actors).some(ENEMY_FIGHTING);
  if (!fighting)
    for (const [id, talk] of Object.entries(d.ask.beaten)) {
      const a = onFoot.actors[id];
      const state = beatenOf(a?.fight);
      if (a === undefined || (state !== 'BEGGING' && state !== 'DOWNED')) continue;
      if (world.facts[clueFact('TOLD')] !== undefined && world.facts['carrick.told_by'] === id)
        continue;
      out.push({
        use: { kind: 'SEARCH', site: talk.id, target: id },
        x: a.x,
        y: a.y,
        reach: talk.reachTiles * T,
      });
    }
  // The council's call at the fire, once the launch's gate is open.
  if (
    fire !== null &&
    map.zone === fire.zone &&
    world.facts[FACT_COUNCIL_OPEN] === true &&
    world.facts[FACT_STAGE] === undefined &&
    !fightNear(world)
  )
    out.push({
      use: { kind: 'SEARCH', site: d.council.talk.id, target: d.council.talk.with },
      x: d.council.call.x * T,
      y: d.council.call.y * T,
      reach: ctx.b.councilReachTiles * T,
    });
  return out;
}

/**
 * A use of ours chosen (Interact): the council's call gathers the household instead of opening the
 * talk (true: handled, the talk is not to be opened); the skin boat's words, once opened, say what
 * is in it (false: open the talk as usual first).
 */
export function raidUseFirst(
  world: WorldState,
  ctx: RaidContext,
  site: string,
  emit: RaidEmit,
): boolean {
  if (site !== ctx.def.council.talk.id) return false;
  if (world.facts[FACT_COUNCIL_OPEN] !== true || world.facts[FACT_STAGE] !== undefined) return true;
  setFact(world, FACT_STAGE, 'GATHER');
  setFact(world, FACT_SINCE, world.tick);
  emit({ type: 'COUNCIL_CALLED' });
  return true;
}

/** After a talk of ours opened: the skin boat's goods described, and its clue. */
export function raidTalkOpened(
  world: WorldState,
  ctx: RaidContext,
  site: string,
  emit: RaidEmit,
): void {
  const talk = world.talk;
  if (talk === null || site !== ctx.def.skinBoat.talk.id) return;
  const info = ctx.def.skinBoat.info;
  if (!goodsInBoat(world)) {
    talk.queue.push({ speaker: '', key: info.empty });
    return;
  }
  talk.queue.push({ speaker: '', key: info.sack });
  const chart = world.facts[clueFact('CHART')] !== undefined;
  talk.queue.push({ speaker: '', key: chart ? info.mark : info.unmarked });
  talk.queue.push({ speaker: '', key: info.nails });
  addClue(world, ctx, 'BOAT', emit);
}

/** A choice of ours in a talk (registry.ts SEARCH_ACTIONS from raidSchema.ts RAID_ACTIONS). */
export function raidAction(
  world: WorldState,
  ctx: RaidContext,
  action: string,
  speaker: Id,
  hooks: RaidHooks,
  emit: RaidEmit,
): void {
  const talk = world.talk;
  if (action === 'ASK_HOME') {
    setFact(world, 'carrick.told_by', speaker);
    addClue(world, ctx, 'TOLD', emit, speaker);
    return;
  }
  if (action === 'TAKE_GOODS') {
    takeGoods(world, ctx, hooks, emit);
    if (talk !== null) talk.ending = true;
    return;
  }
  const intent = INTENTS.find((i) => action === `COUNCIL_${i}`);
  if (intent !== undefined) holdCouncil(world, ctx, intent, emit);
}

/**
 * The goods taken from the skin boat: one load at the steerer's feet. With a scavenger alive by
 * it, a theft (seen, the fight is on); with none, found.
 */
function takeGoods(world: WorldState, ctx: RaidContext, hooks: RaidHooks, emit: RaidEmit): void {
  const onFoot = world.onFoot;
  if (onFoot === null || !goodsInBoat(world)) return;
  const { alive, seen } = wreckerHere(world);
  const battle = onFoot.battle ?? null;
  const how = battle?.engaged === true ? 'FIGHT' : alive.length === 0 ? 'FOUND' : 'THEFT';
  if (how === 'THEFT')
    appendDeed(world, {
      id: `DEED_${world.ledger.length + 1}`,
      tag: 'THEFT',
      day: world.calendar.day,
      placeId: ctx.def.skinBoat.zone,
      doer: 'HOUSEHOLD',
      context: { item: ctx.def.skinBoat.goods, seen: seen.length > 0 },
      victims: [...alive],
      witnesses: seen.map((person) => ({ person, escaped: false })),
      identification: seen.length > 0 ? 1 : 0,
      marksSeen: [],
    });
  setFact(world, FACT_GOODS, 'TAKEN');
  setFact(world, FACT_GOODS_HOW, how);
  const p = onFoot.player;
  placeActor(onFoot, ctx.def.skinBoat.goods, onFoot.zone, {
    x: p.x + 10,
    y: p.y + 4,
    facing: 'e',
    pose: 'down',
  });
  addClue(world, ctx, 'BOAT', emit);
  if (how === 'THEFT' && seen.length > 0) hooks.fight();
}

/** The goods set down: by the camp fire, into the stores. Returns whether it was ours. */
export function raidSetDown(
  world: WorldState,
  ctx: RaidContext,
  target: Id,
  fire: RaidHooks['fire'],
  tile: number,
  emit: RaidEmit,
): boolean {
  const onFoot = world.onFoot;
  if (onFoot === null || target !== ctx.def.skinBoat.goods) return false;
  const a = onFoot.actors[target];
  if (a === undefined) return true;
  a.pose = 'down';
  if (onFoot.zone !== fire?.zone) return true;
  if (Math.hypot(a.x - fire.x * tile, a.y - fire.y * tile) > ctx.b.goodsCampTiles * tile)
    return true;
  const home = world.homes[HOME];
  if (home === undefined) return true;
  const add = (k: string, n: number): void => {
    home.stores[k] = (home.stores[k] ?? 0) + n;
  };
  add('RES_GRAIN', ctx.b.carrickSackRd);
  add('RES_NAILS', ctx.b.carrickNails);
  add('RES_NET', ctx.b.carrickNet);
  onFoot.actors = Object.fromEntries(Object.entries(onFoot.actors).filter(([k]) => k !== target));
  setFact(world, FACT_GOODS, 'CAMP');
  emit({ type: 'GOODS_STORED' });
  emit({ type: 'SEARCH_INFO', key: ctx.def.skinBoat.storedCaption });
  const p = onFoot.player;
  const by = ctx.def.skinBoat.stored.find((s) => {
    const r = onFoot.actors[s.person];
    return (
      world.household.residents.includes(s.person) &&
      r !== undefined &&
      Math.hypot(r.x - p.x, r.y - p.y) <= ctx.earshotTiles * tile
    );
  });
  if (by !== undefined) emit({ type: 'PERSON_SPOKE', person: by.person, lineKey: by.key });
  return true;
}

// ----------------------------------------------------------------------------------- the council

/** The household's intent, if the council has been held. */
export function councilIntent(world: WorldState): Intent | null {
  const v = world.facts[FACT_COUNCIL];
  return INTENTS.find((i) => i === v) ?? null;
}

/** Whether the council holds this resident (walking to the fire, or sitting at it). */
export function raidHolds(world: WorldState, ctx: RaidContext | null, id: Id): boolean {
  if (ctx === null || world.facts[FACT_STAGE] === undefined) return false;
  return world.household.residents.includes(id);
}

/** Who is at the council: residents in the fire's zone within twice the reach of it. */
function atCouncil(
  world: WorldState,
  ctx: RaidContext,
  fire: NonNullable<RaidHooks['fire']>,
): Id[] {
  const onFoot = world.onFoot;
  if (onFoot?.zone !== fire.zone) return [];
  return world.household.residents.filter((id) => {
    const a = onFoot.actors[id];
    return (
      a !== undefined &&
      a.pose !== 'down' &&
      a.pose !== 'dead' &&
      Math.hypot(a.x - fire.x * 24, a.y - fire.y * 24) <= ctx.b.councilReachTiles * 2 * 24
    );
  });
}

function holdCouncil(world: WorldState, ctx: RaidContext, intent: Intent, emit: RaidEmit): void {
  const talk = world.talk;
  if (councilIntent(world) !== null) return;
  const present = (world.facts['council.present'] as string | undefined)?.split(',') ?? [];
  const def = ctx.def.council.intents[intent];
  setFact(world, FACT_COUNCIL, intent);
  setFact(world, 'council.day', world.calendar.day);
  setFact(world, FACT_STAGE, 'DONE');
  for (const id of present) {
    const p = world.people[id];
    if (p === undefined) continue;
    // Everyone present remembers what was said, and what was chosen (Book 5 section 01).
    p.memories.push({
      day: world.calendar.day,
      kind: 'EVENT',
      about: `COUNCIL_${intent}`,
      source: 'SAW',
    });
    const said = ctx.def.council.counsel.find((c) => c.person === id)?.says;
    if (said !== undefined) setFact(world, `council.said.${id}`, said);
    const heard = def?.heard.includes(id) === true;
    const overruled = def?.overruled.includes(id) === true;
    setFact(world, `council.heard.${id}`, heard ? 'HEARD' : overruled ? 'OVERRULED' : 'NEITHER');
    if (heard) p.friendship += ctx.b.councilHeard;
    if (overruled) p.friendship += ctx.b.councilOverruled;
    clampMeasures(p);
    const reaction = def?.reactions[id];
    if (talk !== null && reaction !== undefined) talk.queue.push({ speaker: id, key: reaction });
  }
  if (talk !== null) talk.ending = true;
  setFact(world, FACT_COUNCIL_OPEN, false);
  emit({ type: 'COUNCIL_HELD', intent });
}

/** The council's lines, queued as it begins: each present resident's counsel, then Hild's ask. */
function beginCouncil(
  world: WorldState,
  ctx: RaidContext,
  present: readonly Id[],
  hooks: RaidHooks,
  emit: RaidEmit,
): boolean {
  if (!hooks.openTalk(ctx.def.council.talk.id)) return false;
  const talk = world.talk;
  if (talk === null) return false;
  setFact(world, 'council.present', present.join(','));
  const boatKnown = world.facts[clueFact('BOAT')] !== undefined;
  const chart = world.facts[clueFact('CHART')] !== undefined;
  for (const c of ctx.def.council.counsel) {
    if (!present.includes(c.person)) continue;
    if (c.when === 'CHART' && !chart) continue;
    if (c.when === 'NO_CHART' && chart) continue;
    if (c.when === 'NO_BOAT') {
      // Oddi went through their boat: the clue reaches the council whatever the fight's outcome.
      if (boatKnown) continue;
      addClue(world, ctx, 'BOAT', emit, c.person);
    }
    talk.queue.push({ speaker: c.person, key: c.key });
  }
  const asker = ctx.def.council.talk.with;
  talk.queue.push({ speaker: present.includes(asker) ? asker : '', key: ctx.def.council.ask });
  setFact(world, FACT_STAGE, 'TALK');
  return true;
}

// ------------------------------------------------------------------------------------- the step

/**
 * One tick: the meal-sack and Runa's nails put in the stores once; the needs felt; Thorkel's chart
 * read once his chest is open; the mainland pointed out; the council's gate kept, its gathering
 * walked and begun.
 */
export function stepRaid(
  world: WorldState,
  ctx: RaidContext,
  land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  tidalGroundOpen: boolean,
  hooks: RaidHooks,
  emit: RaidEmit,
): void {
  const home = world.homes[HOME];
  if (home !== undefined && world.facts[FACT_MEAL_SACK] === undefined) {
    // The ship's meal-sack among the salvage (Book 10 wreckGrain; decision DH-131).
    home.stores['RES_GRAIN'] = (home.stores['RES_GRAIN'] ?? 0) + ctx.b.wreckGrainRd;
    setFact(world, FACT_MEAL_SACK, true);
  }
  if (
    home !== undefined &&
    world.facts[FACT_RUNA_NAILS] === undefined &&
    world.household.residents.includes('C_RUNA')
  ) {
    home.stores['RES_NAILS'] = (home.stores['RES_NAILS'] ?? 0) + ctx.b.runaNails;
    setFact(world, FACT_RUNA_NAILS, true);
  }
  if (world.facts[FACT_COUNCIL_REQUIRED] !== true) setFact(world, FACT_COUNCIL_REQUIRED, true);
  // The needs felt, for the talk topics (only written when they change).
  for (const n of NEEDS) {
    const felt = needFelt(world, ctx, n);
    if (world.facts[feltFact(n)] !== felt) setFact(world, feltFact(n), felt);
  }
  const carrick = world.facts[clueFact('CHART')] !== undefined;
  if (world.facts[feltFact('CARRICK')] !== carrick) setFact(world, feltFact('CARRICK'), carrick);
  // Thorkel's chart, from his opened chest: Oddi keeps it and reads it.
  if (world.facts[FACT_CHEST_OPENED] === true && world.facts[clueFact('CHART')] === undefined)
    addClue(world, ctx, 'CHART', emit);
  // The council's gate: open with the launch's, until it is held.
  const gateOpen = world.gates[GATE_LAUNCH]?.status === 'OPEN';
  const open = gateOpen && councilIntent(world) === null;
  if ((world.facts[FACT_COUNCIL_OPEN] === true) !== open) setFact(world, FACT_COUNCIL_OPEN, open);
  pointOut(world, ctx, emit);
  stepCouncil(world, ctx, land, tidalGroundOpen, hooks, emit);
}

/** The smoke and fields on the Irish coast, pointed out once from the Hag's Seat on a clear day. */
function pointOut(world: WorldState, ctx: RaidContext, emit: RaidEmit): void {
  const onFoot = world.onFoot;
  const po = ctx.def.pointOut;
  if (onFoot?.zone !== po.zone || world.facts[FACT_POINTED] !== undefined) return;
  if (world.talk !== null || !world.player.awake || onFoot.player.sleep != null) return;
  const m = world.calendar.minuteOfDay;
  if (m < ctx.b.pointOutFrom || m > ctx.b.pointOutUntil) return;
  // A clear day: the Cailleach's weather gone from the stone (Stage 13 adds the day's weather).
  if (stoneWeeps(world) || fightNear(world)) return;
  const p = onFoot.player;
  for (const s of po.speakers) {
    const a = onFoot.actors[s.person];
    if (a === undefined || world.people[s.person]?.status === 'dead') continue;
    if (a.pose === 'down' || a.pose === 'dead' || a.pose === 'carried' || a.pose === 'sleep')
      continue;
    if (Math.hypot(a.x - p.x, a.y - p.y) > ctx.b.pointOutTiles * 24) continue;
    a.facing = po.facing;
    setFact(world, FACT_POINTED, world.calendar.day);
    emit({ type: 'SEARCH_INFO', key: po.caption });
    emit({ type: 'PERSON_SPOKE', person: s.person, lineKey: s.key });
    emit({ type: 'MAINLAND_POINTED', person: s.person });
    addClue(world, ctx, 'SEEN', emit, s.person);
    return;
  }
}

function stepCouncil(
  world: WorldState,
  ctx: RaidContext,
  land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  tidalGroundOpen: boolean,
  hooks: RaidHooks,
  emit: RaidEmit,
): void {
  const stage = world.facts[FACT_STAGE];
  const onFoot = world.onFoot;
  const fire = hooks.fire;
  if (stage === undefined || onFoot === null || fire === null) return;
  if (stage === 'DONE') {
    // The talk over, everyone back to their day.
    if (world.talk === null) Reflect.deleteProperty(world.facts, FACT_STAGE);
    return;
  }
  // The steerer gone from the camp before it begins: the call lapses.
  if (stage === 'GATHER' && onFoot.zone !== fire.zone) {
    Reflect.deleteProperty(world.facts, FACT_STAGE);
    return;
  }
  const c = ctx.def.council;
  const T = 24;
  let arrived = 0;
  world.household.residents.forEach((id, i) => {
    const spot = c.spots[i % c.spots.length];
    if (spot === undefined) return;
    stepResident(
      onFoot,
      id,
      { zone: c.zone, x: spot.x * T, y: spot.y * T, facing: spot.facing, pose: 'sit' },
      land.maps,
      land,
      tidalGroundOpen,
    );
    const a = findActor(onFoot, id);
    if (
      a !== null &&
      a.zone === c.zone &&
      Math.hypot(a.actor.x - spot.x * T, a.actor.y - spot.y * T) < 6
    )
      arrived++;
  });
  if (stage !== 'GATHER') return;
  const waited = world.tick - Number(world.facts[FACT_SINCE] ?? world.tick);
  const all = arrived >= world.household.residents.length;
  if (!all && waited < ctx.b.councilGatherSeconds * TICKS_PER_SECOND) return;
  if (world.talk !== null) return;
  beginCouncil(world, ctx, atCouncil(world, ctx, fire), hooks, emit);
}

/** Tests and tools: the camp fire from the camp's content (zone and tiles). */
export function campFire(camp: CampContext | null): RaidHooks['fire'] {
  const site = camp?.def.sites.find((s) => s.kind === 'FIRE');
  return site === undefined ? null : { zone: site.zone, x: site.x, y: site.y };
}

/** Whether a balance has the first raid's table (tests may give a trimmed one). */
export function hasRaidBalance(balance: unknown): boolean {
  const t = (balance as { tables?: Record<string, Record<string, unknown>> } | null)?.tables;
  return Array.isArray(t?.['storyGates']?.['reasonsForTheFirstRaid']);
}

/**
 * The household's talk with the first raid's need topics added (memory NEED, offered while the
 * need is felt: src/sim/people/talk.ts reads `need.felt.<about>`), and their nodes.
 */
export function withNeedTopics(talk: TalkDef | null, raid: RaidDef | null): TalkDef | null {
  if (talk === null || raid === null) return talk;
  const topics: TopicDef[] = raid.topics.map((t) => ({
    id: t.id,
    speaker: t.speaker,
    memory: 'NEED',
    about: t.about,
    priority: t.priority,
    labelKey: t.labelKey,
    root: t.root,
  }));
  return {
    ...talk,
    topics: [...talk.topics.filter((t) => !topics.some((m) => m.id === t.id)), ...topics],
    nodes: { ...talk.nodes, ...(raid.nodes as TalkDef['nodes']) },
  };
}
