/**
 * Stage 13, work package C (Book 9 sections 13 and 15; decisions S13-40 to S13-59): the reef of
 * Sgeir Dhubh. From where the steerer comes ashore beside the boat, the boat's side (Hild's
 * question), each survivor's talk spot and the wreck's side are reached on foot at high and at low
 * water, and Ívar is carried from where he lies to the boat's side without a swim. The flood fill
 * walks open tiles that are not deep water at the tide's still level, as movement does.
 */
import { describe, expect, it } from 'vitest';
import { parseWreckBalance } from '../../src/content/wreckBalance.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { bandAt, isDeep } from '../../src/sim/land/water.ts';
import { tileBlocks } from '../../src/sim/land/zoneMap.ts';
import { seaWreckContext } from '../../src/sim/sea/wreck.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const wb = parseWreckBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const ctx = seaWreckContext(content);
if (ctx === null) throw new Error('no wreck content');
const map = land.maps.get(ctx.def.zone);
const el = land.elevations.get(ctx.def.zone);
if (map === undefined || el === undefined) throw new Error('no reef zone');

const TIDES = [
  { name: 'high water', level: 1, open: false },
  { name: 'low water', level: 0, open: true },
] as const;

type Tile = { tx: number; ty: number };

function open(t: Tile, tide: (typeof TIDES)[number]): boolean {
  if (map === undefined || el === undefined) return false;
  return (
    t.tx >= 0 &&
    t.ty >= 0 &&
    t.tx < map.width &&
    t.ty < map.height &&
    !tileBlocks(map, t.tx, t.ty, tide.open) &&
    !isDeep(bandAt(land.water, el, (t.tx + 0.5) * map.tile, (t.ty + 0.7) * map.tile, tide.level))
  );
}

function flood(from: Tile, tide: (typeof TIDES)[number]): Set<string> {
  const seen = new Set<string>();
  const queue = [from].filter((t) => open(t, tide));
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
      if (!seen.has(`${n.tx},${n.ty}`) && open(n, tide)) queue.push(n);
    }
  }
  return seen;
}

/** Whether some reached tile's centre lies within `reach` tiles of (x, y). */
function within(seen: Set<string>, x: number, y: number, reach: number): boolean {
  for (const k of seen) {
    const [tx = 0, ty = 0] = k.split(',').map(Number);
    if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) <= reach) return true;
  }
  return false;
}

describe('Sgeir Dhubh: reachability at every tide (Book 9 section 15)', () => {
  const spawn = map.spawns['P_STEERER'];
  if (spawn === undefined) throw new Error('no landing place');
  for (const tide of TIDES) {
    it(`at ${tide.name}, the boat's side, every survivor and the wreck are reached from the landing`, () => {
      const seen = flood({ tx: Math.floor(spawn.x), ty: Math.floor(spawn.y) }, tide);
      expect(seen.size).toBeGreaterThan(100);
      expect(within(seen, ctx.def.board.x, ctx.def.board.y, wb.boardReachTiles)).toBe(true);
      for (const s of ctx.def.survivors)
        expect(within(seen, s.at.x, s.at.y, wb.talkReachTiles), s.id).toBe(true);
      const wreck = map.props.find(
        (p) => p.sheet === 'prop_sea_wreck' && p.frame.startsWith('broken'),
      );
      expect(wreck).toBeDefined();
      expect(within(seen, wreck?.x ?? 0, wreck?.y ?? 0, 4)).toBe(true);
    });
    it(`at ${tide.name}, Ívar is carried from where he lies to the boat's side without a swim`, () => {
      const ivar = ctx.def.survivors.find((s) => s.id === 'C_IVAR');
      if (ivar === undefined) throw new Error('no Ívar');
      const seen = flood({ tx: Math.floor(ivar.at.x), ty: Math.floor(ivar.at.y) }, tide);
      expect(seen.has(`${Math.floor(ivar.at.x)},${Math.floor(ivar.at.y)}`)).toBe(true);
      expect(within(seen, ctx.def.board.x, ctx.def.board.y, wb.boardReachTiles)).toBe(true);
    });
  }
  it('Derbáil and Ívar wait on dry ground the high tide never reaches', () => {
    for (const id of ['C_DERBAIL', 'C_IVAR']) {
      const s = ctx.def.survivors.find((x) => x.id === id);
      if (s === undefined) throw new Error(id);
      const band = bandAt(land.water, el, s.at.x * map.tile, s.at.y * map.tile, 1);
      expect(band, id).toBeNull();
    }
  });
});
