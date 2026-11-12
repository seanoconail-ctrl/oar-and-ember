/**
 * The health and stamina bars' fade (Book 10 "Bars", decision DE-8; presentation only): in a
 * fight, or not full, a bar shows; outside a fight a full bar fades out Book 10's time after it
 * last changed, over its fade. The thin bar over an enemy shows while it is locked on, and for
 * Book 10's time after it was last hit.
 */
export interface BarsBalance {
  readonly fadeAfterTicks: number;
  readonly fadeTicks: number;
  readonly enemyBarTicks: number;
}

/** A bar's opacity, 0 to 1. `sinceChange` is the ticks since it (or the other bar) last changed. */
export function barAlpha(
  bar: { readonly full: boolean; readonly inFight: boolean; readonly sinceChange: number },
  k: BarsBalance,
): number {
  if (!bar.full || bar.inFight) return 1;
  const t = bar.sinceChange - k.fadeAfterTicks;
  if (t <= 0) return 1;
  return Math.max(0, 1 - t / Math.max(1, k.fadeTicks));
}

/** Whether the thin bar over an enemy shows: locked on, or hit within Book 10's time. */
export function enemyBarShown(
  e: { readonly locked: boolean; readonly lastHit: number | null },
  tick: number,
  k: BarsBalance,
): boolean {
  return e.locked || (e.lastHit !== null && tick - e.lastHit < k.enemyBarTicks);
}
