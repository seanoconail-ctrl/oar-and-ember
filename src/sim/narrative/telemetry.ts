/**
 * Chapter telemetry (Book 3 Stage 12 check 1: "Chapter 1 takes 45 to 60 minutes for a new player,
 * with combat inside 25 minutes, measured by telemetry"; decision S12-12). The simulation marks the
 * first tick each milestone of Chapter 1 is reached, read from the world itself; the time menus
 * held the game (a report or a plan stops time) arrives as a command from the interface. Played
 * time is ticks at 60 a second plus that held time. Saved with the world (version 10), shown in the
 * system menu's timings and the chapter-end card. Pure and deterministic.
 */
import type { Id } from '../../core/ids.ts';
import type { Telemetry, WorldState } from '../world.ts';

/** Chapter 1's milestones, in the order a player usually meets them, and how each is known. */
export const MILESTONES: readonly { readonly key: string; readonly reached: (w: WorldState) => boolean }[] =
  [
    { key: 'seax', reached: (w) => owns(w, 'ITEM_SEAX') },
    { key: 'hild_safe', reached: (w) => w.facts['ch1.hild_safe'] === true },
    { key: 'bow', reached: (w) => owns(w, 'ITEM_BOW') },
    { key: 'at_broch', reached: (w) => w.facts['ch1.at_broch'] === true },
    { key: 'fire', reached: (w) => w.facts['ch1.fire_lit'] === true },
    { key: 'hild_tended', reached: (w) => w.facts['ch1.hild_tended'] === true },
    { key: 'first_night', reached: (w) => w.calendar.day >= 2 },
    {
      key: 'first_fish',
      reached: (w) =>
        Object.values(w.people).some((p) => p.memories.some((m) => m.about === 'FIRST_FISH')),
    },
    { key: 'search_oddi', reached: (w) => w.facts['search.oddi'] !== undefined },
    { key: 'search_runa', reached: (w) => w.facts['search.runa'] !== undefined },
    { key: 'search_bran', reached: (w) => w.facts['search.bran'] !== undefined },
    { key: 'first_combat', reached: (w) => w.onFoot?.battle?.engaged === true },
    { key: 'hull', reached: (w) => w.ships['flagship']?.repairs.HULL.stage === 'DONE' },
    { key: 'rigging', reached: (w) => w.ships['flagship']?.repairs.RIGGING.stage === 'DONE' },
    { key: 'oar', reached: (w) => w.ships['flagship']?.repairs.STEERING_OAR.stage === 'DONE' },
    { key: 'fitting', reached: (w) => w.oneShots['BEAT_1_CUSTOMISE'] !== undefined },
    {
      key: 'rites',
      reached: (w) => w.facts['ch1.rites'] === 'SHIP_SETTING' || w.facts['ch1.rites'] === 'SEA_BURIAL',
    },
    { key: 'boat_ready', reached: (w) => w.facts['ch1.boat_ready'] === true },
    { key: 'gate_open', reached: (w) => (w.gates['BEAT_1_LAUNCH']?.status ?? 'CLOSED') !== 'CLOSED' },
    {
      key: 'launch',
      reached: (w) => {
        const s = w.gates['BEAT_1_LAUNCH']?.status;
        return s === 'STARTED' || s === 'PASSED';
      },
    },
    { key: 'chapter_end', reached: (w) => w.facts['launch.phase'] === 'DONE' },
  ];

function owns(w: WorldState, item: Id): boolean {
  return w.player.hotbar.slots.includes(item);
}

/** Marks every milestone reached for the first time this tick. */
export function stepTelemetry(world: WorldState): void {
  const tel = world.telemetry;
  // A save from before version 10: its play is timed from when it was loaded.
  tel.start ??= world.tick;
  for (const m of MILESTONES) {
    if (tel.marks[m.key] !== undefined || !m.reached(world)) continue;
    tel.marks[m.key] = {
      tick: world.tick,
      day: world.calendar.day,
      minute: world.calendar.minuteOfDay,
      heldMs: tel.heldMs,
    };
  }
}

/** Real time held by a menu that stopped the game, added from the interface (a command). */
export function addHeld(world: WorldState, ms: number): void {
  if (Number.isFinite(ms) && ms > 0) world.telemetry.heldMs += Math.round(ms);
}

/** Seconds played from the start to `tick` with `heldMs` of menus: ticks at 60 a second plus held. */
export function playedSeconds(tel: Telemetry, tick: number, heldMs: number): number {
  return Math.max(0, tick - (tel.start ?? tick)) / 60 + heldMs / 1000;
}

/** Seconds played to each milestone reached, in milestone order; and now. */
export function telemetryReport(world: WorldState): {
  readonly now: number;
  readonly held: number;
  readonly known: boolean;
  readonly marks: readonly { readonly key: string; readonly seconds: number }[];
} {
  const tel = world.telemetry;
  return {
    now: playedSeconds(tel, world.tick, tel.heldMs),
    held: tel.heldMs / 1000,
    known: tel.start === 0,
    marks: MILESTONES.flatMap((m) => {
      const mark = tel.marks[m.key];
      return mark === undefined
        ? []
        : [{ key: m.key, seconds: playedSeconds(tel, mark.tick, mark.heldMs) }];
    }),
  };
}
