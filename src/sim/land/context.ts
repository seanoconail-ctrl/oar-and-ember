/** Builds what the on-foot systems need from loaded content and balance.json. */
import {
  parseArrowBalance,
  parseControlsBalance,
  parseMissileBalance,
  parseMovementBalance,
  parseWaterBalance,
} from '../../content/balance.ts';
import { parseStaminaBalance } from '../../content/homeBalance.ts';
import type { Content } from '../../content/registry.ts';
import { campContext } from '../home/camp.ts';
import { bakeElevation } from '../../content/terrain/elevation.ts';
import type { Elevation } from '../../content/terrain/elevation.ts';
import type { Id } from '../../core/ids.ts';
import type { SimWorldContext } from '../simulation.ts';

export function landContext(
  content: Pick<Content, 'onFoot' | 'opening' | 'zoneMaps'> &
    Partial<Pick<Content, 'camp' | 'balance'>>,
  balance: unknown,
): SimWorldContext {
  if (content.onFoot === null) throw new Error('content/onfoot.json did not load');
  const elevations = new Map<Id, Elevation>();
  for (const [zone, map] of content.zoneMaps) elevations.set(zone, bakeElevation(map.rows));
  return {
    maps: content.zoneMaps,
    movement: parseMovementBalance(balance),
    water: parseWaterBalance(balance),
    controls: parseControlsBalance(balance),
    missiles: parseMissileBalance(balance),
    arrows: parseArrowBalance(balance),
    elevations,
    rules: content.onFoot,
    opening: content.opening,
    stamina: parseStaminaBalance(balance),
    camp: content.camp === undefined ? null : campContext({ camp: content.camp, balance }),
  };
}
