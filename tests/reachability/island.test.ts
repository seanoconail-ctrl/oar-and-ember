/**
 * Stage 14 acceptance check 1 (Book 9 section 13, "Skarvholm's scenes"; decisions S14-1 to S14-5,
 * S14-30 to S14-49): every scene of the island, and the two interiors, is reached on foot from the
 * strand's waking place under each tide (low water, high water, a spring low) and each season,
 * through the links between scenes, using the movement verbs only where the zones' markup allows
 * them (`traverse`: climbs, swims, jumps, crawls and heavy objects moved along their lines; the
 * portals of the back wall and the cairn's door). The verbs' own rules are the movement code's
 * (src/sim/land/traverse.ts); this reads the markup the zone plans write, so it holds the layout
 * to the rule whatever the verbs' timings.
 *
 * Seasons change nothing here: no zone's collision changes with the season (frozen pools are
 * walked on where open pools are waded; both are open ground).
 */
import { describe, expect, it } from 'vitest';
import { SEASONS } from '../../src/content/balance.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { bandAt, isDeep } from '../../src/sim/land/water.ts';
import { linkOf, translate } from '../../src/sim/land/zoneLinks.ts';
import { solidAt, terrainAt, tileBlocks } from '../../src/sim/land/zoneMap.ts';
import type { ZoneMap } from '../../src/sim/land/zoneMap.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import type { ZoneMarkup } from '../../src/tools/levels/zones.ts';

const balance = loadBalanceJson();
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const maps = land.maps;

/** The island's scenes and interiors (the sea wreck is reached by boat, not on foot). */
const ISLAND = [
  'ZONE_SK_STRAND',
  'ZONE_SK_MACHAIR',
  'ZONE_SK_HAGSEAT',
  'ZONE_SK_CAIRN',
  'ZONE_SK_SEALCAVE',
  'ZONE_SK_NAUST',
  'ZONE_SK_SKERRY',
  'ZONE_SK_GEO',
  'ZONE_SK_CLIFFS',
  'ZONE_SK_ROOK',
  'ZONE_SK_BOG',
  'ZONE_SK_SEALCAVE_DEEP',
  'ZONE_SK_CAIRN_IN',
] as const;
const INTERIORS = new Set(['ZONE_SK_SEALCAVE_DEEP', 'ZONE_SK_CAIRN_IN']);

interface Tide {
  readonly name: string;
  readonly open: boolean;
  readonly spring: boolean;
  /** The still water level (0 low water, 1 high). */
  readonly level: number;
}
const HIGH: Tide = { name: 'high water', open: false, spring: false, level: 1 };
const HALF: Tide = { name: 'half tide', open: false, spring: false, level: 0.5 };
const LOW: Tide = { name: 'low water', open: true, spring: false, level: 0 };
const SPRING: Tide = { name: 'a spring low', open: true, spring: true, level: 0 };
const TIDES: readonly Tide[] = [HIGH, HALF, LOW, SPRING];

interface Options {
  readonly tide: Tide;
  /** Facts that hold (the cairn's door). */
  readonly facts?: ReadonlySet<string>;
  /** Carrying: no crawl, no climb, no swim, no jump (Book 2 section 10). */
  readonly carrying?: boolean;
  /** Verbs left out, to show a place needs them. */
  readonly without?: ReadonlySet<'climb' | 'jump' | 'crawl' | 'swim'>;
  /** Only these zones (a link's two sides). */
  readonly only?: ReadonlySet<string>;
  /** Heavy objects moved off their start: "<zone>/<id>" to the index on its line. */
  readonly pushed?: ReadonlyMap<string, number>;
}

const markup = (map: ZoneMap): ZoneMarkup => map as unknown as ZoneMarkup;
function mapOf(zone: string): ZoneMap {
  const map = maps.get(zone);
  if (map === undefined) throw new Error(`no map for ${zone}`);
  return map;
}
const key = (zone: string, x: number, y: number): string => `${zone}:${x},${y}`;

/** Whether a tile is ground a person stands on under the options. */
function open(map: ZoneMap, x: number, y: number, o: Options): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const t = markup(map).traverse;
  for (const p of t?.pushes ?? []) {
    const at = p.line[o.pushed?.get(`${map.zone}/${p.id}`) ?? p.start];
    if (at?.[0] === x && at[1] === y) return false;
  }
  if (!tileBlocks(map, x, y, o.tide.open, o.tide.spring)) {
    const el = land.elevations.get(map.zone);
    if (el === undefined) return true;
    const deep = isDeep(
      bandAt(land.water, el, (x + 0.5) * map.tile, (y + 0.7) * map.tile, o.tide.level),
    );
    if (!deep) return true;
  }
  if (o.carrying !== true && o.without?.has('swim') !== true)
    for (const s of t?.swims ?? [])
      if (x >= s.x && y >= s.y && x < s.x + s.w && y < s.y + s.h && terrainAt(map, x, y) === 'sea')
        return true;
  return false;
}

/** The marked moves out of a tile: crawls, climbs and jumps (both ways unless one way). */
function verbs(map: ZoneMap, x: number, y: number, o: Options): [number, number][] {
  const out: [number, number][] = [];
  if (o.carrying === true) return out;
  const t = markup(map).traverse;
  if (o.without?.has('crawl') !== true)
    for (const c of t?.crawls ?? []) {
      const chain = [c.mouths?.[0], ...c.tiles, c.mouths?.[1]].filter(
        (v): v is readonly [number, number] => v !== undefined,
      );
      chain.forEach(([cx, cy], i) => {
        if (cx !== x || cy !== y) return;
        const a = chain[i - 1];
        const b = chain[i + 1];
        if (a !== undefined) out.push([a[0], a[1]]);
        if (b !== undefined) out.push([b[0], b[1]]);
      });
    }
  if (o.without?.has('climb') !== true)
    for (const c of t?.climbs ?? [])
      if (c.x === x && y >= c.head && y <= c.foot) {
        if (y > c.head) out.push([x, y - 1]);
        if (y < c.foot) out.push([x, y + 1]);
      }
  if (o.without?.has('jump') !== true)
    for (const j of t?.jumps ?? []) {
      if (j.from.x === x && j.from.y === y) out.push([j.to.x, j.to.y]);
      if (j.oneWay !== true && j.to.x === x && j.to.y === y) out.push([j.from.x, j.from.y]);
    }
  return out;
}

/** A tile on a marked move (a crawl's tiles, a climb's face) that is not open ground. */
function onVerb(map: ZoneMap, x: number, y: number, o: Options): boolean {
  if (o.carrying === true) return false;
  const t = markup(map).traverse;
  if (
    o.without?.has('crawl') !== true &&
    (t?.crawls ?? []).some((c) => c.tiles.some(([a, b]) => a === x && b === y))
  )
    return true;
  return (
    o.without?.has('climb') !== true &&
    (t?.climbs ?? []).some((c) => c.x === x && y >= c.head && y <= c.foot)
  );
}

/** Every tile of every zone reached from a start, by walking, the marked verbs and the links. */
function flood(start: { zone: string; x: number; y: number }, o: Options): Set<string> {
  const seen = new Set<string>();
  const queue: [string, number, number][] = [[start.zone, start.x, start.y]];
  const enter = (zone: string, x: number, y: number): void => {
    const map = maps.get(zone);
    if (map === undefined || seen.has(key(zone, x, y))) return;
    if (o.only !== undefined && !o.only.has(zone)) return;
    if (!open(map, x, y, o) && !onVerb(map, x, y, o)) return;
    seen.add(key(zone, x, y));
    queue.push([zone, x, y]);
  };
  const first = maps.get(start.zone);
  if (first !== undefined && open(first, start.x, start.y, o))
    seen.add(key(start.zone, start.x, start.y));
  for (const [zone, x, y] of queue) {
    const map = maps.get(zone);
    if (map === undefined) continue;
    const here = onVerb(map, x, y, o) && !open(map, x, y, o);
    for (const [nx, ny] of verbs(map, x, y, o)) enter(zone, nx, ny);
    if (!here)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < map.width && ny < map.height) {
          if (open(map, nx, ny, o)) enter(zone, nx, ny);
          continue;
        }
        // Over the edge: the link the point picks (zoneLinks.linkOf), into the same island tile.
        const edge = dx === 1 ? 'e' : dx === -1 ? 'w' : dy === 1 ? 's' : 'n';
        const px = (x + 0.5) * map.tile + dx * map.tile * 0.6;
        const py = (y + 0.5) * map.tile + dy * map.tile * 0.6;
        const to = linkOf(map, edge, { x: px, y: py }, maps);
        const other = to === null ? undefined : maps.get(to);
        if (other === undefined) continue;
        const p = translate(map, other, px, py);
        enter(other.zone, Math.floor(p.x / other.tile), Math.floor(p.y / other.tile));
      }
    // Portals: a link that is not an edge (the back wall, the cairn's door).
    for (const pt of markup(map).portals ?? []) {
      const r = pt.exit;
      const touches = [
        [x, y],
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].some(([a = 0, b = 0]) => a >= r.x && b >= r.y && a < r.x + r.w && b < r.y + r.h);
      if (!touches) continue;
      const when = pt.when;
      if (when !== undefined && 'tide' in when && !(o.tide.open && o.tide.spring)) continue;
      if (when !== undefined && 'fact' in when && o.facts?.has(when.fact) !== true) continue;
      enter(pt.to, Math.floor(pt.entry.x), Math.floor(pt.entry.y));
    }
  }
  return seen;
}

const strand = maps.get('ZONE_SK_STRAND');
const wake = strand?.spawns['P_STEERER'];
if (wake === undefined) throw new Error('no waking place on the strand');
const START = { zone: 'ZONE_SK_STRAND', x: Math.floor(wake.x), y: Math.floor(wake.y) };
const zonesIn = (seen: Set<string>): Set<string> =>
  new Set([...seen].map((k) => k.split(':')[0] ?? ''));
const reached = (seen: Set<string>, zone: string, x: number, y: number): boolean =>
  seen.has(key(zone, Math.floor(x), Math.floor(y)));

describe('the whole island on foot (Book 9 section 13)', () => {
  it('has every scene and interior of the partition built and linked', () => {
    for (const zone of ISLAND) expect(maps.has(zone), zone).toBe(true);
  });

  for (const season of SEASONS)
    for (const tide of TIDES) {
      it(`reaches every scene from the waking place in ${season} at ${tide.name}`, () => {
        const got = zonesIn(flood(START, { tide }));
        for (const zone of ISLAND) {
          // The interiors open only on a spring low (the deep passage and the tidal passage).
          const want = !INTERIORS.has(zone) || tide.spring;
          expect(got.has(zone), `${zone} at ${tide.name}`).toBe(want);
        }
      });
    }

  it('reaches the cairn inside by its east door once the Grey Men have opened it', () => {
    const tide = HIGH;
    expect(zonesIn(flood(START, { tide })).has('ZONE_SK_CAIRN_IN')).toBe(false);
    const got = flood(START, { tide, facts: new Set(['cairn.door.open']) });
    expect(reached(got, 'ZONE_SK_CAIRN_IN', 40, 14)).toBe(true);
    // The Door of Three Truths is closed: the inner chamber and the spring room only by the passage.
    expect(reached(got, 'ZONE_SK_CAIRN_IN', 7, 14)).toBe(false);
    const spring = flood(START, { tide: SPRING });
    expect(reached(spring, 'ZONE_SK_CAIRN_IN', 7, 21)).toBe(true);
    expect(reached(spring, 'ZONE_SK_CAIRN_IN', 40, 14)).toBe(false);
  });

  it('every link leads both ways, from walkable ground to walkable ground', () => {
    const tide = SPRING;
    for (const zone of ISLAND) {
      const map = maps.get(zone);
      if (map === undefined) continue;
      for (const link of map.links ?? []) {
        // From some open tile along the link's edge, the flood crosses into the zone beyond.
        const only = new Set([zone, link.to]);
        const edgeTiles: { x: number; y: number }[] = [];
        for (let i = 0; i < Math.max(map.width, map.height); i++) {
          const t =
            link.edge === 'n'
              ? { x: i, y: 0 }
              : link.edge === 's'
                ? { x: i, y: map.height - 1 }
                : link.edge === 'w'
                  ? { x: 0, y: i }
                  : { x: map.width - 1, y: i };
          if (t.x < map.width && t.y < map.height && open(map, t.x, t.y, { tide }))
            edgeTiles.push(t);
        }
        const crosses = edgeTiles.some((t) => {
          const got = flood({ zone, ...t }, { tide, only });
          return zonesIn(got).has(link.to);
        });
        expect(crosses, `${zone} -> ${link.to}`).toBe(true);
        const back = maps.get(link.to);
        expect(
          back?.links?.some((l) => l.to === zone),
          `${link.to} links back to ${zone}`,
        ).toBe(true);
      }
      for (const p of markup(map).portals ?? []) {
        expect(
          markup(mapOf(p.to)).portals?.some((q) => q.to === zone),
          `${p.to} has a way back to ${zone}`,
        ).toBe(true);
        expect(open(mapOf(p.to), Math.floor(p.entry.x), Math.floor(p.entry.y), { tide })).toBe(
          true,
        );
      }
    }
  });

  it('the Skerry is reached by the causeway only on a spring low', () => {
    for (const tide of TIDES) {
      const got = flood(START, { tide });
      expect(reached(got, 'ZONE_SK_SKERRY', 55, 86), tide.name).toBe(tide.spring);
    }
  });

  it('the deep passage: the crawl, the fallen stone and the push tile (Book 9 section 16)', () => {
    const tide = SPRING;
    const a = { zone: 'ZONE_SK_SEALCAVE_DEEP', x: 46, y: 9 };
    const viaCrawl = flood(a, { tide });
    expect(reached(viaCrawl, 'ZONE_SK_SEALCAVE_DEEP', 0, 14)).toBe(true);
    expect(reached(viaCrawl, 'ZONE_SK_CAIRN_IN', 7, 21)).toBe(true);
    const carrying = flood(a, { tide, carrying: true });
    expect(reached(carrying, 'ZONE_SK_SEALCAVE_DEEP', 0, 14)).toBe(false);
    expect(reached(carrying, 'ZONE_SK_SEALCAVE_DEEP', 23, 13)).toBe(false);
    const moved = flood(a, {
      tide,
      carrying: true,
      pushed: new Map([['ZONE_SK_SEALCAVE_DEEP/deep.stone', 2]]),
    });
    expect(reached(moved, 'ZONE_SK_SEALCAVE_DEEP', 0, 14)).toBe(true);
    // Closed: the passage is under the sea.
    expect(reached(flood(START, { tide: LOW }), 'ZONE_SK_SEALCAVE_DEEP', 46, 9)).toBe(false);
  });

  it('the marked places need their verbs: the cleft by the jump, the egg ledges and the halfway cleft by the climbs, the corbel gap by the crawl', () => {
    const tide = LOW;
    const cases = [
      { zone: 'ZONE_SK_GEO', x: 55, y: 24, verb: 'jump' },
      { zone: 'ZONE_SK_GEO', x: 60, y: 49, verb: 'crawl' },
      { zone: 'ZONE_SK_CLIFFS', x: 34, y: 23, verb: 'climb' },
      { zone: 'ZONE_SK_CLIFFS', x: 41, y: 24, verb: 'climb' },
      { zone: 'ZONE_SK_CLIFFS', x: 48, y: 23, verb: 'climb' },
      { zone: 'ZONE_SK_CLIFFS', x: 57, y: 19, verb: 'climb' },
    ] as const;
    for (const c of cases) {
      expect(reached(flood(START, { tide }), c.zone, c.x, c.y), `${c.zone} ${c.x},${c.y}`).toBe(
        true,
      );
      expect(
        reached(flood(START, { tide, without: new Set([c.verb]) }), c.zone, c.x, c.y),
        `${c.zone} ${c.x},${c.y} without ${c.verb}`,
      ).toBe(false);
    }
    // Behind the falls: the dry ledge, reached by wading the pool's edge.
    expect(reached(flood(START, { tide }), 'ZONE_SK_ROOK', 45, 88)).toBe(true);
  });

  it('every climb rests within climbLedgeEvery, and every jump is no wider than jumpGap (Book 10 section 06)', () => {
    const every = 12;
    const gap = 1.5;
    for (const zone of ISLAND) {
      const t = markup(mapOf(zone)).traverse;
      for (const c of t?.climbs ?? []) {
        const rests = [c.head, ...c.ledges, c.foot].sort((p, q) => p - q);
        for (let i = 1; i < rests.length; i++)
          expect((rests[i] ?? 0) - (rests[i - 1] ?? 0), `${zone} ${c.id}`).toBeLessThanOrEqual(
            every,
          );
      }
      for (const j of t?.jumps ?? [])
        expect(
          Math.hypot(j.to.x - j.from.x, j.to.y - j.from.y) - 1,
          `${zone} ${j.id}`,
        ).toBeLessThanOrEqual(gap);
      for (const p of t?.pushes ?? []) {
        const map = mapOf(zone);
        // Every place on its line is open ground the object can be moved back from.
        for (const [x, y] of p.line)
          expect(solidAt(map, x, y), `${zone} ${p.id} ${x},${y}`).toBe(false);
      }
    }
  });
});
