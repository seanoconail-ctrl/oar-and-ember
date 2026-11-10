/**
 * Stage 6 art: the steerer's two body models and Hild are final sprites with the full set of
 * states the opening draws, the same collision footprint, and every frame the strand scene can ask
 * for exists. (The images themselves are inspected at 1x and 4x: see the stage report.)
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { zoneScene } from '../../src/scenes/zoneScene.ts';
import type { SheetAnims } from '../../src/scenes/zoneScene.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { FACINGS } from '../../src/sim/land/zoneMap.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadPalette, loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const sheets = new Map(loadSheets(loadPalette()).map((s) => [s.name, s]));
const anims: SheetAnims = new Map([...sheets.values()].map((s) => [s.name, s.anims]));
const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);

describe('people sprites (Book 7 sections 01 and 07)', () => {
  const steerers = ['actor_p_steerer_a', 'actor_p_steerer_b'];

  it('gives both body models the same states, frames, facings and footprint', () => {
    const [a, bModel] = steerers.map((n) => sheets.get(n));
    if (a === undefined || bModel === undefined) throw new Error('missing a body model');
    expect(bModel.anims).toEqual(a.anims);
    expect(bModel.facings).toEqual(a.facings);
    expect(bModel.footprint).toEqual(a.footprint);
    expect([a.width, a.height]).toEqual([32, 40]);
    expect(a.footprint).toEqual(content.onFoot?.footprint);
    expect(sheets.get('actor_c_hild')?.footprint).toEqual(content.onFoot?.footprint);
  });

  it('meets the Book 7 frame counts: idle 4, walk 6, run 8, sneak 6, carry walk 6', () => {
    const a = sheets.get('actor_p_steerer_a');
    expect(
      Object.fromEntries(Object.entries(a?.anims ?? {}).map(([k, v]) => [k, v.frames])),
    ).toEqual({ idle: 4, walk: 6, run: 8, sneak: 6, carry: 6 });
    expect(sheets.get('actor_c_hild')?.anims['down']?.frames).toBe(2);
    expect(sheets.get('actor_c_hild')?.anims['carried']?.frames).toBe(6);
  });

  it('has no placeholders among the Stage 6 sheets', () => {
    for (const name of [
      ...steerers,
      'actor_c_hild',
      'tile_strand',
      'prop_rock_strand',
      'prop_wreck_t1',
      'ui_marker',
    ]) {
      expect(sheets.get(name)?.placeholder, name).toBe(false);
    }
  });
});

describe('the strand scene', () => {
  it('asks only for frames that exist, in every gait, facing, pose and both tides', () => {
    const missing = new Set<string>();
    for (const body of ['A', 'B'] as const) {
      const world = newCampaign('art', b, parsePeopleBasics(balance), content, {
        name: 'Ash',
        bodyModel: body,
      });
      const onFoot = world.onFoot;
      const map = land.maps.get('ZONE_SK_STRAND');
      if (onFoot === null || map === undefined) throw new Error('no strand');
      const hild = onFoot.actors['C_HILD'];
      if (hild === undefined) throw new Error('no Hild');
      // Walk the camera over the whole zone, so every terrain and edge in it is drawn.
      const spots: [number, number][] = [];
      for (let y = 0; y < map.height * 24; y += 300)
        for (let x = 0; x < map.width * 24; x += 560) spots.push([x, y]);
      for (const [x, y] of spots) {
        for (const gait of ['walk', 'run', 'sneak', 'carry'] as const) {
          for (const facing of FACINGS) {
            for (const pose of ['down', 'carried', 'sit'] as const) {
              for (const tideOpen of [false, true]) {
                for (const tick of [0, 101]) {
                  onFoot.player = { ...onFoot.player, x, y, facing, gait, moving: tick > 0 };
                  onFoot.carrying = pose === 'carried' ? 'C_HILD' : null;
                  hild.pose = pose;
                  hild.x = x - 30;
                  hild.y = y;
                  hild.facing = facing;
                  const scene = zoneScene({
                    map,
                    onFoot,
                    tick,
                    tideOpen,
                    phase: 'day',
                    look: {
                      steerer: `actor_p_steerer_${body.toLowerCase()}`,
                      people: { C_HILD: 'actor_c_hild' },
                    },
                    anims,
                    highlight: 'C_HILD',
                  });
                  for (const s of scene.sprites) {
                    if (sheets.get(s.sheet)?.frames.has(s.frame) !== true)
                      missing.add(`${s.sheet} ${s.frame}`);
                  }
                }
              }
            }
          }
        }
      }
    }
    expect([...missing]).toEqual([]);
  }, 30_000);
});
