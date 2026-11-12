/**
 * The household's day (Stage 8; Book 2 section 06; Book 5 sections 01 and 17): residents joining,
 * walking to what their schedule has them doing, working their jobs, eating, sleeping, and how
 * they feel about it.
 *
 * - **Each tick** residents walk to their activity's place (src/sim/people/residents.ts), stand to
 *   talk, and bark (src/sim/people/talk.ts).
 * - **Each game minute** their work counts at Book 10's rates (skill, a serious wound's half pace,
 *   happiness, fearful obedience and traits), meals are eaten, a light-fingered resident tries the
 *   stores on going to bed, likes and dislikes are met, and time worked beside the steerer counts.
 * - **Each game hour** today's mood factors are recomputed and happiness drifts towards them; the
 *   friendship bands and the warning flow are checked.
 * - **At dawn** the night is counted (warm, in a bed), the dawn ration served, fear fades, hidden
 *   traits show on their day, and the steward's report says what each resident means to do.
 */
import { heldByFight } from '../land/fight.ts';
import type { Id } from '../../core/ids.ts';
import { nextInt } from '../../core/rng.ts';
import { minutesIntoDay, seasonOf } from '../calendar/calendar.ts';
import type { CampContext, CampEvent, SteererAt } from '../home/camp.ts';
import {
  addShelterWork,
  campaignMinute,
  FACT_AT_BROCH,
  feedFire,
  foodRd,
  homeOf,
  landFish,
  skillRatio,
} from '../home/camp.ts';
import type { LandContext } from '../land/onFoot.ts';
import { findActor } from '../land/zoneLinks.ts';
import type { HomeState, MoodFactor, Person, ReportLine, WorldState } from '../world.ts';
import type { PeopleContext } from './context.ts';
import type { PeopleEvent } from './events.ts';
import {
  bandIndex,
  bandOf,
  clampMeasures,
  driftHappiness,
  effectsOf,
  happinessTarget,
  workMultiplier,
} from './measures.ts';
import { joinPerson } from './person.ts';
import { stepResident } from './residents.ts';
import { activityOf, jobToday } from './schedule.ts';
import type { Activity } from './schedule.ts';

export type Emit = (e: PeopleEvent | CampEvent) => void;

/** Residents in a stable order (Book 2 section 03: deterministic). */
export function residents(world: WorldState): Id[] {
  return [...world.household.residents].sort();
}

/** Distance in tiles from the steerer to a resident in view (Infinity out of view). */
export function tilesFromSteerer(world: WorldState, id: Id, tile: number): number {
  const onFoot = world.onFoot;
  if (onFoot === null) return Infinity;
  const a = onFoot.actors[id];
  if (a === undefined) return Infinity;
  return Math.hypot(a.x - onFoot.player.x, a.y - onFoot.player.y) / tile;
}

/** Residents whose day the opening still runs: Hild until she has led the steerer to the broch. */
function inOpening(world: WorldState, id: Id, opener: Id | null): boolean {
  if (id === opener && world.facts[FACT_AT_BROCH] !== true) return true;
  const actor = world.onFoot === null ? undefined : findActor(world.onFoot, id)?.actor;
  return actor?.pose === 'carried' || actor?.pose === 'down' || actor?.pose === 'call';
}

/** Joins any new resident to the household's day (Book 2 section 06). */
export function joinNew(world: WorldState, ctx: PeopleContext, tick: number, emit: Emit): void {
  for (const id of residents(world)) {
    const p = world.people[id];
    if (p?.life.joinedDay !== null) continue;
    joinPerson(world, id, ctx.household, ctx.b.traits.discoverDays);
    const [lo, hi] = ctx.b.talk.barkEverySeconds;
    p.life.nextBark = tick + nextInt(world.rng.people, lo, hi) * ctx.ticksPerSecond;
    p.life.band = bandOf(ctx.b, p.friendship);
    emit({ type: 'RESIDENT_JOINED', person: id });
  }
}

/**
 * One tick: every resident at home walks to their activity's place; one talking stands and faces
 * the steerer.
 */
export function stepPeopleTick(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  tidalGroundOpen: boolean,
  opener: Id | null,
  /** Residents something else moves for now (Stage 10: Bran carrying Thorkel home). */
  held: (id: Id) => boolean = () => false,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null) return;
  for (const id of residents(world)) {
    if (inOpening(world, id, opener) || held(id)) continue;
    // In a fight (Stage 9): downed, carried, under an order, or fighting, the fight moves them.
    const here = onFoot.actors[id];
    if (here !== undefined && heldByFight(world, id, here)) continue;
    const act = activityOf(world, camp, ctx, id);
    if (act.place === null) {
      // Talking: they stand where they are and face the steerer.
      const found = findActor(onFoot, id);
      if (found?.visible === true) {
        const a = found.actor;
        delete a.walk;
        delete a.moving;
        delete a.task;
        a.pose = 'idle';
        const dx = onFoot.player.x - a.x;
        const dy = onFoot.player.y - a.y;
        a.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
      }
      continue;
    }
    stepResident(onFoot, id, act.place, land.maps, land, tidalGroundOpen);
  }
}

/** Whether the steerer is close enough to supervise (Book 10 "supervised"). */
function supervised(world: WorldState, ctx: PeopleContext, id: Id, tile: number): boolean {
  return tilesFromSteerer(world, id, tile) <= ctx.b.talk.supervisedTiles;
}

/** Adds a like or dislike met today, once each (Book 10 "Likes and dislikes"). */
export function meet(world: WorldState, p: Person, ref: string, emitKnown = true): void {
  freshToday(world, p);
  const like = p.likes.find((l) => l.ref === ref);
  if (like !== undefined && !p.life.today.likes.includes(ref)) {
    p.life.today.likes.push(ref);
    if (emitKnown) like.known = true;
  }
  const dislike = p.dislikes.find((l) => l.ref === ref);
  if (dislike !== undefined && !p.life.today.dislikes.includes(ref)) {
    p.life.today.dislikes.push(ref);
    if (emitKnown) dislike.known = true;
  }
}

/** Today's bookkeeping starts fresh on a new day. */
function freshToday(world: WorldState, p: Person): void {
  const day = world.calendar.day;
  if (p.life.today.day !== day) p.life.today = { day, treated: 0, likes: [], dislikes: [] };
}

/** How a person was treated today (Book 10 "Treated well / badly today"), within its range. */
export function treat(world: WorldState, ctx: PeopleContext, p: Person, amount: number): void {
  freshToday(world, p);
  const lo = Math.min(...ctx.b.inputs.treatedBadly);
  const hi = Math.max(...ctx.b.inputs.treatedWell);
  p.life.today.treated = Math.max(lo, Math.min(hi, p.life.today.treated + amount));
}

/** Friendship from time spent (a real conversation, an hour working beside them), capped a day. */
export function timeSpent(world: WorldState, ctx: PeopleContext, p: Person): void {
  const day = world.calendar.day;
  if (p.life.time.day !== day) p.life.time = { day, friendship: 0, besideMinutes: 0 };
  if (p.life.time.friendship >= ctx.b.care.timePerDay) return;
  p.life.time.friendship += ctx.b.care.time;
  p.friendship += ctx.b.care.time;
  clampMeasures(p);
}

/** A meal eaten: hot if the fire is lit; what was eaten (fresh fish first, as the ration). */
export function eatMeal(
  world: WorldState,
  p: Person,
  home: HomeState | undefined,
): { hot: boolean; food: string } {
  const day = world.calendar.day;
  const hot = home?.fire.lit === true;
  const fresh = home?.fresh.some((f) => f.rd > 0) === true;
  const food = fresh ? 'RES_FRESH_FISH' : 'RES_SALTED_FISH';
  const m = p.life.meals.day === day ? p.life.meals : { day, count: 0, hot: false, foods: [] };
  p.life.meals = {
    day,
    count: m.count + 1,
    hot: m.hot || hot,
    foods: m.foods.includes(food) ? m.foods : [...m.foods, food],
  };
  return { hot, food };
}

/**
 * Today's mood factors (Book 10 "Happiness inputs"; Book 2 MoodFactor): what the day's happiness
 * target is made of, each with its reason.
 */
export function moodFactors(world: WorldState, ctx: PeopleContext, p: Person): MoodFactor[] {
  const b = ctx.b;
  const day = world.calendar.day;
  const out: MoodFactor[] = [];
  const meals = p.life.meals.day === day ? p.life.meals : null;
  const into = minutesIntoDay(world.calendar, ctx.time);
  const hungryFrom = (ctx.hungryAt - ctx.time.dayStart + 1440) % 1440;
  if (meals !== null && meals.count > 0 && meals.hot)
    out.push({ cause: 'FOOD', amount: b.inputs.fed, detail: 'fed' });
  else if ((meals === null || meals.count === 0) && into >= hungryFrom)
    out.push({ cause: 'FOOD', amount: b.inputs.hungry, detail: 'hungry' });
  const night = p.life.night?.day === day ? p.life.night : null;
  if (night !== null) {
    out.push(
      night.warm
        ? { cause: 'WARMTH', amount: b.inputs.warmNight, detail: 'warm' }
        : { cause: 'WARMTH', amount: b.inputs.coldNight, detail: 'cold' },
    );
    if (night.bed) out.push({ cause: 'REST', amount: b.inputs.bed, detail: 'bed' });
  }
  // No threat reaches the home yet (Book 10 section 11 arrives with Stage 19).
  out.push({ cause: 'SAFETY', amount: b.inputs.safe, detail: 'safe' });
  for (const l of p.life.lasting) {
    const age = day - l.fromDay;
    if (age < 0 || age >= l.days) continue;
    const share = l.fade ? 1 - age / l.days : 1;
    out.push({ cause: l.cause, amount: l.amount * share, detail: l.detail });
  }
  // Grief for a tie who died (a DEATH memory with a tie), fading over Book 10's days.
  for (const m of p.memories) {
    if (m.kind !== 'DEATH' || m.tie !== true) continue;
    const age = day - m.day;
    if (age < 0 || age >= b.inputs.grief.days) continue;
    out.push({
      cause: 'GRIEF',
      amount: b.inputs.grief.amount * (1 - age / b.inputs.grief.days),
      detail: m.about,
    });
  }
  const today = p.life.today.day === day ? p.life.today : null;
  if (today !== null && today.treated !== 0)
    out.push({
      cause: 'TREATMENT',
      amount: today.treated,
      detail: today.treated > 0 ? 'well' : 'badly',
    });
  for (const ref of today?.likes ?? [])
    out.push({ cause: 'LIKE', amount: b.likes.met, detail: ref });
  for (const ref of today?.dislikes ?? [])
    out.push({ cause: 'DISLIKE', amount: b.likes.dislikeMet, detail: ref });
  if (p.life.storyDay === day)
    out.push({ cause: 'TIE', amount: b.traits.storyteller, detail: 'story' });
  return out;
}

/** Recomputes today's mood and lets happiness drift one hour's share towards it. */
export function hourOfMood(world: WorldState, ctx: PeopleContext, p: Person): void {
  p.moodToday = moodFactors(world, ctx, p);
  p.happiness = driftHappiness(ctx.b, p.happiness, happinessTarget(ctx.b, p.moodToday));
  clampMeasures(p);
}

/**
 * Bands and the warning flow (Book 2 section 06; Book 5 section 01; Book 8 section 11): a downward
 * band crossing, or leaving's effect, adds steps; steps are taken in order (remark, complaint,
 * refusal, request to leave), at least Book 10's warningSpacing days apart, never skipped; each is
 * a line owed to the steerer. Happiness that stays low a whole day starts its own steps. Rising
 * bands bring praise, an offer of help and a personal favour; fear and devotion their own lines.
 */
export function checkFeelings(
  world: WorldState,
  ctx: PeopleContext,
  p: Person,
  emit: Emit,
  jobNow?: Person['job'],
): void {
  const b = ctx.b;
  const life = p.life;
  const day = world.calendar.day;
  const lines = ctx.talk?.people[p.id]?.warnings;
  const owe = (key: string | undefined): void => {
    if (key !== undefined && !life.owed.includes(key)) life.owed.push(key);
  };
  const band = bandOf(b, p.friendship);
  if (life.band === '') life.band = band;
  if (band !== life.band) {
    const down = bandIndex(b, band) - bandIndex(b, life.band);
    emit({ type: 'BAND_CHANGED', person: p.id, from: life.band, to: band });
    if (down > 0)
      life.warning.friendship.pending = Math.min(4, life.warning.friendship.pending + down);
    else {
      // Rising: the first time each of the top three bands is reached (Book 8 section 11).
      const level = Math.max(0, 3 - bandIndex(b, band));
      while (life.rising < level) {
        owe(lines?.RISING[life.rising]);
        life.rising++;
      }
    }
    life.band = band;
  }
  const eff = effectsOf(b, p);
  if (eff.leaves) life.warning.friendship.pending = 4;
  const content = b.bands.find((x) => x.name === 'Content')?.from ?? 0;
  if (p.friendship >= content && !eff.leaves && life.warning.friendship.step > 0) {
    life.warning.friendship = { step: 0, pending: 0, lastDay: null };
    life.refuses = [];
  } else if (p.friendship >= content && !eff.leaves) life.warning.friendship.pending = 0;
  // Happiness low for a whole day, and each further day.
  const now = campaignMinute(world, ctx.time);
  if (p.happiness < b.talk.lowHappiness) {
    life.lowSince ??= now;
    const days = Math.floor((now - life.lowSince) / 1440);
    life.warning.happiness.pending = Math.max(life.warning.happiness.pending, Math.min(4, days));
  } else {
    life.lowSince = null;
    if (life.warning.happiness.step > 0 || life.warning.happiness.pending > 0)
      life.warning.happiness = { step: 0, pending: 0, lastDay: null };
  }
  // Fear and devotion (Book 8 section 11).
  if (p.fear >= b.voice.afraid && !life.feared) {
    owe(lines?.FEAR);
    life.feared = true;
  } else if (p.fear < b.voice.afraid) life.feared = false;
  if (eff.devotion && !life.devoted) {
    owe(lines?.DEVOTION);
    life.devoted = true;
  } else if (!eff.devotion) life.devoted = false;
  // Take the steps due, in order and spaced.
  for (const track of ['friendship', 'happiness'] as const) {
    const t = life.warning[track];
    if (t.pending <= t.step) continue;
    if (t.lastDay !== null && day - t.lastDay < b.measures.warningSpacingDays) continue;
    t.step++;
    t.lastDay = day;
    const key =
      track === 'friendship' ? lines?.FRIENDSHIP[t.step - 1] : lines?.HAPPINESS[t.step - 1];
    owe(key);
    emit({
      type: 'WARNING_STEP',
      person: p.id,
      track: track === 'friendship' ? 'FRIENDSHIP' : 'HAPPINESS',
      step: t.step,
    });
    // The refusal: the work they were doing (Book 2: the order class that caused it).
    const job = (jobNow ?? p.job)?.kind;
    if (t.step === 3 && job !== undefined && job !== 'REST' && !life.refuses.includes(job))
      life.refuses.push(job);
    if (t.step === 4) life.wantsToLeave = true;
  }
}

/** Book 10 workerDay: rates are per worker-day; a resident adds them by the game minute. */
function workMinute(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  p: Person,
  act: Activity,
  home: HomeState,
  emit: Emit,
  say: (person: Id, key: string) => void,
  tile: number,
  shipWork?: (person: Id, workerMinutes: number) => void,
): void {
  const task = act.task === undefined ? undefined : camp.tasks.get(act.task);
  if (task === undefined || act.job === undefined) return;
  const level = p.skills[task.def.skill] ?? 0;
  const k =
    skillRatio(camp.work, level) *
    (act.half === true ? camp.work.seriousWorkFactor : 1) *
    workMultiplier(ctx.b, p, supervised(world, ctx, p.id, tile));
  const season = seasonOf(world.calendar.day);
  switch (act.job) {
    case 'FISHER':
      landFish(
        world,
        camp,
        home,
        (camp.work.fishShore[season] / camp.work.workerDayMinutes) * k,
        p.id,
        emit,
        (line) => {
          say(p.id, line);
        },
      );
      return;
    case 'DRIFTWOOD':
      // A day on the weed lines: Book 10's loads per search, times the searches a worker-day makes.
      home.stores['RES_DRIFTWOOD'] =
        (home.stores['RES_DRIFTWOOD'] ?? 0) +
        ((camp.work.driftwoodPerSearch[season] * camp.work.driftwoodSearchesPerWorkerDay) /
          camp.work.workerDayMinutes) *
          k;
      return;
    case 'CAMP':
      // Keeping the camp: the fire fed from the woodpile before it burns low (half a day's fuel).
      if (home.fire.lit && home.fire.fuel < camp.work.fuelPerDay[season] / 2)
        feedFire(world, camp, emit);
      return;
    case 'BUILDER':
      addShelterWork(camp, home, k, emit, (line) => {
        say(p.id, line);
      });
      return;
    case 'SHIPWRIGHT':
      // Stage 11: a minute's work at the boat (a repair, the fitting, or Runa's carving).
      shipWork?.(p.id, k);
      return;
    default:
      return;
  }
}

/** A light-fingered resident going to bed tries the stores (Book 10 "Traits"), unless watched. */
function tryStores(
  world: WorldState,
  ctx: PeopleContext,
  p: Person,
  home: HomeState,
  homeZone: Id,
): void {
  if (!p.traits.some((t) => t.trait === 'LIGHT_FINGERED')) return;
  const day = world.calendar.day;
  const last = p.life.lastTheftDay;
  if (last !== null && day - last < ctx.b.traits.lightFingeredDays) return;
  const watched =
    world.player.awake && world.onFoot?.player.sleep == null && world.onFoot?.zone === homeZone;
  if (watched) return;
  const take = ctx.b.talk.lightFingeredTakeRd;
  const salted = home.stores['RES_SALTED_FISH'] ?? 0;
  if (salted < take) return;
  home.stores['RES_SALTED_FISH'] = salted - take;
  p.life.stash += take;
  p.life.lastTheftDay = day;
}

/**
 * One game minute of the household's day. `at` is where the steerer is, for the fire's company and
 * working beside them.
 */
export function peopleMinute(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  at: SteererAt | null,
  opener: Id | null,
  emit: Emit,
  say: (person: Id, key: string) => void,
  /** Stage 11: a resident's minute at the boat. */
  shipWork?: (person: Id, workerMinutes: number) => void,
): void {
  const home = homeOf(world, camp);
  if (home === undefined) return;
  const tile = at?.tile ?? 24;
  const hour = world.calendar.minuteOfDay % 60 === 0;
  const fireSite = camp.def.sites.find((s) => s.kind === 'FIRE');
  const nearFire = (id: Id): boolean => {
    const a = world.onFoot === null ? undefined : findActor(world.onFoot, id);
    if (fireSite === undefined || a?.zone !== fireSite.zone) return false;
    return (
      Math.hypot(a.actor.x / tile - fireSite.x, a.actor.y / tile - fireSite.y) <=
      ctx.b.talk.besideTiles
    );
  };
  const steererByFire =
    at !== null &&
    at.zone === fireSite?.zone &&
    Math.hypot(at.x / tile - fireSite.x, at.y / tile - fireSite.y) <= ctx.b.talk.besideTiles;
  const ids = residents(world);
  const acts = new Map<Id, Activity>();
  for (const id of ids)
    if (!inOpening(world, id, opener)) acts.set(id, activityOf(world, camp, ctx, id));
  const atFire = ids.filter(
    (id) => acts.get(id)?.kind === 'EVENING' && home.fire.lit && nearFire(id),
  );
  const storyteller = atFire.some((id) =>
    world.people[id]?.traits.some((t) => t.trait === 'STORYTELLER' && t.known),
  );
  for (const id of ids) {
    const p = world.people[id];
    const act = acts.get(id);
    if (p === undefined || act === undefined) continue;
    const was = p.life.activity;
    if (was !== act.kind) {
      p.life.activity = act.kind;
      emit({ type: 'ACTIVITY_CHANGED', person: id, activity: act.kind });
      if (act.kind === 'MEAL' && act.meal === 'SUPPER') {
        const meal = eatMeal(world, p, home);
        meet(world, p, meal.food);
        emit({ type: 'MEAL_TAKEN', person: id, hot: meal.hot });
      }
      if (act.kind === 'SLEEP') {
        p.life.coldTonight = !home.fire.lit;
        tryStores(world, ctx, p, home, camp.def.zone);
      }
    }
    if (act.kind === 'SLEEP' && !home.fire.lit) p.life.coldTonight = true;
    if (act.kind === 'WORK') {
      workMinute(world, ctx, camp, p, act, home, emit, say, tile, shipWork);
      if (act.task !== undefined) meet(world, p, act.task, false);
      // Working beside the steerer: an hour of it is time spent (Book 10).
      const beside =
        world.onFoot?.player.work != null &&
        tilesFromSteerer(world, id, tile) <= ctx.b.talk.besideTiles;
      if (beside) {
        const day = world.calendar.day;
        if (p.life.time.day !== day) p.life.time = { day, friendship: 0, besideMinutes: 0 };
        p.life.time.besideMinutes++;
        if (p.life.time.besideMinutes % 60 === 0) timeSpent(world, ctx, p);
      }
    }
    if (act.kind === 'MEAL' && tilesFromSteerer(world, id, tile) <= ctx.b.talk.besideTiles)
      meet(world, p, 'WATCHED_EATING');
    if (act.kind === 'EVENING' && atFire.includes(id)) {
      if (steererByFire || atFire.length > 1) meet(world, p, 'FIRESIDE', false);
      for (const other of atFire) if (other !== id) meet(world, p, other, false);
      if (storyteller) p.life.storyDay = world.calendar.day;
    }
    if (act.kind === 'REST' && p.job?.kind === 'REST' && p.job.byOrder)
      meet(world, p, 'TOLD_TO_REST');
    if (hour) {
      hourOfMood(world, ctx, p);
      checkFeelings(world, ctx, p, emit);
    }
  }
}

/**
 * Dawn (Book 2 section 06): the night is counted (warm by a fire that stayed lit, in a bed at S1),
 * the dawn ration served to those who woke at home, fear fades without new fear, and hidden traits
 * show on their day. Returns the report's lines about the household.
 */
export function peopleDawn(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  emit: Emit,
): ReportLine[] {
  const home = homeOf(world, camp);
  const day = world.calendar.day;
  const lines: ReportLine[] = [];
  for (const id of residents(world)) {
    const p = world.people[id];
    if (p === undefined || p.life.joinedDay === null) continue;
    p.life.nights++;
    p.life.night = { day, warm: !p.life.coldTonight, bed: home?.stage === 'S1' };
    p.life.coldTonight = false;
    if (home !== undefined && foodRd(home) > 0) {
      p.life.meals = { day, count: 0, hot: false, foods: [] };
      const meal = eatMeal(world, p, home);
      meet(world, p, meal.food);
    }
    if (p.life.fearDay < day - 1 && p.fear > 0)
      p.fear = Math.max(0, p.fear + ctx.b.measures.fearDecayPerDay);
    for (const t of p.traits)
      if (!t.known && t.discoverDay !== undefined && day >= t.discoverDay) {
        t.known = true;
        emit({ type: 'TRAIT_DISCOVERED', person: id, trait: t.trait });
        lines.push({
          key: 'report.trait.found',
          vars: { name: id, trait: `trait.name.${t.trait.toLowerCase()}` },
        });
      }
    hourOfMood(world, ctx, p);
    checkFeelings(world, ctx, p, emit);
    // What they mean to do today.
    const job = jobToday(world, camp, ctx, p);
    const jobKey = ctx.household.jobs[job]?.nameKey;
    if (jobKey !== undefined)
      lines.push({ key: 'report.work.job', vars: { name: id, job: jobKey } });
    if (job !== 'REST' && p.wounds.some((w) => w.severity === 'SERIOUS'))
      lines.push({ key: 'report.work.half', vars: { name: id } });
    const low = p.moodToday.filter((f) => f.amount < 0).sort((a, b) => a.amount - b.amount)[0];
    if (p.happiness < ctx.b.measures.happinessBase && low !== undefined) {
      const reason =
        low.cause === 'FOOD'
          ? 'hungry'
          : low.cause === 'WARMTH'
            ? 'cold'
            : low.cause === 'GRIEF'
              ? 'grief'
              : 'treated';
      lines.push({
        key: 'report.mood.low',
        vars: { name: id, reason: `report.mood.reason.${reason}` },
      });
    }
  }
  return lines;
}
