/**
 * Design addendum 2.4's opening of Chapter 1 (Book 4 section 08, beats 1 to 15; Book 6 section 18;
 * Book 9 sections 03 and 04; Book 10 section 25; decisions DE-16 to DE-30):
 *
 * - **The cold open** (beat 1), played: night and storm aboard Thorkel's boat, the steerer at the
 *   steering oar (MOVE steers it from the first tick), Thorkel shouting from the bow; the strike on
 *   the skerry, black, then the waking. The calendar does not run during it.
 * - **Waking in the surf** (beat 2): the steerer lies coughing until the first input gets them up.
 * - **Hild in the net** (beats 3 to 5): she calls from the shallows; reached without a blade she
 *   says so; with one, a hold-to-cut frees her (progress kept if let go), then she is carried.
 * - **Thorkel's chest** (beat 6), placed in the wash once she is reached and named by her once she
 *   is safe; carried to its home by the shelter, where it settles (its outline is presentation of
 *   this state); **his key** reaches the steerer however Bran's search ends; **opened** (beat 14),
 *   it gives his bow, a quiver, his chart fragment and his things.
 * - **The camp** opens when the steerer first reaches it; **Hild walks up** when the first fire is
 *   lit (she sees the smoke); **the shelter** is raised in one visible action (beats 7 to 9).
 * - **The first dusk** (beats 10 to 12): the Hag's light; the scavengers' fight is the combat code's
 *   (src/sim/land/fight.ts), and this module only waits for it to be over; then the first night's
 *   fire, Hild's grief and the morning's aims; the searches' people are placed at 19:00.
 * - **The bow's first use** (beat 15): an arrow through the stores' lashing on the broken mast
 *   drops the bundle into the shallows, carried up as one load.
 * - **Runa's chest** (decision DE-21) and **everyone rescued gets up** (decision DE-22).
 * - **The Hag's Stone's effect** (decision DE-28), timed here so it is deterministic.
 *
 * Every number is Book 10's (src/content/openingBalance.ts); places and lines are content
 * (content/opening.json `rework`). Pure and deterministic: no random stream is drawn here.
 */
import { BINDING } from '../land/fight.ts';
import type { OpeningBalance } from '../../content/openingBalance.ts';
import { parseOpeningBalance } from '../../content/openingBalance.ts';
import { parseStartingWeapons } from '../../content/balance.ts';
import { parsePeopleBalance } from '../../content/peopleBalance.ts';
import { parseSearchBalance } from '../../content/searchBalance.ts';
import type { CampDef, Content, OpeningDef } from '../../content/registry.ts';
import type { Id } from '../../core/ids.ts';
import { FACT_AT_BROCH, FACT_FIRE_LIT, homeOf } from '../home/camp.ts';
import type { CampContext, PlacedUse } from '../home/camp.ts';
import { setFact } from '../ledger/ledger.ts';
import { compass, NEEDS_LIFT, TICKS_PER_SECOND } from '../land/onFoot.ts';
import type { LandContext, OnFootActor, OnFootState, Projectile } from '../land/onFoot.ts';
import { flightAt } from '../land/missiles.ts';
import { findActor, placeActor } from '../land/zoneLinks.ts';
import type { ZoneMap } from '../land/zoneMap.ts';
import { stepResident } from '../people/residents.ts';
import type { WorldState } from '../world.ts';
import { FACT_HILD_SAFE, FACT_HILD_SAFE_AT } from './opening.ts';

export const FACT_PHASE = 'ch1.phase';
export const FACT_COLD_FROM = 'ch1.cold_from';
/** The steering oar in the cold open, -1 (hard to port) to 1 (hard to starboard). */
export const FACT_COLD_OAR = 'ch1.cold_oar';
export const FACT_WOKE_AT = 'ch1.woke_at';
export const FACT_GETTING_UP = 'ch1.getting_up';
export const FACT_HILD_REACHED = 'ch1.hild_reached';
/** Ticks of cutting done at the net (kept if the hold is let go). */
export const FACT_NET_CUT = 'ch1.net_cut';
export const FACT_NET_FREE = 'ch1.net_free';
export const FACT_NET_FREE_AT = 'ch1.net_free_at';
export const FACT_NO_BLADE_SAID = 'ch1.no_blade_at';
export const FACT_CHEST_PLACED = 'ch1.chest_placed';
export const FACT_CHEST_NAMED = 'ch1.chest_named';
export const FACT_CHEST_HOME = 'ch1.chest_home';
/** Where Thorkel's key came from: BRAN (at the bier) or BODY (taken from it). */
export const FACT_KEY = 'ch1.key';
export const FACT_CHEST_OPENED = 'ch1.chest_opened';
export const FACT_LASHING_CUT = 'ch1.lashing_cut';
/** The stores from the mast: WATER (fallen into the shallows) or CAMP (brought up). */
export const FACT_MAST_STORES = 'ch1.mast_stores';
export const FACT_HILD_WALKING = 'ch1.hild_walking_up';
export const FACT_HILD_WALKED_UP = 'ch1.hild_walked_up';
export const FACT_SHELTER_RAISED = 'ch1.shelter_raised';
export const FACT_OLD_BOAT_SAID = 'ch1.old_boat_said';
export const FACT_SEARCHES_PLACED = 'ch1.searches_placed';
export const FACT_DUSK_OVER = 'ch1.dusk_over';
export const FACT_HAG_LIGHT = 'ch1.hag_light';
export const FACT_FIRE_SCENE = 'ch1.fire_scene';
const FACT_FIRE_SCENE_ON = 'ch1.fire_scene_on';
const FACT_HAG_LIGHT_SEEN = 'ch1.hag_light_seen';
const FACT_MAST_LINE = 'ch1.mast_line';
/** Runa's tool chest set down safe: FIRE, SHELTER or BOAT; the place named; the lie found out. */
export const FACT_RUNA_TOOLS_AT = 'runa.tools_at';
export const FACT_RUNA_TOLD = 'runa.told';
const FACT_RUNA_TOLD_DAY = 'runa.told_day';
export const FACT_RUNA_ASKED = 'runa.asked';
export const FACT_RUNA_LIE_FOUND = 'runa.lie_found';
/** The Hag's Stone's effect: the tick it began, its hold (s), how many showings, this visit's. */
export const FACT_HAG_AT = 'hag.effect_at';
export const FACT_HAG_HOLD = 'hag.effect_hold';
export const FACT_HAG_SHOWINGS = 'hag.showings';
const FACT_HAG_VISIT = 'hag.visit';
/** From the searches (kept here as strings to keep the import graph one way). */
const FACT_SEARCH_TOLD = 'search.told';
const FACT_BRAN = 'search.bran';
const FACT_BODY = 'ch1.thorkel_body';
const STONE_SHEET = 'prop_hagstone';

export const TASK_CUT_NET = 'TASK_CUT_NET';
export const TASK_RAISE_SHELTER = 'TASK_RAISE_SHELTER';
const WRECK_TASKS = [TASK_CUT_NET, TASK_RAISE_SHELTER] as const;

export type WreckPhase = 'COLD_OPEN' | 'WAKING' | 'PLAY';

export type WreckWhat =
  | 'COLD_START'
  | 'COLD_SHOUT'
  | 'COLD_STRIKE'
  | 'COLD_BLACK'
  | 'WOKE'
  | 'GOT_UP'
  | 'NET_WAVE'
  | 'NET_CUT'
  | 'CHEST_PLACED'
  | 'LOAD_DOWN'
  | 'CHEST_HOME'
  | 'KEY_TAKEN'
  | 'CHEST_OPENED'
  | 'LASHING_CUT'
  | 'BUNDLE_SPLASH'
  | 'STORES_BROUGHT'
  | 'CAMP_REACHED'
  | 'SHELTER_RAISED'
  | 'RING_FOUND'
  | 'HAG_LIGHT'
  | 'HAG_HUSH'
  | 'HAG_COLD'
  | 'HAG_HOLD'
  | 'HAG_GUST'
  | 'HAG_SETTLE'
  | 'HAG_DONE'
  | 'RUNA_TRUTH'
  | 'RUNA_LIE'
  | 'RUNA_LIE_FOUND'
  | 'RESCUE_UP';

export type WreckEvent =
  | {
      readonly type: 'WRECK';
      readonly what: WreckWhat;
      readonly x?: number;
      readonly y?: number;
      readonly person?: Id;
      readonly item?: Id;
      readonly key?: string;
      readonly showing?: number;
    }
  | {
      readonly type: 'PERSON_SPOKE';
      readonly person: Id;
      readonly lineKey: string;
      readonly bark?: string;
    }
  | {
      readonly type: 'PERSON_CALLED';
      readonly person: Id;
      readonly lineKey: string;
      readonly direction: ReturnType<typeof compass>;
      readonly distanceTiles: number;
    }
  | { readonly type: 'TALK_STARTED'; readonly person: Id; readonly kind: 'SEARCH' };

export type WreckEmit = (e: WreckEvent) => void;

export type ReworkDef = OpeningDef['rework'];

export interface WreckContext {
  readonly def: OpeningDef;
  readonly rw: ReworkDef;
  readonly ob: OpeningBalance;
  readonly caller: Id;
  readonly startingArrows: number;
  /** Book 10 section 08's barkEarshot (tiles): a hint or line is heard this near. */
  readonly earshotTiles: number;
  /** Book 10 section 08's limp (tiles a second): a hurt rescued person walks home at it. */
  readonly limp: number;
  /** The camp's zone, its fire site and the shelter's place (content/camp.json). */
  readonly camp: {
    readonly zone: Id;
    readonly fire: { x: number; y: number };
    readonly shelter: { x: number; y: number };
  } | null;
  /** Bran's search: who, Thorkel's body, the bier. */
  readonly bran: { readonly person: Id; readonly body: Id } | null;
  /** The household's boat on the strand (Stage 11). */
  readonly boat: { readonly zone: Id; readonly x: number; readonly y: number } | null;
  /** The Hag's Seat's zone and the stone (tiles). */
  readonly stone: { readonly zone: Id; readonly x: number; readonly y: number } | null;
  /** The beds under the raised lean-to (content/camp.json shelterBeds), a fur on each. */
  readonly campBeds: readonly { readonly x: number; readonly y: number }[];
  /** Runa (her tool chest is ITEM_RUNA_TOOLS). */
  readonly runa: { readonly person: Id; readonly tools: Id } | null;
  /** The arm-ring's worth in silver (Book 10 section 04), and the item. */
  readonly ring: { readonly item: Id; readonly oz: number };
}

export function wreckContext(
  content: Pick<Content, 'opening' | 'balance' | 'camp' | 'searches' | 'repairs' | 'zoneMaps'>,
): WreckContext | null {
  const def = content.opening;
  if (def === null) return null;
  const camp: CampDef | null = content.camp;
  const fire = camp?.sites.find((s) => s.kind === 'FIRE');
  const s = content.searches;
  const hag = s === null ? undefined : content.zoneMaps.get(s.runa.zone);
  const stoneProp = hag?.props.find((p) => p.sheet === STONE_SHEET);
  const ringOz = ((): number => {
    const t = (
      content.balance as { tables?: Record<string, Record<string, Record<string, string>[]>> }
    ).tables?.['cargoTradeAndSilver']?.['cargoValues'];
    const v = t?.find((r) => r['Lot or item'] === 'Silver arm-ring')?.['Value'];
    if (v === undefined) throw new Error('balance.json: cargoValues has no "Silver arm-ring"');
    return Number(v);
  })();
  return {
    def,
    rw: def.rework,
    ob: parseOpeningBalance(content.balance),
    caller: def.caller,
    startingArrows: parseStartingWeapons(content.balance).startingArrows,
    earshotTiles: parsePeopleBalance(content.balance).talk.earshotTiles,
    limp: parseSearchBalance(content.balance).limpSpeed,
    camp:
      camp === null || fire === undefined
        ? null
        : {
            zone: camp.zone,
            fire: { x: fire.x, y: fire.y },
            shelter: { x: def.rework.camp.sail.x, y: def.rework.camp.sail.y },
          },
    bran: s === null ? null : { person: s.bran.person, body: s.bran.body.id },
    boat:
      content.repairs == null
        ? null
        : { zone: content.repairs.boat.zone, x: content.repairs.boat.x, y: content.repairs.boat.y },
    stone:
      s === null || stoneProp === undefined
        ? null
        : { zone: s.runa.zone, x: stoneProp.x, y: stoneProp.y - 0.4 },
    runa: s === null ? null : { person: s.runa.person, tools: s.runa.tools.id },
    campBeds: camp?.shelterBeds ?? [],
    ring: { item: 'ITEM_SILVER_ARM_RING', oz: ringOz },
  };
}

// ------------------------------------------------------------------------------------- phases

/** Sets the opening's phase in a new campaign: the cold open first, or awake on the strand. */
export function beginOpening(world: WorldState, coldOpen: boolean): void {
  beginFacts(world);
  if (coldOpen) {
    setFact(world, FACT_PHASE, 'COLD_OPEN');
    setFact(world, FACT_COLD_FROM, world.tick);
    setFact(world, FACT_COLD_OAR, 0);
    return;
  }
  setFact(world, FACT_PHASE, 'PLAY');
  setFact(world, FACT_WOKE_AT, world.tick);
}

/** Facts every world begun with the rework's opening starts with. */
function beginFacts(world: WorldState): void {
  setFact(world, FACT_SHELTER_RAISED, false);
}

/** The opening's phase (a world from before the rework is awake). */
export function wreckPhase(world: WorldState): WreckPhase {
  const p = world.facts[FACT_PHASE];
  return p === 'COLD_OPEN' || p === 'WAKING' ? p : 'PLAY';
}

/** The tick the steerer woke on the strand (0 in a world from before the rework). */
export function wokeAt(world: WorldState): number {
  const at = world.facts[FACT_WOKE_AT];
  return typeof at === 'number' ? at : 0;
}

/** Seconds into the cold open (null outside it). */
export function coldOpenSeconds(world: WorldState): number | null {
  if (wreckPhase(world) !== 'COLD_OPEN') return null;
  const from = world.facts[FACT_COLD_FROM];
  return (world.tick - (typeof from === 'number' ? from : 0)) / TICKS_PER_SECOND;
}

/**
 * A command while the opening holds the steerer: in the cold open MOVE steers the oar; waking,
 * any input gets the steerer up. Returns true when the command was the opening's (and is done).
 */
export function wreckCommand(
  world: WorldState,
  command: { readonly type: string; readonly x?: number; readonly y?: number },
): boolean {
  const phase = wreckPhase(world);
  if (phase === 'PLAY') return false;
  if (phase === 'COLD_OPEN') {
    if (command.type === 'MOVE') {
      const x = Math.max(-1, Math.min(1, command.x ?? 0));
      world.facts['ch1.cold_want'] = Math.round(x * 100) / 100;
    }
    return (
      command.type !== 'SET_OPTIONS' &&
      command.type !== 'SET_DAY_LENGTH' &&
      command.type !== 'TIME_HELD'
    );
  }
  // Waking: the first real input gets the steerer up (a MOVE with no direction is not input).
  const input =
    (command.type === 'MOVE' && ((command.x ?? 0) !== 0 || (command.y ?? 0) !== 0)) ||
    ['INTERACT', 'INTERACT_AT', 'USE_AT', 'SHOVE', 'SELECT_SLOT'].includes(command.type);
  if (input && world.facts[FACT_GETTING_UP] === undefined)
    setFact(world, FACT_GETTING_UP, world.tick);
  return (
    command.type !== 'SET_OPTIONS' &&
    command.type !== 'SET_DAY_LENGTH' &&
    command.type !== 'TIME_HELD' &&
    command.type !== 'MOVE'
  );
}

/**
 * The cold open and the waking, each tick. Returns true while the opening owns the tick: the
 * calendar does not run in the cold open, and the land is not stepped until the steerer is up.
 */
export function stepWreckPhase(
  world: WorldState,
  ctx: WreckContext,
  emit: WreckEmit,
): 'COLD' | 'WAKING' | null {
  const phase = wreckPhase(world);
  if (phase === 'PLAY') return null;
  const T = TICKS_PER_SECOND;
  if (phase === 'COLD_OPEN') {
    const c = ctx.rw.coldOpen;
    const from = Number(world.facts[FACT_COLD_FROM] ?? 0);
    const t = world.tick - from;
    if (t === 0) emit({ type: 'WRECK', what: 'COLD_START', key: c.captions['storm'] ?? '' });
    // The oar follows the hand over a third of a second.
    const want = Number(world.facts['ch1.cold_want'] ?? 0);
    const oar = Number(world.facts[FACT_COLD_OAR] ?? 0);
    const step = 1 / (T / 3);
    setFact(
      world,
      FACT_COLD_OAR,
      Math.round(Math.max(oar - step, Math.min(oar + step, want)) * 1000) / 1000,
    );
    if (
      t > 0 &&
      t % (c.shoutEverySeconds * T) === Math.round(T * 1.5) % (c.shoutEverySeconds * T) &&
      t < c.strikeSeconds * T
    ) {
      const n = Math.floor(t / (c.shoutEverySeconds * T));
      const line = c.shouts[n % c.shouts.length] ?? '';
      emit({ type: 'WRECK', what: 'COLD_SHOUT', key: line });
      emit({ type: 'PERSON_SPOKE', person: 'C_THORKEL', lineKey: line });
    }
    if (t === c.strikeSeconds * T)
      emit({ type: 'WRECK', what: 'COLD_STRIKE', key: c.captions['strike'] ?? '' });
    if (t === c.blackSeconds * T) emit({ type: 'WRECK', what: 'COLD_BLACK' });
    if (t >= c.seconds * T) {
      setFact(world, FACT_PHASE, 'WAKING');
      setFact(world, FACT_WOKE_AT, world.tick);
      emit({ type: 'WRECK', what: 'WOKE', key: ctx.rw.waking.coughCaption });
      return 'WAKING';
    }
    return 'COLD';
  }
  // Waking: lying coughing until the first input (or, with none, Book 10's firstInput).
  const woke = wokeAt(world);
  const since = world.tick - woke;
  if (
    world.facts[FACT_GETTING_UP] === undefined &&
    since >= ctx.ob.firstMinutes.firstInputSeconds * T
  )
    setFact(world, FACT_GETTING_UP, world.tick);
  const up = world.facts[FACT_GETTING_UP];
  if (typeof up === 'number' && world.tick - up >= ctx.rw.waking.getUpTicks) {
    setFact(world, FACT_PHASE, 'PLAY');
    emit({ type: 'WRECK', what: 'GOT_UP' });
    return null;
  }
  return 'WAKING';
}

// --------------------------------------------------------------------------------- helpers

const distTiles = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  tile: number,
): number => Math.hypot(a.x - b.x, a.y - b.y) / tile;

function steererHas(world: WorldState, item: Id): boolean {
  return world.player.hotbar.slots.includes(item) || (world.player.inventory[item] ?? 0) > 0;
}

/** Whether Hild is still caught in the net. */
/**
 * Who Interact goes to first while Hild is caught in the net: her (the cut, or her word that a
 * blade is needed), before Thorkel's chest or anything else nearer (decision DE-86).
 */
export function interactFirst(world: WorldState, ctx: WreckContext | null): Id | null {
  return ctx !== null && netted(world) ? ctx.caller : null;
}

export function netted(world: WorldState): boolean {
  return (
    world.facts[FACT_PHASE] !== undefined &&
    world.facts[FACT_NET_FREE] !== true &&
    world.facts[FACT_HILD_SAFE] !== true
  );
}

/** A blade the steerer has that can cut the net, or null. */
export function bladeOf(world: WorldState, ctx: WreckContext): Id | null {
  return ctx.rw.net.blades.find((b) => steererHas(world, b)) ?? null;
}

/** Whether a fight is under way, or a hostile is aware: the quiet things wait (Book 10 section 25). */
export function fightNear(world: WorldState): boolean {
  const onFoot = world.onFoot;
  if (onFoot === null) return false;
  const b = onFoot.battle ?? null;
  if (b !== null && b.engaged && !b.over) return true;
  return Object.values(onFoot.actors).some((a) => {
    const f = a.fight as
      | { side?: string; ai?: { aware?: boolean; awareness?: { state?: string } }; dead?: unknown }
      | undefined;
    if (f?.side !== 'ENEMY' || (f.dead ?? null) !== null) return false;
    return (
      f.ai?.aware === true ||
      (f.ai?.awareness?.state !== undefined && f.ai.awareness.state !== 'UNAWARE')
    );
  });
}

// ------------------------------------------------------------------------------- the strand

/**
 * One tick of the opening in play: Hild reached and the chest placed; her lines as they come due;
 * the camp reached; Hild's walk up; the old boat; the first dusk; the fire scene; the key; the
 * mast's line; the rescued getting up; Runa's lie found out; the Hag's Stone.
 */
export function stepWreck(
  world: WorldState,
  ctx: WreckContext,
  land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  tidalGroundOpen: boolean,
  emit: WreckEmit,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null || wreckPhase(world) !== 'PLAY') return;
  const map = land.maps.get(onFoot.zone);
  const tile = map?.tile ?? 24;
  const p = onFoot.player;
  const T = TICKS_PER_SECOND;
  const say = (person: Id, lineKey: string): void => {
    emit({ type: 'PERSON_SPOKE', person, lineKey });
  };
  const hild = findActor(onFoot, ctx.caller);
  // Hild reached in the net: the chest is placed, and without a blade she says so.
  if (hild !== null && hild.visible && netted(world) && distTiles(hild.actor, p, tile) <= 2.5) {
    if (world.facts[FACT_HILD_REACHED] !== true) {
      setFact(world, FACT_HILD_REACHED, true);
      placeChest(world, ctx, emit);
      if (bladeOf(world, ctx) === null) noBlade(world, ctx, emit);
    }
  }
  // A wave over her every few seconds while she is in the net (never harming her).
  if (hild !== null && netted(world)) {
    const every = ctx.ob.firstMinutes.netWaveSeconds * T;
    const since = world.tick - wokeAt(world);
    if (since > 0 && since % every === Math.round(every / 2)) {
      emit({
        type: 'WRECK',
        what: 'NET_WAVE',
        x: hild.actor.x,
        y: hild.actor.y,
        key: ctx.rw.net.captions['wave'] ?? '',
      });
      if (
        hild.visible &&
        distTiles(hild.actor, p, tile) <= 8 &&
        world.facts['ch1.wave_said'] !== true
      ) {
        setFact(world, 'ch1.wave_said', true);
        say(ctx.caller, ctx.rw.net.lines['wave'] ?? '');
      }
    }
  }
  // Cut free: her joke a moment after the relief.
  const freeAt = world.facts[FACT_NET_FREE_AT];
  if (typeof freeAt === 'number' && world.tick - freeAt === ctx.rw.net.jokeSeconds * T)
    say(ctx.caller, ctx.rw.net.lines['joke'] ?? '');
  // Safe above the tide line: a moment later, she names Thorkel's chest (once).
  const safeAt = world.facts[FACT_HILD_SAFE_AT];
  if (
    world.facts[FACT_CHEST_NAMED] !== true &&
    world.facts[FACT_CHEST_PLACED] === true &&
    typeof safeAt === 'number' &&
    world.tick - safeAt >= ctx.rw.chest.lineAfterSafeSeconds * T
  )
    nameChest(world, ctx, emit);
  // The camp reached for the first time: its work opens (decision DE-16).
  const camp = ctx.camp;
  if (
    camp !== null &&
    world.facts[FACT_AT_BROCH] !== true &&
    onFoot.zone === camp.zone &&
    distTiles(p, { x: camp.fire.x * tile, y: camp.fire.y * tile }, tile) <= ctx.rw.camp.reachTiles
  ) {
    setFact(world, FACT_AT_BROCH, true);
    emit({ type: 'WRECK', what: 'CAMP_REACHED' });
  }
  stepWalkUp(world, ctx, land, tidalGroundOpen, emit);
  // By the old boat with Hild near: the long goal in sight (beat 8).
  const boat = ctx.boat;
  if (
    boat !== null &&
    world.facts[FACT_OLD_BOAT_SAID] !== true &&
    onFoot.zone === boat.zone &&
    distTiles(p, { x: boat.x * tile, y: boat.y * tile }, tile) <= ctx.rw.camp.oldBoatTiles &&
    hild !== null &&
    hild.visible &&
    hild.actor.pose !== 'call' &&
    hild.actor.pose !== 'carried' &&
    distTiles(hild.actor, p, tile) <= ctx.earshotTiles &&
    world.talk === null
  ) {
    setFact(world, FACT_OLD_BOAT_SAID, true);
    say(ctx.caller, ctx.rw.camp.oldBoat);
  }
  // Residents who raised the S1 roof themselves have put a shelter up too.
  if (world.facts[FACT_SHELTER_RAISED] === false && camp !== null) {
    const stage = world.homes['ISLE_SKARV']?.stage;
    if (stage !== undefined && stage !== 'S0') setFact(world, FACT_SHELTER_RAISED, true);
  }
  stepDusk(world, ctx, emit);
  stepFireScene(world, ctx, emit);
  stepKey(world, ctx, emit);
  // The chest opened: a moment later Hild points to the stores on the mast (if she is near).
  if (world.facts[FACT_CHEST_OPENED] === true && world.facts[FACT_MAST_LINE] !== true) {
    const opened = Number(world.facts['ch1.chest_opened_at'] ?? world.tick);
    const h = findActor(onFoot, ctx.caller);
    if (
      world.tick - opened >= ctx.rw.mast.lineAfterSeconds * T &&
      world.talk === null &&
      h?.visible === true &&
      distTiles(h.actor, p, tile) <= ctx.earshotTiles
    ) {
      setFact(world, FACT_MAST_LINE, true);
      say(ctx.caller, ctx.rw.mast.line);
    }
  }
  stepRescues(world, ctx);
  stepRunaLie(world, ctx, land, emit);
  stepHagStone(world, ctx, land, emit);
}

/** Thorkel's chest washes into place by Hild once she is reached (Book 9 section 03). */
function placeChest(world: WorldState, ctx: WreckContext, emit: WreckEmit): void {
  const onFoot = world.onFoot;
  const c = ctx.rw.chest;
  if (onFoot === null || world.facts[FACT_CHEST_PLACED] === true) return;
  setFact(world, FACT_CHEST_PLACED, true);
  if (findActor(onFoot, c.id) !== null) return;
  const T = 24;
  placeActor(onFoot, c.id, c.zone, {
    x: c.at.x * T,
    y: c.at.y * T,
    facing: c.at.facing,
    pose: 'down',
  });
  emit({ type: 'WRECK', what: 'CHEST_PLACED', x: c.at.x * T, y: c.at.y * T, item: c.id });
}

function nameChest(world: WorldState, ctx: WreckContext, emit: WreckEmit): void {
  if (world.facts[FACT_CHEST_NAMED] === true) return;
  setFact(world, FACT_CHEST_NAMED, true);
  emit({ type: 'PERSON_SPOKE', person: ctx.caller, lineKey: ctx.rw.chest.line });
}

/** Hild, reached (or asked) without a blade, says what she needs, at most every few seconds. */
export function noBlade(world: WorldState, ctx: WreckContext, emit: WreckEmit): void {
  const at = world.facts[FACT_NO_BLADE_SAID];
  if (typeof at === 'number' && world.tick - at < 6 * TICKS_PER_SECOND) return;
  setFact(world, FACT_NO_BLADE_SAID, world.tick);
  emit({ type: 'PERSON_SPOKE', person: ctx.caller, lineKey: ctx.rw.net.lines['noBlade'] ?? '' });
}

/**
 * Hild sees the first fire's smoke and limps up from the strand to the camp; reaching the steerer
 * there (or her seat, then the steerer coming near), she gives the shelter's aim (beat 8).
 */
function stepWalkUp(
  world: WorldState,
  ctx: WreckContext,
  land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  tidalGroundOpen: boolean,
  emit: WreckEmit,
): void {
  const onFoot = world.onFoot;
  const camp = ctx.camp;
  if (onFoot === null || camp === null) return;
  if (world.facts[FACT_HILD_WALKED_UP] === true) {
    // By the fire until the sail is up, then her day takes her (Stage 8: to her work).
    if (world.facts[FACT_SHELTER_RAISED] !== false) return;
    if (world.talk?.with === ctx.caller) return;
    const seat = ctx.rw.camp.hildSeat;
    stepResident(
      onFoot,
      ctx.caller,
      { zone: camp.zone, x: seat.x * 24, y: seat.y * 24, facing: seat.facing, pose: 'sit' },
      land.maps,
      land,
      tidalGroundOpen,
      false,
      Math.min(land.movement.walk, ctx.limp),
    );
    return;
  }
  if (world.facts[FACT_FIRE_LIT] !== true || world.facts[FACT_HILD_SAFE] !== true) return;
  const h = findActor(onFoot, ctx.caller);
  if (h === null || h.actor.pose === 'carried' || h.actor.pose === 'down') return;
  if (world.facts[FACT_HILD_WALKING] !== true) setFact(world, FACT_HILD_WALKING, true);
  const map = land.maps.get(onFoot.zone);
  const tile = map?.tile ?? 24;
  const p = onFoot.player;
  const steererAtCamp = onFoot.zone === camp.zone;
  // To the steerer at the camp, else to her seat by the fire.
  const goal = steererAtCamp
    ? { x: p.x + 1.4 * tile, y: p.y + 0.4 * tile }
    : { x: (camp.fire.x - 1.3) * tile, y: (camp.fire.y + 0.15) * tile };
  const limp = Math.min(land.movement.walk, ctx.limp);
  stepResident(
    onFoot,
    ctx.caller,
    { zone: camp.zone, x: goal.x, y: goal.y, facing: 'w', pose: 'idle' },
    land.maps,
    land,
    tidalGroundOpen,
    false,
    limp,
  );
  const now = findActor(onFoot, ctx.caller);
  if (now === null || !now.visible || now.zone !== camp.zone || !steererAtCamp) return;
  if (
    distTiles(now.actor, p, tile) <=
    ctx.rw.camp.walkUpTiles + (now.actor.walk === undefined ? 2 : 0)
  ) {
    delete now.actor.walk;
    delete now.actor.moving;
    now.actor.pose = 'idle';
    now.actor.facing = p.x < now.actor.x ? 'w' : 'e';
    setFact(world, FACT_HILD_WALKED_UP, true);
    emit({ type: 'PERSON_SPOKE', person: ctx.caller, lineKey: ctx.rw.camp.walkUp });
  }
}

/**
 * The first dusk (Book 10 section 08, searchesPlaced; Book 7 section 09): the searches' people
 * are placed at 19:00 on day 1; the Hag's light shows from then until full dark; the scavengers'
 * dusk is over once their encounter is (or at dark, if the steerer walked away).
 */
function stepDusk(world: WorldState, ctx: WreckContext, emit: WreckEmit): void {
  const day = world.calendar.day;
  const minute = world.calendar.minuteOfDay;
  if (
    world.facts[FACT_SEARCHES_PLACED] !== true &&
    (day > 1 || minute >= ctx.ob.searches.placedMinute)
  )
    setFact(world, FACT_SEARCHES_PLACED, true);
  const light =
    day === 1 && minute >= ctx.rw.hagLight.fromMinute && minute < ctx.rw.hagLight.untilMinute;
  if ((world.facts[FACT_HAG_LIGHT] === true) !== light) setFact(world, FACT_HAG_LIGHT, light);
  const zone = world.onFoot?.zone;
  if (
    light &&
    world.facts[FACT_HAG_LIGHT_SEEN] !== true &&
    (zone === ctx.camp?.zone || zone === ctx.def.zone)
  ) {
    setFact(world, FACT_HAG_LIGHT_SEEN, true);
    emit({ type: 'WRECK', what: 'HAG_LIGHT', key: ctx.rw.hagLight.caption });
  }
  if (world.facts[FACT_DUSK_OVER] !== true) {
    // The combat code's own word that the dusk at the stern is done, or the second day.
    const told = world.facts['dusk.outcome'] !== undefined || world.facts['ch1.dusk'] !== undefined;
    const dark = day > 1 || minute >= ctx.rw.hagLight.untilMinute - 90;
    if (told || (dark && !fightNear(world))) setFact(world, FACT_DUSK_OVER, true);
  }
}

/**
 * The first night's fire (Book 8 section 05): once the dusk is over and the fire is lit, the
 * steerer coming to the fire with Hild there sits a while with her: her grief between the jokes,
 * ending on the morning's aims. Missed that night, she gives the aims when next in earshot.
 */
function stepFireScene(world: WorldState, ctx: WreckContext, emit: WreckEmit): void {
  const onFoot = world.onFoot;
  const camp = ctx.camp;
  if (onFoot === null || camp === null || world.facts[FACT_FIRE_SCENE] === true) return;
  const map = onFoot.zone;
  const tile = 24;
  const p = onFoot.player;
  // The scene under way has ended: the aims are given.
  if (world.facts[FACT_FIRE_SCENE_ON] === true) {
    // She sits by the fire, turned to the steerer, while the scene plays.
    const sitting = onFoot.actors[ctx.caller];
    if (world.talk?.scene === 'fire.night' && sitting !== undefined) {
      delete sitting.walk;
      delete sitting.moving;
      sitting.pose = 'sit';
      sitting.facing = onFoot.player.x < sitting.x ? 'w' : 'e';
    }
    if (world.talk?.scene !== 'fire.night') {
      setFact(world, FACT_FIRE_SCENE, true);
      setFact(world, FACT_SEARCH_TOLD, true);
    }
    return;
  }
  if (world.facts[FACT_DUSK_OVER] !== true || world.facts[FACT_FIRE_LIT] !== true) return;
  if (world.talk !== null || fightNear(world)) return;
  const h = findActor(onFoot, ctx.caller);
  if (h === null || !h.visible || !world.household.residents.includes(ctx.caller)) return;
  const fire = { x: camp.fire.x * tile, y: camp.fire.y * tile };
  const late = world.calendar.day > 1 && world.calendar.minuteOfDay < ctx.rw.fireScene.fromMinute;
  if (late) {
    // Missed the night: the aims, said when next in earshot.
    if (distTiles(h.actor, p, tile) > ctx.earshotTiles) return;
    setFact(world, FACT_FIRE_SCENE, true);
    setFact(world, FACT_SEARCH_TOLD, true);
    const lines = ctx.rw.fireScene.lines;
    for (const key of lines.slice(-2))
      emit({ type: 'PERSON_SPOKE', person: ctx.caller, lineKey: key });
    return;
  }
  if (world.calendar.minuteOfDay < ctx.rw.fireScene.fromMinute && world.calendar.day === 1) return;
  if (map !== camp.zone) return;
  if (distTiles(p, fire, tile) > ctx.rw.fireScene.nearTiles) return;
  if (distTiles(h.actor, fire, tile) > ctx.rw.fireScene.nearTiles + 1) return;
  setFact(world, FACT_FIRE_SCENE_ON, true);
  const [first, ...rest] = ctx.rw.fireScene.lines;
  world.talk = {
    kind: 'SEARCH',
    with: ctx.caller,
    scene: 'fire.night',
    node: null,
    topics: [],
    topic: null,
    queue: rest.map((key) => ({ speaker: ctx.caller, key })),
    nextLineTick: world.tick + Math.round(2.5 * TICKS_PER_SECOND),
    line: first === undefined ? null : { speaker: ctx.caller, key: first },
    chosen: null,
    ending: true,
    since: world.tick,
  };
  emit({ type: 'TALK_STARTED', person: ctx.caller, kind: 'SEARCH' });
  if (first !== undefined) emit({ type: 'PERSON_SPOKE', person: ctx.caller, lineKey: first });
}

// ------------------------------------------------------------------------- his key and chest

/** Bran lays Thorkel on his bier with the steerer near: he gives the key (decision DE-18). */
function stepKey(world: WorldState, ctx: WreckContext, emit: WreckEmit): void {
  const onFoot = world.onFoot;
  const b = ctx.bran;
  if (onFoot === null || b === null || world.facts[FACT_KEY] !== undefined) return;
  if (world.facts[FACT_BODY] !== 'CAMP') return;
  const bran = findActor(onFoot, b.person);
  const body = findActor(onFoot, b.body);
  if (bran === null || body === null || !bran.visible || !body.visible) return;
  const p = onFoot.player;
  if (distTiles(bran.actor, p, 24) > 6 || world.talk !== null) return;
  giveKey(world, ctx, 'BRAN', emit);
  emit({ type: 'PERSON_SPOKE', person: b.person, lineKey: ctx.rw.chest.keyLine });
}

function giveKey(
  world: WorldState,
  ctx: WreckContext,
  from: 'BRAN' | 'BODY',
  emit: WreckEmit,
): void {
  if (world.facts[FACT_KEY] !== undefined) return;
  setFact(world, FACT_KEY, from);
  const key = ctx.rw.chest.key;
  world.player.inventory[key] = 1;
  emit({ type: 'WRECK', what: 'KEY_TAKEN', item: key, key: ctx.rw.chest.captions['key'] ?? '' });
}

/** What the steerer can do here that is the opening's: take the key, open the chest, raise the sail. */
export function wreckPlacedUses(
  world: WorldState,
  ctx: WreckContext,
  map: ZoneMap,
  camp: CampContext | null,
): PlacedUse[] {
  const onFoot = world.onFoot;
  if (
    onFoot === null ||
    world.talk !== null ||
    onFoot.carrying !== null ||
    wreckPhase(world) !== 'PLAY'
  )
    return [];
  const out: PlacedUse[] = [];
  const T = map.tile;
  // His key, from his body wherever it lies, once Bran's search is decided.
  const b = ctx.bran;
  if (b !== null && world.facts[FACT_KEY] === undefined && world.facts[FACT_BRAN] !== undefined) {
    const body = onFoot.actors[b.body];
    if (body?.pose === 'dead')
      out.push({
        use: { kind: 'OPENING', site: 'take_key', target: b.body },
        x: body.x,
        y: body.y,
      });
  }
  // His chest, with the key.
  const chest = onFoot.actors[ctx.rw.chest.id];
  if (
    chest !== undefined &&
    (chest.pose === 'down' || chest.pose === 'idle') &&
    world.facts[FACT_CHEST_OPENED] !== true &&
    steererHas(world, ctx.rw.chest.key)
  )
    out.push({
      use: { kind: 'OPENING', site: 'open_chest', target: ctx.rw.chest.id },
      x: chest.x,
      y: chest.y - 1,
    });
  // The sail and the oars, at the camp, before the shelter is up.
  const c = ctx.camp;
  const home = camp === null ? undefined : homeOf(world, camp);
  if (
    c !== null &&
    map.zone === c.zone &&
    world.facts[FACT_AT_BROCH] === true &&
    world.facts[FACT_SHELTER_RAISED] === false &&
    home?.stage === 'S0'
  )
    out.push({
      use: { kind: 'OPENING', site: 'raise_shelter', target: 'SHELTER' },
      x: c.shelter.x * T,
      y: c.shelter.y * T,
    });
  return out;
}

/** What the simulation does for the opening's uses and works. */
export interface WreckHooks {
  /** Puts items where the steerer carries them (the hotbar, the quiver), with the first tooltip. */
  readonly give: (item: Id, count: number) => number;
  /** Runs game minutes through the home step. */
  readonly advance: (minutes: number) => void;
  /** Starts a hands-on action of `ticks` (the feet planted, the work loop playing). */
  readonly work: (
    task: Id,
    site: string,
    at: { x: number; y: number },
    ticks: number,
    target?: Id,
  ) => void;
  /** Spends stamina on a task. */
  readonly spend: (stamina: number) => void;
}

/** An opening use chosen by the steerer (INTERACT, or a click on it). */
export function wreckUse(
  world: WorldState,
  ctx: WreckContext,
  site: string,
  hooks: WreckHooks,
  emit: WreckEmit,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  switch (site) {
    case 'take_key':
      giveKey(world, ctx, 'BODY', emit);
      return;
    case 'open_chest':
      openChest(world, ctx, hooks, emit);
      return;
    case 'raise_shelter': {
      const c = ctx.camp;
      if (c === null) return;
      const r = ctx.ob.camp.shelterRaise;
      hooks.work(
        TASK_RAISE_SHELTER,
        'shelter',
        { x: c.shelter.x * 24, y: c.shelter.y * 24 },
        r.seconds * TICKS_PER_SECOND,
      );
      return;
    }
  }
}

/** The key turns, the lid lifts: his bow and a quiver, his chart and his things (beat 14). */
function openChest(world: WorldState, ctx: WreckContext, hooks: WreckHooks, emit: WreckEmit): void {
  const onFoot = world.onFoot;
  const c = ctx.rw.chest;
  const chest = onFoot?.actors[c.id];
  if (onFoot === null || chest === undefined || world.facts[FACT_CHEST_OPENED] === true) return;
  if (!steererHas(world, c.key)) return;
  setFact(world, FACT_CHEST_OPENED, true);
  setFact(world, 'ch1.chest_opened_at', world.tick);
  world.player.inventory = Object.fromEntries(
    Object.entries(world.player.inventory).filter(([k]) => k !== c.key),
  );
  chest.pose = 'idle';
  emit({
    type: 'WRECK',
    what: 'CHEST_OPENED',
    x: chest.x,
    y: chest.y,
    item: c.id,
    key: c.captions['key'] ?? '',
  });
  for (const thing of c.contents) {
    const took = hooks.give(thing.item, thing.count);
    // Things with no hotbar use (the chart, the comb, the whetstone) are kept by number; bindings
    // are carried up to Book 10 healCarry by the hook (combat v2), any over it left in the chest.
    if (took === 0 && thing.item !== BINDING)
      world.player.inventory[thing.item] = (world.player.inventory[thing.item] ?? 0) + thing.count;
    if (thing.quiver === true) hooks.give('ITEM_ARROW', ctx.startingArrows);
  }
  emit({ type: 'PERSON_SPOKE', person: ctx.caller, lineKey: c.bowLine });
}

// --------------------------------------------------------------------------------- works

export function isWreckWork(task: Id): boolean {
  return (WRECK_TASKS as readonly string[]).includes(task);
}

/** The ticks a cut still needs (the hold's progress is kept, Book 10 cutHold). */
export function cutTicksLeft(world: WorldState, ctx: WreckContext): number {
  const done = Number(world.facts[FACT_NET_CUT] ?? 0);
  return Math.max(1, Math.round(ctx.ob.firstMinutes.cutHoldSeconds * TICKS_PER_SECOND) - done);
}

/** A hands-on action of the opening let go before its end: the cut keeps what is cut. */
export function wreckWorkCancelled(world: WorldState, task: Id, since: number): void {
  if (task !== TASK_CUT_NET) return;
  const done = Number(world.facts[FACT_NET_CUT] ?? 0);
  setFact(world, FACT_NET_CUT, done + Math.max(0, world.tick - since));
}

/** A hands-on action of the opening is done. */
export function finishWreckWork(
  world: WorldState,
  ctx: WreckContext,
  _camp: CampContext | null,
  task: Id,
  hooks: WreckHooks,
  emit: WreckEmit,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  if (task === TASK_CUT_NET) {
    setFact(world, FACT_NET_CUT, Math.round(ctx.ob.firstMinutes.cutHoldSeconds * TICKS_PER_SECOND));
    setFact(world, FACT_NET_FREE, true);
    setFact(world, FACT_NET_FREE_AT, world.tick);
    const h = onFoot.actors[ctx.caller];
    emit({
      type: 'WRECK',
      what: 'NET_CUT',
      x: h?.x ?? onFoot.player.x,
      y: h?.y ?? onFoot.player.y,
      key: ctx.rw.net.captions['parts'] ?? '',
    });
    emit({ type: 'PERSON_SPOKE', person: ctx.caller, lineKey: ctx.rw.net.lines['cut'] ?? '' });
    return;
  }
  if (task === TASK_RAISE_SHELTER) {
    const r = ctx.ob.camp.shelterRaise;
    setFact(world, FACT_SHELTER_RAISED, true);
    setFact(world, 'ch1.shelter_raised_at', world.tick);
    hooks.spend(r.stamina);
    world.player.condition.workedMinutes += r.minutes;
    emit({ type: 'WRECK', what: 'SHELTER_RAISED', key: ctx.rw.camp.captions['sail'] ?? '' });
    const h = findActor(onFoot, ctx.caller);
    if (h?.visible === true && distTiles(h.actor, onFoot.player, 24) <= ctx.earshotTiles)
      emit({ type: 'PERSON_SPOKE', person: ctx.caller, lineKey: ctx.rw.camp.shelterUp });
    hooks.advance(r.minutes);
  }
}

/**
 * Thorkel's chest with his key in hand: the steerer opens it rather than lifting it. Returns true
 * when it was this.
 */
export function chestInteract(
  world: WorldState,
  ctx: WreckContext,
  target: Id,
  hooks: WreckHooks,
  emit: WreckEmit,
): boolean {
  if (target !== ctx.rw.chest.id || world.facts[FACT_CHEST_OPENED] === true) return false;
  if (!steererHas(world, ctx.rw.chest.key)) return false;
  openChest(world, ctx, hooks, emit);
  return true;
}

/**
 * The steerer's interaction with Hild while she is in the net: with a blade, the hold-to-cut
 * starts (or carries on); without one, she says what she needs. Returns true when it was this.
 */
export function netInteract(
  world: WorldState,
  ctx: WreckContext,
  target: Id,
  hooks: WreckHooks,
  emit: WreckEmit,
): boolean {
  if (target !== ctx.caller || !netted(world)) return false;
  const onFoot = world.onFoot;
  const h = onFoot?.actors[ctx.caller];
  if (onFoot == null || h === undefined) return true;
  if (world.facts[FACT_HILD_REACHED] !== true) {
    setFact(world, FACT_HILD_REACHED, true);
    placeChest(world, ctx, emit);
  }
  if (bladeOf(world, ctx) === null) {
    noBlade(world, ctx, emit);
    return true;
  }
  hooks.work(
    TASK_CUT_NET,
    `person:${ctx.caller}`,
    { x: h.x, y: h.y },
    cutTicksLeft(world, ctx),
    ctx.caller,
  );
  return true;
}

// ----------------------------------------------------------------------- lifting and setting down

/** Something lifted: Thorkel's chest names itself through Hild if she is near and has not yet. */
export function wreckLifted(
  world: WorldState,
  ctx: WreckContext,
  target: Id,
  emit: WreckEmit,
): void {
  if (target === ctx.rw.chest.id && world.facts[FACT_HILD_SAFE] === true)
    nameChest(world, ctx, emit);
}

/** Where a set-down thing settles, if it has a home within its settle distance (decision DE-17). */
export function homeFor(
  ctx: WreckContext,
  item: Id,
  zone: Id,
  at: { x: number; y: number },
  tile: number,
): { x: number; y: number } | null {
  const c = ctx.rw.chest;
  if (item !== c.id || zone !== c.home.zone) return null;
  const home = { x: c.home.x * tile, y: c.home.y * tile };
  return distTiles(at, home, tile) <= ctx.ob.feedback.homeSettleTiles ? home : null;
}

/** Whether a carried thing's home outline shows now (presentation of the carry, decision DE-17). */
export function homeOutline(
  world: WorldState,
  ctx: WreckContext,
  tile: number,
): { x: number; y: number; item: Id } | null {
  const onFoot = world.onFoot;
  const c = ctx.rw.chest;
  if (onFoot?.carrying !== c.id || onFoot.zone !== c.home.zone) return null;
  const home = { x: c.home.x * tile, y: c.home.y * tile };
  if (distTiles(onFoot.player, home, tile) > ctx.ob.feedback.homeOutlineTiles) return null;
  return { ...home, item: c.id };
}

/**
 * Something set down: Thorkel's chest settles at its home; the stores from the mast go into the
 * camp's stores; Runa's tool chest is safe somewhere she will ask about; a rescued person's
 * get-up clock starts.
 */
export function wreckSetDown(
  world: WorldState,
  ctx: WreckContext,
  camp: CampContext | null,
  target: Id,
  map: ZoneMap,
  emit: WreckEmit,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const actor = onFoot.actors[target];
  if (actor === undefined) return;
  const tile = map.tile;
  const c = ctx.rw.chest;
  if (target === c.id) {
    actor.pose = 'down';
    emit({
      type: 'WRECK',
      what: 'LOAD_DOWN',
      x: actor.x,
      y: actor.y,
      item: target,
      key: c.captions['thud'] ?? '',
    });
    const home = homeFor(ctx, target, map.zone, actor, tile);
    if (home !== null) {
      actor.x = home.x;
      actor.y = home.y;
      actor.facing = c.home.facing as OnFootActor['facing'];
      // Settled, it is the camp's chest: it stands there, no longer a load to lift.
      actor.pose = 'idle';
      setFact(world, FACT_CHEST_HOME, true);
      const h = camp === null ? undefined : homeOf(world, camp);
      if (h !== undefined) {
        h.placed ??= [];
        if (!h.placed.includes(target)) h.placed.push(target);
      }
      emit({
        type: 'WRECK',
        what: 'CHEST_HOME',
        x: home.x,
        y: home.y,
        item: target,
        key: c.captions['settled'] ?? '',
      });
    }
    return;
  }
  const m = ctx.rw.mast;
  if (target === m.bundle) {
    actor.pose = 'down';
    const cc = ctx.camp;
    if (
      cc !== null &&
      map.zone === cc.zone &&
      distTiles(actor, { x: cc.fire.x * tile, y: cc.fire.y * tile }, tile) <= m.campTiles
    ) {
      // Emptied into the camp's stores; the cauldron goes to the fire.
      const h = camp === null ? undefined : homeOf(world, camp);
      if (h !== undefined)
        h.stores['RES_SALTED_FISH'] = (h.stores['RES_SALTED_FISH'] ?? 0) + ctx.ob.camp.mastStoresRd;
      onFoot.actors = Object.fromEntries(
        Object.entries(onFoot.actors).filter(([k]) => k !== target),
      );
      setFact(world, FACT_MAST_STORES, 'CAMP');
      emit({
        type: 'WRECK',
        what: 'STORES_BROUGHT',
        x: actor.x,
        y: actor.y,
        item: target,
        key: m.captions['stores'] ?? '',
      });
    } else emit({ type: 'WRECK', what: 'LOAD_DOWN', x: actor.x, y: actor.y, item: target });
    return;
  }
  const r = ctx.runa;
  if (r !== null && target === r.tools) {
    const place = runaPlaceOf(ctx, map.zone, actor, tile);
    if (place !== null) setFact(world, FACT_RUNA_TOOLS_AT, place);
    return;
  }
}

/**
 * A rescued person's get-up clock (DE-22) starts only at the set-down that rescues them: once
 * they are of the household and no longer downed (decision DE-82). Call it after every other
 * set-down rule (Oddi joins off his strand; a downed ally is safe at the camp). Set down before
 * that (Oddi above the tide line on his own strand, a downed ally outside a safe place) they lie
 * where they were put, for the steerer to lift again: never standing, unrescued, out of reach.
 */
export function rescueSetDown(world: WorldState, ctx: WreckContext, target: Id): void {
  const actor = world.onFoot?.actors[target];
  if (
    actor === undefined ||
    !ctx.rw.rescue.people.includes(target) ||
    world.facts[`rescue.${target}.down`] !== undefined
  )
    return;
  if (world.household.residents.includes(target) && world.people[target]?.status !== 'downed')
    setFact(world, `rescue.${target}.down`, world.tick);
  else actor.pose = 'down';
}

/** Which of Runa's safe places a point is in (the shelter first: it is inside the camp). */
export function runaPlaceOf(
  ctx: WreckContext,
  zone: Id,
  at: { x: number; y: number },
  tile: number,
): string | null {
  const places = Object.entries(ctx.rw.runa.places).sort(([, a], [, b]) => a.r - b.r);
  for (const [name, pl] of places)
    if (pl.zone === zone && distTiles(at, { x: pl.x * tile, y: pl.y * tile }, tile) <= pl.r)
      return name;
  return null;
}

// ------------------------------------------------------------------------------ the mast

/**
 * Before the missiles fly this tick: one whose drawn path (its ground point less its drawn height,
 * as Book 7 section 18 draws it) passes through the stores' lashing cuts it; the missile flies on.
 * The bundle falls into the shallows (decision DE-19).
 */
export function stepMast(
  world: WorldState,
  ctx: WreckContext,
  map: ZoneMap,
  releaseHeight: number,
  emit: WreckEmit,
): void {
  const onFoot = world.onFoot;
  const m = ctx.rw.mast;
  if (onFoot?.zone !== m.zone || world.facts[FACT_LASHING_CUT] === true) return;
  for (const p of onFoot.projectiles) {
    if (lashingHit(p, m, map.tile, releaseHeight)) {
      cutLashing(world, ctx, onFoot, map.tile, emit);
      return;
    }
  }
}

/** Whether a missile's next tick of flight passes through the lashing as drawn. */
export function lashingHit(
  p: Projectile,
  m: ReworkDef['mast'],
  tile: number,
  releaseHeight: number,
): boolean {
  const lx = m.lashing.x * tile;
  const ly = m.lashing.y * tile - m.lashing.heightPx;
  const t1 = Math.min(p.ticks, p.t + 1);
  const steps = 8;
  for (let k = 0; k <= steps; k++) {
    const t = p.t + ((t1 - p.t) * k) / steps;
    const f = t / p.ticks;
    const at = flightAt(p, f);
    const drawnY = at.y - (at.z + releaseHeight * (1 - f));
    if (Math.abs(at.x - lx) <= m.lashing.w / 2 && Math.abs(drawnY - ly) <= m.lashing.h / 2)
      return true;
  }
  return false;
}

function cutLashing(
  world: WorldState,
  ctx: WreckContext,
  onFoot: OnFootState,
  tile: number,
  emit: WreckEmit,
): void {
  const m = ctx.rw.mast;
  setFact(world, FACT_LASHING_CUT, true);
  setFact(world, FACT_MAST_STORES, 'WATER');
  emit({
    type: 'WRECK',
    what: 'LASHING_CUT',
    x: m.lashing.x * tile,
    y: m.lashing.y * tile - m.lashing.heightPx,
    key: m.captions['lashing'] ?? '',
  });
  placeActor(onFoot, m.bundle, m.zone, {
    x: m.fall.x * tile,
    y: m.fall.y * tile,
    facing: m.fall.facing,
    pose: 'down',
  });
  emit({
    type: 'WRECK',
    what: 'BUNDLE_SPLASH',
    x: m.fall.x * tile,
    y: m.fall.y * tile,
    item: m.bundle,
    key: m.captions['splash'] ?? '',
  });
}

// ----------------------------------------------------------------------- rescued, and Runa

/**
 * Whether the opening holds a resident where they are (decision DE-22): a rescued person sits
 * Book 10's rescueGetUp before getting up; Hild waits on the strand until the first fire's smoke,
 * then walks up herself (stepWalkUp).
 */
export function wreckHolds(world: WorldState, ctx: WreckContext, id: Id): boolean {
  // Sitting with the steerer at the first night's fire.
  if (id === ctx.caller && world.talk?.scene === 'fire.night') return true;
  // Hild walking up at the first fire's smoke, then by the fire until the sail is up (beat 8).
  if (
    id === ctx.caller &&
    world.facts[FACT_HILD_WALKING] === true &&
    (world.facts[FACT_HILD_WALKED_UP] !== true || world.facts[FACT_SHELTER_RAISED] === false)
  )
    return true;
  const down = world.facts[`rescue.${id}.down`];
  if (typeof down !== 'number') return false;
  return world.tick - down < ctx.ob.searches.rescueGetUpSeconds * TICKS_PER_SECOND;
}

/** A rescued person's moment is up: they stand, and their day takes them to the camp. */
function stepRescues(world: WorldState, ctx: WreckContext): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  for (const id of ctx.rw.rescue.people) {
    const down = world.facts[`rescue.${id}.down`];
    if (typeof down !== 'number') continue;
    if (world.facts[`rescue.${id}.up`] === true) {
      // Home at the camp: the walk home at the limp is over (Book 10 section 08, limp).
      const at = findActor(onFoot, id);
      const camp = ctx.camp;
      if (
        world.facts[`rescue.${id}.home`] !== true &&
        at !== null &&
        camp !== null &&
        at.zone === camp.zone &&
        distTiles(at.actor, { x: camp.fire.x * 24, y: camp.fire.y * 24 }, 24) <=
          ctx.rw.fireScene.nearTiles + 2
      )
        setFact(world, `rescue.${id}.home`, true);
      continue;
    }
    if (world.tick - down < ctx.ob.searches.rescueGetUpSeconds * TICKS_PER_SECOND) continue;
    const a = findActor(onFoot, id);
    if (a === null || a.actor.pose === 'carried') continue;
    setFact(world, `rescue.${id}.up`, true);
    if (a.actor.pose === 'sit' || NEEDS_LIFT.includes(a.actor.pose)) a.actor.pose = 'idle';
  }
}

/** Runa's question opens her next talk once her tool chest is somewhere safe (decision DE-21). */
export function runaAsks(world: WorldState, ctx: WreckContext, person: Id): boolean {
  const r = ctx.runa;
  return (
    r !== null &&
    person === r.person &&
    world.household.residents.includes(person) &&
    world.facts[FACT_RUNA_TOOLS_AT] !== undefined &&
    world.facts[FACT_RUNA_ASKED] !== true
  );
}

/** The steerer names a place for Runa's tool chest: the truth, or a lie she will find out. */
export function runaAnswer(
  world: WorldState,
  ctx: WreckContext,
  place: string,
  emit: WreckEmit,
): void {
  const r = ctx.runa;
  if (r === null || world.facts[FACT_RUNA_ASKED] === true) return;
  setFact(world, FACT_RUNA_ASKED, true);
  setFact(world, FACT_RUNA_TOLD, place);
  setFact(world, FACT_RUNA_TOLD_DAY, world.calendar.day);
  const person = world.people[r.person];
  const truth = world.facts[FACT_RUNA_TOOLS_AT] === place;
  if (truth) {
    if (person !== undefined) person.friendship += ctx.ob.searches.runaTruthFriendship;
    emit({ type: 'WRECK', what: 'RUNA_TRUTH', person: r.person });
    world.talk?.queue.push({ speaker: r.person, key: ctx.rw.runa.truth });
  } else emit({ type: 'WRECK', what: 'RUNA_LIE', person: r.person });
}

/** A lie about Runa's chest is found out on her next walk past the place named, within a day. */
function stepRunaLie(
  world: WorldState,
  ctx: WreckContext,
  land: Pick<LandContext, 'maps'>,
  emit: WreckEmit,
): void {
  const r = ctx.runa;
  const onFoot = world.onFoot;
  if (r === null || onFoot === null || world.facts[FACT_RUNA_LIE_FOUND] === true) return;
  const told = world.facts[FACT_RUNA_TOLD];
  if (typeof told !== 'string' || told === world.facts[FACT_RUNA_TOOLS_AT]) return;
  const place = ctx.rw.runa.places[told];
  const runa = findActor(onFoot, r.person);
  if (place === undefined || runa === null) return;
  const tile = land.maps.get(runa.zone)?.tile ?? 24;
  const toldDay = Number(world.facts[FACT_RUNA_TOLD_DAY] ?? world.calendar.day);
  const past =
    runa.zone === place.zone &&
    distTiles(runa.actor, { x: place.x * tile, y: place.y * tile }, tile) <= ctx.rw.runa.checkTiles;
  if (!past && world.calendar.day <= toldDay) return;
  setFact(world, FACT_RUNA_LIE_FOUND, true);
  const person = world.people[r.person];
  if (person !== undefined) {
    const word = person.values.WORD ?? 0;
    person.friendship -= ctx.ob.searches.runaLiePerWord * word;
    person.memories.push({
      day: world.calendar.day,
      kind: 'EVENT',
      about: 'LIED_TO_CHEST',
      source: 'SAW',
      detail: told,
    });
    // Said to the steerer when next in earshot (the warning flow's owed lines).
    if (runa.visible && distTiles(runa.actor, onFoot.player, tile) <= ctx.earshotTiles)
      emit({ type: 'PERSON_SPOKE', person: r.person, lineKey: ctx.rw.runa.lie });
    else person.life.owed.push(ctx.rw.runa.lie);
  }
  emit({ type: 'WRECK', what: 'RUNA_LIE_FOUND', person: r.person });
}

// ------------------------------------------------------------------------- the Hag's Stone

/** The phases of the stone's effect, in real seconds from its start, for its showing's hold. */
export function hagPhases(ob: OpeningBalance, hold: number): { what: WreckWhat; at: number }[] {
  const s = ob.stone;
  const cold = s.hushSeconds;
  const holdAt = cold + s.coldSeconds;
  const gust = holdAt + hold;
  const settle = gust + s.gustSeconds;
  const done = settle + s.settleSeconds;
  return [
    { what: 'HAG_HUSH', at: 0 },
    { what: 'HAG_COLD', at: cold },
    { what: 'HAG_HOLD', at: holdAt },
    { what: 'HAG_GUST', at: gust },
    { what: 'HAG_SETTLE', at: settle },
    { what: 'HAG_DONE', at: done },
  ];
}

/** The hold of the n-th showing (content's list, Book 10's default when it runs out). */
export function hagHold(ctx: WreckContext, showing: number): number {
  const holds = ctx.rw.hagStone.holds;
  const h = holds[(showing - 1) % Math.max(1, holds.length)] ?? ctx.ob.stone.holdDefaultSeconds;
  const [lo, hi] = ctx.ob.stone.holdSeconds;
  return Math.max(lo, Math.min(hi, h));
}

/** Starts the stone's effect (the steerer near it while it weeps, or an offering laid). */
export function startHagStone(world: WorldState, ctx: WreckContext): void {
  const showing = Number(world.facts[FACT_HAG_SHOWINGS] ?? 0) + 1;
  setFact(world, FACT_HAG_SHOWINGS, showing);
  setFact(world, FACT_HAG_AT, world.tick);
  setFact(world, FACT_HAG_HOLD, hagHold(ctx, showing));
}

/** The effect's phase now, with seconds into it (null when none plays). */
export function hagNow(
  world: WorldState,
  ctx: WreckContext,
): { what: WreckWhat; seconds: number; hold: number; showing: number } | null {
  const at = world.facts[FACT_HAG_AT];
  if (typeof at !== 'number') return null;
  const hold = Number(world.facts[FACT_HAG_HOLD] ?? ctx.ob.stone.holdDefaultSeconds);
  const seconds = (world.tick - at) / TICKS_PER_SECOND;
  const phases = hagPhases(ctx.ob, hold);
  const last = phases[phases.length - 1];
  if (last === undefined || seconds >= last.at) return null;
  const now = [...phases].reverse().find((p) => seconds >= p.at);
  return now === undefined
    ? null
    : { what: now.what, seconds, hold, showing: Number(world.facts[FACT_HAG_SHOWINGS] ?? 1) };
}

function stepHagStone(
  world: WorldState,
  ctx: WreckContext,
  land: Pick<LandContext, 'maps'>,
  emit: WreckEmit,
): void {
  const onFoot = world.onFoot;
  const s = ctx.stone;
  if (onFoot === null || s === null) return;
  // Each phase's start is an event (its caption and sound).
  const at = world.facts[FACT_HAG_AT];
  if (typeof at === 'number') {
    const hold = Number(world.facts[FACT_HAG_HOLD] ?? ctx.ob.stone.holdDefaultSeconds);
    const showing = Number(world.facts[FACT_HAG_SHOWINGS] ?? 1);
    for (const ph of hagPhases(ctx.ob, hold))
      if (world.tick - at === Math.round(ph.at * TICKS_PER_SECOND)) {
        const key =
          ph.what === 'HAG_HUSH'
            ? ctx.rw.hagStone.captions['hush']
            : ph.what === 'HAG_HOLD'
              ? ctx.rw.hagStone.captions['whisper']
              : ph.what === 'HAG_GUST'
                ? ctx.rw.hagStone.captions['gust']
                : undefined;
        emit({
          type: 'WRECK',
          what: ph.what,
          showing,
          x: s.x * 24,
          y: s.y * 24,
          ...(key === undefined ? {} : { key }),
        });
      }
  }
  if (onFoot.zone !== s.zone) {
    if (world.facts[FACT_HAG_VISIT] === true) setFact(world, FACT_HAG_VISIT, false);
    return;
  }
  if (world.facts[FACT_HAG_VISIT] === true || hagNow(world, ctx) !== null) return;
  // The stone weeps only while the searches are on and the Cailleach has not been answered.
  const weeps =
    world.facts['search.open'] === true &&
    (world.powers['POWER_CAILLEACH'] as { stone?: string } | undefined)?.stone !== 'DRY';
  if (!weeps || fightNear(world)) return;
  const tile = land.maps.get(onFoot.zone)?.tile ?? 24;
  if (distTiles(onFoot.player, { x: s.x * tile, y: s.y * tile }, tile) > ctx.ob.stone.nearTiles)
    return;
  setFact(world, FACT_HAG_VISIT, true);
  startHagStone(world, ctx);
  emit({
    type: 'WRECK',
    what: 'HAG_HUSH',
    showing: Number(world.facts[FACT_HAG_SHOWINGS] ?? 1),
    x: s.x * 24,
    y: s.y * 24,
    key: ctx.rw.hagStone.captions['hush'] ?? '',
  });
}

// ----------------------------------------------------------------------------- the arm-ring

/** A pickup that is silver, not a thing to carry: the arm-ring goes into the household's silver. */
export function wreckPickUp(
  world: WorldState,
  ctx: WreckContext,
  camp: CampContext | null,
  item: Id,
  x: number,
  y: number,
  emit: WreckEmit,
): boolean {
  if (item !== ctx.ring.item) return false;
  const home = camp === null ? undefined : homeOf(world, camp);
  if (home !== undefined)
    home.stores['RES_SILVER'] = (home.stores['RES_SILVER'] ?? 0) + ctx.ring.oz;
  emit({ type: 'WRECK', what: 'RING_FOUND', x, y, item, key: 'caption.ring.clink' });
  return true;
}

// ------------------------------------------------------------------------ for the aims and tests

/** Whether a resident is in the household's camp zone near its fire (for tests and the aims). */
export function atCamp(world: WorldState, ctx: WreckContext, id: Id, tile = 24): boolean {
  const onFoot = world.onFoot;
  const c = ctx.camp;
  if (onFoot === null || c === null) return false;
  const a = findActor(onFoot, id);
  return (
    a !== null &&
    a.zone === c.zone &&
    distTiles(a.actor, { x: c.fire.x * tile, y: c.fire.y * tile }, tile) <= 8
  );
}
