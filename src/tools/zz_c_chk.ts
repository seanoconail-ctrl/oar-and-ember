import { loadContentFromDisk } from './content/loadContentFiles.ts';
import { distanceTo, LOW, obviousPaths, reachable, standable } from '../../tests/reachability/islandReach.ts';
const { content } = loadContentFromDisk();
const [zone, xs, ys] = process.argv.slice(2);
const map = content.zoneMaps.get(zone!)!; const x = Number(xs), y = Number(ys);
console.log('path', distanceTo(obviousPaths(map), x, y).toFixed(2), 'stand', standable(map, { tx: Math.floor(x), ty: Math.floor(y - 0.01) }, LOW), 'reach', reachable(map, x, y, 1.2, LOW, false));
