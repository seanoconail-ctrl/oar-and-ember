/**
 * Art lint (Book 7 section 11 QA checklist, Book 2 section 19). Pure checks over compiled sheets;
 * `lint.ts` adds the check that generated sheets and compiled atlases match their sources.
 */
import { NO_PIXEL } from '../../render/indexedImage.ts';
import type { Palette } from '../../render/palette.ts';
import type { Sheet } from '../../render/sheet.ts';

export interface ArtIssue {
  readonly sheet: string;
  readonly frame?: string;
  readonly reason: string;
}

/** Book 7 section 11 naming patterns (plus prop_ and decal_ for scenery and gore layers). */
export const SHEET_NAME = /^(actor|ship|token|tile|bld|fx|prop|decal)_[a-z0-9]+(_[a-z0-9]+)*$/;

/** Book 7 section 01: a 32 x 40 canvas, foot anchor at bottom centre, about 18 x 30 occupied. */
export const ACTOR = {
  width: 32,
  height: 40,
  pivot: { x: 16, y: 39 },
  occupied: { w: [12, 22], h: [24, 34] },
} as const;
export const TILE_SIZE = 24;

function bounds(
  pixels: Uint8Array,
  w: number,
  h: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((pixels[y * w + x] ?? NO_PIXEL) === NO_PIXEL) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

export function lintSheet(sheet: Sheet, palette: Palette): ArtIssue[] {
  const issues: ArtIssue[] = [];
  const add = (reason: string, frame?: string): void => {
    issues.push(
      frame === undefined ? { sheet: sheet.name, reason } : { sheet: sheet.name, frame, reason },
    );
  };
  if (!SHEET_NAME.test(sheet.name))
    add('name does not follow Book 7 section 11 (actor_, tile_, prop_, decal_, ...)');
  const isActor = sheet.name.startsWith('actor_');
  if (isActor) {
    if (sheet.width !== ACTOR.width || sheet.height !== ACTOR.height)
      add(`an actor canvas is ${ACTOR.width} x ${ACTOR.height}`);
    if (sheet.pivot.x !== ACTOR.pivot.x || sheet.pivot.y !== ACTOR.pivot.y)
      add('an actor pivot is the foot anchor at bottom centre (16,39)');
    if (['s', 'n', 'e', 'w'].some((f) => !sheet.facings.includes(f)))
      add('a person has four facings: s n e w');
  }
  if (sheet.kind === 'tile' && (sheet.width !== TILE_SIZE || sheet.height !== TILE_SIZE))
    add('a tile is 24 x 24');

  const ink = palette.indexOf.get('k');
  const reserved = new Set(
    palette.entries.flatMap((e, i) => (e.reserved && !sheet.reserved.includes(e.code) ? [i] : [])),
  );
  const footRows = new Map<string, number>();
  for (const [key, image] of sheet.frames) {
    const { width: w, height: h, pixels } = image;
    const at = (x: number, y: number): number =>
      x < 0 || y < 0 || x >= w || y >= h ? NO_PIXEL : (pixels[y * w + x] ?? NO_PIXEL);
    let badEdge = 0;
    let transparent = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = at(x, y);
        if (v === NO_PIXEL) {
          transparent++;
          continue;
        }
        if (reserved.has(v))
          add(`uses the reserved accent "${palette.entries[v]?.name ?? v}"`, key);
        const onEdge = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes(NO_PIXEL);
        if (onEdge && v !== ink) badEdge++;
      }
    }
    if ((sheet.kind === 'sprite' || sheet.kind === 'prop') && badEdge > 0) {
      add(`${badEdge} edge pixel(s) are not the one-pixel ink outline (Book 7 section 11)`, key);
    }
    if (sheet.kind === 'tile' && transparent > 0) add('a ground tile must be fully opaque', key);
    const box = bounds(pixels, w, h);
    if (box === null) {
      add('the frame is empty', key);
      continue;
    }
    if (sheet.kind === 'sprite' || sheet.kind === 'prop') {
      if (box.y1 !== sheet.pivot.y)
        add(`the feet (lowest row ${box.y1}) are not on the pivot row ${sheet.pivot.y}`, key);
      footRows.set(key.split('/')[0] ?? '', box.y1);
    }
    if (isActor) {
      const ow = box.x1 - box.x0 + 1;
      const oh = box.y1 - box.y0 + 1;
      if (
        ow < ACTOR.occupied.w[0] ||
        ow > ACTOR.occupied.w[1] ||
        oh < ACTOR.occupied.h[0] ||
        oh > ACTOR.occupied.h[1]
      ) {
        add(`occupies ${ow} x ${oh}; an adult is about 18 x 30 (Book 7 section 01)`, key);
      }
    }
  }
  return issues;
}

export function placeholders(sheets: readonly Sheet[]): string[] {
  return sheets.filter((s) => s.placeholder).map((s) => s.name);
}
