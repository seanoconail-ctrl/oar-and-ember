/**
 * Render-to-image check (Book 2 section 19): every sheet's preview and the Stage 4 test scenes,
 * drawn by the CPU reference renderer at 1x and 4x into artifacts/ for inspection.
 *
 *   npm run art:check     (also renders the title screen and fonts)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packSheet } from '../../render/atlas.ts';
import { renderSceneCpu } from '../../render/cpuRenderer.ts';
import { parseRenderStyle } from '../../render/scene.ts';
import type { RenderStyle } from '../../render/scene.ts';
import type { Sheet } from '../../render/sheet.ts';
import { ART_TEST_CASES, artTestScene, sheetPreviewScene } from '../../scenes/artTest.ts';
import { loadPalette, loadPeopleLook, loadSheets, readRepo } from './artFiles.ts';
import { steererOwns, withOwned } from '../../scenes/people.ts';
import { REPO_ROOT } from './loadTitleArt.ts';
import { encodePng, scaleNearest } from './png.ts';
import { parsePeopleBasics, parseTimeBalance } from '../../content/balance.ts';
import type { Scene } from '../../render/scene.ts';
import { zoneScene } from '../../scenes/zoneScene.ts';
import { landContext } from '../../sim/land/context.ts';
import { interactionNow } from '../../sim/land/onFoot.ts';
import { createSimulation } from '../../sim/simulation.ts';
import { newCampaign } from '../../sim/world.ts';
import type { BodyModel } from '../../sim/world.ts';
import { loadBalanceJson } from '../content/loadBalance.ts';
import { loadContentFromDisk } from '../content/loadContentFiles.ts';

/**
 * The Stage 6 opening at four moments, for both body models: waking, beside Hild, carrying her
 * up the beach, and Hild safe above the tide line. Dawn light, as the game opens.
 */
export function openingScenes(
  sheetAnims: ReadonlyMap<string, Sheet['anims']>,
): { name: string; scene: Scene }[] {
  const balance = loadBalanceJson();
  const b = parseTimeBalance(balance);
  const { content } = loadContentFromDisk();
  const land = landContext(content, balance);
  const out: { name: string; scene: Scene }[] = [];
  for (const body of ['A', 'B'] as BodyModel[]) {
    const world = newCampaign('render-check', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: body,
    });
    const sim = createSimulation(b, world, land);
    const map = land.maps.get('ZONE_SK_STRAND');
    const onFoot = world.onFoot;
    const hild = onFoot?.actors['C_HILD'];
    if (map === undefined || onFoot === null || hild === undefined) throw new Error('no opening');
    const shot = (name: string): void => {
      const i = interactionNow(onFoot, map, land.rules, false);
      out.push({
        name: `opening-${body.toLowerCase()}-${name}`,
        scene: zoneScene({
          map,
          onFoot,
          tick: world.tick,
          tideOpen: false,
          phase: 'dusk',
          look: ((l) => ({
            ...l,
            steerer: withOwned(l.steerer, (item) => steererOwns(world.player, item)),
          }))(loadPeopleLook(body)),
          facts: world.facts,
          anims: sheetAnims,
          highlight: i?.kind === 'LIFT' ? i.target : null,
        }),
      });
    };
    shot('wake');
    onFoot.player.x = hild.x + 26;
    onFoot.player.y = hild.y;
    onFoot.player.facing = 'w';
    shot('beside-hild');
    sim.submit({ type: 'INTERACT' });
    sim.submit({ type: 'MOVE', x: 0, y: -1, run: false, sneak: false });
    for (let t = 0; t < 40; t++) sim.step();
    shot('carrying');
    for (let t = 0; t < 60; t++) sim.step();
    sim.submit({ type: 'INTERACT' });
    sim.submit({ type: 'MOVE', x: 1, y: 0, run: false, sneak: false });
    for (let t = 0; t < 30; t++) sim.step();
    shot('safe');
  }
  return out;
}

export function loadRenderStyle(): RenderStyle {
  return parseRenderStyle(JSON.parse(readRepo('assets/art/render.json')) as unknown);
}

/** The width and height of a sheet's preview: its atlas plus an 8-pixel margin. */
export function previewSize(sheet: Sheet): { width: number; height: number } {
  const { image } = packSheet(sheet);
  return { width: image.width + 16, height: image.height + 16 };
}

if (import.meta.filename === process.argv[1]) {
  const palette = loadPalette();
  const style = loadRenderStyle();
  const sheets = new Map(loadSheets(palette).map((s) => [s.name, s]));
  const out = join(REPO_ROOT, 'artifacts');
  mkdirSync(out, { recursive: true });
  const write = (name: string, width: number, height: number, data: Uint8Array): void => {
    for (const factor of [1, 4]) {
      const file = join(out, `${name}-${factor}x.png`);
      writeFileSync(file, encodePng(scaleNearest({ width, height, data }, factor)));
      console.log(`wrote ${file}`);
    }
  };
  for (const sheet of sheets.values()) {
    const { manifest } = packSheet(sheet);
    const { width, height } = previewSize(sheet);
    write(
      `sheet-${sheet.name}`,
      width,
      height,
      renderSceneCpu(
        sheetPreviewScene(sheet.name, sheet, manifest.frames),
        sheets,
        palette,
        style,
        width,
        height,
      ),
    );
  }
  for (const which of ART_TEST_CASES) {
    write(`scene-${which}`, 640, 360, renderSceneCpu(artTestScene(which), sheets, palette, style));
  }
  const anims = new Map([...sheets.values()].map((s) => [s.name, s.anims]));
  for (const { name, scene } of openingScenes(anims)) {
    write(name, 640, 360, renderSceneCpu(scene, sheets, palette, style));
  }
}
