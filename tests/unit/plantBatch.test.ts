/**
 * The plants as one batch (the user's fourth playtest's final pass, decision DH-161): the machair's
 * view holds about 7,500 tufts, and drawing them as one batch merged into the draw order must
 * draw exactly what drawing each as a sprite did. The reference here is the draw list as built
 * before the batch (every plant a sprite in the scene's list, each row of plants in its old
 * order), compared item for item with the plan the game now draws.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import {
  buildDrawList,
  buildDrawPlan,
  planItems,
  sceneSprites,
  withSprites,
} from '../../src/render/scene.ts';
import type {
  DrawItem,
  PlantBatch,
  Scene,
  SceneSprite,
  SheetGeometry,
} from '../../src/render/scene.ts';
import { cameraFor, zoneScene } from '../../src/scenes/zoneScene.ts';
import type { SheetAnims } from '../../src/scenes/zoneScene.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadPalette, loadPeopleLook, loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const sheetList = loadSheets(loadPalette());
const anims: SheetAnims = new Map(sheetList.map((s) => [s.name, s.anims]));
const shadows = new Map(sheetList.map((s) => [s.name, s.shadow]));
const geometry: Map<string, SheetGeometry> = new Map(
  sheetList.map((s) => [s.name, { width: s.width, height: s.height, pivot: s.pivot }]),
);
const balance = loadBalanceJson();
const { content } = loadContentFromDisk();
const land = landContext(content, balance);

/** The draw list exactly as it was built before the batch (f0eec35), for a list of sprites. */
function referenceList(
  sprites: readonly SceneSprite[],
  sheets: ReadonlyMap<string, SheetGeometry>,
  cutawayFade: number,
): DrawItem[] {
  const LAYER = { ground: 0, decal: 1, actor: 2 } as const;
  const overlaps = (a: DrawItem, b: DrawItem): boolean =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const n = sprites.length;
  const items: DrawItem[] = [];
  const keys: [number, number, number][] = [];
  let focusIndex = -1;
  sprites.forEach((sprite, i) => {
    const sheet = sheets.get(sprite.sheet);
    if (sheet === undefined) throw new Error(sprite.sheet);
    const footY = Math.round(sprite.y);
    const anchorX = Math.round(sprite.x);
    const item: DrawItem = {
      sheet: sprite.sheet,
      frame: sprite.frame,
      x: anchorX - sheet.pivot.x,
      y: footY - sheet.pivot.y,
      width: sheet.width,
      height: sheet.height,
      fade: 0,
      layer: sprite.layer,
    };
    const wade = sprite.wade;
    items[i] =
      wade === undefined && sprite.dark === undefined
        ? item
        : {
            ...item,
            ...(wade === undefined || wade.mask <= 0
              ? {}
              : { cutY: footY - wade.mask + 1, water: wade.colour }),
            ...(sprite.dark === undefined ? {} : { dark: sprite.dark }),
          };
    const actor = sprite.layer === 'actor';
    keys[i] = [LAYER[sprite.layer], actor ? (sprite.sort ?? footY) : 0, actor ? anchorX : 0];
    if (sprite.focus === true) focusIndex = i;
  });
  const order = Array.from({ length: n }, (_, i) => i);
  order.sort((a, b) => {
    const ka = keys[a] ?? [0, 0, 0];
    const kb = keys[b] ?? [0, 0, 0];
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || a - b;
  });
  const focusAt = order.indexOf(focusIndex);
  const focus = focusIndex < 0 ? undefined : items[focusIndex];
  return order.map((i, k) => {
    const item = items[i] as DrawItem;
    const sprite = sprites[i];
    if (
      focus !== undefined &&
      k > focusAt &&
      sprite?.tall === true &&
      overlaps(item, focus) &&
      (sprite.boxes === undefined ||
        sprite.boxes.some(([bx, by, bw, bh]) =>
          overlaps({ ...item, x: item.x + bx, y: item.y + by, width: bw, height: bh }, focus),
        ))
    )
      return { ...item, fade: cutawayFade };
    return item;
  });
}

/** The scene's sprites as they were listed before the batch: each plant row in (y, x) order. */
function oldSprites(scene: Scene, camera: { x: number; y: number }, tile: number): SceneSprite[] {
  const b = scene.plants;
  if (b === undefined) return [...scene.sprites];
  const all = sceneSprites(scene);
  const plants = all.slice(b.at, b.at + b.count);
  const row = (s: SceneSprite): number => Math.max(0, Math.floor((s.y + camera.y) / tile));
  plants.sort((p, q) => row(p) - row(q) || p.y - q.y || p.x - q.x);
  return [...all.slice(0, b.at), ...plants, ...all.slice(b.at + b.count)];
}

const strip = (d: DrawItem): string =>
  `${d.sheet}|${d.frame}|${d.x}|${d.y}|${d.width}|${d.height}|${d.fade}|${d.layer}|${String(
    d.cutY,
  )}|${String(d.dark)}`;

describe('the plants drawn as one batch (decision DH-161)', () => {
  const b = parseTimeBalance(balance);
  const world = newCampaign('plants', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  const onFoot = world.onFoot;
  if (onFoot === null) throw new Error('not on foot');
  const look = loadPeopleLook('A');

  for (const zone of [
    'ZONE_SK_MACHAIR',
    'ZONE_SK_STRAND',
    'ZONE_SK_CAIRN',
    'ZONE_SK_HAGSEAT',
    'ZONE_SK_SEALCAVE',
  ]) {
    it(`${zone}: the plan draws exactly the list the plants made as sprites, from many places`, () => {
      const map = land.maps.get(zone);
      if (map === undefined) throw new Error(zone);
      let plants = 0;
      let places = 0;
      for (let fy = 0.1; fy < 1; fy += 0.2)
        for (let fx = 0.05; fx < 1; fx += 0.15) {
          onFoot.player.x = fx * map.width * map.tile;
          onFoot.player.y = fy * map.height * map.tile;
          const camera = cameraFor(map, onFoot.player);
          for (const tick of [0, 97]) {
            const scene = zoneScene({
              map,
              onFoot,
              tick,
              tideOpen: false,
              phase: 'day',
              look,
              anims,
              shadows,
              highlight: null,
            });
            const want = referenceList(oldSprites(scene, camera, map.tile), geometry, 0.5).map(
              strip,
            );
            const got = buildDrawList(scene, geometry, 0.5).map(strip);
            expect(got).toEqual(want);
            plants += scene.plants?.count ?? 0;
            places++;
          }
        }
      expect(places).toBeGreaterThan(30);
      if (zone !== 'ZONE_SK_SEALCAVE') expect(plants).toBeGreaterThan(1000);
    });
  }

  it('ties of line and x between a plant and another sprite go by their order in the scene, and a cutaway stays', () => {
    const geo = new Map<string, SheetGeometry>([
      ['p', { width: 8, height: 12, pivot: { x: 4, y: 11 } }],
      ['a', { width: 16, height: 30, pivot: { x: 8, y: 29 } }],
      ['g', { width: 24, height: 24, pivot: { x: 0, y: 0 } }],
    ]);
    // Before the plants: a ground tile, a tall thing over the focus, a person on a plant's spot.
    const before: SceneSprite[] = [
      { sheet: 'g', frame: 'f', x: 0, y: 0, layer: 'ground' },
      { sheet: 'a', frame: 'focus', x: 40, y: 50, layer: 'actor', focus: true },
      { sheet: 'a', frame: 'tie-before', x: 20, y: 30, layer: 'actor' },
    ];
    // After them: another on a plant's spot, and a tall one in front of the focus.
    const after: SceneSprite[] = [
      { sheet: 'a', frame: 'tie-after', x: 30.4, y: 40, layer: 'actor', sort: 40 },
      { sheet: 'a', frame: 'tall', x: 44, y: 60, layer: 'actor', tall: true },
    ];
    const px = [20, 19.6, 30, 30.2, 10, 50];
    const py = [30, 30.2, 40, 39.8, 70, 5];
    const batch: PlantBatch = {
      sheet: 'p',
      count: px.length,
      frames: px.map((_, j) => `plant${j}`),
      frameId: Uint16Array.from(px.map((_, j) => j)),
      x: Float64Array.from(px),
      y: Float64Array.from(py),
      sort: Float64Array.from(py.map((y) => Math.round(y))),
      at: before.length,
    };
    const scene: Scene = {
      background: 'D',
      sprites: [...before, ...after],
      phase: 'day',
      pools: [],
      plants: batch,
    };
    const inline = sceneSprites(scene);
    expect(inline).toHaveLength(before.length + after.length + px.length);
    const want = referenceList(inline, geo, 0.5).map(strip);
    expect(buildDrawList(scene, geo, 0.5).map(strip)).toEqual(want);
    expect(planItems(buildDrawPlan(scene, geo, 0.5)).map(strip)).toEqual(want);
    // The tie with the person before the plants: the person first; after them: the plants first.
    const order = want.map((w) => w.split('|')[1]);
    expect(order.indexOf('tie-before')).toBeLessThan(order.indexOf('plant0'));
    expect(order.indexOf('tie-after')).toBeGreaterThan(order.indexOf('plant2'));
    expect(want.find((w) => w.startsWith('a|tall|'))?.split('|')[6]).toBe('0.5');
    // A scene with its sprites replaced carries no plants.
    expect(withSprites(scene, []).plants).toBeUndefined();
  });
});
