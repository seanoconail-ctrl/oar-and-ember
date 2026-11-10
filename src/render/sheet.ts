/**
 * Sprite sheet sources (Book 2 section 19, Book 7 section 11): one text file per sheet giving the
 * palette, frame size, pivot (the foot anchor), footprint, facings and animations, then every frame
 * as rows of single-character palette codes:
 *
 *   sheet: actor_p_steerer_a
 *   kind: sprite                      sprite | tile | decal | prop
 *   palette: book07
 *   size: 32x40
 *   pivot: 16,39
 *   footprint: 10x4
 *   facings: s n e w                  "-" for sheets without facings
 *   anim.idle: frames 4, ticks 12, loop
 *   event.idle.0: footstep            optional animation events
 *   placeholder: false
 *   reserved: 1                       reserved accents this sheet may use (Book 7 section 08)
 *   frame idle s 0
 *   ................................
 *   end
 *
 * Compiling fails on unknown palette codes, wrong frame sizes, missing facings or missing states.
 */
import { ArtSourceError, parseArtSource, requireHeader } from './artSource.ts';
import type { ArtSource } from './artSource.ts';
import { createIndexedImage } from './indexedImage.ts';
import type { IndexedImage } from './indexedImage.ts';
import type { Palette } from './palette.ts';

export type SheetKind = 'sprite' | 'tile' | 'decal' | 'prop';

export interface Anim {
  readonly frames: number;
  readonly ticks: number;
  readonly loop: boolean;
}

export type Pose = 'lying' | 'carried' | 'seated';
const POSES: readonly Pose[] = ['lying', 'carried', 'seated'];

export interface Sheet {
  readonly name: string;
  readonly kind: SheetKind;
  readonly width: number;
  readonly height: number;
  readonly pivot: { readonly x: number; readonly y: number };
  readonly footprint: { readonly w: number; readonly h: number };
  readonly facings: readonly string[];
  readonly anims: Readonly<Record<string, Anim>>;
  readonly events: Readonly<Record<string, string>>;
  /** States that are not a standing figure: lying, carried or seated (`pose.<state>` headers). */
  readonly poses: Readonly<Record<string, Pose>>;
  readonly placeholder: boolean;
  /** Palette codes of reserved accents this sheet is allowed to use. */
  readonly reserved: readonly string[];
  /** Frames keyed "state/facing/index", as palette indices. */
  readonly frames: ReadonlyMap<string, IndexedImage>;
  /** Source line of each frame, for lint messages. */
  readonly frameLines: ReadonlyMap<string, number>;
}

export const NO_FACING = '-';

export function frameKey(state: string, facing: string, index: number): string {
  return `${state}/${facing}/${index}`;
}

function pair(source: ArtSource, key: string, sep: string): [number, number] {
  const { value, line } = requireHeader(source, key);
  const m = new RegExp(`^(\\d+)${sep}(\\d+)$`).exec(value);
  if (m === null) throw new ArtSourceError(source.file, line, `"${key}" must look like 32${sep}40`);
  return [Number(m[1]), Number(m[2])];
}

export function compileSheet(text: string, file: string, palette: Palette): Sheet {
  const source = parseArtSource(text, file);
  const fail = (line: number, reason: string): never => {
    throw new ArtSourceError(file, line, reason);
  };
  const name = requireHeader(source, 'sheet').value;
  const kindHeader = requireHeader(source, 'kind');
  const kinds: readonly SheetKind[] = ['sprite', 'tile', 'decal', 'prop'];
  const kind =
    kinds.find((k) => k === kindHeader.value) ??
    fail(kindHeader.line, `kind must be one of ${kinds.join(', ')}`);
  const paletteName = requireHeader(source, 'palette');
  if (paletteName.value !== palette.name)
    fail(paletteName.line, `expects palette "${paletteName.value}"`);
  const [width, height] = pair(source, 'size', 'x');
  const [px, py] = pair(source, 'pivot', ',');
  if (px >= width || py >= height)
    fail(requireHeader(source, 'pivot').line, 'pivot lies outside the frame');
  const [fw, fh] = pair(source, 'footprint', 'x');
  const facings = requireHeader(source, 'facings').value.split(/\s+/);
  const placeholder = source.header.get('placeholder')?.value === 'true';
  const reserved = (source.header.get('reserved')?.value ?? '')
    .split(/\s+/)
    .filter((c) => c !== '');

  const anims: Record<string, Anim> = {};
  const events: Record<string, string> = {};
  const poses: Record<string, Pose> = {};
  for (const [key, { value, line }] of source.header) {
    if (key.startsWith('pose.')) {
      const pose = POSES.find((p) => p === value);
      if (pose === undefined) fail(line, `"${key}" must be one of ${POSES.join(', ')}`);
      else poses[key.slice(5)] = pose;
    }
    if (key.startsWith('anim.')) {
      const m = /^frames (\d+), ticks (\d+)(, loop)?$/.exec(value);
      if (m === null) fail(line, `"${key}" must look like "frames 4, ticks 12, loop"`);
      anims[key.slice(5)] = {
        frames: Number(m?.[1]),
        ticks: Number(m?.[2]),
        loop: m?.[3] !== undefined,
      };
    } else if (key.startsWith('event.')) {
      events[key.slice(6)] = value;
    }
  }
  if (Object.keys(anims).length === 0) fail(1, 'a sheet needs at least one anim.<state> header');

  const frames = new Map<string, IndexedImage>();
  const frameLines = new Map<string, number>();
  for (const block of source.blocks) {
    if (block.kind !== 'frame') fail(block.line, `unexpected block "${block.kind}"`);
    const parts = block.name.split(/\s+/);
    if (parts.length !== 3) fail(block.line, 'a frame is named "<state> <facing> <index>"');
    const [state = '', facing = '', indexText = ''] = parts;
    const anim = anims[state] ?? fail(block.line, `frame for undeclared state "${state}"`);
    if (!facings.includes(facing)) fail(block.line, `frame for undeclared facing "${facing}"`);
    const index = Number(indexText);
    if (!Number.isInteger(index) || index < 0 || index >= anim.frames) {
      fail(block.line, `frame index ${indexText} is outside 0 to ${anim.frames - 1}`);
    }
    const key = frameKey(state, facing, index);
    if (frames.has(key)) fail(block.line, `frame "${block.name}" is defined twice`);
    if (block.rows.length !== height)
      fail(block.line, `frame has ${block.rows.length} rows; the sheet is ${height} high`);
    const image = createIndexedImage(width, height);
    block.rows.forEach((row, r) => {
      const chars = Array.from(row);
      if (chars.length !== width)
        fail(block.line + 1 + r, `row is ${chars.length} wide; the sheet is ${width} wide`);
      chars.forEach((ch, c) => {
        if (ch === palette.transparent) return;
        const value = palette.indexOf.get(ch);
        if (value === undefined)
          fail(block.line + 1 + r, `column ${c + 1}: "${ch}" is not a ${palette.name} code`);
        else image.pixels[r * width + c] = value;
      });
    });
    frames.set(key, image);
    frameLines.set(key, block.line);
  }
  for (const [state, anim] of Object.entries(anims)) {
    for (const facing of facings) {
      for (let i = 0; i < anim.frames; i++) {
        if (!frames.has(frameKey(state, facing, i)))
          fail(1, `missing frame "${state} ${facing} ${i}"`);
      }
    }
  }
  return {
    name,
    kind,
    width,
    height,
    pivot: { x: px, y: py },
    footprint: { w: fw, h: fh },
    facings,
    anims,
    events,
    poses,
    placeholder,
    reserved,
    frames,
    frameLines,
  };
}
