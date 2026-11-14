import { loadContentFromDisk } from './content/loadContentFiles.ts';
import { entries, has, LOW, reach } from '../../tests/reachability/islandReach.ts';
const { content } = loadContentFromDisk();
const map = content.zoneMaps.get('ZONE_SK_SEALCAVE')!;
const seen = reach(map, entries(map, LOW), LOW, false);
for (let y = 14; y < 26; y++) { let row = ''; for (let x = 48; x < 66; x++) row += has(seen, { tx: x, ty: y }) ? 'o' : (map.solid?.some(([a, b]) => a === x && b === y) ? 'S' : map.rows[y]![x]); console.log(y, row); }
