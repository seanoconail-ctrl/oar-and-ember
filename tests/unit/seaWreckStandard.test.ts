/**
 * Stage 13, work package C (decisions S13-40 to S13-59): the reef of the wreck on Sgeir Dhubh
 * against the Book 7 terrain art standard (section 14), as tests/unit/standard.test.ts checks the
 * strand: art lint's standard checks on the zone and its sheets; a ground shadow under every
 * character, creature and prop the reef draws; the survivors drawn in their scene poses from their
 * own sheets; the scenery that moves (the boat afloat, the wreck's water, spray, kelp, the sail
 * awash) moving; and Fínán, holding the wreck in the wash, masked at his depth with ripples. The
 * share of the screen that keeps moving (at least 80%) is measured in the browser
 * (tests/browser/seaWreck.spec.ts), as the strand's is.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { bakeElevation } from '../../src/render/elevation.ts';
import { zoneScene } from '../../src/scenes/zoneScene.ts';
import type { SheetAnims } from '../../src/scenes/zoneScene.ts';
import { visualTuning, ZoneVisuals } from '../../src/scenes/zoneVisuals.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { seaWreckContext, wreckScene } from '../../src/sim/sea/wreck.ts';
import { loadPalette, loadPeopleLook, loadSheets } from '../../src/tools/art/artFiles.ts';
import { standardProblems } from '../../src/tools/art/lint.ts';
import { needsShadow } from '../../src/tools/art/standard.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { PERSON_LOOKS } from '../../src/scenes/people.ts';

const palette = loadPalette();
const sheetList = loadSheets(palette);
const anims: SheetAnims = new Map(sheetList.map((s) => [s.name, s.anims]));
const shadows = new Map(sheetList.map((s) => [s.name, s.shadow]));
const balance = loadBalanceJson();
parseTimeBalance(balance);
parsePeopleBasics(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const ctx = seaWreckContext(content);
if (ctx === null) throw new Error('no wreck content');
const map = land.maps.get(ctx.def.zone);
if (map === undefined) throw new Error('no reef zone');
const tuning = visualTuning(balance, palette);
const WRECK_SHEETS = [
  'actor_c_finan',
  'actor_c_derbail',
  'actor_c_ivar',
  'layer_cloak_brat_finan',
  'layer_clothing_leine_finan',
  'layer_clothing_dress_derbail',
  'layer_clothing_tunic_ivar',
  'prop_sea_wreck',
  'fx_sea_wreck',
];

function sceneAt(x: number, y: number, tick: number, minutesToLowWater = 200) {
  const onFoot = wreckScene(ctx!, map!);
  onFoot.player.x = x * map!.tile;
  onFoot.player.y = y * map!.tile;
  const visuals = new ZoneVisuals(map!, bakeElevation(map!.rows), false, tuning);
  const frame = {
    dt: 1 / 60,
    tick,
    onFoot,
    tide: {
      minutesToLowWater,
      minutesSinceLowWater: 720 - minutesToLowWater,
      tidalGroundOpen: false,
    },
    sky: { minuteOfDay: 900, lightFrom: 390, darkFrom: 1200 },
    anims,
    steererSheet: 'actor_p_steerer_a',
  };
  for (let i = 0; i < 3; i++) visuals.update(frame);
  const view = visuals.view(frame);
  return {
    view,
    scene: zoneScene({
      map: map!,
      onFoot,
      tick,
      tideOpen: false,
      phase: 'day',
      look: loadPeopleLook('A'),
      anims,
      shadows,
      highlight: null,
      visual: view,
    }),
  };
}

describe('the reef of Sgeir Dhubh against the Book 7 standard (section 14)', () => {
  it('passes art lint’s standard checks on its zone and sheets', () => {
    expect(standardProblems(sheetList, [map])).toEqual([]);
    const names = new Set(sheetList.map((s) => s.name));
    for (const s of WRECK_SHEETS) expect(names.has(s), s).toBe(true);
    for (const s of sheetList.filter((x) => WRECK_SHEETS.includes(x.name) && needsShadow(x)))
      expect(s.shadow, s.name).not.toBeNull();
  });

  it('draws the survivors from their own layered sheets, and casts a shadow under all it draws', () => {
    for (const id of ['C_FINAN', 'C_DERBAIL', 'C_IVAR']) expect(PERSON_LOOKS[id]).toBeDefined();
    let checked = 0;
    const seen = new Set<string>();
    for (const [x, y] of [
      [13, 19],
      [24, 17],
      [38, 20],
    ] as const) {
      const { scene } = sceneAt(x, y, 0);
      const casters = scene.effects?.shadows ?? [];
      for (const s of scene.sprites) {
        seen.add(s.sheet);
        if (!/^(actor|prop)_/.test(s.sheet) || s.frame.startsWith('carried/')) continue;
        const has = casters.some(
          (c) => c.sheet === s.sheet && c.frame === s.frame && c.x === s.x && c.y === s.y,
        );
        expect(has, `${s.sheet} ${s.frame}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10);
    for (const s of [
      'actor_c_finan',
      'actor_c_derbail',
      'actor_c_ivar',
      'prop_sea_wreck',
      'fx_sea_wreck',
      'ship_t1_launch',
      'ship_t1_crew',
      'actor_gull',
      'actor_seal',
    ])
      expect(seen.has(s), s).toBe(true);
  });

  it('moves its scenery: the boat afloat, the wreck’s water, spray, kelp and the sail awash', () => {
    const frames = (tick: number) =>
      new Map(
        [...sceneAt(14, 20, tick).scene.sprites, ...sceneAt(38, 20, tick).scene.sprites]
          .filter((s) =>
            ['prop_sea_wreck', 'fx_sea_wreck', 'ship_t1_launch', 'ship_t1_crew'].includes(s.sheet),
          )
          .map((s) => [`${s.sheet}@${Math.round(s.x)},${Math.round(s.y)}`, s.frame]),
      );
    const a = frames(0);
    const b = frames(37);
    let moved = 0;
    for (const [k, f] of a) if (b.get(k) !== undefined && b.get(k) !== f) moved++;
    expect(moved).toBeGreaterThan(5);
  });

  it('masks Fínán at his depth in the wash at high water, with ripples round him', () => {
    const f = ctx.def.survivors.find((s) => s.id === 'C_FINAN');
    if (f === undefined) throw new Error('no Fínán');
    const { view } = sceneAt(f.at.x + 1, f.at.y - 1, 0, 360);
    const w = view.water['C_FINAN'];
    expect(w).toBeDefined();
    expect(w?.wade?.mask ?? 0).toBeGreaterThan(0);
  });
});
