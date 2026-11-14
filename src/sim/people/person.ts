/**
 * People as Book 2 section 06 shapes them (Stage 8): a person from their Book 5 content, with the
 * three measures at Book 10's starting values, and the day's bookkeeping. Joining the household
 * starts their day: a job, the memories they arrive with, and the days their hidden traits will
 * show (Book 10 section 08, traitsPerPerson: 5 to 20 days), drawn on the `people` stream.
 */
import { parsePeopleBalance } from '../../content/peopleBalance.ts';
import type { HouseholdDef, PersonDef } from '../../content/registry.ts';
import type { Id } from '../../core/ids.ts';
import { nextInt } from '../../core/rng.ts';
import type { Person, PersonLife, WarningTrack, WorldState } from '../world.ts';

function track(): WarningTrack {
  return { step: 0, pending: 0, lastDay: null };
}

/** A person's day before they join the household. */
export function emptyLife(): PersonLife {
  return {
    joinedDay: null,
    nights: 0,
    meals: { day: 0, count: 0, hot: false, foods: [] },
    night: null,
    coldTonight: false,
    storyDay: 0,
    lasting: [],
    today: { day: 0, treated: 0, likes: [], dislikes: [] },
    lowSince: null,
    fearDay: 0,
    warning: { friendship: track(), happiness: track() },
    band: '',
    rising: 0,
    feared: false,
    devoted: false,
    refuses: [],
    wantsToLeave: false,
    owed: [],
    time: { day: 0, friendship: 0, besideMinutes: 0 },
    topics: {},
    raised: [],
    nextBark: 0,
    activity: null,
    stash: 0,
    lastTheftDay: null,
  };
}

/**
 * A person from their content, at Book 10's starting measures: happiness 60, fear 0, friendship 0,
 * or 20 with a tie to the steerer (Book 10 section 08, "Happiness, friendship and fear").
 */
export function newPerson(def: PersonDef, vitality: number, balance: unknown): Person {
  const m = parsePeopleBalance(balance).measures;
  return {
    id: def.id,
    nameKey: def.nameKey,
    origin: def.origin ?? 'UNSTATED',
    appearance: `actor_${def.id.toLowerCase()}`,
    // Chapter 1: the starting crew are lost in the wreck until found (Book 4 section 08).
    status: def.kind === 'RESIDENT' ? 'missing' : 'alive',
    vitality,
    skills: {},
    skillXp: {},
    values: { ...(def.values ?? {}) },
    ...(def.faithTarget === undefined ? {} : { faithTarget: def.faithTarget }),
    codes: [...(def.codes ?? ['NORSE'])],
    codeStance: def.codeStance ?? 'CONVENTIONAL',
    traits: (def.traits ?? []).map((t) => ({
      trait: t.trait,
      known: t.known,
      ...(t.faith === undefined ? {} : { faith: t.faith }),
      ...(t.revealedBy === undefined ? {} : { revealedBy: t.revealedBy }),
    })),
    likes: (def.likes ?? []).map((l) => ({ ...l })),
    dislikes: (def.dislikes ?? []).map((l) => ({ ...l })),
    tendencies: def.tendency === undefined ? [] : [`${def.tendency.at}:${def.tendency.place}`],
    happiness: m.happinessStart,
    friendship: def.steererTie === undefined ? m.friendshipStart : m.friendshipStartTie,
    fear: m.fearStart,
    moodToday: [],
    ties: (def.ties ?? []).map((t) => ({ to: t.to, kind: t.kind, since: 0 })),
    memories: [],
    wounds: [],
    schedule: 'household',
    requests: [],
    valueShifts: 0,
    life: emptyLife(),
  };
}

/**
 * Joins the household (Book 2 section 06): the day begins. The person takes the household's first
 * job for them, remembers what they arrive with, and each hidden trait gets the day it will show.
 */
export function joinPerson(
  world: WorldState,
  id: Id,
  household: HouseholdDef,
  discoverDays: readonly [number, number],
): void {
  const person = world.people[id];
  if (person?.life.joinedDay !== null) return;
  const day = world.calendar.day;
  person.life.joinedDay = day;
  person.life.band = '';
  person.life.fearDay = day;
  const plan = household.people[id];
  person.job = { kind: plan?.job ?? 'CAMP', since: day, byOrder: false };
  for (const m of plan?.memories ?? [])
    if (!person.memories.some((x) => x.kind === m.kind && x.about === m.about))
      person.memories.push({
        day: m.day ?? day,
        kind: m.kind,
        about: m.about,
        source: 'SAW',
        ...(m.tie === true ? { tie: true } : {}),
      });
  for (const t of person.traits)
    if (!t.known && t.revealedBy === undefined && t.discoverDay === undefined)
      t.discoverDay = day + nextInt(world.rng.people, discoverDays[0], discoverDays[1]);
}

/** Whether a person can be spoken to and works at home: a resident, alive. */
export function isResident(world: WorldState, id: Id): boolean {
  return world.household.residents.includes(id) && world.people[id] !== undefined;
}
