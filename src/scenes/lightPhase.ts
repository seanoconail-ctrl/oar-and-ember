/**
 * Which light a scene is drawn under (Book 7 section 08): day while Book 10 says it is light, dusk
 * for the hour either side of first light and dark, night otherwise. The art direction of each
 * phase is in assets/art/render.json.
 */
import type { TimeBalance } from '../content/balance.ts';
import { seasonOf } from '../sim/calendar/calendar.ts';
import type { CalendarState } from '../sim/calendar/calendar.ts';
import type { Phase } from '../render/scene.ts';

/** Minutes either side of first light and of dark drawn as dusk. */
export const TWILIGHT_MINUTES = 60;

export function lightPhase(cal: CalendarState, b: TimeBalance): Phase {
  const { lightFrom, darkFrom } = b.daylight[seasonOf(cal.day)];
  const m = cal.minuteOfDay;
  if (m >= lightFrom && m < darkFrom) return 'day';
  const near = (edge: number): boolean =>
    Math.min(Math.abs(m - edge), 1440 - Math.abs(m - edge)) <= TWILIGHT_MINUTES;
  return near(lightFrom) || near(darkFrom) ? 'dusk' : 'night';
}
