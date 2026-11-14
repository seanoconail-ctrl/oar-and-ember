/**
 * The wreck on Sgeir Dhubh (Stage 13, work package C; decisions S13-40 to S13-59; Book 6 section
 * 19), and its validator, for `content/wreck.json`:
 *
 * - **The scene**: the scenario it is (`SCN_SEA_WRECK`), the zone it is played in, the route it is
 *   met on, who asks the question at the boat (Hild) and where the boat's side is.
 * - **The survivors** (Book 5 section 02, "Refugees from the sea"): each a person of the person
 *   model, kept here and not in content/people.json (decision S13-44), with where they are in the
 *   zone, their pose, their wound and their words (each choice's replies, and a fact it sets).
 * - **The question** at the boat: its opening line and the steerer's answers, each with a `do`.
 * - **Reactions**: who says what to each answer; and the words the sea map shows after it.
 *
 * Every number is Book 10's (section 02, "The wreck with survivors"). This file stands alone (no
 * import of registry.ts), as raidSchema.ts and seaSchema.ts do.
 */
import { arrayOf, bool, id, int, object, oneOf, recordOf, ref, text } from './schema.ts';
import type { Check } from './schema.ts';

type Out<C> = C extends Check<infer T> ? T : never;

/** A number in a range (as registry.ts's, repeated so this file stands alone). */
const fraction =
  (min: number, max: number): Check<number> =>
  (v, path, ctx) =>
    typeof v === 'number' && v >= min && v <= max
      ? v
      : (ctx.issues.push({
          file: ctx.file,
          path: path === '' ? '(root)' : path,
          reason: `expected a number from ${min} to ${max}`,
        }),
        null);

/** The four answers to Hild's question (Book 6 section 19). */
export const WRECK_CHOICES = ['ABOARD', 'ASHORE', 'SALVAGE', 'LEAVE'] as const;
export type WreckChoice = (typeof WRECK_CHOICES)[number];
/** What an answer does: one of the four, or close the words for now. */
export const WRECK_DO = [...WRECK_CHOICES, 'NOT_YET', 'TALK_LEAVE'] as const;
/** Reactions are keyed by the answer, and by the gift (Fínán paying for the passage). */
export const WRECK_REACTIONS = [...WRECK_CHOICES, 'GIFT'] as const;
const FACINGS = ['s', 'n', 'e', 'w'] as const;
/** The poses a survivor is placed in (src/sim/land/onFoot.ts Pose). */
const POSES = ['call', 'watch', 'down'] as const;
const VALUES = ['GAIN', 'MERCY', 'GLORY', 'KIN', 'FAITH', 'WORD'] as const;
const ORIGINS = ['NORSE', 'GAELIC', 'NORSE_GAELIC', 'KEEPERS', 'UNSTATED'] as const;
const CODES = ['NORSE', 'GAELIC', 'CHURCH', 'KEEPERS', 'SALTVIK'] as const;
const STANCES = ['CONVENTIONAL', 'SCEPTICAL', 'CYNICAL', 'TRANSGRESSIVE'] as const;
const TRAITS = [
  'BRAVE',
  'PIOUS',
  'GRUDGE_HOLDER',
  'KEEN_EYED',
  'STORYTELLER',
  'DRINKER',
  'GENTLE',
  'SUPERSTITIOUS',
] as const;

const spot = object({ x: fraction(0, 512), y: fraction(0, 512), facing: oneOf(FACINGS) });
const choiceCheck = object(
  {
    key: ref('string'),
    reply: arrayOf(ref('string')),
    do: oneOf(WRECK_DO),
    /** A fact this choice sets true (the reveal heard: `sea.wreck.asked_conn`). */
    fact: text,
  },
  ['reply', 'do', 'fact'],
);
const talkCheck = object({ open: ref('string'), choices: arrayOf(choiceCheck) });
const survivorCheck = object(
  {
    id: id(['C']),
    nameKey: ref('string'),
    at: spot,
    pose: oneOf(POSES),
    origin: oneOf(ORIGINS),
    codes: arrayOf(oneOf(CODES)),
    codeStance: oneOf(STANCES),
    values: recordOf(oneOf(VALUES), int(1, 3)),
    traits: arrayOf(object({ trait: oneOf(TRAITS), known: bool })),
    ties: arrayOf(object({ to: id(['C']), kind: oneOf(['SPOUSE', 'DEBT'] as const) })),
    wound: object({ severity: oneOf(['LIGHT', 'SERIOUS', 'GRAVE'] as const), where: text }),
    talk: talkCheck,
  },
  ['wound', 'ties'],
);
/** Who reacts: a survivor (not in people.json) or one of the household. */
const reactionCheck = object({ person: id(['C']), key: ref('string') });
const wreckCheck = object({
  about: text,
  scenario: id(['SCN']),
  zone: ref('zone'),
  edge: id(['SEA']),
  asker: ref('person'),
  board: object({ x: fraction(0, 512), y: fraction(0, 512) }),
  survivors: arrayOf(survivorCheck),
  ask: talkCheck,
  reactions: recordOf(oneOf(WRECK_REACTIONS), arrayOf(reactionCheck)),
  done: recordOf(oneOf(WRECK_CHOICES), ref('string')),
  /** Where the survivors' word goes (Ardcarn, Book 4 section 01). */
  wordPlace: ref('place'),
});

export type WreckDef = Out<typeof wreckCheck>;
export type WreckSurvivorDef = WreckDef['survivors'][number];
export type WreckTalkDef = WreckDef['ask'];

export function parseWreck(json: unknown, path: string, ctx: Parameters<Check<unknown>>[2]) {
  if (json === undefined || json === null) return null;
  return wreckCheck(json, path, ctx);
}

/** What the wreck must agree with beyond its own shape (checked in registry.ts). */
export function wreckProblems(
  wreck: WreckDef,
  x: { readonly registered: (id: string) => boolean; readonly survivors: number },
): { path: string; reason: string }[] {
  const out: { path: string; reason: string }[] = [];
  if (!x.registered(wreck.scenario))
    out.push({ path: 'scenario', reason: `"${wreck.scenario}" is not in the ID registry` });
  if (!x.registered(wreck.edge))
    out.push({ path: 'edge', reason: `"${wreck.edge}" is not in the ID registry` });
  wreck.survivors.forEach((s, i) => {
    if (!x.registered(s.id))
      out.push({ path: `survivors[${i}].id`, reason: `"${s.id}" is not in the ID registry` });
  });
  // Book 10 section 02, "The wreck with survivors": survivors.
  if (wreck.survivors.length !== x.survivors)
    out.push({
      path: 'survivors',
      reason: `${wreck.survivors.length} survivors; Book 10 says ${x.survivors}`,
    });
  // Every answer is offered, and each has its words after.
  for (const c of ['ABOARD', 'ASHORE', 'SALVAGE', 'LEAVE'] as const) {
    if (!wreck.ask.choices.some((k) => k.do === c))
      out.push({ path: 'ask.choices', reason: `no answer does ${c}` });
  }
  return out;
}
