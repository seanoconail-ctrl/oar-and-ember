/**
 * Schedules (Book 2 section 06; Book 5 section 01): every resident follows the household's day
 * (wake, eat, work shift, meal, evening, sleep), adjusted by their job, the season's light, their
 * wounds, their tendency, the warning flow and events, so they are always visibly doing something.
 * What they are doing is an `Activity` with a reason (a reason code the interface words) and the
 * place and pose it is done in.
 *
 * - Asleep while the steerer sleeps, and through the SLEEP block, in their bed or by the fire.
 * - A grave wound keeps them in bed (Book 10 section 08: bed-bound).
 * - A meal is eaten at the fire when there is one: the dawn ration (served only to those who woke
 *   at home) and supper while the stores hold food.
 * - The tendency at its hour and place (Book 5 section 17): Hild walks the shore at dusk.
 * - Work: their job at its spot, at half pace with a serious wound; an outdoor job waits for light;
 *   a job they refuse (the warning flow), or rest when told, keeps them by the fire.
 * - The evening by the fire.
 */
import type { JobDef, Spot } from '../../content/registry.ts';
import type { Id } from '../../core/ids.ts';
import { TILE } from '../../content/terrain/autotile.ts';
import { seasonOf } from '../calendar/calendar.ts';
import type { CampContext } from '../home/camp.ts';
import {
  FACT_ARRIVED_SAID,
  FACT_AT_BROCH,
  foodRd,
  foodReckoned,
  homeOf,
  shelterFinishOpen,
  shelterStage,
} from '../home/camp.ts';
import { shipWorkFor } from '../ship/work.ts';
import type { ResidentPlace } from './residents.ts';
import type { ActivityKind, JobKind, Person, WorldState } from '../world.ts';
import { blockAt } from './context.ts';
import type { PeopleContext } from './context.ts';

export interface Activity {
  readonly kind: ActivityKind;
  /** Where it is done, and the pose there (null: where they stand, as when talking). */
  readonly place: ResidentPlace | null;
  readonly job?: JobKind;
  readonly task?: Id;
  /** Working at half pace for a serious wound (Book 10 section 08). */
  readonly half?: boolean;
  /** Which meal: dawn or supper. */
  readonly meal?: 'DAWN' | 'SUPPER';
}

/** Jobs done out of doors stop at dark (the season's light, Book 10 section 02). */
const NEEDS_LIGHT: ReadonlySet<JobKind> = new Set(['FISHER', 'DRIFTWOOD']);

const at = (s: Spot, pose: ResidentPlace['pose'], task?: Id): ResidentPlace => ({
  zone: s.zone,
  x: s.x * TILE,
  y: s.y * TILE,
  facing: s.facing,
  pose,
  ...(task === undefined ? {} : { task }),
});

/** The residents without a place of their own in the camp's content, in household order. */
function others(world: WorldState, camp: CampContext, id: Id): number {
  const list = world.household.residents.filter((r) => camp.def.people[r] === undefined);
  return Math.max(0, list.indexOf(id));
}

/** Where a resident sits by the fire. */
export function seatOf(world: WorldState, camp: CampContext, ctx: PeopleContext, id: Id): Spot {
  const own = camp.def.people[id]?.camp;
  if (own !== undefined) return { zone: camp.def.zone, ...own };
  const seats = ctx.household.seats;
  return (
    seats[others(world, camp, id) % seats.length] ?? {
      zone: camp.def.zone,
      x: 35,
      y: 32,
      facing: 's',
    }
  );
}

/** Where a resident sleeps at the camp's stage. */
export function bedOf(world: WorldState, camp: CampContext, ctx: PeopleContext, id: Id): Spot {
  const stage = homeOf(world, camp)?.stage === 'S1' ? 'S1' : 'S0';
  // Design addendum 2.4 (DE-22): once the lean-to is up (the sail lashed over the frame, DG-12),
  // everyone sleeps under it until the finished shelter has its beds.
  const under = camp.def.shelterBeds;
  const lean = shelterStage(world);
  if (stage === 'S0' && (lean === 'SAIL' || lean === 'FINISHED') && under !== undefined) {
    const i = Math.max(0, [...world.household.residents].sort().indexOf(id));
    const bed = under[i % under.length];
    if (bed !== undefined) return { zone: camp.def.zone, ...bed };
  }
  const own = camp.def.people[id]?.sleep[stage];
  if (own !== undefined) return { zone: camp.def.zone, ...own };
  const beds = ctx.household.beds[stage];
  return beds[others(world, camp, id) % beds.length] ?? seatOf(world, camp, ctx, id);
}

/** The job a resident works today: REST lasts the day it was given; a job not open falls back. */
export function jobToday(
  world: WorldState,
  camp: CampContext,
  ctx: PeopleContext,
  p: Person,
): JobKind {
  const job = p.job;
  if (job === undefined) return 'CAMP';
  if (job.kind === 'REST' && job.since < world.calendar.day) {
    // Rest was for that day: back to the work they had before, or the household's first job.
    return ctx.household.people[p.id]?.job ?? 'CAMP';
  }
  // The jobs they take up first while there is such work (Hild finishing the shelter on the
  // second day, DG-12), unless the steerer has given them another than their own.
  // A fisher leaves the nets for it only while the stores hold the next day's food for every
  // mouth: feeding the household comes first (DG-56). The ship's stores on the mast are counted,
  // since the household can see them and means to bring them up (DG-90); with nothing in the
  // stores for the evening meal, the fisher fishes whatever is reckoned.
  const own = ctx.household.people[p.id];
  const home = homeOf(world, camp);
  const mouths = 1 + world.household.residents.length;
  const fed =
    own?.job !== 'FISHER' ||
    (home !== undefined &&
      foodRd(home) > 0 &&
      foodReckoned(world, camp, home) >= mouths * camp.work.foodPerPersonPerDay);
  if (job.kind === own?.job && fed)
    for (const first of own.first ?? [])
      if (jobOpen(world, camp, ctx.household.jobs[first], p.id)) return first;
  if (jobOpen(world, camp, ctx.household.jobs[job.kind], p.id)) return job.kind;
  // Stage 11: the first of their next jobs with work (Runa to the boat once the shelter is up).
  for (const next of ctx.household.people[p.id]?.then ?? [])
    if (jobOpen(world, camp, ctx.household.jobs[next], p.id)) return next;
  return 'CAMP';
}

/**
 * Whether a job can be worked now (raising the shelter: only while the camp is at S0; the
 * shipwright's: only while there is work at the boat for them, Stage 11).
 */
export function jobOpen(
  world: WorldState,
  camp: CampContext,
  def: JobDef | undefined,
  who?: Id,
): boolean {
  if (def === undefined) return false;
  const stage = homeOf(world, camp)?.stage ?? 'S0';
  if (def.stages !== undefined && !(def.stages as string[]).includes(stage)) return false;
  if (def.needs === 'SHIP_WORK') return shipWorkFor(world, who ?? '') !== null;
  if (def.needs === 'SHELTER_FINISH')
    return shelterFinishOpen(world, camp.shelterFinishFrom, camp.time.dayStart);
  return true;
}

/** Where a job is worked by this resident: their own spot, or the job's in turn. */
export function jobSpot(
  world: WorldState,
  camp: CampContext,
  ctx: PeopleContext,
  id: Id,
  job: JobKind,
): Spot | null {
  const def = ctx.household.jobs[job];
  const own = camp.def.people[id]?.work;
  if (own !== undefined && def?.task === own.task) return own;
  const spots = def?.spots ?? [];
  if (spots.length === 0) return null;
  // Everyone working it today, by the job they take up (a first job counts, so two who take up
  // the shelter's finishing never share a spot: DG-90).
  const same = world.household.residents.filter((r) => {
    const q = world.people[r];
    return (
      q !== undefined &&
      (q.job?.kind === job || jobToday(world, camp, ctx, q) === job) &&
      camp.def.people[r]?.work.task !== def?.task
    );
  });
  // Someone working it as their first job (not their own) takes the next spot along.
  const i = same.indexOf(id);
  return spots[(i < 0 ? same.length : i) % spots.length] ?? null;
}

/** The tendency's window today, in minutes after midnight (Book 5 section 17). */
function tendencyWindow(
  ctx: PeopleContext,
  day: number,
  when: string,
): readonly [number, number] | null {
  const light = ctx.time.daylight[seasonOf(day)];
  const tm = ctx.household.tendencyMinutes;
  const start = (b: string): number => ctx.blocks.find((x) => x.block === b)?.from ?? 0;
  switch (when) {
    case 'DAWN':
      return [light.lightFrom, light.lightFrom + tm];
    case 'DUSK':
      return [light.darkFrom - tm, light.darkFrom];
    case 'EVENING':
      return [start('EVENING'), start('EVENING') + tm];
    case 'NIGHT':
      return [start('SLEEP'), start('SLEEP') + tm];
    case 'WORK':
      return [start('WORK'), start('WORK') + tm];
    default:
      return null;
  }
}

function within(m: number, w: readonly [number, number]): boolean {
  const [a, b] = w;
  return b <= 1440 ? m >= a && m < b : m >= a || m < b - 1440;
}

/** Whether the dawn ration was served to them today (they woke at home). */
export function servedToday(p: Person, day: number): boolean {
  return p.life.meals.day === day && p.life.meals.count > 0;
}

/**
 * What a resident at home is doing now and where. Before beat 2 (Hild leading to the broch) the
 * opening decides; this is the household's day once the camp is reached.
 */
export function activityOf(
  world: WorldState,
  camp: CampContext,
  ctx: PeopleContext,
  id: Id,
): Activity {
  const p = world.people[id];
  const seat = seatOf(world, camp, ctx, id);
  if (p === undefined) return { kind: 'SIT', place: at(seat, 'sit') };
  const talk = world.talk;
  if (talk !== null && (talk.with === id || talk.finder === id))
    return { kind: talk.kind === 'SCENE' ? 'SCENE' : 'TALK', place: null };
  const asleep = world.onFoot?.player.sleep != null || !world.player.awake;
  const bed = bedOf(world, camp, ctx, id);
  if (asleep) return { kind: 'SLEEP', place: at(bed, 'sleep') };
  if (p.wounds.some((w) => w.severity === 'GRAVE')) return { kind: 'BED', place: at(bed, 'sleep') };
  const minute = world.calendar.minuteOfDay;
  const { block } = blockAt(ctx, minute);
  // The tendency at its hour (not at work, unless it is a work habit or dusk ends the day).
  const def = ctx.defs.get(id)?.tendency;
  const window = def === undefined ? null : tendencyWindow(ctx, world.calendar.day, def.at);
  if (def !== undefined && window !== null && within(minute, window)) {
    const workHabit = def.at === 'WORK' || def.at === 'DUSK';
    if (block !== 'WORK' || workHabit) {
      const place = ctx.household.places[def.place];
      const spot = place ?? seat;
      const pose = def.pose === 'work' ? 'work' : def.pose === 'watch' ? 'watch' : def.pose;
      return { kind: 'TENDENCY', place: at(spot, pose) };
    }
  }
  if (block === 'SLEEP') return { kind: 'SLEEP', place: at(bed, 'sleep') };
  const home = homeOf(world, camp);
  if (block === 'MEAL') {
    const supper = minute >= 12 * 60;
    const meal = supper
      ? home !== undefined && foodRd(home) > 0
      : servedToday(p, world.calendar.day);
    if (meal) return { kind: 'MEAL', place: at(seat, 'eat'), meal: supper ? 'SUPPER' : 'DAWN' };
    if (supper) return { kind: 'EVENING', place: at(seat, 'sit') };
  }
  if (block === 'WORK' || block === 'MEAL') {
    // Beat 2: Hild shows the steerer the camp before she goes off to work.
    // (Before design addendum 2.4 only: since it she walks up at the first fire, DE-16.)
    if (
      world.facts[FACT_AT_BROCH] === true &&
      world.facts[FACT_ARRIVED_SAID] !== true &&
      world.facts['ch1.phase'] === undefined
    )
      return { kind: 'SIT', place: at(seat, 'sit') };
    const job = jobToday(world, camp, ctx, p);
    if (p.life.refuses.includes(job)) return { kind: 'REFUSE', place: at(seat, 'sit'), job };
    if (job === 'REST') return { kind: 'REST', place: at(seat, 'sit'), job };
    const light = ctx.time.daylight[seasonOf(world.calendar.day)];
    if (NEEDS_LIGHT.has(job) && (minute < light.lightFrom || minute >= light.darkFrom))
      return { kind: 'DARK', place: at(seat, 'sit'), job };
    const jdef = ctx.household.jobs[job];
    const half = p.wounds.some((w) => w.severity === 'SERIOUS');
    // Design addendum 2.5 (DF-21, item 8): seriously wounded, a job with seated places is worked
    // sitting there at half pace, off the steerer's work spot (Runa at the boat with her ankle).
    const seated = half ? (jdef?.hurtSpots?.[0] ?? null) : null;
    const spot = seated ?? jobSpot(world, camp, ctx, id, job);
    if (jdef?.task !== undefined && spot !== null)
      return {
        kind: 'WORK',
        place: at(spot, seated === null ? 'work' : 'sit', jdef.task),
        job,
        task: jdef.task,
        half,
      };
    return { kind: 'REST', place: at(seat, 'sit'), job };
  }
  return { kind: 'EVENING', place: at(seat, 'sit') };
}
