/**
 * Stage 7 acceptance check 4, the scene side (Book 7 section 07): a task plays its work loop for
 * the steerer and for a resident alike, the frames advance while the work goes on, the sleeper is
 * drawn asleep, and a lit fire draws its flames and a warm pool of light that is larger at night.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parseRenderStyle } from '../../src/render/scene.ts';
import type { Phase } from '../../src/render/scene.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { zoneScene } from '../../src/scenes/zoneScene.ts';
import { DRIFTWOOD_SHEET } from '../../src/scenes/zoneScene.ts';
import type { CampScene, SheetAnims } from '../../src/scenes/zoneScene.ts';
import { campContext, driftwoodPieces } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { findActor } from '../../src/sim/land/zoneLinks.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { Simulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadPalette, loadPeopleLook, loadSheets, readRepo } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { CampBot } from '../../src/tools/play/campBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const campOrNull = campContext(content);
const campDef = content.camp;
if (campOrNull === null || campDef === null) throw new Error('no camp content');
const camp = campOrNull;
const def = campDef;
const sheetList = loadSheets(loadPalette());
const anims: SheetAnims = new Map(sheetList.map((s) => [s.name, s.anims]));
const look = loadPeopleLook('A');
const style = parseRenderStyle(JSON.parse(readRepo('assets/art/render.json')) as unknown);
const loops = Object.fromEntries(Object.entries(def.tasks).map(([id, t]) => [id, t.workLoop]));

function atBroch(query: string): { sim: Simulation; bot: CampBot } {
  const world = newCampaign('loops', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams(`camp=broch&${query}`));
  const sim = createSimulation(b, world, land);
  return { sim, bot: new CampBot(sim, b, land, camp) };
}

function campScene(sim: Simulation): CampScene {
  const home = sim.state.homes[def.home];
  if (home === undefined) throw new Error('no home');
  const fire = def.sites.find((s) => s.kind === 'FIRE');
  const here = sim.state.onFoot?.zone === def.zone;
  return {
    props: here ? (home.stage === 'S1' ? def.props.S1 : def.props.S0) : [],
    stage: home.stage,
    fire:
      fire === undefined || !here
        ? null
        : { x: fire.x, y: fire.y, lit: home.fire.lit, fuel: home.fire.fuel },
    woodpile: null,
    driftwood:
      sim.state.onFoot === null ? [] : driftwoodPieces(sim.state, camp, sim.state.onFoot.zone),
    loops,
    building: null,
    light: style.fire ?? null,
  };
}

function scene(sim: Simulation, phase: Phase = 'day') {
  const onFoot = sim.state.onFoot;
  if (onFoot === null) throw new Error('not on foot');
  const map = land.maps.get(onFoot.zone);
  if (map === undefined) throw new Error('no map');
  return zoneScene({
    map,
    onFoot,
    tick: sim.state.tick,
    tideOpen: false,
    phase,
    look,
    anims,
    highlight: null,
    camp: campScene(sim),
  });
}

/** The frames a person's body is drawn with over the next `ticks` ticks. */
function framesOf(sim: Simulation, body: string, ticks: number): string[] {
  const frames: string[] = [];
  for (let i = 0; i < ticks; i++) {
    const sprite = scene(sim).sprites.find((s) => s.sheet === body);
    if (sprite !== undefined) frames.push(sprite.frame);
    sim.step();
  }
  return frames;
}

describe('work loops in the scene (Book 7 section 07; Stage 7 check 4)', () => {
  it('draws the steerer stooping for driftwood in the gather loop, its frames advancing', () => {
    const { sim, bot } = atBroch('time=10:00');
    bot.goToZone('ZONE_SK_STRAND');
    bot.goToSite('drift_east_rocks');
    // The piece lies there, drawn with its shadow, until the stoop's low point (decision PT-5).
    const piece = () => scene(sim).sprites.filter((s) => s.sheet === DRIFTWOOD_SHEET).length;
    const before = piece();
    expect(before).toBeGreaterThan(0);
    bot.interact();
    expect(sim.state.onFoot?.player.work?.task).toBe('TASK_GATHER_DRIFTWOOD');
    expect(sim.state.onFoot?.player.work?.ticks).toBe(camp.stoopTicks);
    const frames = framesOf(sim, look.steerer.body, camp.stoopTicks - 2);
    expect(frames.every((f) => f.startsWith('gather/'))).toBe(true);
    expect(new Set(frames).size).toBeGreaterThan(3);
    expect(piece()).toBe(before - 1);
  });

  it('plays the same loop for the steerer and a resident at the same task', () => {
    const { sim, bot } = atBroch('time=07:00&tended=1&fire=lit&line=1&day=2');
    // The ship's stores are already up from the mast, so Hild reckons on no more food than the
    // stores hold and keeps to her nets this morning (DG-90).
    sim.state.facts['ch1.mast_stores'] = 'CAMP';
    // Hild goes down to fish from the morning after her leg is tended.
    const hildNow = () =>
      sim.state.onFoot === null ? null : findActor(sim.state.onFoot, 'C_HILD');
    bot.waitFor(
      () => {
        const h = hildNow();
        return h?.zone === 'ZONE_SK_STRAND' && h.actor.pose === 'work' && h.actor.walk == null;
      },
      60 * 60 * 60,
    );
    expect(hildNow()?.actor.task).toBe('TASK_FISH_SHORE');
    const hildLook = look.people['C_HILD'];
    if (hildLook === undefined) throw new Error('no look for Hild');
    // Follow her: the steerer goes down to the strand and casts too.
    bot.goToZone('ZONE_SK_STRAND');
    // Beside her on the shore she fishes from.
    const spot = def.people['C_HILD']?.work;
    if (spot === undefined) throw new Error('Hild has no work spot');
    expect(bot.walkTo((t) => Math.hypot(t.tx + 0.5 - spot.x - 1.5, t.ty + 0.5 - spot.y) < 1)).toBe(
      true,
    );
    // The tide must be in far enough to cast into: wait for it, standing at the shore.
    let cast = bot.fish('leave');
    for (let tries = 0; !cast && tries < 40; tries++) {
      bot.waitUntil((sim.state.calendar.minuteOfDay + 15) % 1440);
      cast = bot.fish('leave');
    }
    expect(cast).toBe(true);
    const steerer = framesOf(sim, look.steerer.body, 40);
    expect(steerer.every((f) => f.startsWith('fish/'))).toBe(true);
    const hildFrames = scene(sim)
      .sprites.filter((s) => s.sheet === hildLook.body)
      .map((s) => s.frame);
    // She is on the strand with the steerer, at her line.
    expect(sim.state.onFoot?.actors['C_HILD']?.pose).toBe('work');
    expect(hildFrames.length).toBeGreaterThan(0);
    expect(hildFrames.every((f) => f.startsWith('fish/'))).toBe(true);
    expect(loops['TASK_FISH_SHORE']).toBe('fish');
    // Both bodies carry the loop, for every facing.
    for (const body of [look.steerer.body, hildLook.body])
      expect(anims.get(body)?.['fish']?.frames, body).toBeGreaterThan(1);
  });

  it('draws the sleeper asleep, breathing', () => {
    const { sim, bot } = atBroch('time=19:00');
    bot.goToSite('bed_s0');
    sim.submit({ type: 'SLEEP' });
    sim.step();
    expect(sim.state.onFoot?.player.sleep).not.toBeNull();
    // The user's fourth playtest (request 15; DH-105): the sleeper lies under their own blanket in
    // the bed (prop_sleepers), the head to the wall, breathing over four frames; the standing body
    // is not drawn while asleep.
    expect(framesOf(sim, look.steerer.body, 1)).toEqual([]);
    const frames = framesOf(sim, 'prop_sleepers', 170);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((f) => /^steerer_[ab]_w\//.test(f))).toBe(true);
    expect(new Set(frames).size).toBeGreaterThanOrEqual(2);
  });

  it('draws a lit fire with flames and a flickering warm pool, larger at night', () => {
    const { sim } = atBroch('time=23:00&fire=lit');
    const night = scene(sim, 'night');
    expect(night.sprites.some((s) => s.sheet === 'fx_fire' && s.frame.startsWith('flames/'))).toBe(
      true,
    );
    const pool = night.pools[0];
    expect(pool).toBeDefined();
    const day = scene(sim, 'day').pools[0];
    expect(day?.radius ?? 0).toBeLessThan(pool?.radius ?? 0);
    // The fire ring lies flat, under the flames.
    const ring = night.sprites.find((s) => s.frame.startsWith('firering/'));
    expect(ring?.layer).toBe('decal');
    // It flickers: the pool's radius changes from frame to frame.
    const radii = new Set<number>();
    for (let i = 0; i < 10; i++) {
      sim.step();
      radii.add(Math.round((scene(sim, 'night').pools[0]?.radius ?? 0) * 10));
    }
    expect(radii.size).toBeGreaterThan(1);
  });
});
