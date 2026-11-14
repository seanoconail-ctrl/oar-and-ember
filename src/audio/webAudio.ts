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
import { IslandLayers } from './synth/island.ts';
import type { IslandMix } from './islandAmbience.ts';
import { CaveAmbience } from './synth/repairs.ts';
import { AMBIENCES, HearthAmbience, HOME_LIFE, PIECES, SOUNDS } from './synth/cues.ts';
import { HomeAmbience } from './synth/home.ts';
import { GALE_WIND, SpringAmbience } from './synth/south.ts';
import { RainClothAmbience, StormAmbience } from './synth/storm.ts';
import { SeaAmbience, WreckAmbience } from './synth/sea.ts';
import type { SeaBedState } from './synth/sea.ts';
import { seaStrokeSeconds } from './seaAudio.ts';
import { allInstrumentSamples, SynthEngine, warmSamples } from './synth/engine.ts';
import { footstep, isSurface } from './synth/footsteps.ts';
import type { Gait } from './synth/footsteps.ts';
import { PiecePlayer } from './synth/sequencer.ts';
import { speak, voiceOf } from './synth/voice.ts';
import type { MusicAction } from './music.ts';
import type { AudioSink, Bus } from './router.ts';

/** How far ahead of the audio clock notes and waves are scheduled, seconds. */
const LOOKAHEAD = 0.6;

/** Each bus's level as the game starts (the pause menu's sliders scale these, DG-18). */
const DEFAULT_LEVELS: ReadonlyMap<Bus, number> = new Map<Bus, number>([
  ['master', 0.8],
  ['music', 0.6],
  ['ambience', 0.6],
  ['effects', 0.85],
  ['voice', 0.9],
  ['tells', 0.9],
]);

export class WebAudioEngine implements AudioSink {
  #ctx: AudioContext | null = null;
  #e: SynthEngine | null = null;
  readonly #volumes = new Map<Bus, number>(DEFAULT_LEVELS);
  #mono = false;
  #paused = false;
  readonly #players = new Map<string, PiecePlayer>();
  #strand: StrandAmbience | null = null;
  /** Stage 14: the island's layers over the strand's bed, and the rule's mix for now. */
  #island: IslandLayers | null = null;
  #islandMix: IslandMix | null = null;
  #hearth: HearthAmbience | null = null;
  #hearthLevel = 0;
  #home: HomeAmbience | null = null;
  /** Stage 10: the Kelda Spring (by distance), and the gale on the Hag's Seat. */
  #spring: SpringAmbience | null = null;
  #cave: CaveAmbience | null = null;
  #springLevel = 0;
  /** Design addendum 2.5: the cold open's storm bed, and rain on the sail cloth under it. */
  #storm: StormAmbience | null = null;
  #rain: RainClothAmbience | null = null;
  #stormLevel = 0;
  #rainLevel = 0;
  /** Stage 13: the sea's bed under the sea map (setSea), and the wreck on its skerry. */
  #sea: SeaAmbience | null = null;
  #wreck: WreckAmbience | null = null;
  #wreckSide = 0;
  #gale = false;
  #steps = 0;
  #winter = false;
  /** The gore setting (0 off, 1 low, 2 full) scales the wet layers of the fight sounds. */
  #gore: 0 | 1 | 2 = 2;
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
      this.#e.setMono(this.#mono);
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
    this.#island?.schedule(until);
    this.#hearth?.schedule(until);
    this.#home?.schedule(until);
    this.#spring?.schedule(until);
    this.#cave?.schedule(until);
    this.#storm?.schedule(until);
    this.#rain?.schedule(until);
    if (this.#sea !== null) {
      // The oars row in time with the sea's music: a stroke every two beats from its bar line.
      const music = [...this.#players.values()].find((p) => p.piece.id === 'MUS_SEA');
      if (music !== undefined)
        this.#sea.setStroke(seaStrokeSeconds(music.piece.tempo), music.startTime);
      this.#sea.schedule(until);
    }
    this.#wreck?.schedule(until);
  }

  /**
   * Stage 13: the sea's bed under the sea map (`AMB_WIND_RIGGING` and, in fog, `AMB_FOG_QUIET`),
   * as seaAudio.ts `seaBed` gives it from the weather and the voyage; null stops it.
   */
  setSea(bed: SeaBedState | null): void {
    const e = this.#e;
    if (e === null) return;
    const t = e.ctx.currentTime;
    if (bed !== null && this.#sea === null) {
      this.#sea = new SeaAmbience(e);
      this.#sea.setState(bed, t);
      this.#sea.start(t);
    } else if (bed === null && this.#sea !== null) {
      this.#sea.stop(t);
      this.#sea = null;
    } else if (bed !== null) this.#sea?.setState(bed, t);
  }

  /** Where the wreck lies from the listener, -1 (left) to 1 (right), for its ambience. */
  setWreckSide(side: number): void {
    this.#wreckSide = side;
    const e = this.#e;
    if (e !== null) this.#wreck?.setSide(side, e.ctx.currentTime);
  }

  /**
   * The cold open's storm bed (`AMB_COLD_STORM`): `level` 0 stops it; `pitch` and `roll` are the
   * ship's periods (Book 10 section 25), so the timber groans and creaks in time with the picture.
   */
  setStorm(level: number, pitch = 3.2, roll = 5.4): void {
    const e = this.#e;
    if (e === null || level === this.#stormLevel) return;
    this.#stormLevel = level;
    const t = e.ctx.currentTime;
    if (level > 0 && this.#storm === null) {
      this.#storm = new StormAmbience(e, pitch, roll);
      this.#storm.start(t);
    } else if (level <= 0 && this.#storm !== null) {
      this.#storm.stop(t);
      this.#storm = null;
    }
    this.#storm?.setLevel(level, t);
  }

  /** Rain on the sail cloth (`AMB_RAIN_CLOTH`), heard only under the sail: 0 (none) to 1. */
  setRainCloth(level: number): void {
    const e = this.#e;
    if (e === null || level === this.#rainLevel) return;
    this.#rainLevel = level;
    const t = e.ctx.currentTime;
    if (level > 0 && this.#rain === null) {
      this.#rain = new RainClothAmbience(e, level);
      this.#rain.start(t);
    } else if (level <= 0 && this.#rain !== null) {
      this.#rain.stop(t);
      this.#rain = null;
    }
    this.#rain?.setLevel(level, t);
  }

  /** How near the Kelda Spring the listener is, 0 (unheard) to 1 (beside it): Stage 10. */
  setSpring(level: number): void {
    this.#springLevel = level;
    const e = this.#e;
    if (e !== null) this.#spring?.setLevel(level, e.ctx.currentTime);
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

  /** Each bus's level as a share of its default (the pause menu's sliders, DG-18), and mono. */
  setMix(mix: Readonly<Partial<Record<Bus, number>>>, mono: boolean): void {
    for (const [bus, base] of DEFAULT_LEVELS) {
      const share = mix[bus];
      if (share !== undefined) this.setVolume(bus, base * Math.max(0, Math.min(1, share)));
    }
    this.#mono = mono;
    this.#e?.setMono(mono);
  }

  /**
   * The pause duck (Book 10 pauseDuck, DG-15): while the menu holds time, music and ambience fall
   * `db` over `seconds` and effects and voice blips pause (silenced); back over the same on resume.
   */
  setPaused(paused: boolean, db: number, seconds: number): void {
    const e = this.#e;
    this.#paused = paused;
    if (e === null) return;
    const now = e.ctx.currentTime;
    const k = Math.pow(10, -Math.abs(db) / 20);
    for (const bus of ['music', 'ambience', 'effects', 'voice', 'tells'] as const) {
      const level = this.#volumes.get(bus) ?? 0;
      const to = !paused ? level : bus === 'music' || bus === 'ambience' ? level * k : 0;
      e.buses[bus].gain.setTargetAtTime(to, now, Math.max(0.01, seconds / 4));
    }
  }

  get paused(): boolean {
    return this.#paused;
  }

  /**
   * The steerer's collapse (the user's fourth playtest, Book 10 "The steerer's death", DH-71):
   * every sound drops away to silence, effects, voice blips and the tells over `quick` seconds, the
   * world and the music over `seconds`; `fallen` false brings them back over `seconds` (a save
   * loaded). Sounds already sounding (the fall's own thud) play on under the fade.
   */
  setFallen(fallen: boolean, seconds: number, quick = seconds): void {
    const e = this.#e;
    if (e === null) return;
    const now = e.ctx.currentTime;
    for (const bus of ['music', 'ambience', 'effects', 'voice', 'tells'] as const) {
      const level = this.#volumes.get(bus) ?? 0;
      const over = bus === 'music' || bus === 'ambience' ? seconds : quick;
      e.buses[bus].gain.cancelScheduledValues(now);
      e.buses[bus].gain.setTargetAtTime(fallen ? 0 : level, now, Math.max(0.01, over / 4));
    }
  }

  /** The pause menu's wooden click (SFX_MENU_CLICK), or its knock as it opens; never captioned. */
  click(opening = false): void {
    const e = this.#e;
    if (e === null) return;
    SOUNDS.get('SFX_MENU_CLICK')?.play(e, e.ctx.currentTime, 0, {
      gore: this.#gore,
      ...(opening ? { voice: 180 } : {}),
    });
  }

  /** Winter switches the island theme to its winter variant from the next bar line. */
  /** Book 11 section 07: the gore setting scales the wet layers of the combat sounds. */
  setGore(level: 0 | 1 | 2): void {
    this.#gore = level;
  }

  setSeason(winter: boolean): void {
    this.#winter = winter;
    for (const p of this.#players.values())
      if (p.piece.variants?.some((v) => v.id === 'winter') === true)
        p.setVariant(winter ? 'winter' : 'summer');
  }

  /** The game's wind at the listener (Book 7 section 14): strength 0..1, gust 0..1, side -1..1. */
  setWind(strength: number, gust: number, from: number): void {
    this.#wind = { strength, gust, from };
    this.#strand?.setWind(this.#coreWind(strength), gust, from);
  }

  /** The bed's wind: the island's rule for the place (Stage 14), else the Hag's Seat's gale. */
  #coreWind(strength: number): number {
    const mix = this.#islandMix;
    if (mix !== null) return Math.min(1, strength * mix.wind * (1 - 0.4 * mix.quiet));
    return this.#gale ? Math.min(1, strength * GALE_WIND) : strength;
  }

  /** The tide's height 0 (low) to 1 (high). */
  setTide(height: number): void {
    this.#tide = height;
    this.#strand?.setTide(this.#islandMix === null ? height : height * this.#islandMix.surfNear);
  }

  /**
   * Stage 14 (decisions S14-100 to S14-109): the island's ambience for now, from its rules
   * (islandAmbience.ts `islandMix`), four times a second; null leaves the zone's beds as they were.
   * The strand's bed plays the sea as loud as its distance, from its side, with the place's wind
   * and gulls; the island's layers play the birds, the water, the cave, the roar and the quiet.
   */
  setIsland(mix: IslandMix | null): void {
    this.#islandMix = mix;
    const e = this.#e;
    if (e === null) return;
    const t = e.ctx.currentTime;
    if (mix === null) {
      this.#island?.stop(t);
      this.#island = null;
      return;
    }
    if (this.#island === null) {
      this.#island = new IslandLayers(e);
      this.#island.start(t);
    }
    this.#island.set(mix, t);
    const core = this.#strand;
    if (core !== null) {
      core.setSurf(mix.surf.level, mix.surf.pan, t);
      core.setGulls(mix.gulls);
      core.setTide(this.#tide * mix.surfNear, t);
      core.setWind(this.#coreWind(this.#wind.strength), this.#wind.gust, this.#wind.from, t);
    }
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
        player.start(
          Math.max(action.at, e.ctx.currentTime + 0.05),
          action.fadeIn ?? 0,
          action.layersJoin ?? 0,
        );
        this.#players.set(action.cue, player);
        return;
      }
      case 'stop': {
        this.#players.get(action.cue)?.stop(action.fadeOut ?? 0);
        return;
      }
      case 'gains': {
        // The danger stem's gain raises the alarm layers of a raid piece on the next bar line.
        const player = this.#players.get(action.cue);
        if (player === undefined) return;
        const danger = action.gains[action.gains.length - 1] ?? 0;
        if (player.piece.layers.some((l) => l.group === 'alarm')) {
          player.setLayer('alarm', danger > 0.5);
          player.setLayer('calm', danger <= 0.5);
          return;
        }
        // A piece whose layer groups are named after the cue's stems (the combat music) brings
        // each group in when its stem is more than half up, on the next bar line.
        const stems = this.#cueOf(action.cue)?.stems ?? [];
        stems.forEach((stem, i) => {
          if (i === 0 || !player.piece.layers.some((l) => l.group === stem)) return;
          player.setLayer(stem, (action.gains[i] ?? 0) > 0.5);
        });
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

  oneShot(cue: CueDef, at: number, pan: number, voice?: number, variant?: number): void {
    const e = this.#e;
    if (e === null) return;
    SOUNDS.get(cue.id)?.play(e, Math.max(at, e.ctx.currentTime), pan, {
      gore: this.#gore,
      ...(voice === undefined ? {} : { voice }),
      ...(variant === undefined ? {} : { variant }),
    });
  }

  ambience(cues: readonly CueDef[], at: number): void {
    const e = this.#e;
    if (e === null) return;
    const t = Math.max(at, e.ctx.currentTime);
    const kinds = new Set(cues.map((c) => AMBIENCES[c.id]));
    // Stage 10: the Hag's Seat's gale is the strand's bed with the wind up and the surf below.
    this.#gale = kinds.has('gale');
    const cave = kinds.has('cave');
    const wantStrand =
      kinds.has('strand') || kinds.has('heath') || kinds.has('island') || this.#gale || cave;
    if (wantStrand && this.#strand === null) {
      this.#strand = new StrandAmbience(e);
      const strength = this.#coreWind(this.#wind.strength);
      this.#strand.setWind(strength, this.#wind.gust, this.#wind.from, t);
      const mix = this.#islandMix;
      this.#strand.setTide(
        mix !== null
          ? this.#tide * mix.surfNear
          : kinds.has('strand') || cave
            ? this.#tide
            : this.#gale
              ? 0.45
              : 0,
        t,
      );
      if (mix !== null) {
        this.#strand.setSurf(mix.surf.level, mix.surf.pan, t);
        this.#strand.setGulls(mix.gulls);
      }
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
    // Stage 11: Seal Cave's drips, booms and seals over the cove's surf.
    if (cave && this.#cave === null) {
      this.#cave = new CaveAmbience(e);
      this.#cave.start(t);
    } else if (!cave && this.#cave !== null) {
      this.#cave.stop(t);
      this.#cave = null;
    }
    // Stage 13: the wreck on its skerry, by its zone (AMB_SEA_WRECK).
    if (kinds.has('wreck') && this.#wreck === null) {
      this.#wreck = new WreckAmbience(e);
      this.#wreck.setSide(this.#wreckSide, t);
      this.#wreck.start(t);
    } else if (!kinds.has('wreck') && this.#wreck !== null) {
      this.#wreck.stop(t);
      this.#wreck = null;
    }
    // Stage 10: the spring, by its own level.
    if (kinds.has('spring') && this.#spring === null) {
      this.#spring = new SpringAmbience(e, this.#springLevel);
      this.#spring.start(t);
    } else if (!kinds.has('spring') && this.#spring !== null) {
      this.#spring.stop(t);
      this.#spring = null;
    }
    // Home life by time of day: one caller set at a time, changing as the day turns (the fold's
    // own set by the cairn, Stage 10).
    const life = kinds.has('fold')
      ? ('fold' as const)
      : cues.map((c) => HOME_LIFE[c.id]).find((p) => p !== undefined);
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
  voice(speaker: string, text: string, pan: number, level = 1): void {
    const e = this.#e;
    if (e === null || voiceOf(speaker) === undefined) return;
    const at = e.ctx.currentTime + 0.03;
    const length = speak(e, at, speaker, text, pan, level);
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
