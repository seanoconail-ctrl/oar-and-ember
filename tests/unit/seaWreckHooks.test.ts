/**
 * Stage 13, work package C (decisions S13-56 and S13-57): the wreck standalone (`?wreck=1`, as the
 * browser test opens it) puts the steerer on the reef with the voyage waiting for the scene's
 * result; and the wreck's sounds come on their fixed schedule, the cries with their direction and
 * only until Hild's question is answered, the timber marked unseen while the wreck is out of view.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { wreckSide, wreckSounds } from '../../src/scenes/seaWreck.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { currentHandoff } from '../../src/sim/sea/index.ts';
import { WRECK_FACTS, inWreck, seaWreckContext } from '../../src/sim/sea/wreck.ts';
import type { SeaWreckContext } from '../../src/sim/sea/wreck.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const maybeCtx = seaWreckContext(content);
if (maybeCtx === null) throw new Error('no wreck content');
const ctx: SeaWreckContext = maybeCtx;

function standalone() {
  const world = newCampaign('wreck', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams('camp=broch&crew=1&wreck=1&time=10:00'));
  return world;
}

describe('the wreck standalone and its sounds', () => {
  it('?wreck=1 puts the steerer on the reef, the voyage waiting for the result', () => {
    const world = standalone();
    expect(world.onFoot?.zone).toBe('ZONE_SEA_WRECK');
    expect(inWreck(world, ctx)).toBe(true);
    expect(currentHandoff(world)).toMatchObject({ scenarioId: 'SCN_SEA_WRECK', kind: 'ON_FOOT' });
    expect(world.sea.stash?.zone).toBe('ZONE_SK_MACHAIR');
    expect(world.sea.voyage?.aboard.length).toBeGreaterThan(0);
  });

  it('plays cries with their direction until the question is answered, timber on a schedule', () => {
    const world = standalone();
    const map = land.maps.get(ctx.def.zone);
    if (map === undefined) throw new Error('no reef');
    const far = { x: 30 * 24, y: 12 * 24 };
    const heard: string[] = [];
    for (let t = 0; t < 1600; t++) {
      world.tick = t;
      for (const s of wreckSounds(world, ctx, map, far, { w: 640, h: 360 })) {
        heard.push(s.event);
        expect(s.direction).toBe('w');
        expect(s.unseen).toBe(true);
      }
    }
    expect(heard).toContain('WRECK_CRIES');
    expect(heard).toContain('WRECK_GRIND');
    expect(heard).toContain('WRECK_BREAK');
    world.facts[WRECK_FACTS.choice] = 'LEAVE';
    for (let t = 0; t < 1600; t++) {
      world.tick = t;
      for (const s of wreckSounds(world, ctx, map, far, { w: 640, h: 360 }))
        expect(s.event).not.toBe('WRECK_CRIES');
    }
    expect(wreckSide(map, far.x, 640)).toBe(-1);
    expect(wreckSide(map, 0, 640)).toBeLessThan(0);
  });
});
