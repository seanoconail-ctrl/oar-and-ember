/**
 * Every audio cue in the content table (content/audio.json) and its generated implementation
 * (Book 11 section 12; decision AU-11). The game's engine and the coverage test both read this,
 * so a cue cannot exist in the content without a sound, nor a sound without its caption.
 *
 * - Music cues name a piece of note data (`piece`) and the layers it starts with.
 * - Effects, tells and stingers are generated graphs (sfx.ts and the three below).
 * - Ambience cues name a generated ambience.
 */
import hearthJson from '../../../content/music/hearth.json';
import combatJson from '../../../content/music/combat.json';
import raidJson from '../../../content/music/raid.json';
import skarvholmJson from '../../../content/music/skarvholm.json';
import shipJson from '../../../content/music/ship.json';
import { envelope } from './engine.ts';
import type { SynthEngine } from './engine.ts';
import type { Piece } from './notation.ts';
import { rng } from './samples.ts';
import { HOME } from './home.ts';
import type { HomePhase } from './home.ts';
import { COMBAT, FIGHT, MISSILES, out, PEOPLE, TELLS } from './sfx.ts';
import { SOUTH } from './south.ts';
import { REPAIR_SOUNDS } from './repairs.ts';
import { LAUNCH_SOUNDS } from './launch.ts';
import type { SoundDef } from './sfx.ts';

export const PIECES: Readonly<Record<string, Piece>> = {
  hearth: hearthJson,
  skarvholm: skarvholmJson,
  raid: raidJson,
  combat: combatJson,
  ship: shipJson,
};

/** The horn and the two stingers, generated from the instruments' samples. */
export const CALLS: readonly SoundDef[] = [
  {
    id: 'SFX_HORN',
    captionKey: 'caption.sfx.horn',
    bus: 'tells',
    play: (e, at, pan) => {
      // A cow-horn call: two long notes a fifth apart, the second held and falling away.
      // A warning stands above the effects (Book 11 section 09): the horn is boosted on its bus.
      const boost = e.ctx.createGain();
      boost.gain.value = 2.2;
      boost.connect(out(e, 'tells', pan, 0.35));
      e.playNote('horn', 45, at, 0.6, 0.9, boost, 0);
      const end = e.playNote('horn', 52, at + 0.55, 1.1, 0.85, boost, 0);
      return end - at;
    },
  },
  {
    id: 'MUS_STINGER_HORN',
    captionKey: 'caption.stinger.horn',
    bus: 'music',
    play: (e, at, pan) => {
      // The alarm stinger: three short horn blasts over a struck drum.
      const to = out(e, 'music', pan, 0.25);
      e.playNote('drum', 38, at, 0.2, 0.9, to);
      e.playNote('horn', 52, at, 0.3, 0.8, to);
      e.playNote('horn', 52, at + 0.42, 0.3, 0.8, to);
      const end = e.playNote('horn', 57, at + 0.84, 0.9, 0.9, to);
      return end - at;
    },
  },
  {
    id: 'MUS_STINGER_DISCOVERY',
    captionKey: 'caption.stinger.discovery',
    bus: 'music',
    play: (e, at, pan) => {
      // Something found: a rising harp figure in D Dorian and a bell on the last note.
      const to = out(e, 'music', pan, 0.4);
      const notes = [62, 65, 69, 72];
      notes.forEach((m, i) => e.playNote('harp', m, at + i * 0.14, 0.4, 0.7, to));
      const end = e.playNote('bells', 74, at + notes.length * 0.14, 1.2, 0.5, to);
      return end - at;
    },
  },
];

/**
 * Stage 8: the first dispute's stingers (Book 3 Stage 23 brought forward for Oddi's theft,
 * decision S8-24), listed apart from the calls so the sound test's earlier item count stands.
 */
export const DISPUTES: readonly SoundDef[] = [
  {
    id: 'MUS_STINGER_DISPUTE',
    captionKey: 'caption.stinger.dispute',
    bus: 'music',
    play: (e, at, pan) => {
      // Trouble at the fire (Stage 8, the first dispute): two low lyre notes a semitone apart
      // over a muffled drum, left hanging on the upper one; D Dorian's E against F.
      const to = out(e, 'music', pan, 0.3);
      e.playNote('drum', 38, at, 0.25, 0.7, to);
      e.playNote('lyre', 52, at + 0.05, 0.6, 0.75, to);
      e.playNote('lyre', 53, at + 0.5, 0.7, 0.7, to);
      const end = e.playNote('drone', 38, at, 1.4, 0.35, to);
      return end - at;
    },
  },
  {
    id: 'MUS_STINGER_JUDGEMENT',
    captionKey: 'caption.stinger.judgement',
    bus: 'music',
    play: (e, at, pan) => {
      // The judgement given: one drum stroke, then the harp settles down a fifth to the home note.
      const to = out(e, 'music', pan, 0.3);
      e.playNote('drum', 38, at, 0.3, 0.85, to);
      e.playNote('harp', 69, at + 0.18, 0.5, 0.65, to);
      const end = e.playNote('harp', 62, at + 0.46, 1.1, 0.7, to);
      return end - at;
    },
  },
];

/** Stage 9: the steerer's death (game over): a slow, low drum, the drone falling away. */
export const ENDINGS: readonly SoundDef[] = [
  {
    id: 'MUS_STINGER_GAME_OVER',
    captionKey: 'caption.stinger.game_over',
    bus: 'music',
    play: (e, at, pan) => {
      const to = out(e, 'music', pan, 0.4);
      e.playNote('drum', 38, at, 0.5, 0.8, to);
      e.playNote('drum', 38, at + 1.1, 0.5, 0.6, to);
      e.playNote('lyre', 50, at + 0.2, 1.4, 0.55, to);
      e.playNote('lyre', 45, at + 1.3, 2.0, 0.5, to);
      const end = e.playNote('drone', 38, at, 3.4, 0.35, to);
      return end - at;
    },
  },
];

/** Every generated one-shot by its cue ID. */
export const SOUNDS: ReadonlyMap<string, SoundDef> = new Map(
  [
    ...COMBAT,
    ...TELLS,
    ...CALLS,
    ...PEOPLE,
    ...MISSILES,
    ...HOME,
    ...DISPUTES,
    ...FIGHT,
    ...ENDINGS,
    ...SOUTH,
    ...REPAIR_SOUNDS,
    ...LAUNCH_SOUNDS,
  ].map((d) => [d.id, d]),
);

/**
 * The hearth's ambience: a low, breathing bed of flame and the occasional crackle and pop of
 * peat and driftwood, scheduled ahead of the audio clock like the strand's.
 */
export class HearthAmbience {
  readonly #e: SynthEngine;
  readonly #r = rng(311);
  readonly #out: GainNode;
  readonly #sources: AudioScheduledSourceNode[] = [];
  #next = 0;
  #running = false;
  #level: number;

  constructor(engine: SynthEngine, level = 1) {
    this.#e = engine;
    this.#level = level;
    this.#out = engine.ctx.createGain();
    this.#out.gain.value = 0.5 * level;
    this.#out.connect(engine.buses.ambience);
  }

  /**
   * How near the fire is, 0 (out of hearing, or out) to 1 (beside it). The crackle follows the
   * listener smoothly; when it is silent no crackles are scheduled.
   */
  setLevel(level: number, at: number): void {
    const l = Math.max(0, Math.min(1, level));
    if (Math.abs(l - this.#level) < 0.01) return;
    this.#level = l;
    this.#out.gain.setTargetAtTime(0.5 * l, at, 0.3);
  }

  start(at: number): void {
    this.#running = true;
    this.#next = at;
    const bed = this.#e.noise(at, true);
    const f = this.#e.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    const g = this.#e.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.35, at + 1.5);
    bed.connect(f).connect(g).connect(this.#out);
    this.#sources.push(bed);
  }

  stop(at: number): void {
    this.#running = false;
    this.#out.gain.setTargetAtTime(0, at, 0.4);
    for (const s of this.#sources) s.stop(at + 2);
  }

  schedule(until: number): void {
    if (!this.#running) return;
    if (this.#level <= 0.01) {
      this.#next = Math.max(this.#next, until);
      return;
    }
    while (this.#next < until) {
      const t = this.#next;
      const src = this.#e.noise(t);
      const f = this.#e.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900 + this.#r() * 1800;
      f.Q.value = 1.2;
      const g = this.#e.ctx.createGain();
      const level = 0.15 + this.#r() * 0.35;
      envelope(g.gain, t, [
        [0, 0],
        [0.003, level],
        [0.02 + this.#r() * 0.03, 0],
      ]);
      src.connect(f).connect(g).connect(this.#out);
      src.stop(t + 0.08);
      this.#next += 0.08 + this.#r() ** 2 * 0.9;
    }
  }
}

/** Ambience implementations: the strand bed (wind, sea, gulls), the hearth or home life. */
export const AMBIENCES: Readonly<
  Record<string, 'strand' | 'heath' | 'hearth' | 'home' | 'spring' | 'gale' | 'fold' | 'cave'>
> = {
  AMB_SURF_SHINGLE: 'strand',
  // Inland heather: the same wind, with the sea far off (the strand bed at low water).
  AMB_WIND_HEATHER: 'heath',
  AMB_HEARTH: 'hearth',
  AMB_HOME_DAWN: 'home',
  AMB_HOME_DAY: 'home',
  AMB_HOME_DUSK: 'home',
  AMB_HOME_NIGHT: 'home',
  // Stage 10: the Kelda Spring, the Hag's Seat's gale, the sheepfold by the cairn (south.ts).
  AMB_KELDA_SPRING: 'spring',
  AMB_HAGSEAT_GALE: 'gale',
  AMB_CAIRN_FOLD: 'fold',
  // Stage 11: Seal Cave, the cove's surf with the cave's drips and booms (repairs.ts).
  AMB_SEALCAVE: 'cave',
};

/** The part of the day each home-life ambience is for (Stage 7). */
export const HOME_LIFE: Readonly<Record<string, HomePhase>> = {
  AMB_HOME_DAWN: 'dawn',
  AMB_HOME_DAY: 'day',
  AMB_HOME_DUSK: 'dusk',
  AMB_HOME_NIGHT: 'night',
};
