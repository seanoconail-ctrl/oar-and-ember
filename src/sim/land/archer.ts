/**
 * An archer's turn (Book 10 section 21, npcArcher): stop, draw for the weapon's draw time, loose,
 * then move; never move with a drawn bow. Any on-foot person can be given this order: crew and
 * enemies use it from Stage 9. Movement itself obeys the same rule as the steerer's (feetPlanted):
 * while an aim is held the walk is ignored, so an archer cannot be hurried off a drawn shot.
 */
import type { Aim, MoveIntent, OnFootActor } from './onFoot.ts';

const STAND: MoveIntent = { x: 0, y: 0, run: false, sneak: false };

/** Orders an archer to shoot at `target` (world pixels) and then walk `then`. */
export function orderShot(
  actor: OnFootActor,
  target: { readonly x: number; readonly y: number },
  then: MoveIntent,
): void {
  actor.archer = { phase: 'stopping', target: { ...target }, then: { ...then } };
}

/**
 * One tick of an archer's order, before the actor's walk is stepped: first stop (the walk is set
 * to standing; the draw starts on the first tick the actor is no longer moving), then hold the
 * draw for `drawTicks`, then loose (the caller makes the missile) and set off on `then`.
 */
export function stepArcher(
  actor: OnFootActor,
  tick: number,
  drawTicks: number,
  tile: number,
  loose: (aim: Aim) => void,
): void {
  const order = actor.archer;
  if (order === undefined) return;
  if (order.phase === 'stopping') {
    actor.intent = { ...STAND };
    if (actor.moving === true) return;
    const dx = order.target.x - actor.x;
    const dy = order.target.y - actor.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) {
      order.phase = 'moving';
      actor.intent = { ...order.then };
      return;
    }
    actor.aim = { x: dx / d, y: dy / d, since: tick, dist: d / tile };
    order.phase = 'drawing';
    return;
  }
  if (order.phase === 'drawing') {
    const aim = actor.aim;
    if (aim == null) {
      // The draw was let go some other way: the order ends without a shot.
      order.phase = 'moving';
      actor.intent = { ...order.then };
      return;
    }
    if (tick - aim.since < drawTicks) return;
    loose(aim);
    actor.aim = null;
    order.phase = 'moving';
    actor.intent = { ...order.then };
  }
}
