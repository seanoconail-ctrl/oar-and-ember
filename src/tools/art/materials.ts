/**
 * The material-map generator (Book 7 section 11 allows deterministic generator scripts committed
 * with their output). A map draws each base pose with one letter per material (hair, skin, tunic,
 * cloak...) and lowercase marks for fixed details (eyes). The generator writes the palette-coded
 * sheet that the art compiler reads:
 *
 * - a one-pixel ink outline around the figure;
 * - three-tone shading lit from the upper left: an edge facing up or left takes the material's
 *   highlight, an edge facing down or right its shadow, and a material just below another takes a
 *   cast shadow;
 * - animation frames built from the base pose (`bob.<state>`: per-frame vertical offsets for the
 *   rows above a line, the idle breath);
 * - mirrored facings (`mirror.w: e`), shaded after mirroring so the light still comes from the
 *   upper left.
 *
 * Map headers, in addition to the sheet headers they pass through:
 *   material.T: o r t        highlight, base, shadow palette codes for material letter T
 *   mark.e: k                a fixed palette code for mark letter e
 *   outline: k 4             outline code and neighbourhood (4 or 8)
 *   bob.idle: 0 1 1 0 above 27
 *   mirror.w: e
 *   derive.walk: idle         a state with no base pose of its own starts from another's
 *   move.walk.s: - | 12,29,14,38:0,-1 | ...
 *                             per frame (separated by |), parts of the pose moved: a box
 *                             x0,y0,x1,y1 (inclusive) shifted by dx,dy; "-" for none
 *   drop.sneak: 30 32         rows removed and everything above lowered (a crouch)
 *   frame walk e 3            a frame drawn in full replaces the base pose for that frame
 *   alias.down.s: e           a state's facing drawn from another facing ("e mirror" flips it)
 *
 * Each frame is built in this order: base pose, moves, drop, bob, mirror, then shading.
 */
import { ArtSourceError, parseArtSource, requireHeader } from '../../render/artSource.ts';

const PASS_THROUGH = [
  'sheet',
  'kind',
  'palette',
  'size',
  'pivot',
  'footprint',
  'facings',
  'placeholder',
  'reserved',
];

type Grid = string[][];

function shade(
  map: Grid,
  materials: Map<string, [string, string, string]>,
  marks: Map<string, string>,
  outline: { code: string; n: 4 | 8 },
): string[] {
  const h = map.length;
  const w = map[0]?.length ?? 0;
  const at = (x: number, y: number): string =>
    x < 0 || y < 0 || x >= w || y >= h ? '.' : (map[y]?.[x] ?? '.');
  const body = (x: number, y: number): boolean => at(x, y) !== '.';
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const cell = at(x, y);
      if (cell === '.') {
        const edge = body(x - 1, y) || body(x + 1, y) || body(x, y - 1) || body(x, y + 1);
        const corner =
          body(x - 1, y - 1) || body(x + 1, y - 1) || body(x - 1, y + 1) || body(x + 1, y + 1);
        row += edge || (outline.n === 8 && corner) ? outline.code : '.';
        continue;
      }
      const mark = marks.get(cell);
      if (mark !== undefined) {
        row += mark;
        continue;
      }
      const ramp = materials.get(cell);
      if (ramp === undefined) throw new Error(`map letter "${cell}" has no material or mark`);
      const [hi, base, sh] = ramp;
      const up = at(x, y - 1);
      if (up === '.' || at(x - 1, y) === '.') row += hi;
      else if (at(x, y + 1) === '.' || at(x + 1, y) === '.') row += sh;
      else if (up !== cell && !marks.has(up)) row += sh;
      else row += base;
    }
    rows.push(row);
  }
  return rows;
}

/** Moves the rows above `above` down by `offset` pixels (the idle breath). */
function bob(map: Grid, offset: number, above: number): Grid {
  const out = map.map((r) => [...r]);
  if (offset === 0) return out;
  const width = map[0]?.length ?? 0;
  for (let y = above - 1; y >= 0; y--) {
    const source = map[y];
    if (y + offset < out.length && source !== undefined) out[y + offset] = [...source];
  }
  for (let y = 0; y < offset; y++) out[y] = new Array<string>(width).fill('.');
  return out;
}

interface Move {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly dx: number;
  readonly dy: number;
}

function parseMoves(value: string, file: string, line: number): Move[][] {
  return value.split('|').map((frame) => {
    const text = frame.trim();
    if (text === '-') return [];
    return text.split(/\s+/).map((part) => {
      const m = /^(\d+),(\d+),(\d+),(\d+):(-?\d+),(-?\d+)$/.exec(part);
      if (m === null)
        throw new ArtSourceError(file, line, `a move looks like "12,29,14,38:0,-1", not "${part}"`);
      const [x0, y0, x1, y1, dx, dy] = m.slice(1).map(Number) as [
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      return { x0, y0, x1, y1, dx, dy };
    });
  });
}

/** Lifts the drawn pixels inside each box and sets them down shifted, in order. */
function applyMoves(map: Grid, moves: readonly Move[]): Grid {
  let out = map.map((r) => [...r]);
  for (const m of moves) {
    const next = out.map((r) => [...r]);
    const lifted: [number, number, string][] = [];
    for (let y = m.y0; y <= m.y1; y++) {
      for (let x = m.x0; x <= m.x1; x++) {
        const cell = out[y]?.[x];
        if (cell === undefined || cell === '.') continue;
        lifted.push([x, y, cell]);
        const row = next[y];
        if (row !== undefined) row[x] = '.';
      }
    }
    for (const [x, y, cell] of lifted) {
      const row = next[y + m.dy];
      if (row !== undefined && x + m.dx >= 0 && x + m.dx < row.length) row[x + m.dx] = cell;
    }
    out = next;
  }
  return out;
}

/** Removes rows y0 to y1 and lowers everything above them (a crouch). */
function drop(map: Grid, y0: number, y1: number): Grid {
  const width = map[0]?.length ?? 0;
  const count = y1 - y0 + 1;
  const kept = [...map.slice(0, y0), ...map.slice(y1 + 1)];
  return [...Array.from({ length: count }, () => new Array<string>(width).fill('.')), ...kept];
}

/** Generates the palette-coded sheet text from a material map. */
export function generateSheet(mapText: string, file: string): string {
  const source = parseArtSource(mapText, file);
  const materials = new Map<string, [string, string, string]>();
  const marks = new Map<string, string>();
  const bobs = new Map<string, { offsets: number[]; above: number }>();
  const mirrors = new Map<string, string>();
  const derives = new Map<string, string>();
  const moves = new Map<string, Move[][]>();
  const drops = new Map<string, [number, number]>();
  const aliases = new Map<string, { facing: string; mirror: boolean }>();
  for (const [key, { value, line }] of source.header) {
    if (key.startsWith('derive.')) derives.set(key.slice(7), value);
    if (key.startsWith('alias.')) {
      const m = /^(\S+)( mirror)?$/.exec(value);
      if (m === null)
        throw new ArtSourceError(file, line, '"alias" must look like "e" or "e mirror"');
      aliases.set(key.slice(6), { facing: m[1] ?? '', mirror: m[2] !== undefined });
    }
    if (key.startsWith('move.')) moves.set(key.slice(5), parseMoves(value, file, line));
    if (key.startsWith('drop.')) {
      const m = /^(\d+) (\d+)$/.exec(value);
      if (m === null) throw new ArtSourceError(file, line, '"drop" must look like "30 32"');
      drops.set(key.slice(5), [Number(m[1]), Number(m[2])]);
    }
    if (key.startsWith('material.')) {
      const codes = value.split(/\s+/);
      if (codes.length !== 3)
        throw new ArtSourceError(file, line, 'a material lists highlight, base and shadow codes');
      materials.set(key.slice(9), [codes[0] ?? '', codes[1] ?? '', codes[2] ?? '']);
    } else if (key.startsWith('mark.')) {
      marks.set(key.slice(5), value);
    } else if (key.startsWith('bob.')) {
      const m = /^([\d ]+) above (\d+)$/.exec(value);
      if (m === null)
        throw new ArtSourceError(file, line, '"bob" must look like "0 1 1 0 above 27"');
      bobs.set(key.slice(4), {
        offsets: (m[1] ?? '').trim().split(/\s+/).map(Number),
        above: Number(m[2]),
      });
    } else if (key.startsWith('mirror.')) {
      mirrors.set(key.slice(7), value);
    }
  }
  const outlineHeader = requireHeader(source, 'outline').value.split(/\s+/);
  const outline = {
    code: outlineHeader[0] ?? 'k',
    n: outlineHeader[1] === '8' ? (8 as const) : (4 as const),
  };

  const lines: string[] = [
    `# Generated by src/tools/art/materials.ts from ${file}. Do not edit by hand:`,
    '# change the map and run npm run art:sheets.',
  ];
  for (const key of PASS_THROUGH) {
    const entry = source.header.get(key);
    if (entry !== undefined) lines.push(`${key}: ${entry.value}`);
  }
  for (const [key, { value }] of source.header) {
    if (key.startsWith('anim.') || key.startsWith('event.') || key.startsWith('pose.'))
      lines.push(`${key}: ${value}`);
  }

  const bases = new Map<string, Grid>();
  for (const block of source.blocks)
    bases.set(
      block.name,
      block.rows.map((r) => Array.from(r)),
    );
  const facings = requireHeader(source, 'facings').value.split(/\s+/);
  for (const [key, { value }] of source.header) {
    if (!key.startsWith('anim.')) continue;
    const state = key.slice(5);
    const frames = Number(/frames (\d+)/.exec(value)?.[1] ?? '1');
    for (const facing of facings) {
      // Which drawn facing this one comes from, and whether it is flipped.
      let from = facing;
      let flip = false;
      const alias = aliases.get(`${state}.${facing}`);
      if (alias !== undefined) {
        from = alias.facing;
        flip = alias.mirror;
      }
      const mirrorOf = mirrors.get(from);
      if (mirrorOf !== undefined && !bases.has(`${state} ${from} 0`)) {
        from = mirrorOf;
        flip = !flip;
      }
      const baseState = bases.has(`${state} ${from} 0`) ? state : (derives.get(state) ?? state);
      const base = bases.get(`${baseState} ${from} 0`);
      if (base === undefined)
        throw new ArtSourceError(file, 1, `no base pose "${state} ${from} 0"`);
      const frameMoves = moves.get(`${state}.${from}`);
      if (frameMoves !== undefined && frameMoves.length !== frames)
        throw new ArtSourceError(
          file,
          1,
          `move.${state}.${from} lists ${frameMoves.length} frames; anim.${state} has ${frames}`,
        );
      const crouch = drops.get(`${state}.${from}`) ?? drops.get(state);
      for (let i = 0; i < frames; i++) {
        // A map may draw a frame of its own ("walk e 3"); otherwise frame 0 is the base.
        let pose = applyMoves(
          bases.get(`${baseState} ${from} ${i}`) ?? base,
          frameMoves?.[i] ?? [],
        );
        if (crouch !== undefined) pose = drop(pose, crouch[0], crouch[1]);
        const motion = bobs.get(state);
        if (motion !== undefined)
          pose = bob(pose, motion.offsets[i % motion.offsets.length] ?? 0, motion.above);
        if (flip) pose = pose.map((r) => [...r].reverse());
        lines.push(
          '',
          `frame ${state} ${facing} ${i}`,
          ...shade(pose, materials, marks, outline),
          'end',
        );
      }
    }
  }
  return `${lines.join('\n')}\n`;
}
