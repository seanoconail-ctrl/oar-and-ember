/**
 * The sound test page (sound.html; Book 11, generated audio, step 1): every tune, ambience,
 * effect, tell and voice blip the game generates, to listen to and judge before it is wired into
 * play. Music layers and seasons switch on the next bar line, as in the game.
 *
 * The page also exposes `window.oeSound.render(item, seconds)`, which renders any item offline
 * (an OfflineAudioContext) and returns its levels and a WAV: the browser tests and
 * `npm run audio:render` use it to check every sound without a speaker.
 */
import { StrandAmbience } from '../audio/synth/ambience.ts';
import { CALLS, DISPUTES, ENDINGS, HearthAmbience, PIECES } from '../audio/synth/cues.ts';
import { BUSES, MUSIC_VOICES, SynthEngine } from '../audio/synth/engine.ts';
import {
  footstep,
  isSurface,
  likeness,
  measureStep,
  STEP_INTERVAL,
  SURFACES,
} from '../audio/synth/footsteps.ts';
import type { Gait, StepMeasure } from '../audio/synth/footsteps.ts';
import type { Bus } from '../audio/synth/engine.ts';
import { HOME, HomeAmbience } from '../audio/synth/home.ts';
import type { HomePhase } from '../audio/synth/home.ts';
import { PiecePlayer } from '../audio/synth/sequencer.ts';
import { COMBAT, FIGHT, MISSILES, PEOPLE, TELLS } from '../audio/synth/sfx.ts';
import { GALE_WIND, SOUTH, SpringAmbience } from '../audio/synth/south.ts';
import { CaveAmbience, REPAIR_SOUNDS } from '../audio/synth/repairs.ts';
import { LAUNCH_SOUNDS } from '../audio/synth/launch.ts';
import type { SoundDef } from '../audio/synth/sfx.ts';
import { speak, VOICES } from '../audio/synth/voice.ts';
import { formatString } from '../content/strings.ts';
import type { StringTable } from '../content/strings.ts';
import { gustAt, STRAND_WIND } from '../render/wind.ts';

export { PIECES };

/** The lines the voice blips speak: Hild's own call, and a line each for the others. */
export const BLIP_LINES: readonly { speaker: string; key: string }[] = [
  { speaker: 'C_HILD', key: 'c_hild.bark.call.03' },
  { speaker: 'C_BRAN', key: 'soundtest.line.c_bran' },
  { speaker: 'C_RUNA', key: 'soundtest.line.c_runa' },
  { speaker: 'C_ODDI', key: 'soundtest.line.c_oddi' },
];

const DEFAULT_LEVELS: Readonly<Record<Bus, number>> = {
  master: 0.8,
  music: 0.8,
  ambience: 0.8,
  effects: 0.9,
  voice: 0.8,
  tells: 0.9,
};

export interface RenderSettings {
  /** For music: layers to switch on or off from the start ({ alarm: true }). */
  readonly layers?: Readonly<Record<string, boolean>>;
  readonly variant?: string | null;
  /** For music: switch these layers at this bar (to hear a change land on a bar line). */
  readonly change?: { readonly atBar: number; readonly layers: Readonly<Record<string, boolean>> };
  readonly wind?: number;
  readonly tide?: number;
  readonly gore?: number;
  /** For footsteps: the gait and how many steps to walk. */
  readonly gait?: Gait;
  readonly steps?: number;
}

/**
 * Starts an item on an engine at `at` and returns a scheduler to call with "schedule until"
 * times, and a stop. Shared by the live page and offline renders.
 */
export function startItem(
  e: SynthEngine,
  strings: StringTable,
  item: string,
  at: number,
  s: RenderSettings = {},
): {
  schedule: (until: number, now: number) => void;
  stop: (at: number) => void;
  player?: PiecePlayer;
  ambience?: StrandAmbience;
} {
  const [kind, id = ''] = item.split(':');
  if (kind === 'music') {
    const piece = PIECES[id];
    if (piece === undefined) throw new Error(`no piece ${id}`);
    const player = new PiecePlayer(e, piece, s.variant ?? null);
    for (const [layer, on] of Object.entries(s.layers ?? {})) player.setLayer(layer, on);
    player.start(at);
    let changed = s.change === undefined;
    return {
      player,
      schedule: (until) => {
        if (!changed && s.change !== undefined) {
          // Ask for the change part-way through the bar before, as a player would.
          const changeAt = at + (s.change.atBar - 0.5) * player.barSeconds;
          if (until > changeAt) {
            player.schedule(changeAt);
            for (const [layer, on] of Object.entries(s.change.layers)) player.setLayer(layer, on);
            changed = true;
          }
        }
        player.schedule(until);
      },
      stop: () => {
        player.stop();
      },
    };
  }
  if (kind === 'ambience' && id === 'hearth') {
    const fire = new HearthAmbience(e);
    fire.start(at);
    return {
      schedule: (until) => {
        fire.schedule(until);
      },
      stop: (t) => {
        fire.stop(t);
      },
    };
  }
  if (kind === 'home') {
    // The steading's life by time of day (Stage 7), over the heath's wind.
    const phase = id as HomePhase;
    if (!['dawn', 'day', 'dusk', 'night'].includes(id)) throw new Error(`no part of the day ${id}`);
    const life = new HomeAmbience(e, phase);
    const wind = new StrandAmbience(e);
    wind.setTide(0, at);
    wind.start(at);
    life.start(at);
    return {
      schedule: (until, now) => {
        for (let t = Math.max(at, now); t < until; t += 0.25)
          wind.setWind(s.wind ?? STRAND_WIND.strength, gustAt(STRAND_WIND, 640, 900, t - at), 0, t);
        wind.schedule(until);
        life.schedule(until);
      },
      stop: (t) => {
        wind.stop(t);
        life.stop(t);
      },
    };
  }
  if (kind === 'south') {
    // Stage 10: the Hag's Seat's tell, the Kelda Spring, the gale on the headland, the fold.
    if (id === 'SFX_TELL_CAILLEACH') {
      const def = SOUTH.find((d) => d.id === id);
      def?.play(e, at, 0, { gore: 2 });
      return { schedule: () => undefined, stop: () => undefined };
    }
    const wind = new StrandAmbience(e);
    const strength =
      id === 'gale' ? Math.min(1, STRAND_WIND.strength * GALE_WIND) : STRAND_WIND.strength;
    wind.setTide(id === 'gale' ? 0.45 : 0, at);
    wind.start(at);
    const spring = id === 'spring' ? new SpringAmbience(e, 1) : null;
    const life = id === 'fold' ? new HomeAmbience(e, 'fold') : null;
    if (id !== 'spring' && id !== 'gale' && id !== 'fold')
      throw new Error(`no southern sound ${id}`);
    spring?.start(at);
    life?.start(at);
    return {
      schedule: (until, now) => {
        for (let t = Math.max(at, now); t < until; t += 0.25)
          wind.setWind(
            id === 'spring' ? strength * 0.6 : strength,
            gustAt(STRAND_WIND, 640, 900, t - at),
            0,
            t,
          );
        wind.schedule(until);
        spring?.schedule(until);
        life?.schedule(until);
      },
      stop: (t) => {
        wind.stop(t);
        spring?.stop(t);
        life?.stop(t);
      },
    };
  }
  if (kind === 'repairs') {
    // Stage 11: the repairs, the fitting, the oar, the rites and the lament; and Seal Cave.
    if (id === 'sealcave') {
      const wind = new StrandAmbience(e);
      wind.setTide(0.5, at);
      wind.start(at);
      const cave = new CaveAmbience(e);
      cave.start(at);
      return {
        schedule: (until, now) => {
          for (let t = Math.max(at, now); t < until; t += 0.25)
            wind.setWind(STRAND_WIND.strength * 0.7, gustAt(STRAND_WIND, 640, 900, t - at), 0, t);
          wind.schedule(until);
          cave.schedule(until);
        },
        stop: (t) => {
          wind.stop(t);
          cave.stop(t);
        },
      };
    }
    const def = REPAIR_SOUNDS.find((d) => d.id === id);
    if (def === undefined) throw new Error(`no repair sound ${id}`);
    def.play(e, at, 0, { gore: 2 });
    return { schedule: () => undefined, stop: () => undefined };
  }
  if (kind === 'launch') {
    // Stage 12: the launch's sounds and the chapter's end.
    const def = LAUNCH_SOUNDS.find((d) => d.id === id);
    if (def === undefined) throw new Error(`no launch sound ${id}`);
    def.play(e, at, 0, { gore: 2 });
    return { schedule: () => undefined, stop: () => undefined };
  }
  if (kind === 'work') {
    const def = HOME.find((d) => d.id === id);
    if (def === undefined) throw new Error(`no work sound ${id}`);
    def.play(e, at, 0, { gore: 2 });
    return { schedule: () => undefined, stop: () => undefined };
  }
  if (kind === 'fight') {
    // Stage 9: the fight's sounds (Book 11 section 07), the wet layers by the gore setting.
    const def = FIGHT.find((d) => d.id === id);
    if (def === undefined) throw new Error(`no fight sound ${id}`);
    def.play(e, at, 0, { gore: s.gore ?? 2 });
    return { schedule: () => undefined, stop: () => undefined };
  }
  if (kind === 'call') {
    const def = [...CALLS, ...PEOPLE, ...MISSILES, ...DISPUTES, ...ENDINGS].find(
      (d) => d.id === id,
    );
    if (def === undefined) throw new Error(`no call ${id}`);
    def.play(e, at, 0, { gore: 2 });
    return { schedule: () => undefined, stop: () => undefined };
  }
  if (kind === 'ambience') {
    const amb = new StrandAmbience(e);
    amb.setTide(s.tide ?? 0.5, at);
    amb.start(at);
    const wind = s.wind ?? STRAND_WIND.strength;
    return {
      ambience: amb,
      schedule: (until, now) => {
        // The gust at the listener follows the game's own wind field.
        for (let t = Math.max(at, now); t < until; t += 0.25) {
          const g = gustAt(STRAND_WIND, 640, 900, t - at);
          amb.setWind(wind, g, -STRAND_WIND.dirX, t);
        }
        amb.schedule(until);
      },
      stop: (t) => {
        amb.stop(t);
      },
    };
  }
  if (kind === 'sfx' || kind === 'tell') {
    const def = [...COMBAT, ...TELLS].find((d) => d.id === id);
    if (def === undefined) throw new Error(`no sound ${id}`);
    def.play(e, at, 0, { gore: s.gore ?? 2 });
    return { schedule: () => undefined, stop: () => undefined };
  }
  if (kind === 'step') {
    // A short walk on one surface: every step is drawn afresh, so no two are the same.
    if (!isSurface(id)) throw new Error(`no surface ${id}`);
    const gait = s.gait ?? 'walk';
    const n = s.steps ?? 8;
    for (let i = 0; i < n; i++)
      footstep(e, at + i * STEP_INTERVAL[gait], id, i % 2 === 0 ? -0.08 : 0.08, i, gait);
    return { schedule: () => undefined, stop: () => undefined };
  }
  if (kind === 'voice') {
    const line = BLIP_LINES.find((l) => l.speaker === id);
    if (line === undefined) throw new Error(`no voice ${id}`);
    speak(e, at, id, formatString(strings, line.key));
    return { schedule: () => undefined, stop: () => undefined };
  }
  if (kind === 'resident') {
    // Stage 8: every resident's voice, speaking the sound test's own line (decision S8-25).
    if (VOICES[id] === undefined) throw new Error(`no voice ${id}`);
    speak(e, at, id, formatString(strings, 'soundtest.line.resident'));
    return { schedule: () => undefined, stop: () => undefined };
  }
  throw new Error(`unknown item ${item}`);
}

/** The combat music's three strengths: the layers MUS_COMBAT_1, 2 and 3 start with. */
export const COMBAT_LEVELS: readonly (readonly [1 | 2 | 3, Readonly<Record<string, boolean>>])[] = [
  [1, { rhythm: true, melody: false, voice: false, danger: false }],
  [2, { rhythm: true, melody: true, voice: false, danger: false }],
  [3, { rhythm: true, melody: true, voice: true, danger: true }],
];

export interface RenderResult {
  readonly seconds: number;
  readonly peak: number;
  readonly rms: number;
  /** RMS of each second (to see where it is silent). */
  readonly perSecond: readonly number[];
  /** A 16-bit stereo WAV, base64, when asked for. */
  readonly wav?: string;
  /** For footsteps: each step measured, and how alike each step is to the one before. */
  readonly steps?: readonly StepMeasure[];
  readonly likeness?: readonly number[];
}

function wavBase64(buffer: AudioBuffer): string {
  const n = buffer.length;
  const ch = Math.min(2, buffer.numberOfChannels);
  const bytes = new Uint8Array(44 + n * ch * 2);
  const view = new DataView(bytes.buffer);
  const text = (o: number, str: string): void => {
    for (let i = 0; i < str.length; i++) view.setUint8(o + i, str.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + n * ch * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, ch, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * ch * 2, true);
  view.setUint16(32, ch * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, n * ch * 2, true);
  const data = [buffer.getChannelData(0), buffer.getChannelData(ch - 1)];
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c]?.[i] ?? 0));
      view.setInt16(44 + (i * ch + c) * 2, Math.round(v * 32767), true);
    }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Renders an item offline and measures it. */
export async function renderItem(
  strings: StringTable,
  item: string,
  seconds: number,
  settings: RenderSettings = {},
  withWav = false,
): Promise<RenderResult> {
  const rate = 32000;
  const ctx = new OfflineAudioContext(2, Math.round(seconds * rate), rate);
  const e = new SynthEngine(ctx);
  for (const bus of BUSES) e.setVolume(bus, DEFAULT_LEVELS[bus]);
  const run = startItem(e, strings, item, 0.05, settings);
  for (let t = 0.5; t <= seconds + 0.5; t += 0.5) run.schedule(t, t - 0.5);
  const buffer = await ctx.startRendering();
  let peak = 0;
  let sum = 0;
  const perSecond: number[] = [];
  let secSum = 0;
  for (let i = 0; i < buffer.length; i++) {
    let v = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const x = buffer.getChannelData(c)[i] ?? 0;
      peak = Math.max(peak, Math.abs(x));
      v += x * x;
    }
    sum += v / buffer.numberOfChannels;
    secSum += v / buffer.numberOfChannels;
    if ((i + 1) % rate === 0) {
      perSecond.push(Math.sqrt(secSum / rate));
      secSum = 0;
    }
  }
  let steps: StepMeasure[] | undefined;
  let alike: number[] | undefined;
  if (item.startsWith('step:')) {
    const gait = settings.gait ?? 'walk';
    const mono = buffer.getChannelData(0);
    const gap = Math.round(STEP_INTERVAL[gait] * rate);
    const first = Math.round(0.05 * rate);
    const count = settings.steps ?? 8;
    steps = [];
    alike = [];
    for (let i = 0; i < count; i++) {
      const start = first + i * gap;
      steps.push(measureStep(mono, start, gap, rate));
      if (i > 0)
        alike.push(likeness(mono.subarray(start - gap, start), mono.subarray(start, start + gap)));
    }
  }
  return {
    seconds,
    peak,
    rms: Math.sqrt(sum / buffer.length),
    perSecond,
    ...(withWav ? { wav: wavBase64(buffer) } : {}),
    ...(steps === undefined || alike === undefined ? {} : { steps, likeness: alike }),
  };
}

// ------------------------------------------------------------------ the live page

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== '') node.textContent = text;
  return node;
}

export function showSoundTest(root: HTMLElement, strings: StringTable): void {
  const t = (key: string, vars: Record<string, string> = {}): string =>
    formatString(strings, key, vars);
  let ctx: AudioContext | null = null;
  let engine: SynthEngine | null = null;
  const levels: Record<Bus, number> = { ...DEFAULT_LEVELS };
  let mono = false;
  let gore = 2;
  let running: { item: string; run: ReturnType<typeof startItem> } | null = null;
  const captions: { text: string; until: number }[] = [];
  const wind = { strength: STRAND_WIND.strength, tide: 0.5 };

  const audio = (): SynthEngine => {
    if (engine === null || ctx === null) {
      ctx = new AudioContext();
      engine = new SynthEngine(ctx);
      for (const bus of BUSES) engine.setVolume(bus, levels[bus]);
      engine.setMono(mono);
    }
    void ctx.resume();
    return engine;
  };
  const caption = (key: string, seconds = 4): void => {
    captions.push({ text: t(key), until: performance.now() + seconds * 1000 });
  };
  const stopRunning = (): void => {
    if (running !== null && ctx !== null) running.run.stop(ctx.currentTime);
    running = null;
    root.dataset['playing'] = '';
  };
  const play = (
    item: string,
    settings: RenderSettings = {},
    captionKey?: string,
  ): ReturnType<typeof startItem> => {
    const e = audio();
    stopRunning();
    const at = e.ctx.currentTime + 0.08;
    const run = startItem(e, strings, item, at, settings);
    running = { item, run };
    root.dataset['playing'] = item;
    if (captionKey !== undefined) caption(captionKey);
    return run;
  };
  const oneShot = (item: string, captionKey: string): void => {
    const e = audio();
    startItem(e, strings, item, e.ctx.currentTime + 0.03, { gore });
    caption(captionKey);
  };

  root.replaceChildren();
  root.append(el('h1', {}, t('ui.sound.title')), el('p', { class: 'note' }, t('ui.sound.intro')));

  // The mixer.
  const mixer = el('section', { 'aria-labelledby': 'mixer-h' });
  mixer.append(el('h2', { id: 'mixer-h' }, t('ui.sound.mixer')));
  const grid = el('div', { class: 'grid' });
  for (const bus of BUSES) {
    const label = el('label', {}, t(`ui.sound.bus.${bus}`));
    const input = el('input', {
      type: 'range',
      min: '0',
      max: '100',
      value: String(Math.round(levels[bus] * 100)),
      'data-bus': bus,
    });
    input.addEventListener('input', () => {
      levels[bus] = Number(input.value) / 100;
      engine?.setVolume(bus, levels[bus]);
    });
    label.append(input);
    grid.append(label);
  }
  const monoLabel = el('label', {}, t('ui.sound.mono'));
  const monoBox = el('input', { type: 'checkbox', 'data-mono': '' });
  monoBox.addEventListener('change', () => {
    mono = monoBox.checked;
    engine?.setMono(mono);
  });
  monoLabel.append(monoBox);
  grid.append(monoLabel);
  mixer.append(grid);
  root.append(mixer);

  // Music.
  const music = el('section');
  music.append(el('h2', {}, t('ui.sound.music')));
  const status = el('p', { class: 'status', 'aria-live': 'polite' });
  const pieceBlock = (
    id: string,
    titleKey: string,
    captionKey: string,
    extra?: (box: HTMLElement) => void,
  ): void => {
    const piece = PIECES[id];
    if (piece === undefined) return;
    const box = el('div');
    box.append(el('h3', {}, t(titleKey)));
    const playBtn = el('button', { 'data-play': `music:${id}` }, t('ui.sound.play'));
    const stopBtn = el('button', { 'data-stop': `music:${id}` }, t('ui.sound.stop'));
    playBtn.addEventListener('click', () => {
      const run = play(`music:${id}`, {}, captionKey);
      // Mirror the layer buttons into the new player.
      for (const b of box.querySelectorAll<HTMLButtonElement>('button[data-layer]')) {
        const layer = b.dataset['layer'] ?? '';
        const on = b.getAttribute('aria-pressed') === 'true';
        run.player?.setLayer(layer, on);
      }
      extra?.(box);
    });
    stopBtn.addEventListener('click', stopRunning);
    box.append(playBtn, stopBtn);
    if (id !== 'raid') {
      box.append(el('p', { class: 'note' }, t('ui.sound.layers')));
      for (const layer of piece.layers) {
        if (layer.on === false && id === 'skarvholm') continue;
        const b = el('button', { 'data-layer': layer.id, 'aria-pressed': 'true' }, layer.name);
        b.addEventListener('click', () => {
          const on = b.getAttribute('aria-pressed') !== 'true';
          b.setAttribute('aria-pressed', String(on));
          if (running?.item === `music:${id}`) running.run.player?.setLayer(layer.id, on);
        });
        box.append(b);
      }
    }
    extra?.(box);
    music.append(box);
  };
  pieceBlock('hearth', 'ui.sound.hearth', 'caption.music.hearth');
  pieceBlock('skarvholm', 'ui.sound.skarvholm', 'caption.music.skarvholm', (box) => {
    if (box.querySelector('[data-variant]') !== null) {
      const active = box.querySelector<HTMLButtonElement>('[data-variant][aria-pressed="true"]');
      if (running?.item === 'music:skarvholm')
        running.run.player?.setVariant(active?.dataset['variant'] ?? 'summer');
      return;
    }
    for (const v of ['summer', 'winter']) {
      const b = el(
        'button',
        { 'data-variant': v, 'aria-pressed': String(v === 'summer') },
        t(`ui.sound.${v}`),
      );
      b.addEventListener('click', () => {
        for (const o of box.querySelectorAll('[data-variant]'))
          o.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-pressed', 'true');
        if (running?.item === 'music:skarvholm') running.run.player?.setVariant(v);
      });
      box.append(b);
    }
  });
  pieceBlock('raid', 'ui.sound.raid', 'caption.music.raid_approach', (box) => {
    if (box.querySelector('[data-alarm]') !== null) {
      const on = box.querySelector('[data-alarm]')?.getAttribute('aria-pressed') === 'true';
      running?.run.player?.setLayer('alarm', on);
      running?.run.player?.setLayer('calm', !on);
      return;
    }
    const b = el('button', { 'data-alarm': '', 'aria-pressed': 'false' }, t('ui.sound.alarm'));
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      if (running?.item === 'music:raid') {
        // The alarm's drums take over from the heartbeat, on the next bar line.
        running.run.player?.setLayer('alarm', on);
        running.run.player?.setLayer('calm', !on);
        if (on) caption('caption.music.raid_alarm');
      }
    });
    box.append(b);
  });
  music.append(status);
  root.append(music);

  // Ambience.
  const amb = el('section');
  amb.append(el('h2', {}, t('ui.sound.ambience')), el('h3', {}, t('ui.sound.strand')));
  const ambPlay = el('button', { 'data-play': 'ambience:strand' }, t('ui.sound.play'));
  ambPlay.addEventListener('click', () => {
    play('ambience:strand', { wind: wind.strength, tide: wind.tide }, 'caption.amb.strand');
  });
  const ambStop = el('button', { 'data-stop': 'ambience:strand' }, t('ui.sound.stop'));
  ambStop.addEventListener('click', stopRunning);
  amb.append(ambPlay, ambStop);
  const gustText = el('p', { class: 'status' });
  const slider = (key: string, prop: 'strength' | 'tide', attr: string): void => {
    const label = el('label', {}, t(key));
    const input = el('input', {
      type: 'range',
      min: '0',
      max: '100',
      value: String(Math.round(wind[prop] * 100)),
      [attr]: '',
    });
    input.addEventListener('input', () => {
      wind[prop] = Number(input.value) / 100;
      const a = running?.run.ambience;
      if (a !== undefined && prop === 'tide') a.setTide(wind.tide);
    });
    label.append(input);
    amb.append(label);
  };
  slider('ui.sound.wind', 'strength', 'data-wind');
  slider('ui.sound.tide', 'tide', 'data-tide');
  amb.append(gustText);
  root.append(amb);

  // Combat.
  const combat = el('section');
  combat.append(el('h2', {}, t('ui.sound.combat')));
  const goreLabel = el('label', {}, t('ui.sound.gore'));
  const goreSel = el('select', { 'data-gore': '' });
  for (const g of [0, 1, 2]) {
    const o = el('option', { value: String(g) }, t(`ui.sound.gore.${g}`));
    if (g === gore) o.selected = true;
    goreSel.append(o);
  }
  goreSel.addEventListener('change', () => {
    gore = Number(goreSel.value);
  });
  goreLabel.append(goreSel);
  combat.append(goreLabel, el('br'));
  const soundButton = (box: HTMLElement, def: SoundDef, labelKey: string, kind: string): void => {
    const b = el('button', { 'data-sound': def.id }, t(labelKey));
    b.addEventListener('click', () => {
      oneShot(`${kind}:${def.id}`, def.captionKey);
    });
    box.append(b);
  };
  const combatKeys: Readonly<Record<string, string>> = {
    SFX_HIT_LIGHT: 'ui.sound.sfx.hit_light',
    SFX_CHARGE_LEVEL_1: 'ui.sound.sfx.charge_level_1',
    SFX_CHARGE_LEVEL_2: 'ui.sound.sfx.charge_level_2',
    SFX_PARRY: 'ui.sound.sfx.parry',
    SFX_BLOCK: 'ui.sound.sfx.block',
    SFX_GUARD_BREAK: 'ui.sound.sfx.guard_break',
  };
  for (const def of COMBAT) soundButton(combat, def, combatKeys[def.id] ?? def.id, 'sfx');
  root.append(combat);

  // Tells.
  const tells = el('section');
  tells.append(el('h2', {}, t('ui.sound.tells')));
  const tellKeys: Readonly<Record<string, string>> = {
    SFX_TELL_RAN: 'ui.sound.tell.ran',
    SFX_TELL_MANANNAN: 'ui.sound.tell.manannan',
    SFX_TELL_DRAUGR: 'ui.sound.tell.draugr',
  };
  for (const def of TELLS) soundButton(tells, def, tellKeys[def.id] ?? def.id, 'tell');
  root.append(tells);

  // The horn, the stingers and the hearth fire, as the game plays them (decision AU-11).
  const calls = el('section');
  calls.append(el('h2', {}, t('ui.sound.calls')));
  const callKeys: Readonly<Record<string, string>> = {
    SFX_HORN: 'ui.sound.call.horn',
    MUS_STINGER_HORN: 'ui.sound.call.stinger_horn',
    MUS_STINGER_DISCOVERY: 'ui.sound.call.stinger_discovery',
    SFX_SPLASH: 'ui.sound.call.splash',
    SFX_BOW_DRAW: 'ui.sound.call.bow_draw',
    SFX_BOW_LOOSE: 'ui.sound.call.bow_loose',
    SFX_ARROW_FLIGHT: 'ui.sound.call.arrow_flight',
    SFX_ARROW_WOOD: 'ui.sound.call.arrow_wood',
    SFX_ARROW_SHIELD: 'ui.sound.call.arrow_shield',
    SFX_ARROW_EARTH: 'ui.sound.call.arrow_earth',
    SFX_ARROW_STONE: 'ui.sound.call.arrow_stone',
    SFX_ARROW_WATER: 'ui.sound.call.arrow_water',
    SFX_QUIVER_EMPTY: 'ui.sound.call.quiver_empty',
    SFX_PICKUP: 'ui.sound.call.pickup',
  };
  for (const def of [...CALLS, ...PEOPLE, ...MISSILES])
    soundButton(calls, def, callKeys[def.id] ?? def.id, 'call');
  const firePlay = el('button', { 'data-play': 'ambience:hearth' }, t('ui.sound.call.hearth'));
  firePlay.addEventListener('click', () => {
    play('ambience:hearth', {}, 'caption.amb.hearth');
  });
  const fireStop = el('button', { 'data-stop': 'ambience:hearth' }, t('ui.sound.stop'));
  fireStop.addEventListener('click', stopRunning);
  calls.append(el('br'), firePlay, fireStop);
  root.append(calls);

  // Home (Stage 7): the steading's life by time of day, and the work, fire and sleep sounds. Its
  // buttons carry their own data attributes, so the counts of the sections above stay as they are.
  const home = el('section');
  home.append(el('h2', {}, t('ui.sound.home')), el('h3', {}, t('ui.sound.home.life')));
  for (const phase of ['dawn', 'day', 'dusk', 'night'] as const) {
    const b = el('button', { 'data-home-play': `home:${phase}` }, t(`ui.sound.home.${phase}`));
    b.addEventListener('click', () => {
      play(`home:${phase}`, {}, `caption.amb.home_${phase}`);
    });
    home.append(b);
  }
  const homeStop = el('button', { 'data-home-stop': '' }, t('ui.sound.stop'));
  homeStop.addEventListener('click', stopRunning);
  home.append(homeStop, el('h3', {}, t('ui.sound.home.work')));
  for (const def of HOME) {
    const b = el('button', { 'data-home-sound': def.id }, t(def.captionKey));
    b.addEventListener('click', () => {
      oneShot(`work:${def.id}`, def.captionKey);
    });
    home.append(b);
  }
  root.append(home);

  // The fight (Stage 9): the combat music at its three strengths (the layers of MUS_COMBAT_1/2/3
  // in content/audio.json), the fight's sounds by the gore setting above, and game over's stinger.
  // Its buttons carry their own data attributes, so the counts of the sections above stay as they are.
  const fight = el('section');
  fight.append(el('h2', {}, t('ui.sound.fight')), el('h3', {}, t('ui.sound.fight.music')));
  for (const [n, layers] of COMBAT_LEVELS) {
    const b = el('button', { 'data-fight-play': `combat:${n}` }, t(`caption.music.combat_${n}`));
    b.addEventListener('click', () => {
      play('music:combat', { layers }, `caption.music.combat_${n}`);
    });
    fight.append(b);
  }
  const fightStop = el('button', { 'data-fight-stop': '' }, t('ui.sound.stop'));
  fightStop.addEventListener('click', stopRunning);
  fight.append(fightStop, el('h3', {}, t('ui.sound.fight.sounds')));
  for (const def of FIGHT) {
    const b = el('button', { 'data-fight-sound': def.id }, t(def.captionKey));
    b.addEventListener('click', () => {
      oneShot(`fight:${def.id}`, def.captionKey);
    });
    fight.append(b);
  }
  for (const def of ENDINGS) {
    const b = el('button', { 'data-fight-sound': def.id }, t(def.captionKey));
    b.addEventListener('click', () => {
      oneShot(`call:${def.id}`, def.captionKey);
    });
    fight.append(b);
  }
  root.append(fight);

  // The southern island (Stage 10): its own buttons and data attributes, so the sections above
  // keep their counts.
  const south = el('section');
  south.append(el('h2', {}, t('ui.sound.south')));
  for (const [item, key] of [
    ['south:spring', 'caption.amb.kelda'],
    ['south:gale', 'caption.amb.hagseat'],
    ['south:fold', 'caption.amb.cairn'],
  ] as const) {
    const b = el('button', { 'data-south-play': item }, t(key));
    b.addEventListener('click', () => {
      play(item, {}, key);
    });
    south.append(b);
  }
  const southStop = el('button', { 'data-south-stop': '' }, t('ui.sound.stop'));
  southStop.addEventListener('click', stopRunning);
  const tell = el(
    'button',
    { 'data-south-sound': 'SFX_TELL_CAILLEACH' },
    t('caption.tell.cailleach'),
  );
  tell.addEventListener('click', () => {
    oneShot('south:SFX_TELL_CAILLEACH', 'caption.tell.cailleach');
  });
  south.append(southStop, tell);
  root.append(south);
  // Stage 11: the boat's repairs, Seal Cave and Thorkel's rites, in a section of their own.
  const repairs = el('section');
  repairs.append(el('h2', {}, t('ui.sound.repairs')));
  const cave = el('button', { 'data-repairs-play': 'repairs:sealcave' }, t('caption.amb.sealcave'));
  cave.addEventListener('click', () => {
    play('repairs:sealcave', {}, 'caption.amb.sealcave');
  });
  repairs.append(cave);
  for (const def of REPAIR_SOUNDS) {
    const b = el('button', { 'data-repairs-sound': def.id }, t(def.captionKey));
    b.addEventListener('click', () => {
      oneShot(`repairs:${def.id}`, def.captionKey);
    });
    repairs.append(b);
  }
  const repairsStop = el('button', { 'data-repairs-stop': '' }, t('ui.sound.stop'));
  repairsStop.addEventListener('click', stopRunning);
  repairs.append(repairsStop);
  root.append(repairs);
  // Stage 12: the launch's music (the Ship theme, note data) and sounds, in a section of their own.
  const launch = el('section');
  launch.append(el('h2', {}, t('ui.sound.launch')));
  const shipTheme = el('button', { 'data-launch-play': 'music:ship' }, t('caption.music.launch'));
  shipTheme.addEventListener('click', () => {
    play('music:ship', {}, 'caption.music.launch');
  });
  launch.append(shipTheme);
  for (const def of LAUNCH_SOUNDS) {
    const b = el('button', { 'data-launch-sound': def.id }, t(def.captionKey));
    b.addEventListener('click', () => {
      oneShot(`launch:${def.id}`, def.captionKey);
    });
    launch.append(b);
  }
  const launchStop = el('button', { 'data-launch-stop': '' }, t('ui.sound.stop'));
  launchStop.addEventListener('click', stopRunning);
  launch.append(launchStop);
  root.append(launch);

  // Footsteps: compare the surfaces, walking, running, sneaking or carrying.
  const feet = el('section');
  feet.append(
    el('h2', {}, t('ui.sound.footsteps')),
    el('p', { class: 'note' }, t('ui.sound.footsteps_note')),
  );
  let gait: Gait = 'walk';
  const gaitLabel = el('label', {}, t('ui.sound.gait'));
  const gaitSel = el('select', { 'data-gait': '' });
  for (const g of ['walk', 'run', 'sneak', 'carry'] as const) {
    const o = el('option', { value: g }, t(`ui.sound.gait.${g}`));
    if (g === gait) o.selected = true;
    gaitSel.append(o);
  }
  gaitSel.addEventListener('change', () => {
    gait = gaitSel.value as Gait;
  });
  gaitLabel.append(gaitSel);
  feet.append(gaitLabel, el('br'));
  let stepCount = 0;
  const walk = (surfaces: readonly (typeof SURFACES)[number][], each: number): void => {
    const e = audio();
    let at = e.ctx.currentTime + 0.05;
    for (const surface of surfaces) {
      caption(`caption.sfx.footsteps.${surface}`, (each * STEP_INTERVAL[gait]) / 1 + 1);
      for (let i = 0; i < each; i++) {
        footstep(e, at, surface, stepCount % 2 === 0 ? -0.08 : 0.08, stepCount, gait);
        stepCount++;
        at += STEP_INTERVAL[gait];
      }
    }
  };
  for (const surface of SURFACES) {
    const b = el('button', { 'data-step': surface }, t(`ui.sound.surface.${surface}`));
    b.addEventListener('click', () => {
      walk([surface], 6);
    });
    feet.append(b);
  }
  const across = el('button', { 'data-step-all': '' }, t('ui.sound.walk_all'));
  across.addEventListener('click', () => {
    walk(SURFACES, 4);
  });
  feet.append(el('br'), across);
  root.append(feet);

  // Voice blips.
  const voices = el('section');
  voices.append(
    el('h2', {}, t('ui.sound.voices')),
    el('p', { class: 'note' }, t('ui.sound.voices_note')),
  );
  for (const line of BLIP_LINES) {
    if (VOICES[line.speaker] === undefined) continue;
    const row = el('div');
    const id = line.speaker.toLowerCase();
    const name = strings.has(`person.short.${id}`)
      ? t(`person.short.${id}`)
      : t(`person.name.${id}`);
    const b = el('button', { 'data-voice': line.speaker }, name);
    const text = formatString(strings, line.key);
    b.addEventListener('click', () => {
      const e = audio();
      speak(e, e.ctx.currentTime + 0.03, line.speaker, text);
      captions.push({
        text: t('caption.format.subtitle', { speaker: name, line: text }),
        until: performance.now() + 5000,
      });
    });
    row.append(b, el('span', { class: 'line' }, text));
    voices.append(row);
  }
  root.append(voices);

  // Captions.
  const capBox = el('section');
  capBox.append(el('h2', {}, t('ui.sound.captions')));
  const capList = el('div', { id: 'captions', 'aria-live': 'polite' });
  capBox.append(capList);
  root.append(capBox);

  // The clock: schedule ahead, follow the wind, show the bar.
  window.setInterval(() => {
    if (ctx === null) return;
    const now = ctx.currentTime;
    if (running !== null) {
      if (running.run.ambience !== undefined) {
        // The live wind strength slider.
        running.run.ambience.setWind(
          wind.strength,
          gustAt(STRAND_WIND, 640, 900, now),
          -STRAND_WIND.dirX,
        );
      }
      running.run.schedule(now + 0.4, now);
      const p = running.run.player;
      if (p !== undefined) {
        const bar = Math.floor((now - p.startTime) / p.barSeconds) % p.piece.bars;
        status.textContent = t('ui.sound.bar', {
          bar: String(Math.max(0, bar) + 1),
          bars: String(p.piece.bars),
          voices: String(Math.min(MUSIC_VOICES, engine?.voicesAt(now) ?? 0)),
        });
        root.dataset['bar'] = String(bar + 1);
      } else status.textContent = '';
    }
    gustText.textContent = t('ui.sound.gust', {
      gust: gustAt(STRAND_WIND, 640, 900, now).toFixed(2),
    });
    const ms = performance.now();
    for (let i = captions.length - 1; i >= 0; i--)
      if ((captions[i]?.until ?? 0) < ms) captions.splice(i, 1);
    capList.replaceChildren(...captions.slice(-4).map((c) => el('p', {}, c.text)));
  }, 50);

  (window as unknown as { oeSound: unknown }).oeSound = {
    items: [
      'music:hearth',
      'music:skarvholm',
      'music:raid',
      'ambience:strand',
      ...COMBAT.map((d) => `sfx:${d.id}`),
      ...TELLS.map((d) => `tell:${d.id}`),
      ...BLIP_LINES.map((l) => `voice:${l.speaker}`),
      ...SURFACES.map((surface) => `step:${surface}`),
      ...CALLS.map((d) => `call:${d.id}`),
      ...PEOPLE.map((d) => `call:${d.id}`),
      ...MISSILES.map((d) => `call:${d.id}`),
      'ambience:hearth',
    ],
    /** Stage 8's items: every resident's voice and the dispute stingers, listed apart likewise. */
    peopleItems: [
      ...Object.keys(VOICES).map((id) => `resident:${id}`),
      ...DISPUTES.map((d) => `call:${d.id}`),
    ],
    /** Stage 9's fight items: the combat music, the fight's sounds and game over, listed apart. */
    fightItems: [
      ...COMBAT_LEVELS.map(([n]) => `combat:${n}`),
      ...FIGHT.map((d) => `fight:${d.id}`),
      ...ENDINGS.map((d) => `call:${d.id}`),
    ],
    /** Stage 10's southern island: the spring, the gale, the fold and the Hag's Seat's tell. */
    southItems: ['south:spring', 'south:gale', 'south:fold', 'south:SFX_TELL_CAILLEACH'],
    /** Stage 11: Seal Cave, and every repair, fitting and rite sound, and the lament. */
    repairItems: ['repairs:sealcave', ...REPAIR_SOUNDS.map((d) => `repairs:${d.id}`)],
    /** Stage 12: the launch's music and sounds, and the chapter's end. */
    launchItems: ['music:ship', ...LAUNCH_SOUNDS.map((d) => `launch:${d.id}`)],
    /** Stage 7's home items, listed apart so the page's earlier item count stays as it was. */
    homeItems: [
      ...(['dawn', 'day', 'dusk', 'night'] as const).map((p) => `home:${p}`),
      ...HOME.map((d) => `work:${d.id}`),
    ],
    render: (item: string, seconds: number, settings?: RenderSettings, wav?: boolean) =>
      renderItem(strings, item, seconds, settings, wav),
  };
  root.dataset['state'] = 'ready';
}
