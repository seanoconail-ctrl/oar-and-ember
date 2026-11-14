/**
 * The user's fourth playtest, request 24: "Most areas get one or two more points of interest, off
 * the obvious path" (decisions DH-115 to DH-121; Book 9 section 03, "Chapter 1 finds"; Book 10
 * section 20). Each Chapter 1 zone has one or two finds; each lies off the obvious path, can be
 * reached on foot at any tide, is found with Interact (its prompt, sound and caption), and gives
 * what Book 10 says once.
 */
import { describe, expect, it } from 'vitest';
import { SOUNDS } from '../../src/audio/synth/cues.ts';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parseFindsBalance } from '../../src/content/findsBalance.ts';
import { idLikeTokens } from '../../src/content/names.ts';
import { formatString } from '../../src/content/strings.ts';
import { campHooks, campUseLabel } from '../../src/scenes/camp.ts';
import { campUseNear } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { tileBlocks } from '../../src/sim/land/zoneMap.ts';
import type { ZoneMap } from '../../src/sim/land/zoneMap.ts';
import { collectiblesFound, found } from '../../src/sim/narrative/finds.ts';
import { placedUsesHere } from '../../src/sim/narrative/uses.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { Simulation, SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { findPath } from '../../src/tools/play/openingBot.ts';
import type { Tile } from '../../src/tools/play/openingBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const finds = content.finds;
if (finds === null) throw new Error('content/finds.json did not load');
const ZONES = [
  'ZONE_SK_STRAND',
  'ZONE_SK_MACHAIR',
  'ZONE_SK_HAGSEAT',
  'ZONE_SK_CAIRN',
  'ZONE_SK_SEALCAVE',
];

function start(query: string): { sim: Simulation; events: SimEvent[] } {
  const world = newCampaign('finds', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  const sim = createSimulation(b, world, land);
  campHooks(sim.state, content, land, new URLSearchParams(query));
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  for (let i = 0; i < 5; i++) sim.step();
  return { sim, events };
}

const mapOf = (zone: string): ZoneMap => {
  const m = land.maps.get(zone);
  if (m === undefined) throw new Error(`no map ${zone}`);
  return m;
};

/** The tiles where the zone is entered: its linked edges and its spawn. */
function entries(map: ZoneMap): Tile[] {
  const out: Tile[] = [];
  for (const l of map.links ?? []) {
    for (let k = 0; k < (l.edge === 'n' || l.edge === 's' ? map.width : map.height); k++) {
      const t =
        l.edge === 'n'
          ? { tx: k, ty: 0 }
          : l.edge === 's'
            ? { tx: k, ty: map.height - 1 }
            : l.edge === 'w'
              ? { tx: 0, ty: k }
              : { tx: map.width - 1, ty: k };
      if (!tileBlocks(map, t.tx, t.ty, false)) {
        out.push(t);
        break;
      }
    }
  }
  const sp = map.spawns['P_STEERER'];
  if (sp !== undefined) out.push({ tx: Math.floor(sp.x), ty: Math.floor(sp.y) });
  return out;
}

describe("Chapter 1's finds off the paths (asked; request 24; DH-115 to DH-121)", () => {
  it('one or two in each of the five Chapter 1 zones, each a Book 10 row, a sound and a caption', () => {
    const rewards = parseFindsBalance(balance);
    for (const zone of ZONES) {
      const n = finds.finds.filter((f) => f.zone === zone).length;
      expect(n, zone).toBeGreaterThanOrEqual(1);
      expect(n, zone).toBeLessThanOrEqual(2);
    }
    const events = content.audio?.events ?? {};
    for (const f of finds.finds) {
      expect(rewards.has(f.balanceKey), f.key).toBe(true);
      const cue = events[f.sound];
      expect(cue, f.key).toBeDefined();
      expect(SOUNDS.has(cue ?? ''), f.key).toBe(true);
      expect(content.strings.get(f.captionKey)?.tags).toContain('INFO');
    }
  });

  for (const f of finds.finds) {
    it(`${f.key}: reachable on foot from where the zone is entered, at high and low water`, () => {
      const map = mapOf(f.zone);
      const goal = (t: Tile): boolean =>
        Math.hypot(t.tx + 0.5 - f.x, t.ty + 0.7 - f.y) <= land.rules.interactRadiusTiles;
      for (const open of [false, true])
        for (const from of entries(map))
          expect(findPath(map, open, from, goal), `${open}`).not.toBeNull();
      // It stands on open ground and adds no collision, so the edge-walk no-trap test
      // (tests/unit/noTrap.test.ts) walks the same shapes as before.
      expect(tileBlocks(map, Math.floor(f.x), Math.floor(f.y - 0.01), false)).toBe(false);
    });

    it(`${f.key}: off the obvious path (at least 4 tiles from the shortest ways between the zone's entries)`, () => {
      const map = mapOf(f.zone);
      const ends = entries(map);
      let nearest = Infinity;
      for (const a of ends)
        for (const c of ends) {
          if (a === c) continue;
          const path = findPath(map, false, a, (t) => t.tx === c.tx && t.ty === c.ty) ?? [];
          for (const t of path)
            nearest = Math.min(nearest, Math.hypot(t.tx + 0.5 - f.x, t.ty + 0.5 - f.y));
        }
      expect(nearest).toBeGreaterThanOrEqual(4);
    });

    it(`${f.key}: found with Interact: its prompt, its sound and caption, and its reward once`, () => {
      const { sim, events } = start(
        `camp=broch&crew=1&time=12:00&zone=${f.zone}&at=${f.x},${(f.y + 0.6).toFixed(2)}`,
      );
      const map = mapOf(f.zone);
      const p = sim.state.onFoot?.player;
      if (p === undefined) throw new Error('not on foot');
      const uses = placedUsesHere(sim.state, { camp: land.camp, finds: land.finds }, map);
      const near = campUseNear(uses, p, land.rules.interactRadiusTiles * map.tile);
      expect(near?.use.kind).toBe('FIND');
      if (near === null) return;
      const t = (k: string, v: Record<string, string> = {}): string =>
        formatString(content.strings, k, v);
      const label = campUseLabel(near.use, content, t, (id) => id, 'E', false);
      expect(idLikeTokens(label.text)).toEqual([]);
      expect(label.text).toContain(t(f.nameKey));
      const home = sim.state.homes['ISLE_SKARV'];
      const silver = home?.stores['RES_SILVER'] ?? 0;
      const fresh = home?.fresh.reduce((s, x) => s + x.rd, 0) ?? 0;
      sim.submit({ type: 'INTERACT' });
      sim.step();
      const made = events.filter((e) => e.type === 'FIND_MADE');
      expect(made).toHaveLength(1);
      expect(made[0]).toMatchObject({
        key: f.key,
        sound: f.sound,
        captionKey: f.captionKey,
        first: true,
      });
      expect(found(sim.state, f.key)).toBe(true);
      const reward = parseFindsBalance(balance).get(f.balanceKey);
      if (reward?.kind === 'SILVER') expect(home?.stores['RES_SILVER']).toBe(silver + reward.oz);
      if (reward?.kind === 'FOOD')
        expect(home?.fresh.reduce((s, x) => s + x.rd, 0)).toBeCloseTo(fresh + reward.rd);
      if (reward?.kind === 'COLLECTIBLE' && land.finds != null)
        expect(collectiblesFound(sim.state, land.finds)).toBe(reward.count);
      // Again: a TAKE is gone; a READ is read again, and gives nothing more.
      sim.submit({ type: 'INTERACT' });
      sim.step();
      const again = events.filter((e) => e.type === 'FIND_MADE');
      if (f.kind === 'TAKE') expect(again).toHaveLength(1);
      else expect(again[1]).toMatchObject({ first: false, food: 0, silver: 0, collectible: 0 });
      expect(home?.stores['RES_SILVER'] ?? 0).toBe(
        silver + (reward?.kind === 'SILVER' ? reward.oz : 0),
      );
    });
  }
});
