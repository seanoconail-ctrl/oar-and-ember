/**
 * Stage 14 acceptance check 3 (the resource nodes' part): every resource node appears and respawns
 * only in its seasons (or days) and at its tide, gives Book 10's yield into the home's stores, and
 * keeps Book 10's limits (Book 10 section 03, "Island resource nodes"; decisions S14-15 and S14-72
 * to S14-73). Also: the nodes lie in Book 10's numbers in each scene, and the kelp comes again at
 * the dawn after a storm.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance, SEASONS } from '../../src/content/balance.ts';
import type { Season } from '../../src/content/balance.ts';
import { parseNodeBalance } from '../../src/content/islandBalance.ts';
import { DAYS_PER_SEASON, seasonOf, tideAt } from '../../src/sim/calendar/calendar.ts';
import { islandContext } from '../../src/sim/land/island.ts';
import { dayOfYear } from '../../src/sim/land/islandConditions.ts';
import {
  gatherNode,
  nodeAvailable,
  nodeBalance,
  nodeExists,
  stormDawnNodes,
} from '../../src/sim/land/resources.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const ctxOrNull = islandContext(content, balance);
if (ctxOrNull === null) throw new Error('no island context');
const ctx = ctxOrNull;
const nodes = ctx.island.nodes;

function world(): WorldState {
  const w = newCampaign('nodes', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  w.player.hotbar.slots = ['ITEM_BOW', 'ITEM_SPEAR', 'ITEM_SPADE', 'ITEM_LINE'];
  return w;
}

/** The first minute of the day at which the tidal ground is open (low) or shut (high). */
function minuteWith(day: number, low: boolean): number {
  for (let m = 0; m < 1440; m += 5) {
    const minute = (b.dayStart + m) % 1440;
    if (tideAt({ day, minuteOfDay: minute }, b).tidalGroundOpen === low) return minute;
  }
  throw new Error(`no ${low ? 'low' : 'high'} water on day ${day}`);
}

function at(w: WorldState, day: number, low: boolean): void {
  w.calendar = { day, minuteOfDay: minuteWith(day, low) };
}

/** Days of the first year to look at: every fifth day and each season's first and last. */
const DAYS = [
  ...new Set([...Array.from({ length: 24 }, (_, i) => i * 5 + 1), 30, 31, 60, 61, 90, 91, 120]),
];

describe('island resource nodes (Book 10 section 03; S14-15)', () => {
  it("lie in each scene in Book 10's numbers", () => {
    const rows = parseNodeBalance(balance);
    for (const nb of rows.values()) {
      for (const [scene, n] of Object.entries(nb.perScene))
        expect(
          nodes.filter((x) => x.kind === nb.kind && x.scene === scene).length,
          `${nb.kind} ${scene}`,
        ).toBe(n);
      expect(nodes.filter((x) => x.kind === nb.kind).length, nb.kind).toBe(nb.count);
      for (const x of nodes.filter((y) => y.kind === nb.kind))
        expect(nb.scenes, x.key).toContain(x.scene);
    }
  });

  for (const n of nodes) {
    it(`${n.key} (${n.kind}): there only in its seasons, days and tide`, () => {
      const w = world();
      const nb = nodeBalance(ctx, n);
      for (const day of DAYS)
        for (const low of [false, true]) {
          at(w, day, low);
          const season: Season = seasonOf(day);
          let expected = nb.seasons.includes(season);
          if (nb.days !== undefined)
            expected &&= dayOfYear(day) >= nb.days[0] && dayOfYear(day) <= nb.days[1];
          if (nb.tide === 'LOW') expected &&= low;
          // A fishing rock in winter only on a calm day; no weather drawn here: not calm.
          if (nb.winterCalmOnly && season === 'Winter') expected = false;
          expect(nodeExists(w, ctx, n), `day ${day} ${low ? 'low' : 'high'}`).toBe(expected);
          expect(nodeAvailable(w, ctx, n)).toBe(expected);
        }
    });

    it(`${n.key} (${n.kind}): gathered into the stores; comes again only after its respawn, never out of season`, () => {
      const w = world();
      const nb = nodeBalance(ctx, n);
      const first = DAYS.find((d) => {
        const ok =
          nb.seasons.includes(seasonOf(d)) && !(nb.winterCalmOnly && seasonOf(d) === 'Winter');
        return (
          ok &&
          (nb.days === undefined || (dayOfYear(d) >= nb.days[0] && dayOfYear(d) <= nb.days[1]))
        );
      });
      expect(first).toBeDefined();
      const day = first ?? 1;
      at(w, day, true);
      const home = w.homes['ISLE_SKARV'];
      if (home === undefined) throw new Error('no home');
      const fresh = home.fresh.reduce((s, f) => s + f.rd, 0);
      const stores = { ...home.stores };
      let minutes = 0;
      const events: string[] = [];
      expect(
        gatherNode(w, ctx, n.key, { advance: (m) => (minutes += m) }, (e) => events.push(e.key)),
      ).toBe(true);
      expect(events).toEqual([n.key]);
      expect(minutes).toBe(nb.minutes);
      expect(home.fresh.reduce((s, f) => s + f.rd, 0)).toBeCloseTo(fresh + nb.yield.freshRd);
      if (nb.yield.freshRd > 0) expect(home.fresh.at(-1)?.keeps).toBe(nb.yield.keepsDays);
      for (const [res, amount] of Object.entries(nb.yield.stores))
        expect(home.stores[res]).toBeCloseTo((stores[res] ?? 0) + amount);
      if (nb.respawnDays > 0) {
        // Taken: not there again until its respawn days have passed, in season.
        expect(nodeAvailable(w, ctx, n)).toBe(false);
        at(w, day + nb.respawnDays - 1, true);
        if (nodeExists(w, ctx, n)) expect(nodeAvailable(w, ctx, n)).toBe(false);
        at(w, day + nb.respawnDays, true);
        expect(nodeAvailable(w, ctx, n)).toBe(nodeExists(w, ctx, n));
      }
      // Out of season it never comes, whatever the respawn says.
      for (const season of SEASONS.filter((s) => !nb.seasons.includes(s))) {
        const d = SEASONS.indexOf(season) * DAYS_PER_SEASON + 5;
        at(w, d, true);
        expect(nodeAvailable(w, ctx, n), season).toBe(false);
      }
    });
  }

  it('keeps the seals to perSeason in their days, and a peat bank to perSeason loads until spring', () => {
    for (const kind of ['seals', 'peat'] as const) {
      const n = nodes.find((x) => x.kind === kind);
      if (n === undefined) throw new Error(kind);
      const nb = nodeBalance(ctx, n);
      const w = world();
      const day = nb.days?.[0] ?? 1;
      at(w, day, true);
      let taken = 0;
      while (gatherNode(w, ctx, n.key, { advance: () => undefined }, () => undefined)) taken++;
      expect(taken, kind).toBe(nb.perSeason);
      if (kind === 'peat') {
        // Still cut back in summer; given again from the next spring.
        at(w, DAYS_PER_SEASON + 3, true);
        expect(nodeAvailable(w, ctx, n)).toBe(false);
        at(w, 4 * DAYS_PER_SEASON + 2, true);
        expect(nodeAvailable(w, ctx, n)).toBe(true);
      }
    }
  });

  it('refuses a node whose tool is not to hand (the peat spade, the bow, a line)', () => {
    const w = world();
    w.player.hotbar.slots = [];
    const peat = nodes.find((x) => x.kind === 'peat');
    if (peat === undefined) throw new Error('peat');
    at(w, 2, true);
    expect(gatherNode(w, ctx, peat.key, { advance: () => undefined }, () => undefined)).toBe(false);
  });

  it('brings the kelp again at the dawn after a storm', () => {
    const w = world();
    const kelp = nodes.find((x) => x.kind === 'kelp');
    if (kelp === undefined) throw new Error('kelp');
    at(w, 3, true);
    expect(gatherNode(w, ctx, kelp.key, { advance: () => undefined }, () => undefined)).toBe(true);
    at(w, 4, true);
    expect(nodeAvailable(w, ctx, kelp)).toBe(false);
    stormDawnNodes(w, ctx);
    expect(nodeAvailable(w, ctx, kelp)).toBe(true);
  });

  it("leaves the strand's driftwood to the dawn and the dawn to the driftwood (no shared keys)", () => {
    const keys = new Set((content.camp?.sites ?? []).map((s) => s.key));
    for (const n of nodes) expect(keys.has(n.key), n.key).toBe(false);
  });
});
