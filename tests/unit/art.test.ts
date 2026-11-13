/** Stage 4: the sheet compiler, art lint, the generator, the atlas, the draw list and lighting. */
import { describe, expect, it } from 'vitest';
import { MAX_ATLAS, packSheet } from '../../src/render/atlas.ts';
import { renderSceneCpu } from '../../src/render/cpuRenderer.ts';
import { NO_PIXEL } from '../../src/render/indexedImage.ts';
import { buildDrawList, fadeDrops, lightAt, lit } from '../../src/render/scene.ts';
import { compileSheet } from '../../src/render/sheet.ts';
import { artTestScene } from '../../src/scenes/artTest.ts';
import { loadLayerDefs, loadPalette, loadSheets } from '../../src/tools/art/artFiles.ts';
import { layerProblems, lintSheet } from '../../src/tools/art/artLint.ts';
import { staleArtFiles } from '../../src/tools/art/lint.ts';
import { generateSheet } from '../../src/tools/art/materials.ts';
import { loadRenderStyle } from '../../src/tools/art/render-check.ts';

const palette = loadPalette();
const style = loadRenderStyle();
const sheets = loadSheets(palette);
const byName = new Map(sheets.map((s) => [s.name, s]));

const HEADER = [
  'sheet: prop_test',
  'kind: prop',
  'palette: book07',
  'size: 4x3',
  'pivot: 2,2',
  'footprint: 2x1',
  'facings: -',
  'anim.stand: frames 1, ticks 1',
].join('\n');

describe('the sheet compiler (Book 2 section 19)', () => {
  it('compiles a valid sheet', () => {
    const sheet = compileSheet(
      `${HEADER}\nframe stand - 0\n.kk.\nkOOk\nkkkk\nend\n`,
      't.txt',
      palette,
    );
    expect(sheet.frames.get('stand/-/0')?.pixels[5]).toBe(palette.indexOf.get('O'));
  });

  it.each([
    [
      `${HEADER}\nframe stand - 0\n.kk.\nkOZk\nkkkk\nend`,
      /t\.txt:11: column 3: "Z" is not a book07 code/,
    ],
    [`${HEADER}\nframe stand - 0\n.kk.\nkkkk\nend`, /frame has 2 rows; the sheet is 3 high/],
    [`${HEADER}\nframe walk - 0\n.kk.\nkOOk\nkkkk\nend`, /undeclared state "walk"/],
    [
      `${HEADER.replace('facings: -', 'facings: s n')}\nframe stand s 0\n.kk.\nkOOk\nkkkk\nend`,
      /missing frame "stand n 0"/,
    ],
    [`${HEADER}\nframe stand - 3\n.kk.\nkOOk\nkkkk\nend`, /frame index 3 is outside 0 to 0/],
  ])('refuses defects, naming the file and line', (text, message) => {
    expect(() => compileSheet(text, 't.txt', palette)).toThrow(message);
  });
});

describe('art lint (Book 7 section 11) — Stage 4 acceptance check 1', () => {
  it('passes on every committed sheet', () => {
    expect(sheets.flatMap((s) => lintSheet(s, palette))).toEqual([]);
    expect(layerProblems(sheets, loadLayerDefs(), palette)).toEqual([]);
    expect(sheets.map((s) => s.name).sort()).toEqual([
      'actor_c_bran_heavy',
      'actor_c_hild',
      'actor_c_oddi',
      'actor_c_runa',
      'actor_c_thorkel',
      'actor_cormorant',
      'actor_crab',
      'actor_e_wrecker_conn',
      'actor_e_wrecker_ketill_heavy',
      'actor_e_wrecker_svart',
      'actor_gull',
      'actor_heavy',
      'actor_p_steerer_a',
      'actor_p_steerer_b',
      'actor_seal',
      'actor_sheep',
      'bld_broch',
      'bld_cairn',
      'bld_fold',
      'bld_sealcave',
      'decal_blood_01',
      'decal_broch',
      'decal_strand',
      'fx_combat',
      'fx_fire',
      'fx_glint',
      'fx_gore',
      'fx_hag',
      'fx_hag_mist',
      'fx_missile',
      'fx_net',
      'fx_opening',
      'fx_outline',
      'fx_people',
      'fx_rain_cloth',
      'fx_sealcave',
      'fx_seamap',
      'fx_shelter_cut',
      'fx_south',
      'fx_storm',
      'fx_storm_drops',
      'fx_storm_mist',
      'fx_strand',
      'layer_blood_wound_a',
      'layer_blood_wound_b',
      'layer_blood_wound_bran_heavy',
      'layer_blood_wound_conn',
      'layer_blood_wound_heavy',
      'layer_blood_wound_hild',
      'layer_blood_wound_ketill_heavy',
      'layer_blood_wound_oddi',
      'layer_blood_wound_runa',
      'layer_blood_wound_svart',
      'layer_cloak_wool_a',
      'layer_cloak_wool_b',
      'layer_cloak_wool_heavy',
      'layer_cloak_wool_thorkel',
      'layer_cloak_wrecker_ketill_heavy',
      'layer_cloak_wrecker_svart',
      'layer_clothing_dress_hild',
      'layer_clothing_dress_runa',
      'layer_clothing_tunic_a',
      'layer_clothing_tunic_b',
      'layer_clothing_tunic_bran_heavy',
      'layer_clothing_tunic_heavy',
      'layer_clothing_tunic_oddi',
      'layer_clothing_tunic_thorkel',
      'layer_clothing_wrecker_conn',
      'layer_clothing_wrecker_ketill_heavy',
      'layer_clothing_wrecker_svart',
      'layer_helmet_iron_a',
      'layer_helmet_iron_b',
      'layer_helmet_iron_heavy',
      'layer_shield_back_svart',
      'layer_shield_round_bran_heavy',
      'layer_shield_round_ketill_heavy',
      'layer_shield_round_svart',
      'layer_weapon_axe_bran_heavy',
      'layer_weapon_axe_ketill_heavy',
      'layer_weapon_bow_a',
      'layer_weapon_bow_b',
      'layer_weapon_bow_conn',
      'layer_weapon_bow_heavy',
      'layer_weapon_seax_a',
      'layer_weapon_seax_b',
      'layer_weapon_seax_conn',
      'layer_weapon_seax_oddi',
      'layer_weapon_spear_svart',
      'plant_strand',
      'prop_boards',
      'prop_boulder',
      'prop_camp',
      'prop_chest_open',
      'prop_chest_runa',
      'prop_chest_thorkel',
      'prop_cold_figures',
      'prop_cold_sail',
      'prop_debris',
      'prop_door_broch',
      'prop_driftwood',
      'prop_flap_sail',
      'prop_greymen_stone',
      'prop_hagstone',
      'prop_heather',
      'prop_mast_broken',
      'prop_pickup',
      'prop_rigging',
      'prop_rigging_tangle',
      'prop_rock_strand',
      'prop_rockpool',
      'prop_sail_leanto',
      'prop_sail_raise',
      'prop_sail_roof',
      'prop_shelter_inside',
      'prop_shipsetting',
      'prop_skiff',
      'prop_steering_oar',
      'prop_stones',
      'prop_stores_bundle',
      'prop_strongbox',
      'prop_wreck_stern',
      'prop_wreck_t1',
      'ship_t1',
      'ship_t1_crew',
      'ship_t1_launch',
      'ship_t1_parts',
      'ship_t1_sail',
      'ship_t1_storm',
      'ship_t1_storm_mast',
      'tile_machair_01',
      'tile_strand',
      'token_t1',
      'ui_aim',
      'ui_clock',
      'ui_combat',
      'ui_cursor',
      'ui_cursor_glyph',
      'ui_digits',
      'ui_hotbar',
      'ui_icons',
      'ui_marker',
      'ui_order',
      'ui_seamap',
      'ui_stamina',
      'ui_stamina_reason',
      'ui_timing',
    ]);
    // Over a hundred sheets by Stage 11: on a shared CI runner this takes longer than five seconds.
  }, 30_000);

  // It regenerates every sheet and atlas in memory: Stage 7's broch, camp and work loops made that
  // longer than the default five seconds, and combat v2's five new states on every body sheet
  // (about 22 s alone) take it past 30 s while the whole suite runs in parallel. A time limit,
  // not an art threshold: what it checks is unchanged.
  it('finds generated sheets and atlases in step with their sources', () => {
    expect(staleArtFiles()).toEqual([]);
  }, 60_000);

  const lint = (body: string, header = HEADER) =>
    lintSheet(compileSheet(`${header}\n${body}`, 't.txt', palette), palette).map((i) => i.reason);

  it('fails a sprite edge that is not the ink outline', () => {
    expect(lint('frame stand - 0\n.kk.\nkOOO\nkkkk\nend').join()).toMatch(
      /not the one-pixel ink outline/,
    );
  });

  it('fails a reserved accent in ordinary art, unless the sheet declares it', () => {
    expect(lint('frame stand - 0\n.kk.\nk1Ok\nkkkk\nend').join()).toMatch(
      /reserved accent "Sea-light/,
    );
    expect(lint('frame stand - 0\n.kk.\nk1Ok\nkkkk\nend', `${HEADER}\nreserved: 1`)).toEqual([]);
  });

  it('fails feet that are off the pivot row, and a badly named sheet', () => {
    expect(lint('frame stand - 0\n.kk.\nkkkk\n....\nend').join()).toMatch(/not on the pivot row 2/);
    expect(
      lint('frame stand - 0\n.kk.\nkOOk\nkkkk\nend', HEADER.replace('prop_test', 'Stone')).join(),
    ).toMatch(/name does not follow/);
  });

  it('holds the steerer to the Book 7 adult canvas and four facings', () => {
    const steerer = byName.get('actor_p_steerer_a');
    expect(steerer).toMatchObject({
      width: 32,
      height: 48,
      pivot: { x: 16, y: 47 },
      facings: ['s', 'n', 'e', 'w'],
    });
    expect(steerer?.anims['idle']).toEqual({ frames: 4, ticks: 15, loop: true });
    expect(steerer?.placeholder).toBe(false);
  });
});

describe('the material-map generator', () => {
  const map = [
    'sheet: prop_box',
    'kind: prop',
    'palette: book07',
    'size: 6x5',
    'pivot: 3,4',
    'footprint: 2x1',
    'facings: e w',
    'anim.stand: frames 1, ticks 1',
    'outline: k 4',
    'material.S: F O b',
    'mirror.w: e',
    'frame stand e 0',
    '......',
    '.SSS..',
    '.SSSS.',
    '.SSSS.',
    '......',
    'end',
  ].join('\n');
  const sheet = compileSheet(generateSheet(map, 'box.map.txt'), 'box.txt', palette);
  const code = (facing: string, x: number, y: number) => {
    const v = sheet.frames.get(`stand/${facing}/0`)?.pixels[y * 6 + x] ?? NO_PIXEL;
    return v === NO_PIXEL ? '.' : palette.entries[v]?.code;
  };

  it('outlines in ink and lights from the upper left', () => {
    expect(code('e', 1, 0)).toBe('k');
    expect(code('e', 1, 1)).toBe('F');
    expect(code('e', 2, 2)).toBe('O');
    expect(code('e', 4, 3)).toBe('b');
  });

  it('mirrors before shading, so a west facing is still lit from the upper left', () => {
    expect(code('w', 4, 1)).toBe('F');
    expect(code('w', 1, 3)).toBe('F');
    expect(code('w', 4, 3)).toBe('b');
  });
});

describe('atlases', () => {
  it('pack every frame once, one row per state and facing', () => {
    const hild = byName.get('actor_c_hild');
    if (hild === undefined) throw new Error('missing');
    const { image, manifest } = packSheet(hild);
    // Nineteen states (idle, shift, glance, idlewind 4 each, walk 6, run 8, runstart 1, runstop 2,
    // call 6, down 2, carried 6, sit 4, eat 4; from Stage 7 the work loops gather, fish, kneel and
    // build 6 each, and sleep 2; from Stage 9 stagger 2) in four facings: 76 rows of up to 8.
    expect([image.width, image.height]).toEqual([8 * 32, 76 * 48]);
    const perFacing = 4 + 4 + 4 + 4 + 6 + 8 + 1 + 2 + 6 + 2 + 6 + 4 + 4 + 6 + 6 + 6 + 6 + 2 + 2;
    expect(Object.keys(manifest.frames)).toHaveLength(4 * perFacing);
    expect(new Set(Object.values(manifest.frames).map((p) => p.join())).size).toBe(4 * perFacing);
    expect(manifest.frames['idle/w/3']).toEqual([96, 3 * 48]);
    expect(manifest.frames['run/s/7']).toEqual([224, 20 * 48]);
  });

  it('pack a sheet too tall for one row a state into a square-ish grid, every frame once', () => {
    const steerer = byName.get('actor_p_steerer_a');
    if (steerer === undefined) throw new Error('missing');
    const { image, manifest } = packSheet(steerer);
    // Stage 9's fighting states (Book 10 frame data) take the steerer to 38 states, 152 rows of
    // 48 px: past MAX_ATLAS, so its frames pack in reading order (combat v2's five new states
    // make 532 frames, 24 across).
    const perFacing =
      4 +
      4 +
      4 +
      4 +
      6 +
      8 +
      1 +
      2 +
      6 +
      6 +
      4 +
      6 +
      6 +
      6 +
      6 +
      2 + // Stages 4 to 7
      (2 + 3 + 3 + 3 + 2 + 6 + 3 + 2 + 2 + 3 + 3 + 2 + 1 + 2 + 2 + 1 + 3 + 3) + // Stage 9
      (3 + 3 + 2 + 2 + 2); // combat v2: riposte, backstab, lunge, parried, get-up
    expect(Object.keys(manifest.frames)).toHaveLength(4 * perFacing);
    expect(new Set(Object.values(manifest.frames).map((p) => p.join())).size).toBe(4 * perFacing);
    expect([image.width, image.height]).toEqual([24 * 32, 23 * 48]);
    expect(image.height).toBeLessThanOrEqual(MAX_ATLAS);
    expect(manifest.frames['idle/w/3']).toEqual([15 * 32, 0]);
    expect(manifest.frames['run/s/7']).toEqual([23 * 32, 3 * 48]);
  });
});

describe('the draw list — Stage 4 acceptance check 3 (depth sorting and cutaway)', () => {
  const front = buildDrawList(artTestScene('front'), byName, style.cutawayFade);
  const behind = buildDrawList(artTestScene('behind'), byName, style.cutawayFade);
  const find = (list: typeof front, sheet: string) => list.findIndex((d) => d.sheet === sheet);

  it('snaps every position to whole logical pixels', () => {
    for (const item of [...front, ...behind]) {
      expect(Number.isInteger(item.x) && Number.isInteger(item.y)).toBe(true);
    }
    const steerer = front[find(front, 'actor_p_steerer_a')];
    expect([steerer?.x, steerer?.y]).toEqual([Math.round(323.4) - 16, Math.round(238.4) - 47]);
  });

  it('draws ground, then decals, then actors and props by foot line', () => {
    expect(front.slice(0, 405).every((d) => d.sheet === 'tile_machair_01')).toBe(true);
    expect(find(front, 'decal_blood_01')).toBe(405);
    expect(find(front, 'prop_greymen_stone')).toBeLessThan(find(front, 'actor_p_steerer_a'));
    expect(find(behind, 'prop_greymen_stone')).toBeGreaterThan(find(behind, 'actor_p_steerer_a'));
  });

  it('cuts away the stone only when it stands in front of the player', () => {
    expect(front[find(front, 'prop_greymen_stone')]?.fade).toBe(0);
    expect(behind[find(behind, 'prop_greymen_stone')]?.fade).toBe(0.5);
    expect([0, 1, 2, 3].filter((x) => fadeDrops(x, 0, 0.5))).toHaveLength(2);
  });

  it('shows the player through the cut-away stone, and over the stone when in front', () => {
    const steerer = byName.get('actor_p_steerer_a');
    const stone = byName.get('prop_greymen_stone');
    if (steerer === undefined || stone === undefined) throw new Error('missing');
    const frame = (which: 'front' | 'behind') =>
      renderSceneCpu(artTestScene(which), byName, palette, style);
    // A pixel covered by both the steerer's body and the stone, in front: the body wins.
    const f = frame('front');
    const s = front[find(front, 'actor_p_steerer_a')];
    if (s === undefined) throw new Error('missing');
    const tx = s.x + 15;
    const ty = s.y + 30;
    const own = steerer.frames.get('idle/s/0')?.pixels[30 * steerer.width + 15] ?? NO_PIXEL;
    expect(own).not.toBe(NO_PIXEL);
    const body = palette.entries[own]?.rgb ?? [0, 0, 0];
    expect([...f.subarray((ty * 640 + tx) * 4, (ty * 640 + tx) * 4 + 3)]).toEqual([...body]);
    // Behind: inside the stone's outline, steerer pixels show through where the dither drops stone.
    const b = frame('behind');
    const st = behind[find(behind, 'prop_greymen_stone')];
    const sb = behind[find(behind, 'actor_p_steerer_a')];
    if (st === undefined || sb === undefined) throw new Error('missing');
    const stoneBase = palette.entries[palette.indexOf.get('O') ?? 0]?.rgb ?? [0, 0, 0];
    let stoneShown = 0;
    let throughStone = 0;
    for (
      let y = Math.max(st.y, sb.y) + 4;
      y < Math.min(st.y + st.height, sb.y + sb.height) - 4;
      y++
    ) {
      for (let x = st.x + 5; x < st.x + 11; x++) {
        const px = [...b.subarray((y * 640 + x) * 4, (y * 640 + x) * 4 + 3)];
        if (px.join() === stoneBase.join()) stoneShown++;
        else if (!fadeDrops(x, y, 0.5)) continue;
        else throughStone++;
      }
    }
    expect(stoneShown).toBeGreaterThan(0);
    expect(throughStone).toBeGreaterThan(0);
  });
});

describe('lighting — Stage 4 acceptance check 3 (a lighting change)', () => {
  it('multiplies by the ambient light and adds banded pools, capped at 255', () => {
    expect(lightAt(10, 10, [255, 255, 255], [], 3)).toEqual([255, 255, 255]);
    expect(lit(200, 255)).toBe(200);
    expect(lit(200, 128)).toBe(100);
    const pool = { x: 100.5, y: 100.5, radius: 30, colour: [90, 60, 30] as const };
    expect(lightAt(100, 100, [92, 116, 164], [pool], 3)).toEqual([182, 176, 194]);
    expect(lightAt(100 + 29, 100, [92, 116, 164], [pool], 3)).toEqual([122, 136, 174]);
    expect(lightAt(100 + 31, 100, [92, 116, 164], [pool], 3)).toEqual([92, 116, 164]);
    expect(lightAt(100, 100, [250, 250, 250], [pool], 3)).toEqual([255, 255, 255]);
  });

  it('makes dusk warm and night dark and blue, and lights the lantern pool', () => {
    const mean = (which: 'front' | 'dusk' | 'night') => {
      const f = renderSceneCpu(artTestScene(which), byName, palette, style);
      const sum = [0, 0, 0];
      for (let i = 0; i < f.length; i += 4)
        for (let c = 0; c < 3; c++) sum[c] = (sum[c] ?? 0) + (f[i + c] ?? 0);
      return sum.map((v) => v / (f.length / 4));
    };
    const [dr = 0, , db = 0] = mean('front');
    const [ur = 0, , ub = 0] = mean('dusk');
    const [nr = 0, ng = 0, nb = 0] = mean('night');
    expect(ur / ub).toBeGreaterThan(dr / db);
    expect(nr + ng + nb).toBeLessThan((dr + db) * 1.5 * 0.6);
    expect(nb).toBeGreaterThan(nr);
    const night = renderSceneCpu(artTestScene('night'), byName, palette, style);
    const at = (x: number, y: number) =>
      (night[(y * 640 + x) * 4] ?? 0) + (night[(y * 640 + x) * 4 + 1] ?? 0);
    expect(at(296, 226)).toBeGreaterThan(at(60, 40));
  });
});

describe('people sheets (Book 7 sections 01 and 07; design addendum 2.3 sections 11 and 12)', () => {
  const crown = (name: string, key: string): number => {
    const img = byName.get(name)?.frames.get(key);
    if (img === undefined) throw new Error(`no ${name} ${key}`);
    const row = Array.from({ length: img.height }, (_, y) => y).find((y) =>
      Array.from({ length: img.width }, (_, x) => img.pixels[y * img.width + x]).some(
        (v) => v !== NO_PIXEL,
      ),
    );
    return row ?? -1;
  };
  const sole = (name: string, key: string): number => {
    const img = byName.get(name)?.frames.get(key);
    if (img === undefined) throw new Error(`no ${name} ${key}`);
    let last = -1;
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++)
        if ((img.pixels[y * img.width + x] ?? NO_PIXEL) !== NO_PIXEL) last = y;
    return last;
  };
  const bodies = ['actor_p_steerer_a', 'actor_p_steerer_b', 'actor_c_hild', 'actor_heavy'];

  it('walks in 6 frames, the head dropping exactly 1 px on the down frames (heavy 1 to 2)', () => {
    for (const name of bodies) {
      expect(byName.get(name)?.anims['walk']?.frames, name).toBe(6);
      for (const f of ['s', 'n', 'e', 'w']) {
        for (const [down, contact] of [
          [1, 0],
          [4, 3],
        ] as const) {
          const drop = crown(name, `walk/${f}/${down}`) - crown(name, `walk/${f}/${contact}`);
          if (name === 'actor_heavy') expect(drop, `${name} ${f}`).toBeGreaterThanOrEqual(1);
          else expect(drop, `${name} ${f} walk ${down}`).toBe(1);
          expect(drop).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('runs in 8 frames: both feet off the ground in each suspension, the torso down 1 to 2 px', () => {
    for (const name of bodies) {
      const sheet = byName.get(name);
      expect(sheet?.anims['run']?.frames, name).toBe(8);
      for (const f of ['s', 'n', 'e', 'w']) {
        for (const s of [3, 7]) expect(sole(name, `run/${f}/${s}`)).toBeLessThan(47);
        for (const [down, contact] of [
          [1, 0],
          [5, 4],
        ] as const) {
          const drop = crown(name, `run/${f}/${down}`) - crown(name, `run/${f}/${contact}`);
          expect(drop, `${name} ${f} run ${down}`).toBeGreaterThanOrEqual(1);
          expect(drop).toBeLessThanOrEqual(2);
        }
        // Every other standing frame has its feet on the pivot row.
        expect(sole(name, `run/${f}/0`)).toBe(47);
        expect(sole(name, `walk/${f}/2`)).toBe(47);
      }
    }
  });

  it('fails a walk without the 1 px drop and a run with a foot on the ground in suspension', () => {
    const a = byName.get('actor_p_steerer_a');
    if (a === undefined) throw new Error('missing');
    const frames = new Map(a.frames);
    const same = (key: string, from: string): void => {
      const img = a.frames.get(from);
      if (img !== undefined) frames.set(key, img);
    };
    same('walk/s/1', 'walk/s/0');
    same('run/e/3', 'run/e/0');
    const issues = lintSheet({ ...a, frames }, palette).map((i) => `${i.frame} ${i.reason}`);
    expect(issues.join('\n')).toMatch(/walk\/s\/1 the walk's down frame drops the head 0 px/);
    expect(issues.join('\n')).toMatch(/run\/e\/3 the run's suspension frame has a foot/);
  });

  it('fails a layer whose frames or anchor differ from its body, and a composite without ink', () => {
    const tunic = byName.get('layer_clothing_tunic_a');
    if (tunic === undefined) throw new Error('missing');
    const def = { name: 'test', layers: { s: [], n: [], e: [], w: [] } };
    const person = (layer: string) => ({
      ...def,
      layers: Object.fromEntries(
        ['s', 'n', 'e', 'w'].map((f) => [f, ['actor_p_steerer_a', layer]]),
      ),
    });
    const sheetsWith = (extra: typeof tunic) => [...sheets, extra];
    const shifted = { ...tunic, name: 'layer_clothing_shifted_a', pivot: { x: 15, y: 47 } };
    expect(
      layerProblems(sheetsWith(shifted), [person(shifted.name)], palette).map((i) => i.reason),
    ).toContain(
      "its canvas or foot anchor differs from its body's (body actor_p_steerer_a, Book 2 section 19)",
    );
    const anims = Object.fromEntries(Object.entries(tunic.anims).filter(([k]) => k !== 'draw'));
    const fewer = { ...tunic, name: 'layer_clothing_fewer_a', anims };
    expect(
      layerProblems(sheetsWith(fewer), [person(fewer.name)], palette).map((i) => i.reason),
    ).toContain(
      "its states and frame counts differ from its body's (body actor_p_steerer_a, Book 2 section 19)",
    );
    // The bow's larger canvas is centred on the same anchor, so it fits.
    expect(
      layerProblems(sheets, [person('layer_weapon_bow_a')], palette).filter(
        (i) => i.sheet === 'layer_weapon_bow_a',
      ),
    ).toEqual([]);
    // Clothing cut for the heavy build, over body A, leaves its cloth edges showing: no ink.
    const misfit = layerProblems(sheets, [person('layer_clothing_tunic_heavy')], palette);
    expect(misfit.some((i) => i.reason.includes('outer edge pixel'))).toBe(true);
  });
});
