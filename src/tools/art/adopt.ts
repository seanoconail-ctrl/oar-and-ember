/**
 * Adopts the approved proposed art into the game's art pipeline (Book 3 Stage 6: a new or redrawn
 * character is wired in only after the user approves its sheets).   npm run art:adopt
 *
 * - assets/art/proposed/maps/*.map.txt  -> assets/art/maps/ (replacing the old 32 x 40 people)
 * - assets/art/proposed/sheets/*.txt that have no map (drawn directly: ui_*, fx_people)
 *                                         -> assets/art/sheets/ (prop_broch_door waits: NOT_YET)
 * - assets/art/proposed/*.layers.json     -> assets/art/layers/ (each person's layer sheets and
 *   draw order per facing, read by the game and by art lint)
 *
 * People maps, sheets and layer files that the proposal no longer has (a dropped layer) are
 * removed, with their atlases. Re-runnable: run it again after the proposed art changes, then
 * `npm run art:sheets && npm run art:compile`. assets/art/proposed is only read.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ATLAS_DIR, LAYERS_DIR, MAPS_DIR, SHEETS_DIR } from './artFiles.ts';
import { REPO_ROOT } from './loadTitleArt.ts';
import { PROPOSED } from './proposed.ts';

/**
 * Proposed sheets not adopted yet: the broch doorway is a scale study for the compare render. The
 * broch is Stage 7's place (it starts with a mockup), and its wall section runs off the canvas at
 * both sides, so it is not a free-standing prop with an ink outline all round.
 */
const NOT_YET = new Set(['prop_broch_door']);

/** Sheets the proposal owns: people bodies and their layers. */
const PEOPLE = /^(actor_(p|c|l|r|e|h)_|actor_heavy$|layer_)/;

function names(dir: string, suffix: string): string[] {
  const full = join(REPO_ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((f) => f.endsWith(suffix))
    .map((f) => f.slice(0, -suffix.length))
    .sort();
}

function read(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}

/** The proposal's staging note, rewritten for an adopted source. */
function adopted(text: string): string {
  return text.replace(
    /proposed, staged for the user's approval; nothing here is read by the game\./g,
    'approved by the user and adopted into the game (npm run art:adopt).',
  );
}

export interface AdoptPlan {
  /** Repository path to new content. */
  readonly write: ReadonlyMap<string, string>;
  /** Repository paths to delete. */
  readonly remove: readonly string[];
}

export function adoptPlan(): AdoptPlan {
  const write = new Map<string, string>();
  const remove: string[] = [];
  const maps = names(`${PROPOSED}/maps`, '.map.txt');
  const sheetNames = (file: string): string | undefined => /^sheet: (\S+)$/m.exec(read(file))?.[1];
  const mapSheets = new Set<string>();
  for (const name of maps) {
    const file = `${PROPOSED}/maps/${name}.map.txt`;
    mapSheets.add(sheetNames(file) ?? name);
    write.set(`${MAPS_DIR}/${name}.map.txt`, adopted(read(file)));
  }
  const drawn: string[] = [];
  for (const name of names(`${PROPOSED}/sheets`, '.txt')) {
    if (mapSheets.has(name) || NOT_YET.has(name)) continue;
    drawn.push(name);
    write.set(`${SHEETS_DIR}/${name}.txt`, adopted(read(`${PROPOSED}/sheets/${name}.txt`)));
  }
  const layerFiles = names(PROPOSED, '.layers.json');
  for (const name of layerFiles)
    write.set(`${LAYERS_DIR}/${name}.layers.json`, read(`${PROPOSED}/${name}.layers.json`));

  // People the proposal no longer has: their maps, generated sheets and atlases go.
  const keep = new Set([...mapSheets, ...drawn]);
  for (const name of NOT_YET) {
    remove.push(
      `${SHEETS_DIR}/${name}.txt`,
      `${ATLAS_DIR}/${name}.json`,
      `${ATLAS_DIR}/${name}.png`,
    );
  }
  for (const name of names(MAPS_DIR, '.map.txt'))
    if (PEOPLE.test(name) && !keep.has(name)) remove.push(`${MAPS_DIR}/${name}.map.txt`);
  for (const name of names(SHEETS_DIR, '.txt'))
    if (PEOPLE.test(name) && !keep.has(name)) remove.push(`${SHEETS_DIR}/${name}.txt`);
  for (const name of names(ATLAS_DIR, '.json'))
    if (PEOPLE.test(name) && !keep.has(name))
      remove.push(`${ATLAS_DIR}/${name}.json`, `${ATLAS_DIR}/${name}.png`);
  for (const name of names(LAYERS_DIR, '.layers.json'))
    if (!layerFiles.includes(name)) remove.push(`${LAYERS_DIR}/${name}.layers.json`);
  return { write, remove };
}

if (import.meta.filename === process.argv[1]) {
  const plan = adoptPlan();
  for (const [path, text] of plan.write) {
    const full = join(REPO_ROOT, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
    console.log(`wrote ${path}`);
  }
  for (const path of plan.remove) {
    rmSync(join(REPO_ROOT, path), { force: true });
    console.log(`removed ${path}`);
  }
  console.log('now run: npm run art:sheets && npm run art:compile');
}
