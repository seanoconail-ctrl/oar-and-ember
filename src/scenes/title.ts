/**
 * The Title mode (Book 2 section 02: Boot -> Title -> Campaign). Stage 1 composes the title
 * frame: the game's name in the title lettering and the build id beneath it.
 */
import { paintBands } from '../render/backdrop.ts';
import { drawText, getRamp, measureText, missingGlyphs } from '../render/bitmapFont.ts';
import type { BitmapFont } from '../render/bitmapFont.ts';
import { createIndexedImage } from '../render/indexedImage.ts';
import type { IndexedImage } from '../render/indexedImage.ts';
import { paletteIndex } from '../render/palette.ts';
import type { Palette } from '../render/palette.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport.ts';

export interface BackdropBand {
  /** Palette code. */
  readonly colour: string;
  readonly toY?: number;
  readonly blend?: number;
}

export interface TitleLayout {
  readonly palette: string;
  /** Colour of the letterbox bars around the frame. */
  readonly letterbox: string;
  /** Sky and sea bands, top to bottom. */
  readonly backdrop: readonly BackdropBand[];
  readonly title: {
    readonly font: string;
    readonly wordRamps: readonly string[];
    readonly centreY: number;
  };
  readonly build: { readonly font: string; readonly ramp: string; readonly bottomMargin: number };
}

export interface TitleArt {
  readonly palette: Palette;
  readonly fonts: ReadonlyMap<string, BitmapFont>;
  readonly layout: TitleLayout;
}

export interface TitleText {
  /** The game's name (string key ui.title.name). */
  readonly name: string;
  /** The build line (string key ui.title.build). */
  readonly buildLine: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(obj: Record<string, unknown>, key: string, file: string): string {
  const value = obj[key];
  if (typeof value !== 'string' || value === '') throw new Error(`${file}: "${key}" must be text`);
  return value;
}

function int(obj: Record<string, unknown>, key: string, file: string): number {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${file}: "${key}" must be a whole number of pixels`);
  }
  return value;
}

/** Validates the title layout file. */
export function parseTitleLayout(json: unknown, file: string): TitleLayout {
  if (!isRecord(json)) throw new Error(`${file}: expected an object`);
  const title = json['title'];
  const build = json['build'];
  if (!isRecord(title) || !isRecord(build)) throw new Error(`${file}: needs "title" and "build"`);
  const backdrop = json['backdrop'];
  if (!Array.isArray(backdrop) || backdrop.length === 0) {
    throw new Error(`${file}: "backdrop" must list at least one band`);
  }
  const bands = backdrop.map((raw: unknown, i): BackdropBand => {
    if (!isRecord(raw)) throw new Error(`${file}: backdrop band ${i} is not an object`);
    const last = i === backdrop.length - 1;
    if (last !== (raw['toY'] === undefined)) {
      throw new Error(`${file}: every backdrop band but the last needs "toY"`);
    }
    const band: { colour: string; toY?: number; blend?: number } = {
      colour: str(raw, 'colour', file),
    };
    if (!last) band.toY = int(raw, 'toY', file);
    if (raw['blend'] !== undefined) band.blend = int(raw, 'blend', file);
    return band;
  });
  bands.forEach((band, i) => {
    const prev = bands[i - 1]?.toY ?? 0;
    if (band.toY !== undefined && band.toY <= prev) {
      throw new Error(`${file}: backdrop bands must go down the frame`);
    }
  });
  const wordRamps = title['wordRamps'];
  if (
    !Array.isArray(wordRamps) ||
    wordRamps.length === 0 ||
    !wordRamps.every((r) => typeof r === 'string')
  ) {
    throw new Error(`${file}: "title.wordRamps" must list ramp names`);
  }
  return {
    palette: str(json, 'palette', file),
    letterbox: str(json, 'letterbox', file),
    backdrop: bands,
    title: {
      font: str(title, 'font', file),
      wordRamps,
      centreY: int(title, 'centreY', file),
    },
    build: {
      font: str(build, 'font', file),
      ramp: str(build, 'ramp', file),
      bottomMargin: int(build, 'bottomMargin', file),
    },
  };
}

function font(art: TitleArt, name: string): BitmapFont {
  const found = art.fonts.get(name);
  if (found === undefined) throw new Error(`Title layout names unknown font "${name}"`);
  return found;
}

/** Text the fonts cannot draw, by font name. Empty when the title can be composed. */
export function titleTextProblems(art: TitleArt, text: TitleText): string[] {
  const problems: string[] = [];
  const titleFont = font(art, art.layout.title.font);
  const smallFont = font(art, art.layout.build.font);
  const a = missingGlyphs(titleFont, text.name);
  const b = missingGlyphs(smallFont, text.buildLine);
  if (a.length > 0) problems.push(`${titleFont.name} lacks ${a.map((c) => `"${c}"`).join(' ')}`);
  if (b.length > 0) problems.push(`${smallFont.name} lacks ${b.map((c) => `"${c}"`).join(' ')}`);
  return problems;
}

/** Composes the 640 x 360 title frame as palette indices. Pure and deterministic. */
export function composeTitleFrame(art: TitleArt, text: TitleText): IndexedImage {
  const { palette, layout } = art;
  if (layout.palette !== palette.name) {
    throw new Error(`Title layout expects palette "${layout.palette}", got "${palette.name}"`);
  }
  const problems = titleTextProblems(art, text);
  if (problems.length > 0) throw new Error(`Cannot draw the title: ${problems.join('; ')}`);

  const frame = createIndexedImage(LOGICAL_WIDTH, LOGICAL_HEIGHT);
  paintBands(
    frame,
    layout.backdrop.map((band) => ({ ...band, index: paletteIndex(palette, band.colour) })),
  );

  // The name, centred, each word in its own material.
  const titleFont = font(art, layout.title.font);
  const words = text.name.split(' ');
  let x = Math.floor((LOGICAL_WIDTH - measureText(titleFont, text.name)) / 2);
  const y = layout.title.centreY - Math.floor(titleFont.height / 2);
  words.forEach((word, i) => {
    const rampName = layout.title.wordRamps[Math.min(i, layout.title.wordRamps.length - 1)] ?? '';
    // Word by word lays out exactly as measureText does for the whole name.
    x = drawText(frame, titleFont, word, x, y, getRamp(titleFont, rampName));
    if (i < words.length - 1) x += titleFont.spaceAdvance;
  });

  // The build line, centred at the foot of the frame.
  const smallFont = font(art, layout.build.font);
  const bx = Math.floor((LOGICAL_WIDTH - measureText(smallFont, text.buildLine)) / 2);
  const by = LOGICAL_HEIGHT - layout.build.bottomMargin - smallFont.height;
  drawText(frame, smallFont, text.buildLine, bx, by, getRamp(smallFont, layout.build.ramp));
  return frame;
}
