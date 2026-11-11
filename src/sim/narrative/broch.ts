/**
 * Chapter 1 beat 2 (Book 4 section 08): Hild leads to the old broch. Gather driftwood, light a
 * fire, treat her injury. Warmth, food, a conversation. Then the first days: Hild, once her leg is
 * bound, fishes from the rocks below the path by day and sits by the fire in the evening.
 *
 * - A few seconds after she names the bow, Hild gets up and leads: over the shingle, up the cut and
 *   north across the machair to the broch, waiting whenever the steerer falls behind.
 * - At the broch she sits by the fire ring and says what is needed; the beat completes once the
 *   fire is lit and her leg is tended.
 */
import type { OpeningDef } from '../../content/registry.ts';
import { TILE } from '../../content/terrain/autotile.ts';
import type { Id } from '../../core/ids.ts';
import { fireOneShot, setFact } from '../ledger/ledger.ts';
import type { CampContext } from '../home/camp.ts';
import {
  FACT_AT_BROCH,
  FACT_FIRE_LIT,
  FACT_HILD_TENDED,
  homeOf,
  residentWorking,
} from '../home/camp.ts';
import type { LandContext } from '../land/onFoot.ts';
import { TICKS_PER_SECOND } from '../land/onFoot.ts';
import { findActor, translate } from '../land/zoneLinks.ts';
import { stepResident } from '../people/residents.ts';
import type { ResidentPlace } from '../people/residents.ts';
import type { WorldState } from '../world.ts';
import { FACT_BOW_NAMED, FACT_HILD_SAFE, FACT_HILD_SAFE_AT } from './opening.ts';
import type { OpeningEvent } from './opening.ts';

export const FACT_LEAD_STARTED = 'ch1.lead_started';
const FACT_LEAD_WAITED = 'ch1.lead_waited';
const FACT_ARRIVED_SAID = 'ch1.arrived_said';
const FACT_FISHING_SAID = 'ch1.fishing_said';
const FACT_EVENING_SAID = 'ch1.evening_said';

/** Where a resident wants to be now (v0 of Stage 8's schedules). */
export function residentPlace(world: WorldState, ctx: CampContext, id: Id): ResidentPlace | null {
  const plan = ctx.def.people[id];
  if (plan === undefined) return null;
  const zone = ctx.def.zone;
  const stage = homeOf(world, ctx)?.stage === 'S1' ? 'S1' : 'S0';
  const asleep = world.onFoot?.player.sleep != null || !world.player.awake;
  if (world.facts[FACT_AT_BROCH] === true && asleep) {
    const s = plan.sleep[stage];
    return { zone, x: s.x * TILE, y: s.y * TILE, facing: s.facing, pose: 'sleep' };
  }
  if (world.facts[FACT_AT_BROCH] === true && residentWorking(world, ctx, id))
    return {
      zone: plan.work.zone,
      x: plan.work.x * TILE,
      y: plan.work.y * TILE,
      facing: plan.work.facing,
      pose: 'work',
      task: plan.work.task,
    };
  return {
    zone,
    x: plan.camp.x * TILE,
    y: plan.camp.y * TILE,
    facing: plan.camp.facing,
    pose: 'sit',
  };
}

/**
 * One tick of beat 2 and of the residents at home. `say` speaks a line in the resident's voice.
 */
export function stepBroch(
  world: WorldState,
  ctx: CampContext,
  opening: OpeningDef,
  land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  tidalGroundOpen: boolean,
  emit: (event: OpeningEvent) => void,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null || world.facts[FACT_HILD_SAFE] !== true) return;
  const id = opening.caller;
  const say = (lineKey: string | undefined): void => {
    if (lineKey !== undefined) emit({ type: 'PERSON_SPOKE', person: id, lineKey });
  };
  // The lead begins a few seconds after she names the bow.
  if (world.facts[FACT_LEAD_STARTED] !== true) {
    const at = world.facts[FACT_HILD_SAFE_AT];
    const since = typeof at === 'number' ? world.tick - at : 0;
    const due = (opening.bowLineSeconds + ctx.def.leadAfterSeconds) * TICKS_PER_SECOND;
    if (world.facts[FACT_BOW_NAMED] !== true || since < due) return;
    setFact(world, FACT_LEAD_STARTED, true);
    say(ctx.def.lines['lead']);
  }
  const place = residentPlace(world, ctx, id);
  const found = findActor(onFoot, id);
  if (place === null || found === null) return;
  const plan = ctx.def.people[id];
  const p = onFoot.player;
  const tile = land.maps.get(found.zone)?.tile ?? 24;
  // Leading: she waits whenever the steerer, in view, is far behind her (further from the broch).
  const leading = world.facts[FACT_AT_BROCH] !== true;
  const here = land.maps.get(found.zone);
  const there = land.maps.get(place.zone);
  const goal =
    here === undefined || there === undefined ? place : translate(there, here, place.x, place.y);
  const far =
    found.visible &&
    Math.hypot(found.actor.x - p.x, found.actor.y - p.y) > (plan?.leadWaitTiles ?? 7) * tile &&
    Math.hypot(goal.x - p.x, goal.y - p.y) >
      Math.hypot(goal.x - found.actor.x, goal.y - found.actor.y);
  const hold = leading && far;
  if (hold && world.facts[FACT_LEAD_WAITED] !== true) {
    setFact(world, FACT_LEAD_WAITED, true);
    say(ctx.def.lines['wait']);
  }
  const wasWorking = found.actor.pose === 'work';
  stepResident(onFoot, id, place, land.maps, land, tidalGroundOpen, hold);
  const now = findActor(onFoot, id);
  if (now === null) return;
  // Arrived: she sits by the fire ring, and says what is needed once the steerer is there.
  if (
    leading &&
    now.zone === place.zone &&
    Math.hypot(now.actor.x - place.x, now.actor.y - place.y) < 1
  )
    setFact(world, FACT_AT_BROCH, true);
  if (
    world.facts[FACT_AT_BROCH] === true &&
    world.facts[FACT_ARRIVED_SAID] !== true &&
    now.visible &&
    Math.hypot(now.actor.x - p.x, now.actor.y - p.y) < 6 * tile
  ) {
    setFact(world, FACT_ARRIVED_SAID, true);
    say(ctx.def.lines['arrived']);
  }
  // The first time she goes off to fish, in the steerer's hearing.
  if (
    place.pose === 'work' &&
    !wasWorking &&
    now.visible &&
    world.facts[FACT_FISHING_SAID] !== true
  ) {
    setFact(world, FACT_FISHING_SAID, true);
    say(ctx.def.lines['fishing']);
  }
  // The first evening at the camp: she offers to keep the fire in.
  if (
    world.facts[FACT_EVENING_SAID] !== true &&
    world.facts[FACT_FIRE_LIT] === true &&
    now.visible &&
    place.pose === 'sit' &&
    world.calendar.minuteOfDay >= ctx.time.sleepAfter &&
    Math.hypot(now.actor.x - p.x, now.actor.y - p.y) < 4 * tile
  ) {
    setFact(world, FACT_EVENING_SAID, true);
    say(ctx.def.lines['evening']);
  }
  // The beat is done once the fire is lit and her leg is tended.
  if (world.facts[FACT_FIRE_LIT] === true && world.facts[FACT_HILD_TENDED] === true)
    fireOneShot(world, ctx.def.beat, () => {
      emit({ type: 'BEAT_COMPLETED', beat: ctx.def.beat });
    });
}
