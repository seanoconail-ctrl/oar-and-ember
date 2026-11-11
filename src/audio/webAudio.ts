/**
 * The game's audio engine (Book 11 section 10; decision AU-11): one AudioContext, unlocked on the
 * first input, driving the generated synthesiser (src/audio/synth). Music cues play their piece of
 * note data, effects, tells and stingers are generated graphs, the strand's ambience follows the
 * game's own wind and tide, footsteps follow the surface underfoot, and people speak in voice
 * blips. Buses for master, music, ambience, effects, voice and tells each have a volume (Book 11
 * section 09). It implements the router's `AudioSink`; nothing here reads the simulation.
 */
import type { CueDef } from '../content/registry.ts';
import { StrandAmbience } from './synth/ambience.ts';
import { AMBIENCES, HearthAmbience, HOME_LIFE, PIECES, SOUNDS } from './synth/cues.ts';
import { HomeAmbience } from './synth/home.ts';
import { allInstrumentSamples, SynthEngine, warmSamples } from './synth/engine.ts';
import { footstep, isSurface } from './synth/footsteps.ts';
import type { Gait } from './synth/footsteps.ts';
import { PiecePlayer } from './synth/sequencer.ts';
import { speak, VOICES } from './synth/voice.ts';
import type { MusicAction } from './music.ts';
import type { AudioSink, Bus } from './router.ts';

/** How far ahead of the audio clock notes and waves are scheduled, seconds. */
const LOOKAHEAD = 0.6;

export class WebAudioEngine implements AudioSink {
  #ctx: AudioContext | null = null;
  #e: SynthEngine | null = null;
  readonly #volumes = new Map<Bus, number>([
    ['master', 0.8],
    ['music', 0.6],
    ['ambience', 0.6],
    ['effects', 0.85],
    ['voice', 0.9],
    ['tells', 0.9],
  ]);
  readonly #players = new Map<string, PiecePlayer>();
  #strand: StrandAmbience | null = null;
  #hearth: HearthAmbience | null = null;
  #hearthLevel = 0;
  #home: HomeAmbience | null = null;
  #steps = 0;
  #winter = false;
  #wind = { strength: 0.55, gust: 0, from: 0 };
  #tide = 0.5;
  #timer: ReturnType<typeof setInterval> | null = null;
  #ready = false;
  readonly #waiting: MusicAction[] = [];
  /** The content's cues: music actions name a cue by ID only. */
  readonly #cues: ReadonlyMap<string, CueDef>;

  constructor(cues: readonly CueDef[] = []) {
    this.#cues = new Map(cues.map((c) => [c.id, c]));
  }

  /** True once the browser has let sound start. */
  get unlocked(): boolean {
    return this.#ctx?.state === 'running';
  }

  /** The audio clock in seconds (0 before unlocking). */
  get now(): number {
    return this.#ctx?.currentTime ?? 0;
  }

  /** Starts making the instruments' samples in the background, before sound is unlocked. */
  static prepare(): void {
    void warmSamples(allInstrumentSamples());
  }

  /** Call from a user gesture (click or key): browsers start audio only then. */
  unlock(): void {
    if (this.#ctx === null) {
      const ctx = new AudioContext();
      this.#ctx = ctx;
      this.#e = new SynthEngine(ctx);
      // Music waits for the instruments' samples, made in the background (warmSamples).
      void warmSamples(allInstrumentSamples()).then(() => {
        this.#ready = true;
        for (const action of this.#waiting.splice(0)) this.music(action);
      });
      for (const [bus, level] of this.#volumes) this.#e.setVolume(bus, level);
      // Keep the music and ambience scheduled ahead of the clock.
      this.#timer = setInterval(() => {
        this.#schedule();
      }, 100);
    }
    void this.#ctx.resume();
  }

  /** Stops scheduling (when the view closes). */
  close(): void {
    if (this.#timer !== null) clearInterval(this.#timer);
    void this.#ctx?.close();
  }

  #schedule(): void {
    const e = this.#e;
    if (e === null) return;
    const until = e.ctx.currentTime + LOOKAHEAD;
    for (const [id, player] of this.#players) {
      player.schedule(until);
      if (player.stopped) this.#players.delete(id);
    }
    this.#strand?.schedule(until);
    this.#hearth?.schedule(until);
    this.#home?.schedule(until);
  }

  /** How near a lit fire the listener is, 0 (unheard or out) to 1 (beside it). */
  setHearth(level: number): void {
    this.#hearthLevel = level;
    const e = this.#e;
    if (e !== null) this.#hearth?.setLevel(level, e.ctx.currentTime);
  }

  setVolume(bus: Bus, level: number): void {
    this.#volumes.set(bus, level);
    this.#e?.setVolume(bus, level);
  }

  /** Winter switches the island theme to its winter variant from the next bar line. */
  setSeason(winter: boolean): void {
    this.#winter = winter;
    for (const p of this.#players.values())
      if (p.piece.variants?.some((v) => v.id === 'winter') === true)
        p.setVariant(winter ? 'winter' : 'summer');
  }

  /** The game's wind at the listener (Book 7 section 14): strength 0..1, gust 0..1, side -1..1. */
  setWind(strength: number, gust: number, from: number): void {
    this.#wind = { strength, gust, from };
    this.#strand?.setWind(strength, gust, from);
  }

  /** The tide's height 0 (low) to 1 (high). */
  setTide(height: number): void {
    this.#tide = height;
    this.#strand?.setTide(height);
  }

  music(action: MusicAction): void {
    const e = this.#e;
    if (e === null) return;
    if (!this.#ready && action.type !== 'duck') {
      this.#waiting.push(action);
      return;
    }
    switch (action.type) {
      case 'start': {
        const cue = this.#cueOf(action.cue);
        const piece = cue?.piece === undefined ? undefined : PIECES[cue.piece];
        if (piece === undefined) return;
        const variant =
          piece.variants?.some((v) => v.id === 'winter') === true
            ? this.#winter
              ? 'winter'
              : 'summer'
            : null;
        const player = new PiecePlayer(e, piece, variant);
        for (const [layer, on] of Object.entries(cue?.layers ?? {})) player.setLayer(layer, on);
        player.start(Math.max(action.at, e.ctx.currentTime + 0.05));
        this.#players.set(action.cue, player);
        return;
      }
      case 'stop': {
        this.#players.get(action.cue)?.stop();
        return;
      }
      case 'gains': {
        // The danger stem's gain raises the alarm layers of a raid piece on the next bar line.
        const player = this.#players.get(action.cue);
        const danger = action.gains[action.gains.length - 1] ?? 0;
        if (player?.piece.layers.some((l) => l.group === 'alarm') === true) {
          player.setLayer('alarm', danger > 0.5);
          player.setLayer('calm', danger <= 0.5);
        }
        return;
      }
      case 'duck': {
        const g = e.duck.gain;
        g.setTargetAtTime(action.level, action.from, 0.03);
        g.setTargetAtTime(1, action.until, 0.2);
        return;
      }
    }
  }

  #cueOf(id: string): CueDef | undefined {
    return this.#cues.get(id);
  }

  oneShot(cue: CueDef, at: number, pan: number): void {
    const e = this.#e;
    if (e === null) return;
    SOUNDS.get(cue.id)?.play(e, Math.max(at, e.ctx.currentTime), pan, { gore: 2 });
  }

  ambience(cues: readonly CueDef[], at: number): void {
    const e = this.#e;
    if (e === null) return;
    const t = Math.max(at, e.ctx.currentTime);
    const kinds = new Set(cues.map((c) => AMBIENCES[c.id]));
    const wantStrand = kinds.has('strand') || kinds.has('heath');
    if (wantStrand && this.#strand === null) {
      this.#strand = new StrandAmbience(e);
      this.#strand.setWind(this.#wind.strength, this.#wind.gust, this.#wind.from, t);
      this.#strand.setTide(kinds.has('strand') ? this.#tide : 0, t);
      this.#strand.start(t);
    } else if (!wantStrand && this.#strand !== null) {
      this.#strand.stop(t);
      this.#strand = null;
    }
    if (kinds.has('hearth') && this.#hearth === null) {
      this.#hearth = new HearthAmbience(e, this.#hearthLevel);
      this.#hearth.start(t);
    } else if (!kinds.has('hearth') && this.#hearth !== null) {
      this.#hearth.stop(t);
      this.#hearth = null;
    }
    // Home life by time of day: one caller set at a time, changing as the day turns.
    const life = cues.map((c) => HOME_LIFE[c.id]).find((p) => p !== undefined);
    if (life !== undefined && this.#home === null) {
      this.#home = new HomeAmbience(e, life);
      this.#home.start(t);
    } else if (life !== undefined) this.#home?.setPhase(life, t);
    else if (this.#home !== null) {
      this.#home.stop(t);
      this.#home = null;
    }
  }

  /** A footstep on the surface underfoot (decision AU-10), varied every step. */
  footstep(surface: string, pan: number, gait: Gait = 'walk'): void {
    const e = this.#e;
    if (e === null || !isSurface(surface)) return;
    footstep(e, e.ctx.currentTime + 0.005, surface, pan, this.#steps++, gait);
  }

  /** A line spoken in the speaker's voice blips (Book 11 section 08), if they have a voice. */
  voice(speaker: string, text: string, pan: number): void {
    const e = this.#e;
    if (e === null || VOICES[speaker] === undefined) return;
    const at = e.ctx.currentTime + 0.03;
    const length = speak(e, at, speaker, text, pan);
    // Music ducks under the voice.
    e.duck.gain.setTargetAtTime(0.6, at, 0.05);
    e.duck.gain.setTargetAtTime(1, at + length, 0.3);
  }
}

/** A sink that records what it is asked to play, for tests. */
export class RecordingSink implements AudioSink {
  readonly music: (action: MusicAction) => void;
  readonly calls: { kind: string; detail: unknown }[] = [];
  constructor() {
    this.music = (action) => this.calls.push({ kind: 'music', detail: action });
  }
  oneShot(cue: CueDef, at: number, pan: number): void {
    this.calls.push({ kind: 'oneShot', detail: { cue: cue.id, at, pan } });
  }
  ambience(cues: readonly CueDef[], at: number): void {
    this.calls.push({ kind: 'ambience', detail: { cues: cues.map((c) => c.id), at } });
  }
  setVolume(bus: Bus, level: number): void {
    this.calls.push({ kind: 'volume', detail: { bus, level } });
  }
}
