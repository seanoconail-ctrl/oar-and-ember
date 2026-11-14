/**
 * The Year 1 secrets as side aims (Stage 14, decision S14-25; Book 2 section 16, "Aims, hints and
 * the journal"; Book 8 section 13, "Year 1 secrets on Skarvholm"; `content/puzzles.json`
 * `sideAims`). The current aim stays the journal's one line (DE-23); a side aim is given in speech
 * by its resident when its moment comes and the resident is in earshot, is then listed under the
 * current aim, and has two hints on the Chapter 1 rules. Its stuck-help clock runs only while the
 * steerer is in its scene, and never in a fight, a scene or a talk: Book 10's stuckFirst, then
 * stuckSecond more, and each hint waits for its speaker to be in earshot.
 *
 * State is in the world's facts: `aim.side.<id>` (GIVEN or DONE), `.clock` (game minutes in its
 * scene since it was given or last hinted) and `.hints` (how many given). Pure and deterministic.
 */
import type { SideAimDef } from '../../content/islandSchema.ts';
import type { Id } from '../../core/ids.ts';
import { holds } from '../land/islandConditions.ts';
import type { IslandContext } from '../land/islandConditions.ts';
import type { WorldState } from '../world.ts';

export interface SideAimEvent {
  readonly type: 'SIDE_AIM';
  readonly aim: string;
  readonly state: 'GIVEN' | 'DONE';
  readonly journalKey: string;
}

export interface SideAimSpeech {
  readonly type: 'PERSON_SPOKE';
  readonly person: Id;
  readonly lineKey: string;
  readonly bark?: string;
}

export interface SideAimHooks {
  /** Whether this resident is in the household and within earshot of the steerer now. */
  readonly inEarshot: (person: Id) => boolean;
  /** A fight, a scene or a talk is under way: no aim is given or hinted. */
  readonly quiet: boolean;
}

const fact = (a: SideAimDef, part = ''): string => `aim.side.${a.id}${part}`;

/** The side aims given and not done, to list under the current aim (their journal keys). */
export function openSideAims(world: WorldState, ctx: Pick<IslandContext, 'puzzles'>): string[] {
  return ctx.puzzles.sideAims.filter((a) => world.facts[fact(a)] === 'GIVEN').map((a) => a.journalKey);
}

/** One game minute of the side aims: done ones closed, due ones given, stuck ones hinted. */
export function sideAimsMinute(
  world: WorldState,
  ctx: IslandContext,
  hooks: SideAimHooks,
  emit: (e: SideAimEvent | SideAimSpeech) => void,
): void {
  for (const a of ctx.puzzles.sideAims) {
    const state = world.facts[fact(a)];
    if (state === 'DONE') continue;
    if (a.doneWhen.every((c) => holds(world, ctx, c))) {
      world.facts[fact(a)] = 'DONE';
      if (state === 'GIVEN') emit({ type: 'SIDE_AIM', aim: a.id, state: 'DONE', journalKey: a.journalKey });
      continue;
    }
    if (hooks.quiet) continue;
    if (state === undefined) {
      if (!a.givenWhen.every((c) => holds(world, ctx, c)) || !hooks.inEarshot(a.speaker)) continue;
      world.facts[fact(a)] = 'GIVEN';
      world.facts[fact(a, '.clock')] = 0;
      world.facts[fact(a, '.hints')] = 0;
      emit({ type: 'PERSON_SPOKE', person: a.speaker, lineKey: a.givenKey });
      emit({ type: 'SIDE_AIM', aim: a.id, state: 'GIVEN', journalKey: a.journalKey });
      continue;
    }
    // The stuck-help clock runs only in the aim's scene (S14-25).
    if (world.onFoot?.zone !== a.scene) continue;
    const clock = Number(world.facts[fact(a, '.clock')] ?? 0) + 1;
    const given = Number(world.facts[fact(a, '.hints')] ?? 0);
    world.facts[fact(a, '.clock')] = clock;
    const due = given === 0 ? ctx.stuck.firstMinutes : ctx.stuck.secondMinutes;
    const hint = a.hints[Math.min(given, a.hints.length - 1)];
    if (given >= a.hints.length || clock < due || hint === undefined) continue;
    if (!hooks.inEarshot(hint.speaker)) continue;
    world.facts[fact(a, '.hints')] = given + 1;
    world.facts[fact(a, '.clock')] = 0;
    emit({ type: 'PERSON_SPOKE', person: hint.speaker, lineKey: hint.textKey });
  }
}
