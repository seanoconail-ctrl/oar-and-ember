/** Writes assets/art/sheets/<sheet>.txt from every material map.   npm run art:sheets */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listFiles, MAPS_DIR, readRepo, SHEETS_DIR } from './artFiles.ts';
import { REPO_ROOT } from './loadTitleArt.ts';
import { generateSheet } from './materials.ts';

export function generatedSheets(): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of listFiles(MAPS_DIR, '.map.txt')) {
    const name = /^sheet: (\S+)$/m.exec(readRepo(file))?.[1];
    if (name === undefined) throw new Error(`${file}: no "sheet:" header`);
    out.set(`${SHEETS_DIR}/${name}.txt`, generateSheet(readRepo(file), file));
  }
  return out;
}

if (import.meta.filename === process.argv[1]) {
  for (const [path, text] of generatedSheets()) {
    writeFileSync(join(REPO_ROOT, path), text);
    console.log(`wrote ${path}`);
  }
}
