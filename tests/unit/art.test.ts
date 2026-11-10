/** Stage 4: the sheet compiler, art lint, the generator, the atlas, the draw list and lighting. */
import { describe, expect, it } from 'vitest';
import { packSheet } from '../../src/render/atlas.ts';
import { renderSceneCpu } from '../../src/render/cpuRenderer.ts';
import { NO_PIXEL } from '../../src/render/indexedImage.ts';
import { buildDrawList, fadeDrops, lightAt, lit } from '../../src/render/scene.ts';
import { compileSheet } from '../../src/render/sheet.ts';
import { artTestScene } from '../../src/scenes/artTest.ts';
import { loadPalette, loadSheets } from '../../src/tools/art/artFiles.ts';
import { lintSheet } from '../../src/tools/art/artLint.ts';
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
    expect(sheets.map((s) => s.name).sort()).toEqual([
      'actor_c_hild',
      'actor_p_steerer_a',
      'actor_p_steerer_b',
      'decal_blood_01',
      'prop_greymen_stone',
      'prop_rock_strand',
      'prop_wreck_t1',
      'tile_machair_01',
      'tile_strand',
      'ui_marker',
    ]);
  });

  it('finds generated sheets and atlases in step with their sources', () => {
    expect(staleArtFiles()).toEqual([]);
  });

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
      height: 40,
      pivot: { x: 16, y: 39 },
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
    const steerer = byName.get('actor_p_steerer_a');
    if (steerer === undefined) throw new Error('missing');
    const { image, manifest } = packSheet(steerer);
    // Seven states (idle 4, look 4, idlewind 4, walk 8, run 8, sneak 6, carry 6) in four facings:
    // 28 rows of up to 8.
    expect([image.width, image.height]).toEqual([8 * 32, 28 * 40]);
    expect(Object.keys(manifest.frames)).toHaveLength(4 * (4 + 4 + 4 + 8 + 8 + 6 + 6));
    expect(new Set(Object.values(manifest.frames).map((p) => p.join())).size).toBe(160);
    expect(manifest.frames['idle/w/3']).toEqual([96, 120]);
    expect(manifest.frames['run/s/7']).toEqual([224, 640]);
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
    expect([steerer?.x, steerer?.y]).toEqual([Math.round(323.4) - 16, Math.round(238.4) - 39]);
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
    // A pixel covered by both the steerer's tunic and the stone, in front: the tunic wins.
    const f = frame('front');
    const s = front[find(front, 'actor_p_steerer_a')];
    if (s === undefined) throw new Error('missing');
    // The tunic's base tone: the madder ramp's step 3 (Book 7 section 14).
    const tunic = palette.entries[palette.ramps.get('madder')?.[3] ?? 0]?.rgb ?? [0, 0, 0];
    const tx = s.x + 15;
    const ty = s.y + 21;
    expect([...f.subarray((ty * 640 + tx) * 4, (ty * 640 + tx) * 4 + 3)]).toEqual([...tunic]);
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
