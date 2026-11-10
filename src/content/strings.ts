/**
 * The string table. All player-facing text is looked up by key (Book 2 section 04); keys follow
 * Book 8 section 10: `<speaker>.<context>.<id>`, with variables in braces such as `{build}`.
 */

export interface StringEntry {
  readonly text: string;
  /** Book 8 tags, e.g. ADDRESS_STEERER, ABOUT_STEERER, VOICED, GLOSSARY:<word>. */
  readonly tags: readonly string[];
}

export type StringTable = ReadonlyMap<string, StringEntry>;

export const STRING_KEY = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+){2,}$/;
const VARIABLE = /\{([a-z][a-z0-9_]*)\}/g;
const TAG = /^(ADDRESS_STEERER|ABOUT_STEERER|VOICED|GLOSSARY:\S+)$/;

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
