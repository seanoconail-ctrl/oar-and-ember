/**
 * An archer's turn (Book 10 section 21, npcArcher; design addendum 2.5, Book 10 "Archers"): stop,
 * settle, draw for the weapon's draw time, loose, recover, then move; never move with a drawn bow.
 * Any on-foot person can be given this order: crew and enemies use it from Stage 9. Movement
 * itself obeys the same rule as the steerer's (feetPlanted): while an aim is held, and while it
 * settles and recovers, the walk is ignored, so an archer stands completely still to shoot.
 */
import type { Aim, ArcherTiming, MissileKind, MoveIntent, OnFootActor } from './onFoot.ts';

const STAND: MoveIntent = { x: 0, y: 0, run: false, sneak: false };

/** Orders an archer to shoot at `target` (world pixels) and then walk `then`. */
export function orderShot(
  actor: OnFootActor,
  target: { readonly x: number; readonly y: number },
  then: MoveIntent,
  kind: MissileKind = 'arrow',
  timing?: ArcherTiming,
): void {
  actor.archer = {
    phase: 'stopping',
    target: { ...target },
    then: { ...then },
    ...(kind === 'arrow' ? {} : { kind }),
    ...(timing === undefined ? {} : { timing }),
  };
}

/**
 * One tick of an archer's order, before the actor's walk is stepped: first stop (the walk is set
 * to standing), then settle for the order's settle ticks, then hold the draw for its draw ticks
 * (`drawTicks` without a timing), then loose (the caller makes the missile), then recover, standing,
 * for its recovery, and set off on `then`.
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
  const timing = order.timing;
  if (order.phase === 'stopping') {
    actor.intent = { ...STAND };
    if (actor.moving === true) return;
    order.phase = 'settling';
    order.since = tick;
  }
  if (order.phase === 'settling') {
    actor.intent = { ...STAND };
    if (tick - (order.since ?? tick) < (timing?.settle ?? 0)) return;
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
    if (tick - aim.since < (timing?.draw ?? drawTicks)) return;
    loose(aim);
    actor.aim = null;
    order.phase = 'recovering';
    order.since = tick;
    return;
  }
  if (order.phase === 'recovering') {
    actor.intent = { ...STAND };
    if (tick - (order.since ?? tick) < (timing?.recover ?? 0)) return;
    order.phase = 'moving';
    actor.intent = { ...order.then };
  }
}
