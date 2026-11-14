/** Writes assets/art/sheets/<sheet>.txt from every material map.   npm run art:sheets */
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listFiles, loadPalette, MAPS_DIR, readRepo, SHEETS_DIR } from './artFiles.ts';
import { REPO_ROOT } from './loadTitleArt.ts';
import { generateSheet } from './materials.ts';
import { GROUND_SETS, ZONE_GROUND } from './grounds.ts';
import { groundTiles, moorPlants, strandDecals, strandFx, strandPlants } from './strandArt.ts';

export function generatedSheets(): Map<string, string> {
  const out = new Map<string, string>();
  const palette = loadPalette();
  for (const file of listFiles(MAPS_DIR, '.map.txt')) {
    const name = /^sheet: (\S+)$/m.exec(readRepo(file))?.[1];
    if (name === undefined) throw new Error(`${file}: no "sheet:" header`);
    out.set(`${SHEETS_DIR}/${name}.txt`, generateSheet(readRepo(file), file, palette));
  }
  // Skarvholm's ground follows its zone maps (generate the zones first: npm run zones): each
  // ground sheet holds every visual tile its zones use (Stage 14, decision S14-32).
  for (const [sheet, set] of Object.entries(GROUND_SETS)) {
    const zones = Object.entries(ZONE_GROUND)
      .filter(([, g]) => g === sheet)
      .map(([zone]) => `content/zones/${zone.toLowerCase()}.json`)
      .filter((file) => existsSync(join(REPO_ROOT, file)))
      .map((file) => (JSON.parse(readRepo(file)) as { rows: string[] }).rows);
    if (zones.length > 0)
      out.set(`${SHEETS_DIR}/${sheet}.txt`, groundTiles(palette, zones, sheet, set));
  }
  out.set(`${SHEETS_DIR}/plant_moor.txt`, moorPlants(palette));
  out.set(`${SHEETS_DIR}/decal_strand.txt`, strandDecals(palette));
  out.set(`${SHEETS_DIR}/plant_strand.txt`, strandPlants(palette));
  out.set(`${SHEETS_DIR}/fx_strand.txt`, strandFx(palette));
  return out;
}

if (import.meta.filename === process.argv[1]) {
  for (const [path, text] of generatedSheets()) {
    writeFileSync(join(REPO_ROOT, path), text);
    console.log(`wrote ${path}`);
  }
}
