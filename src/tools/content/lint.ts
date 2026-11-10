/**
 * Content lint (Book 2 section 04, Book 3 Stage 3): validates every content file, resolves every
 * reference and checks every ID against the registry.   npm run content:lint
 */
import { formatIssue } from '../../content/registry.ts';
import { loadContentFromDisk } from './loadContentFiles.ts';
import { staleZoneFiles } from '../levels/generate-zones.ts';

const { content, issues } = loadContentFromDisk();
for (const path of staleZoneFiles())
  issues.push({
    file: path,
    path: '(file)',
    reason: 'out of step with its plan: run npm run zones',
  });
if (issues.length > 0) {
  for (const issue of issues) console.error(formatIssue(issue));
  console.error(`content lint: ${issues.length} problem(s)`);
  process.exit(1);
}
console.log(
  `content lint: clean (${content.places.size} places, ${content.hazards.size} hazards, ` +
    `${content.regions.size} regions, ${content.zones.size} zones, ${content.people.size} people, ` +
    `${content.factions.size} factions, ${content.hulls.size} hulls, ${content.fittings.size} fittings, ` +
    `${content.strings.size} strings, ${content.zoneMaps.size} zone map, ` +
    `${content.ids.entries.length} registered IDs)`,
);
