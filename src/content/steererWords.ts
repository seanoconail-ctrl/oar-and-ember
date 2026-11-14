/**
 * Book 8 section 03: the game never states the steerer's gender. Strings tagged ADDRESS_STEERER
 * or ABOUT_STEERER may not contain a gendered word, and a string that names the steerer through
 * the {steerer} variable must carry one of those tags, so it is checked.
 *
 * Possessives about someone else are allowed: Book 8's own neutral form is "Thorkel's sister's
 * child", so "sister's" (a word followed by 's) is not counted.
 */

/** Book 8's list, plus the other common gendered forms it means by "any gendered term". */
export const GENDERED_WORDS = [
  'he',
  'she',
  'him',
  'her',
  'his',
  'hers',
  'himself',
  'herself',
  'lad',
  'lass',
  'lord',
  'lady',
  'brother',
  'sister',
  'son',
  'daughter',
  'man',
  'woman',
  'sir',
  'madam',
  'king',
  'queen',
  'boy',
  'girl',
  'nephew',
  'niece',
  'husband',
  'wife',
  'mister',
  'mistress',
  'lordship',
  'ladyship',
  'gentleman',
  'gentlewoman',
] as const;

const WORD = /[A-Za-zÀ-ÿ]+(?:'[A-Za-z]+)?/g;

/** The gendered words in `text`, lower-cased, in order of appearance. */
export function genderedWordsIn(text: string): string[] {
  const banned = new Set<string>(GENDERED_WORDS);
  const found: string[] = [];
  for (const [token] of text.replace(/\{[a-z_]+\}/g, ' ').matchAll(WORD)) {
    const lower = token.toLowerCase().replace(/’/g, "'");
    if (lower.endsWith("'s")) continue;
    if (banned.has(lower)) found.push(lower);
  }
  return found;
}

export const STEERER_TAGS = ['ADDRESS_STEERER', 'ABOUT_STEERER'] as const;

/**
 * The words that may stand for someone other than the steerer in a line addressed to the steerer,
 * by the `REFERS:<id>` tag that names whom they mean (Book 8 section 03; decision DE-31): a boat is
 * "she", and the household's people named in Chapter 1's lines are "he" or "she" by who they are
 * (Book 5). Only these referents are
 * known; a reviewer reads every such line.
 */
export const REFERENTS: Readonly<Record<string, readonly string[]>> = {
  ship: ['she', 'her', 'hers', 'herself'],
  c_thorkel: ['he', 'him', 'his', 'himself'],
  c_oddi: ['he', 'him', 'his', 'himself'],
  c_bran: ['he', 'him', 'his', 'himself'],
  c_runa: ['she', 'her', 'hers', 'herself'],
};

/** The `REFERS:<id>` tags of a string, by their ids. */
export function referentsOf(tags: readonly string[]): string[] {
  return tags.filter((t) => t.startsWith('REFERS:')).map((t) => t.slice('REFERS:'.length));
}

/** Problems with one string under Book 8 section 03, as reasons (empty when it is fine). */
export function steererWordingProblems(text: string, tags: readonly string[]): string[] {
  const tagged = tags.some((t) => (STEERER_TAGS as readonly string[]).includes(t));
  const problems: string[] = [];
  if (!tagged && text.includes('{steerer}'))
    problems.push('names the steerer, so it needs an ADDRESS_STEERER or ABOUT_STEERER tag');
  const refers = referentsOf(tags);
  for (const r of refers)
    if (REFERENTS[r] === undefined) problems.push(`REFERS:${r} names no known referent`);
  if (refers.length > 0 && text.includes('{steerer}'))
    problems.push('a REFERS line may not name the steerer ({steerer}); Book 8 section 03');
  if (tagged) {
    // A REFERS tag allows only the words that fit whom it names (decision DE-31).
    const allowed = new Set(refers.flatMap((r) => REFERENTS[r] ?? []));
    const words = genderedWordsIn(text).filter((w) => !allowed.has(w));
    if (words.length > 0)
      problems.push(
        `uses a gendered word for the steerer (${words.join(', ')}); Book 8 section 03`,
      );
  }
  return problems;
}
