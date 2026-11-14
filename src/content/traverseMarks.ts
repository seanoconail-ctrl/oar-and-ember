/**
 * How a zone's plan marks the movement verbs (Book 9 section 12, "Movement verbs in a plan"; Book 2
 * section 10, "Movement verbs and hazards"; decisions S14-14 and S14-51). A verb starts only where
 * the plan marks it, so ordinary ground never climbs, swims, jumps or crawls by accident. Every
 * position is in tiles of the zone, as props and spawns are.
 *
 * The zone plan (src/tools/levels/zones.ts) writes these into the zone's map file as `traverse`;
 * the runtime reads them with `marksOf`, and `checkMarks` holds them to Book 10's numbers.
 */

/** A marked climbing route: one column of hand-holds from its foot up to its head. */
export interface ClimbMark {
  /** Zone-local key. */
  readonly id: string;
  /** The column the hand-holds run up. */
  readonly x: number;
  /** The row of open ground at the route's foot (the larger y). */
  readonly foot: number;
  /** The row of open ground at its head (the smaller y). */
  readonly head: number;
  /** The rows of the ledges between, where a climber rests (Book 10 climbLedgeEvery). */
  readonly ledges: readonly number[];
}

/** Deep water a person may swim in (Book 9 section 01: every deep tile that may be entered). */
export interface SwimMark {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A short gap with a marked take-off and landing (both ways unless `oneWay`). */
export interface JumpMark {
  readonly id: string;
  /** Tile of the take-off and of the landing. */
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  readonly oneWay?: boolean;
}

/** A low gap crawled through: its tiles in order, each touching the last by a side. */
export interface CrawlMark {
  readonly id: string;
  readonly tiles: readonly (readonly [number, number])[];
  /** The open tiles at its two ends (default: one tile on past each end). */
  readonly mouths?: readonly [readonly [number, number], readonly [number, number]];
}

/** A heavy object and the line of tiles it moves along (Book 9 section 12, "Push and pull"). */
export interface PushMark {
  readonly id: string;
  /** Its tiles in order, each touching the last by a side. */
  readonly line: readonly (readonly [number, number])[];
  /** Where on the line it lies at the start. */
  readonly start: number;
  /** A fact that must hold before it moves (the niche's stone, once the cross is read). */
  readonly fact?: string;
  /** The prop drawn for it. */
  readonly sheet: string;
  readonly frame: string;
}

/** The bog's soft ground: slow in rain (Book 10 bogSoftRain). */
export interface SoftMark {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface TraverseMarks {
  readonly climbs: readonly ClimbMark[];
  readonly swims: readonly SwimMark[];
  readonly jumps: readonly JumpMark[];
  readonly crawls: readonly CrawlMark[];
  readonly pushes: readonly PushMark[];
  readonly soft: readonly SoftMark[];
}

export const NO_MARKS: TraverseMarks = {
  climbs: [],
  swims: [],
  jumps: [],
  crawls: [],
  pushes: [],
  soft: [],
};

/** A zone map with its marks (the zone file's `traverse`, absent where nothing is marked). */
export interface MarkedMap {
  readonly traverse?: Partial<TraverseMarks>;
}

const cache = new WeakMap<object, TraverseMarks>();

/** The marks of a zone, every list present (empty where the plan marks none). */
export function marksOf(map: object): TraverseMarks {
  const hit = cache.get(map);
  if (hit !== undefined) return hit;
  const t = (map as MarkedMap).traverse;
  // Nothing marked is not remembered, so marks added later are read (a test zone's).
  if (t === undefined) return NO_MARKS;
  const marks: TraverseMarks = {
    climbs: t.climbs ?? [],
    swims: t.swims ?? [],
    jumps: t.jumps ?? [],
    crawls: t.crawls ?? [],
    pushes: t.pushes ?? [],
    soft: t.soft ?? [],
  };
  cache.set(map, marks);
  return marks;
}

/** The two open tiles at a crawl's ends. */
export function crawlMouths(
  c: CrawlMark,
): readonly [readonly [number, number], readonly [number, number]] {
  if (c.mouths !== undefined) return c.mouths;
  const t = c.tiles;
  const a = t[0] ?? [0, 0];
  const b = t[1] ?? a;
  const y = t[t.length - 1] ?? a;
  const z = t[t.length - 2] ?? y;
  return [
    [2 * a[0] - b[0], 2 * a[1] - b[1]],
    [2 * y[0] - z[0], 2 * y[1] - z[1]],
  ];
}

/** The gap a jump crosses, in tiles: the distance between its two tiles' near edges. */
export function jumpGapTiles(j: JumpMark): number {
  return Math.max(0, Math.hypot(j.to.x - j.from.x, j.to.y - j.from.y) - 1);
}

const touches = (a: readonly [number, number], b: readonly [number, number]): boolean =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

/**
 * What is wrong with a zone's marks against Book 10 (the jump's gap, the ledges' spacing) and the
 * shape rules (a crawl's or a line's tiles touch by a side; a climb's ledges lie between its ends;
 * a heavy object starts on its line). `open(x, y)` says whether a tile is ground a person can stand
 * on, for the reset rule: every step of a heavy object along its line can be undone, from a tile
 * a person can stand on (Book 9 section 12).
 */
export function checkMarks(
  marks: TraverseMarks,
  numbers: { readonly jumpGap: number; readonly climbLedgeEvery: number },
  open: (x: number, y: number) => boolean,
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const unique = (kind: string, id: string): void => {
    if (ids.has(`${kind}:${id}`)) problems.push(`${kind} ${id} is marked twice`);
    ids.add(`${kind}:${id}`);
  };
  for (const c of marks.climbs) {
    unique('climb', c.id);
    if (c.head >= c.foot) problems.push(`climb ${c.id}: its head must lie above its foot`);
    const rests = [c.foot, ...[...c.ledges].sort((a, b) => b - a), c.head];
    for (const l of c.ledges)
      if (l >= c.foot || l <= c.head) problems.push(`climb ${c.id}: ledge ${l} is not between`);
    for (let i = 1; i < rests.length; i++) {
      const gap = (rests[i - 1] ?? 0) - (rests[i] ?? 0);
      if (gap > numbers.climbLedgeEvery)
        problems.push(
          `climb ${c.id}: ${gap} tiles between rests, more than climbLedgeEvery (${numbers.climbLedgeEvery})`,
        );
    }
  }
  for (const s of [...marks.swims, ...marks.soft])
    if (s.w <= 0 || s.h <= 0) problems.push('a swim or soft-ground mark has no size');
  for (const j of marks.jumps) {
    unique('jump', j.id);
    const gap = jumpGapTiles(j);
    if (gap > numbers.jumpGap + 1e-9)
      problems.push(`jump ${j.id}: a gap of ${gap.toFixed(2)} tiles, wider than jumpGap`);
    if (!open(j.from.x, j.from.y) || !open(j.to.x, j.to.y))
      problems.push(`jump ${j.id}: its take-off and landing must be open ground`);
  }
  for (const c of marks.crawls) {
    unique('crawl', c.id);
    if (c.tiles.length < 1 || (c.mouths === undefined && c.tiles.length < 2))
      problems.push(`crawl ${c.id}: too short to find its mouths`);
    for (let i = 1; i < c.tiles.length; i++) {
      const a = c.tiles[i - 1];
      const b = c.tiles[i];
      if (a !== undefined && b !== undefined && !touches(a, b))
        problems.push(`crawl ${c.id}: tiles ${i - 1} and ${i} do not touch by a side`);
    }
    for (const m of crawlMouths(c))
      if (!open(m[0], m[1])) problems.push(`crawl ${c.id}: its mouth (${m[0]}, ${m[1]}) is closed`);
  }
  for (const p of marks.pushes) {
    unique('push', p.id);
    if (!Number.isInteger(p.start) || p.start < 0 || p.start >= p.line.length)
      problems.push(`push ${p.id}: its start is not on its line`);
    for (let i = 1; i < p.line.length; i++) {
      const a = p.line[i - 1];
      const b = p.line[i];
      if (a === undefined || b === undefined) continue;
      if (!touches(a, b)) {
        problems.push(`push ${p.id}: tiles ${i - 1} and ${i} do not touch by a side`);
        continue;
      }
      // Moved from a to b, it comes back by a push from beyond b or a pull from a, stepping back
      // to behind a; and it goes from a to b by a push from behind a or a pull from b, stepping
      // back to beyond b. Either way one of the two tiles must be ground to stand on (the reset
      // rule).
      const d = [b[0] - a[0], b[1] - a[1]] as const;
      if (!open(b[0] + d[0], b[1] + d[1]) && !open(a[0] - d[0], a[1] - d[1]))
        problems.push(`push ${p.id}: the step between tiles ${i - 1} and ${i} cannot be undone`);
    }
  }
  return problems;
}
