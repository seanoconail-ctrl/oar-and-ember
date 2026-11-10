/**
 * The Stage 4 test scenes (Book 3 Stage 4 check 3): machair ground, a blood decal layer, a Grey
 * Men stone and the steerer, in four cases. Positions are deliberately fractional, to prove
 * pixel snapping.
 *
 * - front: the steerer stands in front of the stone (drawn over it), by day;
 * - behind: the steerer stands behind the stone, which is cut away;
 * - dusk and night: the front case under dusk and night light, with a lantern pool at night.
 */
import type { Scene, SceneSprite } from '../render/scene.ts';

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
