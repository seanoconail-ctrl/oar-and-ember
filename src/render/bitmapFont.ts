/**
 * Bitmap fonts compiled from authored lettering sources.
 *
 * A font source draws each glyph as a mask ('#' body, '.' empty). The header says how the mask
 * is finished, deterministically: an optional Scale2x pass (smooths the stepped curves of
 * half-resolution lettering), a one-pixel outline, and a three-tone ramp lit from the upper left
 * (Book 7 section 11). Glyph pixels store a *role*; a named ramp maps roles to palette codes when
 * text is drawn, so one glyph can be drawn in different materials.
 */
import { ArtSourceError, parseArtSource, requireHeader, requireInt } from './artSource.ts';
import type { ArtSource } from './artSource.ts';
import { blit, createIndexedImage, NO_PIXEL } from './indexedImage.ts';
import type { IndexedImage } from './indexedImage.ts';
import { paletteIndex } from './palette.ts';
import type { Palette } from './palette.ts';

export const ROLE = { outline: 0, highlight: 1, base: 2, shadow: 3 } as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];

/** Palette indices for each role: [outline, highlight, base, shadow]. */
export type Ramp = readonly [number, number, number, number];

export interface Glyph {
  readonly char: string;
  /** Role-valued pixels (NO_PIXEL where empty). */
  readonly image: IndexedImage;
  readonly advance: number;
}

export interface BitmapFont {
  readonly name: string;
  readonly height: number;
  readonly spaceAdvance: number;
  readonly glyphs: ReadonlyMap<string, Glyph>;
  readonly ramps: ReadonlyMap<string, Ramp>;
}

type Mask = boolean[][];

const BODY = '#';
const EMPTY = '.';

function signedInt(source: ArtSource, key: string, fallback: number): number {
  const entry = source.header.get(key);
  if (entry === undefined) return fallback;
  if (!/^-?\d+$/.test(entry.value)) {
    throw new ArtSourceError(source.file, entry.line, `"${key}" must be a whole number`);
  }
  return Number.parseInt(entry.value, 10);
}

function choice<T extends string>(source: ArtSource, key: string, options: readonly T[]): T {
  const { value, line } = requireHeader(source, key);
  const found = options.find((o) => o === value);
  if (found === undefined) {
    throw new ArtSourceError(source.file, line, `"${key}" must be one of: ${options.join(', ')}`);
  }
  return found;
}

/** Scale2x (AdvMAME2x): doubles a mask, rounding diagonal steps instead of stair-casing them. */
export function scale2x(mask: Mask): Mask {
  const h = mask.length;
  const w = mask[0]?.length ?? 0;
  const at = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h ? (mask[y]?.[x] ?? false) : false;
  const out: Mask = Array.from({ length: h * 2 }, () => new Array<boolean>(w * 2).fill(false));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = at(x, y);
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      const row0 = out[y * 2];
      const row1 = out[y * 2 + 1];
      if (row0 === undefined || row1 === undefined) continue;
      row0[x * 2] = c === a && c !== d && a !== b ? a : p;
      row0[x * 2 + 1] = a === b && a !== c && b !== d ? b : p;
      row1[x * 2] = d === c && d !== b && c !== a ? c : p;
      row1[x * 2 + 1] = b === d && b !== a && d !== c ? d : p;
    }
  }
  return out;
}

/** Turns a finished mask into role pixels: outline around the body, ramp lit from upper left. */
export function shadeMask(mask: Mask, outline: 'none' | '4' | '8', shading: 'none' | 'upper-left') {
  const pad = outline === 'none' ? 0 : 1;
  const h = mask.length;
  const w = mask[0]?.length ?? 0;
  const image = createIndexedImage(w + pad * 2, h + pad * 2);
  const body = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h ? (mask[y]?.[x] ?? false) : false;
  for (let y = -pad; y < h + pad; y++) {
    for (let x = -pad; x < w + pad; x++) {
      let role: number = NO_PIXEL;
      if (body(x, y)) {
        role = ROLE.base;
        if (shading === 'upper-left') {
          if (!body(x, y - 1)) role = ROLE.highlight;
          else if (!body(x, y + 1)) role = ROLE.shadow;
          else if (!body(x - 1, y)) role = ROLE.highlight;
          else if (!body(x + 1, y)) role = ROLE.shadow;
        }
      } else if (outline !== 'none') {
        const edge = body(x - 1, y) || body(x + 1, y) || body(x, y - 1) || body(x, y + 1);
        const corner =
          body(x - 1, y - 1) || body(x + 1, y - 1) || body(x - 1, y + 1) || body(x + 1, y + 1);
        if (edge || (outline === '8' && corner)) role = ROLE.outline;
      }
      image.pixels[(y + pad) * image.width + (x + pad)] = role;
    }
  }
  return image;
}

function parseRamp(source: ArtSource, key: string, palette: Palette): Ramp {
  const { value, line } = requireHeader(source, key);
  const codes = value.split(/\s+/).filter((c) => c !== '');
  const resolve = (code: string): number => {
    try {
      return paletteIndex(palette, code);
    } catch {
      throw new ArtSourceError(source.file, line, `ramp code "${code}" is not in ${palette.name}`);
    }
  };
  if (codes.length === 1 && codes[0] !== undefined) {
    const base = resolve(codes[0]);
    return [base, base, base, base];
  }
  if (codes.length !== 4) {
    throw new ArtSourceError(
      source.file,
      line,
      'a ramp lists one code, or four: outline highlight base shadow',
    );
  }
  const [o = '', hi = '', b = '', sh = ''] = codes;
  return [resolve(o), resolve(hi), resolve(b), resolve(sh)];
}

/** Compiles a font source. Throws ArtSourceError (file, line, reason) on any defect. */
export function compileFont(text: string, file: string, palette: Palette): BitmapFont {
  const source = parseArtSource(text, file);
  const kind = requireHeader(source, 'kind');
  if (kind.value !== 'font') throw new ArtSourceError(file, kind.line, 'kind must be "font"');
  const paletteName = requireHeader(source, 'palette');
  if (paletteName.value !== palette.name) {
    throw new ArtSourceError(file, paletteName.line, `expects palette "${paletteName.value}"`);
  }
  const name = requireHeader(source, 'sheet').value;
  const rows = requireInt(source, 'rows');
  const scale = choice(source, 'scale', ['1', 'scale2x'] as const);
  const outline = choice(source, 'outline', ['none', '4', '8'] as const);
  const shading = choice(source, 'shading', ['none', 'upper-left'] as const);
  const spacing = signedInt(source, 'spacing', 1);
  const space = requireInt(source, 'space');

  const ramps = new Map<string, Ramp>();
  for (const key of source.header.keys()) {
    if (key.startsWith('ramp.'))
      ramps.set(key.slice('ramp.'.length), parseRamp(source, key, palette));
  }
  if (ramps.size === 0) throw new ArtSourceError(file, 1, 'a font needs at least one ramp');

  const glyphs = new Map<string, Glyph>();
  let height = -1;
  for (const block of source.blocks) {
    if (block.kind !== 'glyph') {
      throw new ArtSourceError(file, block.line, `unexpected block "${block.kind}"`);
    }
    if (glyphs.has(block.name)) {
      throw new ArtSourceError(file, block.line, `glyph "${block.name}" is defined twice`);
    }
    if (block.rows.length !== rows) {
      throw new ArtSourceError(
        file,
        block.line,
        `glyph "${block.name}" has ${block.rows.length} rows; the font has ${rows}`,
      );
    }
    const width = block.rows[0]?.length ?? 0;
    const mask: Mask = block.rows.map((row, r) => {
      if (row.length !== width) {
        throw new ArtSourceError(
          file,
          block.line + 1 + r,
          `row is ${row.length} wide, not ${width}`,
        );
      }
      return Array.from(row, (ch, c) => {
        if (ch !== BODY && ch !== EMPTY) {
          throw new ArtSourceError(
            file,
            block.line + 1 + r,
            `column ${c + 1}: "${ch}" is not "${BODY}" or "${EMPTY}"`,
          );
        }
        return ch === BODY;
      });
    });
    const finished = scale === 'scale2x' ? scale2x(mask) : mask;
    const image = shadeMask(finished, outline, shading);
    if (height === -1) height = image.height;
    glyphs.set(block.name, { char: block.name, image, advance: image.width + spacing });
  }
  if (glyphs.size === 0) throw new ArtSourceError(file, 1, 'a font needs at least one glyph');
  return { name, height, spaceAdvance: space, glyphs, ramps };
}

/** Characters in `text` the font cannot draw. */
export function missingGlyphs(font: BitmapFont, text: string): string[] {
  const missing = new Set<string>();
  for (const ch of text) if (ch !== ' ' && !font.glyphs.has(ch)) missing.add(ch);
  return [...missing];
}

/** Width in pixels of `text` drawn in `font` (trailing spacing excluded). */
export function measureText(font: BitmapFont, text: string): number {
  let width = 0;
  let lastGap = 0;
  for (const ch of text) {
    if (ch === ' ') {
      width += font.spaceAdvance;
      lastGap = 0;
      continue;
    }
    const glyph = font.glyphs.get(ch);
    if (glyph === undefined) throw new Error(`Font ${font.name} has no glyph for "${ch}"`);
    width += glyph.advance;
    lastGap = glyph.advance - glyph.image.width;
  }
  return width - lastGap;
}

export function getRamp(font: BitmapFont, name: string): Ramp {
  const ramp = font.ramps.get(name);
  if (ramp === undefined) throw new Error(`Font ${font.name} has no ramp "${name}"`);
  return ramp;
}

/** Draws `text` with its top-left corner at (x, y). Returns the x after the last glyph. */
export function drawText(
  target: IndexedImage,
  font: BitmapFont,
  text: string,
  x: number,
  y: number,
  ramp: Ramp,
): number {
  let pen = x;
  for (const ch of text) {
    if (ch === ' ') {
      pen += font.spaceAdvance;
      continue;
    }
    const glyph = font.glyphs.get(ch);
    if (glyph === undefined) throw new Error(`Font ${font.name} has no glyph for "${ch}"`);
    blit(target, glyph.image, pen, y, (role) => ramp[role] ?? NO_PIXEL);
    pen += glyph.advance;
  }
  return pen;
}
