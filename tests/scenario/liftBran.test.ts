/**
 * The user's fourth playtest, request 21 (decision DH-70): "A freeze while lifting the downed Bran
 * ... very close to his initial position with all wreckers dead." Root cause: Bran's heavy-build
 * sheets had no `carried` pose (Oddi's had one; Bran's generator entry left it out), so the first
 * frame drawn with him across the steerer's shoulders asked the renderer for `carried/<facing>/0`,
 * which threw ("Atlas actor_c_bran_heavy has no frame carried/w/0") and stopped the frame loop: the
 * game froze. The simulation itself never hung.
 *
 * The regression plays the fold's fight to its end on several seeds (the careful scripted player,
 * src/tools/play/searchBot.ts), downs Bran where the fight left him or at several spots near where
 * he started, lifts him, carries him a few seconds each way, and builds every frame's scene through
 * the game's own zone scene, checking that every sprite's frame exists in its sheet (what the
 * renderer would otherwise throw on) and that no step of the simulation stalls.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { zoneScene } from '../../src/scenes/zoneScene.ts';
import { sceneSprites } from '../../src/render/scene.ts';
import type { SheetAnims } from '../../src/scenes/zoneScene.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { tileBlocks, tileOf } from '../../src/sim/land/zoneMap.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadPeopleLook, loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { SearchBot } from '../../src/tools/play/searchBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const camp = land.camp;
const search = land.searches;
if (camp == null || search == null) throw new Error('no camp or searches content');
const sheetList = loadSheets();
const sheets = new Map(sheetList.map((s) => [s.name, s]));
const anims: SheetAnims = new Map(sheetList.map((s) => [s.name, s.anims]));
const shadows = new Map(sheetList.map((s) => [s.name, s.shadow]));
const look = loadPeopleLook('A');
const TILE = 24;
const BRAN = 'C_BRAN';

function start(seed: string) {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams('camp=broch&time=10:00'));
  world.player.hotbar.slots[0] = 'ITEM_SEAX';
  const sim = createSimulation(b, world, land);
  if (camp == null || search == null) throw new Error('no content');
  const bot = new SearchBot(sim, b, land, camp, search);
  sim.step();
  return { world: sim.state, sim, bot };
}

/** Every sprite the zone scene draws now names a frame its sheet has (the renderer's own check). */
function drawable(world: ReturnType<typeof start>['world']): string[] {
  const onFoot = world.onFoot;
  const map = onFoot === null ? undefined : land.maps.get(onFoot.zone);
  if (onFoot === null || map === undefined) return ['not on foot'];
  const scene = zoneScene({
    map,
    onFoot,
    tick: world.tick,
    tideOpen: false,
    phase: 'day',
    look,
    anims,
    shadows,
    highlight: null,
  });
  const missing: string[] = [];
  // Every sprite drawn, the plants' batch among them (decision DH-161).
  for (const s of sceneSprites(scene)) {
    const sheet = sheets.get(s.sheet);
    if (sheet === undefined) missing.push(`${s.sheet} (no sheet)`);
    else if (sheet.frames.get(s.frame) === undefined) missing.push(`${s.sheet} ${s.frame}`);
  }
  return missing;
}

describe('lifting the downed Bran at the fold never freezes (request 21, DH-70)', () => {
  // Where he is downed: where the fight left him, or at spots by his start in the fold.
  const spots: (readonly [number, number] | null)[] = [null, [0, 0], [0.6, -0.4], [-0.5, 0.7]];
  for (const seed of ['bran-lift-1', 'bran-lift-2', 'bran-lift-3']) {
    for (const [k, spot] of spots.entries()) {
      it(`seed ${seed}, downed ${spot === null ? 'where the fight left him' : `at his start +${spot.join(',')} tiles`}`, () => {
        const { world, sim, bot } = start(`${seed}-${k}`);
        bot.goToZone('ZONE_SK_CAIRN');
        const onFoot = world.onFoot;
        const bran = onFoot?.actors[BRAN];
        if (onFoot == null || bran === undefined) throw new Error('no Bran at the fold');
        const home = { x: bran.x, y: bran.y };
        sim.submit({ type: 'SELECT_SLOT', slot: world.player.hotbar.slots.indexOf('ITEM_SEAX') });
        // A minute of the careful player's fight; then whoever still stands is struck down (the
        // developer's kill, no deed), so all three wreckers are dead as in the report.
        bot.fightAll(60 * 60);
        if (world.gameOver !== null) world.gameOver = null;
        world.player.vitality = Math.max(world.player.vitality, 50);
        for (const id of ['E_WRECKER_KETILL', 'E_WRECKER_SVART', 'E_WRECKER_CONN'])
          if (onFoot.actors[id]?.fight?.dead === null) sim.submit({ type: 'DEV_KILL', target: id });
        bot.step();
        bot.waitFor(() => world.facts['search.bran'] !== undefined, 60 * 30);
        for (const id of ['E_WRECKER_KETILL', 'E_WRECKER_SVART', 'E_WRECKER_CONN']) {
          const a = onFoot.actors[id];
          expect(a === undefined || a.fight?.dead != null).toBe(true);
        }
        if (spot !== null || bran.pose !== 'down') {
          // Downed where a blow would down him (Book 2 section 12: no timer).
          if (spot !== null) {
            bran.x = home.x + spot[0] * TILE;
            bran.y = home.y + spot[1] * TILE;
          }
          const fa = bran.fight;
          if (fa !== undefined) {
            fa.vitality = 0;
            fa.f.state = 'downed';
            fa.f.since = world.tick;
          }
          bran.pose = 'down';
          const person = world.people[BRAN];
          if (person !== undefined) person.status = 'downed';
        }
        expect(drawable(world)).toEqual([]);
        const map = land.maps.get(onFoot.zone);
        if (map === undefined) throw new Error('no map');
        // Beside him: walked by the scripted player, or (where its straight-line walk stops at the
        // fold's gateway, DE-25's clean edge stop) set on the nearest open tile beside him.
        try {
          bot.goBeside(BRAN);
        } catch {
          const at = tileOf(map, bran.x, bran.y);
          const open = [
            [-1, 0],
            [0, -1],
            [0, 1],
            [-1, -1],
            [-1, 1],
          ].find(([dx = 0, dy = 0]) => !tileBlocks(map, at.tx + dx, at.ty + dy, false));
          if (open === undefined) throw new Error('nowhere beside Bran');
          onFoot.player.x = (at.tx + (open[0] ?? 0) + 0.5) * TILE;
          onFoot.player.y = (at.ty + (open[1] ?? 0) + 0.7) * TILE;
          bot.step();
        }
        sim.submit({ type: 'INTERACT_AT', tile: tileOf(map, bran.x, bran.y) });
        bot.step();
        expect(onFoot.carrying).toBe(BRAN);
        // Carry him each way for a moment; every frame drawable, no step stalling.
        let slowest = 0;
        for (const [x, y] of [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ] as const) {
          for (let i = 0; i < 45; i++) {
            sim.submit({ type: 'MOVE', x, y, run: false, sneak: false });
            const t0 = performance.now();
            bot.step();
            slowest = Math.max(slowest, performance.now() - t0);
            if (i % 9 === 0) expect(drawable(world)).toEqual([]);
          }
        }
        expect(slowest).toBeLessThan(250);
        // Still across the shoulders, or set down by a bar run empty (Book 10 heavyCarryEmpty).
        expect([BRAN, null]).toContain(onFoot.carrying);
      });
    }
  }
});
