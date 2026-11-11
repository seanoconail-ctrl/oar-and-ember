/**
 * Happiness, friendship and fear (Book 2 section 06; Book 5 section 01; Book 10 section 08) as pure
 * functions of a person and Book 10's numbers:
 *
 * - **Friendship by deed:** `delta = sum(weight x valence x witness x culture)`, clamped, with the
 *   witness's culture read first (two codes take the stronger reading), then their values, traits
 *   (Gentle, Grudge-holder, Pious, devotion) and stance. Book 10 gives stances no factor, so a
 *   stance changes the words a person uses, not the number (decision S8-3).
 * - **Fear by deed or act**, by the "Fear deltas" table, times the witness factor.
 * - **Happiness:** the day's target is a base plus today's factors; happiness drifts a share of the
 *   way to it each game hour.
 * - **Effects:** the work multiplier, and the loyal, leaving, fearful-obedience and devotion marks.
 * - **Bands** of friendship, from Devoted down to Estranged.
 */
import type { CodeName, PeopleBalance } from '../../content/peopleBalance.ts';
import type { MoodFactor, Person, Value } from '../world.ts';

export type Witness = 'present' | 'told' | 'rumour';

/** What a deed's reading needs to know beyond its tag (Book 10 "Deed reactions by culture"). */
export interface DeedReading {
  readonly tag: string;
  /** Where a sacrilege happened: at a church, or an old shrine or mound. */
  readonly at?: 'church' | 'shrine';
  /** The faith a sacred thing belonged to (for Faith's "same faith" valence and Pious). */
  readonly faith?: Person['faithTarget'];
  /** A killing in open fight (the KILLING row's reading). */
  readonly openFight?: boolean;
}

const KILLINGS = new Set(['KILLING', 'CIVILIAN_KILLED', 'SURRENDERED_KILLED', 'KILLING_HIDDEN']);
const SACRED = new Set(['SACRILEGE', 'SACRED_TAKEN']);

function hasTrait(p: Pick<Person, 'traits'>, trait: Person['traits'][number]['trait']): boolean {
  return p.traits.some((t) => t.trait === trait);
}

/** The culture's reading of a deed for a witness: two codes take the stronger (Book 10). */
export function cultureReading(
  b: PeopleBalance,
  codes: readonly CodeName[],
  deed: DeedReading,
): { factor: number; direction: 'for' | 'against' | 'plain' } {
  const key =
    deed.tag === 'SACRILEGE'
      ? deed.at === 'church'
        ? 'SACRILEGE_CHURCH'
        : 'SACRILEGE_SHRINE'
      : deed.tag;
  const row = b.cultures.get(key);
  if (row === undefined) return { factor: 1, direction: 'plain' };
  let best = { factor: 1, direction: 'plain' as 'for' | 'against' | 'plain' };
  let first = true;
  for (const code of codes) {
    const r = row[code];
    if (first || r.factor > best.factor) best = r;
    first = false;
  }
  return best;
}

/**
 * The friendship a witness gives the household for a deed (Book 10 section 08, "Friendship deltas
 * by deed"), before rounding. `devoted` scales Glory deeds by Book 10's devotion factor.
 */
export function friendshipDelta(
  b: PeopleBalance,
  witness: Pick<Person, 'values' | 'traits' | 'codes' | 'faithTarget'>,
  deed: DeedReading,
  how: Witness = 'present',
  devoted = false,
): number {
  const row = b.deeds.get(deed.tag);
  if (row === undefined) return 0;
  let sum = 0;
  let glory = 0;
  for (const [value, weight] of Object.entries(witness.values) as [Value, number][]) {
    let valence = row.valence[value];
    // Faith counts only when the sacred thing was of the witness's own faith.
    if (value === 'FAITH' && row.sameFaith && deed.faith !== witness.faithTarget) valence = 0;
    // The drengr rule (decision DD-2): no glory in killing farmers, and no shame to a drengr either.
    if (
      deed.tag === 'CIVILIAN_KILLED' &&
      value === 'GLORY' &&
      weight >= b.weighing.drengrGlory &&
      (witness.values.MERCY ?? 0) === 0
    )
      valence = b.weighing.drengrValence;
    const part = weight * valence;
    if (value === 'GLORY') glory += part;
    sum += part;
  }
  if (devoted && glory > 0) sum += glory * (b.measures.devotionGlory - 1);
  sum *= b.weighing.witness[how];
  const culture = cultureReading(b, witness.codes, deed);
  if (culture.direction === 'for') sum = Math.abs(sum) * culture.factor;
  else if (culture.direction === 'against') sum = -Math.abs(sum) * culture.factor;
  else sum *= culture.factor;
  // Traits (Book 10 "Traits").
  if (sum < 0 && KILLINGS.has(deed.tag) && hasTrait(witness, 'GENTLE'))
    sum *= b.traits.gentleKilling;
  if (
    SACRED.has(deed.tag) &&
    deed.faith !== undefined &&
    witness.traits.some((t) => t.trait === 'PIOUS' && t.faith === deed.faith)
  )
    sum *= b.traits.piousSacrilege;
  const c = b.weighing.clamp;
  return Math.max(-c, Math.min(c, sum));
}

/** Fear from a deed or act (Book 10 "Fear deltas"), times the witness factor. */
export type FearAct =
  | 'KILLING'
  | 'CIVILIAN_KILLED'
  | 'SURRENDERED_KILLED'
  | 'PUNISHED'
  | 'PUNISH_WATCHED'
  | 'THREAT'
  | 'HARMED';

export function fearDelta(b: PeopleBalance, act: FearAct, how: Witness = 'present'): number {
  const f = b.fear;
  const base = {
    KILLING: f.killing,
    CIVILIAN_KILLED: f.civilianKilled,
    SURRENDERED_KILLED: f.surrenderedKilled,
    PUNISHED: f.punished,
    PUNISH_WATCHED: f.punishWatching,
    THREAT: f.threat,
    HARMED: f.harming,
  }[act];
  return base * b.weighing.witness[how];
}

/** A slight's friendship cost: x1.5 for a grudge-holder (Book 10 "Traits"). */
export function slight(b: PeopleBalance, p: Pick<Person, 'traits'>, amount: number): number {
  return amount < 0 && hasTrait(p, 'GRUDGE_HOLDER') ? amount * b.traits.grudgeSlight : amount;
}

/** Clamps the three measures to their ranges (Book 10: 0..100, -100..100, 0..100). */
export function clampMeasures(p: Pick<Person, 'happiness' | 'friendship' | 'fear'>): void {
  p.happiness = Math.max(0, Math.min(100, p.happiness));
  p.friendship = Math.max(-100, Math.min(100, p.friendship));
  p.fear = Math.max(0, Math.min(100, p.fear));
}

/** The day's happiness target: the base plus today's factors, within 0 to 100. */
export function happinessTarget(b: PeopleBalance, factors: readonly MoodFactor[]): number {
  const sum = factors.reduce((s, f) => s + f.amount, b.measures.happinessBase);
  return Math.max(0, Math.min(100, sum));
}

/** One game hour's drift towards the target (Book 10 happinessDrift). */
export function driftHappiness(b: PeopleBalance, now: number, target: number): number {
  return now + (target - now) * b.measures.drift;
}

/** Book 10 workOutput: x (0.8 + 0.4 x happiness / 100). */
export function happinessWork(b: PeopleBalance, happiness: number): number {
  return b.measures.workBase + (b.measures.workSpan * happiness) / 100;
}

export interface Effects {
  /** Friendship 40 or more: volunteers for danger, defends the steerer, stays. */
  readonly loyal: boolean;
  /** Friendship -40 or less with fear below 30: starts the request to leave. */
  readonly leaves: boolean;
  /** Fear 60 or more with friendship below 0: obeys, works 15% worse. */
  readonly fearfulObedience: boolean;
  /** Fear 60 or more with friendship 40 or more: fierce devotion. */
  readonly devotion: boolean;
}

export function effectsOf(b: PeopleBalance, p: Pick<Person, 'friendship' | 'fear'>): Effects {
  const m = b.measures;
  return {
    loyal: p.friendship >= m.loyalFrom,
    leaves: p.friendship <= m.leavesAtOrBelow && p.fear < m.leavesFearBelow,
    fearfulObedience: p.fear >= m.fearfulFear && p.friendship < m.fearfulFriendshipBelow,
    devotion: p.fear >= m.devotionFear && p.friendship >= m.devotionFriendship,
  };
}

/** What a person's traits do to their work (Book 10 "Traits"): unsupervised, and on land. */
export function traitWork(
  b: PeopleBalance,
  p: Pick<Person, 'traits'>,
  supervised: boolean,
  onLand = true,
): number {
  let k = 1;
  if (!supervised && hasTrait(p, 'DILIGENT')) k *= b.traits.diligent;
  if (!supervised && hasTrait(p, 'LAZY')) k *= b.traits.lazy;
  if (onLand && hasTrait(p, 'SEA_SICK')) k *= b.traits.seaSickLand;
  return k;
}

/**
 * A resident's work multiplier, apart from skill and wounds: happiness (Book 10 workOutput),
 * fearful obedience's 15% worse, and their traits.
 */
export function workMultiplier(
  b: PeopleBalance,
  p: Pick<Person, 'happiness' | 'friendship' | 'fear' | 'traits'>,
  supervised: boolean,
  onLand = true,
): number {
  const fearful = effectsOf(b, p).fearfulObedience ? b.measures.fearfulWork : 1;
  return happinessWork(b, p.happiness) * fearful * traitWork(b, p, supervised, onLand);
}

/** The friendship band (Book 10 "Friendship bands"), by name. */
export function bandOf(b: PeopleBalance, friendship: number): string {
  for (const band of b.bands) if (friendship >= band.from) return band.name;
  return b.bands[b.bands.length - 1]?.name ?? '';
}

/** How far down the bands one is: 0 the highest. */
export function bandIndex(b: PeopleBalance, name: string): number {
  const i = b.bands.findIndex((band) => band.name === name);
  return i < 0 ? 0 : i;
}

/** The voice a major character speaks in (Book 10 section 23, voiceThresholds). */
export type Voice = 'NEUTRAL' | 'WARM' | 'COLD' | 'AFRAID' | 'DEVOTED';

export function voiceOf(
  b: PeopleBalance,
  p: Pick<Person, 'friendship' | 'fear'>,
  thresholds: { readonly warm: number; readonly cold: number; readonly afraid: number },
): Voice {
  if (effectsOf(b, p).devotion) return 'DEVOTED';
  if (p.fear >= thresholds.afraid) return 'AFRAID';
  if (p.friendship >= thresholds.warm) return 'WARM';
  if (p.friendship <= thresholds.cold) return 'COLD';
  return 'NEUTRAL';
}
