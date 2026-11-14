/**
 * Stage 11 acceptance check 1: each repair visibly changes the boat sprite, tested on the drawn
 * frames (assets/art/sheets, compiled as the game draws them): the boat composited from the layers
 * the scene draws for a state (src/scenes/repairsScene.ts) differs from the state before it in
 * enough pixels to see at 1x, and in the place the repair is. The fitting changes it too, and is
 * reversible: taken off, the boat is drawn as before.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { NO_PIXEL } from '../../src/render/indexedImage.ts';
import { boatLayers } from '../../src/scenes/repairsScene.ts';
import { REPAIRS } from '../../src/sim/ship/ship.ts';
import type { RepairKind } from '../../src/sim/ship/ship.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { loadPalette, loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const palette = loadPalette();
const sheets = new Map(loadSheets(palette).map((s) => [s.name, s]));
const balance = loadBalanceJson();
const { content } = loadContentFromDisk();

function world(): WorldState {
  return newCampaign('ship-art', parseTimeBalance(balance), parsePeopleBasics(balance), content);
}

/** The boat as drawn: its layers composited at one pivot, wind frame 0. */
function drawn(w: WorldState): Uint8Array {
  const hull = sheets.get('ship_t1');
  if (hull === undefined) throw new Error('no ship_t1 sheet');
  const out = new Uint8Array(hull.width * hull.height).fill(NO_PIXEL);
  for (const layer of boatLayers(w)) {
    const sheet = sheets.get(layer.sheet);
    const frame = sheet?.frames.get(layer.frame);
    if (sheet === undefined || frame === undefined)
      throw new Error(`no ${layer.sheet} ${layer.frame}`);
    expect(sheet.pivot).toEqual(hull.pivot);
    frame.pixels.forEach((v, i) => {
      if (v !== NO_PIXEL) out[i] = v;
    });
  }
  return out;
}

function changed(
  a: Uint8Array,
  b: Uint8Array,
  width: number,
): { n: number; x0: number; x1: number } {
  let n = 0;
  let x0 = Infinity;
  let x1 = -Infinity;
  a.forEach((v, i) => {
    if (v === b[i]) return;
    n++;
    x0 = Math.min(x0, i % width);
    x1 = Math.max(x1, i % width);
  });
  return { n, x0, x1 };
}

const done = (w: WorldState, r: RepairKind): void => {
  const ship = w.ships['flagship'];
  if (ship === undefined) throw new Error('no boat');
  ship.repairs[r] = { stage: 'DONE', progress: 0 };
};

describe('each repair visibly changes the boat sprite (Stage 11 check 1)', () => {
  const width = sheets.get('ship_t1')?.width ?? 0;
  /** At least this many pixels change: a visible change at 1x, not a speck. */
  const VISIBLE = 60;

  it.each([['HULL'], ['RIGGING'], ['STEERING_OAR']] as const)(
    '%s done, alone, changes the drawn boat',
    (r) => {
      const w = world();
      const before = drawn(w);
      done(w, r);
      const after = drawn(w);
      expect(changed(before, after, width).n).toBeGreaterThanOrEqual(VISIBLE);
    },
  );

  it('changes it at each step in any order, and all three add the launch-ready rollers', () => {
    for (const order of [
      ['HULL', 'RIGGING', 'STEERING_OAR'],
      ['STEERING_OAR', 'RIGGING', 'HULL'],
      ['RIGGING', 'HULL', 'STEERING_OAR'],
    ] as const) {
      const w = world();
      let last = drawn(w);
      for (const r of order) {
        done(w, r);
        const now = drawn(w);
        expect(changed(last, now, width).n, `${order.join('>')}: ${r}`).toBeGreaterThanOrEqual(
          VISIBLE,
        );
        last = now;
      }
      expect(boatLayers(w).map((l) => l.frame)).toContain('ready/-/0');
    }
  });

  it('draws the hull patch where the holes were: the boards over the stove-in strakes', () => {
    const w = world();
    const before = drawn(w);
    done(w, 'HULL');
    const c = changed(before, drawn(w), width);
    // The holes are amidships (Book 7 section 04: patches in newer timber).
    expect(c.x0).toBeGreaterThan(width * 0.3);
    expect(c.x1).toBeLessThan(width * 0.75);
  });

  it('the fitting changes it, and taken off the boat is drawn as before', () => {
    const w = world();
    for (const r of REPAIRS) done(w, r);
    const bare = drawn(w);
    const ship = w.ships['flagship'];
    if (ship === undefined) throw new Error('no boat');
    for (const [slot, fit] of [
      ['MIDSHIP', 'FIT_EXTENDED_HOLD'],
      ['BOW', 'FIT_RAISED_BOW_PLATFORM'],
    ] as const) {
      ship.fittings[slot] = fit;
      expect(changed(bare, drawn(w), width).n, fit).toBeGreaterThanOrEqual(VISIBLE);
      ship.fittings[slot] = null;
      expect(changed(bare, drawn(w), width).n).toBe(0);
    }
  });
});
