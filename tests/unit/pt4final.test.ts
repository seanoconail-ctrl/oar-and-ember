/**
 * The final pass of the user's fourth playtest (decisions DH-160 onwards): the household nudges
 * towards carrying the ship's stores home once the lashing is cut (DH-164: the stores aim had no
 * word for it), and Chapter 1 ends inside Book 3's 45 to 60 minutes on the slowest seed now the
 * council is the aim once the boat is ready, before the rites (DH-163).
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parseCompanyBalance } from '../../src/content/companyBalance.ts';
import { buildDrawList } from '../../src/render/scene.ts';
import type { SheetGeometry } from '../../src/render/scene.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { zoneScene } from '../../src/scenes/zoneScene.ts';
import type { SheetAnims } from '../../src/scenes/zoneScene.ts';
import { campContext } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { aimLine, companyState, companyTick } from '../../src/sim/people/company.ts';
import type { CompanyView } from '../../src/sim/people/company.ts';
import { activityOf } from '../../src/sim/people/schedule.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { HUMAN_PACE, playChapter } from '../../src/tools/play/chapterRun.ts';
import { WreckBot } from '../../src/tools/play/wreckBot.ts';
import { loadPalette, loadPeopleLook, loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const cb = parseCompanyBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const T = 60;
const TILE = 24;

function need<X>(x: X | null | undefined, what: string): X {
  if (x === null || x === undefined) throw new Error(`no ${what}`);
  return x;
}
const camp = need(land.camp, 'camp');
const people = need(land.people, 'people');
const cc = need(people.company, 'company');
const RESIDENTS = ['C_HILD', 'C_ODDI', 'C_BRAN', 'C_RUNA'];

describe('the stores cut down: the household says to carry them home (DH-164)', () => {
  it('each resident’s line for the stores aim turns to carrying them home once the lashing is cut', () => {
    const world = newCampaign('stores-lines', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'A',
    });
    for (const who of RESIDENTS) {
      const before = aimLine(cc, 'stores', who, world);
      expect(before, who).toMatch(/\.nudge\.stores$/);
      world.facts['ch1.lashing_cut'] = true;
      expect(aimLine(cc, 'stores', who, world), who).toMatch(/\.nudge\.stores_home$/);
      delete world.facts['ch1.lashing_cut'];
    }
  });

  it('a nudge comes after the cut even when the aim’s own nudges were all given', () => {
    const world = newCampaign('stores-nudge', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'A',
    });
    campHooks(
      world,
      content,
      land,
      new URLSearchParams({ camp: 'broch', time: '14:00', fire: 'lit', day: '2', crew: '1' }),
    );
    const sim = createSimulation(b, world, land);
    sim.step();
    const w = sim.state;
    w.facts['ch1.chest_opened'] = true;
    w.aims = { current: 'stores', since: w.tick - 3600 * T, hintsGiven: 2, reached: [] };
    const cs = companyState(w, cb, T);
    cs.lastSpeech = -1e9;
    cs.nudge = { aim: 'stores', opened: w.tick - 3600 * T, given: cb.nudge.maxPerAim, last: -1e9 };
    const said: string[] = [];
    const view: CompanyView = {
      residents: [...w.household.residents].sort(),
      activity: (id) => activityOf(w, camp, people, id).kind,
      fromSteerer: () => 1,
      earshotTiles: people.b.talk.earshotTiles,
      sameSpeakerSeconds: people.b.talk.sameSpeakerSeconds,
      ticksPerSecond: T,
      // Nudges only (the household's own exchanges go on meanwhile).
      say: (_who, key) => {
        if (key.includes('.nudge.')) said.push(key);
      },
    };
    // The aim's own nudges spent: nothing more while the stores hang on the mast.
    for (let i = 0; i < T * 120; i++) {
      w.tick++;
      companyTick(w, cc, view, TILE);
    }
    expect(said).toEqual([]);
    // Cut down: a later stage of the aim, with nudges of its own, after nudgeFirst.
    w.facts['ch1.lashing_cut'] = true;
    for (let i = 0; i < T * (cb.nudge.firstSeconds + 30) && said.length === 0; i++) {
      w.tick++;
      companyTick(w, cc, view, TILE);
    }
    expect(said.length).toBe(1);
    expect(said[0]).toMatch(/\.nudge\.stores_home$/);
  });
});

describe('Chapter 1’s length after the council moved before the rites (DH-163)', () => {
  it('the slowest seed at a human pace launches on day 5 and ends inside 60 minutes', () => {
    const run = playChapter('chapter-2', HUMAN_PACE);
    const launch = run.world.telemetry.marks['launch'];
    expect(launch?.day).toBe(5);
    expect(run.report.now).toBeGreaterThanOrEqual(45 * 60);
    expect(run.report.now).toBeLessThanOrEqual(60 * 60);
    expect(run.world.facts['ch1.council']).toBe('QUIET');
  }, 300_000);
});

describe('a load carried by someone else is drawn over their shoulders in every facing (DH-165)', () => {
  it('the strongbox stays in front of Conn on every frame of his run, whatever his foot line', () => {
    const sheetList = loadSheets(loadPalette());
    const anims: SheetAnims = new Map(sheetList.map((s) => [s.name, s.anims]));
    const geometry = new Map<string, SheetGeometry>(
      sheetList.map((s) => [s.name, { width: s.width, height: s.height, pivot: s.pivot }]),
    );
    const look = loadPeopleLook('A');
    const world = newCampaign('pt4-snatch-draw', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'A',
    });
    campHooks(
      world,
      content,
      land,
      new URLSearchParams('camp=broch&day=2&time=08:00&zone=ZONE_SK_STRAND&at=27,34'),
    );
    const sim = createSimulation(b, world, land);
    const searches = need(land.searches, 'searches');
    const bot = new WreckBot(
      sim,
      b,
      land,
      need(campContext(content), 'camp'),
      searches,
      need(land.repairs, 'repairs'),
    );
    bot.step(2);
    const oddi = searches.def.oddi;
    const box = oddi.chest.id;
    bot.lift(oddi.person);
    bot.waitFor(() => sim.state.onFoot?.actors['E_WRECKER_CONN']?.carries === box, 60 * 10);
    const map = need(land.maps.get('ZONE_SK_STRAND'), 'strand');
    const facings = new Set<string>();
    let halves = 0;
    let frames = 0;
    for (let i = 0; i < 60 * 6; i++) {
      bot.step(1);
      const onFoot = need(sim.state.onFoot, 'on foot');
      const conn = onFoot.actors['E_WRECKER_CONN'];
      if (conn?.carries !== box || onFoot.actors[box] === undefined) break;
      const scene = zoneScene({
        map,
        onFoot,
        tick: sim.state.tick,
        tideOpen: false,
        phase: 'day',
        look,
        anims,
        highlight: null,
      });
      const list = buildDrawList(scene, geometry, 0.5);
      const boxAt = list.findIndex((d) => d.sheet === 'prop_strongbox');
      const connAt = list.findIndex((d) => d.sheet === 'actor_e_wrecker_conn');
      if (boxAt < 0 || connAt < 0) continue;
      expect(boxAt, `facing ${conn.facing}, y ${conn.y.toFixed(2)}`).toBeGreaterThan(connAt);
      facings.add(conn.facing);
      const cameraY = scene.effects?.camera.y ?? 0;
      if ((conn.y - cameraY) % 1 >= 0.5) halves++;
      frames++;
    }
    expect(frames).toBeGreaterThan(30);
    expect(facings.has('n')).toBe(true);
    // The case that tied before: the foot line past a half.
    expect(halves).toBeGreaterThan(0);
  }, 120_000);
});
