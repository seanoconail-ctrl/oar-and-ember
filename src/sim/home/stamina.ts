/**
 * Stamina and condition (Book 1 section 18; Book 2 section 24; Book 10 section 06).
 *
 * - The bar's maximum is its base minus every reduction, never below Book 10's minimumMax, and
 *   `current` never rises above it. Each reduction names its reason (and its cause), and the view
 *   lists them most serious first with the plain word Book 8 section 10 gives each.
 * - Reductions come from real state and are recomputed when their cause changes, once a game
 *   minute at most (`conditionMinute`), never every tick.
 * - Traversal drains spend `current` every tick they last (`traversalTick`): sprinting, heavy
 *   carrying and waist-deep wading. Walking, ordinary carrying and water up to the knee never
 *   drain it. Regeneration waits Book 10's ticks after the last spend, is halved standing waist
 *   deep, and pauses while any drain applies; exhausted, it waits Book 10's longer pause and runs
 *   at its slower rate (design addendum 2.5, "Exhausted"). Running empty exhausts the runner (the
 *   simulation's fighter keeps the flag, decision DF-3), sets a carried load down and halves a
 *   waist-deep wade until Book 10's heavyCarryEmpty stamina is regained.
 * - Homestead tasks cost only their small stamina, which never empties the bar on its own.
 */
import type { StaminaBalance } from '../../content/homeBalance.ts';
import type { Stamina, StaminaReason, StaminaReduction, WorldState } from '../world.ts';

/** Book 8 section 10: the plain word for each reason, most serious first. */
export const REASON_ORDER: readonly StaminaReason[] = [
  'STARVING',
  'BADLY_WOUNDED',
  'EXHAUSTED',
  'SICK',
  'COLD',
  'HUNGRY',
  'WOUNDED',
  'TIRED',
  'HARD_WORK',
  'FEAST',
];

export interface StaminaView {
  readonly current: number;
  readonly max: number;
  readonly base: number;
  readonly reasons: readonly {
    readonly reason: StaminaReason;
    readonly amount: number;
    readonly labelKey: string;
  }[];
}

/** The interface's view of the bar (Book 2 section 24). */
export function staminaView(st: Stamina): StaminaView {
  const reasons = [...st.reductions]
    .sort((a, b) => REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason))
    .map((r) => ({
      reason: r.reason,
      amount: r.amount,
      labelKey: `ui.stamina.reason.${r.reason.toLowerCase()}`,
    }));
  return { current: st.current, max: st.max, base: st.base, reasons };
}

/** Recomputes the maximum from the reductions and keeps `current` within it. */
export function updateMax(st: Stamina, sb: StaminaBalance): void {
  const lost = st.reductions.reduce((sum, r) => sum + r.amount, 0);
  st.max = Math.max(sb.minimumMax, st.base - lost);
  st.current = Math.min(st.current, st.max);
}

export function hasReason(st: Stamina, reason: StaminaReason): boolean {
  return st.reductions.some((r) => r.reason === reason);
}

/** Sets a reason at its Book 10 amount (replacing one of the same reason). */
export function setReason(
  st: Stamina,
  sb: StaminaBalance,
  reason: StaminaReason,
  since: number,
  cause?: string,
): void {
  const amount = reason === 'FEAST' ? -sb.capacity.FEAST : sb.capacity[reason];
  const existing = st.reductions.find((r) => r.reason === reason);
  if (existing?.amount === amount && existing.cause === cause) return;
  const next: StaminaReduction =
    cause === undefined ? { reason, amount, since } : { reason, amount, since, cause };
  st.reductions = [...st.reductions.filter((r) => r.reason !== reason), next];
  updateMax(st, sb);
}

/** Lifts these reasons; returns those that were lifted. */
export function clearReasons(
  st: Stamina,
  sb: StaminaBalance,
  reasons: readonly StaminaReason[],
): StaminaReason[] {
  const lifted = st.reductions.filter((r) => reasons.includes(r.reason)).map((r) => r.reason);
  if (lifted.length === 0) return [];
  st.reductions = st.reductions.filter((r) => !reasons.includes(r.reason));
  updateMax(st, sb);
  return lifted;
}

/** Spends stamina on a task: only its small cost, and never to empty on its own. */
export function spendOnTask(st: Stamina, cost: number, tick: number): void {
  if (cost <= 0) return;
  st.current = Math.max(Math.min(st.current, 1), st.current - cost);
  st.spentTick = tick;
}

/** What drains this tick, and where the steerer stands (Book 10 section 06). */
export interface TraversalNow {
  readonly running: boolean;
  readonly carrying: boolean;
  /** Moving in waist-deep (or deeper) water. */
  readonly wadingWaist: boolean;
  /** Standing or moving in waist-deep water (regeneration is halved there). */
  readonly inWaist: boolean;
  /** Stage 9: a hostile is aware of the steerer (running drains Book 10's in-combat rate). */
  readonly inCombat?: boolean;
  /** Stage 9: a shield held up (regeneration is halved, Book 10 section 06 stamina row). */
  readonly blocking?: boolean;
  /**
   * Design addendum 2.5: exhausted (Book 10 "Exhausted"): regeneration waits this long after the
   * bar reached 0, at this rate a second.
   */
  readonly exhausted?: { readonly delay: number; readonly rate: number };
}

/** Which traversals ran the bar empty and wait for Book 10's recoverAt. */
export interface Winded {
  run?: boolean;
  carry?: boolean;
  wade?: boolean;
}

/** One tick of traversal drains and regeneration. Returns what ran empty this tick. */
export function traversalTick(
  st: Stamina,
  sb: StaminaBalance,
  now: TraversalNow,
  tick: number,
  winded: Winded,
): Winded {
  let drain = 0;
  if (now.running) drain += now.inCombat === true ? sb.drain.runCombat : sb.drain.run;
  if (now.carrying) drain += sb.drain.heavyCarry;
  if (now.wadingWaist) drain += sb.drain.waistWade;
  const emptied: Winded = {};
  if (drain > 0) {
    st.current = Math.max(0, st.current - drain / 60);
    st.spentTick = tick;
    if (st.current <= 0) {
      if (now.running) emptied.run = true;
      if (now.carrying) emptied.carry = true;
      if (now.wadingWaist) emptied.wade = true;
    }
  } else if (
    tick - st.spentTick >= (now.exhausted?.delay ?? sb.regenDelayTicks) &&
    st.current < st.max
  ) {
    const base = now.exhausted?.rate ?? sb.regenPerSecond;
    const rate = base * (now.inWaist || now.blocking === true ? 0.5 : 1);
    st.current = Math.min(st.max, st.current + rate / 60);
  }
  if (st.current >= sb.recoverAt) {
    delete winded.run;
    delete winded.carry;
    delete winded.wade;
  }
  if (emptied.carry === true) winded.carry = true;
  if (emptied.wade === true) winded.wade = true;
  return emptied;
}

/** Whether the steerer has eaten a meal since waking. */
export function ateSinceWaking(world: WorldState): boolean {
  const c = world.player.condition;
  return c.lastMealAt !== null && c.lastMealAt >= c.wokeAt;
}
