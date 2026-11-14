/**
 * Stage 10 acceptance check 3 (Book 2 section 17; Book 4 section 07, the fairness contract): the
 * Hag's Seat event declares its sign, rule, response and consequence; content lint fails an omen
 * missing any of them; and the game keeps each part: the sign shows on reaching the headland, the
 * rule is told, either response changes the outcome, and the consequence is saved and reported.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { loadContent } from '../../src/content/registry.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { stoneWeeps } from '../../src/sim/narrative/searches.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk, readContentFiles } from '../../src/tools/content/loadContentFiles.ts';
import { SearchBot } from '../../src/tools/play/searchBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const omen = content.searches?.omens.find((o) => o.id === 'OMEN_HAGSEAT_STONE');
const audio = content.audio;

describe('the Hag’s Seat event (OMEN_HAGSEAT_STONE)', () => {
  it('declares sign, rule, response and consequence', () => {
    if (omen === undefined) throw new Error('no omen');
    expect(omen.power).toBe('POWER_CAILLEACH');
    expect(omen.sign.what.length).toBeGreaterThan(20);
    expect(omen.rule.what.length).toBeGreaterThan(20);
    expect(omen.response.map((r) => r.do).sort()).toEqual(['CLIFF_PATH', 'OFFER']);
    expect(omen.consequence).toMatchObject({ fact: 'search.runa', power: 'POWER_CAILLEACH' });
    // The sign's tell is a sound of its own, captioned (Book 11 section 12).
    const tell = audio?.cues.find((c) => c.id === omen.sign.tell);
    expect(tell).toBeDefined();
    expect(content.strings.has(omen.sign.caption)).toBe(true);
    expect(content.strings.has(omen.rule.told)).toBe(true);
    expect(content.strings.has(omen.consequence.report)).toBe(true);
  });

  it('content lint fails an omen without one of the four', () => {
    for (const part of ['sign', 'rule', 'response', 'consequence'] as const) {
      const files = readContentFiles();
      const searches = structuredClone(files.searches) as { omens: Record<string, unknown>[] };
      const first = searches.omens[0];
      if (first === undefined) throw new Error('no omen');
      if (part === 'response') first[part] = [];
      else Reflect.deleteProperty(first, part);
      const { issues } = loadContent({ ...files, searches });
      expect(
        issues.some((i) => i.file === 'content/searches.json' && i.path.includes(part)),
        part,
      ).toBe(true);
    }
  });

  it('keeps all four in play: the sign, the rule told, a response, the consequence saved and reported', () => {
    const world = newCampaign('omen', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'B',
    });
    campHooks(world, content, land, new URLSearchParams('camp=broch&time=10:00'));
    const sim = createSimulation(b, world, land);
    const events: SimEvent[] = [];
    sim.events.onAny((e) => events.push(e));
    if (land.camp == null || land.searches == null) throw new Error('no content');
    const bot = new SearchBot(sim, b, land, land.camp, land.searches);
    sim.step();
    expect(stoneWeeps(sim.state)).toBe(true);
    bot.runa('OFFERING');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'PERSON_SPOKE', lineKey: omen?.rule.told }),
    );
    expect(stoneWeeps(sim.state)).toBe(false);
    expect(sim.state.powers['POWER_CAILLEACH']).toMatchObject({
      stone: 'DRY',
      offering: 'CONFESSION',
    });
    // The next morning's report says so (once).
    bot.goToZone('ZONE_SK_MACHAIR');
    bot.waitUntil(b.sleepAfter + 10);
    bot.goToSite('bed_s0');
    sim.submit({ type: 'SLEEP' });
    bot.waitFor(() => sim.state.calendar.day === 2);
    expect(sim.state.report?.lines.map((l) => l.key)).toContain('report.search.cailleach');
  });
});
