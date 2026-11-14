/**
 * Stage 6 art: the steerer's two body models and Hild are final sprites with the full set of
 * states the opening draws, the same collision footprint, and every frame the strand scene can ask
 * for exists. (The images themselves are inspected at 1x and 4x: see the stage report.)
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { zoneScene } from '../../src/scenes/zoneScene.ts';
import { sceneSprites } from '../../src/render/scene.ts';
import type { SheetAnims } from '../../src/scenes/zoneScene.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { FACINGS } from '../../src/sim/land/zoneMap.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadPalette, loadPeopleLook, loadSheets } from '../../src/tools/art/artFiles.ts';
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
    expect([a.width, a.height]).toEqual([32, 48]);
    expect(a.footprint).toEqual(content.onFoot?.footprint);
    expect(sheets.get('actor_c_hild')?.footprint).toEqual(content.onFoot?.footprint);
  });

  it('meets the Book 7 frame counts: idles 4, walk 6, run 8, sneak 6, carry walk 6, draw 4', () => {
    const a = sheets.get('actor_p_steerer_a');
    expect(
      Object.fromEntries(Object.entries(a?.anims ?? {}).map(([k, v]) => [k, v.frames])),
    ).toEqual({
      idle: 4,
      shift: 4,
      glance: 4,
      idlewind: 4,
      walk: 6,
      run: 8,
      // Design addendum 2.5 (Book 7 section 01; DF-83): the run start's two frames, and the
      // walk's start and stop, so speed builds and dies.
      runstart: 2,
      runstop: 2,
      walkstart: 2,
      walkstop: 2,
      sneak: 6,
      carry: 6,
      draw: 4,
      // Stage 7: the work loops (Book 7 section 07) and sleep.
      gather: 6,
      fish: 6,
      kneel: 6,
      build: 6,
      sleep: 2,
      // Stage 9: the fighting states (Book 10 sections 06 and 21 frame data; Book 7 section 12).
      windup: 2,
      light1: 3,
      light2: 3,
      light3: 3,
      charge: 2,
      chargewalk: 6,
      heavy: 3,
      block: 2,
      parry: 2,
      dodge: 3,
      shove: 3,
      stagger: 2,
      // Combat v2 (decisions DE-4, DE-5, DE-9): the riposte, backstab, lunge, parried and get-up.
      riposte: 3,
      backstab: 3,
      lunge: 2,
      parried: 2,
      getup: 2,
      finish: 1,
      surrender: 2,
      downed: 2,
      dead: 1,
      dead_head: 1,
      dead_arm: 1,
      dead_leg: 1,
      piece_head: 1,
      piece_arm: 1,
      piece_leg: 1,
      // Design addendum 2.5 (Book 7 section 01; DF-1 to DF-9, DF-21): the wind-up draw-backs by
      // weight, the parry's wind-up, the block's raise, the guard broken by an empty bar, the
      // exhausted idle and walk, the dodge's recovery, the stance walk, the flinch, the knockdown,
      // the sidestep, the archer's hop, binding and eating, and the three death falls.
      windup_l: 2,
      windup_h: 2,
      windup_c: 2,
      parry_windup: 2,
      block_raise: 2,
      guard_break: 4,
      exhausted: 4,
      exhausted_walk: 6,
      dodge_recover: 2,
      backoff: 6,
      strafe: 6,
      flinch: 2,
      knockdown: 3,
      sidestep: 3,
      hop: 3,
      bind: 6,
      eat_ration: 4,
      fall_fwd: 2,
      fall_back: 2,
      fall_crumple: 2,
      // DF-83: the block walk (forward, backing off, strafing) and a miss's overbalance.
      block_walk: 6,
      block_backoff: 6,
      block_strafe: 6,
      overbalance: 2,
      // The user's third playtest (Book 7 section 01; DG-2 to DG-10).
      reel: 3,
      guard_turn: 3,
      spare: 4,
      red: 4,
      red_miss: 4,
      fin_seax_s: 8,
      fin_seax_l: 8,
      fin_axe_s: 8,
      fin_axe_l: 8,
      fin_spear_s: 8,
      fin_spear_l: 8,
      fin_sword_s: 8,
      fin_sword_l: 8,
      fin_dane_s: 8,
      fin_dane_l: 8,
      fin_club_s: 8,
      fin_club_l: 8,
      // Stage 14 (decision S14-62): the movement verbs.
      climb: 4,
      swim: 4,
      sink: 4,
      crawl: 4,
      push: 4,
      pull: 4,
      jump: 3,
    });
    expect(sheets.get('actor_c_hild')?.anims['down']?.frames).toBe(2);
    expect(sheets.get('actor_c_hild')?.anims['carried']?.frames).toBe(6);
    expect(sheets.get('actor_c_hild')?.anims['call']?.frames).toBe(6);
  });

  it('dresses the steerer from the body model, with no helmet; Hild in her dress', () => {
    for (const body of ['A', 'B'] as const) {
      const look = loadPeopleLook(body);
      const suffix = body.toLowerCase();
      expect(look.steerer.body).toBe(`actor_p_steerer_${suffix}`);
      for (const f of FACINGS) {
        // Stage 9: the blood layer (drawn only when bloodied) and the seax (only once owned).
        expect([...(look.steerer.layers[f] ?? [])].sort()).toEqual([
          `actor_p_steerer_${suffix}`,
          `layer_blood_wound_${suffix}`,
          `layer_cloak_wool_${suffix}`,
          `layer_clothing_tunic_${suffix}`,
          `layer_weapon_bow_${suffix}`,
          `layer_weapon_seax_${suffix}`,
        ]);
      }
      expect(look.people['C_HILD']?.layers['s']).toEqual([
        'actor_c_hild',
        'layer_clothing_dress_hild',
        'layer_blood_wound_hild',
      ]);
    }
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
            for (const pose of ['down', 'call', 'carried', 'sit'] as const) {
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
                    look: loadPeopleLook(body),
                    anims,
                    highlight: 'C_HILD',
                  });
                  // The plants' batch included (decision DH-161).
                  for (const s of sceneSprites(scene)) {
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
  }, 120_000);
});
