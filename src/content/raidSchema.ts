/**
 * The content of the user's request "give the player a reason to make the first raid" (decisions
 * DH-130 to DH-159), and its validator, for `content/raid.json`:
 *
 * - **Needs**: the household's lines about what it lacks (iron, grain, cloth, salt), as barks tied
 *   to what the speaker is doing and as talk topics; the morning report's grain count and the one
 *   thing that ran low each day.
 * - **The mainland pointed out** from the Hag's Seat on a clear day.
 * - **The skin boat**: the wreck-scavengers came from Carrick by skin boat (the skiff in Seal Cave);
 *   its goods (Carrick grain, nails, a net) and its words when looked into.
 * - **Asking where they came from**: a choice added to the scavengers' parleys, and words with a
 *   beaten scavenger (begging or downed) at the steerer's mercy.
 * - **The council at the fire** before the launch: the household's counsel and the four intents.
 * - **Carrick** (Stage 15 and 16's data): how each intent sets the raid's plan, and what each
 *   resident says at the landing and after, by whether the raid went as the council said.
 *
 * The talks here have the shape of the searches' talks (content/searches.json) and play the same
 * way (src/sim/narrative/searches.ts). This file stands alone (no import of registry.ts), as
 * companySchema.ts does. Every number is Book 10's (section 22, "Reasons for the first raid").
 */
import { aimCondition } from './aimSchema.ts';
import type { AimCondition } from './aimSchema.ts';
import { arrayOf, bool, int, object, oneOf, recordOf, ref, text } from './schema.ts';
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
          path,
          reason: `expected a number from ${min} to ${max}`,
        }),
        null);

/** The four things the household lacks from day 1 (Book 10 needs). */
export const NEEDS = ['IRON', 'GRAIN', 'CLOTH', 'SALT'] as const;
export type Need = (typeof NEEDS)[number];
/** A topic's subject: a need, or Carrick once a clue names it. */
export const NEED_TOPICS = [...NEEDS, 'CARRICK'] as const;
/** The four intents the steerer can choose at the council (the user's words). */
export const INTENTS = ['QUIET', 'THREAT', 'TRADE', 'FORCE'] as const;
export type Intent = (typeof INTENTS)[number];
/** The talks' actions this file adds to the searches' (registry.ts SEARCH_ACTIONS). */
export const RAID_ACTIONS = [
  'ASK_HOME',
  'TAKE_GOODS',
  'COUNCIL_QUIET',
  'COUNCIL_THREAT',
  'COUNCIL_TRADE',
  'COUNCIL_FORCE',
] as const;
/** The talks' conditions this file adds (registry.ts SEARCH_WHEN). */
export const RAID_WHEN = ['GOODS_THERE'] as const;
/** What a need line or a low may wait on, beyond an aim condition. */
export const SPECIALS = [
  /** Yesterday's catch was poor (Book 10 poorCatch). */
  'POOR_CATCH',
  /** Fish were landed yesterday (and there is no salt to keep them). */
  'CAUGHT',
  /** No clean linen: no bindings in hand. */
  'NO_LINEN',
  /** No clean linen, and someone of the household is wounded. */
  'WOUNDED_NO_LINEN',
  /** Thorkel's chart is in the household's hands (his chest opened). */
  'CHART',
] as const;
export type Special = (typeof SPECIALS)[number];
/** A resident's activity (registry.ts ACTIVITY_KINDS, awake). */
const ACTIVITIES = [
  'MEAL',
  'WORK',
  'EVENING',
  'TENDENCY',
  'SIT',
  'REST',
  'REFUSE',
  'DARK',
  'WATCH',
  'TENDED',
] as const;
const REPLY_KINDS = ['Talk', 'Warm', 'Glad', 'Cold', 'Punished', 'Shamed', 'Threat'] as const;
const FACINGS = ['s', 'n', 'e', 'w'] as const;
const VALUES = ['GAIN', 'MERCY', 'GLORY', 'KIN', 'FAITH', 'WORD'] as const;
/** Book 6 section 02's modes, approaches and preparation advantages (Book 2 section 11, RaidPlan). */
const MODES = ['STEALTH', 'ASSAULT'] as const;
const APPROACHES = ['STEAL', 'BARGAIN', 'THREATEN', 'FIGHT', 'ASSAULT'] as const;
const ADVANTAGES = ['SCOUT', 'TRADE_GOODS', 'EXTRA_ARMS'] as const;
const TIMINGS = ['DAWN', 'DAY', 'DUSK', 'NIGHT'] as const;
const INTEL = ['PLACE', 'STOREHOUSE', 'GRAIN', 'IRON', 'FEW_SPEARS', 'MAINLAND'] as const;
/** Where a Carrick clue comes from. */
export const CLUE_SOURCES = ['CHART', 'BOAT', 'TOLD', 'SEEN'] as const;
export type ClueSource = (typeof CLUE_SOURCES)[number];

const when = arrayOf(aimCondition);
const lineWhen = {
  activity: oneOf(ACTIVITIES),
  special: oneOf(SPECIALS),
  when,
  fromDay: int(1, 999),
};
const LINE_OPTIONAL = ['activity', 'special', 'when', 'fromDay'] as const;

const barkCheck = object(
  { key: ref('string'), speaker: ref('person'), need: oneOf(NEEDS), ...lineWhen },
  LINE_OPTIONAL,
);
const lowCheck = object(
  { id: text, need: oneOf(NEEDS), key: ref('string'), ...lineWhen },
  LINE_OPTIONAL,
);
const topicCheck = object({
  id: text,
  speaker: ref('person'),
  about: oneOf(NEED_TOPICS),
  priority: int(0, 9),
  labelKey: ref('string'),
  root: text,
});
const choiceCheck = object(
  { key: ref('string'), reply: oneOf(REPLY_KINDS), next: text, end: bool },
  ['next', 'end'],
);
const nodeCheck = object({ line: ref('string'), choices: arrayOf(choiceCheck) });
const ALL_ACTIONS = ['LEAVE', ...RAID_ACTIONS] as const;
const talkChoiceCheck = object(
  {
    key: ref('string'),
    when: oneOf(RAID_WHEN),
    reply: arrayOf(ref('string')),
    do: oneOf(ALL_ACTIONS),
    once: bool,
  },
  ['when', 'reply', 'do', 'once'],
);
const talkCheck = object({
  id: text,
  with: text,
  reachTiles: fraction(0.5, 4),
  promptKey: ref('string'),
  open: ref('string'),
  choices: arrayOf(talkChoiceCheck),
});
const xy = object({ x: fraction(0, 512), y: fraction(0, 512) });
const spoken = object({ person: ref('person'), key: ref('string') });

export const raidCheck = object({
  about: text,
  barks: arrayOf(barkCheck),
  topics: arrayOf(topicCheck),
  nodes: recordOf(text, nodeCheck),
  report: object({
    grainDays: ref('string'),
    grainOne: ref('string'),
    grainNone: ref('string'),
    storms: ref('string'),
  }),
  lows: arrayOf(lowCheck),
  pointOut: object({
    zone: ref('zone'),
    /** Who points, in order of preference, with their line. */
    speakers: arrayOf(spoken),
    /** The information line with the smoke's direction. */
    caption: ref('string'),
    /** The way they turn to point (the Irish coast). */
    facing: oneOf(FACINGS),
  }),
  skinBoat: object({
    zone: ref('zone'),
    /** The goods, one load carried home (ITEM_ id). */
    goods: text,
    /** Where the boat's words are opened, at the boat (tiles). */
    look: xy,
    talk: talkCheck,
    info: object({
      sack: ref('string'),
      nails: ref('string'),
      mark: ref('string'),
      unmarked: ref('string'),
      empty: ref('string'),
    }),
    /** Said when the goods are set down at the camp, by the first of these at home. */
    stored: arrayOf(spoken),
    /** The information line when the goods go into the stores. */
    storedCaption: ref('string'),
  }),
  ask: object({
    /** The choice added to each scavenger's parley talk, by talk id. */
    parleys: recordOf(text, talkChoiceCheck),
    /** The words with a beaten scavenger, by scavenger. */
    beaten: recordOf(text, talkCheck),
  }),
  clues: object({
    /** Oddi, with Thorkel's chart in hand, as a clue comes in. */
    confirm: spoken,
    /** Oddi reads the chart when the chest is opened. */
    chart: spoken,
    /** What each source tells of Carrick (Book 6 section 02, Known intel). */
    tells: recordOf(oneOf(CLUE_SOURCES), arrayOf(oneOf(INTEL))),
  }),
  council: object({
    talk: talkCheck,
    zone: ref('zone'),
    /** Where the steerer calls the council: the middle of the circle round the fire (tiles). */
    call: xy,
    /** Where each resident sits round the fire (tiles), in the household's order. */
    spots: arrayOf(object({ x: fraction(0, 512), y: fraction(0, 512), facing: oneOf(FACINGS) })),
    /** The counsel, in the order it is spoken; each line's speaker must be there. */
    counsel: arrayOf(
      object(
        {
          person: ref('person'),
          key: ref('string'),
          /** What they argue for (remembered as `council.said.<person>`). */
          says: text,
          /**
           * Spoken only if: NO_BOAT, the boat's clue is not yet known (and then it is: Oddi went
           * through their boat); CHART, Thorkel's chart is read; NO_CHART, it is not.
           */
          when: oneOf(['NO_BOAT', 'CHART', 'NO_CHART'] as const),
        },
        ['when'],
      ),
    ),
    /** Hild's question to the steerer, after the counsel. */
    ask: ref('string'),
    intents: recordOf(
      oneOf(INTENTS),
      object({
        heard: arrayOf(ref('person')),
        overruled: arrayOf(ref('person')),
        reactions: recordOf(text, ref('string')),
      }),
    ),
  }),
  carrick: object({
    /** How each intent sets the plan Stage 15's screen opens with (Book 6 section 02). */
    plan: recordOf(
      oneOf(INTENTS),
      object({
        mode: oneOf(MODES),
        approach: oneOf(APPROACHES),
        advantage: oneOf(ADVANTAGES),
        timing: oneOf(TIMINGS),
      }),
    ),
    /** What each resident says at Carrick (Stage 16): at the landing by intent, and after. */
    reactions: recordOf(
      text,
      object({
        landing: recordOf(oneOf(INTENTS), ref('string')),
        kept: ref('string'),
        harder: ref('string'),
        softer: ref('string'),
      }),
    ),
    /** The approaches from gentlest to hardest, to judge harder and softer (Stage 16). */
    hardness: arrayOf(oneOf(APPROACHES)),
    /** The value a resident weighs a broken intent by (Book 10 intentBroken). */
    wordValue: oneOf(VALUES),
  }),
});

export type RaidDef = NonNullable<Out<typeof raidCheck>>;
export type RaidTalkDef = RaidDef['council']['talk'];
export type NeedBark = RaidDef['barks'][number];
export type NeedLow = RaidDef['lows'][number];
export type { AimCondition };

/** Validates content/raid.json; null when absent or invalid (the issues say why). */
export function parseRaid(json: unknown, path: string, ctx: Parameters<Check<unknown>>[2]) {
  if (json === undefined || json === null) return null;
  return raidCheck(json, path, ctx);
}
