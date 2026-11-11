/**
 * Typed access to the Book 10 section 08 numbers of people (Stage 8): friendship deltas by deed and
 * their weighing, deed reactions by culture, traits, likes and dislikes, happiness, friendship and
 * fear and their effects, happiness inputs, friendship from care and time, fear deltas, friendship
 * bands, the household day and talk, conversation replies, and the dispute judgements of section
 * 09. Like balance.ts, every value is parsed strictly, so a change of wording fails at load with the
 * table, key and value rather than reading a wrong number.
 */
import { VALUES } from './registry.ts';
import type { CODES, JUDGEMENTS, REPLIES, TRAITS } from './registry.ts';

type Row = Record<string, string>;
export type ValueName = (typeof VALUES)[number];
export type CodeName = (typeof CODES)[number];
export type TraitName = (typeof TRAITS)[number];
export type ReplyName = (typeof REPLIES)[number];
export type JudgementName = (typeof JUDGEMENTS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rows(json: unknown, section: string, table: string): Row[] {
  const tables = isRecord(json) ? json['tables'] : undefined;
  const sec = isRecord(tables) ? tables[section] : undefined;
  const list = isRecord(sec) ? sec[table] : undefined;
  if (!Array.isArray(list)) throw new Error(`balance.json: no table ${section}.${table}`);
  return list as Row[];
}

function fail(where: string, value: string, expected: string): never {
  throw new Error(`balance.json: ${where} is "${value}"; expected ${expected}`);
}

const N = '([+-]?\\d+(?:\\.\\d+)?)';

/** The numbers in `text` matched by `pattern`, or a failure naming where. */
function nums(where: string, text: string, pattern: string, expected: string): number[] {
  const m = new RegExp(pattern).exec(text);
  if (m === null) fail(where, text, expected);
  return m.slice(1).map(Number);
}

function keyed(json: unknown, section: string, table: string, col = 'Value') {
  const list = rows(json, section, table);
  return (key: string): string => {
    const value = list.find((r) => r['Key'] === key)?.[col];
    if (value === undefined) throw new Error(`balance.json: ${section}.${table} has no "${key}"`);
    return value;
  };
}

function byFirst(json: unknown, section: string, table: string, first: string, col: string) {
  const list = rows(json, section, table);
  return (name: string): string => {
    const value = list.find((r) => (r[first] ?? '').startsWith(name))?.[col];
    if (value === undefined)
      throw new Error(`balance.json: ${section}.${table} has no row "${name}"`);
    return value;
  };
}

const SEC = 'peopleSkillsAndWounds';

/** A deed's valence per value point, and whether Faith counts only for the same faith. */
export interface DeedValence {
  readonly valence: Readonly<Record<ValueName, number>>;
  readonly sameFaith: boolean;
}

/** How a culture reads a deed: a factor, and whether it reads it for or against. */
export interface CultureReading {
  readonly factor: number;
  readonly direction: 'for' | 'against' | 'plain';
}

/** Rows of the deed table that have no deed tag, by a key of their own. */
export const UNTAGGED_DEEDS: Readonly<Record<string, string>> = {
  'Captive harmed': 'CAPTIVE_HARMED',
  "Theft from the household's own stores": 'THEFT_OWN_STORES',
  'Resident left behind': 'RESIDENT_LEFT_BEHIND',
  'Crew member died': 'CREW_DIED',
  'Retreat with everyone alive': 'RETREAT_ALL_ALIVE',
};

const CULTURE_COLUMNS: Readonly<Record<CodeName, string>> = {
  NORSE: 'Norse',
  GAELIC: 'Gaels',
  CHURCH: 'Church',
  KEEPERS: 'Keepers',
  SALTVIK: 'Saltvik',
};

export interface Band {
  readonly name: string;
  /** The lowest friendship in the band (the lowest band has -Infinity). */
  readonly from: number;
}

export interface PeopleBalance {
  readonly deeds: ReadonlyMap<string, DeedValence>;
  /** By deed key (the tag, or "KILLING", "SACRILEGE_CHURCH", "SACRILEGE_SHRINE"...). */
  readonly cultures: ReadonlyMap<string, Readonly<Record<CodeName, CultureReading>>>;
  readonly weighing: {
    readonly clamp: number;
    readonly witness: { readonly present: number; readonly told: number; readonly rumour: number };
    /** Glory at this level with no Mercy reads CIVILIAN_KILLED's Glory valence as this. */
    readonly drengrGlory: number;
    readonly drengrValence: number;
  };
  readonly traits: {
    readonly discoverDays: readonly [number, number];
    readonly lightFingeredDays: number;
    readonly diligent: number;
    readonly lazy: number;
    readonly seaSickLand: number;
    readonly storyteller: number;
    readonly gentleKilling: number;
    readonly grudgeSlight: number;
    readonly piousSacrilege: number;
    readonly piousMinutes: number;
  };
  readonly likes: { readonly met: number; readonly dislikeMet: number };
  readonly measures: {
    readonly happinessStart: number;
    readonly friendshipStart: number;
    readonly friendshipStartTie: number;
    readonly fearStart: number;
    /** Work output x (base + span x happiness / 100). */
    readonly workBase: number;
    readonly workSpan: number;
    readonly unhappyBelow: number;
    readonly loyalFrom: number;
    readonly leavesAtOrBelow: number;
    readonly leavesFearBelow: number;
    readonly fearfulFear: number;
    readonly fearfulFriendshipBelow: number;
    readonly fearfulWork: number;
    readonly devotionFear: number;
    readonly devotionFriendship: number;
    readonly devotionGlory: number;
    /** Share of the way to the day's target each game hour, from this base. */
    readonly drift: number;
    readonly happinessBase: number;
    readonly fearDecayPerDay: number;
    readonly warningSpacingDays: number;
  };
  readonly inputs: {
    readonly fed: number;
    readonly hungry: number;
    readonly warmNight: number;
    readonly coldNight: number;
    readonly bed: number;
    readonly safe: number;
    readonly success: { readonly amount: number; readonly days: number };
    readonly grief: { readonly amount: number; readonly days: number };
    readonly festival: { readonly amount: number; readonly days: number };
    readonly treatedWell: readonly [number, number];
    readonly treatedBadly: readonly [number, number];
  };
  readonly care: {
    readonly gift: number;
    readonly giftEveryDays: number;
    readonly time: number;
    readonly timePerDay: number;
    readonly tending: number;
  };
  readonly fear: {
    readonly killing: number;
    readonly civilianKilled: number;
    readonly surrenderedKilled: number;
    readonly punished: number;
    readonly punishWatching: number;
    readonly threat: number;
    readonly threatFriendship: number;
    readonly harming: number;
    readonly harmingFriendship: number;
  };
  /** From the highest band down. */
  readonly bands: readonly Band[];
  readonly talk: {
    readonly earshotTiles: number;
    readonly barkEverySeconds: readonly [number, number];
    readonly sameSpeakerSeconds: number;
    readonly sameLineSeconds: number;
    readonly topicsPerTalk: number;
    readonly topicRestDays: number;
    readonly approachTiles: number;
    readonly lowHappiness: number;
    readonly supervisedTiles: number;
    readonly besideTiles: number;
    readonly lightFingeredTakeRd: number;
  };
  /** Book 10 section 23, voiceThresholds: warmer, colder, afraid. */
  readonly voice: { readonly warm: number; readonly cold: number; readonly afraid: number };
  readonly replies: Readonly<
    Record<
      ReplyName,
      { readonly happiness: number; readonly friendship: number; readonly fear: boolean }
    >
  >;
  readonly judgements: Readonly<
    Partial<
      Record<
        JudgementName,
        {
          readonly favoured: { readonly friendship: number; readonly happiness: number };
          readonly other: {
            readonly friendship: number;
            readonly happiness: number;
            readonly fear: number;
          };
          readonly watching: { readonly friendship: number; readonly fear: number };
          readonly returnsDays?: number;
        }
      >
    >
  >;
}

function cultureKey(deed: string): string | null {
  const tag = /^([A-Z_]+)/.exec(deed)?.[1] ?? '';
  if (deed.startsWith('SACRILEGE at a church')) return 'SACRILEGE_CHURCH';
  if (deed.startsWith('SACRILEGE at an old shrine')) return 'SACRILEGE_SHRINE';
  return tag === '' ? null : tag;
}

function reading(where: string, text: string): CultureReading {
  const m = /^x(\d+(?:\.\d+)?)(?:\s+(for|against))?/.exec(text);
  if (m === null) fail(where, text, '"xN", "xN for" or "xN against"');
  return { factor: Number(m[1]), direction: (m[2] as 'for' | 'against' | undefined) ?? 'plain' };
}

/** A "+N, happiness +M" style cell: the named measures in it. */
function measures(where: string, text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of text.matchAll(/(Friendship|happiness|Fear|friendship)\s*([+-]\d+)/g))
    out[(m[1] ?? '').toLowerCase()] = Number(m[2]);
  if (Object.keys(out).length === 0 && text !== '' && !text.startsWith('Happiness'))
    fail(where, text, 'measures such as "Friendship +6, happiness +5"');
  const h = /^Happiness ([+-]\d+)/.exec(text);
  if (h !== null) out['happiness'] = Number(h[1]);
  return out;
}

const WORD_NUMBERS: Readonly<Record<string, number>> = { One: 1, Two: 2, Three: 3, Four: 4 };

function spacingDays(text: string): number {
  const m = /^(One|Two|Three|Four|\d+) days? between steps/.exec(text);
  if (m === null) fail('warningSpacing', text, '"Two days between steps ..."');
  return WORD_NUMBERS[m[1] ?? ''] ?? Number(m[1]);
}

export function parsePeopleBalance(json: unknown): PeopleBalance {
  const deeds = new Map<string, DeedValence>();
  for (const r of rows(json, SEC, 'friendshipDeltasByDeed')) {
    const name = r['Deed'] ?? '';
    const key = UNTAGGED_DEEDS[name] ?? name;
    const valence = {} as Record<ValueName, number>;
    let sameFaith = false;
    for (const v of VALUES) {
      const col = v.charAt(0) + v.slice(1).toLowerCase();
      const cell = r[col] ?? '';
      const m = /^([+-]?\d+)(\s*\(same faith\))?$/.exec(cell);
      if (m === null) fail(`friendshipDeltasByDeed.${name}.${col}`, cell, 'a whole number');
      valence[v] = Number(m[1]);
      if (m[2] !== undefined) sameFaith = true;
    }
    deeds.set(key, { valence, sameFaith });
  }
  const cultures = new Map<string, Record<CodeName, CultureReading>>();
  for (const r of rows(json, SEC, 'deedReactionsByCulture')) {
    const deed = r['Deed'] ?? '';
    const tags = deed.includes(' / ')
      ? deed.split(' / ').map((d) => d.trim())
      : [cultureKey(deed)].filter((x): x is string => x !== null);
    const read = {} as Record<CodeName, CultureReading>;
    for (const [code, col] of Object.entries(CULTURE_COLUMNS) as [CodeName, string][])
      read[code] = reading(`deedReactionsByCulture.${deed}.${col}`, r[col] ?? '');
    for (const t of tags) cultures.set(t, read);
  }
  const w = keyed(json, SEC, 'deedWeighing');
  const clamp = nums(
    'deedWeighing.deedClamp',
    w('deedClamp'),
    `^-(\\d+) to \\+\\d+`,
    '"-N to +N ..."',
  );
  const drengr = nums(
    'deedWeighing.drengr',
    w('drengr'),
    `^Glory (\\d+) and no Mercy: .* is ${N}$`,
    '"Glory N and no Mercy: ... is N"',
  );
  const one = (key: string): number =>
    nums(`deedWeighing.${key}`, w(key), `^${N}$`, 'a number')[0] ?? 0;

  const trait = byFirst(json, SEC, 'traits', 'Trait', 'Effect');
  const perPerson = keyed(json, SEC, 'traitsPerPerson')('traitsPerPerson');
  const discover = nums(
    'traitsPerPerson',
    perPerson,
    `discovered over (\\d+) to (\\d+) days`,
    '"... discovered over N to M days"',
  );
  const diligent = nums('traits.Diligent', trait('Diligent'), `x${N} / x${N}`, '"x1.1 / x0.85"');
  const pious = trait('Pious');
  const gentle = trait('Gentle');

  const likes = keyed(json, SEC, 'likesAndDislikes');
  const hff = keyed(json, SEC, 'happinessFriendshipAndFear');
  const work = nums(
    'workOutput',
    hff('workOutput'),
    `\\(${N} \\+ ${N} x happiness / 100\\)`,
    '"Output x (A + B x happiness / 100)"',
  );
  const leaves = nums(
    'leaves',
    hff('leaves'),
    `^Friendship ${N} or less with fear below ${N}`,
    '"Friendship -N or less with fear below M ..."',
  );
  const fearful = nums(
    'fearfulObedience',
    hff('fearfulObedience'),
    `^Fear ${N} or more with friendship below ${N}: obeys any order with ${N}% worse`,
    '"Fear N or more with friendship below M: obeys any order with P% worse ..."',
  );
  const devotion = nums(
    'devotion',
    hff('devotion'),
    `^Fear ${N} or more with friendship ${N} or more: .*Glory deeds x${N}`,
    '"Fear N or more with friendship M or more: ... Glory deeds xK"',
  );
  const drift = nums(
    'happinessDrift',
    hff('happinessDrift'),
    `^Moves ${N}% of the way .* from a base of ${N}`,
    '"Moves N% of the way ... from a base of M"',
  );
  const friendshipStart = nums(
    'friendship',
    hff('friendship'),
    `starts at ${N}, or ${N} for a resident with a tie`,
    '"... starts at N, or M for a resident with a tie ..."',
  );

  const input = byFirst(json, SEC, 'happinessInputs', 'Input', "Effect on the day's target");
  const single = (name: string): number =>
    nums(`happinessInputs.${name}`, input(name), `^${N}$`, 'a signed number')[0] ?? 0;
  const lasting = (name: string): { amount: number; days: number } => {
    const [amount = 0, days = 0] = nums(
      `happinessInputs.${name}`,
      input(name),
      `^${N}(?:,)? (?:for|fading over) (\\d+) days`,
      '"+N for D days" or "-N, fading over D days"',
    );
    return { amount, days };
  };
  const range = (name: string): [number, number] => {
    const [a = 0, b = 0] = nums(
      `happinessInputs.${name}`,
      input(name),
      `^${N} to ${N}$`,
      '"A to B"',
    );
    return [a, b];
  };

  const care = byFirst(json, SEC, 'friendshipFromCareAndTime', 'Source', 'Friendship');
  const gift = nums(
    'care.gift',
    care('A gift'),
    `^${N}, at most once per (\\d+) days`,
    '"+N, at most once per D days"',
  );
  const time = nums(
    'care.time',
    care('Time spent'),
    `^${N}, at most ${N} a day`,
    '"+N, at most +M a day"',
  );

  const fear = byFirst(json, SEC, 'fearDeltas', 'Deed or act', 'Fear (x witness)');
  const fearNote = byFirst(json, SEC, 'fearDeltas', 'Deed or act', 'Notes');
  const f1 = (name: string): number =>
    nums(`fearDeltas.${name}`, fear(name), `^${N}$`, 'a signed number')[0] ?? 0;
  const punish = nums(
    'fearDeltas.A punishment',
    fear('A punishment'),
    `^${N} to the punished, ${N} to those watching`,
    '"+N to the punished, +M to those watching"',
  );
  const noteFriendship = (name: string): number =>
    nums(`fearDeltas.${name}.Notes`, fearNote(name), `^Friendship ${N}$`, '"Friendship -N"')[0] ??
    0;

  const bands: Band[] = rows(json, SEC, 'friendshipBands').map((r) => {
    const from = r['From'] ?? '';
    if (from.startsWith('below ')) return { name: r['Band'] ?? '', from: -Infinity };
    if (!/^-?\d+$/.test(from)) fail(`friendshipBands.${r['Band'] ?? ''}`, from, 'a whole number');
    return { name: r['Band'] ?? '', from: Number(from) };
  });

  const t = keyed(json, SEC, 'theHouseholdDayAndTalk');
  const n1 = (key: string, pattern: string, expected: string): number =>
    nums(`theHouseholdDayAndTalk.${key}`, t(key), pattern, expected)[0] ?? 0;
  const barkEvery = nums(
    'idleBarkEvery',
    t('idleBarkEvery'),
    `^${N} to ${N} real seconds`,
    '"A to B real seconds"',
  );

  const replyRows = rows(json, SEC, 'conversationReplies');
  const replies = {} as Record<ReplyName, { happiness: number; friendship: number; fear: boolean }>;
  for (const r of replyRows) {
    const effect = r['Effect'] ?? '';
    const name = (r['Reply'] ?? '') as ReplyName;
    const h = /happiness ([+-]\d+)/.exec(effect);
    const f = /friendship ([+-]\d+)/.exec(effect);
    replies[name] = {
      happiness: h === null ? 0 : Number(h[1]),
      friendship: f === null ? 0 : Number(f[1]),
      fear: effect.includes('Fear deltas') && !effect.startsWith('Time spent'),
    };
  }

  const judgementRows = rows(json, 'buildingsToolsAndCrafting', 'disputeJudgements');
  const judgement = (label: string) => {
    const r = judgementRows.find((x) => x['Judgement'] === label);
    if (r === undefined) throw new Error(`balance.json: disputeJudgements has no "${label}"`);
    return r;
  };
  const jRow = (label: string) => {
    const r = judgement(label);
    const fav = measures(`disputeJudgements.${label}.favoured`, r['Favoured party'] ?? '');
    const oth = measures(`disputeJudgements.${label}.other`, r['Other party'] ?? '');
    const watching = r['Those watching'] ?? '';
    const wf = /^Friendship \+(\d+) or -\d+/.exec(watching) ?? /^Word \+(\d+)/.exec(watching);
    const wfear = /^Fear \+(\d+)/.exec(watching);
    const returns = /within (\d+) days/.exec(r['Cost'] ?? '');
    return {
      favoured: { friendship: fav['friendship'] ?? 0, happiness: fav['happiness'] ?? 0 },
      other: {
        friendship: oth['friendship'] ?? 0,
        happiness: oth['happiness'] ?? 0,
        fear: oth['fear'] ?? 0,
      },
      watching: {
        friendship: wf === null ? 0 : Number(wf[1]),
        fear: wfear === null ? 0 : Number(wfear[1]),
      },
      ...(returns === null ? {} : { returnsDays: Number(returns[1]) }),
    };
  };

  return {
    deeds,
    cultures,
    weighing: {
      clamp: clamp[0] ?? 0,
      witness: {
        present: one('witnessPresent'),
        told: one('witnessToldByTie'),
        rumour: one('witnessRumour'),
      },
      drengrGlory: drengr[0] ?? 0,
      drengrValence: drengr[1] ?? 0,
    },
    traits: {
      discoverDays: [discover[0] ?? 0, discover[1] ?? 0],
      lightFingeredDays:
        nums(
          'traits.Light-fingered',
          trait('Light-fingered'),
          `every (\\d+) days`,
          '"... every N days ..."',
        )[0] ?? 0,
      diligent: diligent[0] ?? 1,
      lazy: diligent[1] ?? 1,
      seaSickLand:
        nums('traits.Sea-sick', trait('Sea-sick'), `x${N} on land`, '"... xN on land"')[0] ?? 1,
      storyteller:
        nums(
          'traits.Storyteller',
          trait('Storyteller'),
          `^Happiness ${N} for everyone at the fire`,
          '"Happiness +N for everyone at the fire"',
        )[0] ?? 0,
      gentleKilling:
        nums(
          'traits.Gentle',
          gentle,
          `friendship lost over a killing x${N}`,
          '"... friendship lost over a killing xN"',
        )[0] ?? 1,
      grudgeSlight:
        nums(
          'traits.Grudge-holder',
          trait('Grudge-holder'),
          `friendship lost to a slight x${N}`,
          '"... friendship lost to a slight xN"',
        )[0] ?? 1,
      piousSacrilege:
        nums(
          'traits.Pious',
          pious,
          `reactions to sacrilege x${N}`,
          '"... reactions to sacrilege xN ..."',
        )[0] ?? 1,
      piousMinutes:
        nums(
          'traits.Pious',
          pious,
          `^Prays (\\d+) game minutes a day`,
          '"Prays N game minutes a day ..."',
        )[0] ?? 0,
    },
    likes: {
      met:
        nums(
          'likeMet',
          likes('likeMet'),
          `^Happiness ${N} that day`,
          '"Happiness +N that day ..."',
        )[0] ?? 0,
      dislikeMet:
        nums(
          'dislikeMet',
          likes('dislikeMet'),
          `^Happiness ${N} that day`,
          '"Happiness -N that day"',
        )[0] ?? 0,
    },
    measures: {
      happinessStart:
        nums('happiness', hff('happiness'), `starts at ${N}`, '"... starts at N"')[0] ?? 0,
      friendshipStart: friendshipStart[0] ?? 0,
      friendshipStartTie: friendshipStart[1] ?? 0,
      fearStart: nums('fear', hff('fear'), `starts at ${N}`, '"... starts at N"')[0] ?? 0,
      workBase: work[0] ?? 1,
      workSpan: work[1] ?? 0,
      unhappyBelow:
        nums(
          'unhappyDisputes',
          hff('unhappyDisputes'),
          `^Below ${N} happiness`,
          '"Below N happiness ..."',
        )[0] ?? 0,
      loyalFrom:
        nums('loyal', hff('loyal'), `^Friendship ${N} or more`, '"Friendship N or more ..."')[0] ??
        0,
      leavesAtOrBelow: leaves[0] ?? 0,
      leavesFearBelow: leaves[1] ?? 0,
      fearfulFear: fearful[0] ?? 0,
      fearfulFriendshipBelow: fearful[1] ?? 0,
      fearfulWork: 1 - (fearful[2] ?? 0) / 100,
      devotionFear: devotion[0] ?? 0,
      devotionFriendship: devotion[1] ?? 0,
      devotionGlory: devotion[2] ?? 1,
      drift: (drift[0] ?? 0) / 100,
      happinessBase: drift[1] ?? 0,
      fearDecayPerDay: nums('fearDecay', hff('fearDecay'), `^${N} a day`, '"-N a day ..."')[0] ?? 0,
      warningSpacingDays: spacingDays(hff('warningSpacing')),
    },
    inputs: {
      fed: single('Fed'),
      hungry: single('Hungry'),
      warmNight: single('Warm at night'),
      coldNight: single('Cold at night'),
      bed: single('Slept in a bed'),
      safe: single('Safe'),
      success: lasting('Success'),
      grief: lasting('Grief'),
      festival: lasting('Festival'),
      treatedWell: range('Treated well'),
      treatedBadly: range('Treated badly'),
    },
    care: {
      gift: gift[0] ?? 0,
      giftEveryDays: gift[1] ?? 0,
      time: time[0] ?? 0,
      timePerDay: time[1] ?? 0,
      tending: nums('care.tending', care('Tending'), `^${N}$`, 'a signed number')[0] ?? 0,
    },
    fear: {
      killing: f1('KILLING seen'),
      civilianKilled: f1('CIVILIAN_KILLED'),
      surrenderedKilled: f1('SURRENDERED_KILLED'),
      punished: punish[0] ?? 0,
      punishWatching: punish[1] ?? 0,
      threat: f1('A threat to a resident'),
      threatFriendship: noteFriendship('A threat to a resident'),
      harming: f1('Harming a resident'),
      harmingFriendship: noteFriendship('Harming a resident'),
    },
    bands: [...bands].sort((a, b) => b.from - a.from),
    talk: {
      earshotTiles: n1('barkEarshot', `^${N} tiles`, '"N tiles"'),
      barkEverySeconds: [barkEvery[0] ?? 0, barkEvery[1] ?? 0],
      sameSpeakerSeconds: n1('barkSameSpeaker', `^${N} real minutes`, '"N real minutes"') * 60,
      sameLineSeconds: n1('barkSameLine', `^${N} real minutes?`, '"N real minute(s)"') * 60,
      topicsPerTalk: n1('topicsPerTalk', `^${N}$`, 'a number'),
      topicRestDays: n1('topicRest', `^${N} days`, '"N days"'),
      approachTiles: n1('approachTiles', `^${N} tiles`, '"N tiles"'),
      lowHappiness: n1('lowHappiness', `^Below ${N} for a whole day`, '"Below N for a whole day"'),
      supervisedTiles: n1('supervised', `within ${N} tiles`, '"... within N tiles"'),
      besideTiles: n1('workingBeside', `^Within ${N} tiles`, '"Within N tiles ..."'),
      lightFingeredTakeRd: n1('lightFingeredTake', `^${N} rd`, '"N rd ..."'),
    },
    voice: ((): { warm: number; cold: number; afraid: number } => {
      const v = keyed(json, 'conversationDepth', 'table')('voiceThresholds');
      const [warm = 0, cold = 0, afraid = 0] = nums(
        'conversationDepth.voiceThresholds',
        v,
        `friendship ${N} and ${N} and at fear ${N}`,
        '"... friendship N and -N and at fear M"',
      );
      return { warm, cold, afraid };
    })(),
    replies,
    judgements: {
      TAKE_SIDE: jRow('Take a side'),
      COMPROMISE: jRow('Compromise'),
      PUNISH: jRow('Punish'),
      IGNORE: jRow('Ignore'),
    },
  };
}
