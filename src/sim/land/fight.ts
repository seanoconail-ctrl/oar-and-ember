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
import { hears, lightAt, remembered, sees, sightRange } from '../ai/perception.ts';
import type { Memory } from '../ai/perception.ts';
import { seasonOf } from '../calendar/calendar.ts';
import {
  blowOf,
  charging,
  damageOf,
  enterTimed,
  FACING_ANGLE,
  facingOfAngle,
  feetPlanted,
  feint,
  free,
  hitstop,
  hitstopFor,
  inFrontAngle,
  interruptHeal,
  knockbackFor,
  newFighter,
  OUT_OF_FIGHT,
  poiseHit,
  poiseMax,
  pressAttack,
  pressBackstab,
  pressDodge,
  pressParry,
  pressShove,
  releaseAttack,
  resolveBlow,
  setAngle,
  setBlock,
  startHeal,
  startSidestep,
  stepFighter,
  strikePhase,
  striking,
  turnTowards,
  updateExhausted,
  wrapAngle,
} from '../combat/fighter.ts';
import type {
  Blow,
  BlowKind,
  Facing,
  Fighter,
  Outcome,
  PoiseResult,
  StaminaPool,
} from '../combat/fighter.ts';
import { orderShot } from './archer.ts';
import { STEERER } from './missiles.ts';
import { footprintClear, TICKS_PER_SECOND } from './onFoot.ts';
import type { LandContext, OnFootActor, OnFootState } from './onFoot.ts';
import { solidAt, terrainAt, tileOf } from './zoneMap.ts';
import { tilePath } from './path.ts';
import { parseSearchBalance } from '../../content/searchBalance.ts';
import type { ZoneMap } from './zoneMap.ts';
import type { WorldState } from '../world.ts';

export type CrewOrder = 'FOLLOW' | 'HOLD' | 'ATTACK' | 'PROTECT' | 'CARRY' | 'WITHDRAW';
export type Side = 'HOUSEHOLD' | 'ENEMY';
export type Piece = 'HEAD' | 'ARM' | 'LEG';

/**
 * What a person's fighting brain is doing (Book 2 section 13's behaviours: Stage 9's, and combat
 * v2's WARN, HOLD_OFF, CIRCLE and RETREAT; LEAVE is a scavenger walking off, not fleeing).
 */
export type AiMode =
  | 'GUARD'
  | 'INVESTIGATE'
  | 'FIGHT'
  | 'FLEE'
  | 'SURRENDER'
  | 'ORDER'
  | 'WARN'
  | 'HOLD_OFF'
  | 'CIRCLE'
  | 'RETREAT'
  | 'LEAVE';

/** Book 2 section 12's FightV2 awareness of the household (Book 10 "Awareness", decision DE-9). */
export interface Awareness {
  /** 0 to 100 (Book 10 alertAt). */
  level: number;
  state: 'UNAWARE' | 'SUSPICIOUS' | 'ALERT';
  /** The tick something was last seen or heard (decay waits Book 10's time after it). */
  heard: number;
}

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
  goal: {
    x: number;
    y: number;
    run: boolean;
    away?: boolean;
    /** Face this point while moving (circling, backing off), rather than the way walked. */
    face?: { x: number; y: number };
    /** The walking speed's share (Book 10 strafe or backOff). */
    share?: number;
  } | null;
  shouted: boolean;
  /** The tick it last started an attack (Book 10 attackTokens: the longest waiting goes next). */
  lastStruck?: number;
  /** Combat v2: how aware it is of the household (Book 10 "Awareness"). */
  awareness: Awareness;
  /** Combat v2: step back out to hold off until this tick after its recovery (Book 10 stepOut). */
  stepOutAt: number;
  /** Called once for help when wounded (Book 10 woundedAt). */
  called: boolean;
  /** Which way it circles (1 clockwise, -1 counter), or null before it first circles. */
  sidestep: 1 | -1 | null;
  /** A feint's tell is lowered at this tick (Book 10 feint), or -1. */
  feintAt: number;
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
  /**
   * Combat v2 (Book 10 "Warnings", decision DE-11): the warnings given (0 to 3), the tick of the
   * last, and whether the one for a weapon taken in hand has been given; null with none yet.
   */
  warn?: WarnState | null;
}

/** The warnings under way before a fight (Book 10 "Warnings"). */
export interface WarnState {
  stage: number;
  last: number;
  armed: boolean;
  /** Who gives them (the first of the group with warning lines). */
  by: Id;
  /** How far off the steerer was at the last warning (world px). */
  at?: number;
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
  | {
      readonly type: 'ATTACK_STARTED';
      readonly who: Id;
      readonly heavy: boolean;
      /** Combat v2: a lunge's tell, a riposte or a backstab begun (their own sounds). */
      readonly kind?: 'lunge' | 'riposte' | 'backstab';
    }
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
      /** Combat v2 (Book 10 "Hit reactions"): what kind of blow, and what it did to the body. */
      readonly kind?: BlowKind | 'missile';
      readonly reaction?: PoiseResult;
      /** Ticks of hitstop given, the knockback in px, the camera's shake (none: null). */
      readonly hitstop?: number;
      readonly knockback?: number;
      readonly shake?: { readonly px: number; readonly ticks: number } | null;
      /** The one hit was unaware (a backstab, or a missile's double damage). */
      readonly unaware?: boolean;
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
  | {
      readonly type: 'FIGHT_REFUSED';
      readonly reason: 'NO_SHIELD' | 'NO_STAMINA' | 'NO_BINDING' | 'NO_RATION' | 'EXHAUSTED';
    }
  /** Combat v2: an enemy's awareness of the household changed (Book 10 "Awareness"). */
  | {
      readonly type: 'AWARENESS';
      readonly person: Id;
      readonly state: 'UNAWARE' | 'SUSPICIOUS' | 'ALERT';
    }
  /** A warning before a fight (Book 10 "Warnings"): its number, 1 to 4 (4: for a weapon in hand). */
  | { readonly type: 'WARNED'; readonly person: Id; readonly stage: number }
  /** The steerer locked on to someone, or let go (null). */
  | { readonly type: 'LOCK_ON'; readonly target: Id | null }
  /** Someone sidestepped a missile they saw coming (Book 10 awareDodge); the tell begins. */
  | { readonly type: 'SIDESTEP'; readonly who: Id; readonly missile: number }
  | { readonly type: 'FEINT'; readonly who: Id }
  | { readonly type: 'MISSED'; readonly who: Id }
  | { readonly type: 'CALLED_FOR_HELP'; readonly person: Id }
  | { readonly type: 'SHIELD_BROKEN'; readonly who: Id }
  /** Binding a wound or eating (Book 10 "Health, stamina and healing"). */
  | { readonly type: 'HEAL_STARTED'; readonly kind: 'BIND' | 'EAT' }
  | {
      readonly type: 'HEALED';
      readonly kind: 'BIND' | 'EAT';
      readonly vitality: number;
      readonly stamina: number;
    }
  | { readonly type: 'HEAL_INTERRUPTED'; readonly kind: 'BIND' | 'EAT' }
  /** A scavenger walked off: the steerer clearly stronger, a bargain taken, or dark come. */
  | { readonly type: 'PERSON_LEFT'; readonly person: Id }
  /**
   * The scavengers at dusk are settled (decision DE-15; for the narrative's beats): `FOOD` (a
   * bargain), `DARK` (they finished and went to the fold, or were never met), `FOUGHT` (with
   * what became of each); `ch1.dusk` holds the outcome, `ch1.dusk.<person>` each one's fate.
   */
  | {
      readonly type: 'DUSK_RESOLVED';
      readonly outcome: 'FOOD' | 'DARK' | 'FOUGHT';
      readonly fates: Readonly<Record<Id, DuskFate>>;
    };

/** What became of one of the scavengers at dusk. */
export type DuskFate = 'DEAD' | 'SPARED' | 'FLED' | 'LEFT' | 'DOWNED' | 'HELD';

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
    awareness: { level: 0, state: 'UNAWARE', heard: -1 },
    stepOutAt: -1,
    called: false,
    sidestep: null,
    feintAt: -1,
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
    // Combat v2: the scavengers at dusk are there from Book 10's time on the first day until dark,
    // unless it has already been settled (decision DE-15).
    if (enc.dusk === true && force !== enc.id && !duskOpen(world, ctx)) continue;
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
      // Stage 11: the dead, the taken and the gone are not placed again (the wreckers at Seal Cave
      // after the sheepfold are the ones who walked away from it).
      if (person.status === 'dead' || person.status === 'captive') continue;
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
          // A shield on the back while working is not in hand (Svart at dusk, DE-14).
          shield: (fd.shield ?? false) && enc.shieldOnBack?.includes(m.person) !== true,
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
    if (group.members.length === 0) continue;
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

/**
 * Book 2 section 12's Stance, kept on the steerer (decisions DE-2, DE-3 and DE-9): the true
 * facing, the locked target, sneaking; with the aim the facing turns to, the lock key's hold, how
 * long the target has been out of sight, and the speed share this tick's movement takes.
 */
export interface Stance {
  facing: number;
  lockOn: Id | null;
  sneaking: boolean;
  want: number | null;
  lockHeld: number | null;
  lostSince: number | null;
  speed: number;
}

export function newStance(facing: Facing): Stance {
  return {
    facing: FACING_ANGLE[facing],
    lockOn: null,
    sneaking: false,
    want: null,
    lockHeld: null,
    lostSince: null,
    speed: 1,
  };
}

/** The steerer's stance, made on first need. */
export function stanceOf(world: WorldState): Stance | null {
  const p = world.onFoot?.player;
  if (p == null) return null;
  p.stance ??= newStance(p.facing);
  return p.stance;
}

/** The item in the steerer's hand (the hotbar's selected slot). */
function inHand(world: WorldState): Id | null {
  return world.player.hotbar.slots[world.player.hotbar.selected] ?? null;
}

/**
 * Whether the steerer is in the combat stance (Book 10 stance): a melee weapon, a shield or a bow
 * in hand, and not carrying anyone.
 */
export function inStance(world: WorldState, ctx: FightContext): boolean {
  const item = inHand(world);
  if (item === null || world.onFoot?.carrying != null) return false;
  return weaponRow(ctx, item) !== null || item === 'ITEM_SHIELD' || item === 'ITEM_BOW';
}

/** The angle the steerer's strikes go at: the stance's facing (or a given facing outside it). */
function steererAngle(world: WorldState, fallback: Facing): number {
  const st = world.onFoot?.player.stance;
  return st != null && (st.want !== null || st.lockOn !== null)
    ? st.facing
    : FACING_ANGLE[fallback];
}

/** The reach of a person's weapon in hand, in tiles to the near edge of a body (Book 10). */
export function reachOf(ctx: FightContext, f: Fighter | null): number {
  if (f?.weapon == null) return ctx.cb.unarmed.reachTiles;
  return ctx.cb.weapons[f.weapon].reachTiles;
}

/**
 * Whether a foe is open to a backstab from (x, y) (Book 10 "Sneak attacks"): the striker within
 * its back's arc, and the foe unaware, or suspicious and not facing the striker.
 */
export function backstabOpen(
  ctx: FightContext,
  foe: OnFootActor,
  from: { readonly x: number; readonly y: number },
): boolean {
  const fa = foe.fight;
  if (fa?.side !== 'ENEMY' || !fighting(fa) || !free(fa.f)) return false;
  const aw = fa.ai.awareness.state;
  const dx = from.x - foe.x;
  const dy = from.y - foe.y;
  // Within Book 10's degrees of the back, either side of it (decision DE-42).
  const back = inFrontAngle(
    wrapAngle(fa.f.angle + Math.PI),
    dx,
    dy,
    2 * ctx.ai.sneakAttacks.backArcDegrees,
  );
  if (!back) return false;
  if (aw === 'UNAWARE') return true;
  return aw === 'SUSPICIOUS' && !inFrontAngle(fa.f.angle, dx, dy, ctx.ai.sight.coneDegrees);
}

/** The nearest foe in a strike's reach and arc from the steerer, with a test. */
function foeInReach(
  world: WorldState,
  ctx: FightContext,
  tile: number,
  angle: number,
  reachTiles: number,
  test: (id: Id, a: OnFootActor) => boolean,
): Id | null {
  const onFoot = world.onFoot;
  if (onFoot === null) return null;
  const p = onFoot.player;
  const reach = (reachTiles + ctx.cb.bodyRadiusTiles) * tile;
  let best: { id: Id; d: number } | null = null;
  for (const [id, a] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    if (a.fight?.side !== 'ENEMY' || !test(id, a)) continue;
    const dx = a.x - p.x;
    const dy = a.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > reach || !inFrontAngle(angle, dx, dy, ctx.cb.strikeArcDegrees)) continue;
    if (best === null || d < best.d) best = { id, d };
  }
  return best?.id ?? null;
}

/**
 * The melee press (Book 2 section 12, combat v2): a riposte on the parried foe, a backstab on an
 * unaware back, a lunge (running at the faced direction, or at a locked target beyond reach), or
 * the charge (a light attack if let go before level 1).
 */
export function meleePress(
  world: WorldState,
  ctx: FightContext,
  facing: Facing,
  emit: FightEmit,
  tile = 24,
): void {
  const f = steererFighter(world, ctx);
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  if (f?.weapon == null || onFoot.carrying !== null) return;
  if (f.state === 'heal') interruptHealOf(world, emit);
  const tick = world.tick;
  const p = onFoot.player;
  const angle = steererAngle(world, facing);
  const w = ctx.cb.weapons[f.weapon];
  const st = p.stance ?? null;
  const ripReach = w.reachTiles + ctx.cb.parry.riposteReachExtra;
  const riposteAt =
    tick < f.riposteUntil
      ? foeInReach(world, ctx, tile, angle, ripReach, (_, a) => a.fight?.f.state === 'parried')
      : null;
  const backstab =
    free(f) && riposteAt === null
      ? foeInReach(world, ctx, tile, angle, w.reachTiles, (_, a) => backstabOpen(ctx, a, p))
      : null;
  let lunge = false;
  const target = st?.lockOn == null ? null : onFoot.actors[st.lockOn];
  if (target !== undefined && target !== null) {
    const d = Math.hypot(target.x - p.x, target.y - p.y);
    lunge = d > (w.reachTiles + ctx.cb.bodyRadiusTiles) * tile;
  }
  if (p.moving && p.gait === 'run') {
    const move = Math.atan2(p.intent.y, p.intent.x);
    if (Math.abs(wrapAngle(move - angle)) <= (ctx.cb.stance.forwardDegrees * Math.PI) / 180)
      lunge = true;
  }
  const inside =
    f.weapon === 'Spear' &&
    foeInReach(world, ctx, tile, angle, ctx.cb.rules.spearInsideTiles, () => true) !== null;
  let r;
  if (backstab !== null && tick >= f.riposteUntil) {
    setAngle(f, angle);
    const sa = ctx.ai.sneakAttacks;
    r = pressBackstab(
      f,
      tick,
      ctx.cb,
      backstab,
      pool(world),
      f.weapon === 'Seax' ? sa.ticksSeax : sa.ticks,
    );
  } else {
    r = pressAttack(f, tick, ctx.cb, angle, pool(world), { lunge, inside, riposteAt });
  }
  f.turnFrom = f.angle;
  if (r === 'NO_STAMINA') emit({ type: 'FIGHT_REFUSED', reason: 'NO_STAMINA' });
  if (r === 'STARTED') {
    const kind =
      f.state === 'riposte'
        ? 'riposte'
        : f.state === 'backstab'
          ? 'backstab'
          : f.state === 'lunge'
            ? 'lunge'
            : undefined;
    emit({
      type: 'ATTACK_STARTED',
      who: STEERER,
      heavy: kind !== undefined,
      ...(kind === undefined ? {} : { kind }),
    });
    if (kind !== undefined) emit({ type: 'SWING', who: STEERER, heavy: true, weapon: f.weapon });
    if (st !== null) st.sneaking = st.sneaking && f.state === 'backstab';
  }
}

export function meleeRelease(world: WorldState, ctx: FightContext, emit: FightEmit): void {
  const f = world.onFoot?.player.fight;
  if (f == null || !charging(f)) return;
  releaseAttack(f, world.tick, ctx.cb, pool(world));
  if (striking(f))
    emit({ type: 'SWING', who: STEERER, heavy: f.level > 0, weapon: f.weapon ?? '' });
}

export function steererParry(
  world: WorldState,
  ctx: FightContext,
  emit: FightEmit,
  window = ctx.cb.parry.window,
): void {
  const f = steererFighter(world, ctx);
  if (f === null || world.onFoot?.carrying != null) return;
  if (f.state === 'heal') interruptHealOf(world, emit);
  const r = pressParry(f, world.tick, ctx.cb, pool(world), window);
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
  if (on && f.state === 'heal') interruptHealOf(world, emit);
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
  if (f.state === 'heal') interruptHealOf(world, emit);
  updateExhausted(f, pool(world), ctx.cb);
  if (f.exhausted) {
    emit({ type: 'FIGHT_REFUSED', reason: 'EXHAUSTED' });
    return;
  }
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
  if (f.state === 'heal') interruptHealOf(world, emit);
  const r = pressShove(f, world.tick, ctx.cb, steererAngle(world, facing), pool(world));
  if (r === 'NO_STAMINA') emit({ type: 'FIGHT_REFUSED', reason: 'NO_STAMINA' });
  return r === 'STARTED';
}

/** The stance's aim (the FACE command): the angle the facing turns to, or none. */
export function steererFace(world: WorldState, angle: number | null): void {
  const st = stanceOf(world);
  if (st !== null) st.want = angle === null ? null : wrapAngle(angle);
}

/** The sneak key (Book 10 sneakToggle): the crouching walk on or off. */
export function steererSneak(world: WorldState, on?: boolean): void {
  const st = stanceOf(world);
  if (st === null) return;
  st.sneaking = on ?? !st.sneaking;
}

/** Whether a person can be locked on to: an enemy still in the fight. */
function lockable(a: OnFootActor | undefined): boolean {
  const fa = a?.fight;
  return fa?.side === 'ENEMY' && fighting(fa) && fa.f.state !== 'downed';
}

/**
 * The lock-on key (Book 10 "Stance and lock-on", decision DE-3): pressed, it takes the nearest
 * enemy in front within range (in the cone first), or with one locked, waits to see whether it is
 * a tap (the next enemy clockwise) or a hold (let go, at lockOnRelease's time; see stepStance).
 */
export function steererLockOn(
  world: WorldState,
  ctx: FightContext,
  down: boolean,
  emit: FightEmit,
  tile = 24,
): void {
  const st = stanceOf(world);
  const onFoot = world.onFoot;
  if (st === null || onFoot === null) return;
  const tick = world.tick;
  if (down) {
    if (st.lockOn === null) {
      const t = lockCandidate(world, ctx, tile, null);
      if (t !== null) {
        st.lockOn = t;
        st.lostSince = null;
        emit({ type: 'LOCK_ON', target: t });
      }
      st.lockHeld = null;
    } else st.lockHeld = tick;
    return;
  }
  if (st.lockHeld === null) return;
  const held = tick - st.lockHeld;
  st.lockHeld = null;
  if (st.lockOn === null || held >= ctx.cb.stance.lockReleaseHoldTicks) return;
  const next = lockCandidate(world, ctx, tile, st.lockOn);
  if (next !== null && next !== st.lockOn) {
    st.lockOn = next;
    st.lostSince = null;
    emit({ type: 'LOCK_ON', target: next });
  }
}

/**
 * The enemy the lock takes: with none locked, the nearest within lockOnRange inside the cone in
 * front, else the nearest within range; with one locked, the next clockwise from it.
 */
export function lockCandidate(
  world: WorldState,
  ctx: FightContext,
  tile: number,
  from: Id | null,
): Id | null {
  const onFoot = world.onFoot;
  const st = onFoot?.player.stance;
  if (onFoot == null) return null;
  const p = onFoot.player;
  const facing = st?.facing ?? FACING_ANGLE[p.facing];
  const range = ctx.cb.stance.lockOnRange * tile;
  const near: { id: Id; d: number; bearing: number }[] = [];
  for (const [id, a] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    if (!lockable(a)) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d > range) continue;
    near.push({ id, d, bearing: Math.atan2(a.y - p.y, a.x - p.x) });
  }
  if (near.length === 0) return null;
  if (from === null || !near.some((n) => n.id === from)) {
    const cone = near.filter((n) =>
      inFrontAngle(
        facing,
        Math.cos(n.bearing),
        Math.sin(n.bearing),
        ctx.cb.stance.lockOnConeDegrees,
      ),
    );
    const pick = (cone.length > 0 ? cone : near).sort(
      (a, b) => a.d - b.d || (a.id < b.id ? -1 : 1),
    );
    return pick[0]?.id ?? null;
  }
  // Clockwise (y runs south, so a growing angle turns clockwise on screen) from the one locked.
  const base = near.find((n) => n.id === from)?.bearing ?? 0;
  const rel = (b: number): number => {
    const r = wrapAngle(b - base);
    return r <= 1e-9 ? r + 2 * Math.PI : r;
  };
  const others = near.filter((n) => n.id !== from).sort((a, b) => rel(a.bearing) - rel(b.bearing));
  return others[0]?.id ?? from;
}

/**
 * The stance each tick (Book 10 "Stance and lock-on"): in the stance the facing turns at turnRate
 * towards the locked target, else the aim; a run turns it to the way of travel instead; attacks
 * commit (a windup turns at most attackTurn from where it began, an active or recovering strike
 * not at all). The lock lets go by Book 10's rules. The speed share is set for the movement:
 * forward, strafe or backing off by the angle between the way moved and the facing. Sneaking ends
 * on a run or when a fight starts.
 */
export function stepStance(
  world: WorldState,
  ctx: FightContext,
  tile: number,
  emit: FightEmit,
): void {
  const onFoot = world.onFoot;
  const st = stanceOf(world);
  if (onFoot === null || st === null) return;
  const p = onFoot.player;
  const f = p.fight ?? null;
  const tick = world.tick;
  const sc = ctx.cb.stance;
  const on = inStance(world, ctx);
  const moving = Math.hypot(p.intent.x, p.intent.y) > 1e-6;
  const running = moving && p.intent.run && p.winded?.run !== true && f?.exhausted !== true;
  if (running || (onFoot.battle?.engaged === true && !onFoot.battle.over)) {
    if (running || st.sneaking) st.sneaking = false;
  }
  // The lock lets go: held long enough, the target out of the fight, too far, or out of sight.
  if (st.lockOn !== null) {
    const t = onFoot.actors[st.lockOn];
    let release = !lockable(t) || !on;
    if (st.lockHeld !== null && tick - st.lockHeld >= sc.lockReleaseHoldTicks) {
      release = true;
      st.lockHeld = null;
    }
    if (t !== undefined && !release) {
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d > sc.lockLostRange * tile) release = true;
      const seen = d <= ctx.ai.sight.day * tile;
      if (!seen) st.lostSince ??= tick;
      else st.lostSince = null;
      if (st.lostSince !== null && tick - st.lostSince >= sc.lockLostTicks) release = true;
    }
    if (release) {
      st.lockOn = null;
      st.lostSince = null;
      emit({ type: 'LOCK_ON', target: null });
    }
  }
  const turn = (sc.turnDegreesPerTick * Math.PI) / 180;
  const travel = Math.atan2(p.intent.y, p.intent.x);
  let want: number | null;
  if (!on) want = moving ? travel : null;
  else if (running) want = travel;
  else if (st.lockOn !== null) {
    const t = onFoot.actors[st.lockOn];
    want = t === undefined ? st.want : Math.atan2(t.y - p.y, t.x - p.x);
  } else want = st.want ?? (moving ? travel : null);
  if (p.aim !== null) want = Math.atan2(p.aim.y, p.aim.x);
  if (f !== null && (f.hitstop > 0 || isCommitted(f, tick))) want = null;
  if (want !== null) {
    let next = on || p.aim !== null ? turnTowards(st.facing, want, turn) : wrapAngle(want);
    if (f !== null && (charging(f) || striking(f)) && tick < f.activeAt) {
      // A windup turns at most attackTurn from where the attack began.
      const lim = (sc.attackTurnDegrees * Math.PI) / 180;
      const off = wrapAngle(next - f.turnFrom);
      if (Math.abs(off) > lim) next = wrapAngle(f.turnFrom + Math.sign(off) * lim);
    }
    st.facing = next;
  }
  if (f !== null && !isCommitted(f, tick) && f.hitstop === 0) setAngle(f, st.facing);
  // The speed share (forward, strafe, back off) by the way moved against the facing.
  st.speed = 1;
  if (on && moving && !running) {
    const off = Math.abs(wrapAngle(travel - st.facing)) * (180 / Math.PI);
    st.speed =
      off <= sc.forwardDegrees ? sc.forward : off <= sc.backDegrees ? sc.strafe : sc.backOff;
  }
}

/** A strike past its windup, a defence or a timed state: the facing holds (attacks commit). */
function isCommitted(f: Fighter, tick: number): boolean {
  if (f.state === 'idle' || f.state === 'block' || f.state === 'heal' || charging(f)) return false;
  if (striking(f) && tick < f.activeAt) return false;
  return true;
}

/**
 * Binding a wound or eating (Book 10 "Health, stamina and healing"): a binding when hurt and one
 * is carried, else a ration if carried; the item is spent at once and lost if the heal is cut
 * short.
 */
export function steererHeal(world: WorldState, ctx: FightContext, emit: FightEmit): void {
  const f = steererFighter(world, ctx);
  const p = world.onFoot?.player;
  if (f === null || p == null || world.onFoot?.carrying != null || !free(f)) return;
  const inv = world.player.inventory;
  const hurtNow = world.player.vitality < healMax(world, ctx);
  const bindings = inv[BINDING] ?? 0;
  const rations = inv[RATION] ?? 0;
  const kind: 'BIND' | 'EAT' | null =
    hurtNow && bindings > 0 ? 'BIND' : rations > 0 ? 'EAT' : bindings > 0 ? 'BIND' : null;
  if (kind === null) {
    emit({ type: 'FIGHT_REFUSED', reason: hurtNow ? 'NO_BINDING' : 'NO_RATION' });
    return;
  }
  const item = kind === 'BIND' ? BINDING : RATION;
  const h = ctx.cb.heal;
  if (
    startHeal(f, world.tick, kind === 'BIND' ? h.bindTicks : h.eatTicks, {
      kind,
      x: p.x,
      y: p.y,
    }) !== 'STARTED'
  )
    return;
  inv[item] = (inv[item] ?? 0) - 1;
  if ((inv[item] ?? 0) <= 0) Reflect.deleteProperty(inv, item);
  emit({ type: 'HEAL_STARTED', kind });
}

/** The carried binding and ration (Book 10 healCarry). */
export const BINDING: Id = 'ITEM_BINDING';
export const RATION: Id = 'ITEM_RATION';

/** The steerer's vitality maximum: Book 10's, less light wounds (as after a fight). */
function healMax(world: WorldState, ctx: FightContext): number {
  const lights = world.player.wounds.filter((w) => w.severity === 'LIGHT').length;
  return ctx.cb.vitality - ctx.cb.lightWoundVitality * lights;
}

function interruptHealOf(world: WorldState, emit: FightEmit): void {
  const f = world.onFoot?.player.fight;
  const kind = f?.heal?.kind;
  if (f != null && kind !== undefined && interruptHeal(f, world.tick))
    emit({ type: 'HEAL_INTERRUPTED', kind });
}

/**
 * A heal under way each tick: a run or a step of more than Book 10's distance ends it (the item
 * lost); a hit, a dodge and a block end it where they happen. Done, it restores what it gives.
 */
function stepHeal(
  fw: FightWorld,
  ended: { state: string; heal?: { kind: 'BIND' | 'EAT' } }[],
): void {
  const { world, ctx, map } = fw;
  const p = world.onFoot?.player;
  const f = p?.fight;
  if (p == null || f == null) return;
  for (const e of ended) {
    if (e.state !== 'heal' || e.heal === undefined) continue;
    const h = ctx.cb.heal;
    const before = world.player.vitality;
    const st = world.player.stamina;
    const stBefore = st.current;
    if (e.heal.kind === 'BIND')
      world.player.vitality = Math.min(healMax(world, ctx), world.player.vitality + h.bindVitality);
    else {
      world.player.vitality = Math.min(healMax(world, ctx), world.player.vitality + h.eatVitality);
      st.current = Math.min(st.max, st.current + h.eatStamina);
    }
    fw.emit({
      type: 'HEALED',
      kind: e.heal.kind,
      vitality: world.player.vitality - before,
      stamina: st.current - stBefore,
    });
  }
  if (f.state !== 'heal' || f.heal === null) return;
  const stepped = Math.hypot(p.x - f.heal.x, p.y - f.heal.y) > ctx.cb.heal.stepTiles * map.tile;
  const ran = p.moving && p.gait === 'run';
  if (stepped || ran) interruptHealOf(world, fw.emit);
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
    const front = inFrontAngle(
      p.stance?.facing ?? FACING_ANGLE[p.facing],
      a.x - p.x,
      a.y - p.y,
      180,
    )
      ? 0
      : 1000;
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
  /**
   * Combat v2 (Book 10 avoid): whether a point is ground a fighter keeps off: deep water, a cliff's
   * edge or near a fire.
   */
  readonly avoid?: (x: number, y: number) => boolean;
  /** Whether it is raining (Book 10 rain: sight and noise shortened); false until weather comes. */
  readonly rain?: boolean;
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
  // The steerer's own state machine (held in hitstop: its clock does not run).
  const sf = onFoot.player.fight;
  if (sf != null) {
    const wasHit = sf.hitstop > 0;
    const ended: { state: string; heal?: { kind: 'BIND' | 'EAT' } }[] = [];
    for (const e of stepFighter(sf, tick, ctx.cb, pool(world))) {
      if (e.type === 'CHARGE_LEVEL')
        fw.emit({ type: 'CHARGE_LEVEL', who: STEERER, level: e.level });
      if (e.type === 'AUTO_RELEASE')
        fw.emit({ type: 'SWING', who: STEERER, heavy: sf.level > 0, weapon: sf.weapon ?? '' });
      if (e.type === 'MISSED') fw.emit({ type: 'MISSED', who: STEERER });
      if (e.type === 'STATE_ENDED')
        ended.push(e.heal === undefined ? { state: e.state } : { state: e.state, heal: e.heal });
    }
    stepHeal(fw, ended);
    if (!wasHit) strikeMotion(fw, sf, onFoot.player);
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
  // Fighters choose, then their state machines run, then they walk. A fighter in hitstop is held.
  for (const [id, a] of actors) {
    const fa = a.fight;
    if (fa === undefined) continue;
    if (fa.f.hitstop > 0) {
      stepFighter(fa.f, tick, ctx.cb, fa.stamina);
      delete a.moving;
      continue;
    }
    if (fa.dead === null && fa.f.state !== 'downed') think(fw, id, a, fa);
    for (const e of stepFighter(fa.f, tick, ctx.cb, fa.stamina)) {
      if (e.type === 'CHARGE_LEVEL') fw.emit({ type: 'CHARGE_LEVEL', who: id, level: e.level });
      if (e.type === 'MISSED') fw.emit({ type: 'MISSED', who: id });
      // Book 10 stepOut: after its own recovery a fighter steps back out to hold off.
      if (e.type === 'STATE_ENDED' && STRIKE_ENDS.includes(e.state))
        fa.ai.stepOutAt = tick + ctx.ai.self.stepOutTicks;
    }
    regen(fa, ctx, tick);
    a.blocking = fa.f.shield && (fa.f.state === 'block' || fa.f.state === 'blockStun');
    if (fa.f.state !== 'idle' || fa.dead !== null) a.facing = fa.f.facing;
    walk(fw, id, a, fa);
    strikeMotion(fw, fa.f, a);
  }
  // Who is in an attack on whom this tick (Book 10 attackTokens, S9-29).
  if (battle !== null)
    for (const [, a] of actors) {
      const fa = a.fight;
      if (fa?.ai.target == null || !inAttack(a, tick)) continue;
      battle.lastAttack ??= {};
      battle.lastAttack[`${fa.side}:${fa.ai.target}`] = tick;
    }
  // Blows: every strike in its active ticks that has not yet met anyone.
  const strikers: [Id, Fighter, { x: number; y: number }][] = [];
  if (sf != null) strikers.push([STEERER, sf, onFoot.player]);
  for (const [id, a] of actors) if (a.fight !== undefined) strikers.push([id, a.fight.f, a]);
  for (const [id, f, at] of strikers) {
    if (f.hitstop > 0 || strikePhase(f, tick) !== 'active' || f.hit) continue;
    if (f.state === 'shove') shoveLands(fw, id, f, at);
    else strikeLands(fw, id, f, at);
  }
  finishWarnings(fw);
  secondWind(fw);
  if (battle !== null) {
    warnStep(fw, battle);
    morale(fw, battle);
  }
  stepDusk(fw);
}

/** The strike states whose end starts Book 10's stepOut. */
const STRIKE_ENDS: readonly string[] = [
  'light1',
  'light2',
  'light3',
  'heavyRelease',
  'riposte',
  'lunge',
  'backstab',
];

/**
 * A strike that moves the striker (Book 10): a lunge covers its ground over its windup, a
 * riposte steps in over its windup (riposteReach), and a sidestep moves as a dodge after its tell.
 * Never through blocking ground.
 */
function strikeMotion(fw: FightWorld, f: Fighter, at: { x: number; y: number }): void {
  const { world, ctx, map } = fw;
  const tick = world.tick;
  const tile = map.tile;
  let step = 0;
  let ux = Math.cos(f.angle);
  let uy = Math.sin(f.angle);
  if (f.state === 'lunge' && f.lunge !== null && tick >= f.lunge.from && tick < f.activeAt) {
    step = (f.lunge.tiles * tile) / Math.max(1, f.activeAt - f.lunge.from);
  } else if (f.state === 'riposte' && tick < f.activeAt) {
    step = (ctx.cb.parry.riposteReachExtra * tile) / Math.max(1, f.activeAt - f.since);
  } else if (f.state === 'sidestep' && f.dodge !== null && tick >= f.activeAt) {
    step = (ctx.cb.dodge.tiles * tile) / ctx.cb.dodge.ticks;
    ux = f.dodge.x;
    uy = f.dodge.y;
  }
  if (step <= 0) return;
  const nx = at.x + ux * step;
  const ny = at.y + uy * step;
  const ok = (x: number, y: number): boolean =>
    footprintClear(map, fw.land.rules, x, y, fw.tidalGroundOpen) && fw.avoid?.(x, y) !== true;
  if (ok(nx, at.y)) at.x = nx;
  if (ok(at.x, ny)) at.y = ny;
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
  const extra = f.riposte ? ctx.cb.parry.riposteReachExtra : 0;
  const reach = (ctx.cb.weapons[f.weapon].reachTiles + extra + ctx.cb.bodyRadiusTiles) * tile;
  const mySide = sideOf(onFoot, id);
  const berserk = (onFoot.actors[id]?.fight?.berserkUntil ?? -1) > world.tick;
  const hit: [Id, number][] = [];
  for (const [tid, pos, tf] of targets(onFoot)) {
    if (tid === id) continue;
    // A backstab is for its one target.
    if (f.state === 'backstab' && tid !== f.target) continue;
    const theirs = sideOf(onFoot, tid);
    // The steerer strikes anyone fighting; others strike the other side (a berserker, anyone).
    if (id !== STEERER && !berserk && (theirs === mySide || theirs === null)) continue;
    if (id === STEERER && theirs === 'HOUSEHOLD') continue;
    if (tf !== null && (tf.state === 'dead' || (tf.state === 'downed' && !berserk))) continue;
    const dx = pos.x - at.x;
    const dy = pos.y - at.y;
    const d = Math.hypot(dx, dy);
    if (d > reach || !inFrontAngle(f.angle, dx, dy, ctx.cb.strikeArcDegrees)) continue;
    hit.push([tid, d]);
  }
  if (hit.length === 0) return;
  hit.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  f.hit = true;
  const blow = blowOf(f, ctx.cb, { berserk });
  for (const [tid, d] of hit) {
    // A spear against a foe inside its reach does less (Book 10 spearInside).
    const inside =
      f.weapon === 'Spear' &&
      d - ctx.cb.bodyRadiusTiles * tile < ctx.cb.rules.spearInsideTiles * tile;
    landBlow(
      fw,
      id,
      f,
      tid,
      inside ? { ...blow, damage: blow.damage * ctx.cb.rules.spearInsideDamage } : blow,
      at,
    );
  }
  if (fw.world.onFoot?.battle != null) fw.world.onFoot.battle.lastBlow = world.tick;
}

/** The awareness of the one struck: unaware, suspicious or alert (the household are alert). */
function awarenessOf(onFoot: OnFootState, id: Id): Awareness['state'] {
  const fa = onFoot.actors[id]?.fight;
  return fa?.side !== 'ENEMY' ? 'ALERT' : fa.ai.awareness.state;
}

/**
 * A blow met (Book 2 section 12, combat v2): resolved against a dodge, a parry, a shield; on a hit,
 * the damage after armour, poise worn (a flinch, a stagger or a knockdown), the weapon's rules
 * (the spear's push and its edge past a shield), a backstab's kill, and the hit reactions: hitstop
 * on both fighters (simulation), and the knockback, flash, spray and shake (the BLOW event's, for
 * presentation).
 */
function landBlow(
  fw: FightWorld,
  attacker: Id,
  af: Fighter,
  defender: Id,
  blow: Blow,
  from: { x: number; y: number },
): void {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const tick = world.tick;
  const pos = whereIs(onFoot, defender);
  if (pos === null) return;
  const df =
    defender === STEERER ? steererFighter(world, ctx) : (onFoot.actors[defender]?.fight?.f ?? null);
  const dpool = defender === STEERER ? pool(world) : onFoot.actors[defender]?.fight?.stamina;
  const unaware = awarenessOf(onFoot, defender) === 'UNAWARE';
  const healing = df?.state === 'heal' ? (df.heal?.kind ?? null) : null;
  const hadShield = df?.shield === true;
  let outcome: Outcome = 'HIT';
  const toAttacker = { x: from.x - pos.x, y: from.y - pos.y };
  if (df !== null && dpool !== undefined)
    outcome = resolveBlow(af, df, blow, toAttacker, tick, ctx.cb, fw.options.parryWindow, dpool);
  const fa = onFoot.actors[defender]?.fight;
  const armour = df?.armour ?? 'NONE';
  const berserkDef = (fa?.berserkUntil ?? -1) > tick;
  let damage = 0;
  if (outcome === 'HIT' || outcome === 'GUARD_BROKEN')
    damage = damageOf(blow, armour, ctx.cb, berserkDef);
  // A spear thrust still lands part of itself past a single shield's edge (Book 10 spearEdge).
  if (outcome === 'BLOCKED' && blow.weapon === 'Spear')
    damage =
      Math.round(damageOf(blow, armour, ctx.cb, berserkDef) * ctx.cb.rules.spearEdge * 10) / 10;
  // A backstab (Book 10 "Sneak attacks"): the weak die outright; others take its multiple.
  let kill = false;
  if (blow.kind === 'backstab' && outcome === 'HIT') {
    const max = fa?.maxVitality ?? ctx.cb.vitality;
    const sa = ctx.ai.sneakAttacks;
    if (max <= sa.killAtOrBelow) kill = true;
    else
      damage = damageOf(
        { ...blow, damage: blow.damage * (af.weapon === 'Seax' ? sa.damageSeax : sa.damage) },
        armour,
        ctx.cb,
        berserkDef,
      );
  }
  let reaction: PoiseResult = 'NONE';
  if (df !== null && (outcome === 'HIT' || outcome === 'GUARD_BROKEN') && !kill)
    reaction = poiseHit(df, blow, tick, ctx.cb);
  // Hitstop: both fighters' clocks hold (simulation; Book 10 "Hit reactions").
  const stop = hitstopFor(blow, outcome, ctx.cb);
  if (stop > 0) {
    hitstop(af, stop);
    if (df !== null) hitstop(df, stop);
  }
  const landed = outcome === 'HIT' || outcome === 'GUARD_BROKEN';
  const knockback = landed ? knockbackFor(blow, reaction, ctx.cb) : 0;
  const big = blow.kind === 'riposte' || blow.kind === 'backstab';
  const heavyHit = blow.kind === 'heavy' || blow.kind === 'lunge';
  const shake = !landed
    ? null
    : big
      ? { px: ctx.cb.hit.shakeRiposte.px, ticks: ctx.cb.hit.shakeRiposte.ticks }
      : heavyHit || (defender === STEERER && damage >= ctx.cb.hit.shakeHeavy.steererDamage)
        ? { px: ctx.cb.hit.shakeHeavy.px, ticks: ctx.cb.hit.shakeHeavy.ticks }
        : null;
  const material =
    outcome === 'BLOCKED' || outcome === 'HOOKED' || outcome === 'PARRIED'
      ? outcome === 'PARRIED'
        ? 'NONE'
        : 'SHIELD'
      : landed
        ? df?.armour === 'MAIL'
          ? 'MAIL'
          : 'FLESH'
        : 'NONE';
  fw.emit({
    type: 'BLOW',
    attacker,
    defender,
    outcome,
    damage: kill ? (fa?.vitality ?? damage) : damage,
    heavy: !blow.light,
    x: pos.x,
    y: pos.y,
    dx: pos.x - from.x,
    dy: pos.y - from.y,
    material,
    kind: blow.kind,
    reaction,
    hitstop: stop,
    knockback,
    shake,
    unaware: blow.kind === 'backstab' || unaware,
  });
  if (outcome === 'DODGED') fw.emit({ type: 'DODGED', who: defender });
  if (hadShield && !shieldNow(df)) fw.emit({ type: 'SHIELD_BROKEN', who: defender });
  if (healing !== null && !inState(df, 'heal'))
    fw.emit({ type: 'HEAL_INTERRUPTED', kind: healing });
  // The spear keeps a foe at bay (Book 10 spearKeep): a hit pushes them back.
  if (landed && blow.weapon === 'Spear' && !kill) {
    const len = Math.hypot(pos.x - from.x, pos.y - from.y) || 1;
    const k = (ctx.cb.rules.spearKeepTiles * map.tile) / len;
    const nx = pos.x + (pos.x - from.x) * k;
    const ny = pos.y + (pos.y - from.y) * k;
    if (footprintClear(map, fw.land.rules, nx, pos.y, fw.tidalGroundOpen)) pos.x = nx;
    if (footprintClear(map, fw.land.rules, pos.x, ny, fw.tidalGroundOpen)) pos.y = ny;
  }
  // A blow from the household on someone not yet fighting starts the fight.
  if (sideOf(onFoot, attacker) === 'HOUSEHOLD' && sideOf(onFoot, defender) === 'ENEMY') {
    const battle = onFoot.battle ?? null;
    if (battle !== null && !battle.engaged) startFight(fw);
  }
  if (kill) {
    hurt(fw, defender, 9999, attacker, {
      heavyKill: true,
      weapon: af.weapon,
      dx: pos.x - from.x,
      dy: pos.y - from.y,
    });
  } else if (damage > 0) {
    hurt(fw, defender, damage, attacker, {
      heavyKill: af.state === 'heavyRelease' || big,
      weapon: af.weapon,
      dx: pos.x - from.x,
      dy: pos.y - from.y,
    });
  }
  // Heard: a fight is loud (Book 10 noiseCombat); a backstab a short struggle (backstabNoise).
  noise(
    fw,
    pos,
    blow.kind === 'backstab' ? ctx.ai.sneakAttacks.noiseTiles : ctx.ai.noise.combat,
    attacker,
  );
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
    if (d > reach || !inFrontAngle(f.angle, dx, dy, ctx.cb.strikeArcDegrees)) continue;
    if (best === null || d < best.d) best = { id: tid, d, f: tf };
  }
  f.hit = true;
  if (best?.f == null) return;
  if (best.f.state !== 'dodge' || !inDodge(best.f, world.tick, ctx)) {
    enterTimed(best.f, 'stagger', world.tick, ctx.cb.shove.stagger);
    // A shove wears poise too (the Unarmed row's, or the shield bash's); its stagger stands.
    best.f.poiseLost += f.shield ? ctx.cb.shieldBash.poiseDamage : ctx.cb.unarmed.poiseDamage;
    best.f.poiseAt = world.tick;
    if (best.f.poiseLost >= poiseMax(best.f, ctx.cb)) best.f.poiseLost = 0;
    // Pushed back a little: space made.
    const pos = whereIs(onFoot, best.id);
    if (pos !== null) {
      const [fx, fy] = [Math.cos(f.angle), Math.sin(f.angle)];
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
    // The struck know where the blow came from: alert at once.
    const src = whereIs(onFoot, by);
    if (src !== null && fa.side === 'ENEMY') {
      fa.ai.memory = { x: src.x, y: src.y, tick, seen: true };
      setAwareness(fw, id, a, fa, ctx.ai.awareness.alertAt);
      // The one who runs at dusk runs when hit at all (Book 10 connFlees).
      if (encounterOf(ctx, onFoot.battle)?.runsWhenFriendFalls === id) runs(fw, id, a, fa);
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
  friendFell(fw, id);
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

/**
 * A noise heard (Book 10 "Awareness", fillNoise): enemies in its radius learn where it came from,
 * and their awareness rises by Book 10's step.
 */
function noise(fw: FightWorld, at: { x: number; y: number }, radius: number, source: Id): void {
  const onFoot = fw.world.onFoot;
  if (onFoot === null) return;
  const src = whereIs(onFoot, source);
  if (sideOf(onFoot, source) === 'ENEMY') return;
  const r = radius * (fw.rain === true ? fw.ctx.ai.noise.rain : 1);
  for (const [id, a] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    const fa = a.fight;
    if (fa?.side !== 'ENEMY' || !fighting(fa)) continue;
    if (!hears(at, a, r, fw.map.tile)) continue;
    fa.ai.memory = { x: src?.x ?? at.x, y: src?.y ?? at.y, tick: fw.world.tick, seen: false };
    setAwareness(fw, id, a, fa, fa.ai.awareness.level + fw.ctx.ai.awareness.fillNoise);
  }
}

/**
 * An enemy's awareness set to a level (Book 10 "Awareness"): its state follows the thresholds;
 * turning suspicious it says so and goes to look, turning alert it raises the alarm (a shout that
 * others in earshot hear), and losing the trail it says so too.
 */
function setAwareness(fw: FightWorld, id: Id, a: OnFootActor, fa: ActorFight, level: number): void {
  const { ctx, world } = fw;
  const aw = fa.ai.awareness;
  const k = ctx.ai.awareness;
  aw.level = Math.max(0, Math.min(k.alertAt, level));
  aw.heard = world.tick;
  const was = aw.state;
  const now: Awareness['state'] =
    aw.level >= k.alertAt ? 'ALERT' : aw.level >= k.suspiciousAt ? 'SUSPICIOUS' : 'UNAWARE';
  if (now === was) return;
  aw.state = now;
  fw.emit({ type: 'AWARENESS', person: id, state: now });
  if (now === 'SUSPICIOUS' && was === 'UNAWARE') {
    say(ctx, id, 'suspicious', fw.emit, world.tick);
    // Stops work to look: the body says so.
    if (a.pose === 'work') a.pose = 'idle';
  }
  if (now === 'UNAWARE' && was === 'SUSPICIOUS') say(ctx, id, 'lost', fw.emit, world.tick);
  if (now === 'ALERT') becomeAlert(fw, id, a, fa);
  if (now !== 'ALERT') fa.ai.aware = false;
}

/** Turning alert (Book 10 alertAt): the fight's mind wakes, and a shout raises the others. */
function becomeAlert(fw: FightWorld, id: Id, a: OnFootActor, fa: ActorFight): void {
  const { ctx, world, map } = fw;
  const onFoot = world.onFoot;
  const ai = fa.ai;
  if (onFoot === null || ai.aware) return;
  ai.aware = true;
  delete a.task;
  a.pose = 'idle';
  fw.emit({ type: 'ENEMY_AWARE', person: id });
  if (ai.shouted) return;
  ai.shouted = true;
  say(ctx, id, 'alarm', fw.emit, world.tick);
  // A shout raises the others in earshot (Book 10 noiseShout).
  for (const [oid, o] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    const of = o.fight;
    if (oid === id || of?.side !== 'ENEMY' || of.ai.aware || !fighting(of)) continue;
    if (!hears(a, o, ctx.ai.noise.shout, map.tile)) continue;
    if (ai.memory !== null) of.ai.memory = { ...ai.memory, seen: false };
    setAwareness(fw, oid, o, of, ctx.ai.awareness.alertAt);
  }
}

/** Whether a point lies in ground that hides a sneaker (combat.json cover; Book 10 tallGrass). */
export function inCover(ctx: FightContext, zone: Id, x: number, y: number, tile: number): boolean {
  const tx = Math.floor(x / tile);
  const ty = Math.floor((y - 0.001) / tile);
  return ctx.def.hides.some(
    (c) => c.zone === zone && tx >= c.x0 && tx <= c.x1 && ty >= c.y0 && ty <= c.y1,
  );
}

/** The noise of the ground underfoot (Book 10 Perception's surface rows). */
export function groundNoise(fw: FightWorld, x: number, y: number): number {
  const n = fw.ctx.ai.noise;
  if (fw.wet?.(x, y) === true) return n.water;
  const t = tileOf(fw.map, x, y);
  const ter = terrainAt(fw.map, t.tx, t.ty);
  if (ter === 'shingle') return n.shingle;
  if (ter === 'foreshore' || ter === 'flats') return n.sand;
  if (ter === 'machair') return n.grass;
  return n.rock;
}

/** How loud a moving person's footsteps are, in tiles (Book 10: gait x the ground x rain). */
export function footstepNoise(fw: FightWorld, gait: string, x: number, y: number): number {
  const n = fw.ctx.ai.noise;
  const base = gait === 'run' ? n.run : gait === 'sneak' ? n.sneak : n.walk;
  return base * groundNoise(fw, x, y) * (fw.rain === true ? n.rain : 1);
}

/**
 * How far an enemy sees the steerer now (Book 10 Perception and "Sneaking"): the light's range
 * (rain shortens it); a sneaking steerer in tall grass is not seen beyond its distance, and at dusk
 * or night is seen at half the range.
 */
function sightOn(
  fw: FightWorld,
  light: ReturnType<typeof lightAt>,
  sneaking: boolean,
  x: number,
  y: number,
): number {
  const { ctx, world, map } = fw;
  let range = sightRange(ctx.ai, light, false) * (fw.rain === true ? ctx.ai.sight.rainFactor : 1);
  if (!sneaking) return range;
  if (light !== 'day') range *= ctx.ai.sneaking.shadow;
  if (world.onFoot !== null && inCover(ctx, world.onFoot.zone, x, y, map.tile))
    range = Math.min(range, ctx.ai.sneaking.hideTiles);
  return range;
}

/**
 * Perception at a decision (Book 2 section 13; Book 10 "Awareness"): sight fills awareness, faster
 * the nearer; the steerer's footfalls are heard by their ground; nothing seen or heard lets it
 * decay after Book 10's pause, though an alert actor stays alert for its memory. Returns the foe
 * seen nearest, if any.
 */
function perceive(
  fw: FightWorld,
  id: Id,
  a: OnFootActor,
  fa: ActorFight,
): { id: Id; pos: { x: number; y: number }; d: number } | null {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return null;
  const tick = world.tick;
  const tile = map.tile;
  const ai = fa.ai;
  const k = ctx.ai.awareness;
  const light = lightNow(world, ctx);
  const solid = (x: number, y: number): boolean => {
    const t = tileOf(map, x, y);
    const ter = terrainAt(map, t.tx, t.ty);
    return ter === 'rock' || solidAt(map, t.tx, t.ty);
  };
  const p = onFoot.player;
  const sneaking = p.gait === 'sneak' || p.stance?.sneaking === true;
  let seen: { id: Id; pos: { x: number; y: number }; d: number } | null = null;
  let rangeSeen = 0;
  const eye = { x: a.x, y: a.y, facing: facingOfAngle(fa.f.angle) };
  for (const [fid, pos] of foes(onFoot, 'ENEMY')) {
    const range =
      fid === STEERER
        ? sightOn(fw, light, sneaking, pos.x, pos.y)
        : sightRange(ctx.ai, light, false);
    const d = Math.hypot(pos.x - a.x, pos.y - a.y);
    const close = ai.aware && d < 2 * tile;
    if (!close && !sees(ctx.ai, eye, pos, range, tile, solid)) continue;
    if (seen === null || d < seen.d) {
      seen = { id: fid, pos, d };
      rangeSeen = range;
    }
  }
  let level = ai.awareness.level;
  let heard = false;
  if (seen !== null) {
    const dt = seen.d / tile;
    const span = Math.max(1e-6, rangeSeen - k.nearTiles);
    const rate =
      dt <= k.nearTiles
        ? k.fillNear
        : k.fillNear + (k.fillFar - k.fillNear) * Math.min(1, (dt - k.nearTiles) / span);
    level += (rate * ctx.ai.habits.decideEvery) / TICKS_PER_SECOND;
    ai.memory = { x: seen.pos.x, y: seen.pos.y, tick, seen: true };
    ai.target = seen.id;
    heard = true;
  }
  // The steerer's footfalls, one noise each Book 10 footfall while moving (by gait and ground).
  const every = Math.max(1, k.footfallTicks);
  const stepped =
    Math.floor(tick / every) !== Math.floor((tick - ctx.ai.habits.decideEvery) / every);
  if (p.moving && stepped && p.fight?.state !== 'dead') {
    const r = footstepNoise(fw, sneaking ? 'sneak' : p.gait, p.x, p.y);
    if (hears(p, a, r, tile)) {
      level += k.fillNoise;
      heard = true;
      if (seen === null) ai.memory = { x: p.x, y: p.y, tick, seen: false };
    }
  }
  if (heard) {
    setAwareness(fw, id, a, fa, level);
    return seen;
  }
  // Nothing: an alert actor holds for its memory; else it decays after the pause.
  if (ai.awareness.state === 'ALERT' && remembered(ctx.ai, ai.memory, tick)) return null;
  if (tick - ai.awareness.heard >= k.decayAfterTicks && ai.awareness.level > 0) {
    const heardAt = ai.awareness.heard;
    setAwareness(
      fw,
      id,
      a,
      fa,
      ai.awareness.level - (k.decayPerSecond * ctx.ai.habits.decideEvery) / TICKS_PER_SECOND,
    );
    ai.awareness.heard = heardAt;
  }
  return null;
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

/**
 * One fighter's choice (Book 2 section 13 at 10 Hz on the `ai` stream; combat v2's awareness,
 * warnings and self-preservation, decisions DE-6, DE-9 and DE-11).
 */
function think(fw: FightWorld, id: Id, a: OnFootActor, fa: ActorFight): void {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const tick = world.tick;
  const ai = fa.ai;
  const tile = map.tile;
  if (fa.f.state === 'surrendered') return;
  // A feint lowers its tell; a held charge comes out at its chosen tick.
  if (ai.feintAt >= 0 && tick >= ai.feintAt) {
    if (charging(fa.f)) {
      feint(fa.f, tick);
      fw.emit({ type: 'FEINT', who: id });
    }
    ai.feintAt = -1;
    ai.releaseAt = -1;
  }
  if (ai.releaseAt >= 0 && tick >= ai.releaseAt && charging(fa.f)) {
    const enc = encounterOf(ctx, onFoot.battle);
    const slowTell = enc?.teaches === id && fa.f.state !== 'chargeL0' ? ctx.ai.dusk.svartWindup : 0;
    releaseAttack(fa.f, tick, ctx.cb, fa.stamina, slowTell);
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
  if (ai.mode === 'FLEE' || ai.mode === 'LEAVE') {
    const p = onFoot.player;
    ai.goal = { x: p.x, y: p.y, run: ai.mode === 'FLEE', away: true };
    return;
  }
  const seen = perceive(fw, id, a, fa);
  const aw = ai.awareness.state;
  const battle = onFoot.battle ?? null;
  const enc = encounterOf(ctx, battle);
  if (aw !== 'ALERT') {
    if (aw === 'SUSPICIOUS' && ai.memory !== null) {
      // Turns to the last thing seen or heard and goes to look (Book 10 suspiciousAt).
      ai.mode = 'INVESTIGATE';
      const m = ai.memory;
      faceTowards(fw, fa, a, m.x, m.y);
      ai.goal = Math.hypot(m.x - a.x, m.y - a.y) > tile ? { x: m.x, y: m.y, run: false } : null;
      return;
    }
    // Unaware: back to what they were doing.
    backToWork(fw, a, fa);
    return;
  }
  if (battle !== null && !battle.engaged) {
    // Stage 10: an empty-handed steerer is met with words, for a while (decision S10-9).
    if (
      enc?.parley === true &&
      battle.parley == null &&
      (ai.target === STEERER || ai.target === null) &&
      openHanded(world, ctx)
    ) {
      battle.parley = { until: tick + ctx.parleyTicks, done: false };
      const leader = Object.entries(onFoot.actors).find(([, o]) => o.fight?.leader === true)?.[0];
      say(ctx, leader ?? id, 'parley', fw.emit, tick);
      for (const [oid, o] of Object.entries(onFoot.actors).sort(ORDERLY)) {
        const of = o.fight;
        if (of?.side !== 'ENEMY') continue;
        if (of.ai.awareness.state !== 'ALERT')
          setAwareness(fw, oid, o, of, ctx.ai.awareness.alertAt);
        delete o.task;
        o.pose = 'idle';
      }
    } else if (enc?.warns === true && !remembers(world, ctx, enc.id)) {
      // Combat v2: scavengers warn first (Book 10 "Warnings"); warnStep starts the fight.
      ai.mode = 'WARN';
      ai.goal = null;
      if (seen !== null) faceTowards(fw, fa, a, seen.pos.x, seen.pos.y);
      return;
    } else if (battle.parley == null || battle.parley.done) {
      battle.engaged = true;
      fw.emit({ type: 'FIGHT_STARTED', scene: battle.scene });
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
      faceTowards(fw, fa, a, p.x, p.y);
      return;
    }
    // Patience gone, a weapon taken up or a blow: the fight is on.
    startFight(fw);
    say(ctx, id, 'taunt', fw.emit, tick);
  }
  // Book 10 leash: they follow no further than their ground, and go back.
  const self = ctx.ai.self;
  if (Math.hypot(a.x - ai.home.x, a.y - ai.home.y) > self.leashTiles * tile) {
    ai.mode = 'GUARD';
    ai.goal = { x: ai.home.x, y: ai.home.y, run: false };
    return;
  }
  if (!remembered(ctx.ai, ai.memory, tick)) {
    // Lost for Book 10's memory time: back to what they were doing, until alerted again.
    setAwareness(fw, id, a, fa, ctx.ai.awareness.suspiciousAt - 1);
    ai.memory = null;
    backToWork(fw, a, fa);
    return;
  }
  if (seen === null) {
    // Lost from sight: go where they were last known and search there.
    ai.mode = 'INVESTIGATE';
    const m = ai.memory;
    ai.goal = m === null ? null : { x: m.x, y: m.y, run: false };
    return;
  }
  // Scavengers and thieves leave when the steerer's side is clearly stronger (leaveIfStronger).
  if (enc?.warns === true && clearlyStronger(fw, fa)) {
    leaveAll(fw, fa);
    return;
  }
  if (ai.mode !== 'RETREAT') ai.mode = 'FIGHT';
  engage(fw, id, a, fa, seen.id, seen.pos, seen.d);
}

/** Turns a fighter's true facing towards a point, at Book 10's turnRate. */
function faceTowards(fw: FightWorld, fa: ActorFight, a: OnFootActor, x: number, y: number): void {
  if (fa.f.state !== 'idle' && fa.f.state !== 'block') return;
  const turn = (fw.ctx.cb.stance.turnDegreesPerTick * fw.ctx.ai.habits.decideEvery * Math.PI) / 180;
  setAngle(fa.f, turnTowards(fa.f.angle, Math.atan2(y - a.y, x - a.x), turn));
  a.facing = fa.f.facing;
}

/** Back to what they were doing when nothing is happening: home, and the work there. */
function backToWork(fw: FightWorld, a: OnFootActor, fa: ActorFight): void {
  const ai = fa.ai;
  const tile = fw.map.tile;
  ai.mode = 'GUARD';
  ai.aware = false;
  const away = Math.hypot(a.x - ai.home.x, a.y - ai.home.y) > tile * 0.5;
  ai.goal = away ? { x: ai.home.x, y: ai.home.y, run: false } : null;
  if (!away && ai.task !== undefined && a.pose === 'idle' && fa.f.state === 'idle') {
    a.task = ai.task;
    a.pose = 'work';
    setAngle(fa.f, FACING_ANGLE[ai.home.facing]);
    a.facing = ai.home.facing;
  }
}

/** Whether the household remembers a group it fought and left (Book 10 remember: no warnings). */
export function remembers(world: WorldState, ctx: FightContext, group: Id): boolean {
  const day = world.facts[`enmity.${group}`];
  return typeof day === 'number' && world.calendar.day - day <= ctx.ai.self.rememberDays;
}

/**
 * Book 10 leaveIfStronger: the vitality of the steerer's side within its range is at least twice
 * that of this fighter's group still standing.
 */
function clearlyStronger(fw: FightWorld, fa: ActorFight): boolean {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null || fa.group === null) return false;
  const g = onFoot.battle?.groups[fa.group];
  if (g === undefined) return false;
  const p = onFoot.player;
  const range = ctx.ai.self.leaveRange * map.tile;
  let theirs = 0;
  for (const m of g.members) {
    const o = onFoot.actors[m]?.fight;
    if (o !== undefined && fighting(o)) theirs += o.vitality;
  }
  let ours = 0;
  for (const [fid, pos] of foes(onFoot, 'ENEMY')) {
    if (Math.hypot(pos.x - p.x, pos.y - p.y) > range) continue;
    ours += fid === STEERER ? world.player.vitality : (onFoot.actors[fid]?.fight?.vitality ?? 0);
  }
  return theirs > 0 && ours >= ctx.ai.self.leaveIfStronger * theirs;
}

/** A group walks off (scavengers outmatched, a bargain taken, dark come): they leave the zone. */
function leaveAll(fw: FightWorld, fa: ActorFight): void {
  const onFoot = fw.world.onFoot;
  if (onFoot === null || fa.group === null) return;
  const g = onFoot.battle?.groups[fa.group];
  for (const m of g?.members ?? []) {
    const o = onFoot.actors[m];
    const of = o?.fight;
    if (o === undefined || of === undefined || !fighting(of)) continue;
    of.ai.mode = 'LEAVE';
    of.ai.goal = null;
    delete o.task;
    delete o.archer;
    o.aim = null;
    o.pose = 'idle';
    if (charging(of.f)) feint(of.f, fw.world.tick);
    say(fw.ctx, m, 'leave', fw.emit, fw.world.tick);
  }
}

/** The one who runs when a friend falls, or when hit (Book 10 connFlees). */
function runs(fw: FightWorld, id: Id, a: OnFootActor, fa: ActorFight): void {
  if (fa.ai.mode === 'FLEE' || !fighting(fa)) return;
  fa.ai.mode = 'FLEE';
  if (!OUT_OF_FIGHT.includes(fa.f.state)) {
    fa.f.state = 'idle';
    fa.f.since = fw.world.tick;
  }
  delete a.archer;
  delete a.task;
  a.aim = null;
  a.pose = 'idle';
  say(fw.ctx, id, 'runs', fw.emit, fw.world.tick);
  fw.emit({ type: 'PERSON_FLED', person: id });
}

/** A member of a band fell (dead, downed or surrendered): its runner runs (Book 10 connFlees). */
function friendFell(fw: FightWorld, fallen: Id): void {
  const onFoot = fw.world.onFoot;
  const enc = encounterOf(fw.ctx, onFoot?.battle);
  const runner = enc?.runsWhenFriendFalls;
  if (onFoot == null || runner === undefined || runner === fallen) return;
  if (!enc?.members.some((m) => m.person === fallen)) return;
  const a = onFoot.actors[runner];
  if (a?.fight !== undefined) runs(fw, runner, a, a.fight);
}

/**
 * Self-preservation in a fight (Book 2 section 13; Book 10 "Self-preservation", decision DE-6):
 * an archer keeps its distance and shoots; a melee fighter holds off just outside the reach of the
 * one it faces (further from a longer weapon, closer to a seax), the one or two with the attack's
 * token step in to strike and step out after, and the rest circle; the wounded grow cautious, call
 * once for help and fall back to a friend.
 */
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
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const tick = world.tick;
  const tile = map.tile;
  const h = ctx.ai.habits;
  const self = ctx.ai.self;
  const ai = fa.ai;
  faceTowards(fw, fa, a, pos.x, pos.y);
  // An archer backed against something with the foe too close fights with its sidearm.
  // Backing off and stuck (it tried a whole decision and did not move): the sidearm, once.
  const cornered =
    fa.bow &&
    ai.mode === 'RETREAT' &&
    ai.goal?.away === true &&
    a.moving !== true &&
    fa.f.weapon !== null &&
    free(fa.f) &&
    d < h.fallBackFrom * tile;
  if (cornered) {
    ai.mode = 'FIGHT';
    ai.goal = null;
    if (d <= (reachOf(ctx, fa.f) + ctx.cb.bodyRadiusTiles) * tile && tokenFree(fw, id, target))
      startAttack(fw, id, a, fa, target, pos, {});
    else ai.goal = { x: pos.x, y: pos.y, run: false };
    return;
  }
  if (fa.bow && fa.arrows > 0) {
    // A shot loosed: the order is done; the next is a fresh choice.
    if (a.archer?.phase === 'moving') delete a.archer;
    if (a.archer !== undefined || a.aim != null) {
      ai.goal = null;
      return;
    }
    if (d < h.fallBackFrom * tile) {
      ai.mode = 'RETREAT';
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
    orderShot(a, { x: pos.x, y: pos.y }, { x: 0, y: 0, run: false, sneak: false });
    fa.arrows--;
    ai.nextAttack = tick + attackGap(fw, fa);
    ai.lastStruck = tick;
    say(ctx, id, 'taunt', fw.emit, tick + id.length);
    return;
  }
  const w = fa.f.weapon;
  if (w === null) return;
  const ws = ctx.cb.weapons[w];
  const body = ctx.cb.bodyRadiusTiles;
  const reach = (ws.reachTiles + body) * tile;
  // The weapon the foe has in hand (the steerer's: the hotbar's, before any blow is struck).
  const tf = fighterOf(onFoot, target);
  const foeWeapon = target === STEERER ? weaponRow(ctx, inHand(world)) : (tf?.weapon ?? null);
  const foeReach =
    foeWeapon === null ? ctx.cb.unarmed.reachTiles : ctx.cb.weapons[foeWeapon].reachTiles;
  const longer = foeReach >= ws.reachTiles + self.longReachAt;
  const shortFoe = foeWeapon === null || foeWeapon === 'Seax';
  const wounded = fa.vitality < fa.maxVitality * self.woundedAt;
  // Hold off just outside the foe's reach (further from a longer weapon; wounded, further still).
  let holdOff = (foeReach + body + self.holdOffExtra + (longer ? self.longReachExtra : 0)) * tile;
  if (shortFoe) holdOff = Math.min(holdOff, reach * self.shortReach);
  if (wounded) holdOff += self.woundedBackOff * tile;
  // Wounded: call once for help (a shout the others hear).
  if (wounded && !ai.called) {
    ai.called = true;
    say(ctx, id, 'help', fw.emit, tick);
    fw.emit({ type: 'CALLED_FOR_HELP', person: id });
    for (const [oid, o] of Object.entries(onFoot.actors).sort(ORDERLY)) {
      const of = o.fight;
      if (oid === id || of?.side !== fa.side || !fighting(of)) continue;
      if (hears(a, o, ctx.ai.noise.shout, tile)) {
        of.ai.memory = { x: pos.x, y: pos.y, tick, seen: false };
        setAwareness(fw, oid, o, of, ctx.ai.awareness.alertAt);
      }
    }
  }
  // Badly hurt: fall back towards the nearest friend (Book 10 retreatAt).
  if (fa.vitality < fa.maxVitality * self.retreatAt) {
    const friend = nearestFriend(onFoot, id, fa, a, self.retreatFriendTiles * tile);
    if (friend !== null && Math.hypot(friend.x - a.x, friend.y - a.y) > 1.5 * tile) {
      ai.mode = 'RETREAT';
      ai.goal = { x: friend.x, y: friend.y, run: false, face: pos };
      return;
    }
  }
  if (!free(fa.f) && fa.f.state !== 'block') {
    ai.goal = null;
    return;
  }
  // Stepping back out after its own blow (Book 10 stepOut).
  if (tick < ai.stepOutAt && d < holdOff) {
    ai.mode = 'HOLD_OFF';
    ai.goal = {
      x: pos.x,
      y: pos.y,
      run: false,
      away: true,
      face: pos,
      share: ctx.cb.stance.backOff,
    };
    return;
  }
  const presser = tokenFree(fw, id, target);
  if (!presser || tick < ai.nextAttack) {
    // The one waiting its turn holds off; the rest circle further out (Book 10 pressers).
    const pressing = presser || isPresser(fw, id, target);
    const ring = pressing
      ? holdOff
      : Math.min(Math.max(d, self.circleMin * tile), self.circleMax * tile);
    ai.mode = pressing ? 'HOLD_OFF' : 'CIRCLE';
    ai.sidestep ??= nextFloat(world.rng.ai) < 0.5 ? 1 : -1;
    ai.goal = circlePoint(fw, a, pos, ring, ai.sidestep);
    return;
  }
  const lungeTiles = ctx.cb.lunge.tiles[w];
  const strikeAt = reach * h.closeIn;
  // Out of reach: close to striking distance (a flank side when two or more), or lunge in.
  if (d > reach) {
    // A longer weapon is lunged past (Book 10 longReach), when the lunge would reach.
    if (longer && lungeTiles > 0 && d <= reach + lungeTiles * tile && free(fa.f)) {
      if (startAttack(fw, id, a, fa, target, pos, { lunge: true })) return;
    }
    const side = flankSlot(fw, id, target, pos, strikeAt);
    ai.mode = 'FIGHT';
    ai.goal = { x: side?.x ?? pos.x, y: side?.y ?? pos.y, run: d > h.runAt * tile };
    return;
  }
  ai.goal = null;
  startAttack(fw, id, a, fa, target, pos, {});
}

/** Whether a fighter holds (or is next for) its side's token on a target (S9-29). */
function isPresser(fw: FightWorld, id: Id, target: Id): boolean {
  const onFoot = fw.world.onFoot;
  const me = onFoot?.actors[id]?.fight;
  if (onFoot == null || me === undefined) return false;
  const others = Object.entries(onFoot.actors)
    .filter(
      ([oid, o]) =>
        oid !== id &&
        o.fight?.side === me.side &&
        o.fight.ai.target === target &&
        fighting(o.fight) &&
        o.fight.f.weapon !== null &&
        !(o.fight.bow && o.fight.arrows > 0),
    )
    .map(([, o]) => o.fight?.ai.lastStruck ?? -1);
  const mine = me.ai.lastStruck ?? -1;
  const ahead = others.filter((t) => t < mine).length;
  return ahead < fw.ctx.ai.habits.attackTokens;
}

/** A point on a ring round the target, a step round from where the fighter stands. */
function circlePoint(
  fw: FightWorld,
  a: OnFootActor,
  pos: { x: number; y: number },
  r: number,
  way: 1 | -1,
): FighterAi['goal'] {
  const bearing = Math.atan2(a.y - pos.y, a.x - pos.x);
  const step = (Math.PI / 8) * way;
  const x = pos.x + Math.cos(bearing + step) * r;
  const y = pos.y + Math.sin(bearing + step) * r;
  const ok =
    footprintClear(fw.map, fw.land.rules, x, y, fw.tidalGroundOpen) && fw.avoid?.(x, y) !== true;
  if (!ok) {
    const ai = a.fight?.ai;
    if (ai !== undefined) ai.sidestep = way === 1 ? -1 : 1;
    return {
      x: pos.x + Math.cos(bearing) * r,
      y: pos.y + Math.sin(bearing) * r,
      run: false,
      face: pos,
      share: fw.ctx.cb.stance.strafe,
    };
  }
  return { x, y, run: false, face: pos, share: fw.ctx.cb.stance.strafe };
}

/** The nearest standing friend of a fighter within a range. */
function nearestFriend(
  onFoot: OnFootState,
  id: Id,
  fa: ActorFight,
  a: OnFootActor,
  range: number,
): { x: number; y: number } | null {
  let best: { x: number; y: number; d: number } | null = null;
  for (const [oid, o] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    const of = o.fight;
    if (oid === id || of?.side !== fa.side || !fighting(of)) continue;
    const d = Math.hypot(o.x - a.x, o.y - a.y);
    if (d <= range && (best === null || d < best.d)) best = { x: o.x, y: o.y, d };
  }
  return best;
}

/**
 * An attack begun on a target: a lunge, or the charge (a light, or a heavy released later at
 * level 1, or level 2 against a raised shield); a share of starts are feints (Book 10 feint). The
 * tutorial's heavy at dusk heavies more (Book 10 svartHeavies).
 */
function startAttack(
  fw: FightWorld,
  id: Id,
  a: OnFootActor,
  fa: ActorFight,
  target: Id,
  pos: { x: number; y: number },
  kind: { lunge?: boolean },
): boolean {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return false;
  const tick = world.tick;
  const h = ctx.ai.habits;
  const ai = fa.ai;
  const angle = Math.atan2(pos.y - a.y, pos.x - a.x);
  const inside =
    fa.f.weapon === 'Spear' &&
    Math.hypot(pos.x - a.x, pos.y - a.y) - ctx.cb.bodyRadiusTiles * map.tile <
      ctx.cb.rules.spearInsideTiles * map.tile;
  if (
    pressAttack(fa.f, tick, ctx.cb, angle, fa.stamina, { lunge: kind.lunge === true, inside }) !==
    'STARTED'
  )
    return false;
  fa.f.turnFrom = fa.f.angle;
  ai.lastStruck = tick;
  a.facing = fa.f.facing;
  ai.nextAttack = tick + attackGap(fw, fa);
  if (fa.f.state === 'lunge') {
    fw.emit({ type: 'ATTACK_STARTED', who: id, heavy: true, kind: 'lunge' });
    return true;
  }
  fw.emit({ type: 'ATTACK_STARTED', who: id, heavy: false });
  const enc = encounterOf(ctx, onFoot.battle);
  const teaches = enc?.teaches === id;
  // A feint: the tell, then lowered with no swing.
  if (!teaches && nextFloat(world.rng.ai) < ctx.ai.self.feint) {
    ai.feintAt = tick + ctx.cb.charge.level1At - 1;
    return true;
  }
  const tf = fighterOf(onFoot, target);
  const chance = teaches ? ctx.ai.dusk.svartHeavies : h.heavyChance;
  const heavy = nextFloat(world.rng.ai) < chance;
  const shieldUp = tf !== null && tf.shield && (tf.state === 'block' || tf.guard);
  // Released the tick after the level is reached (the state machine steps after the choice).
  ai.releaseAt = heavy
    ? tick + (shieldUp ? ctx.cb.charge.level2At : ctx.cb.charge.level1At) + 1
    : tick + 1;
  return true;
}

/**
 * The time between one fighter's attacks, drawn on the `ai` stream (Book 10 attackGap; longer
 * when wounded, woundedAt).
 */
function attackGap(fw: FightWorld, fa?: ActorFight): number {
  const g = fw.ctx.ai.habits.attackGap;
  const self = fw.ctx.ai.self;
  const wounded = fa !== undefined && fa.vitality < fa.maxVitality * self.woundedAt;
  return Math.round(
    (g.min + nextFloat(fw.world.rng.ai) * (g.max - g.min)) * (wounded ? self.woundedGap : 1),
  );
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
    if (Math.hypot(dx, dy) > reach || !inFrontAngle(of.angle, dx, dy, ctx.cb.strikeArcDegrees))
      continue;
    ai.judged = of.since;
    const wounded = fa.vitality < fa.maxVitality * ctx.ai.self.woundedAt;
    const chance = h.reactChance + (wounded ? ctx.ai.self.woundedDefend : 0);
    if (nextFloat(world.rng.ai) >= chance) return;
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
    setAngle(fa.f, Math.atan2(pos.y - a.y, pos.x - a.x));
    a.facing = fa.f.facing;
    return;
  }
  // A shield raised against a bow drawn at it (Book 10 blockArrows): held while the draw lasts.
  if (fa.f.shield && fa.ai.aware && free(fa.f)) {
    const p = onFoot.player;
    if (p.aim != null) {
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      if (inFrontAngle(Math.atan2(p.aim.y, p.aim.x), dx, dy, ctx.cb.strikeArcDegrees)) {
        setAngle(fa.f, Math.atan2(-dy, -dx));
        a.facing = fa.f.facing;
        ai.react = {
          kind: 'BLOCK',
          at: tick + h.reactTicks,
          until: tick + h.reactTicks + ctx.cb.charge.maxHold,
        };
      }
    }
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
  // A sidestep, a lunge and a riposte move by strikeMotion; a heal kneels.
  if (f.state === 'sidestep' || f.state === 'heal') return;
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
        : goal.run && !f.exhausted
          ? land.movement.run * (f.heavy ? ctx.cb.heavy.runSpeed : 1)
          : land.movement.walk * (goal.share ?? 1);
    speed = Math.min((base * tile) / TICKS_PER_SECOND, goal.away === true ? Infinity : d);
    if (f.state === 'idle') {
      // Circling or backing off faces the foe; otherwise the way walked (Book 10 stance).
      const face = goal.face;
      if (face !== undefined) setAngle(f, Math.atan2(face.y - a.y, face.x - a.x));
      else setAngle(f, Math.atan2(vy, vx));
      a.facing = f.facing;
    }
  }
  const before = { x: a.x, y: a.y };
  // Book 10 avoid: deep water, cliff edges and fire are kept off (unless already in them).
  const avoid = (x: number, y: number): boolean => fw.avoid?.(x, y) === true && !fw.avoid(a.x, a.y);
  const clear = (x: number, y: number): boolean =>
    footprintClear(map, land.rules, x, y, fw.tidalGroundOpen) &&
    !crowded(onFoot, id, a, x, y) &&
    !avoid(x, y);
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
          setAngle(f, Math.atan2(ty, tx));
          a.facing = f.facing;
        }
      }
    }
  }
  if (a.x !== before.x || a.y !== before.y) a.moving = true;
  if (a.carries !== undefined) carryAlong(onFoot, a);
  // Fled (or left) out of sight far enough: gone from the zone.
  if (fa.ai.mode === 'FLEE' || fa.ai.mode === 'LEAVE') {
    const p = onFoot.player;
    // Cornered within reach of the steerer, one who flees begs instead (Book 2 section 13).
    const cornered =
      !a.moving &&
      fa.ai.mode === 'FLEE' &&
      fa.f.hitstop === 0 &&
      fa.f.state === 'idle' &&
      Math.hypot(a.x - p.x, a.y - p.y) <= ctx.ai.habits.fledAt * tile &&
      world.tick - fa.f.since > ctx.ai.habits.decideEvery;
    if (cornered) {
      surrender(fw, id, a, fa);
      return;
    }
    if (
      Math.hypot(a.x - p.x, a.y - p.y) > ctx.ai.sight.day * tile ||
      (!a.moving && Math.hypot(a.x - p.x, a.y - p.y) > ctx.ai.habits.fledAt * tile)
    ) {
      const leaving = fa.ai.mode === 'LEAVE';
      // The scavengers at dusk: how each went (decision DE-15).
      if (
        encounterOf(ctx, onFoot.battle)?.dusk === true &&
        world.facts[`ch1.dusk.${id}`] === undefined
      )
        world.facts[`ch1.dusk.${id}`] = leaving ? 'LEFT' : 'FLED';
      Reflect.deleteProperty(onFoot.actors, id);
      const person = world.people[id];
      if (person !== undefined) person.status = 'missing';
      fw.emit(leaving ? { type: 'PERSON_LEFT', person: id } : { type: 'PERSON_FLED', person: id });
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
      } else surrender(fw, m, a, fa);
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
  // Book 10 remember: a group fought and left greets the steerer again as an enemy, unwarned.
  if (battle?.scene != null && battle.engaged && !battle.over && holding)
    world.facts[`enmity.${battle.scene}`] = world.calendar.day;
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

// ------------------------------------------------------------------ warnings and the dusk fight

/** A given line of someone's barks (combat.json), by its place in the list. */
function sayLine(ctx: FightContext, id: Id, kind: string, index: number, emit: FightEmit): void {
  const lines = ctx.def.barks[id]?.[kind];
  if (lines === undefined || lines.length === 0) return;
  const key = lines[Math.min(index, lines.length - 1)] ?? lines[0] ?? '';
  emit({ type: 'PERSON_SPOKE', person: id, lineKey: key, bark: kind });
}

/** Whether the steerer has a weapon or a bow in hand (Book 10 drawnWeapon). */
export function armed(world: WorldState, ctx: FightContext): boolean {
  const item = inHand(world);
  return item !== null && (weaponRow(ctx, item) !== null || item === 'ITEM_BOW');
}

/**
 * Warnings before a fight (Book 10 "Warnings", decision DE-11), each tick while they are given:
 * once a warner has seen the steerer, at warnAt the first, at warnAgain the second, at lastStep
 * the last, each at least warnGap apart; any nearer after the last (by a body's breadth), or
 * within the warner's reach, starts the fight; a weapon taken in hand within warnAt starts it
 * after one more warning. Beyond walkAway they go back to their work.
 */
function warnStep(fw: FightWorld, battle: Battle): void {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  const enc = encounterOf(ctx, battle);
  if (onFoot === null || enc?.warns !== true || battle.engaged || battle.over) return;
  if (remembers(world, ctx, enc.id)) return;
  const tick = world.tick;
  const tile = map.tile;
  const k = ctx.ai.warnings;
  const p = onFoot.player;
  const members = (battle.groups[enc.id]?.members ?? []).filter((m) => {
    const fa = onFoot.actors[m]?.fight;
    return fa !== undefined && fighting(fa) && fa.ai.mode !== 'LEAVE';
  });
  const alert = members.filter((m) => onFoot.actors[m]?.fight?.ai.awareness.state === 'ALERT');
  if (alert.length === 0) return;
  let d = Infinity;
  let nearest: Id | null = null;
  for (const m of members) {
    const a = onFoot.actors[m];
    if (a === undefined) continue;
    const dm = Math.hypot(a.x - p.x, a.y - p.y);
    if (dm < d) {
      d = dm;
      nearest = m;
    }
  }
  if (nearest === null) return;
  const by = members.find((m) => ctx.def.barks[m]?.['warn'] !== undefined) ?? members[0] ?? nearest;
  if (d > k.walkAway * tile) {
    // Walked away: back to what they were doing.
    if (battle.warn != null) {
      battle.warn = null;
      for (const m of members) {
        const a = onFoot.actors[m];
        const fa = a?.fight;
        if (a === undefined || fa === undefined) continue;
        setAwareness(fw, m, a, fa, ctx.ai.awareness.suspiciousAt - 1);
        backToWork(fw, a, fa);
      }
    }
    return;
  }
  const w = (battle.warn ??= { stage: 0, last: -1_000_000, armed: false, by });
  const gapOk = tick - w.last >= k.gapTicks;
  const give = (stage: number): void => {
    w.stage = stage;
    w.last = tick;
    w.at = d;
    sayLine(ctx, w.by, 'warn', Math.min(stage, 3) - 1, fw.emit);
    fw.emit({ type: 'WARNED', person: w.by, stage });
  };
  const near = onFoot.actors[nearest]?.fight;
  const theirReach = (reachOf(ctx, near?.f ?? null) + ctx.cb.bodyRadiusTiles) * tile;
  // Within their reach: no more words.
  if (w.stage > 0 && d <= theirReach) {
    startFight(fw);
    return;
  }
  // A weapon taken in hand within warnAt: one more warning, then the fight.
  if (armed(world, ctx) && d <= k.warnAt * tile) {
    if (!w.armed) {
      if (w.stage === 0 || gapOk) {
        w.armed = true;
        give(Math.min(3, w.stage + 1));
      }
      return;
    }
    if (gapOk) {
      startFight(fw);
      return;
    }
  }
  if (w.stage === 0 && d <= k.warnAt * tile) give(1);
  else if (w.stage === 1 && d <= k.again * tile && gapOk) give(2);
  else if (w.stage === 2 && d <= k.lastStep * tile && gapOk) give(3);
  else if (w.stage === 3 && d < (w.at ?? d) - ctx.cb.bodyRadiusTiles * tile) startFight(fw);
}

/** The scavengers at dusk's encounter (combat.json), if any. */
function duskEncounter(ctx: FightContext): CombatDef['encounters'][number] | undefined {
  return ctx.def.encounters.find((e) => e.dusk === true);
}

/** The minute dark comes today (Book 10 daylight by the season). */
function darkAt(world: WorldState, ctx: FightContext): number {
  return ctx.daylight[seasonOf(world.calendar.day)].darkFrom;
}

/**
 * Whether the scavengers at dusk are at the stern now (Book 10 "The scavengers at dusk", when):
 * from its time on its day until dark, if not yet settled.
 */
export function duskOpen(world: WorldState, ctx: FightContext): boolean {
  const k = ctx.ai.dusk;
  const m = world.calendar.minuteOfDay;
  return (
    world.facts['ch1.dusk'] === undefined &&
    world.calendar.day === k.day &&
    m >= k.fromMinute &&
    m < darkAt(world, ctx)
  );
}

/** Settles the scavengers at dusk: the outcome and each one's fate, as facts and an event. */
function resolveDusk(fw: FightWorld, outcome: 'FOOD' | 'DARK' | 'FOUGHT'): void {
  const { world, ctx } = fw;
  const enc = duskEncounter(ctx);
  if (enc === undefined || world.facts['ch1.dusk'] !== undefined) return;
  const fates: Record<Id, DuskFate> = {};
  for (const m of enc.members) {
    const key = `ch1.dusk.${m.person}`;
    const known = world.facts[key];
    const a = world.onFoot?.actors[m.person];
    const st = a?.fight?.f.state;
    const fate: DuskFate =
      world.people[m.person]?.status === 'dead'
        ? 'DEAD'
        : typeof known === 'string'
          ? (known as DuskFate)
          : st === 'surrendered'
            ? 'HELD'
            : st === 'downed'
              ? 'DOWNED'
              : outcome === 'FOUGHT'
                ? 'FLED'
                : 'LEFT';
    fates[m.person] = fate;
    world.facts[key] = fate;
  }
  world.facts['ch1.dusk'] = outcome;
  fw.emit({ type: 'DUSK_RESOLVED', outcome, fates });
}

/**
 * The scavengers at dusk each tick (decision DE-15): a fight over settles it; at dark, if no fight
 * is under way, they finish and walk off to the fold (and if they were never met, they went all
 * the same).
 */
function stepDusk(fw: FightWorld): void {
  const { world, ctx } = fw;
  const enc = duskEncounter(ctx);
  const onFoot = world.onFoot;
  if (enc === undefined || onFoot === null || world.facts['ch1.dusk'] !== undefined) return;
  const battle = onFoot.battle ?? null;
  const here = battle?.scene === enc.id ? battle : null;
  if (here?.over === true) {
    resolveDusk(fw, 'FOUGHT');
    return;
  }
  const k = ctx.ai.dusk;
  const day = world.calendar.day;
  const late = day > k.day || (day === k.day && world.calendar.minuteOfDay >= darkAt(world, ctx));
  if (!late || here?.engaged === true) return;
  // Dark: they finish and go to the fold (only the dusk's own band, where it is in view).
  if (here !== null)
    for (const m of enc.members) {
      const a = onFoot.actors[m.person];
      if (a?.fight?.group === enc.id && fighting(a.fight)) leaveAll(fw, a.fight);
    }
  for (const rest of Object.values(onFoot.elsewhere ?? {}))
    if (rest.battle?.scene === enc.id) {
      for (const m of enc.members) Reflect.deleteProperty(rest.actors, m.person);
      rest.battle = null;
    }
  resolveDusk(fw, 'DARK');
}

/**
 * The scavengers at dusk taken off the world when it is settled away from the strand (dark comes
 * with the steerer elsewhere): called each tick by the simulation; cheap when there is nothing to do.
 */
export function stepDuskAway(fw: FightWorld): void {
  const { world, ctx } = fw;
  const enc = duskEncounter(ctx);
  if (enc === undefined || world.facts['ch1.dusk'] !== undefined) return;
  if (world.onFoot?.zone === enc.zone) return;
  const k = ctx.ai.dusk;
  const day = world.calendar.day;
  const late = day > k.day || (day === k.day && world.calendar.minuteOfDay >= darkAt(world, ctx));
  if (!late) return;
  const rest = world.onFoot?.elsewhere?.[enc.zone];
  if (rest !== undefined) {
    if (rest.battle?.scene === enc.id && rest.battle.engaged) return;
    for (const m of enc.members) Reflect.deleteProperty(rest.actors, m.person);
    if (rest.battle?.scene === enc.id) rest.battle = null;
  }
  resolveDusk(fw, 'DARK');
}

/**
 * A bargain offered to warners (Book 10 foodBargain): the steerer within reach of one of a dusk
 * band giving warnings, and the camp's stores holding the food. They take it and go.
 */
export function duskBargainAt(
  world: WorldState,
  ctx: FightContext,
  tile: number,
  reachTiles: number,
): Id | null {
  const onFoot = world.onFoot;
  const battle = onFoot?.battle ?? null;
  const enc = encounterOf(ctx, battle);
  if (onFoot == null || battle === null || enc?.dusk !== true || battle.engaged || battle.over)
    return null;
  if ((battle.warn?.stage ?? 0) === 0) return null;
  const p = onFoot.player;
  let best: { id: Id; d: number } | null = null;
  for (const m of enc.members) {
    const a = onFoot.actors[m.person];
    if (a?.fight === undefined || !fighting(a.fight)) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d <= reachTiles * tile && (best === null || d < best.d)) best = { id: m.person, d };
  }
  return best?.id ?? null;
}

/** The camp's salt fish (RES_SALTED_FISH in the household's home stores). */
function saltFish(world: WorldState): { home: string; rd: number } | null {
  for (const [key, home] of Object.entries(world.homes).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const rd = home.stores['RES_SALTED_FISH'];
    if (rd !== undefined) return { home: key, rd };
  }
  return null;
}

/**
 * The bargain made: the food leaves the camp's stores and the band takes it and goes (they never
 * fight). Returns false, with nothing done, when the stores hold too little.
 */
export function duskBargain(fw: FightWorld, with_: Id): boolean {
  const { world, ctx } = fw;
  const onFoot = world.onFoot;
  const food = saltFish(world);
  const need = ctx.ai.dusk.foodRd;
  if (onFoot === null || food === null || food.rd < need) return false;
  const home = world.homes[food.home];
  if (home === undefined) return false;
  home.stores['RES_SALTED_FISH'] = food.rd - need;
  const enc = duskEncounter(ctx);
  const other = enc?.members.find((m) => m.person !== with_)?.person;
  if (other !== undefined) sayLine(ctx, other, 'bargain', 0, fw.emit);
  sayLine(ctx, with_, 'bargain', 0, fw.emit);
  const fa = onFoot.actors[with_]?.fight;
  if (fa !== undefined) leaveAll(fw, fa);
  resolveDusk(fw, 'FOOD');
  return true;
}

// ------------------------------------------------------------------------- missiles seen coming

/**
 * A missile loosed (Book 10 awareDodge, decision DE-10): each aware fighter in its path who sees
 * the shooter, and is free to (not attacking, blocking, staggered or drawing), sidesteps it with
 * Book 10's chance on the `combat` stream: a tell, then a dodge's move across its path; the missile
 * it reads passes it. The unaware never sidestep.
 */
export function seeMissile(
  fw: FightWorld,
  n: number,
  shooter: Id,
  from: { readonly x: number; readonly y: number },
  ux: number,
  uy: number,
  length: number,
): void {
  const { world, ctx } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  const box = fw.land.rules.missileHitBox;
  const shooterSide = sideOf(onFoot, shooter);
  for (const [id, a] of Object.entries(onFoot.actors).sort(ORDERLY)) {
    const fa = a.fight;
    if (fa === undefined || id === shooter || fa.side === shooterSide || !fighting(fa)) continue;
    if (fa.side === 'ENEMY' && fa.ai.awareness.state !== 'ALERT') continue;
    if (!free(fa.f) || a.aim != null || a.archer?.phase === 'drawing') continue;
    // In its path: along the track, and within the body's breadth of it.
    const rx = a.x - from.x;
    const ry = a.y - from.y;
    const along = rx * ux + ry * uy;
    if (along < 0 || along > length) continue;
    const across = rx * -uy + ry * ux;
    if (Math.abs(across) > box.w) continue;
    // Sees the shooter: the shooter within its sight cone.
    if (!inFrontAngle(fa.f.angle, from.x - a.x, from.y - a.y, ctx.ai.sight.coneDegrees)) continue;
    if (nextFloat(world.rng.combat) >= ctx.ai.self.awareDodge) continue;
    const side = across >= 0 ? 1 : -1;
    startSidestep(
      fa.f,
      world.tick,
      ctx.cb,
      ctx.ai.self.sidestepTell,
      { x: -uy * side, y: ux * side },
      n,
    );
    a.facing = fa.f.facing;
    fw.emit({ type: 'SIDESTEP', who: id, missile: n });
  }
}

/** Whether a person lets a missile pass: sidestepping it, past the tell (Book 10 sidestepMove). */
export function sidestepsMissile(f: Fighter | null | undefined, n: number, tick: number): boolean {
  return f?.state === 'sidestep' && f.target === `missile:${String(n)}` && tick >= f.activeAt;
}

// ----------------------------------------------------------------------------- the camp reached

/**
 * Book 10 "The scavengers at dusk" checkpoint and decision DE-12: the steerer reaching the camp
 * (a safe place, outside a fight) for the first time in a day, which calls for an autosave. True
 * on the tick it happens.
 */
export function campReached(world: WorldState, ctx: FightContext, tile: number): boolean {
  const onFoot = world.onFoot;
  if (onFoot === null || world.gameOver !== null) return false;
  const battle = onFoot.battle ?? null;
  if (battle !== null && battle.engaged && !battle.over) return false;
  const p = onFoot.player;
  if (!inSafePlace(ctx, onFoot.zone, p.x, p.y, tile)) return false;
  if (world.facts['camp.reachedDay'] === world.calendar.day) return false;
  world.facts['camp.reachedDay'] = world.calendar.day;
  takeRations(world, ctx);
  return true;
}

/**
 * Rations for the road (Book 10 healCarry; decision DE-45): at the camp the steerer takes
 * rations up to Book 10's number, each its ration-days from the camp's salt fish, while there is
 * fish to take.
 */
export function takeRations(world: WorldState, ctx: FightContext): number {
  const food = saltFish(world);
  if (food === null) return 0;
  const home = world.homes[food.home];
  if (home === undefined) return 0;
  const h = ctx.cb.heal;
  const inv = world.player.inventory;
  let taken = 0;
  while ((inv[RATION] ?? 0) < h.maxRations && (home.stores['RES_SALTED_FISH'] ?? 0) >= h.rationRd) {
    home.stores['RES_SALTED_FISH'] = (home.stores['RES_SALTED_FISH'] ?? 0) - h.rationRd;
    inv[RATION] = (inv[RATION] ?? 0) + 1;
    taken++;
  }
  return taken;
}

// -------------------------------------------------------------------------------- missiles

/**
 * A missile come to rest in a body or a shield (Book 10 "Fight rules", missileDamage; combat v2):
 * a body takes the weapon's damage after armour (missiles are thrusts), twice over if it was
 * unaware (Book 10 unawareMissile), and wears poise; a raised shield takes Guard's block cost and
 * the missile sticks in the board with a thunk (the BLOW event's shield). A blow from the
 * household on someone not yet fighting starts the fight.
 */
export function missileStruck(
  fw: FightWorld,
  e: {
    readonly kind: 'arrow' | 'spear';
    readonly shooter?: Id;
    readonly strike: string;
    readonly target?: Id;
    readonly x: number;
    readonly y: number;
  },
): void {
  const { world, ctx } = fw;
  const onFoot = world.onFoot;
  const target = e.target;
  if (onFoot === null || target === undefined) return;
  const cb = ctx.cb;
  const dmg = e.kind === 'arrow' ? cb.arrow : cb.thrownSpear;
  const by = e.shooter ?? STEERER;
  const from = whereIs(onFoot, by);
  const dx = e.x - (from?.x ?? e.x);
  const dy = e.y - (from?.y ?? e.y);
  const tf =
    target === STEERER ? (onFoot.player.fight ?? null) : (onFoot.actors[target]?.fight?.f ?? null);
  const fa = onFoot.actors[target]?.fight;
  if (e.strike === 'body') {
    if (fa?.dead != null || onFoot.actors[target]?.pose === 'dead') return;
    const unaware = awarenessOf(onFoot, target) === 'UNAWARE';
    const armour = tf?.armour ?? 'NONE';
    const mult = unaware ? ctx.ai.sneakAttacks.unawareMissile : 1;
    const damage = damageOf({ damage: dmg.damage * mult, type: 'THRUST' }, armour, cb);
    const healing = tf?.state === 'heal' ? (tf.heal?.kind ?? null) : null;
    const reaction =
      tf === null
        ? 'NONE'
        : poiseHit(tf, { poise: dmg.poiseDamage, kind: 'light' }, world.tick, cb);
    fw.emit({
      type: 'BLOW',
      attacker: by,
      defender: target,
      outcome: 'HIT',
      damage,
      heavy: false,
      x: e.x,
      y: e.y,
      dx,
      dy,
      material: armour === 'MAIL' ? 'MAIL' : 'FLESH',
      kind: 'missile',
      reaction,
      hitstop: 0,
      knockback: cb.hit.knockbackLight,
      shake:
        target === STEERER && damage >= cb.hit.shakeHeavy.steererDamage
          ? { px: cb.hit.shakeHeavy.px, ticks: cb.hit.shakeHeavy.ticks }
          : null,
      unaware,
    });
    if (healing !== null && tf?.state !== 'heal')
      fw.emit({ type: 'HEAL_INTERRUPTED', kind: healing });
    if (sideOf(onFoot, by) === 'HOUSEHOLD' && sideOf(onFoot, target) === 'ENEMY') {
      const battle = onFoot.battle ?? null;
      if (battle !== null && !battle.engaged && !battle.over) startFight(fw);
    }
    hurt(fw, target, damage, by, { heavyKill: false, weapon: null, dx, dy, missile: true });
    return;
  }
  if (e.strike === 'shield') {
    const pool = target === STEERER ? world.player.stamina : fa?.stamina;
    fw.emit({
      type: 'BLOW',
      attacker: by,
      defender: target,
      outcome: 'BLOCKED',
      damage: 0,
      heavy: false,
      x: e.x,
      y: e.y,
      dx,
      dy,
      material: 'SHIELD',
      kind: 'missile',
      reaction: 'NONE',
      hitstop: 0,
      knockback: 0,
      shake: null,
    });
    if (pool !== undefined) {
      pool.current = Math.max(
        0,
        pool.current - (cb.block.costFactor * dmg.vsShield + cb.block.costFlat),
      );
      pool.spentTick = world.tick;
      if (pool.current <= 0 && tf?.shield === true)
        enterTimed(tf, 'guardBroken', world.tick, cb.block.guardBreak);
    }
    if (fa?.side === 'ENEMY' && from !== null) {
      fa.ai.memory = { x: from.x, y: from.y, tick: world.tick, seen: true };
      const a = onFoot.actors[target];
      if (a !== undefined) setAwareness(fw, target, a, fa, ctx.ai.awareness.alertAt);
    }
  }
}

/** Kneeling, the weapons thrown down (Book 2 section 13): out of the fight, to be spared or not. */
function surrender(fw: FightWorld, id: Id, a: OnFootActor, fa: ActorFight): void {
  const onFoot = fw.world.onFoot;
  if (onFoot === null) return;
  fa.f.state = 'surrendered';
  fa.f.since = fw.world.tick;
  fa.ai.mode = 'SURRENDER';
  fa.ai.goal = null;
  delete a.archer;
  a.aim = null;
  setAngle(fa.f, Math.atan2(onFoot.player.y - a.y, onFoot.player.x - a.x));
  a.facing = fa.f.facing;
  fw.emit({ type: 'PERSON_SURRENDERED', person: id });
  say(fw.ctx, id, 'plead', fw.emit, fw.world.tick);
  friendFell(fw, id);
}

/** Whether a fighter is in a state now (read afresh, past the narrowing of earlier checks). */
function inState(f: Fighter | null, state: Fighter['state']): boolean {
  return f?.state === state;
}

/** Whether a fighter still has a shield (read afresh after a blow may have broken it). */
function shieldNow(f: Fighter | null): boolean {
  return f?.shield === true;
}
