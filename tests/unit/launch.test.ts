/**
 * Stage 12, unit checks: Book 10's launch numbers, the boat's name made safe (Book 8's string
 * rules: free text, never a variable), the sail marks of Book 7 section 04, the chapter's
 * telemetry in the save, the launch's art (art lint covers the rest) and its music as note data.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MUSIC_VOICES } from '../../src/audio/synth/engine.ts';
import { modeClasses, parseLayer } from '../../src/audio/synth/notation.ts';
import type { Piece } from '../../src/audio/synth/notation.ts';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parseLaunchBalance } from '../../src/content/launchBalance.ts';
import { readSave, writeSave } from '../../src/persist/save.ts';
import { loadSheets } from '../../src/tools/art/artFiles.ts';
import type { Sheet } from '../../src/render/sheet.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { cleanShipName, markOf } from '../../src/sim/narrative/launch.ts';
import { MILESTONES, playedSeconds, telemetryReport } from '../../src/sim/narrative/telemetry.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { REPO_ROOT } from '../../src/tools/art/loadTitleArt.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const launch = land.launch;
if (launch == null) throw new Error('no launch content');
let sheets: Sheet[] | null = null;
const loadSheet = (name: string): Sheet => {
  sheets ??= loadSheets();
  const sheet = sheets.find((s) => s.name === name);
  if (sheet === undefined) throw new Error(`no sheet ${name}`);
  return sheet;
};

describe("Book 10's launch (section 22)", () => {
  it('reads every number from balance.json', () => {
    expect(parseLaunchBalance(balance)).toEqual({
      floats: 'KNEE',
      skidsTiles: 8,
      slideSpeed: 1.8,
      rowSpeed: 1.2,
      rowOutTiles: 9,
      trialRowMinutes: 60,
      tideLookaheadMinutes: 24 * 60,
      storesShortDays: 3,
    });
  });
});

describe("the boat's name (free text under Book 8's string rules)", () => {
  it('keeps letters, accents, spaces, hyphens and apostrophes, and nothing that could act', () => {
    expect(cleanShipName('Grey Seal', 24)).toBe('Grey Seal');
    expect(cleanShipName('  Wave-Hound  ', 24)).toBe('Wave-Hound');
    expect(cleanShipName("Hild's Luck", 24)).toBe("Hild's Luck");
    expect(cleanShipName('Sæ-Hrafn Ásdís', 24)).toBe('Sæ-Hrafn Ásdís');
    // No braces (never a {variable}), digits, symbols or markup.
    expect(cleanShipName('{steerer}<b>7</b>', 24)).toBe('steererbb');
    expect(cleanShipName('   ', 24)).toBeNull();
    expect(cleanShipName('!!!', 24)).toBeNull();
    expect(cleanShipName('A'.repeat(40), 24)).toHaveLength(24);
    expect(cleanShipName('Old    Sow', 24)).toBe('Old Sow');
  });

  it('offers period suggestions, each a name the cleaning keeps whole', () => {
    for (const key of launch.def.names.suggestions) {
      const text = content.strings.get(key)?.text ?? '';
      expect(text, key).not.toBe('');
      expect(cleanShipName(text, launch.def.names.maxLength)).toBe(text);
    }
  });
});

describe('the sail marks (Book 7 section 04)', () => {
  it('are patterns in madder, woad or weld on undyed wool, or plain undyed wool', () => {
    expect(markOf(launch, 'plain', null)).toBe('plain');
    expect(markOf(launch, 'plain', 'woad')).toBe('plain');
    expect(markOf(launch, 'stripes_broad', 'madder')).toBe('stripes_broad:madder');
    expect(markOf(launch, 'raven', null)).toBeNull();
    expect(markOf(launch, 'raven', 'black')).toBeNull();
    expect(markOf(launch, 'lion', 'woad')).toBeNull();
    const patterns = launch.def.marks.patterns.map((p) => p.key);
    expect(patterns).toEqual([
      'plain',
      'stripes_broad',
      'stripes_narrow',
      'lozenge',
      'quartered',
      'raven',
      'serpent',
      'wave',
      'cross',
      'sunwheel',
    ]);
    expect(launch.def.marks.dyes.map((d) => d.key)).toEqual(['madder', 'woad', 'weld']);
  });

  it('every mark is drawn on the sail, dropping and set, and on the sea-map token, each its own', () => {
    const sail = loadSheet('ship_t1_sail');
    const token = loadSheet('token_t1');
    const states: string[] = ['plain'];
    for (const p of launch.def.marks.patterns.filter((x) => x.dyed))
      for (const d of launch.def.marks.dyes) states.push(`${p.key}_${d.key}`);
    const drawn = new Set<string>();
    for (const s of states) {
      expect(sail.anims[`set_${s}`]?.frames, s).toBe(4);
      expect(sail.anims[`drop_${s}`]?.frames, s).toBe(3);
      expect(token.anims[s]?.frames, s).toBe(2);
      const frame = sail.frames.get(`set_${s}/-/0`);
      expect(frame).toBeDefined();
      drawn.add(Array.from(frame?.pixels ?? []).join(','));
    }
    // Every mark looks different on the sail.
    expect(drawn.size).toBe(states.length);
  });

  it('the household is drawn aboard, each of the four at each seat, and the steerer at the helm', () => {
    const crew = loadSheet('ship_t1_crew');
    for (const who of ['hild', 'oddi', 'runa', 'bran'])
      for (let seat = 0; seat < 4; seat++) expect(crew.anims[`${who}_${seat}`]?.frames).toBe(4);
    expect(crew.anims['helm_a']?.frames).toBe(4);
    expect(crew.anims['helm_b']?.frames).toBe(4);
    const launchSheet = loadSheet('ship_t1_launch');
    expect(Object.keys(launchSheet.anims).sort()).toEqual(['afloat', 'mast', 'oar']);
  });

  it('the sea map is a whole chart, with its sheen, cloud shadow and mist, and the smoke', () => {
    const map = loadSheet('ui_seamap');
    expect([map.width, map.height]).toEqual([640, 360]);
    for (const v of ['chart', 'lit', 'shade', 'fog']) {
      const f = map.frames.get(`${v}/-/0`);
      expect(f, v).toBeDefined();
      // Opaque: a frame of the whole chart.
      expect(Array.from(f?.pixels ?? []).every((p) => p >= 0)).toBe(true);
    }
    expect(loadSheet('fx_seamap').anims['smoke']?.frames).toBe(6);
  });
});

describe('the chapter telemetry (Book 3 Stage 12 check 1)', () => {
  it('marks each milestone the first time it is reached and keeps it in the save', () => {
    const world = newCampaign('tel', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'A',
    });
    const sim = createSimulation(b, world, land);
    expect(world.telemetry).toEqual({ start: 0, heldMs: 0, marks: {} });
    world.player.hotbar.slots[0] = 'ITEM_SEAX';
    for (let i = 0; i < 120; i++) sim.step();
    expect(world.telemetry.marks['seax']).toMatchObject({ tick: 0, day: 1 });
    // Design addendum 2.4: awake on the strand from the first tick (no cold open in this world).
    expect(world.telemetry.marks['woke']).toMatchObject({ tick: 0, day: 1 });
    sim.submit({ type: 'TIME_HELD', ms: 4500 });
    sim.step();
    expect(world.telemetry.heldMs).toBe(4500);
    const rep = telemetryReport(world);
    expect(rep.now).toBeCloseTo(world.tick / 60 + 4.5, 5);
    expect(rep.marks).toEqual([
      { key: 'woke', seconds: 0 },
      { key: 'seax', seconds: 0 },
    ]);
    const { state } = readSave(
      writeSave(world, { build: 't', kind: 'manual', slot: 'manual-1', sequence: 1, savedAt: 'n' }),
    );
    expect(state.telemetry).toEqual(world.telemetry);
    expect(playedSeconds(state.telemetry, 600, 1000)).toBe(11);
  });

  it('names every milestone in words for the timings', () => {
    for (const m of MILESTONES)
      expect(content.strings.has(`ui.timings.mark.${m.key}`), m.key).toBe(true);
  });
});

describe('the launch music (Book 11 section 04, the Ship theme, as note data)', () => {
  const piece = JSON.parse(
    readFileSync(join(REPO_ROOT, 'content/music/ship.json'), 'utf8'),
  ) as Piece;

  it('writes every bar to its metre, in D Dorian, with its stroke on the beat of the oars', () => {
    expect(piece.mode).toBe('D dorian');
    const classes = modeClasses(piece.mode);
    for (const l of piece.layers) {
      const parsed = parseLayer(piece, l);
      expect(parsed.problems, l.id).toEqual([]);
      if (l.instrument === 'drum' || l.instrument === 'knock') continue;
      expect(
        parsed.notes.filter((n) => !classes.has(n.midi % 12)).map((n) => n.midi),
        l.id,
      ).toEqual([]);
    }
    // A stroke a second (content/launch.json strokeSeconds): two beats at its tempo.
    expect((60 / piece.tempo) * 2).toBeCloseTo(launch.def.scene.strokeSeconds, 5);
  });

  it(`never needs more than ${MUSIC_VOICES} voices at once (one line a layer)`, () => {
    expect(piece.layers.length).toBeLessThanOrEqual(MUSIC_VOICES);
  });
});
