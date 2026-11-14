/**
 * Stage 14: Skarvholm's collectibles (decisions S14-16 and S14-17; Book 9 section 03,
 * "Collectibles on Skarvholm"; Book 10 section 20, "Skarvholm collectibles"). Their counts are
 * Book 10's; each has its kind, a prop, Interact, a sound and an information caption and journal
 * words; and, in every scene whose plan is built, each lies at least `offPath` tiles off the
 * shortest ways between the scene's entries, is reached on foot under its stated condition (using
 * only the movement verbs its plan marks), stands on open ground (adding no collision), and is
 * found with Interact in a running simulation. Scenes not yet built are listed and skipped, so the
 * test covers them as they appear.
 */
import { describe, expect, it } from 'vitest';
import { SOUNDS } from '../../src/audio/synth/cues.ts';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parseCollectibleCounts } from '../../src/content/islandBalance.ts';
import type { CollectibleDef } from '../../src/content/islandSchema.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { campUseNear } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { collectedCounts } from '../../src/sim/land/collectibles.ts';
import { placedUsesHere } from '../../src/sim/narrative/uses.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import {
  distanceTo,
  HIGH,
  LOW,
  obviousPaths,
  reachable,
  SPRING_LOW,
  standable,
} from './islandReach.ts';
import type { Tide } from './islandReach.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const island = land.island;
if (island == null) throw new Error('no island context');
const counts = parseCollectibleCounts(balance);
const all = island.collectibles;
const built = all.filter((c) => land.maps.has(c.scene));
const unbuilt = [...new Set(all.filter((c) => !land.maps.has(c.scene)).map((c) => c.scene))];
const radius = land.rules.interactRadiusTiles;

/** The tides a collectible is reached at: its condition's, or every tide. */
function tidesOf(c: CollectibleDef): Tide[] {
  const s = JSON.stringify(c.conditions ?? []);
  if (s.includes('SPRING_LOW') || s.includes('"passage"')) return [SPRING_LOW];
  if (s.includes('"LOW"')) return [LOW];
  return [HIGH, LOW];
}

/** A day and time of the first year with a spring-tide low water (or plain low, or high). */
function when(tide: Tide): { day: number; minute: number } {
  for (let day = 1; day <= 120; day++)
    for (let m = 0; m < 1200; m += 10) {
      const minute = (b.dayStart + m) % 1440;
      const t = tideAt({ day, minuteOfDay: minute }, b);
      if (
        t.tidalGroundOpen === tide.low &&
        (!tide.spring || t.springTide) &&
        (tide.spring || !t.springTide || !tide.low)
      )
        return { day, minute };
    }
  throw new Error('no such tide');
}

describe("Skarvholm's collectibles (Book 10 section 20; S14-16, S14-17)", () => {
  it(`counts Book 10's numbers by kind (scenes not yet built: ${unbuilt.join(', ') || 'none'})`, () => {
    const byKind = (k: CollectibleDef['kind']): number => all.filter((c) => c.kind === k).length;
    expect(byKind('SHELL')).toBe(counts.shells);
    expect(byKind('CARVED_STONE')).toBe(counts.carvedStones);
    expect(byKind('PSALTER_PAGE')).toBe(counts.psalterPages);
    expect(byKind('NAME_OF_THE_DEAD')).toBe(counts.namesOfTheDead);
    expect(byKind('SONG')).toBe(counts.songs);
    expect(byKind('LORE')).toBe(counts.lore);
    expect(all.length).toBe(28);
    // One lore for each power.
    expect(new Set(all.filter((c) => c.kind === 'LORE').map((c) => c.power)).size).toBe(
      counts.lore,
    );
  });

  it('gives each its prop, its Interact verb, a generated sound, an information caption and journal words', () => {
    const events = content.audio?.events ?? {};
    for (const c of all) {
      expect(c.frame, c.key).toMatch(/^[a-z_]+\/-\/0$/);
      const cue = events[c.sound];
      expect(cue, `${c.key} ${c.sound}`).toBeDefined();
      expect(SOUNDS.has(cue ?? ''), c.key).toBe(true);
      expect(content.strings.get(c.captionKey)?.tags, c.key).toContain('INFO');
      expect(content.strings.get(c.captionKey)?.text.split(' ').length ?? 99).toBeLessThan(8);
      expect(content.strings.has(c.journalKey), c.key).toBe(true);
      expect(c.use === 'TALK').toBe(c.kind === 'NAME_OF_THE_DEAD');
    }
  });

  for (const c of built) {
    const map = land.maps.get(c.scene);
    if (map === undefined) continue;
    it(`${c.key} (${c.scene}): off the obvious path, reached under its condition, on open ground`, () => {
      const path = obviousPaths(map);
      // The Chapter 1 finds that count were placed by the finds' own rule (tests/unit/pt4finds).
      if (c.find === undefined)
        expect(distanceTo(path, c.pos.x, c.pos.y)).toBeGreaterThanOrEqual(counts.offPathTiles);
      const pos =
        c.find === undefined
          ? c.pos
          : (content.finds?.finds.find((f) => f.key === c.find) ?? c.pos);
      for (const tide of tidesOf(c)) {
        expect(
          standable(map, { tx: Math.floor(pos.x), ty: Math.floor(pos.y - 0.01) }, tide),
          JSON.stringify(tide),
        ).toBe(true);
        expect(
          reachable(map, pos.x, pos.y, radius, tide, (c.reach ?? []).length > 0),
          JSON.stringify(tide),
        ).toBe(true);
      }
    });
  }

  // In play: every one that needs no puzzle solved first; of the drowned, the first to come forward
  // (the others' turns are the puzzle scenario's, tests/scenario/puzzles.test.ts).
  const first = island.puzzles.drowned.order[0]?.key;
  for (const c of built.filter(
    (x) =>
      x.find === undefined &&
      !(x.conditions ?? []).some((k) => 'puzzle' in k || 'fact' in k) &&
      (x.use !== 'TALK' || x.key === `skerry_name_${first}`),
  )) {
    it(`${c.key}: found with Interact in play (its prompt, sound, caption and place in the journal)`, () => {
      const tide = tidesOf(c)[0] ?? HIGH;
      const w = when(tide);
      const world = newCampaign('collect', b, parsePeopleBasics(balance), content, {
        name: 'Ash',
        bodyModel: 'A',
      });
      const sim = createSimulation(b, world, land);
      const hh = String(Math.floor(w.minute / 60)).padStart(2, '0');
      const mm = String(w.minute % 60).padStart(2, '0');
      campHooks(
        sim.state,
        content,
        land,
        new URLSearchParams(
          `camp=broch&crew=1&day=${w.day}&time=${hh}:${mm}&zone=${c.scene}&at=${c.pos.x},${(c.pos.y + 0.6).toFixed(2)}`,
        ),
      );
      const events: SimEvent[] = [];
      sim.events.onAny((e) => events.push(e));
      sim.step();
      const map = land.maps.get(c.scene);
      const p = sim.state.onFoot?.player;
      if (map === undefined || p === undefined) throw new Error('not on foot');
      const uses = placedUsesHere(sim.state, { island }, map);
      const near = campUseNear(uses, p, radius * map.tile);
      expect(near?.use.kind).toBe('FIND');
      sim.submit({ type: 'INTERACT' });
      sim.step();
      const made = events.filter((e) => e.type === 'FIND_MADE');
      expect(made[0]).toMatchObject({
        key: c.key,
        sound: c.sound,
        captionKey: c.captionKey,
        first: true,
      });
      expect(sim.state.regions['REG_SK']?.collected).toContain(c.key);
      const kind = collectedCounts(sim.state, island).find((k) => k.kind === c.kind);
      expect(kind?.found).toBe(1);
      if (c.use === 'TALK')
        expect(
          events
            .filter((e) => e.type === 'ISLAND_SPOKE')
            .map((e) => (e as { lineKey: string }).lineKey),
        ).toEqual(island.puzzles.drowned.order[0]?.lines);
    });
  }
});
