/**
 * Golden saves (Book 2 section 20): fixed scenarios saved to tests/golden-saves/ so every later
 * schema change must migrate them. Golden save 1: a new campaign played through two on-foot days
 * (a sleep after 18:00, then a collapse at 02:00) with the opening one-shot fired.
 *
 *   node src/tools/saves/golden.ts        rewrites tests/golden-saves/golden-01.json
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePeopleBasics, parseTimeBalance } from '../../content/balance.ts';
import { writeSave } from '../../persist/save.ts';
import type { SaveFile } from '../../persist/save.ts';
import { fireOneShot, setFact } from '../../sim/ledger/ledger.ts';
import { createSimulation } from '../../sim/simulation.ts';
import { newCampaign } from '../../sim/world.ts';
import type { WorldState } from '../../sim/world.ts';
import { REPO_ROOT } from '../art/loadTitleArt.ts';
import { loadBalanceJson } from '../content/loadBalance.ts';
import { loadContentFromDisk } from '../content/loadContentFiles.ts';

export const GOLDEN_01 = 'tests/golden-saves/golden-01.json';

export function goldenWorld01(): WorldState {
  const balance = loadBalanceJson();
  const b = parseTimeBalance(balance);
  const { content, issues } = loadContentFromDisk();
  if (issues.length > 0)
    throw new Error(`content has ${issues.length} problem(s); run npm run content:lint`);
  const world = newCampaign('golden-01', b, parsePeopleBasics(balance), content);
  fireOneShot(world, 'BEAT_1_WAKE', () => {
    setFact(world, 'opening.woke', true);
  });
  const sim = createSimulation(b, world);
  // Day 1: play to 19:00 and sleep.
  while (sim.state.calendar.minuteOfDay !== 19 * 60) sim.step();
  sim.submit({ type: 'SLEEP' });
  sim.step();
  // Day 2: stay up until the collapse at 02:00; wake at 08:00 on day 3.
  while (sim.state.calendar.day < 3) sim.step();
  return sim.state;
}

export function goldenSave01(): SaveFile {
  return writeSave(goldenWorld01(), {
    build: 'golden',
    kind: 'checkpoint',
    slot: 'checkpoint:golden-01',
    label: 'golden-01',
    sequence: 1,
    savedAt: '2026-11-10T00:00:00.000Z',
  });
}

if (import.meta.filename === process.argv[1]) {
  writeFileSync(join(REPO_ROOT, GOLDEN_01), `${JSON.stringify(goldenSave01(), null, 2)}\n`);
  console.log(`wrote ${GOLDEN_01}`);
}
