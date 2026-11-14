/**
 * Stage 10 acceptance check 2 (Book 9 section 13, Reachability; Book 2 section 10): every
 * objective, landing and exit of Skarvholm's southern zones is reachable on foot from where the
 * steerer comes in, at high and at low water. The flood fill walks open tiles (terrain and built
 * things) that are not deep water at the tide's still level, as movement does.
 */
import { describe, expect, it } from 'vitest';
import { landContext } from '../../src/sim/land/context.ts';
import { bandAt, isDeep } from '../../src/sim/land/water.ts';
import { beyond } from '../../src/sim/land/zoneLinks.ts';
import { tileBlocks } from '../../src/sim/land/zoneMap.ts';
import type { ZoneMap } from '../../src/sim/land/zoneMap.ts';
import { onNeck } from '../../src/sim/narrative/searches.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const search = land.searches;
if (search == null) throw new Error('no searches content');

interface Tile {
  tx: number;
  ty: number;
}
const TIDES = [
  { name: 'high water', level: 1, open: false },
  { name: 'low water', level: 0, open: true },
] as const;

/** Every tile reachable from `from` under a tide, keeping off `closed` tiles. */
function flood(
  map: ZoneMap,
  from: readonly Tile[],
  tide: (typeof TIDES)[number],
  closed: (t: Tile) => boolean = () => false,
): Set<string> {
  const el = land.elevations.get(map.zone);
  if (el === undefined) throw new Error(`no elevation for ${map.zone}`);
  const seen = new Set<string>();
  const open = (t: Tile): boolean =>
    t.tx >= 0 &&
    t.ty >= 0 &&
    t.tx < map.width &&
    t.ty < map.height &&
    !tileBlocks(map, t.tx, t.ty, tide.open) &&
    !closed(t) &&
    !isDeep(bandAt(land.water, el, (t.tx + 0.5) * map.tile, (t.ty + 0.7) * map.tile, tide.level));
  const queue = from.filter(open);
  for (const t of queue) {
    const k = `${t.tx},${t.ty}`;
    if (seen.has(k)) continue;
    seen.add(k);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n = { tx: t.tx + dx, ty: t.ty + dy };
      if (!seen.has(`${n.tx},${n.ty}`) && open(n)) queue.push(n);
    }
  }
  return seen;
}

/** The tiles on an edge where the linked zone runs on beyond it (where the steerer walks in). */
function entries(map: ZoneMap): Tile[] {
  const out: Tile[] = [];
  for (const l of map.links ?? []) {
    const to = land.maps.get(l.to);
    if (to === undefined) continue;
    const n = l.edge === 'n' || l.edge === 's' ? map.width : map.height;
    for (let i = 0; i < n; i++) {
      const t =
        l.edge === 'n'
          ? { tx: i, ty: 0 }
          : l.edge === 's'
            ? { tx: i, ty: map.height - 1 }
            : l.edge === 'w'
              ? { tx: 0, ty: i }
              : { tx: map.width - 1, ty: i };
      if (beyond(map, to, { x: (t.tx + 0.5) * map.tile, y: (t.ty + 0.5) * map.tile })) out.push(t);
    }
  }
  return out;
}

const tileAt = (x: number, y: number): Tile => ({ tx: Math.floor(x), ty: Math.floor(y - 0.001) });
/** A tile or one beside it (a person lying, a stone standing: within reach of their tile). */
const near = (reach: Set<string>, t: Tile, r = 1): boolean => {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) if (reach.has(`${t.tx + dx},${t.ty + dy}`)) return true;
  return false;
};
const map = (zone: string): ZoneMap => {
  const m = land.maps.get(zone);
  if (m === undefined) throw new Error(`no map ${zone}`);
  return m;
};

describe('Skarvholm’s southern zones are reachable at high and low water (Book 9 section 13)', () => {
  for (const tide of TIDES) {
    it(`Wreck Strand at ${tide.name}: Oddi, Thorkel’s chest, the cut up to the machair`, () => {
      const m = map('ZONE_SK_STRAND');
      const reach = flood(m, entries(m), tide);
      const d = search.def.oddi;
      expect(near(reach, tileAt(d.at.x, d.at.y))).toBe(true);
      expect(near(reach, tileAt(d.chest.x, d.chest.y))).toBe(true);
      expect(entries(m).some((t) => reach.has(`${t.tx},${t.ty}`))).toBe(true);
    });

    it(`the machair at ${tide.name}: the Kelda Spring, the camp, the bier, and every edge`, () => {
      const m = map('ZONE_SK_MACHAIR');
      const all = entries(m);
      const reach = flood(m, all, tide);
      // The spring's pool (a stream tile) has dry ground beside it to stand on.
      const pool = m.rows.flatMap((r, ty) =>
        Array.from({ length: r.length }, (_, tx) => tx).flatMap((tx) =>
          r[tx] === 'w' && ty < 14 ? [{ tx, ty }] : [],
        ),
      );
      expect(pool.length).toBeGreaterThan(8);
      expect(pool.some((t) => near(reach, t))).toBe(true);
      const bier = search.def.bran.bier;
      expect(near(reach, tileAt(bier.x, bier.y))).toBe(true);
      expect(near(reach, tileAt(35.4, 31.6))).toBe(true);
      // Each edge's entry reaches the others: one connected ground.
      for (const l of m.links ?? []) {
        const from = all.filter((t) => {
          const to = land.maps.get(l.to);
          return to !== undefined && beyond(m, to, { x: (t.tx + 0.5) * 24, y: (t.ty + 0.5) * 24 });
        });
        const own = flood(m, from, tide);
        expect(all.filter((t) => own.has(`${t.tx},${t.ty}`)).length, l.to).toBeGreaterThan(
          all.length / 2,
        );
      }
    });

    it(`the Hag’s Seat at ${tide.name}: the stone, Runa and her tools, by the neck and by the cliff path`, () => {
      const m = map('ZONE_SK_HAGSEAT');
      const d = search.def.runa;
      const reach = flood(m, entries(m), tide);
      expect(near(reach, tileAt(d.stone.x, d.stone.y))).toBe(true);
      expect(near(reach, tileAt(d.at.x, d.at.y))).toBe(true);
      expect(near(reach, tileAt(d.tools.x, d.tools.y))).toBe(true);
      // With the neck held by the gale, the cliff path still joins the headland to the island.
      const neck = (t: Tile): boolean => onNeck(search, m, t);
      const round = flood(m, entries(m), tide, neck);
      expect(near(round, tileAt(d.at.x, d.at.y))).toBe(true);
      expect(near(round, tileAt(d.stone.x, d.stone.y))).toBe(true);
      // The cliff path is the slower way: at least half as long again as the neck.
      const steps = (closed: (t: Tile) => boolean): number => {
        const from = tileAt(d.at.x, d.at.y);
        const goal = `${d.safe.x0 + 2},21`;
        const dist = new Map<string, number>([[`${from.tx},${from.ty}`, 0]]);
        const queue: Tile[] = [from];
        for (const t of queue) {
          const k0 = `${t.tx},${t.ty}`;
          if (k0 === goal) return dist.get(k0) ?? -1;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const n = { tx: t.tx + dx, ty: t.ty + dy };
            const k = `${n.tx},${n.ty}`;
            if (dist.has(k) || !reach.has(k) || closed(n)) continue;
            dist.set(k, (dist.get(k0) ?? 0) + 1);
            queue.push(n);
          }
        }
        return -1;
      };
      const direct = steps(() => false);
      const cliff = steps(neck);
      expect(direct).toBeGreaterThan(0);
      expect(cliff).toBeGreaterThan(direct * 1.5);
    });

    it(`the cairn and the sheepfold at ${tide.name}: Bran, Thorkel, the gate, the back wall, the mound`, () => {
      const m = map('ZONE_SK_CAIRN');
      const d = search.def.bran;
      const reach = flood(m, entries(m), tide);
      expect(near(reach, tileAt(d.at.x, d.at.y))).toBe(true);
      expect(near(reach, tileAt(d.body.x, d.body.y))).toBe(true);
      // Outside the back wall, where Bran can be spoken to unseen.
      expect(reach.has('43,36')).toBe(true);
      // Inside the fold only through its gate: the walls hold.
      const outside = flood(
        m,
        entries(m),
        tide,
        (t) => t.tx === 32 && (t.ty === 35 || t.ty === 36),
      );
      expect(near(outside, tileAt(d.at.x, d.at.y), 0)).toBe(false);
      // Round the mound: its sealed east door can be walked up to.
      const row = Math.floor(19.5);
      const east = Math.max(...(m.solid ?? []).filter(([, y]) => y === row).map(([x]) => x));
      expect(east).toBeGreaterThan(60);
      expect(reach.has(`${east + 1},${row}`)).toBe(true);
    });
  }
});
