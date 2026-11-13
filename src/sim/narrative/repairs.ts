/**
 * Chapter 1 beats 4 to 6 (Book 4 section 08; Book 7 sections 02 to 05; Book 10 sections 05 and
 * 08; Stage 11): the coastal boat's three repairs, its first fitting, and Thorkel's rites.
 *
 * - **The boat** lies drawn up under the bank on Wreck Strand (`world.ships.flagship`): its hull
 *   holed, no rigging, its steering oar gone. Each repair has one material, a single load carried
 *   to the boat and laid by it: the salvaged **boards** from the debris on the strand; the
 *   **rigging**, cut free of the wreck on the skerry at low water; the **steering oar**, from the
 *   wreck-scavengers' skiff in Seal Cave (fought for, stolen unseen, traded for), or carved new by
 *   Runa over two days. Laid by the boat, a material is worked by whoever has the shipwright's job
 *   and by the steerer's own hands (a plain "Repair the ship" action), at their skill, for Book
 *   10's worker-days; then the repair is done, and the boat's drawing changes.
 * - **One fitting** at a time, reversible: an extended hold or a raised bow platform, chosen when
 *   looking the boat over, made by the same work, and taken off again in one action.
 * - **Thorkel's rites**, once his body lies on its bier and Hild is by: a ship of stones on the
 *   machair, or the sea with his gold ring for Rán. The household gathers, the lament is sung, and
 *   the rite is remembered.
 *
 * Every number is Book 10's; positions are content (content/repairs.json). Pure and deterministic:
 * no random stream is drawn here.
 */
import type { RepairsDef, SearchTalkDef } from '../../content/registry.ts';
import type { ShipBalance } from '../../content/shipBalance.ts';
import type { Id } from '../../core/ids.ts';
import type { PlacedUse } from '../home/camp.ts';
import { appendDeed, fireOneShot, setFact } from '../ledger/ledger.ts';
import type { LandContext, OnFootActor, OnFootState } from '../land/onFoot.ts';
import { findActor, placeActor } from '../land/zoneLinks.ts';
import type { ZoneMap } from '../land/zoneMap.ts';
import { clampMeasures } from '../people/measures.ts';
import { stepResident } from '../people/residents.ts';
import { FLAGSHIP, fit, REPAIRS, unship, wreckedBoat } from '../ship/ship.ts';
import { boatOf, FACT_CARVING, FACT_OAR, shipWorkFor } from '../ship/work.ts';
import type { RepairKind, ShipDefs, ShipInstance } from '../ship/ship.ts';
import type { WorldState } from '../world.ts';
import { GATE_LAUNCH } from './gates.ts';
import { beginSeaBurial, seaBurialActive, stepSeaBurial } from './seaBurial.ts';
import type { SeaBurialBalance, SeaEvent } from './seaBurial.ts';

export { boatOf, FACT_CARVING, FACT_OAR, shipWorkFor };
export const FACT_REPAIRS_OPEN = 'repair.open';

/** The rigging has been cut free of the wreck on the skerry. */
export const FACT_RIGGING_CUT = 'repair.rigging_cut';

/** The boat's three repairs are done (Book 4 beat 4). */
export const FACT_BOAT_READY = 'ch1.boat_ready';
/** The wreck-scavengers have gone to their skiff in Seal Cave (after the sheepfold). */
export const FACT_WRECKERS_CAVE = 'ch1.wreckers_cave';
/** Thorkel's rites: SHIP_SETTING or SEA_BURIAL; his gold ring: HILD (kept) or RAN (given). */
export const FACT_RITES = 'ch1.rites';
export const FACT_RING = 'ch1.thorkel_ring';
const FACT_PENDING = 'rites.pending';
const FACT_STAGE = 'rites.stage';
const FACT_SINCE = 'rites.since';
const FACT_LINE = 'rites.line';
const FACT_LAID = 'rites.laid';
const FACT_RAISED = 'rites.raised';

const WRECKERS = ['E_WRECKER_KETILL', 'E_WRECKER_SVART', 'E_WRECKER_CONN'] as const;

export interface RepairsContext {
  readonly def: RepairsDef;
  readonly ship: ShipDefs;
  readonly b: ShipBalance;
  readonly talks: ReadonlyMap<string, SearchTalkDef>;
  /** Book 10 workerDay, in game minutes. */
  readonly workerDayMinutes: number;
  /** Book 10 section 08's sea burial: the body taken by the sea in sight (DG-14). */
  readonly sea: SeaBurialBalance | null;
}

/** The water's edge for the sea burial: whether ground is awash at the tide now (tiles). */
export type WetAt = (zone: Id, xTiles: number, yTiles: number) => boolean;

export function repairsContext(
  def: RepairsDef | null | undefined,
  ship: ShipDefs,
  workerDayMinutes: number,
  sea: SeaBurialBalance | null = null,
): RepairsContext | null {
  if (def == null) return null;
  return {
    def,
    ship,
    b: ship.balance,
    talks: new Map(def.talks.map((t) => [t.id, t])),
    workerDayMinutes,
    sea,
  };
}

export type RepairEvent =
  | { readonly type: 'SEARCH_INFO'; readonly key: string }
  | {
      readonly type: 'PERSON_SPOKE';
      readonly person: Id;
      readonly lineKey: string;
      readonly bark?: string;
    }
  /** A material laid by the boat (its sound). */
  | { readonly type: 'MATERIAL_LAID'; readonly repair: RepairKind }
  | { readonly type: 'RIGGING_CUT' }
  | { readonly type: 'OAR_TAKEN'; readonly how: string }
  /** A repair finished (Book 4 beat 4): the boat's drawing changes. */
  | { readonly type: 'REPAIR_DONE'; readonly repair: RepairKind }
  | { readonly type: 'BOAT_READY' }
  | { readonly type: 'FITTING_DONE'; readonly fitting: Id }
  | { readonly type: 'FITTING_UNSHIPPED'; readonly fitting: Id }
  | { readonly type: 'OAR_CARVED' }
  /** Thorkel's rites: the stones laid, the rite begun (the lament), the rite done. */
  | { readonly type: 'RITES_STONES' }
  | { readonly type: 'RITES_BEGAN'; readonly form: 'SETTING' | 'SEA' }
  | { readonly type: 'RITES_DONE'; readonly form: 'SETTING' | 'SEA' }
  | { readonly type: 'CHECKPOINT'; readonly label: string }
  /** The sea burial's moments (DG-14): the bier borne down, the waves, the lift, the sink. */
  | Extract<SeaEvent, { type: 'SEA_TAKEN' }>
  /** Stage 12: launching the boat was chosen at the boat: the readiness screen opens. */
  | { readonly type: 'READINESS_ASKED'; readonly gate: Id };

export type RepairEmit = (e: RepairEvent) => void;

/** Chapter 1's coastal boat, wrecked on the strand, if the world has none yet. */
export function ensureBoat(world: WorldState, ctx: RepairsContext): ShipInstance {
  const have = boatOf(world);
  if (have !== null) return have;
  const d = ctx.def.boat;
  const ship = wreckedBoat(
    ctx.ship,
    ctx.def.hull,
    { zone: d.zone, x: d.x, y: d.y },
    world.calendar.day,
  );
  world.ships[FLAGSHIP] = ship;
  return ship;
}

/** Labour (worker-minutes) a repair needs once its material is by the boat. */
function labour(ctx: RepairsContext, r: RepairKind): number {
  const rb = ctx.b.repairs;
  const days =
    r === 'HULL'
      ? rb.hullWorkerDays
      : r === 'RIGGING'
        ? rb.riggingWorkerDays
        : rb.shipOarWorkerDays;
  return days * ctx.workerDayMinutes;
}

function fittingLabour(ctx: RepairsContext, fitting: Id): number {
  const rb = ctx.b.repairs;
  const days = fitting === 'FIT_EXTENDED_HOLD' ? rb.fitHoldWorkerDays : rb.fitBowPlatformWorkerDays;
  return days * ctx.workerDayMinutes;
}

/**
 * Adds a worker's work to the boat (the steerer's action, or a resident's minute at the
 * shipwright's job): to the oar being carved (the carver), else the first repair with its material
 * by the boat, else the fitting under way.
 */
export function addShipWork(
  world: WorldState,
  ctx: RepairsContext,
  workerMinutes: number,
  who: Id,
  emit: RepairEmit,
): void {
  const ship = boatOf(world);
  const what = shipWorkFor(world, who);
  if (ship === null || what === null) return;
  const day = world.calendar.day;
  const d = ctx.def;
  if (what === 'CARVE') {
    const oar = ship.repairs.STEERING_OAR;
    oar.progress += workerMinutes;
    if (oar.progress >= ctx.b.repairs.carveOarWorkerDays * ctx.workerDayMinutes) {
      // Carved: the new oar lies by the boat, to be shipped.
      ship.repairs.STEERING_OAR = { stage: 'MATERIALS', progress: 0, how: 'CARVED' };
      setFact(world, FACT_OAR, 'CARVED');
      emit({ type: 'OAR_CARVED' });
      const line = d.lines['carved'];
      if (line !== undefined) emit({ type: 'PERSON_SPOKE', person: who, lineKey: line });
    }
    return;
  }
  if (what === 'FIT') {
    const f = ship.fitting;
    if (f === null) return;
    f.progress += workerMinutes;
    if (f.progress >= fittingLabour(ctx, f.id)) {
      ship.fitting = null;
      if (fit(ctx.ship, ship, f.id, day)) {
        emit({ type: 'FITTING_DONE', fitting: f.id });
        fireOneShot(world, d.customise, () => undefined);
        const line = d.lines['fitted'];
        if (line !== undefined && world.household.residents.includes(d.oar.carver))
          emit({ type: 'PERSON_SPOKE', person: d.oar.carver, lineKey: line });
      }
    }
    return;
  }
  const rep = ship.repairs[what];
  rep.progress += workerMinutes;
  if (rep.progress < labour(ctx, what)) return;
  rep.stage = 'DONE';
  rep.day = day;
  if (what === 'HULL') ship.integrity = ctx.b.repairs.patchedIntegrity;
  ship.history.push({
    day,
    kind: 'REPAIRED',
    what,
    ...(rep.how === undefined ? {} : { how: rep.how }),
  });
  emit({ type: 'REPAIR_DONE', repair: what });
  const key = { HULL: 'hullDone', RIGGING: 'riggingDone', STEERING_OAR: 'oarDone' }[what];
  const line = d.lines[key];
  const speaker = line?.startsWith('c_hild') === true ? 'C_HILD' : d.oar.carver;
  if (line !== undefined && world.household.residents.includes(speaker))
    emit({ type: 'PERSON_SPOKE', person: speaker, lineKey: line });
  if (REPAIRS.every((r) => ship.repairs[r].stage === 'DONE')) {
    setFact(world, FACT_BOAT_READY, true);
    fireOneShot(world, d.beat, () => undefined);
    emit({ type: 'BOAT_READY' });
    const all = d.lines['allDone'];
    if (all !== undefined && world.household.residents.includes('C_HILD'))
      emit({ type: 'PERSON_SPOKE', person: 'C_HILD', lineKey: all });
  }
}

/** Opens the repairs once Hild has led to the broch: the salvaged boards lie in the debris. */
function open(world: WorldState, ctx: RepairsContext): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  ensureBoat(world, ctx);
  const d = ctx.def.boards;
  if (findActor(onFoot, d.id) === null && boatOf(world)?.repairs.HULL.stage === 'LACKING')
    placeActor(onFoot, d.id, d.zone, {
      x: d.x * 24,
      y: d.y * 24,
      facing: d.facing,
      pose: 'down',
    });
  setFact(world, FACT_REPAIRS_OPEN, true);
}

/** Whether the rigging still lies fouled on the wreck (drawn on the skerry). */
export function riggingOnWreck(world: WorldState): boolean {
  return world.facts[FACT_RIGGING_CUT] !== true;
}

/** Whether the steering oar is still in the scavengers' skiff (drawn there). */
export function oarInSkiff(world: WorldState): boolean {
  return world.facts[FACT_OAR] === undefined;
}

const enemyAware = (onFoot: OnFootState): Id[] =>
  Object.entries(onFoot.actors)
    .filter(([, a]) => a.fight?.side === 'ENEMY' && a.fight.ai.aware && a.fight.dead === null)
    .map(([id]) => id)
    .sort();

/** The wreckers still able to talk at Seal Cave, leader first. */
function caveSpeaker(world: WorldState, onFoot: OnFootState): Id | null {
  for (const id of WRECKERS) {
    const a = onFoot.actors[id];
    if (a === undefined || world.people[id]?.status === 'dead') continue;
    if (a.fight?.dead != null || a.pose === 'down' || a.pose === 'dead') continue;
    return id;
  }
  return null;
}

/** The talk id of a wrecker's words at the cave. */
const CAVE_TALKS: Readonly<Record<string, string>> = {
  E_WRECKER_KETILL: 'ketill.cave',
  E_WRECKER_SVART: 'svart.cave',
  E_WRECKER_CONN: 'conn.cave',
};

/** Where Thorkel lies, if he lies on his bier or at his rite's place. */
function bodyAt(world: WorldState, ctx: RepairsContext): { zone: Id; actor: OnFootActor } | null {
  const onFoot = world.onFoot;
  if (onFoot === null) return null;
  const found = findActor(onFoot, ctx.def.rites.body);
  return found === null ? null : { zone: found.zone, actor: found.actor };
}

/** Whether the rites can be asked for now (Hild by the bier, the body there, none given). */
function ritesOpen(world: WorldState, ctx: RepairsContext): boolean {
  const r = ctx.def.rites;
  if (world.facts['ch1.thorkel_body'] !== 'CAMP' || world.facts[FACT_RITES] !== undefined)
    return false;
  if (world.facts[FACT_PENDING] !== undefined) return false;
  // Once the launch has begun it is too late (Book 6 RITES_DENIED; decision S12-6).
  const gate = world.gates[GATE_LAUNCH]?.status;
  if (gate === 'STARTED' || gate === 'PASSED') return false;
  if (!world.household.residents.includes(r.recommends)) return false;
  const onFoot = world.onFoot;
  const body = bodyAt(world, ctx);
  const hild = onFoot === null ? null : findActor(onFoot, r.recommends);
  if (body === null || hild?.zone !== body.zone) return false;
  return (
    Math.hypot(hild.actor.x - body.actor.x, hild.actor.y - body.actor.y) <= r.reachTiles * 24 &&
    hild.actor.pose !== 'sleep'
  );
}

/** Every use of the repairs in the zone in view: the boat, the wreck, the skiff, the words. */
export function repairPlacedUses(
  world: WorldState,
  ctx: RepairsContext,
  map: ZoneMap,
): PlacedUse[] {
  const onFoot = world.onFoot;
  if (onFoot === null || world.facts[FACT_REPAIRS_OPEN] !== true || world.talk !== null) return [];
  const out: PlacedUse[] = [];
  const T = map.tile;
  const d = ctx.def;
  const ship = boatOf(world);
  const carrying = onFoot.carrying !== null;
  if (ship !== null && map.zone === ship.lies.zone && !carrying) {
    const talk = ctx.talks.get('boat.look');
    out.push({
      use: { kind: 'SEARCH', site: 'boat.look', target: 'SHIP' },
      x: d.boat.look.x * T,
      y: d.boat.look.y * T,
      reach: (talk?.reachTiles ?? 1.5) * T,
    });
    if (shipWorkFor(world, 'P_STEERER') !== null)
      out.push({
        use: { kind: 'TASK', task: 'TASK_REPAIR_SHIP', site: 'boat_work' },
        x: d.boat.work.x * T,
        y: d.boat.work.y * T,
      });
  }
  if (map.zone === d.rigging.zone && riggingOnWreck(world) && !carrying)
    out.push({
      use: { kind: 'TASK', task: 'TASK_REPAIR_SHIP', site: 'rigging_cut' },
      x: d.rigging.cut.x * T,
      y: d.rigging.cut.y * T,
    });
  if (map.zone === d.oar.zone && oarInSkiff(world) && !carrying) {
    out.push({
      use: { kind: 'REPAIR', site: 'take_oar', target: d.oar.id },
      x: d.oar.take.x * T,
      y: d.oar.take.y * T,
    });
    const battle = onFoot.battle ?? null;
    const who = caveSpeaker(world, onFoot);
    if (
      who !== null &&
      battle?.scene === d.oar.encounter &&
      battle.parley != null &&
      !battle.parley.done &&
      !battle.engaged
    ) {
      const a = onFoot.actors[who];
      const id = CAVE_TALKS[who];
      if (a !== undefined && id !== undefined)
        out.push({
          use: { kind: 'SEARCH', site: id, target: who },
          x: a.x,
          y: a.y,
          reach: (ctx.talks.get(id)?.reachTiles ?? 2) * T,
        });
    }
  }
  if (ritesOpen(world, ctx) && !carrying) {
    const body = bodyAt(world, ctx);
    if (body !== null && body.zone === map.zone)
      out.push({
        use: { kind: 'SEARCH', site: 'hild.rites', target: d.rites.recommends },
        x: body.actor.x,
        y: body.actor.y,
        reach: (ctx.talks.get('hild.rites')?.reachTiles ?? 1.6) * T,
      });
  }
  return out;
}

/** Whether a Stage 11 condition on a choice holds now. */
export function repairChoiceOpen(
  world: WorldState,
  ctx: RepairsContext,
  when: string,
): boolean | null {
  const ship = boatOf(world);
  switch (when) {
    case 'FIT_FREE':
      return (
        ship !== null &&
        ship.fitting === null &&
        ctx.def.fittings.every((f) => !Object.values(ship.fittings).includes(f))
      );
    case 'HAS_HOLD':
      return ship !== null && Object.values(ship.fittings).includes('FIT_EXTENDED_HOLD');
    case 'HAS_BOW_PLATFORM':
      return ship !== null && Object.values(ship.fittings).includes('FIT_RAISED_BOW_PLATFORM');
    case 'CAN_CARVE': {
      const carver = ctx.def.oar.carver;
      const p = world.people[carver];
      return (
        ship !== null &&
        ship.repairs.STEERING_OAR.stage === 'LACKING' &&
        world.facts[FACT_OAR] === undefined &&
        world.facts[FACT_CARVING] === undefined &&
        world.onFoot?.carrying !== ctx.def.oar.id &&
        world.household.residents.includes(carver) &&
        (p?.skills[ctx.def.oar.carveSkill] ?? 0) >= ctx.def.oar.carveLevel
      );
    }
    case 'HAS_FOOD': {
      const home = world.homes['ISLE_SKARV'];
      return (home?.stores['RES_SALTED_FISH'] ?? 0) >= ctx.b.repairs.oarFoodRd;
    }
    case 'GATE_OPEN':
      return world.gates[GATE_LAUNCH]?.status === 'OPEN';
    default:
      return null;
  }
}

/** The boat's words open: what it lacks, said as information lines after the opening line. */
export function boatLooked(world: WorldState, ctx: RepairsContext): void {
  const talk = world.talk;
  const ship = boatOf(world);
  if (talk === null || ship === null) return;
  const info = ctx.def.info;
  const lacks: [RepairKind, string][] = [
    ['HULL', 'lackHull'],
    ['RIGGING', 'lackRigging'],
    ['STEERING_OAR', 'lackOar'],
  ];
  const lacking = lacks.filter(([r]) => ship.repairs[r].stage !== 'DONE');
  for (const [, key] of lacking) {
    const k = info[key];
    if (k !== undefined) talk.queue.push({ speaker: '', key: k });
  }
  if (lacking.length === 0 && info['ready'] !== undefined)
    talk.queue.push({ speaker: '', key: info['ready'] });
  // Stage 12: ready, but the launch waits for everyone to be found (decision S12-2).
  if (lacking.length === 0 && world.gates[GATE_LAUNCH]?.status === 'CLOSED' && info['notYet'])
    talk.queue.push({ speaker: '', key: info['notYet'] });
}

/** What the simulation does for the repairs' choices beyond them. */
export interface RepairHooks {
  /** Start a "Repair the ship" action at the boat (taking a fitting off). */
  readonly work: (site: string) => void;
  /** The fight at the cave starts now (a threat, or a theft seen). */
  readonly fight: () => void;
  /** The scavengers take the price and stop being a fight. */
  readonly bargain: () => void;
}

/** A choice of the repairs' words: a fitting, the carving, a trade, the rites. */
export function chooseRepair(
  world: WorldState,
  ctx: RepairsContext,
  action: string,
  hooks: RepairHooks,
  emit: RepairEmit,
): void {
  const ship = boatOf(world);
  const onFoot = world.onFoot;
  switch (action) {
    case 'FIT_HOLD':
    case 'FIT_BOW': {
      if (ship?.fitting !== null) return;
      const id = action === 'FIT_HOLD' ? 'FIT_EXTENDED_HOLD' : 'FIT_RAISED_BOW_PLATFORM';
      const slot = ctx.ship.fittings.get(id)?.slot ?? 'MIDSHIP';
      ship.fitting = { id, slot, progress: 0 };
      return;
    }
    case 'UNSHIP': {
      const f = ship === null ? undefined : ctx.def.fittings.find((x) => fitted(ship, x));
      if (f !== undefined) hooks.work(`unship:${f}`);
      return;
    }
    case 'CARVE':
      setFact(world, FACT_CARVING, ctx.def.oar.carver);
      return;
    case 'TRADE_SILVER':
    case 'TRADE_FOOD': {
      if (onFoot === null || world.facts[FACT_OAR] !== undefined) return;
      if (action === 'TRADE_SILVER') setFact(world, 'ch1.chest', 'GIVEN');
      else {
        const home = world.homes['ISLE_SKARV'];
        if (home !== undefined)
          home.stores['RES_SALTED_FISH'] = Math.max(
            0,
            (home.stores['RES_SALTED_FISH'] ?? 0) - ctx.b.repairs.oarFoodRd,
          );
      }
      hooks.bargain();
      setFact(world, 'ch1.wreckers_oar', action === 'TRADE_SILVER' ? 'SILVER' : 'FOOD');
      giveOar(world, ctx, 'TRADE', emit);
      return;
    }
    case 'LAUNCH':
      emit({ type: 'READINESS_ASKED', gate: GATE_LAUNCH });
      return;
    case 'RITES_SETTING':
    case 'RITES_SEA':
      setFact(world, FACT_PENDING, action === 'RITES_SETTING' ? 'SETTING' : 'SEA');
      setFact(world, FACT_STAGE, action === 'RITES_SETTING' ? 'STONES' : 'GATHER');
      setFact(world, FACT_SINCE, minuteNow(world));
      emit({ type: 'SEARCH_INFO', key: ctx.def.rites.info['gather'] ?? '' });
      return;
  }
}

function fitted(ship: ShipInstance, fitting: Id): boolean {
  return Object.values(ship.fittings).includes(fitting);
}

/** A "Repair the ship" action ends (`site`): cut the rigging, work on the boat, take a fitting off. */
export function repairActionDone(
  world: WorldState,
  ctx: RepairsContext,
  site: string,
  workerMinutes: number,
  emit: RepairEmit,
): void {
  const onFoot = world.onFoot;
  if (site === 'rigging_cut') {
    if (onFoot === null || !riggingOnWreck(world)) return;
    const d = ctx.def.rigging;
    setFact(world, FACT_RIGGING_CUT, true);
    placeActor(onFoot, d.id, d.zone, {
      x: d.lies.x * 24,
      y: d.lies.y * 24,
      facing: d.lies.facing,
      pose: 'down',
    });
    emit({ type: 'RIGGING_CUT' });
    emit({ type: 'SEARCH_INFO', key: ctx.def.info['riggingCut'] ?? '' });
    return;
  }
  if (site.startsWith('unship:')) {
    const ship = boatOf(world);
    const f = site.slice('unship:'.length);
    if (ship !== null && unship(ship, f, world.calendar.day)) {
      emit({ type: 'FITTING_UNSHIPPED', fitting: f });
      emit({ type: 'SEARCH_INFO', key: ctx.def.info['unshipped'] ?? '' });
    }
    return;
  }
  if (site === 'boat_work') addShipWork(world, ctx, workerMinutes, 'P_STEERER', emit);
}

/** The steering oar handed over or found: it lies at the steerer's feet, to be carried. */
function giveOar(world: WorldState, ctx: RepairsContext, how: string, emit: RepairEmit): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const p = onFoot.player;
  setFact(world, FACT_OAR, how);
  placeActor(onFoot, ctx.def.oar.id, onFoot.zone, {
    x: p.x + 10,
    y: p.y + 4,
    facing: 'e',
    pose: 'down',
  });
  emit({ type: 'OAR_TAKEN', how });
  emit({ type: 'SEARCH_INFO', key: ctx.def.info['oarTaken'] ?? '' });
}

/**
 * The steerer takes the steering oar from the skiff. Unseen, it is a theft no one witnessed; seen,
 * it is a theft in plain sight and the fight is on; once the fight is on, it is the fight's; with
 * the scavengers all dead, the skiff gave it up (FOUND).
 */
export function takeOar(
  world: WorldState,
  ctx: RepairsContext,
  hooks: RepairHooks,
  emit: RepairEmit,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null || !oarInSkiff(world)) return;
  const battle = onFoot.battle ?? null;
  const here = battle?.scene === ctx.def.oar.encounter;
  const alive = WRECKERS.filter(
    (id) => world.people[id] !== undefined && world.people[id].status !== 'dead',
  );
  const seen = enemyAware(onFoot);
  let how: string;
  // Once the fight for it is on, the oar is the fight's, whoever still stands or has run.
  if (here && battle.engaged) how = 'FIGHT';
  else if (alive.length === 0) how = 'FOUND';
  else how = 'THEFT';
  if (how === 'THEFT') {
    appendDeed(world, {
      id: `DEED_${world.ledger.length + 1}`,
      tag: 'THEFT',
      day: world.calendar.day,
      placeId: ctx.def.oar.zone,
      doer: 'HOUSEHOLD',
      context: { item: ctx.def.oar.id, seen: seen.length > 0 },
      victims: [...alive],
      witnesses: seen.map((person) => ({ person, escaped: false })),
      identification: seen.length > 0 ? 1 : 0,
      marksSeen: [],
    });
  }
  giveOar(world, ctx, how, emit);
  if (how === 'THEFT' && seen.length > 0 && here && !battle.engaged) {
    emit({ type: 'SEARCH_INFO', key: ctx.def.info['oarSeen'] ?? '' });
    hooks.fight();
  }
}

/**
 * Something set down: one of the repairs' loads laid by the boat is its material there (the load is
 * taken into the boat's drawing); elsewhere it lies where it was put.
 */
export function repairSetDown(
  world: WorldState,
  ctx: RepairsContext,
  target: Id,
  map: ZoneMap,
  emit: RepairEmit,
): void {
  const onFoot = world.onFoot;
  const ship = boatOf(world);
  const d = ctx.def;
  const kinds: Readonly<Record<string, RepairKind>> = {
    [d.boards.id]: 'HULL',
    [d.rigging.id]: 'RIGGING',
    [d.oar.id]: 'STEERING_OAR',
  };
  const repair = kinds[target];
  const actor = onFoot?.actors[target];
  if (onFoot === null || ship === null || repair === undefined || actor === undefined) return;
  actor.pose = 'down';
  const T = map.tile;
  const near =
    map.zone === ship.lies.zone &&
    Math.hypot(actor.x - d.boat.x * T, actor.y - (d.boat.y - 0.5) * T) <= d.boat.layByTiles * T;
  if (!near || ship.repairs[repair].stage !== 'LACKING') return;
  ship.repairs[repair] = {
    stage: 'MATERIALS',
    progress: 0,
    ...(repair === 'STEERING_OAR' && typeof world.facts[FACT_OAR] === 'string'
      ? { how: world.facts[FACT_OAR] }
      : {}),
  };
  onFoot.actors = Object.fromEntries(Object.entries(onFoot.actors).filter(([k]) => k !== target));
  emit({ type: 'MATERIAL_LAID', repair });
  const key = { HULL: 'boardsLaid', RIGGING: 'riggingLaid', STEERING_OAR: 'oarLaid' }[repair];
  const line = d.lines[key];
  if (line === undefined) return;
  const speaker = line.startsWith('c_runa')
    ? 'C_RUNA'
    : line.startsWith('c_oddi')
      ? 'C_ODDI'
      : 'C_HILD';
  if (world.household.residents.includes(speaker))
    emit({ type: 'PERSON_SPOKE', person: speaker, lineKey: line });
}

/** Game minutes since the campaign began (the rites' clock). */
function minuteNow(world: WorldState): number {
  return world.calendar.day * 1440 + world.calendar.minuteOfDay;
}

/** Whether the rites move this resident rather than their day. */
export function repairsHold(world: WorldState, ctx: RepairsContext | null, id: Id): boolean {
  if (ctx === null || world.facts[FACT_PENDING] === undefined) return false;
  if (!world.household.residents.includes(id)) return false;
  // The sea taking Thorkel holds everyone at the water's edge, whatever else (DG-14).
  if (seaBurialActive(world)) return true;
  return world.player.awake && world.onFoot?.player.sleep == null;
}

/**
 * One tick of the repairs: they open; the scavengers go to Seal Cave after the sheepfold; the
 * rites gather, are sung, and end.
 */
export function stepRepairs(
  world: WorldState,
  ctx: RepairsContext,
  land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  tidalGroundOpen: boolean,
  emit: RepairEmit,
  wet: WetAt = () => false,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  // A version 8 save has no ship: the boat lies on the strand from the first tick, as in a new
  // campaign (decision S11-23).
  ensureBoat(world, ctx);
  if (world.facts[FACT_REPAIRS_OPEN] !== true) {
    if (world.facts[ctx.def.opensAfter] !== true) return;
    open(world, ctx);
  }
  // Out of the sheepfold by any road, the scavengers make for their skiff.
  if (world.facts['ch1.wreckers'] !== undefined && world.facts[FACT_WRECKERS_CAVE] !== true)
    setFact(world, FACT_WRECKERS_CAVE, true);
  // At the cave, the first time: the checkpoint before its danger.
  if (onFoot.zone === ctx.def.oar.zone && world.facts['repair.cave_seen'] !== true) {
    setFact(world, 'repair.cave_seen', true);
    emit({ type: 'CHECKPOINT', label: 'sealcave' });
  }
  // Hild asks for her father's rites once, when she is by his bier with the steerer.
  if (world.facts[FACT_RAISED] !== true && ritesOpen(world, ctx)) {
    const body = bodyAt(world, ctx);
    const p = onFoot.player;
    if (
      body !== null &&
      body.zone === onFoot.zone &&
      Math.hypot(body.actor.x - p.x, body.actor.y - p.y) <= ctx.def.rites.reachTiles * 24
    ) {
      setFact(world, FACT_RAISED, true);
      emit({
        type: 'PERSON_SPOKE',
        person: ctx.def.rites.recommends,
        lineKey: 'c_hild.rites.raise',
      });
    }
  }
  stepRites(world, ctx, land, tidalGroundOpen, emit, wet);
}

/** The rites under way: everyone to their place, the stones, the gathering, the rite, the end. */
function stepRites(
  world: WorldState,
  ctx: RepairsContext,
  land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  tidalGroundOpen: boolean,
  emit: RepairEmit,
  wet: WetAt,
): void {
  const onFoot = world.onFoot;
  const form = world.facts[FACT_PENDING];
  if (onFoot === null || (form !== 'SETTING' && form !== 'SEA')) return;
  const r = ctx.def.rites;
  // The sea takes him (DG-14): the scene plays to its end, then the rite is done.
  if (world.facts[FACT_STAGE] === 'TAKEN') {
    if (ctx.sea === null || !seaBurialActive(world)) {
      finishRites(world, ctx, 'SEA', emit);
      return;
    }
    const over = stepSeaBurial(
      world,
      ctx.sea,
      { body: r.body, guard: r.guard, caller: r.recommends, line: r.seaTaken },
      land,
      tidalGroundOpen,
      emit,
    );
    if (over) finishRites(world, ctx, 'SEA', emit);
    return;
  }
  const place = form === 'SETTING' ? r.setting : r.sea;
  const T = 24;
  const stage = world.facts[FACT_STAGE];
  const since = Number(world.facts[FACT_SINCE] ?? minuteNow(world));
  const awake = world.player.awake && onFoot.player.sleep == null;
  // The guard (Bran) carries the body to the rite's place, and lays it at its middle.
  if (world.facts[FACT_LAID] !== true) {
    const body = findActor(onFoot, r.body);
    const guard = findActor(onFoot, r.guard);
    const atPlace = { zone: place.zone, x: place.x * T + 18, y: place.y * T, facing: 'w' as const };
    if (body === null) return;
    // Stage 12 (decision S12-23): a guard lying downed cannot carry him either.
    if (
      guard === null ||
      !world.household.residents.includes(r.guard) ||
      !awake ||
      guard.actor.pose === 'down' ||
      guard.actor.pose === 'dead'
    ) {
      // No one to carry him in view: the household brings him.
      placeActor(onFoot, r.body, place.zone, {
        x: place.x * T,
        y: place.y * T,
        facing: 'e',
        pose: 'dead',
      });
      setFact(world, FACT_LAID, true);
    } else {
      if (guard.actor.carries === undefined) {
        // Lift him from the bier first: walk to him.
        const bodySpot = { zone: body.zone, x: body.actor.x + 18, y: body.actor.y };
        stepResident(
          onFoot,
          r.guard,
          { ...bodySpot, facing: 'w', pose: 'idle' },
          land.maps,
          land,
          tidalGroundOpen,
        );
        const g = findActor(onFoot, r.guard);
        if (
          g !== null &&
          g.zone === body.zone &&
          Math.hypot(g.actor.x - bodySpot.x, g.actor.y - bodySpot.y) < 2
        ) {
          g.actor.carries = r.body;
          body.actor.pose = 'carried';
        }
      } else {
        stepResident(
          onFoot,
          r.guard,
          { ...atPlace, pose: 'idle' },
          land.maps,
          land,
          tidalGroundOpen,
          false,
          land.movement.carry,
        );
        const g = findActor(onFoot, r.guard);
        if (g !== null) {
          if (g.actor.walk !== undefined) g.actor.moving = true;
          placeActor(onFoot, r.body, g.zone, {
            ...body.actor,
            x: g.actor.x,
            y: g.actor.y,
            facing: g.actor.facing,
            pose: 'carried',
          });
          if (
            g.zone === place.zone &&
            Math.hypot(g.actor.x - atPlace.x, g.actor.y - atPlace.y) < 1
          ) {
            delete g.actor.carries;
            delete g.actor.walk;
            delete g.actor.moving;
            placeActor(onFoot, r.body, place.zone, {
              x: place.x * T,
              y: place.y * T,
              facing: 'e',
              pose: 'dead',
            });
            setFact(world, FACT_LAID, true);
          }
        }
      }
    }
  }
  // Everyone else to their place round it: laying stones while the stones go down.
  const ids = world.household.residents.filter((id) => id !== r.guard || world.facts[FACT_LAID]);
  ids.forEach((id, i) => {
    const spot = place.around[i % place.around.length] ?? [place.x, place.y + 2];
    const pose = stage === 'STONES' ? 'work' : 'idle';
    stepResident(
      onFoot,
      id,
      {
        zone: place.zone,
        x: (spot[0] ?? place.x) * T,
        y: (spot[1] ?? place.y) * T,
        facing: (spot[1] ?? 0) > place.y ? 'n' : 's',
        pose,
        ...(pose === 'work' ? { task: 'TASK_BUILD' } : {}),
      },
      land.maps,
      land,
      tidalGroundOpen,
    );
  });
  const now = minuteNow(world);
  if (stage === 'STONES' && now - since >= ctx.b.rites.settingMinutes) {
    setFact(world, FACT_STAGE, 'GATHER');
    emit({ type: 'RITES_STONES' });
    emit({ type: 'SEARCH_INFO', key: r.info['stones'] ?? '' });
  }
  // The rite begins once the body is laid and the steerer has come to it.
  if (stage === 'GATHER' && world.facts[FACT_LAID] === true) {
    const p = onFoot.player;
    if (
      onFoot.zone === place.zone &&
      Math.hypot(p.x - place.x * T, p.y - place.y * T) <= r.reachTiles * T
    ) {
      setFact(world, FACT_STAGE, 'RITE');
      setFact(world, FACT_SINCE, now);
      setFact(world, FACT_LINE, 0);
      emit({ type: 'RITES_BEGAN', form });
    }
    return;
  }
  if (stage !== 'RITE') return;
  // The lines, spread over the rite; then the end.
  const lines = form === 'SETTING' ? r.lines.setting : r.lines.sea;
  const spoken = Number(world.facts[FACT_LINE] ?? 0);
  const length = ctx.b.rites.riteMinutes;
  const due = Math.min(lines.length, Math.floor(((now - since) / length) * (lines.length + 1)));
  for (let k = spoken; k < due; k++) {
    const key = lines[k];
    const speaker = key === undefined ? undefined : speakerOf(key);
    if (key !== undefined && speaker !== undefined && world.household.residents.includes(speaker))
      emit({ type: 'PERSON_SPOKE', person: speaker, lineKey: key });
  }
  if (due > spoken) setFact(world, FACT_LINE, due);
  if (now - since < length) return;
  // Given to the sea: the last word said, he is borne down to the water and taken (DG-14).
  if (form === 'SEA' && ctx.sea !== null) {
    setFact(world, FACT_STAGE, 'TAKEN');
    beginSeaBurial(
      world,
      ctx.sea,
      { zone: place.zone, x: place.x, y: place.y },
      (x, y) => wet(place.zone, x, y),
      land.movement.carry,
    );
    return;
  }
  finishRites(world, ctx, form, emit);
}

const SPEAKERS: Readonly<Record<string, Id>> = {
  c_hild: 'C_HILD',
  c_bran: 'C_BRAN',
  c_runa: 'C_RUNA',
  c_oddi: 'C_ODDI',
};

function speakerOf(key: string): Id | undefined {
  return SPEAKERS[key.split('.')[0] ?? ''];
}

/** The rite is done: its effects, its facts, the body laid to rest, and everyone back to the day. */
function finishRites(
  world: WorldState,
  ctx: RepairsContext,
  form: 'SETTING' | 'SEA',
  emit: RepairEmit,
): void {
  const onFoot = world.onFoot;
  const r = ctx.def.rites;
  const rb = ctx.b.rites;
  setFact(world, FACT_RITES, form === 'SETTING' ? 'SHIP_SETTING' : 'SEA_BURIAL');
  setFact(world, FACT_RING, form === 'SETTING' ? 'HILD' : 'RAN');
  Reflect.deleteProperty(world.facts, FACT_PENDING);
  setFact(world, FACT_STAGE, 'DONE');
  for (const id of world.household.residents) {
    const p = world.people[id];
    if (p === undefined) continue;
    const v = (k: string): number => (p.values as Readonly<Record<string, number>>)[k] ?? 0;
    p.friendship += rb.perValuePoint * (v('KIN') + v('FAITH'));
    if (id === r.guard) p.friendship += rb.guardFriendship;
    if (form === 'SEA') p.friendship += rb.seaGoldPerGain * v('GAIN');
    p.happiness += rb.happiness;
    clampMeasures(p);
    p.memories.push({
      day: world.calendar.day,
      kind: 'EVENT',
      about: 'THORKEL_RITES',
      source: 'SAW',
      detail: form,
    });
  }
  if (form === 'SEA') {
    const ran = (world.powers['POWER_RAN'] ?? {}) as Record<string, unknown>;
    world.powers['POWER_RAN'] = { ...ran, thorkelRing: world.calendar.day };
  }
  // The body: under its stones, or given to the sea.
  if (onFoot !== null)
    onFoot.actors = Object.fromEntries(Object.entries(onFoot.actors).filter(([k]) => k !== r.body));
  for (const rest of Object.values(onFoot?.elsewhere ?? {}))
    rest.actors = Object.fromEntries(Object.entries(rest.actors).filter(([k]) => k !== r.body));
  fireOneShot(world, r.beat, () => undefined);
  emit({ type: 'RITES_DONE', form });
  emit({
    type: 'SEARCH_INFO',
    key: (form === 'SETTING' ? r.info['settingDone'] : r.info['seaDone']) ?? '',
  });
}

/** What the rites look like now, for the scene: the stones laid and their share, and where. */
export function ritesView(
  world: WorldState,
  ctx: RepairsContext,
): { zone: Id; x: number; y: number; frame: 'marked' | 'half' | 'done' } | null {
  const stage = world.facts[FACT_STAGE];
  const done = world.facts[FACT_RITES] === 'SHIP_SETTING';
  if (!done && world.facts[FACT_PENDING] !== 'SETTING') return null;
  const s = ctx.def.rites.setting;
  const frame = done ? 'done' : stage === 'STONES' ? 'marked' : 'half';
  return { zone: s.zone, x: s.x, y: s.y, frame };
}
