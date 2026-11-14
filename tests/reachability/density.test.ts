/**
 * Stage 14 acceptance check 4: a density walker finds something worth stopping for within Book 10's
 * interval along every walking route (Book 10 section 20, "Stopping points"; decision S14-19), in
 * every built scene of Skarvholm, at high and low water and in every season; and every scene has a
 * real secret or small puzzle.
 *
 * - **Routes:** the shortest walking way between every pair of the scene's entries (its linked
 *   edges and its waking place) and from each entry to each of its objectives (its puzzles' places
 *   and marks), which is where Book 9's routes run inside a scene.
 * - **Stops** (stopKinds): finds not yet taken (Chapter 1 finds and collectibles there under the
 *   condition), points of interest (puzzle places and marks, landings, buildings and the plan's
 *   landmarks), resource nodes while they exist, anchored life (a seal on its rock, a standing gull,
 *   a cormorant, a crab, the eagle) and view points. One counts once within stopWithin of the walker.
 * - **The interval:** no stretch of a route longer than the interval's upper bound (tiles at the
 *   walk) passes with nothing in reach.
 *
 * The scenes walked are those whose plan is built; the test's names say which.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance, SEASONS } from '../../src/content/balance.ts';
import { DAYS_PER_SEASON, tideAt } from '../../src/sim/calendar/calendar.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { viewPointsOf } from '../../src/sim/land/discovery.ts';
import { holds } from '../../src/sim/land/islandConditions.ts';
import { nodeExists } from '../../src/sim/land/resources.ts';
import type { ZoneMap } from '../../src/sim/land/zoneMap.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { entries, shortest, standable } from './islandReach.ts';
import type { Tide, Tile } from './islandReach.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const islandOrNull = land.island;
if (islandOrNull == null) throw new Error('no island context');
const island = islandOrNull;
const { stopWithin, intervalTiles } = island.ib.density;
const scenes = [...land.maps.keys()].filter((z) => z.startsWith('ZONE_SK_')).sort();

/** Landmarks a plan draws that are worth stopping for (Book 9's points of interest). */
const LANDMARK_SHEETS =
  /^(bld_|prop_cell|prop_greymen|prop_hagstone|prop_island|prop_finds|prop_broch|prop_boat|prop_sea_wreck|prop_skiff|prop_waymark)/;
/** Wildlife that keeps to a place (stopKinds' anchored life). */
const ANCHORED = new Set(['seal', 'gull_standing', 'cormorant', 'crab', 'spring']);

function worldAt(day: number, low: boolean): WorldState {
  const w = newCampaign('density', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  for (let m = 0; m < 1440; m += 10) {
    const minute = (b.dayStart + m) % 1440;
    const t = tideAt({ day, minuteOfDay: minute }, b);
    if (t.tidalGroundOpen === low && !t.springTide) {
      w.calendar = { day, minuteOfDay: minute };
      return w;
    }
  }
  w.calendar = { day, minuteOfDay: 720 };
  return w;
}

/** Everything worth stopping for in a scene now (tiles). */
function stops(w: WorldState, map: ZoneMap): { x: number; y: number; what: string }[] {
  const out: { x: number; y: number; what: string }[] = [];
  const zone = map.zone;
  for (const f of content.finds?.finds ?? [])
    if (f.zone === zone) out.push({ x: f.x, y: f.y, what: `find ${f.key}` });
  for (const c of island.collectibles)
    if (
      c.scene === zone &&
      c.find === undefined &&
      (c.conditions ?? []).every((k) => holds(w, island, k))
    )
      out.push({ x: c.pos.x, y: c.pos.y, what: `collectible ${c.key}` });
  for (const u of island.puzzles.uses)
    if (u.scene === zone) out.push({ x: u.x, y: u.y, what: `puzzle ${u.key}` });
  for (const p of island.puzzles.puzzles)
    for (const m of p.marks ?? [])
      if (p.scenes.includes(zone)) out.push({ x: m.x, y: m.y, what: `${p.id} mark` });
  for (const n of island.island.nodes)
    if (n.scene === zone && nodeExists(w, island, n))
      out.push({ x: n.x, y: n.y, what: `node ${n.key}` });
  for (const l of map.life)
    if (ANCHORED.has(l.kind)) out.push({ x: l.x, y: l.y, what: `life ${l.kind}` });
  for (const p of map.props)
    if (LANDMARK_SHEETS.test(p.sheet)) out.push({ x: p.x, y: p.y, what: `landmark ${p.sheet}` });
  for (const v of viewPointsOf(island, zone))
    out.push({ x: v.at.x + v.at.w / 2, y: v.at.y + v.at.h / 2, what: 'view point' });
  for (const s of content.camp?.sites ?? [])
    if (s.zone === zone) out.push({ x: s.x, y: s.y, what: `camp ${s.kind}` });
  return out;
}

/** The scene's objectives: its puzzles' places and marks, on ground the walker can stand on. */
function objectives(map: ZoneMap, tide: Tide): Tile[] {
  const out: Tile[] = [];
  const add = (x: number, y: number): void => {
    const t = { tx: Math.floor(x), ty: Math.floor(y) };
    if (standable(map, t, tide)) out.push(t);
  };
  for (const u of island.puzzles.uses) if (u.scene === map.zone) add(u.x, u.y);
  for (const p of island.puzzles.puzzles)
    if (p.scenes.includes(map.zone)) for (const m of p.marks ?? []) add(m.x, m.y);
  return out;
}

/** The longest stretch of a path walked with nothing worth stopping for in reach. */
function longestGap(path: readonly Tile[], points: readonly { x: number; y: number }[]): number {
  let gap = 0;
  let worst = 0;
  for (const t of path) {
    const seen = points.some(
      (p) => Math.hypot(p.x - (t.tx + 0.5), p.y - (t.ty + 0.5)) <= stopWithin,
    );
    gap = seen ? 0 : gap + 1;
    worst = Math.max(worst, gap);
  }
  return worst;
}

describe(`exploration density (Book 10 section 20): scenes walked: ${scenes.join(', ')}`, () => {
  for (const zone of scenes) {
    const map = land.maps.get(zone);
    if (map === undefined) continue;
    it(`${zone}: has a real secret or small puzzle`, () => {
      expect(island.puzzles.secrets[zone]?.length ?? 0).toBeGreaterThan(0);
    });
    for (const season of SEASONS)
      for (const low of [false, true]) {
        const day = SEASONS.indexOf(season) * DAYS_PER_SEASON + 12;
        it(`${zone}, ${season}, ${low ? 'low' : 'high'} water: a stop within ${intervalTiles[1]} tiles all along every route`, () => {
          const w = worldAt(day, low);
          const tide: Tide = { low, spring: false };
          const points = stops(w, map);
          const ends = entries(map, tide);
          const goals = objectives(map, tide);
          const worst: string[] = [];
          for (let i = 0; i < ends.length; i++)
            for (const to of [...ends.slice(i + 1), ...goals]) {
              const from = ends[i];
              if (from === undefined) continue;
              const path = shortest(map, from, to, tide);
              if (path === null) continue;
              const gap = longestGap(path, points);
              if (gap > intervalTiles[1])
                worst.push(
                  `(${from.tx},${from.ty})->(${to.tx},${to.ty}): ${gap} tiles with nothing`,
                );
            }
          expect(worst).toEqual([]);
        });
      }
  }
});
