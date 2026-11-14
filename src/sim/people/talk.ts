/**
 * Conversation, jobs and barks (Book 8 sections 08, 09 and 11; Book 2 sections 06 and 16; Stage 8).
 *
 * - **A conversation** opens with a greeting that fits the time of day, what they are doing, a
 *   wound and their voice (warm, cold, afraid or devoted, at Book 10's thresholds); offers up to
 *   three topics drawn from their memories by priority (a wound, a death, a deed, an event, their
 *   work, the season), each topic resting Book 10's days once talked through; each step offers the
 *   steerer's replies, each a kind from Book 10 "Conversation replies"; it ends with their exit line.
 *   Time does not stop.
 * - **Jobs and delegation** (Book 1 section 10): the steerer gives a resident an outcome to work
 *   at; refusals carry a reason code: too badly hurt, refusing that work (the warning flow), no such
 *   work now, already at it.
 * - **Barks** are short lines with the speaker's voice blip, never blocking: by category priority
 *   (danger, orders, wounds, discoveries, reactions, then work, weather and idle), never the same
 *   line from a speaker within ten real minutes nor from anyone within a minute (Book 8 section 08),
 *   and only in earshot. Lines owed by the warning flow come first.
 */
import type { ChoiceDef, TopicDef } from '../../content/registry.ts';
import type { Id } from '../../core/ids.ts';
import { nextInt, pick } from '../../core/rng.ts';
import { seasonOf, watchOf } from '../calendar/calendar.ts';
import type { CampContext } from '../home/camp.ts';
import { FACT_AT_BROCH } from '../home/camp.ts';
import type { JobKind, Person, TalkState, WorldState } from '../world.ts';
import { holds } from '../narrative/aims.ts';
import type { AimCondition } from '../../content/aimSchema.ts';
import { searchOptions } from '../narrative/searches.ts';
import type { SearchContext } from '../narrative/searches.ts';
import type { PeopleContext } from './context.ts';
import {
  adviceLines,
  boatLine,
  careAnswer,
  carePersuaded,
  exchangeUnderWay,
  isAdvisor,
  refuserOf,
} from './company.ts';
import { checkFeelings, meet, tilesFromSteerer, timeSpent, treat } from './day.ts';
import type { Emit } from './day.ts';
import type { JobRefusal } from './events.ts';
import { clampMeasures, slight, voiceOf } from './measures.ts';
import { activityOf, jobOpen } from './schedule.ts';

const WATCH_NAME = {
  Morning: 'MORNING',
  Day: 'DAY',
  Evening: 'EVENING',
  Night: 'NIGHT',
} as const;

/** Whether a line's conditions hold now for this person. */
function fits(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  p: Person,
  when: {
    readonly watch?: string;
    readonly activity?: string;
    readonly voice?: string;
    readonly wounded?: boolean;
    readonly grief?: boolean;
    readonly season?: string;
    readonly when?: readonly AimCondition[];
  },
): boolean {
  if (when.watch !== undefined && WATCH_NAME[watchOf(world.calendar, ctx.time)] !== when.watch)
    return false;
  if (when.activity !== undefined && activityOf(world, camp, ctx, p.id).kind !== when.activity)
    return false;
  if (when.voice !== undefined && voiceOf(ctx.b, p, ctx.b.voice) !== when.voice) return false;
  if (when.wounded !== undefined && when.wounded !== p.wounds.length > 0) return false;
  if (when.grief !== undefined && when.grief !== grieving(world, ctx, p)) return false;
  if (when.season !== undefined && seasonOf(world.calendar.day) !== when.season) return false;
  // The user's fourth playtest (DH-20): a line held to the story's facts (Hild's father found).
  if (when.when !== undefined && !when.when.every((c) => holds(world, c))) return false;
  return true;
}

function grieving(world: WorldState, ctx: PeopleContext, p: Person): boolean {
  return p.memories.some(
    (m) =>
      m.kind === 'DEATH' && m.tie === true && world.calendar.day - m.day < ctx.b.inputs.grief.days,
  );
}

/** The greeting that fits best: voice first, then activity, a wound, the watch (Book 8 section 09). */
export function greetingFor(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  p: Person,
): string | null {
  const list = ctx.talk?.people[p.id]?.greetings ?? [];
  const voice = voiceOf(ctx.b, p, ctx.b.voice);
  const score = (g: (typeof list)[number]): number => {
    if (!fits(world, ctx, camp, p, g)) return -1;
    return (
      (g.voice !== undefined ? 8 : 0) +
      (g.activity !== undefined ? 4 : 0) +
      (g.wounded === true ? 2 : 0) +
      (g.watch !== undefined ? 1 : 0)
    );
  };
  let best: { key: string; s: number } | null = null;
  for (const g of list) {
    if (g.voice !== undefined && g.voice !== voice) continue;
    const s = score(g);
    if (s >= 0 && (best === null || s > best.s)) best = { key: g.key, s };
  }
  return best?.key ?? null;
}

/** Whether a topic can be offered now (its memory is held, its state holds, it is not resting). */
function topicOpen(world: WorldState, ctx: PeopleContext, p: Person, t: TopicDef): boolean {
  const day = world.calendar.day;
  const talked = p.life.topics[t.id];
  if (t.always !== true && talked !== undefined && day - talked < ctx.b.talk.topicRestDays)
    return false;
  if (t.season !== undefined && seasonOf(day) !== t.season) return false;
  if (t.missing !== undefined && world.people[t.missing]?.status !== 'missing') return false;
  // The user's fourth playtest (DH-20): a topic held to the story's facts.
  if (t.when !== undefined && !t.when.every((c) => holds(world, c))) return false;
  switch (t.memory) {
    case 'WOUND': {
      const w = p.wounds[0];
      if (w === undefined) return false;
      const state = w.tendedDay === undefined ? 'UNTENDED' : 'TENDED';
      return t.state === undefined || t.state === state;
    }
    case 'JOB':
    case 'SEASON':
      return true;
    // A reason for the first raid (DH-134): offered while the need is felt (src/sim/narrative/
    // raid.ts keeps `need.felt.<about>`), whatever the speaker remembers.
    case 'NEED':
      return world.facts[`need.felt.${t.about ?? ''}`] === true;
    default:
      return p.memories.some(
        (m) => m.kind === t.memory && (t.about === undefined || m.about === t.about),
      );
  }
}

/** The topics a resident has now, by priority, up to Book 10's three (Book 8 section 09). */
export function topicsFor(world: WorldState, ctx: PeopleContext, id: Id): TopicDef[] {
  const p = world.people[id];
  if (p === undefined || ctx.talk === null) return [];
  const open = ctx.talk.topics.filter((t) => t.speaker === id && topicOpen(world, ctx, p, t));
  // One topic per kind of memory (the most pressing wound, the season's line), then by priority.
  const byKind = new Map<string, TopicDef>();
  for (const t of [...open].sort((a, b) => b.priority - a.priority)) {
    const kind = `${t.memory}:${t.about ?? ''}`;
    if (!byKind.has(kind)) byKind.set(kind, t);
  }
  // Up to Book 10's three topics; their work (delegation) is always offered besides, like leaving.
  const chosen = [...byKind.values()]
    .filter((t) => t.memory !== 'JOB')
    .sort((a, b) => b.priority - a.priority)
    .slice(0, ctx.b.talk.topicsPerTalk);
  return [
    ...chosen,
    ...[...byKind.values()].filter((t) => t.memory === 'JOB'),
    ...companyTopics(world, ctx, p),
  ];
}

/** The user's fourth playtest's topics (DH-55, DH-62): always offered, like their work. */
export const ADVICE_TOPIC = 'company.advice';
export const BOAT_TOPIC = 'company.boat';
const COMPANY_LABELS: Readonly<Record<string, string>> = {
  [ADVICE_TOPIC]: 'ui.talk.topic.advice',
  [BOAT_TOPIC]: 'ui.talk.topic.boat',
};

/** Whether a topic id is one of the fourth playtest's, offered like work (not talked through). */
function companyTopic(id: string): boolean {
  return COMPANY_LABELS[id] !== undefined;
}

/**
 * "Ask for advice" from an advisor while there is an aim (Book 10 adviceTrust), and "The boat"
 * from someone whose job is the boat's while its repairs are open (Book 10 "Boat work").
 */
function companyTopics(world: WorldState, ctx: PeopleContext, p: Person): TopicDef[] {
  const cc = ctx.company;
  if (cc === null) return [];
  const out: TopicDef[] = [];
  const topic = (id: string): TopicDef => ({
    id,
    speaker: p.id,
    memory: 'JOB',
    priority: 0,
    labelKey: COMPANY_LABELS[id] ?? id,
    root: '',
    always: true,
  });
  if (isAdvisor(cc, p) && world.aims?.current != null) out.push(topic(ADVICE_TOPIC));
  const job = cc.def.boat.talkers;
  const own = ctx.household.people[p.id];
  const boatHand =
    p.job?.kind === job || own?.job === job || (own?.then ?? []).includes(job as JobKind);
  if (boatHand && boatLine(world, cc, p.id) !== null) out.push(topic(BOAT_TOPIC));
  return out;
}

/** A pressing topic not yet raised: the resident comes to the steerer with it. */
export function pressingTopic(world: WorldState, ctx: PeopleContext, id: Id): TopicDef | null {
  const p = world.people[id];
  if (p === undefined) return null;
  return (
    topicsFor(world, ctx, id).find((t) => t.pressing === true && !p.life.raised.includes(t.id)) ??
    null
  );
}

/** What can be chosen now in the conversation or scene, as string keys (the steerer's words). */
export interface TalkOption {
  readonly key: string;
  readonly kind: 'TOPIC' | 'CHOICE' | 'LEAVE' | 'SCENE';
}

export function talkOptions(
  world: WorldState,
  ctx: PeopleContext,
  search: SearchContext | null = null,
): TalkOption[] {
  const talk = world.talk;
  // Stage 10: a search's words (Bran, Ketill, Runa, the stone).
  if (talk?.kind === 'SEARCH')
    return search === null
      ? []
      : searchOptions(world, search).map((o) => ({ key: o.key, kind: 'CHOICE' as const }));
  if (talk === null || ctx.talk === null) return [];
  if (talk.queue.length > 0 || talk.ending) return [];
  if (talk.kind === 'SCENE') {
    if (talk.chosen !== null) return [];
    const scene = ctx.scenes.find((s) => s.id === talk.scene);
    return (scene?.choices ?? []).map((c) => ({ key: c.key, kind: 'SCENE' as const }));
  }
  if (talk.node !== null)
    return (ctx.talk.nodes[talk.node]?.choices ?? []).map((c) => ({
      key: c.key,
      kind: 'CHOICE' as const,
    }));
  const topics: TalkOption[] = talk.topics.map((id) => ({
    key: ctx.talk?.topics.find((t) => t.id === id)?.labelKey ?? COMPANY_LABELS[id] ?? id,
    kind: 'TOPIC' as const,
  }));
  return [...topics, { key: 'ui.talk.leave', kind: 'LEAVE' }];
}

/** Says a line in the conversation: on screen, and in the speaker's voice. */
function speak(talk: TalkState, speaker: Id | null, key: string, emit: Emit): void {
  talk.line = { speaker, key };
  if (speaker === null) emit({ type: 'TALK_INFO', key });
  else emit({ type: 'PERSON_SPOKE', person: speaker, lineKey: key });
}

/** Opens a conversation (Book 8 section 09). Returns a refusal, or null. */
export function startTalk(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  id: Id,
  emit: Emit,
): 'ASLEEP' | 'BUSY' | null {
  const p = world.people[id];
  if (p === undefined || world.talk !== null) return 'BUSY';
  const act = activityOf(world, camp, ctx, id);
  if (act.kind === 'SLEEP' || act.kind === 'BED') return act.kind === 'BED' ? null : 'ASLEEP';
  const topics = topicsFor(world, ctx, id).map((t) => t.id);
  const talk: TalkState = {
    kind: 'TALK',
    with: id,
    node: null,
    topics,
    topic: null,
    queue: [],
    nextLineTick: world.tick,
    line: null,
    chosen: null,
    ending: false,
    since: world.tick,
  };
  world.talk = talk;
  // A real conversation is time spent (Book 10 "Friendship from care and time").
  timeSpent(world, ctx, p);
  for (const t of topics) if (!p.life.raised.includes(t)) p.life.raised.push(t);
  emit({ type: 'TALK_STARTED', person: id, kind: 'TALK' });
  const greeting = greetingFor(world, ctx, camp, p);
  if (greeting !== null) speak(talk, id, greeting, emit);
  return null;
}

/** Ends the conversation, with the speaker's exit line (Book 8 section 09: back to their work). */
export function endTalk(world: WorldState, ctx: PeopleContext, emit: Emit, quiet = false): void {
  const talk = world.talk;
  if (talk === null) return;
  world.talk = null;
  if (talk.kind === 'TALK' && !quiet) {
    const exit = ctx.talk?.people[talk.with]?.exit;
    if (exit !== undefined) emit({ type: 'PERSON_SPOKE', person: talk.with, lineKey: exit });
  }
  emit({ type: 'TALK_ENDED', person: talk.with });
}

/** A reply's effect (Book 10 "Conversation replies"). */
export function applyReply(
  world: WorldState,
  ctx: PeopleContext,
  p: Person,
  reply: ChoiceDef['reply'],
  emit: Emit,
): void {
  const r = ctx.b.replies[reply];
  if (r.happiness !== 0) treat(world, ctx, p, r.happiness);
  if (r.friendship !== 0 && reply !== 'Talk') p.friendship += r.friendship;
  if (reply === 'Threat') {
    p.fear += ctx.b.fear.threat;
    p.friendship += slight(ctx.b, p, ctx.b.fear.threatFriendship);
    p.life.fearDay = world.calendar.day;
  } else if (r.fear) {
    p.fear += ctx.b.fear.punished;
    p.life.fearDay = world.calendar.day;
  }
  clampMeasures(p);
  checkFeelings(world, ctx, p, emit);
}

/**
 * Gives a resident a job (delegation): the outcome to work at. Returns why not, or null. REST is
 * for the day it is given; told to rest, a resident who dislikes it minds.
 */
export function assignJob(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  id: Id,
  job: JobKind,
  emit: Emit,
): JobRefusal | null {
  const p = world.people[id];
  const refuse = (reason: JobRefusal): JobRefusal => {
    emit({ type: 'JOB_REFUSED', person: id, job, reason });
    return reason;
  };
  if (p === undefined || !world.household.residents.includes(id)) return refuse('NOT_A_RESIDENT');
  const def = ctx.household.jobs[job];
  if (def === undefined || !jobOpen(world, camp, def)) return refuse('NO_SUCH_JOB');
  if (job !== 'REST' && p.wounds.some((w) => w.severity === 'GRAVE')) return refuse('BED_BOUND');
  if (p.life.refuses.includes(job)) return refuse('REFUSES');
  if (p.job?.kind === job && job !== 'REST') return refuse('ALREADY');
  p.job = { kind: job, since: world.calendar.day, byOrder: true };
  if (job === 'REST') meet(world, p, 'TOLD_TO_REST');
  else meet(world, p, 'TRUSTED');
  emit({ type: 'JOB_ASSIGNED', person: id, job });
  return null;
}

/**
 * The words a conversation's option `index` opens instead of its topic (the user's fourth playtest,
 * DH-22: Hild's "Your father's rites"), or null for an ordinary option.
 */
export function talkOpensWords(
  world: WorldState,
  ctx: PeopleContext,
  index: number,
): string | null {
  const talk = world.talk;
  if (talk?.kind !== 'TALK' || talk.node !== null || ctx.talk === null) return null;
  const option = talkOptions(world, ctx)[index];
  if (option?.kind !== 'TOPIC') return null;
  const id = talk.topics[index];
  return ctx.talk.topics.find((t) => t.id === id)?.opens ?? null;
}

/**
 * The steerer chooses option `index` in the conversation. `tend` starts tending the speaker's
 * wound (the simulation's hands-on action); it ends the talk.
 */
export function chooseTalk(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  index: number,
  emit: Emit,
  tend: (id: Id) => void,
): void {
  const talk = world.talk;
  if (talk?.kind !== 'TALK' || ctx.talk === null) return;
  const options = talkOptions(world, ctx);
  const option = options[index];
  if (option === undefined) return;
  const p = world.people[talk.with];
  if (p === undefined) return;
  if (option.kind === 'LEAVE') {
    endTalk(world, ctx, emit);
    return;
  }
  if (option.kind === 'TOPIC') {
    const id = talk.topics[index];
    // The fourth playtest's (DH-55, DH-62): the advice, a line or three in turn; the boat's need.
    const cc = ctx.company;
    if (cc !== null && id !== undefined && companyTopic(id)) {
      const lines =
        id === ADVICE_TOPIC
          ? adviceLines(world, cc, talk.with)
          : [boatLine(world, cc, talk.with)].filter((k): k is string => k !== null);
      const [first, ...rest] = lines;
      if (first === undefined) return;
      speak(talk, talk.with, first, emit);
      talk.queue.push(...rest.map((key) => ({ speaker: talk.with, key })));
      talk.nextLineTick = world.tick + Math.round(LINE_SECONDS * ctx.ticksPerSecond);
      return;
    }
    const topic = ctx.talk.topics.find((t) => t.id === id);
    if (topic === undefined || id === undefined) return;
    talk.topic = id;
    talk.node = topic.root;
    p.life.topics[id] = world.calendar.day;
    const node = ctx.talk.nodes[topic.root];
    if (node !== undefined) speak(talk, talk.with, node.line, emit);
    return;
  }
  const node = talk.node === null ? undefined : ctx.talk.nodes[talk.node];
  const choice = node?.choices[index];
  if (choice === undefined) return;
  applyReply(world, ctx, p, choice.reply, emit);
  const lines = ctx.talk.people[talk.with]?.jobs;
  if (choice.act === 'TEND' || choice.act === 'TEND_PERSUADED') {
    // The user's fourth playtest (DH-41, DH-42): one whose trait makes them refuse another's hand
    // says so, and is offered the steerer's answers; holding the end while they bind it, or asking
    // on a later day, and they let it be done.
    const cc = ctx.company;
    const refuser = cc === null ? null : refuserOf(cc, p);
    if (cc !== null && refuser !== null) {
      if (choice.act === 'TEND_PERSUADED') {
        carePersuaded(world, cc, p);
        emit({ type: 'PERSON_SPOKE', person: talk.with, lineKey: refuser.persuaded });
      } else {
        const answer = careAnswer(world, cc, p);
        if (answer === 'REFUSE') {
          // The wound is not seen to: its topic stays on offer (Book 10 topicRest).
          if (talk.topic !== null) Reflect.deleteProperty(p.life.topics, talk.topic);
          talk.node = refuser.node;
          speak(talk, talk.with, refuser.refuse, emit);
          return;
        }
        if (answer === 'LATER')
          emit({ type: 'PERSON_SPOKE', person: talk.with, lineKey: refuser.later });
      }
    }
    endTalk(world, ctx, emit, true);
    tend(talk.with);
    return;
  }
  if (choice.act?.startsWith('JOB:') === true) {
    const job = choice.act.slice(4) as JobKind;
    const why = assignJob(world, ctx, camp, talk.with, job, emit);
    const key =
      why === null
        ? job === 'REST'
          ? lines?.REST
          : lines?.ACCEPT
        : why === 'BED_BOUND'
          ? lines?.UNABLE
          : why === 'REFUSES'
            ? lines?.REFUSE
            : lines?.ACCEPT;
    if (key !== undefined) speak(talk, talk.with, key, emit);
  }
  if (choice.next !== undefined) {
    talk.node = choice.next;
    const next = ctx.talk.nodes[choice.next];
    if (next !== undefined) speak(talk, talk.with, next.line, emit);
    return;
  }
  // The topic is talked through: back to the others (their work stays on offer), or done.
  talk.node = null;
  const done = ctx.talk.topics.find((t) => t.id === talk.topic);
  if (done?.memory !== 'JOB') talk.topics = talk.topics.filter((t) => t !== talk.topic);
  talk.topic = null;
  if (
    talk.topics.every(
      (id) => companyTopic(id) || ctx.talk?.topics.find((t) => t.id === id)?.memory === 'JOB',
    )
  )
    endTalk(world, ctx, emit);
}

/**
 * Each tick: a conversation's queued lines play in turn; a conversation ends when the steerer
 * walks away or the resident falls asleep.
 */
export function talkTick(
  world: WorldState,
  ctx: PeopleContext,
  tile: number,
  reachTiles: number,
  emit: Emit,
): void {
  const talk = world.talk;
  if (talk === null) return;
  if (talk.queue.length > 0 && world.tick >= talk.nextLineTick) {
    const line = talk.queue.shift();
    if (line !== undefined) speak(talk, line.speaker === '' ? null : line.speaker, line.key, emit);
    talk.nextLineTick = world.tick + Math.round(LINE_SECONDS * ctx.ticksPerSecond);
    return;
  }
  if (talk.ending && talk.queue.length === 0 && world.tick >= talk.nextLineTick) {
    endTalk(world, ctx, emit, true);
    return;
  }
  if (talk.kind === 'TALK') {
    const far = tilesFromSteerer(world, talk.with, tile) > reachTiles * 2;
    const asleep = !world.player.awake || world.onFoot?.player.sleep != null;
    if (far || asleep) endTalk(world, ctx, emit, true);
  }
}

/** Seconds between a conversation's or scene's queued lines (time to read them). */
export const LINE_SECONDS = 2.5;

/**
 * Barks (Book 8 section 08), each tick: a resident in earshot says a line owed by the warning flow
 * first, comes to raise a pressing topic, or, when their time comes, barks by category priority.
 */
export function barkTick(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  tile: number,
  ids: readonly Id[],
  emit: Emit,
): void {
  if (ctx.talk === null || !world.player.awake || world.onFoot?.player.sleep != null) return;
  // An exchange among the household is being spoken: barks wait for it (Book 10 exchangeQuiet).
  if (exchangeUnderWay(world)) return;
  // The opening and the lead to the broch have their own lines (Book 4 Chapter 1 beats 1 and 2).
  if (world.facts[FACT_AT_BROCH] !== true) return;
  const t = ctx.b.talk;
  const tps = ctx.ticksPerSecond;
  for (const id of ids) {
    const p = world.people[id];
    if (p === undefined || p.life.joinedDay === null) continue;
    if (world.talk !== null) return;
    const d = tilesFromSteerer(world, id, tile);
    if (d > t.earshotTiles) continue;
    const act = activityOf(world, camp, ctx, id);
    if (act.kind === 'SLEEP' || act.kind === 'TALK' || act.kind === 'SCENE') continue;
    const owed = p.life.owed[0];
    if (
      owed !== undefined &&
      world.tick >= p.life.nextBark - (ctx.b.talk.barkEverySeconds[0] * tps) / 2
    ) {
      p.life.owed.shift();
      say(world, id, owed, 'WARNING', emit);
      p.life.nextBark = world.tick + nextInt(world.rng.people, ...t.barkEverySeconds) * tps;
      continue;
    }
    const pressing = pressingTopic(world, ctx, id);
    if (pressing !== null && d <= t.approachTiles) {
      p.life.raised.push(pressing.id);
      emit({ type: 'RESIDENT_APPROACHED', person: id, topic: pressing.id });
      continue;
    }
    if (world.tick < p.life.nextBark) continue;
    p.life.nextBark = world.tick + nextInt(world.rng.people, ...t.barkEverySeconds) * tps;
    const lines = (ctx.talk.people[id]?.barks ?? []).filter((b) => {
      if (!fits(world, ctx, camp, p, b)) return false;
      const mine = world.barks.bySpeaker[id]?.[b.key];
      if (mine !== undefined && world.tick - mine < t.sameSpeakerSeconds * tps) return false;
      const any = world.barks.byLine[b.key];
      return any === undefined || world.tick - any >= t.sameLineSeconds * tps;
    });
    for (const category of BARK_PRIORITY) {
      const choice = lines.filter((b) => b.category === category);
      if (choice.length === 0) continue;
      const bark = pick(world.rng.people, choice);
      say(world, id, bark.key, category, emit);
      break;
    }
  }
}

/** Book 8 section 08: danger, orders, wounds, discoveries, reactions, then the everyday. */
export const BARK_PRIORITY = [
  'DANGER',
  'ORDER',
  'WOUND',
  'DISCOVERY',
  'REACTION',
  'WORK',
  'WEATHER',
  'IDLE',
] as const;

function say(world: WorldState, id: Id, key: string, category: string, emit: Emit): void {
  const mine = (world.barks.bySpeaker[id] ??= {});
  mine[key] = world.tick;
  world.barks.byLine[key] = world.tick;
  emit({ type: 'PERSON_SPOKE', person: id, lineKey: key, bark: category });
}
