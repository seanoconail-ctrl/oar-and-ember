/**
 * The sound test page (sound.html; Book 11, generated audio, step 1): every tune, ambience,
 * effect, tell and voice blip the game generates, to listen to and judge before it is wired into
 * play. Music layers and seasons switch on the next bar line, as in the game.
 *
 * The page also exposes `window.oeSound.render(item, seconds)`, which renders any item offline
 * (an OfflineAudioContext) and returns its levels and a WAV: the browser tests and
 * `npm run audio:render` use it to check every sound without a speaker.
 */
import hearthJson from '../../content/music/hearth.json';
import raidJson from '../../content/music/raid.json';
import skarvholmJson from '../../content/music/skarvholm.json';
import { StrandAmbience } from '../audio/synth/ambience.ts';
import { BUSES, MUSIC_VOICES, SynthEngine } from '../audio/synth/engine.ts';
import type { Bus } from '../audio/synth/engine.ts';
import type { Piece } from '../audio/synth/notation.ts';
import { PiecePlayer } from '../audio/synth/sequencer.ts';
import { COMBAT, TELLS } from '../audio/synth/sfx.ts';
import type { SoundDef } from '../audio/synth/sfx.ts';
import { speak, VOICES } from '../audio/synth/voice.ts';
import { formatString } from '../content/strings.ts';
import type { StringTable } from '../content/strings.ts';
import { gustAt, STRAND_WIND } from '../render/wind.ts';

export const PIECES: Readonly<Record<string, Piece>> = {
  hearth: hearthJson,
  skarvholm: skarvholmJson,
  raid: raidJson,
};

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
  if (kind === 'voice') {
    const line = BLIP_LINES.find((l) => l.speaker === id);
    if (line === undefined) throw new Error(`no voice ${id}`);
    speak(e, at, id, formatString(strings, line.key));
    return { schedule: () => undefined, stop: () => undefined };
  }
  throw new Error(`unknown item ${item}`);
}

export interface RenderResult {
  readonly seconds: number;
  readonly peak: number;
  readonly rms: number;
  /** RMS of each second (to see where it is silent). */
  readonly perSecond: readonly number[];
  /** A 16-bit stereo WAV, base64, when asked for. */
  readonly wav?: string;
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
  return {
    seconds,
    peak,
    rms: Math.sqrt(sum / buffer.length),
    perSecond,
    ...(withWav ? { wav: wavBase64(buffer) } : {}),
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
    ],
    render: (item: string, seconds: number, settings?: RenderSettings, wav?: boolean) =>
      renderItem(strings, item, seconds, settings, wav),
  };
  root.dataset['state'] = 'ready';
}
