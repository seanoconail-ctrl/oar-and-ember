/** Writes assets/art/sheets/<sheet>.txt from every material map.   npm run art:sheets */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listFiles, loadPalette, MAPS_DIR, readRepo, SHEETS_DIR } from './artFiles.ts';
import { REPO_ROOT } from './loadTitleArt.ts';
import { generateSheet } from './materials.ts';
import { strandDecals, strandFx, strandPlants, strandTiles } from './strandArt.ts';

export function generatedSheets(): Map<string, string> {
  const out = new Map<string, string>();
  const palette = loadPalette();
  for (const file of listFiles(MAPS_DIR, '.map.txt')) {
    const name = /^sheet: (\S+)$/m.exec(readRepo(file))?.[1];
    if (name === undefined) throw new Error(`${file}: no "sheet:" header`);
    out.set(`${SHEETS_DIR}/${name}.txt`, generateSheet(readRepo(file), file, palette));
  }
  // Skarvholm's ground follows its zone maps (generate the zones first: npm run zones).
  const zones = [
    'zone_sk_strand',
    'zone_sk_machair',
    'zone_sk_hagseat',
    'zone_sk_cairn',
    'zone_sk_sealcave',
    'zone_sea_wreck',
  ].map((z) => (JSON.parse(readRepo(`content/zones/${z}.json`)) as { rows: string[] }).rows);
  out.set(`${SHEETS_DIR}/tile_strand.txt`, strandTiles(palette, zones));
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
