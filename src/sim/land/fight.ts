/**
 * Fights on foot (Stage 9; Book 2 sections 12 and 13): the steerer's and everyone else's fighter
 * state machines (src/sim/combat/fighter.ts) placed in the zone; blows met by reach, arc and
 * facing; damage, the downed and the dead, gore's rolls; missiles that strike bodies and shields;
 * the enemy's perception, choices and morale; the crew's orders; the steerer's death with Second
 * wind; carrying the downed to a safe place and the left-behind at a scene's end; berserkers and
 * the cruel, who finish the downed only after a warning.
 *
 * It lives in sim/land because it needs the zone and its people (as the archer helper does,
 * decision DD-17); the state machine and perception it uses depend only on core and content.
 * Deterministic: the `combat` stream for blows and missiles, `ai` for choices, `gore` for
 * dismemberment.
 */
import type { TimeBalance } from '../../content/balance.ts';
import { parseAiBalance, parseCombatBalance } from '../../content/combatBalance.ts';
import type { AiBalance, CombatBalance, MeleeWeaponName } from '../../content/combatBalance.ts';
import type { CombatDef, Content, FighterDef } from '../../content/registry.ts';
import type { Id } from '../../core/ids.ts';
import { nextFloat } from '../../core/rng.ts';
import { hears, lightAt, remembered, sees, sightRange, stepNoise } from '../ai/perception.ts';
import type { Memory } from '../ai/perception.ts';
import { seasonOf } from '../calendar/calendar.ts';
import {
  blowOf,
  charging,
  damageOf,
  enterTimed,
  feetPlanted,
  free,
  hold,
  inFront,
  newFighter,
  OUT_OF_FIGHT,
  pressAttack,
  pressDodge,
  pressParry,
  pressShove,
  releaseAttack,
  resolveBlow,
  setBlock,
  staggerOnHit,
  stepFighter,
  strikePhase,
  striking,
} from '../combat/fighter.ts';
import type { Blow, Facing, Fighter, Outcome, StaminaPool } from '../combat/fighter.ts';
import { orderShot } from './archer.ts';
import { STEERER } from './missiles.ts';
import { facingOf, footprintClear, TICKS_PER_SECOND } from './onFoot.ts';
import type { LandContext, OnFootActor, OnFootState } from './onFoot.ts';
import { solidAt, terrainAt, tileOf } from './zoneMap.ts';
import { tilePath } from './path.ts';
import { parseSearchBalance } from '../../content/searchBalance.ts';
import type { ZoneMap } from './zoneMap.ts';
import type { WorldState } from '../world.ts';

export type CrewOrder = 'FOLLOW' | 'HOLD' | 'ATTACK' | 'PROTECT' | 'CARRY' | 'WITHDRAW';
export type Side = 'HOUSEHOLD' | 'ENEMY';
export type Piece = 'HEAD' | 'ARM' | 'LEG';

/** What a person's fighting brain is doing (Book 2 section 13's behaviours, those Stage 9 needs). */
export type AiMode = 'GUARD' | 'INVESTIGATE' | 'FIGHT' | 'FLEE' | 'SURRENDER' | 'ORDER';

export interface FighterAi {
  mode: AiMode;
  target: Id | null;
  memory: Memory | null;
  aware: boolean;
  /** The next decision (10 a second). */
  next: number;
  nextAttack: number;
  /** A held charge's release tick (-1: none). */
  releaseAt: number;
  /** A defence decided against an attacker's tell: what, when, until when. */
  react: { readonly kind: 'PARRY' | 'BLOCK'; readonly at: number; readonly until: number } | null;
  /** The tell (its tick) already judged, so each attack is judged once. */
  judged: number;
  /** Where they stand when nothing is happening, and the work they do there. */
  readonly home: { readonly x: number; readonly y: number; readonly facing: Facing };
  readonly task?: Id;
  /** The walk wanted this tick: a point, at a run or not (null: stand). */
  goal: { x: number; y: number; run: boolean; away?: boolean } | null;
  shouted: boolean;
  /** The tick it last started an attack (Book 10 attackTokens: the longest waiting goes next). */
  lastStruck?: number;
}

/** A person's part in a fight: their state machine, vitality, stamina, side and mind. */
export interface ActorFight {
  f: Fighter;
  side: Side;
  vitality: number;
  maxVitality: number;
  stamina: StaminaPool;
  staminaMax: number;
  /** The enemy group (the encounter), for morale. */
  group: Id | null;
  leader: boolean;
  /** Carries a bow, and the arrows in the quiver (Book 10 archerArrows). */
  bow: boolean;
  arrows: number;
  finishesDowned: boolean;
  /** Can fight at all (a serious wound: no; Book 10 section 08). */
  able: boolean;
  ai: FighterAi;
  berserkUntil: number;
  /** A finishing warning under way: the downed target and when it began (Book 10 finishWarning). */
  finishing: { readonly target: Id; readonly since: number } | null;
  /** The last blow taken: when, from which way, and whether heavy (gore's spray, the bloodied side). */
  lastHit: {
    readonly tick: number;
    readonly dx: number;
    readonly dy: number;
    readonly heavy: boolean;
  } | null;
  bloodied: boolean;
  /** Dead: when, the piece taken (gore), the direction it flew (16). */
  dead: { readonly tick: number; readonly piece: Piece | null; readonly dir: number } | null;
  /** A crew order (Book 2 section 12): what, at whom, where, since when. */
  order: {
    readonly kind: CrewOrder;
    readonly target: Id | null;
    readonly at: { readonly x: number; readonly y: number } | null;
    readonly since: number;
  } | null;
  /** The steerer's last fight tick near them (an order lapses after a quiet hour). */
  quietSince: number;
}

/** A group's morale (Book 10 section 07, "Cohesion and surrender"). */
export interface GroupMorale {
  cohesion: number;
  members: Id[];
  leader: Id | null;
  readonly takesCaptives: boolean;
  outnumberedSince: number | null;
  broken: boolean;
  bloodied: Id[];
}

/** The fight under way in the zone in view. */
export interface Battle {
  readonly scene: Id | null;
  readonly started: number;
  groups: Record<Id, GroupMorale>;
  secondWindUsed: boolean;
  steererDownedAt: number | null;
  /** An enemy has become aware: the fight is on. */
  engaged: boolean;
  over: boolean;
  /** The last tick anyone struck or shot in it. */
  lastBlow: number;
  /** Book 10 attackTokens: the last tick each side was in an attack on each target ("side:target"). */
  lastAttack?: Record<string, number>;
  /**
   * Stage 10 (decision S10-9): enemies who hold and talk with a steerer come with empty hands, until
   * this tick (Book 10 The three searches, parley); `done` once a parley has ended, so it never
   * starts again in this fight.
   */
  parley?: { until: number; done: boolean } | null;
}

export interface FightContext {
  readonly cb: CombatBalance;
  readonly ai: AiBalance;
  readonly def: CombatDef;
  readonly fighters: ReadonlyMap<Id, FighterDef>;
  readonly daylight: TimeBalance['daylight'];
  /** Stage 10 (Book 10 The three searches): a parley's ticks, and an ally's guard in tiles. */
  readonly parleyTicks: number;
  readonly guardTiles: number;
}

export function fightContext(
  content: Pick<Content, 'combat'>,
  balance: unknown,
  daylight: TimeBalance['daylight'],
): FightContext | null {
  const def = content.combat;
  if (def == null) return null;
  const searches = parseSearchBalance(balance);
  return {
    cb: parseCombatBalance(balance),
    ai: parseAiBalance(balance),
    def,
    fighters: new Map(def.fighters.map((f) => [f.person, f])),
    daylight,
    parleyTicks: Math.round(searches.parleySeconds * TICKS_PER_SECOND),
    guardTiles: searches.guardTiles,
  };
}

/** The encounter a battle belongs to. */
function encounterOf(
  ctx: FightContext,
  battle: Battle | null | undefined,
): CombatDef['encounters'][number] | undefined {
  if (battle == null) return undefined;
  return ctx.def.encounters.find((e) => e.id === battle.scene);
}

/** Whether a person fights beside the household in this battle without being a resident (Bran). */
function allyOf(ctx: FightContext, battle: Battle | null | undefined, id: Id): boolean {
  return encounterOf(ctx, battle)?.allies?.includes(id) === true;
}

/**
 * Whether the steerer comes as one to talk with (Stage 10, decision S10-9): empty hands (no
 * weapon or bow selected), not running, not mid-blow.
 */
export function openHanded(world: WorldState, ctx: FightContext): boolean {
  const onFoot = world.onFoot;
  if (onFoot === null) return false;
  const p = onFoot.player;
  const item = world.player.hotbar.slots[world.player.hotbar.selected] ?? null;
  const armed = item !== null && (weaponRow(ctx, item) !== null || item === 'ITEM_BOW');
  const f = p.fight;
  const striking = f != null && f.state !== 'idle';
  return !armed && !striking && p.aim === null && !(p.moving && p.gait === 'run');
}

/** The fight begins now (Stage 10: Bran's call, a threat, or a parley broken). */
export function startFight(fw: FightWorld): void {
  const onFoot = fw.world.onFoot;
  const battle = onFoot?.battle ?? null;
  if (onFoot == null || battle === null || battle.over) return;
  battle.parley = { until: fw.world.tick, done: true };
  const p = onFoot.player;
  for (const [id, a] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    const fa = a.fight;
    if (fa?.side !== 'ENEMY' || !fighting(fa)) continue;
    fa.ai.memory = { x: p.x, y: p.y, tick: fw.world.tick, seen: true };
    fa.ai.target = STEERER;
    if (!fa.ai.aware) {
      fa.ai.aware = true;
      delete a.task;
      a.pose = 'idle';
      fw.emit({ type: 'ENEMY_AWARE', person: id });
    }
    fa.ai.next = fw.world.tick;
  }
  if (!battle.engaged) {
    battle.engaged = true;
    fw.emit({ type: 'FIGHT_STARTED', scene: battle.scene });
  }
}

/**
 * The scavengers take the silver and go (Stage 10, the bargain): they stop being a fight; the
 * searches walk them off. The battle is over without a blow.
 */
export function endInBargain(fw: FightWorld): void {
  const onFoot = fw.world.onFoot;
  const battle = onFoot?.battle ?? null;
  if (onFoot == null || battle === null) return;
  for (const a of Object.values(onFoot.actors)) {
    if (a.fight?.side !== 'ENEMY') continue;
    delete a.fight;
    delete a.task;
    delete a.archer;
    a.aim = null;
    a.pose = 'idle';
  }
  onFoot.battle = null;
}

/** The Book 10 weapon row of an item, or null (the bow, a tool, empty hands). */
export function weaponRow(ctx: FightContext, item: Id | null | undefined): MeleeWeaponName | null {
  if (item == null) return null;
  return ctx.def.weapons[item]?.row ?? null;
}

export type FightEvent =
  | { readonly type: 'FIGHT_STARTED'; readonly scene: Id | null }
  | { readonly type: 'FIGHT_ENDED'; readonly scene: Id | null }
  | { readonly type: 'ENCOUNTER_STARTED'; readonly scene: Id; readonly checkpoint: string }
  | { readonly type: 'ENEMY_AWARE'; readonly person: Id }
  | { readonly type: 'ATTACK_STARTED'; readonly who: Id; readonly heavy: boolean }
  | { readonly type: 'CHARGE_LEVEL'; readonly who: Id; readonly level: 1 | 2 }
  | { readonly type: 'SWING'; readonly who: Id; readonly heavy: boolean; readonly weapon: string }
  | {
      readonly type: 'BLOW';
      readonly attacker: Id;
      readonly defender: Id;
      readonly outcome: Outcome;
      readonly damage: number;
      readonly heavy: boolean;
      readonly x: number;
      readonly y: number;
      readonly dx: number;
      readonly dy: number;
      readonly material: 'FLESH' | 'SHIELD' | 'MAIL' | 'NONE';
    }
  | { readonly type: 'DODGED'; readonly who: Id }
  | { readonly type: 'SHOVE_LANDED'; readonly who: Id; readonly target: Id }
  | { readonly type: 'PERSON_DOWNED'; readonly person: Id }
  | {
      readonly type: 'PERSON_KILLED';
      readonly person: Id;
      readonly by: Id;
      readonly piece: Piece | null;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'PERSON_SURRENDERED'; readonly person: Id }
  | { readonly type: 'PERSON_FLED'; readonly person: Id }
  | { readonly type: 'PERSON_BROUGHT_HOME'; readonly person: Id }
  | {
      readonly type: 'LEFT_BEHIND';
      readonly person: Id;
      readonly fate: 'CAPTURED' | 'KILLED' | 'GRAVE';
    }
  | { readonly type: 'STEERER_DOWNED'; readonly secondWind: boolean }
  | { readonly type: 'STEERER_LIFTED'; readonly by: Id }
  | { readonly type: 'STEERER_DIED'; readonly day: number }
  | { readonly type: 'FINISH_WARNING'; readonly by: Id; readonly target: Id }
  | { readonly type: 'BERSERK'; readonly person: Id }
  | { readonly type: 'CREW_ORDER_ACK'; readonly person: Id; readonly order: CrewOrder }
  | {
      readonly type: 'CREW_ORDER_REFUSED';
      readonly person: Id;
      readonly order: CrewOrder;
      readonly reason: 'CANNOT_FIGHT' | 'NO_TARGET';
    }
  | { readonly type: 'FIGHT_REFUSED'; readonly reason: 'NO_SHIELD' | 'NO_STAMINA' };

/** The few other events a fight sends (a line spoken). */
export type FightEmit = (
  e:
    | FightEvent
    | {
        readonly type: 'PERSON_SPOKE';
        readonly person: Id;
        readonly lineKey: string;
        readonly bark?: string;
      },
) => void;

// ------------------------------------------------------------------------------- set-up

/** The steerer's fighter, made on first need, with the weapon in hand (or none). */
export function steererFighter(world: WorldState, ctx: FightContext): Fighter | null {
  const onFoot = world.onFoot;
  if (onFoot === null) return null;
  const p = onFoot.player;
  const item = world.player.hotbar.slots[world.player.hotbar.selected] ?? null;
  p.fight ??= newFighter(weaponRow(ctx, item), { facing: p.facing });
  // What is in hand changes only between blows.
  if (p.fight.state === 'idle') {
    p.fight.weapon = weaponRow(ctx, item);
    p.fight.shield = world.player.hotbar.slots.includes('ITEM_SHIELD');
  }
  return p.fight;
}

function newAi(x: number, y: number, facing: Facing, task?: Id): FighterAi {
  return {
    mode: 'GUARD',
    target: null,
    memory: null,
    aware: false,
    next: 0,
    nextAttack: 0,
    releaseAt: -1,
    react: null,
    judged: -1,
    home: { x, y, facing },
    ...(task === undefined ? {} : { task }),
    goal: null,
    shouted: false,
  };
}

/** Whether a resident can fight: no serious or grave wound (Book 10 section 08, Wounds). */
export function canFight(world: WorldState, id: Id): boolean {
  const p = world.people[id];
  if (p === undefined) return false;
  return !p.wounds.some((w) => w.severity === 'SERIOUS' || w.severity === 'GRAVE');
}

/** A resident's part in a fight, made on first need from the crew's arms. */
export function crewFight(world: WorldState, ctx: FightContext, id: Id): ActorFight | null {
  const actor = world.onFoot?.actors[id];
  const person = world.people[id];
  if (actor === undefined || person === undefined) return null;
  if (actor.fight !== undefined) return actor.fight;
  const arms = ctx.def.crew[id] ?? {};
  const f = newFighter(weaponRow(ctx, arms.weapon), {
    shield: arms.shield ?? false,
    heavy: arms.heavy ?? false,
    facing: actor.facing,
  });
  actor.fight = {
    f,
    side: 'HOUSEHOLD',
    vitality: person.vitality,
    maxVitality: ctx.cb.vitality,
    stamina: { current: ctx.cb.stamina.max, spentTick: 0 },
    staminaMax: ctx.cb.stamina.max,
    group: null,
    leader: false,
    bow: arms.bow ?? false,
    arrows: arms.bow === true ? ctx.ai.habits.archerArrows : 0,
    finishesDowned: false,
    able: canFight(world, id) && arms.weapon !== undefined,
    ai: newAi(actor.x, actor.y, actor.facing),
    berserkUntil: -1,
    finishing: null,
    lastHit: null,
    bloodied: false,
    dead: null,
    order: null,
    quietSince: world.tick,
  };
  return actor.fight;
}

/**
 * The encounters due (combat.json): when the steerer is in the encounter's zone and its fact
 * holds, its people are placed there, once (a one-shot), and a fight is ready.
 */
export function spawnEncounters(
  world: WorldState,
  ctx: FightContext,
  map: ZoneMap,
  emit: FightEmit,
  force?: Id,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  for (const enc of ctx.def.encounters) {
    if (enc.zone !== onFoot.zone) continue;
    const key = `enc.${enc.id}`;
    if (world.facts[key] !== undefined) continue;
    if (force !== enc.id && enc.after !== undefined && world.facts[enc.after] !== true) continue;
    world.facts[key] = true;
    const group: GroupMorale = {
      cohesion: ctx.ai.cohesion.start,
      members: [],
      leader: null,
      takesCaptives: enc.takesCaptives,
      outnumberedSince: null,
      broken: false,
      bloodied: [],
    };
    for (const m of enc.members) {
      const fd = ctx.fighters.get(m.person);
      const person = world.people[m.person];
      if (fd === undefined || person === undefined) continue;
      const arch = ctx.ai.archetypes[fd.archetype] ?? { vitality: ctx.cb.vitality, armour: 'NONE' };
      const x = m.x * map.tile;
      const y = m.y * map.tile;
      const actor: OnFootActor = {
        x,
        y,
        facing: m.facing,
        pose: m.task === undefined ? 'idle' : 'work',
        ...(m.task === undefined ? {} : { task: m.task }),
      };
      let cohesion = 0;
      if (person.traits.some((t) => t.trait === 'BRAVE')) cohesion = ctx.ai.braveCohesion;
      group.cohesion += cohesion;
      actor.fight = {
        f: newFighter(weaponRow(ctx, fd.weapon), {
          shield: fd.shield ?? false,
          heavy: fd.heavy ?? false,
          armour: arch.armour,
          facing: m.facing,
        }),
        side: 'ENEMY',
        vitality: arch.vitality,
        maxVitality: arch.vitality,
        stamina: { current: ctx.cb.stamina.max, spentTick: 0 },
        staminaMax: ctx.cb.stamina.max,
        group: enc.id,
        leader: fd.leader ?? false,
        bow: fd.bow ?? false,
        arrows: fd.bow === true ? ctx.ai.habits.archerArrows : 0,
        finishesDowned: fd.finishesDowned ?? false,
        able: true,
        ai: newAi(x, y, m.facing, m.task),
        berserkUntil: -1,
        finishing: null,
        lastHit: null,
        bloodied: false,
        dead: null,
        order: null,
        quietSince: world.tick,
      };
      person.vitality = arch.vitality;
      person.status = 'alive';
      onFoot.actors[m.person] = actor;
      group.members.push(m.person);
      if (fd.leader === true) group.leader = m.person;
    }
    onFoot.battle = {
      scene: enc.id,
      started: world.tick,
      groups: { [enc.id]: group },
      secondWindUsed: false,
      steererDownedAt: null,
      engaged: false,
      over: false,
      lastBlow: -1,
    };
    emit({ type: 'ENCOUNTER_STARTED', scene: enc.id, checkpoint: enc.checkpoint });
  }
}

// ------------------------------------------------------------------------------ queries

/** Where a person stands (the steerer or an actor). */
export function whereIs(
  onFoot: OnFootState,
  id: Id,
): { x: number; y: number; facing: Facing } | null {
  if (id === STEERER) return onFoot.player;
  return onFoot.actors[id] ?? null;
}

export function fighterOf(onFoot: OnFootState, id: Id): Fighter | null {
  if (id === STEERER) return onFoot.player.fight ?? null;
  return onFoot.actors[id]?.fight?.f ?? null;
}

/**
 * Whether the fight moves a resident rather than their day (Stage 9): lying downed, carried or
 * dead, under a crew order, berserk, coming to lift the downed steerer, or fighting.
 */
export function heldByFight(world: WorldState, id: Id, a: OnFootActor): boolean {
  if (a.pose === 'down' || a.pose === 'carried' || a.pose === 'dead') return true;
  if (world.people[id]?.status === 'downed') return true;
  const fa = a.fight;
  if (fa === undefined) return false;
  if (fa.order !== null || fa.berserkUntil > world.tick || a.carries !== undefined) return true;
  const battle = world.onFoot?.battle ?? null;
  if (battle === null || battle.over || !battle.engaged) return false;
  if (world.onFoot?.player.fight?.state === 'downed') return true;
  return fa.f.state !== 'idle' || (fa.able && fa.ai.target !== null && fa.f.weapon !== null);
}

/** Whether an enemy in the zone is aware of the household and still able to fight. */
export function hostilesAware(onFoot: OnFootState | null): number {
  if (onFoot === null) return 0;
  let n = 0;
  for (const a of Object.values(onFoot.actors)) {
    const fa = a.fight;
    if (fa?.side === 'ENEMY' && fa.ai.aware && fighting(fa)) n++;
  }
  return n;
}

/** Still in the fight: not dead, downed, surrendered or fled. */
export function fighting(fa: ActorFight): boolean {
  return !OUT_OF_FIGHT.includes(fa.f.state) && fa.ai.mode !== 'FLEE';
}

/** A safe place for the downed (combat.json safePlaces), at a point. */
export function inSafePlace(
  ctx: FightContext,
  zone: Id,
  x: number,
  y: number,
  tile: number,
): boolean {
  return ctx.def.safePlaces.some(
    (s) => s.zone === zone && Math.hypot(x - s.x * tile, y - s.y * tile) <= s.r * tile,
  );
}

// ---------------------------------------------------------------------------- commands

function pool(world: WorldState): StaminaPool {
  return world.player.stamina;
}

/** The melee press: the charge begins (or a chain is queued, or a riposte). */
export function meleePress(
  world: WorldState,
  ctx: FightContext,
  facing: Facing,
  emit: FightEmit,
): void {
  const f = steererFighter(world, ctx);
  if (f?.weapon == null || world.onFoot?.carrying != null) return;
  const r = pressAttack(f, world.tick, ctx.cb, facing, pool(world));
  if (r === 'NO_STAMINA') emit({ type: 'FIGHT_REFUSED', reason: 'NO_STAMINA' });
  if (r === 'STARTED') {
    emit({ type: 'ATTACK_STARTED', who: STEERER, heavy: false });
    if (f.state === 'riposte')
      emit({ type: 'SWING', who: STEERER, heavy: false, weapon: f.weapon });
  }
}

export function meleeRelease(world: WorldState, ctx: FightContext, emit: FightEmit): void {
  const f = world.onFoot?.player.fight;
  if (f == null || !charging(f)) return;
  releaseAttack(f, world.tick, ctx.cb, pool(world));
  if (striking(f))
    emit({ type: 'SWING', who: STEERER, heavy: f.level > 0, weapon: f.weapon ?? '' });
}

export function steererParry(world: WorldState, ctx: FightContext, emit: FightEmit): void {
  const f = steererFighter(world, ctx);
  if (f === null || world.onFoot?.carrying != null) return;
  const r = pressParry(f, world.tick, ctx.cb, pool(world));
  if (r === 'NO_STAMINA') emit({ type: 'FIGHT_REFUSED', reason: 'NO_STAMINA' });
}

export function steererBlock(
  world: WorldState,
  ctx: FightContext,
  on: boolean,
  emit: FightEmit,
): void {
  const f = steererFighter(world, ctx);
  if (f === null || (on && world.onFoot?.carrying != null)) return;
  const r = setBlock(f, on, world.tick);
  if (r === 'NO_SHIELD') emit({ type: 'FIGHT_REFUSED', reason: 'NO_SHIELD' });
}

export function steererDodge(
  world: WorldState,
  ctx: FightContext,
  dir: { x: number; y: number } | null,
  emit: FightEmit,
): void {
  const f = steererFighter(world, ctx);
  if (f === null) return;
  const r = pressDodge(f, world.tick, ctx.cb, dir, pool(world));
  if (r === 'NO_STAMINA') emit({ type: 'FIGHT_REFUSED', reason: 'NO_STAMINA' });
  if (r === 'STARTED') emit({ type: 'DODGED', who: STEERER });
}

/** The shove (Book 10: its stamina, its timing and reach, the stagger it gives). */
export function steererShove(
  world: WorldState,
  ctx: FightContext,
  facing: Facing,
  emit: FightEmit,
): boolean {
  const f = steererFighter(world, ctx);
  if (f === null) return false;
  const r = pressShove(f, world.tick, ctx.cb, facing, pool(world));
  if (r === 'NO_STAMINA') emit({ type: 'FIGHT_REFUSED', reason: 'NO_STAMINA' });
  return r === 'STARTED';
}

/** The held finisher (Book 10 finisherHold) on the downed or surrendered within reach. */
export function finisherTarget(world: WorldState, ctx: FightContext, tile: number): Id | null {
  const onFoot = world.onFoot;
  const f = onFoot?.player.fight;
  if (onFoot === null || f?.weapon == null) return null;
  const reach = (ctx.cb.weapons[f.weapon].reachTiles + ctx.cb.bodyRadiusTiles + 0.5) * tile;
  let best: { id: Id; d: number } | null = null;
  for (const [id, a] of Object.entries(onFoot.actors).sort(([x], [y]) => (x < y ? -1 : 1))) {
    const fa = a.fight;
    if (fa?.side !== 'ENEMY' || fa.dead !== null) continue;
    if (fa.f.state !== 'surrendered' && fa.f.state !== 'downed') continue;
    const d = Math.hypot(a.x - onFoot.player.x, a.y - onFoot.player.y);
    if (d <= reach && (best === null || d < best.d)) best = { id, d };
  }
  return best?.id ?? null;
}

/**
 * A crew order on a quick key (Book 2 section 12): every resident in the zone takes it, says so
 * (a bark) or says why not (a serious wound: they cannot fight or carry).
 */
export function crewOrder(
  world: WorldState,
  ctx: FightContext,
  order: CrewOrder,
  emit: FightEmit,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  for (const id of [...world.household.residents].sort()) {
    const actor = onFoot.actors[id];
    if (actor === undefined || actor.pose === 'down' || actor.pose === 'carried') continue;
    const fa = crewFight(world, ctx, id);
    if (fa === null || fa.f.state === 'downed') continue;
    const needsFight = order === 'ATTACK' || order === 'PROTECT' || order === 'CARRY';
    if (needsFight && !fa.able) {
      emit({ type: 'CREW_ORDER_REFUSED', person: id, order, reason: 'CANNOT_FIGHT' });
      say(ctx, id, 'refuse', emit, world.tick);
      continue;
    }
    if (fa.berserkUntil > world.tick) continue;
    const target =
      order === 'ATTACK' ? steererTarget(onFoot) : order === 'PROTECT' ? STEERER : null;
    fa.order = {
      kind: order,
      target,
      at: order === 'HOLD' ? { x: actor.x, y: actor.y } : null,
      since: world.tick,
    };
    fa.quietSince = world.tick;
    fa.ai.mode = 'ORDER';
    emit({ type: 'CREW_ORDER_ACK', person: id, order });
    say(ctx, id, order, emit, world.tick);
  }
}

/** The enemy the steerer means: the nearest one in front, able, within sight. */
function steererTarget(onFoot: OnFootState): Id | null {
  const p = onFoot.player;
  let best: { id: Id; d: number } | null = null;
  for (const [id, a] of Object.entries(onFoot.actors).sort(([x], [y]) => (x < y ? -1 : 1))) {
    const fa = a.fight;
    if (fa?.side !== 'ENEMY' || !fighting(fa)) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    const front = inFront(p.facing, a.x - p.x, a.y - p.y, 180) ? 0 : 1000;
    if (best === null || d + front < best.d) best = { id, d: d + front };
  }
  return best?.id ?? null;
}

/** A line from someone's barks (combat.json), the first not said in the last ten seconds. */
function say(ctx: FightContext, id: Id, kind: string, emit: FightEmit, tick: number): void {
  const lines = ctx.def.barks[id]?.[kind];
  if (lines === undefined || lines.length === 0) return;
  const key = lines[Math.floor(tick / 7) % lines.length] ?? lines[0] ?? '';
  emit({ type: 'PERSON_SPOKE', person: id, lineKey: key, bark: kind });
}

// --------------------------------------------------------------------------- the tick

export interface FightWorld {
  readonly world: WorldState;
  readonly ctx: FightContext;
  readonly land: Pick<LandContext, 'maps' | 'movement' | 'rules' | 'missiles'>;
  readonly map: ZoneMap;
  readonly tidalGroundOpen: boolean;
  /** Whether a point is in the water now (by the tide): no one takes a flank there. */
  readonly wet?: (x: number, y: number) => boolean;
  /** Time balance (daylight). */
  readonly emit: FightEmit;
  /** Applies a household deed (KILLING, SURRENDERED_KILLED) through the people's measures. */
  readonly deed: (tag: string, victims: readonly Id[], witnesses: readonly Id[]) => void;
  /** Rán's mercy and Second wind (the campaign's options). */
  readonly options: {
    readonly secondWind: boolean;
    readonly ransMercy: boolean;
    readonly parryWindow: number;
  };
}

const ORDERLY = (a: [string, OnFootActor], b: [string, OnFootActor]): number =>
  a[0] < b[0] ? -1 : 1;

/**
 * One tick of the fight in the zone in view: the steerer's state machine, every fighter's choice,
 * walk and state machine, blows landing, morale, the downed steerer's Second wind, warnings, and
 * the fight's end.
 */
export function stepFight(fw: FightWorld): void {
  const { world, ctx } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null || world.gameOver !== null) return;
  const tick = world.tick;
  // The steerer's own state machine.
  const sf = onFoot.player.fight;
  if (sf != null) {
    for (const e of stepFighter(sf, tick, ctx.cb, pool(world))) {
      if (e.type === 'CHARGE_LEVEL')
        fw.emit({ type: 'CHARGE_LEVEL', who: STEERER, level: e.level });
      if (e.type === 'AUTO_RELEASE')
        fw.emit({ type: 'SWING', who: STEERER, heavy: sf.level > 0, weapon: sf.weapon ?? '' });
    }
  }
  if (sf != null)
    onFoot.player.blocking = sf.shield && (sf.state === 'block' || sf.state === 'blockStun');
  const battle = onFoot.battle ?? null;
  // The household in the zone takes part once a fight is under way (Second wind, orders).
  if (battle !== null && !battle.over && battle.engaged) {
    for (const r of world.household.residents)
      if (onFoot.actors[r] !== undefined) crewFight(world, ctx, r);
    // Stage 10: those who fight beside the household though not of it yet (Bran at the fold).
    for (const r of encounterOf(ctx, battle)?.allies ?? [])
      if (onFoot.actors[r]?.pose === 'idle') crewFight(world, ctx, r);
  }
  const actors = Object.entries(onFoot.actors).sort(ORDERLY);
  // Fighters choose, then their state machines run, then they walk.
  for (const [id, a] of actors) {
    const fa = a.fight;
    if (fa === undefined) continue;
    if (fa.dead === null && fa.f.state !== 'downed') think(fw, id, a, fa);
    for (const e of stepFighter(fa.f, tick, ctx.cb, fa.stamina)) {
      if (e.type === 'CHARGE_LEVEL') fw.emit({ type: 'CHARGE_LEVEL', who: id, level: e.level });
    }
    regen(fa, ctx, tick);
    a.blocking = fa.f.shield && (fa.f.state === 'block' || fa.f.state === 'blockStun');
    if (fa.f.state !== 'idle' || fa.dead !== null) a.facing = fa.f.facing;
    walk(fw, id, a, fa);
  }
  // Who is in an attack on whom this tick (Book 10 attackTokens, S9-29).
  if (battle !== null)
    for (const [, a] of actors) {
      const fa = a.fight;
      if (fa?.ai.target == null || !inAttack(a, tick)) continue;
      battle.lastAttack ??= {};
      battle.lastAttack[`${fa.side}:${fa.ai.target}`] = tick;
    }
  // The steerer's dodge moves them (stepMovement plants the feet otherwise).
  // Blows: every strike in its first active tick that has not yet met anyone.
  const strikers: [Id, Fighter, { x: number; y: number }][] = [];
  if (sf != null) strikers.push([STEERER, sf, onFoot.player]);
  for (const [id, a] of actors) if (a.fight !== undefined) strikers.push([id, a.fight.f, a]);
  for (const [id, f, at] of strikers) {
    if (strikePhase(f, tick) !== 'active' || f.hit) continue;
    if (f.state === 'shove') shoveLands(fw, id, f, at);
    else strikeLands(fw, id, f, at);
  }
  finishWarnings(fw);
  secondWind(fw);
  if (battle !== null) morale(fw, battle);
}

/** Stamina comes back after Book 10's pause, half while blocking. */
function regen(fa: ActorFight, ctx: FightContext, tick: number): void {
  const s = fa.stamina;
  if (tick - s.spentTick < ctx.cb.stamina.regenDelay || s.current >= fa.staminaMax) return;
  const rate = ctx.cb.stamina.regenPerSecond * (fa.f.state === 'block' ? 0.5 : 1);
  s.current = Math.min(fa.staminaMax, s.current + rate / TICKS_PER_SECOND);
}

/** Everyone in the zone who can be struck, with where they are and their fighter. */
function targets(
  onFoot: OnFootState,
): [Id, { x: number; y: number; facing: Facing }, Fighter | null][] {
  const out: [Id, { x: number; y: number; facing: Facing }, Fighter | null][] = [];
  out.push([STEERER, onFoot.player, onFoot.player.fight ?? null]);
  for (const [id, a] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    if (a.pose === 'carried' || a.pose === 'dead') continue;
    out.push([id, a, a.fight?.f ?? null]);
  }
  return out;
}

function sideOf(onFoot: OnFootState, id: Id): Side | null {
  if (id === STEERER) return 'HOUSEHOLD';
  return onFoot.actors[id]?.fight?.side ?? null;
}

/**
 * A strike's active tick: it meets everyone of the other side within its reach (to the near edge
 * of their body) and in its arc in front, nearest first; each is resolved and the strike is spent.
 */
function strikeLands(fw: FightWorld, id: Id, f: Fighter, at: { x: number; y: number }): void {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null || f.weapon === null) return;
  const tile = map.tile;
  const reach = (ctx.cb.weapons[f.weapon].reachTiles + ctx.cb.bodyRadiusTiles) * tile;
  const mySide = sideOf(onFoot, id);
  const berserk = (onFoot.actors[id]?.fight?.berserkUntil ?? -1) > world.tick;
  const hit: [Id, number][] = [];
  for (const [tid, pos, tf] of targets(onFoot)) {
    if (tid === id) continue;
    const theirs = sideOf(onFoot, tid);
    // The steerer strikes anyone fighting; others strike the other side (a berserker, anyone).
    if (id !== STEERER && !berserk && (theirs === mySide || theirs === null)) continue;
    if (id === STEERER && theirs === 'HOUSEHOLD') continue;
    if (tf !== null && (tf.state === 'dead' || (tf.state === 'downed' && !berserk))) continue;
    const dx = pos.x - at.x;
    const dy = pos.y - at.y;
    const d = Math.hypot(dx, dy);
    if (d > reach || !inFront(f.facing, dx, dy, ctx.cb.strikeArcDegrees)) continue;
    hit.push([tid, d]);
  }
  if (hit.length === 0) return;
  hit.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  f.hit = true;
  const blow = blowOf(f, ctx.cb, { berserk });
  for (const [tid] of hit) landBlow(fw, id, f, tid, blow, at);
  if (fw.world.onFoot?.battle != null) fw.world.onFoot.battle.lastBlow = world.tick;
}

function landBlow(
  fw: FightWorld,
  attacker: Id,
  af: Fighter,
  defender: Id,
  blow: Blow,
  from: { x: number; y: number },
): void {
  const { world, ctx } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const pos = whereIs(onFoot, defender);
  if (pos === null) return;
  const df =
    defender === STEERER ? steererFighter(world, ctx) : (onFoot.actors[defender]?.fight?.f ?? null);
  const dpool = defender === STEERER ? pool(world) : onFoot.actors[defender]?.fight?.stamina;
  let outcome: Outcome = 'HIT';
  const toAttacker = { x: from.x - pos.x, y: from.y - pos.y };
  if (df !== null && dpool !== undefined)
    outcome = resolveBlow(
      af,
      df,
      blow,
      toAttacker,
      world.tick,
      ctx.cb,
      fw.options.parryWindow,
      dpool,
    );
  const heavy = !blow.light;
  let damage = 0;
  const material =
    outcome === 'BLOCKED'
      ? 'SHIELD'
      : outcome === 'HIT' || outcome === 'GUARD_BROKEN'
        ? 'FLESH'
        : 'NONE';
  if (outcome === 'HIT' || outcome === 'GUARD_BROKEN') {
    const fa = onFoot.actors[defender]?.fight;
    const armour = df?.armour ?? 'NONE';
    damage = damageOf(blow, armour, ctx.cb, (fa?.berserkUntil ?? -1) > world.tick);
  }
  // A hit stop: both hold for Book 10's ticks.
  if (outcome !== 'DODGED') {
    hold(af, ctx.cb.hitStop);
    if (df !== null) hold(df, ctx.cb.hitStop);
  }
  fw.emit({
    type: 'BLOW',
    attacker,
    defender,
    outcome,
    damage,
    heavy,
    x: pos.x,
    y: pos.y,
    dx: pos.x - from.x,
    dy: pos.y - from.y,
    material: material === 'FLESH' && df?.armour === 'MAIL' ? 'MAIL' : material,
  });
  if (outcome === 'DODGED') fw.emit({ type: 'DODGED', who: defender });
  if (damage > 0) {
    if (df !== null && outcome === 'HIT') staggerOnHit(df, blow, world.tick, ctx.cb);
    hurt(fw, defender, damage, attacker, {
      heavyKill: af.state === 'heavyRelease',
      weapon: af.weapon,
      dx: pos.x - from.x,
      dy: pos.y - from.y,
    });
  }
  // Heard: a fight is loud (Book 10 noiseCombat).
  noise(fw, pos, ctx.ai.noise.combat, attacker);
}

/** The shove's active tick: the nearest of the other side in reach staggers, and a block breaks. */
function shoveLands(fw: FightWorld, id: Id, f: Fighter, at: { x: number; y: number }): void {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const reach = (ctx.cb.shove.reachTiles + ctx.cb.bodyRadiusTiles) * map.tile;
  let best: { id: Id; d: number; f: Fighter | null } | null = null;
  for (const [tid, pos, tf] of targets(onFoot)) {
    if (tid === id || (tf !== null && OUT_OF_FIGHT.includes(tf.state))) continue;
    if (sideOf(onFoot, tid) === sideOf(onFoot, id) && id !== STEERER) continue;
    if (id === STEERER && sideOf(onFoot, tid) === 'HOUSEHOLD') continue;
    const dx = pos.x - at.x;
    const dy = pos.y - at.y;
    const d = Math.hypot(dx, dy);
    if (d > reach || !inFront(f.facing, dx, dy, ctx.cb.strikeArcDegrees)) continue;
    if (best === null || d < best.d) best = { id: tid, d, f: tf };
  }
  f.hit = true;
  if (best?.f == null) return;
  if (best.f.state !== 'dodge' || !inDodge(best.f, world.tick, ctx)) {
    enterTimed(best.f, 'stagger', world.tick, ctx.cb.shove.stagger);
    // Pushed back a little: space made.
    const pos = whereIs(onFoot, best.id);
    if (pos !== null) {
      const [fx, fy] = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[f.facing] as [
        number,
        number,
      ];
      const nx = pos.x + fx * map.tile * ctx.cb.shove.pushTiles;
      const ny = pos.y + fy * map.tile * ctx.cb.shove.pushTiles;
      if (footprintClear(map, fw.land.rules, nx, ny, fw.tidalGroundOpen)) {
        pos.x = nx;
        pos.y = ny;
      }
    }
    fw.emit({ type: 'SHOVE_LANDED', who: id, target: best.id });
  }
}

export function inDodge(f: Fighter, tick: number, ctx: FightContext): boolean {
  const t = tick - f.since;
  return f.state === 'dodge' && t >= ctx.cb.dodge.invulnFrom && t <= ctx.cb.dodge.invulnTo;
}

/** A blow or missile's damage to a person: the downed, the dead, Second wind, gore's roll. */
export function hurt(
  fw: FightWorld,
  id: Id,
  damage: number,
  by: Id,
  how: {
    heavyKill: boolean;
    weapon: MeleeWeaponName | null;
    dx: number;
    dy: number;
    missile?: boolean;
  },
): void {
  const { world, ctx } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const tick = world.tick;
  if (id === STEERER) {
    world.player.vitality = Math.max(0, world.player.vitality - damage);
    if (world.player.vitality <= 0) steererFalls(fw);
    return;
  }
  const a = onFoot.actors[id];
  const fa = a?.fight;
  if (a === undefined || fa?.dead !== null) return;
  fa.vitality = Math.max(0, fa.vitality - damage);
  fa.lastHit = { tick, dx: how.dx, dy: how.dy, heavy: how.heavyKill };
  const person = world.people[id];
  if (person !== undefined) person.vitality = fa.vitality;
  if (!fa.bloodied && fa.vitality < fa.maxVitality * ctx.cb.bloodiedBelow) {
    fa.bloodied = true;
    if (fa.group !== null) {
      const g = onFoot.battle?.groups[fa.group];
      if (g !== undefined && !g.bloodied.includes(id)) {
        g.bloodied.push(id);
        g.cohesion += ctx.ai.cohesion.memberBloodied;
      }
    }
  }
  if (fa.vitality > 0) {
    if (fa.side === 'ENEMY' && fighting(fa)) say(ctx, id, 'hurt', fw.emit, tick);
    if (fa.side === 'HOUSEHOLD') maybeBerserk(fw, id, fa, ctx.cb.berserk.onWounded);
    // The struck know where the blow came from.
    const src = whereIs(onFoot, by);
    if (src !== null && fa.side === 'ENEMY') {
      fa.ai.aware = true;
      fa.ai.memory = { x: src.x, y: src.y, tick, seen: true };
    }
    return;
  }
  if (fa.side === 'HOUSEHOLD') {
    // Downed, not dead: no timer (Book 2 section 12).
    fa.f.state = 'downed';
    fa.f.since = tick;
    a.pose = 'down';
    fa.order = null;
    if (person !== undefined) person.status = 'downed';
    fw.emit({ type: 'PERSON_DOWNED', person: id });
    say(ctx, id, 'downed', fw.emit, tick);
    for (const [oid, o] of Object.entries(onFoot.actors).sort(ORDERLY))
      if (oid !== id && o.fight?.side === 'HOUSEHOLD')
        maybeBerserk(fw, oid, o.fight, ctx.cb.berserk.onFriendFalls);
    return;
  }
  // The dead (enemies at nothing are killed). A killing blow from a heavy cutting weapon may take a
  // limb or the head (Book 10 dismemberChance, on the gore stream).
  const wdef =
    how.weapon === null
      ? undefined
      : Object.values(ctx.def.weapons).find((w) => w.row === how.weapon);
  let piece: Piece | null = null;
  const rolls = wdef?.dismember === 'ANY' || (wdef?.dismember === 'HEAVY' && how.heavyKill);
  if (rolls && how.missile !== true && nextFloat(world.rng.gore) < ctx.cb.dismemberChance) {
    const k = Math.floor(nextFloat(world.rng.gore) * 3);
    piece = (['HEAD', 'ARM', 'LEG'] as const)[k] ?? 'ARM';
  }
  const surrendered = fa.f.state === 'surrendered';
  fa.f.state = 'dead';
  fa.f.since = tick;
  fa.dead = { tick, piece, dir: dir16(how.dx, how.dy) };
  a.pose = 'dead';
  delete a.task;
  if (person !== undefined) person.status = 'dead';
  fw.emit({ type: 'PERSON_KILLED', person: id, by, piece, x: a.x, y: a.y });
  // The group's morale: an ally killed, the leader killed.
  const g = fa.group === null ? undefined : onFoot.battle?.groups[fa.group];
  if (g !== undefined) {
    g.cohesion += ctx.ai.cohesion.allyKilled + (g.leader === id ? ctx.ai.cohesion.leaderKilled : 0);
    for (const m of g.members)
      if (m !== id && onFoot.actors[m]?.fight !== undefined && fighting(onFoot.actors[m].fight)) {
        say(ctx, m, 'fallen', fw.emit, tick);
        break;
      }
  }
  // A killing by the household is a deed; witnessed by the residents who saw it.
  if (sideOf(onFoot, by) === 'HOUSEHOLD') {
    const witnesses = world.household.residents.filter((r) => {
      const ra = onFoot.actors[r];
      return (
        ra !== undefined &&
        ra.pose !== 'down' &&
        Math.hypot(ra.x - a.x, ra.y - a.y) <= ctx.ai.sight.day * fw.map.tile
      );
    });
    fw.deed(surrendered ? 'SURRENDERED_KILLED' : 'KILLING', [id], witnesses);
  }
}

function dir16(x: number, y: number): number {
  const a = Math.atan2(y, x);
  return ((Math.round(a / (Math.PI / 8)) % 16) + 16) % 16;
}

/** A berserker may go berserk when wounded or when a friend falls (Book 10 section 08). */
function maybeBerserk(fw: FightWorld, id: Id, fa: ActorFight, chance: number): void {
  const person = fw.world.people[id];
  if (!person?.traits.some((t) => t.trait === 'BERSERK')) return;
  if (fa.berserkUntil > fw.world.tick || OUT_OF_FIGHT.includes(fa.f.state)) return;
  if (nextFloat(fw.world.rng.combat) >= chance) return;
  fa.berserkUntil = fw.world.tick + fw.ctx.cb.berserk.ticks;
  fa.finishesDowned = true;
  fa.order = null;
  fw.emit({ type: 'BERSERK', person: id });
}

/** The steerer at nothing: downed for Second wind once a scene, else dead and the game over. */
function steererFalls(fw: FightWorld): void {
  const { world } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const f = steererFighter(world, fw.ctx);
  const battle = onFoot.battle ?? null;
  if (f !== null && f.state === 'downed') return;
  if (fw.options.secondWind && battle !== null && !battle.secondWindUsed && f !== null) {
    f.state = 'downed';
    f.since = world.tick;
    battle.steererDownedAt = world.tick;
    battle.secondWindUsed = true;
    onFoot.carrying = null;
    fw.emit({ type: 'STEERER_DOWNED', secondWind: true });
    return;
  }
  dies(fw);
}

function dies(fw: FightWorld): void {
  const { world } = fw;
  const f = world.onFoot?.player.fight;
  if (f != null) {
    f.state = 'dead';
    f.since = world.tick;
  }
  world.gameOver = { day: world.calendar.day, tick: world.tick, cause: 'FIGHT' };
  fw.emit({ type: 'STEERER_DOWNED', secondWind: false });
  fw.emit({ type: 'STEERER_DIED', day: world.calendar.day });
}

/**
 * Second wind (Book 10 secondWind): while the steerer lies downed an able ally comes; adjacent,
 * they lift the steerer to Book 10's vitality, once a scene; when the time runs out, death.
 */
function secondWind(fw: FightWorld): void {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  const battle = onFoot?.battle ?? null;
  if (onFoot === null || battle?.steererDownedAt == null) return;
  const f = onFoot.player.fight;
  if (f?.state !== 'downed') return;
  const reach = fw.land.rules.interactRadiusTiles * map.tile;
  for (const [id, a] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    const fa = a.fight;
    if (
      fa?.side !== 'HOUSEHOLD' ||
      fa.f.state === 'downed' ||
      a.pose === 'down' ||
      a.pose === 'carried'
    )
      continue;
    if (Math.hypot(a.x - onFoot.player.x, a.y - onFoot.player.y) > reach) continue;
    world.player.vitality = ctx.cb.secondWind.liftTo;
    f.state = 'idle';
    f.since = world.tick;
    battle.steererDownedAt = null;
    fw.emit({ type: 'STEERER_LIFTED', by: id });
    say(ctx, id, 'lift', fw.emit, world.tick);
    return;
  }
  if (world.tick - battle.steererDownedAt >= ctx.cb.secondWind.ticks) dies(fw);
}

/**
 * Berserkers and the named cruel (Book 2 section 12): one who stands over a downed enemy raises
 * the weapon high for Book 10's warning, with a shout; only then the blow. A blow that staggers
 * them in the meantime ends it. Rán's mercy turns the death into a grave wound.
 */
function finishWarnings(fw: FightWorld): void {
  const { world, ctx } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  for (const [id, a] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    const fa = a.fight;
    if (fa?.finishing == null) continue;
    const t = fa.finishing.target;
    const victim = onFoot.actors[t]?.fight;
    const tpos = whereIs(onFoot, t);
    if (
      fa.f.state === 'stagger' ||
      fa.f.state === 'guardBroken' ||
      !fighting(fa) ||
      tpos === null ||
      (victim !== undefined && victim.f.state !== 'downed')
    ) {
      fa.finishing = null;
      continue;
    }
    if (world.tick - fa.finishing.since < ctx.cb.finishWarningTicks) continue;
    fa.finishing = null;
    if (fw.options.ransMercy) {
      const p = world.people[t];
      p?.wounds.push({ day: world.calendar.day, severity: 'GRAVE', where: 'body' });
      continue;
    }
    hurt(fw, t, 9999, id, {
      heavyKill: false,
      weapon: fa.f.weapon,
      dx: tpos.x - a.x,
      dy: tpos.y - a.y,
    });
    const victimActor = onFoot.actors[t];
    if (victimActor?.fight?.side === 'HOUSEHOLD') {
      victimActor.fight.f.state = 'dead';
      victimActor.fight.dead = { tick: world.tick, piece: null, dir: 0 };
      victimActor.pose = 'dead';
      const person = world.people[t];
      if (person !== undefined) person.status = 'dead';
      fw.emit({
        type: 'PERSON_KILLED',
        person: t,
        by: id,
        piece: null,
        x: victimActor.x,
        y: victimActor.y,
      });
    }
  }
}

// ------------------------------------------------------------------------------ minds

/** A noise heard: enemies in its radius learn where it came from. */
function noise(fw: FightWorld, at: { x: number; y: number }, radius: number, source: Id): void {
  const onFoot = fw.world.onFoot;
  if (onFoot === null) return;
  const src = whereIs(onFoot, source);
  for (const [, a] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    const fa = a.fight;
    if (fa?.side !== 'ENEMY' || !fighting(fa)) continue;
    if (!hears(at, a, radius, fw.map.tile)) continue;
    if (sideOf(onFoot, source) === 'ENEMY') continue;
    fa.ai.memory = { x: src?.x ?? at.x, y: src?.y ?? at.y, tick: fw.world.tick, seen: false };
  }
}

/** The household people an enemy can fight: the steerer and armed, able residents standing. */
function foes(onFoot: OnFootState, side: Side): [Id, { x: number; y: number; facing: Facing }][] {
  const out: [Id, { x: number; y: number; facing: Facing }][] = [];
  if (side === 'ENEMY') {
    const sf = onFoot.player.fight;
    if (sf == null || (sf.state !== 'downed' && sf.state !== 'dead'))
      out.push([STEERER, onFoot.player]);
  }
  for (const [id, a] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    const fa = a.fight;
    if (fa === undefined || fa.side === side || !fa.able || !fighting(fa)) continue;
    if (a.pose === 'down' || a.pose === 'carried' || a.pose === 'dead') continue;
    out.push([id, a]);
  }
  return out;
}

/** Book 7: the light at the moment, and whether a point is inside a light pool (none yet). */
function lightNow(world: WorldState, ctx: FightContext): ReturnType<typeof lightAt> {
  const d = ctx.daylight[seasonOf(world.calendar.day)];
  return lightAt(world.calendar.minuteOfDay, d.lightFrom, d.darkFrom, ctx.ai.sight.duskMinutes);
}

/** One fighter's choice (Book 2 section 13 at 10 Hz on the `ai` stream). */
function think(fw: FightWorld, id: Id, a: OnFootActor, fa: ActorFight): void {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const tick = world.tick;
  const ai = fa.ai;
  const tile = map.tile;
  if (fa.f.state === 'surrendered') return;
  // Held charges come out at their chosen tick; the defence decided comes at its tick.
  if (ai.releaseAt >= 0 && tick >= ai.releaseAt && charging(fa.f)) {
    releaseAttack(fa.f, tick, ctx.cb, fa.stamina);
    ai.releaseAt = -1;
    fw.emit({ type: 'SWING', who: id, heavy: fa.f.level > 0, weapon: fa.f.weapon ?? '' });
  }
  react(fw, id, a, fa);
  if (fa.side === 'HOUSEHOLD') {
    crewThink(fw, id, a, fa);
    return;
  }
  if (tick < ai.next) return;
  ai.next = tick + ctx.ai.habits.decideEvery;
  if (ai.mode === 'FLEE') {
    const p = onFoot.player;
    ai.goal = { x: p.x, y: p.y, run: true, away: true };
    return;
  }
  // Perception: sight by the light, then hearing the steerer's steps.
  const light = lightNow(world, ctx);
  const range = sightRange(ctx.ai, light, false);
  const solid = (x: number, y: number): boolean => {
    const t = tileOf(map, x, y);
    const ter = terrainAt(map, t.tx, t.ty);
    return ter === 'rock' || solidAt(map, t.tx, t.ty);
  };
  let seen: [Id, { x: number; y: number }] | null = null;
  let best = Infinity;
  for (const [fid, pos] of foes(onFoot, 'ENEMY')) {
    if (
      !sees(ctx.ai, a, pos, range, tile, solid) &&
      !(ai.aware && Math.hypot(pos.x - a.x, pos.y - a.y) < 2 * tile)
    )
      continue;
    const d = Math.hypot(pos.x - a.x, pos.y - a.y);
    if (d < best) {
      best = d;
      seen = [fid, pos];
    }
  }
  const p = onFoot.player;
  if (seen === null && p.moving && onFoot.player.fight?.state !== 'dead') {
    const t = tileOf(map, p.x, p.y);
    const ter = terrainAt(map, t.tx, t.ty);
    const surface = ter === 'shingle' ? 'shingle' : ter === 'foreshore' ? 'sand' : 'other';
    if (hears(p, a, stepNoise(ctx.ai, p.gait, surface), tile))
      ai.memory = { x: p.x, y: p.y, tick, seen: false };
  }
  if (seen !== null) {
    ai.memory = { x: seen[1].x, y: seen[1].y, tick, seen: true };
    ai.target = seen[0];
  }
  if (ai.memory !== null && !ai.aware) {
    ai.aware = true;
    delete a.task;
    a.pose = 'idle';
    fw.emit({ type: 'ENEMY_AWARE', person: id });
    if (!ai.shouted) {
      ai.shouted = true;
      say(ctx, id, 'alarm', fw.emit, tick);
      // A shout raises the others in earshot (Book 10 noiseShout).
      for (const [oid, o] of Object.entries(onFoot.actors).sort(ORDERLY)) {
        const of = o.fight;
        if (oid === id || of?.side !== 'ENEMY' || of.ai.aware) continue;
        if (hears(a, o, ctx.ai.noise.shout, tile)) of.ai.memory = { ...ai.memory, seen: false };
      }
    }
    const battle = onFoot.battle ?? null;
    if (battle !== null && !battle.engaged) {
      // Stage 10: an empty-handed steerer is met with words, for a while (decision S10-9).
      if (
        encounterOf(ctx, battle)?.parley === true &&
        battle.parley == null &&
        (ai.target === STEERER || ai.target === null) &&
        openHanded(world, ctx)
      ) {
        battle.parley = { until: tick + ctx.parleyTicks, done: false };
        const leader = Object.entries(onFoot.actors).find(([, o]) => o.fight?.leader === true)?.[0];
        say(ctx, leader ?? id, 'parley', fw.emit, tick);
        for (const o of Object.values(onFoot.actors)) {
          const of = o.fight;
          if (of?.side !== 'ENEMY') continue;
          of.ai.aware = true;
          delete o.task;
          o.pose = 'idle';
        }
      } else if (battle.parley == null || battle.parley.done) {
        battle.engaged = true;
        fw.emit({ type: 'FIGHT_STARTED', scene: battle.scene });
      }
    }
  }
  // Stage 10: holding for words: they stand facing the steerer until the parley ends.
  const parley = onFoot.battle?.parley ?? null;
  if (parley !== null && !parley.done && onFoot.battle?.engaged !== true) {
    const talking = world.talk?.kind === 'SEARCH';
    if (talking) parley.until = Math.max(parley.until, tick + 1);
    if (tick < parley.until && (talking || openHanded(world, ctx))) {
      const p = onFoot.player;
      ai.mode = 'GUARD';
      ai.goal = null;
      a.facing = facingOf(p.x - a.x, p.y - a.y, a.facing);
      fa.f.facing = a.facing;
      return;
    }
    // Patience gone, a weapon taken up or a blow: the fight is on.
    startFight(fw);
    say(ctx, id, 'taunt', fw.emit, tick);
  }
  if (!remembered(ctx.ai, ai.memory, tick)) {
    // Lost for Book 10's memory time: back to what they were doing, until alerted again.
    ai.mode = 'GUARD';
    ai.aware = false;
    ai.memory = null;
    ai.goal =
      Math.hypot(a.x - ai.home.x, a.y - ai.home.y) > tile
        ? { x: ai.home.x, y: ai.home.y, run: false }
        : null;
    return;
  }
  if (seen === null) {
    // Lost from sight: go where they were last known and search there.
    ai.mode = 'INVESTIGATE';
    const m = ai.memory;
    ai.goal = m === null ? null : { x: m.x, y: m.y, run: false };
    return;
  }
  ai.mode = 'FIGHT';
  engage(fw, id, a, fa, seen[0], seen[1], best);
}

/** In a fight: an archer keeps its distance and shoots; a fighter closes and strikes. */
function engage(
  fw: FightWorld,
  id: Id,
  a: OnFootActor,
  fa: ActorFight,
  target: Id,
  pos: { x: number; y: number },
  d: number,
): void {
  const { world, ctx, map } = fw;
  const tick = world.tick;
  const tile = map.tile;
  const h = ctx.ai.habits;
  const ai = fa.ai;
  if (fa.bow && fa.arrows > 0) {
    // A shot loosed: the order is done; the next is a fresh choice.
    if (a.archer?.phase === 'moving') delete a.archer;
    if (a.archer !== undefined || a.aim != null) {
      ai.goal = null;
      return;
    }
    if (d < h.fallBackFrom * tile) {
      ai.goal = { x: pos.x, y: pos.y, run: true, away: true };
      return;
    }
    if (d > h.archerRange.max * tile) {
      ai.goal = { x: pos.x, y: pos.y, run: false };
      return;
    }
    if (!free(fa.f) || tick < ai.nextAttack || !tokenFree(fw, id, target)) return;
    // Stop, draw, loose, then stand (Book 2 section 13; the archer helper).
    ai.goal = null;
    orderShot(a, { x: pos.x, y: pos.y - 1 }, { x: 0, y: 0, run: false, sneak: false });
    fa.arrows--;
    ai.nextAttack = tick + attackGap(fw);
    ai.lastStruck = tick;
    say(ctx, id, 'taunt', fw.emit, tick + id.length);
    return;
  }
  const w = fa.f.weapon;
  if (w === null) return;
  const reach = (ctx.cb.weapons[w].reachTiles + ctx.cb.bodyRadiusTiles) * tile;
  // Two or more on one flank it (Book 2 section 13): each takes its own side of the target.
  const side = flankSlot(fw, id, target, pos, reach * h.closeIn);
  const approach = { x: side?.x ?? pos.x, y: side?.y ?? pos.y, run: d > h.runAt * tile };
  if (d > reach) {
    ai.goal = approach;
    return;
  }
  // In reach: strike when the side's token is free (S9-29); else close to its flank side and
  // threaten until it is.
  if (!free(fa.f) || tick < ai.nextAttack || !tokenFree(fw, id, target)) {
    ai.goal =
      d > reach * h.closeIn
        ? approach
        : side !== null && Math.hypot(side.x - a.x, side.y - a.y) > ctx.cb.bodyRadiusTiles * tile
          ? { x: side.x, y: side.y, run: false }
          : null;
    if (ai.goal === null) a.facing = facingOf(pos.x - a.x, pos.y - a.y, a.facing);
    return;
  }
  ai.goal = null;
  const facing = facingOf(pos.x - a.x, pos.y - a.y, a.facing);
  if (pressAttack(fa.f, tick, ctx.cb, facing, fa.stamina) !== 'STARTED') return;
  ai.lastStruck = tick;
  a.facing = facing;
  fw.emit({ type: 'ATTACK_STARTED', who: id, heavy: false });
  const tf = world.onFoot === null ? null : fighterOf(world.onFoot, target);
  const heavy = nextFloat(world.rng.ai) < h.heavyChance;
  const shieldUp = tf !== null && tf.shield && (tf.state === 'block' || tf.guard);
  ai.releaseAt = heavy
    ? tick + (shieldUp ? ctx.cb.charge.level2At : ctx.cb.charge.level1At)
    : tick + 1;
  ai.nextAttack = tick + attackGap(fw);
}

/** The time between one fighter's attacks, drawn on the `ai` stream (Book 10 attackGap). */
function attackGap(fw: FightWorld): number {
  const g = fw.ctx.ai.habits.attackGap;
  return Math.round(g.min + nextFloat(fw.world.rng.ai) * (g.max - g.min));
}

/**
 * Whether a person is in an attack (Book 10 attackTokens): a charge, a strike's windup and active
 * frames, a bow being drawn or held.
 */
export function inAttack(a: OnFootActor, tick: number): boolean {
  const f = a.fight?.f;
  if (f === undefined) return false;
  if (charging(f) || (striking(f) && tick < f.activeEnd)) return true;
  return (a.archer !== undefined && a.archer.phase !== 'moving') || a.aim != null;
}

/**
 * Whether a fighter may start an attack on its target (Book 10 attackTokens, decision S9-29): fewer
 * than the tokens of its group are already in an attack on that target. The others close, flank
 * and threaten, so a fight against several reads one blow at a time.
 */
function tokenFree(fw: FightWorld, id: Id, target: Id): boolean {
  const onFoot = fw.world.onFoot;
  const me = onFoot?.actors[id]?.fight;
  if (onFoot === null || me === undefined) return true;
  const tick = fw.world.tick;
  let busy = 0;
  for (const [oid, o] of Object.entries(onFoot.actors)) {
    if (oid === id || o.fight?.side !== me.side) continue;
    if (o.fight.ai.target === target && inAttack(o, tick)) busy++;
  }
  const h = fw.ctx.ai.habits;
  if (busy >= h.attackTokens) return false;
  // With no one attacking, the side rests a moment after its last attack ended.
  const last = onFoot.battle?.lastAttack?.[`${me.side}:${target}`];
  if (busy === 0 && last !== undefined && tick - last < h.tokenRestTicks) return false;
  // The token goes to whoever of the side, ready to attack, has waited longest.
  const pos = whereIs(onFoot, target);
  if (pos === null) return true;
  const tile = fw.map.tile;
  const mine = me.ai.lastStruck ?? -1;
  for (const [oid, o] of Object.entries(onFoot.actors)) {
    const of = o.fight;
    if (oid === id || of?.side !== me.side || of.ai.target !== target) continue;
    if (!fighting(of) || !free(of.f) || tick < of.ai.nextAttack) continue;
    if ((of.ai.lastStruck ?? -1) >= mine) continue;
    const d = Math.hypot(pos.x - o.x, pos.y - o.y);
    const ready =
      of.bow && of.arrows > 0
        ? d >= h.fallBackFrom * tile && d <= h.archerRange.max * tile
        : of.f.weapon !== null &&
          d <= (fw.ctx.cb.weapons[of.f.weapon].reachTiles + fw.ctx.cb.bodyRadiusTiles) * tile;
    if (ready) return false;
  }
  return true;
}

const SIDES: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Where a melee fighter stands against its target when two or more close on it (Book 2 section 13,
 * "flank"): the four sides of the target at striking distance, taken in name order, each by the
 * nearest fighter still without one; a side that is not open, dry ground is passed over. Null for a
 * lone attacker (or the first to a side it already holds): it strikes from where it is.
 */
function flankSlot(
  fw: FightWorld,
  id: Id,
  target: Id,
  pos: { x: number; y: number },
  r: number,
): { x: number; y: number } | null {
  const onFoot = fw.world.onFoot;
  if (onFoot === null) return null;
  const attackers = Object.entries(onFoot.actors)
    .filter(
      ([, o]) =>
        o.fight?.ai.target === target &&
        o.fight.f.weapon !== null &&
        !(o.fight.bow && o.fight.arrows > 0) &&
        fighting(o.fight),
    )
    .sort(([x], [y]) => (x < y ? -1 : 1));
  if (attackers.length < 2) return null;
  const open = SIDES.map(([sx, sy]) => ({ x: pos.x + sx * r, y: pos.y + sy * r })).filter(
    (p) =>
      footprintClear(fw.map, fw.land.rules, p.x, p.y, fw.tidalGroundOpen) &&
      fw.wet?.(p.x, p.y) !== true,
  );
  for (const [oid, o] of attackers) {
    if (open.length === 0) return null;
    let best = 0;
    open.forEach((p, k) => {
      const q = open[best];
      if (q !== undefined && Math.hypot(p.x - o.x, p.y - o.y) < Math.hypot(q.x - o.x, q.y - o.y))
        best = k;
    });
    const [slot] = open.splice(best, 1);
    if (oid === id) return slot ?? null;
  }
  return null;
}

/**
 * Seeing a blow coming (Book 10 "Fighters' habits"): a fighter who sees an attacker's tell defends
 * with Book 10's chance, no sooner than its reaction time: a shield raised until the blow is past,
 * or a parry timed to the strike's active ticks.
 */
function react(fw: FightWorld, id: Id, a: OnFootActor, fa: ActorFight): void {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null || !fa.able || fa.berserkUntil > world.tick) return;
  const tick = world.tick;
  const ai = fa.ai;
  const h = ctx.ai.habits;
  if (ai.react !== null) {
    if (
      tick >= ai.react.at &&
      ai.react.kind === 'BLOCK' &&
      fa.f.state === 'idle' &&
      tick < ai.react.until
    )
      setBlock(fa.f, true, tick);
    if (tick >= ai.react.at && ai.react.kind === 'PARRY' && free(fa.f))
      pressParry(fa.f, tick, ctx.cb, fa.stamina);
    if (tick >= ai.react.until) {
      if (fa.f.guard) setBlock(fa.f, false, tick);
      ai.react = null;
    }
    return;
  }
  // The attackers in reach who face this fighter and have shown a tell not yet judged.
  for (const [oid, pos, of] of targets(onFoot)) {
    if (oid === id || of === null || sideOf(onFoot, oid) === fa.side) continue;
    if (!charging(of) && !striking(of)) continue;
    if (of.since === ai.judged) continue;
    const reach = ((of.weapon === null ? 0 : ctx.cb.weapons[of.weapon].reachTiles) + 1) * map.tile;
    const dx = a.x - pos.x;
    const dy = a.y - pos.y;
    if (Math.hypot(dx, dy) > reach || !inFront(of.facing, dx, dy, ctx.cb.strikeArcDegrees))
      continue;
    ai.judged = of.since;
    if (nextFloat(world.rng.ai) >= h.reactChance) return;
    const parry = !fa.f.shield || nextFloat(world.rng.ai) < h.parryShare;
    if (parry && fa.f.weapon === null && !fa.f.shield) return;
    const soonest = of.since + h.reactTicks;
    if (parry) {
      // Timed so the window covers the active ticks if they come at the windup's end.
      const active = striking(of) ? of.activeAt : of.since + windupFor(of, ctx);
      const at = Math.max(
        tick,
        soonest,
        active - ctx.cb.parry.startup - Math.floor(fw.options.parryWindow / 2),
      );
      ai.react = { kind: 'PARRY', at, until: at + 1 };
    } else {
      const until = striking(of)
        ? of.recoveryEnd
        : of.since + ctx.cb.charge.maxHold + ctx.ai.habits.guardHeld;
      ai.react = { kind: 'BLOCK', at: Math.max(tick, soonest), until };
    }
    a.facing = facingOf(pos.x - a.x, pos.y - a.y, a.facing);
    fa.f.facing = a.facing;
    return;
  }
}

function windupFor(f: Fighter, ctx: FightContext): number {
  return f.weapon === null
    ? 0
    : ctx.cb.weapons[f.weapon].windup + (f.heavy ? ctx.cb.heavy.windupExtra : 0);
}

/**
 * The crew (Book 2 section 12): an order is carried out (follow, hold, attack the steerer's target,
 * protect, carry the downed to a safe place, withdraw there); with none, an able, armed resident
 * fights an enemy close to the steerer. Everyone able comes to lift a downed steerer.
 */
function crewThink(fw: FightWorld, id: Id, a: OnFootActor, fa: ActorFight): void {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const tick = world.tick;
  const ai = fa.ai;
  const tile = map.tile;
  const p = onFoot.player;
  const h = ctx.ai.habits;
  if (tick < ai.next) return;
  ai.next = tick + h.decideEvery;
  // The steerer downed: come and lift them.
  if (onFoot.player.fight?.state === 'downed' && a.pose !== 'carried' && a.carries === undefined) {
    ai.goal = { x: p.x, y: p.y, run: true };
    return;
  }
  const berserk = fa.berserkUntil > tick;
  if (berserk) {
    const near = nearestEnemy(onFoot, a, true);
    if (near !== null) fightIt(fw, id, a, fa, near[0], near[1]);
    return;
  }
  const order = fa.order;
  // An order lapses after a quiet game hour (Book 10 orderLapse) once no fight is under way.
  const quiet = onFoot.battle == null || onFoot.battle.over;
  if (!quiet) fa.quietSince = tick;
  if (order !== null && quiet && tick - fa.quietSince >= ctx.ai.habits.orderLapseTicks) {
    fa.order = null;
    ai.mode = 'GUARD';
    ai.goal = null;
    return;
  }
  const follow = (): void => {
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    ai.goal = d > h.crewFollow * tile ? { x: p.x, y: p.y, run: d > h.crewRunAt * tile } : null;
  };
  const safe = ctx.def.safePlaces.find((s) => s.zone === onFoot.zone) ?? null;
  switch (order?.kind) {
    case 'FOLLOW':
      follow();
      return;
    case 'HOLD':
      ai.goal = order.at === null ? null : { x: order.at.x, y: order.at.y, run: false };
      if (order.at !== null && Math.hypot(order.at.x - a.x, order.at.y - a.y) < 4) ai.goal = null;
      return;
    case 'WITHDRAW':
      if (safe === null || inSafePlace(ctx, onFoot.zone, a.x, a.y, tile)) {
        ai.goal = null;
        if (safe !== null) fa.order = null;
        return;
      }
      ai.goal = { x: safe.x * tile, y: safe.y * tile, run: true };
      return;
    case 'ATTACK': {
      const t = order.target === null ? null : onFoot.actors[order.target];
      if (t?.fight !== undefined && fighting(t.fight) && order.target !== null) {
        fightIt(fw, id, a, fa, order.target, t);
        return;
      }
      follow();
      return;
    }
    case 'PROTECT': {
      const near = nearestEnemy(onFoot, p, false);
      if (near !== null && Math.hypot(near[1].x - p.x, near[1].y - p.y) <= h.crewProtect * tile) {
        fightIt(fw, id, a, fa, near[0], near[1]);
        return;
      }
      follow();
      return;
    }
    case 'CARRY': {
      carryThink(fw, id, a, fa);
      return;
    }
    default:
      break;
  }
  // Stage 10: an ally keeps to what they guard (Bran by Thorkel's body): a foe near it first, then
  // any foe in the fight; with none left, back to it.
  if (allyOf(ctx, onFoot.battle, id)) {
    if (!fa.able || fa.f.weapon === null) return;
    const home = ai.home;
    let best: [Id, OnFootActor] | null = null;
    let bestD = Infinity;
    for (const [eid, e] of Object.entries(onFoot.actors).sort(ORDERLY)) {
      const ef = e.fight;
      if (ef?.side !== 'ENEMY' || !fighting(ef) || !ef.ai.aware) continue;
      // Anyone come at the body, or anyone in the fight at all: he comes out to it.
      const d =
        Math.hypot(e.x - home.x, e.y - home.y) <= ctx.guardTiles * tile
          ? 0
          : Math.hypot(e.x - a.x, e.y - a.y);
      if (d < bestD) {
        bestD = d;
        best = [eid, e];
      }
    }
    if (best !== null) fightIt(fw, id, a, fa, best[0], best[1]);
    else
      ai.goal =
        Math.hypot(a.x - home.x, a.y - home.y) > 4 ? { x: home.x, y: home.y, run: false } : null;
    return;
  }
  // No order: an able, armed resident fights an enemy near the steerer; others keep their day.
  if (!fa.able || fa.f.weapon === null) return;
  const near = nearestEnemy(onFoot, p, false);
  if (
    near !== null &&
    near[1].fight?.ai.aware === true &&
    Math.hypot(near[1].x - p.x, near[1].y - p.y) <= h.crewProtect * tile
  )
    fightIt(fw, id, a, fa, near[0], near[1]);
}

function nearestEnemy(
  onFoot: OnFootState,
  from: { x: number; y: number },
  anyone: boolean,
): [Id, OnFootActor] | null {
  let best: [Id, OnFootActor, number] | null = null;
  for (const [id, a] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    const fa = a.fight;
    if (fa?.side !== 'ENEMY' || fa.dead !== null) continue;
    if (!anyone && !fighting(fa)) continue;
    const d = Math.hypot(a.x - from.x, a.y - from.y);
    if (best === null || d < best[2]) best = [id, a, d];
  }
  return best === null ? null : [best[0], best[1]];
}

/** A crew fighter closes on and strikes a target (or, an archer, shoots it). */
function fightIt(
  fw: FightWorld,
  id: Id,
  a: OnFootActor,
  fa: ActorFight,
  target: Id,
  t: OnFootActor,
): void {
  const d = Math.hypot(t.x - a.x, t.y - a.y);
  fa.ai.target = target;
  engage(fw, id, a, fa, target, t, d);
}

/** CARRY: to the nearest downed ally, lift them, walk to the safe place, set them down. */
function carryThink(fw: FightWorld, id: Id, a: OnFootActor, fa: ActorFight): void {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const tile = map.tile;
  const safe = ctx.def.safePlaces.find((s) => s.zone === onFoot.zone) ?? null;
  if (a.carries !== undefined) {
    const carried = onFoot.actors[a.carries];
    if (safe === null || carried === undefined) return;
    if (inSafePlace(ctx, onFoot.zone, a.x, a.y, tile)) {
      setDownCarried(fw, a, a.carries);
      fa.order = null;
      return;
    }
    fa.ai.goal = { x: safe.x * tile, y: safe.y * tile, run: false };
    return;
  }
  let best: [Id, OnFootActor, number] | null = null;
  for (const [oid, o] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    if (oid === id || o.pose !== 'down' || o.fight?.side !== 'HOUSEHOLD') continue;
    const d = Math.hypot(o.x - a.x, o.y - a.y);
    if (best === null || d < best[2]) best = [oid, o, d];
  }
  if (best === null) {
    fa.order = null;
    return;
  }
  if (best[2] > fw.land.rules.interactRadiusTiles * tile) {
    fa.ai.goal = { x: best[1].x, y: best[1].y, run: true };
    return;
  }
  a.carries = best[0];
  best[1].pose = 'carried';
  fa.ai.goal = null;
}

/** A carried ally set down by whoever carried them: brought home in a safe place, else downed. */
export function setDownCarried(
  fw: Pick<FightWorld, 'world' | 'ctx' | 'map' | 'emit'>,
  a: OnFootActor,
  id: Id,
): void {
  const onFoot = fw.world.onFoot;
  const carried = onFoot?.actors[id];
  if (onFoot == null || carried === undefined) return;
  delete a.carries;
  carried.x = a.x + 6;
  carried.y = a.y + 2;
  broughtTo(fw, id, carried);
}

/**
 * A downed ally set down: in a safe place they live, with Book 10's serious wound (they sit and
 * are out of the fight); elsewhere they lie downed again, with no timer.
 */
export function broughtTo(
  fw: Pick<FightWorld, 'world' | 'ctx' | 'map' | 'emit'>,
  id: Id,
  actor: OnFootActor,
): void {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  const person = world.people[id];
  if (onFoot === null || person?.status !== 'downed') return;
  if (!inSafePlace(ctx, onFoot.zone, actor.x, actor.y, map.tile)) {
    actor.pose = 'down';
    return;
  }
  person.status = 'wounded';
  person.wounds.push({ day: world.calendar.day, severity: 'SERIOUS', where: 'body' });
  person.vitality = ctx.cb.vitality;
  actor.pose = 'sit';
  if (actor.fight !== undefined) {
    actor.fight.f.state = 'idle';
    actor.fight.vitality = ctx.cb.vitality;
    actor.fight.able = false;
  }
  fw.emit({ type: 'PERSON_BROUGHT_HOME', person: id });
  say(ctx, id, 'safe', fw.emit, world.tick);
}

// ------------------------------------------------------------------------------ walking

/**
 * A fighter's walk this tick: towards (or away from) its goal at its gait, planted while its
 * state machine says so, never through terrain that blocks or into another standing person.
 */
function walk(fw: FightWorld, id: Id, a: OnFootActor, fa: ActorFight): void {
  const { world, ctx, map, land } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  delete a.moving;
  if (a.pose === 'carried' || a.pose === 'down' || a.pose === 'dead') return;
  const f = fa.f;
  const tile = map.tile;
  let vx: number;
  let vy: number;
  let speed: number;
  if (f.state === 'dodge' && f.dodge !== null) {
    speed = (ctx.cb.dodge.tiles * tile) / ctx.cb.dodge.ticks;
    vx = f.dodge.x;
    vy = f.dodge.y;
  } else {
    const goal = fa.ai.goal;
    if (goal === null || feetPlanted(f) || a.aim != null || a.archer?.phase === 'drawing') {
      if (a.carries !== undefined) carryAlong(onFoot, a);
      return;
    }
    let dx = goal.x - a.x;
    let dy = goal.y - a.y;
    if (goal.away === true) {
      dx = -dx;
      dy = -dy;
    }
    const d = Math.hypot(dx, dy);
    if (d < 2 && goal.away !== true) return;
    vx = dx / d;
    vy = dy / d;
    const base = charging(f)
      ? ctx.cb.chargeSpeed
      : a.carries !== undefined
        ? land.movement.carry * (f.heavy ? ctx.cb.heavy.carrySpeed : 1)
        : goal.run
          ? land.movement.run * (f.heavy ? ctx.cb.heavy.runSpeed : 1)
          : land.movement.walk;
    speed = Math.min((base * tile) / TICKS_PER_SECOND, goal.away === true ? Infinity : d);
    if (f.state === 'idle') {
      a.facing = facingOf(vx, vy, a.facing);
      f.facing = a.facing;
    }
  }
  const before = { x: a.x, y: a.y };
  const clear = (x: number, y: number): boolean =>
    footprintClear(map, land.rules, x, y, fw.tidalGroundOpen) && !crowded(onFoot, id, a, x, y);
  const nx = a.x + vx * speed;
  const ny = a.y + vy * speed;
  if (vx !== 0 && clear(nx, a.y)) a.x = nx;
  if (vy !== 0 && clear(a.x, ny)) a.y = ny;
  // Stage 10: a wall in the way (the sheepfold's): round it by the tiles, towards the goal.
  const goal = fa.ai.goal;
  const moved = Math.hypot(a.x - before.x, a.y - before.y);
  const walled =
    !footprintClear(map, land.rules, nx, before.y, fw.tidalGroundOpen) ||
    !footprintClear(map, land.rules, before.x, ny, fw.tidalGroundOpen);
  if (moved < speed * 0.5 && walled && goal !== null && goal.away !== true) {
    const path = tilePath(
      map,
      tileOf(map, a.x, a.y),
      tileOf(map, goal.x, goal.y),
      fw.tidalGroundOpen,
    );
    const step = path?.[1];
    if (step !== undefined) {
      const tx = (step.tx + 0.5) * tile - a.x;
      const ty = (step.ty + 0.6) * tile - a.y;
      const l = Math.hypot(tx, ty);
      if (l > 0.01) {
        const mx = a.x + (tx / l) * speed;
        const my = a.y + (ty / l) * speed;
        if (clear(mx, a.y)) a.x = mx;
        if (clear(a.x, my)) a.y = my;
        if (f.state === 'idle') {
          a.facing = facingOf(tx, ty, a.facing);
          f.facing = a.facing;
        }
      }
    }
  }
  if (a.x !== before.x || a.y !== before.y) a.moving = true;
  if (a.carries !== undefined) carryAlong(onFoot, a);
  // Fled out of sight far enough: gone from the zone (to the cave).
  if (fa.ai.mode === 'FLEE') {
    const p = onFoot.player;
    if (
      Math.hypot(a.x - p.x, a.y - p.y) > ctx.ai.sight.day * tile ||
      (!a.moving && Math.hypot(a.x - p.x, a.y - p.y) > ctx.ai.habits.fledAt * tile)
    ) {
      Reflect.deleteProperty(onFoot.actors, id);
      const person = world.people[id];
      if (person !== undefined) person.status = 'missing';
      fw.emit({ type: 'PERSON_FLED', person: id });
    }
  }
}

function carryAlong(onFoot: OnFootState, a: OnFootActor): void {
  const c = a.carries === undefined ? undefined : onFoot.actors[a.carries];
  if (c === undefined) return;
  c.x = a.x;
  c.y = a.y;
  c.facing = a.facing;
}

/** Whether a step to (x, y) would walk into another standing person (keeping feet apart). */
function crowded(onFoot: OnFootState, id: Id, a: OnFootActor, x: number, y: number): boolean {
  const near = (ox: number, oy: number): boolean => Math.abs(ox - x) < 9 && Math.abs(oy - y) < 5;
  const closer = (ox: number, oy: number): boolean =>
    Math.hypot(ox - x, oy - y) < Math.hypot(ox - a.x, oy - a.y);
  const p = onFoot.player;
  if (near(p.x, p.y) && closer(p.x, p.y)) return true;
  for (const [oid, o] of Object.entries(onFoot.actors)) {
    if (oid === id || o.pose === 'carried' || o.pose === 'dead' || o.pose === 'down') continue;
    if (o.fight === undefined) continue;
    if (near(o.x, o.y) && closer(o.x, o.y)) return true;
  }
  return false;
}

// ------------------------------------------------------------------------------ morale

/**
 * Book 10 "Cohesion and surrender": a group outnumbered two to one loses cohesion every ten
 * seconds; below its thresholds (the cowardly sooner) its members surrender, or flee (and flee
 * when the household is known to kill those who surrender). The fight ends when no enemy fights.
 */
function morale(fw: FightWorld, battle: Battle): void {
  const { world, ctx } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const tick = world.tick;
  const c = ctx.ai.cohesion;
  const household = foes(onFoot, 'ENEMY').length;
  for (const g of Object.keys(battle.groups)
    .sort()
    .flatMap((k) => battle.groups[k] ?? [])) {
    const able = g.members.filter((m) => {
      const fa = onFoot.actors[m]?.fight;
      return fa !== undefined && fighting(fa);
    });
    if (able.length > 0 && household >= 2 * able.length) {
      g.outnumberedSince ??= tick;
      if (tick - g.outnumberedSince >= c.outnumberedEveryTicks) {
        g.cohesion += c.outnumbered;
        g.outnumberedSince = tick;
      }
    } else g.outnumberedSince = null;
    for (const m of able) {
      const a = onFoot.actors[m];
      const fa = a?.fight;
      if (a === undefined || fa === undefined || fa.berserkUntil > tick) continue;
      const coward = world.people[m]?.traits.some((t) => t.trait === 'COWARDLY') === true;
      const breakAt = coward ? ctx.ai.cowardBreak : c.surrenderBelow;
      if (g.cohesion >= breakAt) continue;
      const noQuarter =
        world.ledger.filter((d) => d.tag === 'SURRENDERED_KILLED' && d.doer === 'HOUSEHOLD')
          .length >= c.noQuarterAfter;
      if (g.cohesion < c.fleeBelow || noQuarter) {
        fa.ai.mode = 'FLEE';
        fa.f.state = 'idle';
        delete a.archer;
        a.aim = null;
        say(ctx, m, 'flee', fw.emit, tick);
      } else {
        fa.f.state = 'surrendered';
        fa.f.since = tick;
        fa.ai.mode = 'SURRENDER';
        fa.ai.goal = null;
        delete a.archer;
        a.aim = null;
        a.facing = facingOf(onFoot.player.x - a.x, onFoot.player.y - a.y, a.facing);
        fa.f.facing = a.facing;
        fw.emit({ type: 'PERSON_SURRENDERED', person: m });
        say(ctx, m, 'plead', fw.emit, tick);
      }
    }
  }
  // The fight is over when no enemy in the zone still fights: all dead, fled or surrendered.
  const anyAble = Object.values(onFoot.actors).some(
    (a) => a.fight?.side === 'ENEMY' && fighting(a.fight),
  );
  if (!battle.over && battle.engaged && !anyAble) {
    battle.over = true;
    afterFight(fw);
    fw.emit({ type: 'FIGHT_ENDED', scene: battle.scene });
  }
}

/**
 * After a fight (Book 2 section 12: wounds result after a fight by severity): a household
 * fighter brought below half vitality takes a light wound; vitality comes back to its maximum less
 * Book 10's light-wound loss. The downed stay downed until brought to safety.
 */
export function afterFight(fw: Pick<FightWorld, 'world' | 'ctx'>): void {
  const { world, ctx } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const lightLoss = ctx.cb.lightWoundVitality;
  if (world.player.vitality < ctx.cb.vitality * ctx.cb.bloodiedBelow && world.player.vitality > 0)
    world.player.wounds.push({ day: world.calendar.day, severity: 'LIGHT', where: 'body' });
  const lights = world.player.wounds.filter((w) => w.severity === 'LIGHT').length;
  if (world.player.vitality > 0) world.player.vitality = ctx.cb.vitality - lightLoss * lights;
  for (const [id, a] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    const fa = a.fight;
    const person = world.people[id];
    if (
      fa?.side !== 'HOUSEHOLD' ||
      person === undefined ||
      fa.f.state === 'downed' ||
      fa.dead !== null
    )
      continue;
    if (fa.vitality < fa.maxVitality * ctx.cb.bloodiedBelow) {
      person.wounds.push({ day: world.calendar.day, severity: 'LIGHT', where: 'body' });
      if (person.status === 'alive') person.status = 'wounded';
    }
    fa.vitality =
      fa.maxVitality - lightLoss * person.wounds.filter((w) => w.severity === 'LIGHT').length;
    person.vitality = fa.vitality;
  }
}

/**
 * The steerer walks out of the zone: the scene there ends (Book 2 section 12, Left behind). A
 * downed ally where enemies still hold the ground is captured (by enemies who take captives) or
 * killed; Rán's mercy turns a death into a grave wound (captured where the enemy takes captives).
 * Missiles in props and bodies are gone (Book 10 stuckArrows); the surrendered left alone go their
 * way, spared.
 */
export function leaveZone(fw: Pick<FightWorld, 'world' | 'ctx' | 'emit' | 'deed'>): void {
  const { world } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const battle = onFoot.battle ?? null;
  const holding = Object.values(onFoot.actors).some(
    (a) => a.fight?.side === 'ENEMY' && fighting(a.fight),
  );
  const takes = battle !== null && Object.values(battle.groups).some((g) => g.takesCaptives);
  for (const [id, a] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    const fa = a.fight;
    const person = world.people[id];
    if (fa === undefined || person === undefined) continue;
    if (fa.side === 'HOUSEHOLD' && fa.f.state === 'downed' && a.pose === 'down' && holding) {
      let fate: 'CAPTURED' | 'KILLED' | 'GRAVE';
      if (takes) {
        fate = 'CAPTURED';
        person.status = 'captive';
      } else if (fw.world.options.ransMercy) {
        fate = 'GRAVE';
        person.wounds.push({ day: world.calendar.day, severity: 'GRAVE', where: 'body' });
      } else {
        fate = 'KILLED';
        person.status = 'dead';
        fa.f.state = 'dead';
        fa.dead = { tick: world.tick, piece: null, dir: 0 };
        a.pose = 'dead';
      }
      fw.emit({ type: 'LEFT_BEHIND', person: id, fate });
      if (fate === 'CAPTURED') Reflect.deleteProperty(onFoot.actors, id);
    }
    if (fa.side === 'ENEMY' && fa.f.state === 'surrendered') {
      fw.deed('SPARED', [id], []);
      Reflect.deleteProperty(onFoot.actors, id);
      person.status = 'missing';
    }
  }
  if (battle !== null && (battle.over || !holding)) onFoot.battle = null;
  // A fight still held goes with the zone (src/sim/land/zoneLinks.ts keeps it there).
  // The steerer's own fight state starts afresh.
  const f = onFoot.player.fight;
  if (f != null && f.state !== 'dead') {
    f.state = 'idle';
    f.since = world.tick;
    f.guard = false;
  }
}
