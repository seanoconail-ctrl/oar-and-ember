/**
 * The weather (Book 2 section 09; Book 4 section 04; Book 10 section 02, "Weather" to "Storms and
 * calm windows"; decision S13-2). Each day's wind (eight points, strength 0 to 4) and visibility
 * are drawn on the `weather` stream, in day order, with tomorrow drawn as today begins and the
 * household's forecast of it. A day always takes the same number of draws (and a year's named
 * storms the same number on its first day), so a day's weather never depends on when it was asked
 * for. Named storms (the first storm, the autumn storms, the Cailleach's washing) are strength 4
 * and always forecast; from the washing to the year's end, calm windows of one to three days open
 * the winter-closed crossings.
 */
import { nextFloat, nextInt } from '../../core/rng.ts';
import type { RngState } from '../../core/rng.ts';
import { POINTS } from '../../content/seaBalance.ts';
import type { Point8, SeaBalance } from '../../content/seaBalance.ts';
import type { TimeBalance } from '../../content/balance.ts';
import type { CalendarState } from '../calendar/calendar.ts';
import { DAYS_PER_YEAR, isDaylight, seasonOf, yearOf } from '../calendar/calendar.ts';
import type {
  DayVisibility,
  DayWeather,
  Forecast,
  NamedStorm,
  SeaState,
  StormYear,
  Visibility,
  WindStrength,
} from './types.ts';

/** What the weather reads and writes of the world. */
export interface WeatherWorld {
  readonly sea: SeaState;
  readonly rng: { readonly weather: RngState };
  readonly calendar: CalendarState;
}

const VISIBILITIES: readonly DayVisibility[] = ['CLEAR', 'HAZE', 'FOG'];
/** Draws a day always takes (direction, strength, visibility, calm start, calm length, and four
 * for the forecast), and a year's named storms on its first day. */
export const DRAWS_PER_DAY = 9;
const AUTUMN_DRAWS = 3;

/** The index in `odds` (percent, summing to 100) that a uniform draw `r` in [0, 1) falls in. */
export function pickOdds(odds: readonly number[], r: number): number {
  let acc = 0;
  const at = r * 100;
  for (let i = 0; i < odds.length; i++) {
    acc += odds[i] ?? 0;
    if (at < acc) return i;
  }
  // Only odds ending in zeros leave this: take the last with any chance.
  for (let i = odds.length - 1; i >= 0; i--) if ((odds[i] ?? 0) > 0) return i;
  return 0;
}

/** The day of its year, 1 to 120. */
export function dayOfYear(day: number): number {
  return ((day - 1) % DAYS_PER_YEAR) + 1;
}

function rollYear(rng: RngState, b: SeaBalance, year: number): StormYear {
  const w = b.weather;
  const firstStorm = nextInt(rng, w.firstStorm[0], w.firstStorm[1]);
  const count = nextInt(rng, w.autumnStorms.count[0], w.autumnStorms.count[1]);
  const [lo, hi] = w.autumnStorms.days;
  const autumn: number[] = [];
  for (let i = 0; i < AUTUMN_DRAWS; i++) {
    let d = nextInt(rng, lo, hi);
    // Different days: a day already taken moves on to the next free one in the range.
    while (autumn.includes(d)) d = d >= hi ? lo : d + 1;
    autumn.push(d);
  }
  const washing = nextInt(rng, w.washing[0], w.washing[1]);
  return { year, firstStorm, autumn: autumn.slice(0, count).sort((a, c) => a - c), washing };
}

/** The named storm of a day, if any. */
export function namedStormOf(year: StormYear | undefined, day: number): NamedStorm | null {
  if (year === undefined) return null;
  const d = dayOfYear(day);
  if (d === year.firstStorm) return 'FIRST_STORM';
  if (year.autumn.includes(d)) return 'AUTUMN_STORM';
  if (d === year.washing) return 'CAILLEACH';
  return null;
}

/** Whether winter closure holds on a day: from the Cailleach's washing to the year's end. */
export function inWinterClosure(sea: SeaState, day: number): boolean {
  const y = sea.weather.years[yearOf(day)];
  return y !== undefined && dayOfYear(day) >= y.washing;
}

function rollDay(sea: SeaState, rng: RngState, b: SeaBalance, day: number, accuracy: number): void {
  const year = yearOf(day);
  if (dayOfYear(day) === 1 || sea.weather.years[year] === undefined)
    sea.weather.years[year] = rollYear(rng, b, year);
  const r = Array.from({ length: DRAWS_PER_DAY }, () => nextFloat(rng));
  const [rDir, rStr, rVis, rCalm, rLen, rRight, rWDir, rWStr, rWVis] = r as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const season = seasonOf(day);
  const w = b.weather;
  const windFrom = POINTS[pickOdds(w.windFrom[season], rDir)] ?? 'SW';
  let strength = pickOdds(w.strength[season], rStr) as WindStrength;
  let visibility = VISIBILITIES[pickOdds(w.visibility[season], rVis)] ?? 'CLEAR';
  const named = namedStormOf(sea.weather.years[year], day);
  let calm = false;
  if (named !== null) {
    strength = 4;
    if (visibility === 'CLEAR') visibility = 'HAZE';
    sea.weather.calmLeft = 0;
  } else if (inWinterClosure(sea, day)) {
    if (sea.weather.calmLeft > 0) {
      calm = true;
      sea.weather.calmLeft--;
    } else if (rCalm < w.calmWindowChance) {
      calm = true;
      const [lo, hi] = w.calmWindowDays;
      sea.weather.calmLeft = lo + Math.min(hi - lo, Math.floor(rLen * (hi - lo + 1))) - 1;
    }
    if (calm)
      strength = Math.min(
        w.calmStrengthMax,
        Math.floor(rStr * (w.calmStrengthMax + 1)),
      ) as WindStrength;
  } else sea.weather.calmLeft = 0;
  const actual: DayWeather = { day, windFrom, strength, visibility, named, calm };
  sea.weather.days[day] = actual;
  // The forecast, made the day before: right with the household's accuracy (named storms always).
  const right = named !== null || rRight < accuracy;
  let forecast: Forecast;
  if (right)
    forecast = { day, windFrom, strength, visibility, storm: strength >= w.stormFrom, calm };
  else {
    const turn = rWDir < 0.5 ? -1 : 1;
    const dir: Point8 = POINTS[(POINTS.indexOf(windFrom) + turn + 8) % 8] ?? windFrom;
    let fs = strength + (rWStr < 0.5 ? -1 : 1);
    if (fs < 0 || fs > 4) fs = strength + (fs < 0 ? 1 : -1);
    const fv = VISIBILITIES[pickOdds(w.visibility[season], rWVis)] ?? visibility;
    forecast = {
      day,
      windFrom: dir,
      strength: fs as WindStrength,
      visibility: fv,
      storm: fs >= w.stormFrom,
      calm,
    };
  }
  sea.weather.forecasts[day] = forecast;
  sea.weather.rolledTo = day;
  // Keep yesterday, today and tomorrow.
  for (const k of Object.keys(sea.weather.days))
    if (Number(k) < day - 2) Reflect.deleteProperty(sea.weather.days, k);
  for (const k of Object.keys(sea.weather.forecasts))
    if (Number(k) < day - 2) Reflect.deleteProperty(sea.weather.forecasts, k);
  for (const k of Object.keys(sea.weather.years))
    if (Number(k) < year - 1) Reflect.deleteProperty(sea.weather.years, k);
}

/**
 * Draws every day up to tomorrow (today + 1) not yet drawn, in order. `accuracy` is the
 * household's forecast accuracy (Book 10 forecastAccuracy, or the weather-vane's). Returns the
 * days drawn.
 */
export function ensureWeather(
  world: WeatherWorld,
  b: SeaBalance,
  accuracy: number,
  today: number = world.calendar.day,
): DayWeather[] {
  const out: DayWeather[] = [];
  while (world.sea.weather.rolledTo < today + 1) {
    const day = world.sea.weather.rolledTo + 1;
    rollDay(world.sea, world.rng.weather, b, day, accuracy);
    const d = world.sea.weather.days[day];
    if (d !== undefined) out.push(d);
  }
  return out;
}

/** The weather of a day already drawn (yesterday, today or tomorrow), or null. */
export function weatherOn(sea: SeaState, day: number): DayWeather | null {
  return sea.weather.days[day] ?? null;
}

/** Today's weather (null before the first day's start has drawn it). */
export function weatherToday(world: WeatherWorld): DayWeather | null {
  return weatherOn(world.sea, world.calendar.day);
}

/** The household's forecast for tomorrow. */
export function forecastTomorrow(world: WeatherWorld): Forecast | null {
  return world.sea.weather.forecasts[world.calendar.day + 1] ?? null;
}

/**
 * Today's wind, for later work to drive zone wind (decision S13-15; not wired to the zones yet):
 * the point it blows from and its strength, 0 to 4.
 */
export function windToday(
  world: WeatherWorld,
): { readonly from: Point8; readonly strength: WindStrength } | null {
  const w = weatherToday(world);
  return w === null ? null : { from: w.windFrom, strength: w.strength };
}

/** The visibility now: the day's, or night between the season's dark and light. */
export function visibilityNow(world: WeatherWorld, time: TimeBalance): Visibility {
  if (!isDaylight(world.calendar, time)) return 'NIGHT';
  return weatherToday(world)?.visibility ?? 'CLEAR';
}

/** Whether a day (drawn) was a storm (Book 10 stormFrom). */
export function isStormDay(sea: SeaState, b: SeaBalance, day: number): boolean {
  const w = weatherOn(sea, day);
  return w !== null && w.strength >= b.weather.stormFrom;
}

/**
 * The weather the sea map expects for a day: today's as it is, tomorrow's as forecast, and later
 * days as tomorrow's forecast (nothing better is known).
 */
export function expectedOn(
  sea: SeaState,
  today: number,
  day: number,
): { readonly windFrom: Point8; readonly strength: WindStrength; readonly calm: boolean } | null {
  if (day <= today) {
    return weatherOn(sea, today);
  }
  const f = sea.weather.forecasts[today + 1] ?? null;
  if (f === null) return null;
  return day === today + 1 ? f : { windFrom: f.windFrom, strength: f.strength, calm: false };
}
