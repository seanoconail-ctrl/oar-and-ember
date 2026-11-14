/**
 * The user's fourth playtest's people content (decisions DH-40 onwards), and its validators:
 *
 * - `content/company.json`: the hours a resident keeps by their traits and likes (request 13), who
 *   refuses a binding and how they come round (request 9), the household's short exchanges among
 *   themselves (request 10), and what each says the boat needs next (request 14).
 * - `content/guidance.json`: the household's nudges towards the current aim and the answers to
 *   "Ask for advice", by aim and speaker (requests 11 and 12). Any chapter's aims gain lines here.
 *
 * Every number these systems use is Book 10's (section 08), read by src/content/companyBalance.ts.
 */
import { aimCondition } from './aimSchema.ts';
import type { AimCondition } from './aimSchema.ts';
import { arrayOf, int, object, oneOf, recordOf, ref, text } from './schema.ts';
import type { Check } from './schema.ts';

type Out<C> = C extends Check<infer T> ? T : never;

/** Book 2 section 06's traits (as registry.ts's TRAITS; repeated so this file stands alone). */
const TRAIT_NAMES = [
  'BERSERK',
  'COWARDLY',
  'SUPERSTITIOUS',
  'BRAVE',
  'GREEDY',
  'PIOUS',
  'HOT_TEMPERED',
  'GENTLE',
  'DRINKER',
  'LIGHT_FINGERED',
  'KEEN_EYED',
  'SEA_SICK',
  'STORYTELLER',
  'GRUDGE_HOLDER',
  'DILIGENT',
  'LAZY',
] as const;
const TIE_NAMES = [
  'KIN',
  'FRIEND',
  'RIVAL',
  'SPOUSE',
  'DEBT',
  'GRIEVANCE',
  'OATH',
  'MENTOR',
] as const;
/** The activities an exchange may be held at (Book 2 section 06's activity kinds, awake). */
const AWAKE = [
  'MEAL',
  'WORK',
  'EVENING',
  'TENDENCY',
  'SIT',
  'REST',
  'REFUSE',
  'DARK',
  'WATCH',
] as const;
/** What the boat needs next (Book 10 section 08, "Boat work"). */
export const BOAT_NEEDS = [
  'BOARDS',
  'HULL_WORK',
  'RIGGING_FETCH',
  'RIGGING_WORK',
  'OAR_FETCH',
  'OAR_CARVING',
  'OAR_SHIP',
  'FIT',
  'READY',
] as const;
export type BoatNeed = (typeof BOAT_NEEDS)[number];

const exchangeCheck = object(
  {
    id: text,
    /** Two or three residents; lines name them by their place in this list. */
    speakers: arrayOf(ref('person')),
    lines: arrayOf(object({ by: int(0, 2), key: ref('string') })),
    /** A tie between the first two speakers (Book 5 section 17). */
    tie: oneOf(TIE_NAMES),
    /** Traits the speakers must have, by their place. */
    traits: arrayOf(object({ by: int(0, 2), trait: oneOf(TRAIT_NAMES) })),
    /** What every speaker must be doing (any awake activity when absent). */
    activity: arrayOf(oneOf(AWAKE)),
    /** What must hold in the world: an event, a story fact (the aims' conditions). */
    when: arrayOf(aimCondition),
    /** A memory a speaker must hold (a death, a deed, an event). */
    memory: object({ by: int(0, 2), kind: text, about: text }),
  },
  ['tie', 'traits', 'activity', 'when', 'memory'],
);

const refuserCheck = object({
  /** The trait that makes them refuse (Book 5 section 17), and the resident it is written for. */
  trait: oneOf(TRAIT_NAMES),
  person: ref('person'),
  refuse: ref('string'),
  persuaded: ref('string'),
  still: ref('string'),
  later: ref('string'),
  /** Their talk node offering the steerer's answers to the refusal (content/talk.json). */
  node: text,
});

const companyCheck = object({
  about: text,
  hours: object({
    /** Traits that rise before the household (Book 10 earlyRise). */
    early: arrayOf(oneOf(TRAIT_NAMES)),
    /** Traits and likes that keep someone at the fire after the household's bedtime (lateFire). */
    late: object({ traits: arrayOf(oneOf(TRAIT_NAMES)), likes: arrayOf(text) }),
  }),
  care: object({ refusers: arrayOf(refuserCheck) }),
  exchanges: arrayOf(exchangeCheck),
  boat: object({
    /** The job whose workers can be asked about the boat. */
    talkers: text,
    lines: recordOf(oneOf(BOAT_NEEDS), recordOf(text, ref('string'))),
  }),
});

const guidanceCheck = object(
  {
    about: text,
    /** Who answers "Ask for advice" always; others answer when trusted (Book 10 adviceTrust). */
    advisors: object({ always: arrayOf(ref('person')) }),
    /** By aim, by speaker: the lines they nudge with (and answer advice with). */
    nudges: recordOf(text, recordOf(text, arrayOf(ref('string')))),
    /**
     * By aim, a later stage of it (the final pass, DH-164): once its conditions hold, its lines
     * are said in place of the aim's own (the stores cut down from the mast: carry them home).
     */
    stages: recordOf(
      text,
      arrayOf(
        object({ when: arrayOf(aimCondition), nudges: recordOf(text, arrayOf(ref('string'))) }),
      ),
    ),
    /** By advisor: the line that opens their advice, and the one when nothing is pressing. */
    advice: recordOf(text, object({ intro: ref('string'), none: ref('string') })),
  },
  ['stages'],
);

export const parseCompany = companyCheck;
export const parseGuidance = guidanceCheck;
export type CompanyDef = Out<typeof companyCheck>;
export type GuidanceDef = Out<typeof guidanceCheck>;
export type ExchangeDef = CompanyDef['exchanges'][number];
export type { AimCondition };
