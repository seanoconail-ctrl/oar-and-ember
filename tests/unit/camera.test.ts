/**
 * The camera's feel (Book 7 section 14, Camera feel; Book 10 section 21; playtest note PT-0): the
 * view eases round when the steerer turns, rather than jolting, and holds still on a steady walk.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { visualTuning, ZoneVisuals } from '../../src/scenes/zoneVisuals.ts';
import type { SheetAnims } from '../../src/scenes/zoneScene.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadPalette, loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const palette = loadPalette();
const anims: SheetAnims = new Map(loadSheets(palette).map((s) => [s.name, s.anims]));
const strand = land.maps.get('ZONE_SK_STRAND');
const ground = land.elevations.get('ZONE_SK_STRAND');

/** Walks west then turns east on the keyboard; returns the drawn view's corner each frame. */
function walkAndTurn(): { xs: number[]; turnAt: number } {
  if (strand === undefined || ground === undefined) throw new Error('no strand');
  const world = newCampaign('camera', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  const sim = createSimulation(b, world, land);
  const onFoot = world.onFoot;
  if (onFoot === null) throw new Error('no zone');
  const visuals = new ZoneVisuals(strand, ground, false, visualTuning(balance, palette));
  const tide = tideAt(world.calendar, b);
  const look = (tick: number) => ({
    dt: 1 / 60,
    tick,
    onFoot,
    tide,
    sky: { minuteOfDay: 900, lightFrom: 390, darkFrom: 1200 },
    anims,
    steererSheet: 'actor_p_steerer_a',
  });
  const xs: number[] = [];
  let tick = 0;
  const frame = () => {
    sim.step();
    visuals.update(look(tick));
    xs.push(Math.round(onFoot.player.x) + visuals.lead.x);
    tick += 1;
  };
  for (let i = 0; i < 30; i++) frame();
  sim.submit({ type: 'MOVE', x: -1, y: 0, run: false, sneak: false });
  for (let i = 0; i < 120; i++) frame();
  const turnAt = xs.length;
  sim.submit({ type: 'MOVE', x: 1, y: 0, run: false, sneak: false });
  for (let i = 0; i < 120; i++) frame();
  return { xs, turnAt };
}

describe('the camera eases round a turn (playtest note PT-0)', () => {
  const { xs, turnAt } = walkAndTurn();
  /** The view's speed in px per frame, averaged over 4 frames (whole-pixel steps are 0 or 1). */
  const speed = (i: number) => ((xs[i + 4] ?? 0) - (xs[i] ?? 0)) / 4;

  it('holds a steady walk with no step back', () => {
    const steady = xs.slice(turnAt - 40, turnAt);
    for (let i = 1; i < steady.length; i++)
      expect((steady[i] ?? 0) - (steady[i - 1] ?? 0)).toBeLessThanOrEqual(0);
  });

  it('slows, stops and comes back smoothly, never jolting faster than the walk', () => {
    const walk = Math.abs(speed(turnAt - 20));
    expect(walk).toBeGreaterThan(0.3);
    // The view changes speed gently: never more than half the walking speed in a 4-frame window.
    for (let i = turnAt - 8; i < turnAt + 100; i++)
      expect(Math.abs(speed(i + 1) - speed(i))).toBeLessThanOrEqual(walk / 2 + 0.26);
    // And it is never carried round much faster than the walk while the lead swings (before
    // PT-0 it flung round at six times the walking speed, three pixels a frame).
    for (let i = turnAt; i < turnAt + 100; i++)
      expect(Math.abs(speed(i))).toBeLessThanOrEqual(walk * 2.5);
    // It settles moving the new way.
    expect(speed(turnAt + 110)).toBeGreaterThan(0.3);
  });
});
