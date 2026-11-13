/** Builds what the on-foot systems need from loaded content and balance.json. */
import { parseOpeningBalance } from '../../content/openingBalance.ts';
import { aimsContext } from '../narrative/aims.ts';
import { wreckContext } from '../narrative/wreck.ts';
import { story4Context } from '../narrative/story4.ts';
import { parsePeopleBalance } from '../../content/peopleBalance.ts';
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
import { hasRaidBalance, raidContext, raidWhen, withNeedTopics } from '../narrative/raid.ts';
import { repairsContext } from '../narrative/repairs.ts';
import { findsContext } from '../narrative/finds.ts';
import { parseSeaBurialBalance } from '../narrative/seaBurial.ts';
import { launchContext } from '../narrative/launch.ts';
import { parseLaunchBalance } from '../../content/launchBalance.ts';
import { shipDefsOf } from '../ship/ship.ts';
import { parseWorkBalance } from '../../content/homeBalance.ts';
import { bakeElevation } from '../../content/terrain/elevation.ts';
import type { Elevation } from '../../content/terrain/elevation.ts';
import type { Id } from '../../core/ids.ts';
import type { SimWorldContext } from '../simulation.ts';

/** Whether balance.json has a section (tests may give a trimmed balance). */
function hasTable(balance: unknown, section: string): boolean {
  const t = (balance as { tables?: Record<string, unknown> } | null)?.tables;
  return t?.[section] !== undefined;
}

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
        | 'company'
        | 'guidance'
        | 'finds'
        | 'raid'
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
  // A reason for the first raid (DH-130 to DH-159): needs, the skin boat, asking, the council.
  const raid =
    content.raid == null || !hasRaidBalance(balance)
      ? null
      : raidContext({ raid: content.raid, balance });
  // Stage 11: the boat's repairs, its fitting and Thorkel's rites.
  const repairs =
    content.repairs == null || content.hulls === undefined || content.fittings === undefined
      ? null
      : repairsContext(
          content.repairs,
          shipDefsOf({ hulls: content.hulls, fittings: content.fittings, balance }),
          parseWorkBalance(balance).workerDayMinutes,
          parseSeaBurialBalance(balance),
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
            dodgeTiles: cb.dodge.tiles,
            dodgeStart: cb.dodge.start,
            dodgeDash: cb.dodge.dash,
            accel: cb.accel,
          },
        }),
    stamina: parseStaminaBalance(balance),
    camp: content.camp === undefined ? null : campContext({ camp: content.camp, balance }),
    searches:
      content.searches == null
        ? null
        : searchContext(
            { searches: content.searches, balance },
            repairs,
            // The user's fourth playtest (DH-12): the strongbox is taken only in sight.
            content.opening?.rework.story4 !== undefined,
            raid === null
              ? null
              : { talks: raid.talks, extraChoices: raid.extraChoices, when: raidWhen },
          ),
    raid,
    repairs,
    launch,
    // The user's fourth playtest: the small finds off the paths (DH-115).
    finds:
      content.finds == null || !hasTable(balance, 'explorationDensity')
        ? null
        : findsContext(content.finds, balance),
    // Design addendum 2.4: the opening, the aims, the doors and the edges (Book 10 section 25).
    ...((): Partial<SimWorldContext> => {
      const ok = content.opening !== null && hasTable(balance, 'theOpeningGuidanceAndFeel');
      if (!ok) return {};
      const ob = parseOpeningBalance(balance);
      const full = {
        opening: content.opening,
        balance,
        camp: content.camp ?? null,
        searches: content.searches ?? null,
        repairs: content.repairs ?? null,
        zoneMaps: content.zoneMaps,
      };
      return {
        wreck: wreckContext(full),
        aims: aimsContext(full),
        // The user's fourth playtest's story and scenes (decisions DH-10 to DH-39).
        story4: story4Context(full, parsePeopleBalance(balance).talk.earshotTiles),
        doors: ob.doors,
        edgeCaption: {
          afterSeconds: ob.feedback.edgeCaptionAfterSeconds,
          cooldownSeconds: ob.feedback.edgeCaptionCooldownSeconds,
        },
        edgeStopDegrees: ob.feedback.edgeStopDegrees,
      };
    })(),
    people:
      content.household == null || content.people === undefined
        ? null
        : peopleContext({
            household: content.household,
            // The first raid's need topics join the household's talk (DH-134).
            talk: withNeedTopics(content.talk ?? null, raid?.def ?? null),
            scenes: content.scenes ?? [],
            people: content.people,
            balance,
            company: content.company ?? null,
            guidance: content.guidance ?? null,
            opening: content.opening ?? null,
          }),
  };
}
