/**
 * Every content file, bundled into the browser build and validated by the same loader the content
 * lint uses (src/content/registry.ts), so the game never runs on content the lint would refuse.
 */
import ids from '../../content/ids.json';
import strings from '../../content/strings/en.json';
import balance from '../../content/balance.json';
import places from '../../content/places.json';
import hazards from '../../content/hazards.json';
import regions from '../../content/regions.json';
import people from '../../content/people.json';
import factions from '../../content/factions.json';
import hulls from '../../content/hulls.json';
import fittings from '../../content/fittings.json';
import audio from '../../content/audio.json';
import onFoot from '../../content/onfoot.json';
import opening from '../../content/opening.json';
import camp from '../../content/camp.json';
import household from '../../content/household.json';
import talk from '../../content/talk.json';
import scenes from '../../content/scenes.json';
import combat from '../../content/combat.json';
import searches from '../../content/searches.json';
import repairs from '../../content/repairs.json';
import zoneStrand from '../../content/zones/zone_sk_strand.json';
import zoneMachair from '../../content/zones/zone_sk_machair.json';
import zoneHagseat from '../../content/zones/zone_sk_hagseat.json';
import zoneCairn from '../../content/zones/zone_sk_cairn.json';
import zoneSealcave from '../../content/zones/zone_sk_sealcave.json';
import { formatIssue, loadContent } from '../content/registry.ts';
import type { Content, ContentFiles } from '../content/registry.ts';

export const BUNDLED_FILES: ContentFiles = {
  ids,
  strings,
  balance,
  places,
  hazards,
  regions,
  people,
  factions,
  hulls,
  fittings,
  audio,
  onFoot,
  opening,
  camp,
  household,
  talk,
  scenes,
  combat,
  searches,
  repairs,
  zoneStrand,
  zoneMachair,
  zoneHagseat,
  zoneCairn,
  zoneSealcave,
};

export function bundledContent(): Content {
  const { content, issues } = loadContent(BUNDLED_FILES);
  if (issues.length > 0) {
    throw new Error(
      `Content has ${issues.length} problem(s): ${issues.slice(0, 3).map(formatIssue).join('; ')}`,
    );
  }
  return content;
}
