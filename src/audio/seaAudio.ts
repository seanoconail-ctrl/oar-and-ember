/**
 * The sea's audio routing (Book 11 sections 03 and 07; Stage 13, decisions S13-60 to S13-79).
 * Pure: given the weather now and the voyage's state, it says which sea piece the music director
 * should play (or none, for ambience only), how the sea's bed should sound, and which sound events
 * a sea-map event makes. It reads only what the sea map already shows (the wind, the fog, the
 * voyage's state), never hidden truth, and changes nothing in the simulation.
 *
 * - The music by weather: from Book 10's storm strength (section 02, stormFrom) the storm piece;
 *   from Book 10's `windFrom` (section 25, "Sea sound") the wind piece; below it the calm piece.
 * - Fog silences the music (the dead quiet of fog), unless it is a storm.
 * - Only while under way: sailing, or a choice on the way. Held, at anchor, or handed off to a
 *   scene, the music falls silent and the scene or the bed carries the sound. Every change lands
 *   on a bar line and cross-fades (the music director with Book 10's music fades).
 */
import { parseSeaBalance } from '../content/seaBalance.ts';
import type { SeaEvent, Visibility, VoyageStatus } from '../sim/sea/types.ts';
import type { Direction } from './router.ts';
import type { SeaBedState } from './synth/sea.ts';

/** The director's cue names for the sea (content/audio.json; Book 11 section 03). */
export const SEA_MUSIC = {
  CALM: 'MUS_SEA_CALM',
  WIND: 'MUS_SEA_WIND',
  STORM: 'MUS_SEA_STORM',
} as const;
export type SeaMusicCue = (typeof SEA_MUSIC)[keyof typeof SEA_MUSIC];

/** The sea's ambience cues (Book 11 section 07): the bed's two faces, and the wreck. */
export const SEA_AMBIENCE = {
  RIGGING: 'AMB_WIND_RIGGING',
  FOG: 'AMB_FOG_QUIET',
  WRECK: 'AMB_SEA_WRECK',
} as const;

/** The sound events of the sea and the wreck (content/audio.json `events`). */
export const SEA_SOUND_EVENTS = {
  OAR_STROKE: 'OAR_STROKE',
  SAIL_SET: 'SAIL_SET',
  SAIL_REEFED: 'SAIL_REEFED',
  SAIL_LUFFING: 'SAIL_LUFFING',
  SAIL_STRAIN: 'SAIL_STRAIN',
  WAVE_HULL: 'WAVE_HULL',
  HULL_GROAN: 'HULL_GROAN',
  WRECK_BREAK: 'WRECK_BREAK',
  WRECK_GRIND: 'WRECK_GRIND',
  WRECK_CRIES: 'WRECK_CRIES',
} as const;
export type SeaSoundEvent = (typeof SEA_SOUND_EVENTS)[keyof typeof SEA_SOUND_EVENTS];

/** Book 10's numbers the routing uses. */
export interface SeaSoundRules {
  /** The wind's strength from which the wind piece plays (Book 10 section 25, Sea sound). */
  readonly windFrom: number;
  /** A storm's strength (Book 10 section 02, stormFrom). */
  readonly stormFrom: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads the rules from content/balance.json, as Book 10 writes them. */
export function seaSoundRules(balance: unknown): SeaSoundRules {
  const tables = isRecord(balance) ? balance['tables'] : undefined;
  const section = isRecord(tables) ? tables['theOpeningGuidanceAndFeel'] : undefined;
  const rows = isRecord(section) ? section['seaSound'] : undefined;
  if (!Array.isArray(rows))
    throw new Error('balance.json: no table theOpeningGuidanceAndFeel.seaSound');
  const value = (rows as Record<string, string>[]).find((r) => r['Key'] === 'windFrom')?.['Value'];
  const m = /^Wind strength (\d)$/.exec(value ?? '');
  if (m === null) throw new Error(`balance.json: seaSound.windFrom is "${value ?? ''}"`);
  const stormFrom = parseSeaBalance(balance).weather.stormFrom;
  const windFrom = Number(m[1]);
  if (!(windFrom > 0 && windFrom < stormFrom))
    throw new Error(
      `balance.json: seaSound.windFrom ${windFrom} is not under stormFrom ${stormFrom}`,
    );
  return { windFrom, stormFrom };
}

/** What the sea's sound hears: the weather now and the voyage's state, as the sea map shows them. */
export interface SeaSoundInput {
  /** The wind's strength now, 0 (a calm) to 4 (a storm): `windToday(world)?.strength`. */
  readonly strength: number;
  /** The visibility now: `visibilityNow(world, time)`. */
  readonly visibility: Visibility;
  /** The voyage's state (`world.sea.voyage?.status`), or null with no voyage under way. */
  readonly status: VoyageStatus | null;
  /** Whether the leg under way is rowed (`world.sea.voyage?.leg?.rowing`); false under sail. */
  readonly rowing: boolean;
}

/** Whether the boat is on her way (the music plays): sailing, or a choice put on the way. */
function underWay(status: VoyageStatus | null): boolean {
  return status === 'SAILING' || status === 'CHOICE';
}

/** The sea piece for the weather, or null for ambience only. */
export function seaMusic(input: SeaSoundInput, rules: SeaSoundRules): SeaMusicCue | null {
  if (!underWay(input.status)) return null;
  if (input.strength >= rules.stormFrom) return SEA_MUSIC.STORM;
  if (input.visibility === 'FOG') return null;
  return input.strength >= rules.windFrom ? SEA_MUSIC.WIND : SEA_MUSIC.CALM;
}

/** The sea's bed: null when there is no bed to play (no voyage, or a scene has the sound). */
export function seaBed(input: SeaSoundInput, rules: SeaSoundRules): SeaBedState | null {
  if (input.status === null || input.status === 'HANDOFF') return null;
  const share = Math.max(0, Math.min(1, input.strength / rules.stormFrom));
  const storm = input.strength >= rules.stormFrom;
  const moving = underWay(input.status);
  return {
    wind: share,
    sea: share,
    fog: input.visibility === 'FOG' && !storm,
    rowing: moving && input.rowing,
    moving,
    storm,
  };
}

/** The ambience cues the bed stands for (for captions on the sound test and for the router). */
export function seaAmbience(bed: SeaBedState | null): readonly string[] {
  if (bed === null) return [];
  return bed.fog ? [SEA_AMBIENCE.FOG] : [SEA_AMBIENCE.RIGGING];
}

export interface SeaSound {
  readonly event: SeaSoundEvent;
  readonly direction?: Direction;
}

/**
 * The sound events a sea-map event makes (content/audio.json maps each to its cue): the sail set,
 * luffing or straining as a leg begins by its point of sail, the oars when it is rowed, the sail
 * reefed to press on into rising weather, a sea on the hull in a storm's watch, the hull groaning
 * under storm damage, and cries from the wreck when the wreck is met. The wreck scene itself plays
 * its timber and cries with their direction (`WRECK_BREAK`, `WRECK_GRIND`, `WRECK_CRIES`).
 */
export function seaEventSounds(
  event: SeaEvent,
  input: SeaSoundInput,
  rules: SeaSoundRules,
): readonly SeaSound[] {
  switch (event.type) {
    case 'SEA_LEG_STARTED': {
      if (event.pointOfSail === 'CALM' || event.pointOfSail === 'AGAINST' || input.rowing)
        return [{ event: SEA_SOUND_EVENTS.OAR_STROKE }];
      if (event.pointOfSail === 'CLOSE_HAULED') return [{ event: SEA_SOUND_EVENTS.SAIL_LUFFING }];
      return [
        {
          event:
            input.strength >= rules.windFrom
              ? SEA_SOUND_EVENTS.SAIL_STRAIN
              : SEA_SOUND_EVENTS.SAIL_SET,
        },
      ];
    }
    case 'SEA_CHOSEN':
      return event.option === 'PRESS_ON' && !input.rowing
        ? [{ event: SEA_SOUND_EVENTS.SAIL_REEFED }]
        : [];
    case 'SEA_WATCH':
      return event.storm ? [{ event: SEA_SOUND_EVENTS.WAVE_HULL }] : [];
    case 'SEA_STORM_DAMAGE':
      return [{ event: SEA_SOUND_EVENTS.HULL_GROAN }];
    case 'SEA_ENCOUNTER':
      return event.encounter.scene?.scenario === 'SCN_SEA_WRECK'
        ? [{ event: SEA_SOUND_EVENTS.WRECK_CRIES }]
        : [];
    default:
      return [];
  }
}

/** The rowing stroke's period at sea: two beats of the sea piece (content/music/sea.json). */
export function seaStrokeSeconds(tempo: number): number {
  return (2 * 60) / tempo;
}
