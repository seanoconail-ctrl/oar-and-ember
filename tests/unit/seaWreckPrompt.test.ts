/**
 * Stage 13, decision S13-81: the prompt line on the reef. Package B flagged that no prompt showed by
 * a survivor or at the boat's side; the wreck's uses now go through one rule (`wreckUseNow`) that
 * the simulation acts on when Interact is pressed and the play view names as its prompt, with the
 * words in content/strings/en.json and no ID on screen (Book 2 section 21, "One list of what
 * Interact does"; Book 8 section 10). A survivor's words come before lifting them until heard once.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { idLikeTokens } from '../../src/content/names.ts';
import { formatString } from '../../src/content/strings.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { wreckUseLabel } from '../../src/scenes/seaWreckPlay.ts';
import { interactionNow } from '../../src/sim/land/onFoot.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { ASK_SITE, inWreck, wreckUseNow } from '../../src/sim/sea/wreck.ts';
import type { SeaWreckContext } from '../../src/sim/sea/wreck.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { Simulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const maybeCtx = land.seaWreck ?? null;
if (maybeCtx === null) throw new Error('no wreck content');
const ctx: SeaWreckContext = maybeCtx;
const map = land.maps.get(ctx.def.zone);
if (map === undefined) throw new Error('no reef');
const T = map.tile;
const t = (key: string, vars: Record<string, string> = {}): string =>
  formatString(content.strings, key, vars);
const nameOf = (id: string): string => t(`person.short.${id.toLowerCase()}`);

function onTheReef(): Simulation {
  const world = newCampaign('wreck-prompt', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams('camp=broch&crew=1&wreck=1&time=10:00'));
  const sim = createSimulation(b, world, land);
  sim.step();
  expect(inWreck(sim.state, ctx)).toBe(true);
  return sim;
}

function standAt(sim: Simulation, x: number, y: number): void {
  const p = sim.state.onFoot?.player;
  if (p === undefined) throw new Error('not on foot');
  p.x = x * T;
  p.y = y * T;
}

/** The prompt the play view shows now, by the same rule as the simulation. */
function promptNow(sim: Simulation, mouse = false): string | null {
  const w = sim.state;
  const onFoot = w.onFoot;
  if (onFoot === null) return null;
  const interaction = interactionNow(onFoot, map as never, land.rules, true, w.facts);
  const use = wreckUseNow(w, ctx, T, interaction);
  return use === null ? null : wreckUseLabel(use, nameOf, t, 'E', mouse).text;
}

describe('the prompt line on the reef (S13-81)', () => {
  it('names each survivor by name, and Interact opens the very words it names', () => {
    for (const s of ctx.def.survivors) {
      const sim = onTheReef();
      standAt(sim, s.at.x + 0.5, s.at.y);
      const name = nameOf(s.id);
      expect(promptNow(sim)).toBe(`E  Talk to ${name}`);
      expect(promptNow(sim, true)).toBe(`Right-click  Talk to ${name}`);
      sim.submit({ type: 'INTERACT' });
      sim.step();
      expect(sim.state.talk?.scene).toBe(`wreck.${s.id}`);
      // Talking hides the prompt (the play view's rule: no prompt with talk open).
      expect(promptNow(sim)).toBeNull();
    }
  });

  it('names the boat’s side, and Interact there opens Hild’s question', () => {
    const sim = onTheReef();
    standAt(sim, ctx.def.board.x, ctx.def.board.y);
    expect(promptNow(sim)).toBe('E  Back to the boat');
    expect(promptNow(sim, true)).toBe('Right-click  Back to the boat');
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(sim.state.talk?.scene).toBe(ASK_SITE);
  });

  it('Ívar’s words come before lifting him, until heard; then the prompt and Interact lift', () => {
    const sim = onTheReef();
    const ivar = sim.state.onFoot?.actors['C_IVAR'];
    if (ivar === undefined) throw new Error('no Ívar');
    standAt(sim, ivar.x / T + 0.6, ivar.y / T);
    expect(promptNow(sim)).toBe('E  Talk to Ívar');
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(sim.state.talk?.scene).toBe('wreck.C_IVAR');
    sim.submit({ type: 'TALK_END' });
    sim.step();
    expect(sim.state.talk).toBeNull();
    // Heard: the game's own lift prompt shows (no wreck use), and Interact lifts him.
    expect(promptNow(sim)).toBeNull();
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(sim.state.onFoot?.carrying).toBe('C_IVAR');
    // Carrying: Interact sets down, never opens words.
    standAt(sim, ctx.def.board.x, ctx.def.board.y);
    expect(promptNow(sim)).toBeNull();
  });

  it('no prompt on the reef carries an ID or an unfilled key', () => {
    for (const key of ['ui.prompt.wreck_board', 'ui.prompt.wreck_board_click']) {
      expect(content.strings.has(key), key).toBe(true);
      expect(idLikeTokens(t(key, { key: 'E' })), key).toEqual([]);
    }
    for (const s of ctx.def.survivors)
      expect(idLikeTokens(t('ui.prompt.talk', { key: 'E', name: nameOf(s.id) }))).toEqual([]);
  });
});
