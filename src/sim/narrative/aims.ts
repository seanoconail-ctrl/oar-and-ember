/**
 * Organic guidance (Book 2 section 16, "Aims, hints and the journal"; Book 8 section 13; Book 10
 * section 25, "Guidance"; decisions DE-23 and DE-24). Aims come from people, not markers:
 *
 * - **The current aim** is the first of Chapter 1's aims (content/opening.json `aims`) whose
 *   conditions to open hold and whose conditions to be done do not. The journal always shows it,
 *   as one plain sentence.
 * - **Progress** is a step towards it (its object picked up, carried nearer or worked, or one of
 *   its places reached); walking about alone is not progress. Each step counts once, and restarts
 *   the stuck clock.
 * - **Stuck help** escalates gently: with no progress for Book 10's stuckFirst, a person in earshot
 *   speaks the aim's first hint; after stuckSecond more, the clearer one; then again every
 *   stuckRepeat, at most stuckRepeat's times. With no one near, a hint whose speaker can call comes
 *   as a distant call with its direction (heard callCarry tiles); otherwise it waits. Never in a
 *   fight, a scene, a talk or with a hostile suspicious; a menu stops the clock with the game.
 * - A hint whose speaker is not yet in the household (Runa's, Bran's) is spoken by Hild in her own
 *   words (Book 8 section 13).
 *
 * Pure and deterministic: no random stream is drawn here; the state is `world.aims` (AimState).
 */
import type { AimCondition } from '../../content/aimSchema.ts';
import type { OpeningBalance } from '../../content/openingBalance.ts';
import { parseOpeningBalance } from '../../content/openingBalance.ts';
import { parsePeopleBalance } from '../../content/peopleBalance.ts';
import type { Content, OpeningDef } from '../../content/registry.ts';
import type { Id } from '../../core/ids.ts';
import { compass, TICKS_PER_SECOND } from '../land/onFoot.ts';
import { findActor } from '../land/zoneLinks.ts';
import type { ZoneMap } from '../land/zoneMap.ts';
import type { AimState, WorldState } from '../world.ts';
import { fightNear, wreckPhase } from './wreck.ts';

export type AimDef = OpeningDef['aims'][number];
type Hint = AimDef['hints'][number];

export interface AimsContext {
  readonly aims: readonly AimDef[];
  readonly ob: OpeningBalance;
  /** Book 10 section 08 barkEarshot (tiles). */
  readonly earshotTiles: number;
  /** Hild, who calls from the net before she is one of the household. */
  readonly caller: Id;
}

export function aimsContext(content: Pick<Content, 'opening' | 'balance'>): AimsContext | null {
  const def = content.opening;
  if (def === null) return null;
  return {
    aims: def.aims,
    ob: parseOpeningBalance(content.balance),
    earshotTiles: parsePeopleBalance(content.balance).talk.earshotTiles,
    caller: def.caller,
  };
}

export type AimEvent =
  | {
      readonly type: 'AIM_CHANGED';
      readonly aim: string | null;
      readonly journalKey: string | null;
    }
  | { readonly type: 'AIM_PROGRESS'; readonly aim: string; readonly step: string }
  | {
      readonly type: 'AIM_HINT';
      readonly aim: string;
      /** 0 the first hint, 1 the clearer one (and its repeats). */
      readonly hint: number;
      readonly person: Id;
      readonly lineKey: string;
      readonly called: boolean;
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
    };

export type AimEmit = (e: AimEvent) => void;

/** The aims' state (a world from before version 11 gains it here). */
export function aimState(world: WorldState): AimState {
  world.aims ??= { current: null, since: world.tick, hintsGiven: 0, reached: [] };
  return world.aims;
}

const truthy = (v: unknown): boolean => v !== undefined && v !== false && v !== null && v !== '';

/** Whether a condition holds now (progress-only conditions read where the steerer is). */
export function holds(
  world: WorldState,
  c: AimCondition,
  maps?: ReadonlyMap<Id, ZoneMap>,
): boolean {
  const onFoot = world.onFoot;
  if ('fact' in c) {
    const v = world.facts[c.fact];
    return c.is === undefined ? truthy(v) : v === c.is;
  }
  if ('not' in c) return !holds(world, c.not, maps);
  if ('any' in c) return c.any.some((x) => holds(world, x, maps));
  if ('has' in c)
    return world.player.hotbar.slots.includes(c.has) || (world.player.inventory[c.has] ?? 0) > 0;
  if ('home' in c)
    return Object.values(world.homes).some((h) => h.placed?.includes(c.home) === true);
  if ('after' in c)
    return (
      world.calendar.day > c.after.day ||
      (world.calendar.day === c.after.day && world.calendar.minuteOfDay >= c.after.minute)
    );
  if ('repair' in c) return world.ships['flagship']?.repairs[c.repair].stage === 'DONE';
  if ('gateStarted' in c) {
    const s = world.gates[c.gateStarted]?.status;
    return s === 'STARTED' || s === 'PASSED';
  }
  if ('resident' in c) return world.household.residents.includes(c.resident);
  if ('near' in c) {
    if (onFoot?.zone !== c.near.zone) return false;
    if (c.carrying !== undefined && onFoot.carrying !== c.carrying) return false;
    const tile = maps?.get(onFoot.zone)?.tile ?? 24;
    return (
      Math.hypot(onFoot.player.x / tile - c.near.x, onFoot.player.y / tile - c.near.y) <= c.near.r
    );
  }
  if ('carrying' in c) return onFoot?.carrying === c.carrying;
  if ('zone' in c) return onFoot?.zone === c.zone;
  if ('working' in c) return onFoot?.player.work?.task === c.working;
  if ('talking' in c) return world.talk?.with === c.talking;
  return false;
}

/** The current aim: the first open and not yet done. */
export function currentAim(world: WorldState, ctx: AimsContext): AimDef | null {
  if (world.facts['ch1.phase'] === undefined) return null;
  for (const aim of ctx.aims) {
    if (!aim.opensWhen.every((c) => holds(world, c))) continue;
    if (aim.doneWhen.every((c) => holds(world, c))) continue;
    return aim;
  }
  return null;
}

/** The journal's line for the current aim (Book 8 section 13), or null with none. */
export function journalLine(world: WorldState, ctx: AimsContext): string | null {
  const id = aimState(world).current;
  return ctx.aims.find((a) => a.id === id)?.journalKey ?? null;
}

/** When the next hint is due, in ticks after the last progress (null: no more). */
export function nextHintAfter(ob: OpeningBalance, given: number): number | null {
  const g = ob.guidance;
  const T = TICKS_PER_SECOND;
  if (given === 0) return g.stuckFirstSeconds * T;
  if (given === 1) return (g.stuckFirstSeconds + g.stuckSecondSeconds) * T;
  const repeats = given - 1;
  if (repeats > g.stuckRepeatTimes) return null;
  return (g.stuckFirstSeconds + g.stuckSecondSeconds + repeats * g.stuckRepeatSeconds) * T;
}

/** Progress steps of an aim now: each condition's key, and each store's level. */
function stepsNow(world: WorldState, aim: AimDef, maps?: ReadonlyMap<Id, ZoneMap>): string[] {
  const out: string[] = [];
  const all = [...aim.progress, ...aim.doneWhen];
  all.forEach((c, i) => {
    if ('store' in c) {
      const amount = Object.values(world.homes).reduce((s, h) => s + (h.stores[c.store] ?? 0), 0);
      out.push(`${i}:${amount}`);
      return;
    }
    if (holds(world, c, maps)) out.push(String(i));
  });
  return out;
}

/** Whether the steerer can be given a hint now (Book 10 section 25, quiet). */
export function hintQuiet(world: WorldState): boolean {
  const onFoot = world.onFoot;
  if (onFoot === null || wreckPhase(world) !== 'PLAY') return true;
  if (world.talk !== null || !world.player.awake || onFoot.player.sleep != null) return true;
  if (world.gameOver !== null) return true;
  return fightNear(world);
}

/** One tick of guidance: the aim, its progress, and a hint when one is due. */
export function stepAims(
  world: WorldState,
  ctx: AimsContext,
  maps: ReadonlyMap<Id, ZoneMap>,
  emit: AimEmit,
): void {
  const state = aimState(world);
  const aim = currentAim(world, ctx);
  const id = aim?.id ?? null;
  if (id !== state.current) {
    state.current = id;
    state.since = world.tick;
    state.hintsGiven = 0;
    state.reached = aim === null ? [] : stepsNow(world, aim, maps);
    emit({ type: 'AIM_CHANGED', aim: id, journalKey: aim?.journalKey ?? null });
    if (aim?.givenBy?.call === true) giveBy(world, ctx, aim, maps, emit);
    return;
  }
  if (aim === null) return;
  // Progress: a step not taken before, or a store grown past its level.
  for (const step of stepsNow(world, aim, maps)) {
    if (step.includes(':')) {
      const [k, v] = step.split(':');
      const was = state.reached.find((r) => r.startsWith(`${k}:`));
      const before = was === undefined ? -Infinity : Number(was.split(':')[1]);
      if (Number(v) > before) {
        state.reached = [...state.reached.filter((r) => r !== was), step];
        if (was !== undefined) progress(world, state, aim, step, emit);
      }
      continue;
    }
    if (state.reached.includes(step)) continue;
    state.reached.push(step);
    progress(world, state, aim, step, emit);
  }
  // A hint, when one is due and the moment is quiet.
  const due = nextHintAfter(ctx.ob, state.hintsGiven);
  if (due === null || world.tick - state.since < due || hintQuiet(world)) return;
  const n = Math.min(state.hintsGiven, 1);
  const hint = aim.hints[n];
  if (hint === undefined) return;
  if (deliver(world, ctx, aim, n, hint, maps, emit)) state.hintsGiven++;
}

function progress(
  world: WorldState,
  state: AimState,
  aim: AimDef,
  step: string,
  emit: AimEmit,
): void {
  state.since = world.tick;
  emit({ type: 'AIM_PROGRESS', aim: aim.id, step });
}

/** The aim's own words, as a call (the fire's "Wood!" from the strand). */
function giveBy(
  world: WorldState,
  ctx: AimsContext,
  aim: AimDef,
  maps: ReadonlyMap<Id, ZoneMap>,
  emit: AimEmit,
): void {
  const g = aim.givenBy;
  if (g === undefined) return;
  deliver(
    world,
    ctx,
    aim,
    -1,
    { speaker: g.speaker, textKey: g.textKey, canCall: true },
    maps,
    emit,
  );
}

/**
 * Says a hint: from its speaker in earshot, or as their distant call, or (a speaker not yet in the
 * household) in Hild's own words. Returns false when no one can say it now (it waits).
 */
function deliver(
  world: WorldState,
  ctx: AimsContext,
  aim: AimDef,
  n: number,
  hint: Hint | { speaker: Id; textKey: string; canCall: boolean },
  maps: ReadonlyMap<Id, ZoneMap>,
  emit: AimEmit,
): boolean {
  const onFoot = world.onFoot;
  if (onFoot === null) return false;
  // Someone found lying hurt and waiting to be carried speaks for themselves (Oddi; DE-85).
  const lying = (id: Id): boolean => {
    const pose = findActor(onFoot, id)?.actor.pose;
    return world.people[id] !== undefined && (pose === 'down' || pose === 'call');
  };
  const speaks = (id: Id): boolean =>
    world.household.residents.includes(id) || id === ctx.caller || lying(id);
  const alt = 'alt' in hint ? hint.alt : undefined;
  const line = !speaks(hint.speaker) && alt !== undefined ? alt : hint;
  if (!speaks(line.speaker)) return false;
  const who = findActor(onFoot, line.speaker);
  if (who === null || who.actor.pose === 'carried' || who.actor.pose === 'dead') return false;
  const p = onFoot.player;
  const map = maps.get(onFoot.zone);
  const tile = map?.tile ?? 24;
  const tellHint = (called: boolean): void => {
    if (n >= 0)
      emit({
        type: 'AIM_HINT',
        aim: aim.id,
        hint: n,
        person: line.speaker,
        lineKey: line.textKey,
        called,
      });
  };
  if (who.visible) {
    const d = Math.hypot(who.actor.x - p.x, who.actor.y - p.y) / tile;
    if (d <= ctx.earshotTiles) {
      emit({ type: 'PERSON_SPOKE', person: line.speaker, lineKey: line.textKey });
      tellHint(false);
      return true;
    }
    if (line.canCall && d <= ctx.ob.guidance.callCarryTiles) {
      emit({
        type: 'PERSON_CALLED',
        person: line.speaker,
        lineKey: line.textKey,
        direction: compass(p, who.actor),
        distanceTiles: Math.round(d),
      });
      tellHint(true);
      return true;
    }
    return false;
  }
  // In the next zone: a call carries over the edge between, from that side.
  const link = map?.links?.find((l) => l.to === who.zone);
  if (!line.canCall || link === undefined) return false;
  emit({
    type: 'PERSON_CALLED',
    person: line.speaker,
    lineKey: line.textKey,
    direction: link.edge,
    distanceTiles: ctx.ob.guidance.callCarryTiles,
  });
  tellHint(true);
  return true;
}
