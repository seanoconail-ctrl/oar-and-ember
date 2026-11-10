/**
 * Art lint (npm run art:lint, also part of npm run lint): Book 7's QA rules for every sheet, and
 * a check that generated sheets and compiled atlases match their sources.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPalette, loadSheets } from './artFiles.ts';
import { lintSheet, placeholders } from './artLint.ts';
import { compiledAtlases } from './compile.ts';
import { generatedSheets } from './generate-sheets.ts';
import { REPO_ROOT } from './loadTitleArt.ts';

/** Files whose committed content differs from what their sources generate. */
export function staleArtFiles(): string[] {
  const stale: string[] = [];
  const expect = new Map<string, Buffer | string>([...generatedSheets(), ...compiledAtlases()]);
  for (const [path, data] of expect) {
    const file = join(REPO_ROOT, path);
    if (!existsSync(file)) {
      stale.push(`${path} (missing)`);
      continue;
    }
    const actual = readFileSync(file);
    const wanted = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    if (!actual.equals(wanted)) stale.push(path);
  }
  return stale;
}

if (import.meta.filename === process.argv[1]) {
  const palette = loadPalette();
  const sheets = loadSheets(palette);
  const issues = sheets.flatMap((s) => lintSheet(s, palette));
  for (const issue of issues)
    console.error(
      `${issue.sheet}${issue.frame === undefined ? '' : ` ${issue.frame}`}: ${issue.reason}`,
    );
  const stale = staleArtFiles();
  for (const path of stale)
    console.error(`${path}: out of date; run npm run art:sheets and npm run art:compile`);
  const held = placeholders(sheets);
  if (held.length > 0) console.log(`placeholders: ${held.join(', ')}`);
  if (issues.length > 0 || stale.length > 0) {
    console.error(`art lint: ${issues.length + stale.length} problem(s)`);
    process.exit(1);
  }
  console.log(
    `art lint: clean (${sheets.length} sheets, ${sheets.reduce((n, s) => n + s.frames.size, 0)} frames, ${held.length} placeholders)`,
  );
}
