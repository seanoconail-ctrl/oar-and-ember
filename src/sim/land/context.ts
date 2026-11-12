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
import { searchContext } from '../narrative/searches.ts';
import { repairsContext } from '../narrative/repairs.ts';
import { launchContext } from '../narrative/launch.ts';
import { parseLaunchBalance } from '../../content/launchBalance.ts';
import { shipDefsOf } from '../ship/ship.ts';
import { parseWorkBalance } from '../../content/homeBalance.ts';
import { bakeElevation } from '../../content/terrain/elevation.ts';
import type { Elevation } from '../../content/terrain/elevation.ts';
import type { Id } from '../../core/ids.ts';
import type { SimWorldContext } from '../simulation.ts';

export function landContext(
  content: Pick<Content, 'onFoot' | 'opening' | 'zoneMaps'> &
    Partial<
      Pick<
        Content,
        | 'camp'
        | 'balance'
        | 'household'
        | 'talk'
        | 'scenes'
        | 'people'
        | 'combat'
        | 'searches'
        | 'repairs'
        | 'launch'
        | 'hulls'
        | 'fittings'
      >
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
  // Stage 11: the boat's repairs, its fitting and Thorkel's rites.
  const repairs =
    content.repairs == null || content.hulls === undefined || content.fittings === undefined
      ? null
      : repairsContext(
          content.repairs,
          shipDefsOf({ hulls: content.hulls, fittings: content.fittings, balance }),
          parseWorkBalance(balance).workerDayMinutes,
        );
  // Stage 12: the launch, Chapter 1's gate.
  const launch =
    content.launch == null || repairs === null
      ? null
      : launchContext(
          content.launch,
          parseLaunchBalance(balance),
          repairs.ship,
          parseWorkBalance(balance).foodPerPersonPerDay,
        );
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
    searches:
      content.searches == null
        ? null
        : searchContext({ searches: content.searches, balance }, repairs),
    repairs,
    launch,
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
