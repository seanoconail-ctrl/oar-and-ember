/** Builds what the on-foot systems need from loaded content and balance.json. */
import {
  parseTimeBalance,
  parseArrowBalance,
  parseControlsBalance,
  parseMissileBalance,
  parseMovementBalance,
  parseWaterBalance,
} from '../../content/balance.ts';
import { parseStaminaBalance } from '../../content/homeBalance.ts';
import type { Content } from '../../content/registry.ts';
import { campContext } from '../home/camp.ts';
import { parseCombatBalance } from '../../content/combatBalance.ts';
import { fightContext } from './fight.ts';
import { peopleContext } from '../people/context.ts';
import { bakeElevation } from '../../content/terrain/elevation.ts';
import type { Elevation } from '../../content/terrain/elevation.ts';
import type { Id } from '../../core/ids.ts';
import type { SimWorldContext } from '../simulation.ts';

export function landContext(
  content: Pick<Content, 'onFoot' | 'opening' | 'zoneMaps'> &
    Partial<
      Pick<Content, 'camp' | 'balance' | 'household' | 'talk' | 'scenes' | 'people' | 'combat'>
    >,
  balance: unknown,
): SimWorldContext {
  if (content.onFoot === null) throw new Error('content/onfoot.json did not load');
  const elevations = new Map<Id, Elevation>();
  const fight =
    content.combat == null
      ? null
      : fightContext({ combat: content.combat }, balance, parseTimeBalance(balance).daylight);
  const cb = fight === null ? null : parseCombatBalance(balance);
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
    fight,
    ...(cb === null
      ? {}
      : {
          combatMove: {
            chargeSpeed: cb.chargeSpeed,
            dodgeTiles: cb.dodge.tiles,
            dodgeTicks: cb.dodge.ticks,
          },
        }),
    stamina: parseStaminaBalance(balance),
    camp: content.camp === undefined ? null : campContext({ camp: content.camp, balance }),
    people:
      content.household == null || content.people === undefined
        ? null
        : peopleContext({
            household: content.household,
            talk: content.talk ?? null,
            scenes: content.scenes ?? [],
            people: content.people,
            balance,
          }),
  };
}
