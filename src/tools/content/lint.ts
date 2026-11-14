/**
 * Content lint (Book 2 section 04, Book 3 Stage 3): validates every content file, resolves every
 * reference and checks every ID against the registry.   npm run content:lint
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_FILES, formatIssue } from '../../content/registry.ts';
import { REPO_ROOT } from '../art/loadTitleArt.ts';
import { nameIssues, stringIdIssues } from './idLint.ts';
import { loadContentFromDisk } from './loadContentFiles.ts';
import { staleZoneFiles } from '../levels/generate-zones.ts';

const { content, issues } = loadContentFromDisk();
for (const path of staleZoneFiles())
  issues.push({
    file: path,
    path: '(file)',
    reason: 'out of step with its plan: run npm run zones',
  });
// The user's fourth playtest (request 25; DH-112): no ID on the screen. Player-facing strings
// must not look like IDs, and everything shown by name must have a name string.
const files = new Map(
  Object.values(CONTENT_FILES).map((path) => [path, readFileSync(join(REPO_ROOT, path), 'utf8')]),
);
for (const i of [...stringIdIssues(content.strings), ...nameIssues(content, files)])
  issues.push({ file: 'content', path: i.where, reason: `ID lint: ${i.reason}` });
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
