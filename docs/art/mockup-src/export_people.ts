/**
 * Exports the people sprites with one code per (material, tone), so the mockups can recolour them
 * with the proposed ramps: the generator is run on each material map with its ramps replaced.
 *   node docs/art/mockup-src/export_people.ts > out.json
 */
import { readFileSync } from 'node:fs';
import { generateSheet } from '../../../src/tools/art/materials.ts';

const SHEETS = ['actor_p_steerer_a', 'actor_p_steerer_b', 'actor_c_hild'];
const out: Record<string, { legend: Record<string, string>; frames: Record<string, string[]> }> = {};
for (const name of SHEETS) {
  const file = `assets/art/maps/${name}.map.txt`;
  let text = readFileSync(file, 'utf8');
  const legend: Record<string, string> = {};
  let next = 0x100;
  const code = (label: string): string => {
    const ch = String.fromCodePoint(next++);
    legend[ch] = label;
    return ch;
  };
  text = text.replace(/^material\.(\S+): \S+ \S+ \S+$/gm, (_m, letter: string) => {
    return `material.${letter}: ${code(`${letter}:hi`)} ${code(`${letter}:base`)} ${code(`${letter}:sh`)}`;
  });
  text = text.replace(/^mark\.(\S+): \S+$/gm, (_m, letter: string) => `mark.${letter}: ${code(`mark:${letter}`)}`);
  text = text.replace(/^outline: \S+/m, `outline: ${code('ink')}`);
  const sheet = generateSheet(text, file);
  const frames: Record<string, string[]> = {};
  for (const m of sheet.matchAll(/^frame (\S+ \S+ \d+)\n([\s\S]*?)\nend$/gm)) {
    frames[m[1] ?? ''] = (m[2] ?? '').split('\n');
  }
  out[name] = { legend, frames };
}
process.stdout.write(JSON.stringify(out));
