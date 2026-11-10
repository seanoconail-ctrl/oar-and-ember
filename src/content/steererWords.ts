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

/** Problems with one string under Book 8 section 03, as reasons (empty when it is fine). */
export function steererWordingProblems(text: string, tags: readonly string[]): string[] {
  const tagged = tags.some((t) => (STEERER_TAGS as readonly string[]).includes(t));
  const problems: string[] = [];
  if (!tagged && text.includes('{steerer}'))
    problems.push('names the steerer, so it needs an ADDRESS_STEERER or ABOUT_STEERER tag');
  if (tagged) {
    const words = genderedWordsIn(text);
    if (words.length > 0)
      problems.push(
        `uses a gendered word for the steerer (${words.join(', ')}); Book 8 section 03`,
      );
  }
  return problems;
}
