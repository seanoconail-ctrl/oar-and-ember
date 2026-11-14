/**
 * The string table. All player-facing text is looked up by key (Book 2 section 04); keys follow
 * Book 8 section 10: `<speaker>.<context>.<id>`, with variables in braces such as `{build}`.
 */

export interface StringEntry {
  readonly text: string;
  /**
   * Book 8 tags, e.g. ADDRESS_STEERER, ABOUT_STEERER, VOICED, GLOSSARY:<word>; caption strings
   * are SPEECH (a speaker's words) or INFO (sounds, directions, cues).
   */
  readonly tags: readonly string[];
}

export type StringTable = ReadonlyMap<string, StringEntry>;

export const STRING_KEY = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+){2,}$/;
const VARIABLE = /\{([a-z][a-z0-9_]*)\}/g;
const TAG =
  /^(ADDRESS_STEERER|ABOUT_STEERER|VOICED|GLOSSARY:\S+|REFERS:[a-z][a-z0-9_]*|SPEECH|INFO)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates a string table file. Throws naming the key and reason on any defect. */
export function parseStringTable(json: unknown, file: string): StringTable {
  if (!isRecord(json)) throw new Error(`${file}: expected an object of string entries`);
  const table = new Map<string, StringEntry>();
  for (const [key, raw] of Object.entries(json)) {
    if (!STRING_KEY.test(key)) {
      throw new Error(`${file}: key "${key}" must look like <speaker>.<context>.<id>`);
    }
    if (!isRecord(raw) || typeof raw['text'] !== 'string' || raw['text'] === '') {
      throw new Error(`${file}: "${key}" needs a non-empty "text"`);
    }
    const tags = raw['tags'] ?? [];
    if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string' && TAG.test(t))) {
      throw new Error(`${file}: "${key}" has an unknown tag`);
    }
    table.set(key, { text: raw['text'], tags: tags as string[] });
  }
  return table;
}

/** The variable names a string expects, e.g. ["build"]. */
export function stringVariables(text: string): string[] {
  return [...text.matchAll(VARIABLE)].map((m) => m[1] ?? '');
}

/** Looks up `key` and fills its variables. Throws if the key or any variable is missing. */
export function formatString(
  table: StringTable,
  key: string,
  vars: Readonly<Record<string, string>> = {},
): string {
  const entry = table.get(key);
  if (entry === undefined) throw new Error(`No string for key "${key}"`);
  return entry.text.replace(VARIABLE, (_, name: string) => {
    const value = vars[name];
    if (value === undefined) throw new Error(`String "${key}" needs a value for {${name}}`);
    return value;
  });
}

/**
 * Caption string checks (Book 8; design addendum 2.3 section 10). Every `caption.` string is tagged
 * SPEECH or INFO. A SPEECH string names its speaker (`{speaker}: ...`); an INFO string has no
 * speaker, no "Name:" prefix, no quotation marks, and is under eight words.
 */
export function captionProblems(key: string, entry: StringEntry): string[] {
  if (!key.startsWith('caption.')) return [];
  const speech = entry.tags.includes('SPEECH');
  const info = entry.tags.includes('INFO');
  if (speech === info) return ['a caption string must be tagged SPEECH or INFO (not both)'];
  const problems: string[] = [];
  if (speech && !entry.text.startsWith('{speaker}: '))
    problems.push('a SPEECH caption must start with "{speaker}: "');
  if (info) {
    if (entry.text.includes('{speaker}')) problems.push('an INFO caption has no speaker');
    if (/^[A-Z][^:{]{0,24}: /.test(entry.text))
      problems.push('an INFO caption has no "Name:" prefix (it is not speech)');
    if (/["\u201c\u201d]/.test(entry.text)) problems.push('an INFO caption has no quotation marks');
    const words = entry.text
      .replace(/\{[a-z_]+\}/g, 'x')
      .split(/\s+/)
      .filter((w) => w !== '');
    if (words.length >= 8) problems.push('an INFO caption is under eight words');
  }
  return problems;
}

/**
 * Modern moral vocabulary, banned from dialogue (design addendum 2.3 section 2; Book 8): people
 * around AD 900 speak of honour and shame, luck, oaths, kin, sin and the honour-price. Dialogue says
 * "farmers", "folk" or "people who bore no weapon", never "civilians"; "innocent" is allowed (a
 * Church word). Interface text is exempt.
 */
export const MODERN_MORAL_WORDS: readonly string[] = [
  'rights',
  'war crime',
  'genocide',
  'trauma',
  'civilian',
  'ethics',
  'morality',
  'values',
  'consent',
  'abuse',
  'victim',
  'tolerance',
  'equality',
];

/** Dialogue strings are spoken by someone: keys whose speaker part is a person (c_, l_, e_...). */
export function isDialogueKey(key: string): boolean {
  return /^(c|l|r|e|h|p)_[a-z0-9_]+\./.test(key);
}

export function modernMoralWordsIn(text: string): string[] {
  const lower = text.toLowerCase();
  return MODERN_MORAL_WORDS.filter((w) =>
    new RegExp(`\\b${w.replace(' ', '\\s+')}(s|es)?\\b`).test(lower),
  );
}
