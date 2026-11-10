/**
 * The indexed palette (Book 7 sections 08 and 12). Art sources may use only these entries; every
 * frame the renderer presents is composed from palette indices, so nothing off-palette can appear.
 */

export interface PaletteEntry {
  /** Single character used in art sources. */
  readonly code: string;
  readonly name: string;
  readonly hex: string;
  readonly group: string;
  /** Reserved accents never appear in ordinary scenery (Book 7 section 08). */
  readonly reserved: boolean;
  readonly rgb: readonly [number, number, number];
}

export interface Palette {
  readonly name: string;
  /** The code that means "no pixel" in a source. */
  readonly transparent: string;
  readonly entries: readonly PaletteEntry[];
  /** Palette index by code. */
  readonly indexOf: ReadonlyMap<string, number>;
}

const HEX = /^#[0-9A-F]{6}$/;

function fail(message: string): never {
  throw new Error(`Palette: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates and builds a palette from its JSON file. Throws with a reason on any defect. */
export function parsePalette(json: unknown): Palette {
  if (!isRecord(json)) fail('expected an object');
  const { name, transparent, entries } = json;
  if (typeof name !== 'string' || name === '') fail('missing name');
  if (typeof transparent !== 'string' || Array.from(transparent).length !== 1) {
    fail('"transparent" must be a single character');
  }
  if (!Array.isArray(entries) || entries.length === 0) fail('missing entries');
  if (entries.length > 255) fail('at most 255 entries fit an 8-bit index');

  const indexOf = new Map<string, number>();
  const parsed: PaletteEntry[] = entries.map((raw: unknown, i): PaletteEntry => {
    if (!isRecord(raw)) fail(`entry ${i} is not an object`);
    const { code, name: entryName, hex, group, reserved } = raw;
    if (typeof code !== 'string' || Array.from(code).length !== 1 || /\s/.test(code)) {
      fail(`entry ${i}: code must be one visible character`);
    }
    if (code === transparent) fail(`entry ${i}: code "${code}" is the transparent code`);
    if (indexOf.has(code)) fail(`entry ${i}: duplicate code "${code}"`);
    if (typeof entryName !== 'string' || entryName === '') fail(`entry ${i}: missing name`);
    if (typeof hex !== 'string' || !HEX.test(hex)) fail(`entry ${i}: hex must look like #A1B2C3`);
    if (typeof group !== 'string') fail(`entry ${i}: missing group`);
    if (reserved !== undefined && typeof reserved !== 'boolean') {
      fail(`entry ${i}: reserved must be true or false`);
    }
    indexOf.set(code, i);
    const value = Number.parseInt(hex.slice(1), 16);
    return {
      code,
      name: entryName,
      hex,
      group,
      reserved: reserved === true,
      rgb: [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff],
    };
  });

  return { name, transparent, entries: parsed, indexOf };
}

/** Palette index for a code, or a thrown error naming the code. */
export function paletteIndex(palette: Palette, code: string): number {
  const index = palette.indexOf.get(code);
  if (index === undefined) throw new Error(`Palette ${palette.name}: unknown code "${code}"`);
  return index;
}
