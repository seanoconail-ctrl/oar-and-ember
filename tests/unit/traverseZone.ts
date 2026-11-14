/**
 * A small test zone with every movement verb marked (Stage 14; Book 9 section 12), for the verbs'
 * unit and replay tests until the island's zones carry their marks: a cliff with a marked climb
 * and a ledge, a short jump over a rock, a crawl through a wall, a heavy stone on its line, soft
 * ground, and a shore running down into the sea, half of it marked as swimming water.
 */
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { bakeElevation } from '../../src/content/terrain/elevation.ts';
import type { TraverseMarks } from '../../src/content/traverseMarks.ts';
import type { ZoneMap } from '../../src/content/zoneMap.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { placeOnFoot } from '../../src/sim/land/onFoot.ts';
import type { SimWorldContext } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

export const ZONE = 'ZONE_TEST_TRAVERSE';
export const W = 30;
export const H = 34;

/**
 * Rows 0 to 13: the cliff top (row 1) and the cliff (rows 2 to 13); rows 14 to 19 the grass below,
 * with a rock wall at columns 15 to 17 that the crawl goes through and a rock at (10, 15) that the
 * jump crosses; rows 20 to 21 shingle, 22 to 25 the foreshore, then the sea.
 */
function rows(): string[] {
  const out: string[] = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      const edge = x === 0 || x === W - 1;
      let c: string;
      if (y === 0) c = 'r';
      else if (y === 1) c = edge ? 'r' : ',';
      else if (y <= 13) c = 'r';
      else if (y <= 19) {
        if (edge) c = 'r';
        else if (x >= 15 && x <= 17) c = 'r';
        else if (x === 10 && y === 15) c = 'r';
        else c = ',';
      } else if (y <= 21) c = '.';
      else if (y <= 25) c = '_';
      else c = '~';
      r += c;
    }
    out.push(r);
  }
  return out;
}

export const MARKS: TraverseMarks = {
  climbs: [{ id: 'cliff', x: 3, foot: 14, head: 1, ledges: [8] }],
  // The sea west of column 15 is swimming water; east of it, it is the edge of the ground.
  swims: [{ x: 0, y: 22, w: 15, h: H - 22 }],
  jumps: [{ id: 'rock', from: { x: 9, y: 15 }, to: { x: 11, y: 15 } }],
  crawls: [
    {
      id: 'wall',
      tiles: [
        [15, 16],
        [16, 16],
        [17, 16],
      ],
    },
  ],
  pushes: [
    {
      id: 'stone',
      line: [
        [22, 15],
        [23, 15],
        [24, 15],
      ],
      start: 0,
      sheet: 'prop_boulder',
      frame: 'lichen/-/0',
    },
  ],
  soft: [{ x: 4, y: 16, w: 6, h: 3 }],
};

export function testZone(marks: TraverseMarks = MARKS): ZoneMap & { traverse: TraverseMarks } {
  return {
    zone: ZONE,
    tile: 24,
    width: W,
    height: H,
    rows: rows(),
    spawns: { P_STEERER: { x: 5.5, y: 17.5, facing: 's' } },
    props: [],
    life: [],
    decalFrames: [],
    decals: [],
    plants: [],
    traverse: marks,
  };
}

export const balance = loadBalanceJson();
export const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();

/** The on-foot context with only the test zone (no opening, camp, people or fights). */
export function testLand(marks: TraverseMarks = MARKS): SimWorldContext {
  const full = landContext(content, balance);
  const zone = testZone(marks);
  return {
    maps: new Map([[ZONE, zone]]),
    elevations: new Map([[ZONE, bakeElevation(zone.rows)]]),
    movement: full.movement,
    water: full.water,
    controls: full.controls,
    missiles: full.missiles,
    arrows: full.arrows,
    rules: full.rules,
    opening: null,
    ...(full.stamina === undefined ? {} : { stamina: full.stamina }),
    traverse: full.traverse ?? null,
    ...(full.combatMove === undefined ? {} : { combatMove: full.combatMove }),
    ...(full.edgeStopDegrees === undefined ? {} : { edgeStopDegrees: full.edgeStopDegrees }),
  };
}

/** A campaign standing in the test zone, at (x, y) in tiles, at the given hour of day 2. */
export function testWorld(at: { x: number; y: number } = { x: 5.5, y: 17.5 }, hour = 12): WorldState {
  const world = newCampaign('traverse', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  world.calendar = { ...world.calendar, day: 2, minuteOfDay: hour * 60 };
  const onFoot = placeOnFoot(testZone(), []);
  onFoot.player.x = at.x * 24;
  onFoot.player.y = at.y * 24;
  world.onFoot = onFoot;
  return world;
}
