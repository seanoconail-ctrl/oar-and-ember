/**
 * The Stage 4 test scenes (Book 3 Stage 4 check 3): machair ground, a blood decal layer, a Grey
 * Men stone and the steerer, in four cases. Positions are deliberately fractional, to prove
 * pixel snapping.
 *
 * - front: the steerer stands in front of the stone (drawn over it), by day;
 * - behind: the steerer stands behind the stone, which is cut away;
 * - dusk and night: the front case under dusk and night light, with a lantern pool at night.
 */
import type { PlantBatch, Scene, SceneSprite } from '../render/scene.ts';

export const ART_TEST_CASES = ['front', 'behind', 'dusk', 'night'] as const;
export type ArtTestCase = (typeof ART_TEST_CASES)[number];

export const ART_TEST_SHEETS = [
  'tile_machair_01',
  'decal_blood_01',
  'prop_greymen_stone',
  'actor_p_steerer_a',
] as const;

function ground(): SceneSprite[] {
  const tiles: SceneSprite[] = [];
  for (let ty = 0; ty < 15; ty++) {
    for (let tx = 0; tx < 27; tx++) {
      tiles.push({
        sheet: 'tile_machair_01',
        frame: 'tile/-/0',
        x: tx * 24,
        y: ty * 24,
        layer: 'ground',
      });
    }
  }
  return tiles;
}

export function artTestScene(which: ArtTestCase): Scene {
  const behind = which === 'behind';
  const sprites: SceneSprite[] = [
    ...ground(),
    { sheet: 'decal_blood_01', frame: 'pool/-/0', x: 286.4, y: 236.2, layer: 'decal' },
    { sheet: 'decal_blood_01', frame: 'drops/-/0', x: 352.6, y: 241.5, layer: 'decal' },
    {
      sheet: 'prop_greymen_stone',
      frame: 'stand/-/0',
      x: 320.3,
      y: 222.4,
      layer: 'actor',
      tall: true,
    },
    {
      sheet: 'actor_p_steerer_a',
      frame: behind ? 'idle/n/0' : 'idle/s/0',
      x: behind ? 324.6 : 323.4,
      y: behind ? 206.7 : 238.4,
      layer: 'actor',
      focus: true,
    },
  ];
  return {
    background: 'g',
    sprites,
    phase: which === 'dusk' ? 'dusk' : which === 'night' ? 'night' : 'day',
    pools: which === 'night' ? [{ x: 296, y: 226, radius: 72, colour: [150, 110, 60] }] : [],
  };
}

/**
 * The plants drawn as one batch (decision DH-161): a field of grass, thrift and marram on the
 * machair ground, round three people, one wading, one standing exactly on a tuft's spot before
 * the plants in the scene's order and one after them, and the stone cut away in front of the
 * steerer. The WebGL renderer draws the plan (the batch merged in, by instances); the CPU
 * reference draws the same plants as plain items: the two must match to the pixel.
 */
export const PLANT_TEST_CASE = 'plants';
export function plantTestScene(): Scene {
  const kinds = ['grass0', 'grass1', 'grass2', 'grass3', 'thrift0', 'marram0', 'tussock1'];
  const frames = kinds.flatMap((k) => Array.from({ length: 7 }, (_, i) => `${k}/-/${i}`));
  const x: number[] = [];
  const y: number[] = [];
  const frameId: number[] = [];
  // A field in rows, fractional and overlapping, in the order zoneScene places them.
  for (let r = 0; r < 26; r++)
    for (let c = 0; c < 40; c++) {
      x.push(120 + c * 10.3 + ((r * 7) % 5) * 0.9);
      y.push(80 + r * 9.6 + ((c * 3) % 4) * 0.7);
      frameId.push(((r * 11 + c * 5) % kinds.length) * 7 + ((r + c) % 7));
    }
  const plants: PlantBatch = {
    sheet: 'plant_strand',
    count: x.length,
    frames,
    frameId: Uint16Array.from(frameId),
    x: Float64Array.from(x),
    y: Float64Array.from(y),
    sort: Float64Array.from(y.map((v) => Math.round(v))),
    at: 0,
  };
  const before: SceneSprite[] = [
    ...ground(),
    {
      sheet: 'prop_greymen_stone',
      frame: 'stand/-/0',
      x: 320.3,
      y: 222.4,
      layer: 'actor',
      tall: true,
    },
    {
      sheet: 'actor_p_steerer_a',
      frame: 'idle/n/0',
      x: 324.6,
      y: 206.7,
      layer: 'actor',
      focus: true,
    },
    // On a tuft's spot (its rounded foot and x), before the plants: drawn under the tuft.
    {
      sheet: 'actor_p_steerer_a',
      frame: 'idle/s/0',
      x: Math.round(x[205] ?? 0),
      y: Math.round(y[205] ?? 0),
      layer: 'actor',
    },
  ];
  const after: SceneSprite[] = [
    // On another tuft's spot, after the plants: drawn over it.
    {
      sheet: 'actor_p_steerer_a',
      frame: 'idle/s/1',
      x: Math.round(x[612] ?? 0),
      y: Math.round(y[612] ?? 0),
      layer: 'actor',
    },
    {
      sheet: 'actor_p_steerer_a',
      frame: 'idle/s/2',
      x: 470.2,
      y: 300.4,
      layer: 'actor',
      wade: { mask: 9, colour: [60, 110, 120] },
      dark: 0.4,
    },
  ];
  return {
    background: 'g',
    sprites: [...before, ...after],
    phase: 'day',
    pools: [],
    plants: { ...plants, at: before.length },
  };
}

/** Every frame of one sheet in a grid, as the atlas lays them out, for the sheet preview check. */
export function sheetPreviewScene(
  sheet: string,
  geometry: { width: number; height: number; pivot: { x: number; y: number } },
  frames: Readonly<Record<string, readonly [number, number]>>,
): Scene {
  const sprites: SceneSprite[] = Object.entries(frames).map(([frame, [x, y]]) => ({
    sheet,
    frame,
    x: 8 + x + geometry.pivot.x,
    y: 8 + y + geometry.pivot.y,
    layer: 'actor',
  }));
  return { background: 's', sprites, phase: 'day', pools: [] };
}
