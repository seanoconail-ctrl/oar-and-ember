/**
 * The visual state of an on-foot zone (Book 7 section 14): everything that moves for the eye
 * alone and needs memory from one frame to the next. The camera's smooth follow with look-ahead
 * and shake, the drawn tide easing between the simulation's states, sand drying after the water,
 * footprints, dust, splashes and ripples, blown sand, spray on the rocks, midges, the steerer's
 * idles, and the sky (sun, cloud, grade) by the time of day.
 *
 * Nothing here is simulation: it reads the simulation's view each frame and is never saved. It
 * uses its own deterministic noise, never Math.random, so a capture is repeatable.
 */
import { hash01 } from '../render/noise.ts';
import { heightAt, streamAt, swashAt, tideHeight, waterDepthAt } from '../render/elevation.ts';
import type { Elevation } from '../render/elevation.ts';
import { TILE } from '../render/autotile.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport.ts';
import { gustAt, STRAND_WIND } from '../render/wind.ts';
import type { Wind } from '../render/wind.ts';
import type { OnFootState } from '../sim/land/onFoot.ts';
import type { ZoneMap } from '../sim/land/zoneMap.ts';
import { clampCamera, FX_SHEET } from './zoneScene.ts';
import type { SheetAnims, VisualMark, ZoneVisualView } from './zoneScene.ts';

/** The ground a foot lands on, for prints, dust and footstep sounds. */
export type Surface = 'water' | 'wet_sand' | 'sand' | 'shingle' | 'grass' | 'rock';

export interface SkyInput {
  readonly minuteOfDay: number;
  readonly lightFrom: number;
  readonly darkFrom: number;
}

interface Particle {
  kind: 'spray' | 'sand' | 'dust' | 'ripple' | 'midge';
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  /** Height above the ground (spray), drawn above its foot line. */
  z: number;
  vz: number;
}

interface Print {
  x: number;
  y: number;
  age: number;
  wet: boolean;
}

export interface FrameInput {
  readonly dt: number;
  readonly tick: number;
  readonly onFoot: OnFootState;
  readonly tide: {
    readonly minutesToLowWater: number;
    readonly minutesSinceLowWater: number;
    readonly tidalGroundOpen: boolean;
  };
  readonly sky: SkyInput;
  readonly anims: SheetAnims;
  readonly steererSheet: string;
}

const MAX_PRINTS = 80;
const MAX_PARTICLES = 220;
const PRINT_LIFE = 24;

export class ZoneVisuals {
  readonly map: ZoneMap;
  readonly elevation: Elevation;
  readonly wind: Wind = STRAND_WIND;
  reducedMotion: boolean;
  /** Effect detail (2 full, 1 lite, 0 low): the play view steps it down on a slow machine. */
  detail: 0 | 1 | 2 = 2;
  seconds = 0;
  #cam = { x: 0, y: 0 };
  #look = { x: 0, y: 0 };
  #camOffset = { x: 0, y: 0 };
  #shake = 0;
  #shakeT = 0;
  #tide = -1;
  /** The drawn tide's height, 0 (low) to 1 (high), for the ambience (-1 before the first frame). */
  get tideLevel(): number {
    return this.#tide;
  }
  #wetTo = 0;
  #prints: Print[] = [];
  #particles: Particle[] = [];
  #lastStep = -1;
  #last = { x: 0, y: 0 };
  #idleSince = 0;
  #spawnN = 0;
  /** Rock edges the sea breaks on, in world pixels. */
  readonly #breakers: { x: number; y: number }[] = [];
  /** Called on each footfall with the surface it lands on (for footstep sounds). */
  onStep: ((surface: Surface, x: number) => void) | null = null;

  constructor(map: ZoneMap, elevation: Elevation, reducedMotion: boolean) {
    this.map = map;
    this.elevation = elevation;
    this.reducedMotion = reducedMotion;
    for (let ty = 0; ty < map.height; ty++) {
      const row = map.rows[ty] ?? '';
      for (let tx = 0; tx < map.width; tx++) {
        if (row[tx] !== 'r') continue;
        const sea = [map.rows[ty + 1]?.[tx], map.rows[ty - 1]?.[tx], row[tx + 1], row[tx - 1]];
        if (sea.includes('~')) this.#breakers.push({ x: tx * TILE + 12, y: ty * TILE + 14 });
      }
    }
  }

  /** A camera shake, e.g. on a hit (Book 7 section 14, camera feel). Ignored with reduced motion. */
  shake(amount: number): void {
    if (!this.reducedMotion) this.#shake = Math.max(this.#shake, amount);
  }

  #rand(): number {
    this.#spawnN++;
    return hash01(this.#spawnN, 7919);
  }

  /** What is underfoot at world pixel (x, y) now. */
  surfaceAt(x: number, y: number): Surface {
    const e = heightAt(this.elevation, x, y);
    const tide = Math.max(0, this.#tide);
    if (
      streamAt(this.elevation, x, y) ||
      waterDepthAt(this.elevation, x, y, tide, this.seconds) > 0
    )
      return 'water';
    const code = this.map.rows[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] ?? ',';
    if (code === 'r') return 'rock';
    if (e <= 1) return e < this.#wetTo + 0.03 ? 'wet_sand' : 'sand';
    if (code === '.') return 'shingle';
    return 'grass';
  }

  #emit(p: Omit<Particle, 'age'>): void {
    if (this.#particles.length >= MAX_PARTICLES) this.#particles.shift();
    this.#particles.push({ ...p, age: 0 });
  }

  update(input: FrameInput): void {
    const dt = Math.min(0.1, Math.max(0, input.dt));
    this.seconds += dt;
    const t = this.seconds;
    const p = input.onFoot.player;

    // The drawn tide eases towards the simulation's (a flood takes a few seconds to arrive).
    const goal = tideHeight(
      input.tide.minutesToLowWater,
      input.tide.minutesSinceLowWater,
      input.tide.tidalGroundOpen,
    );
    this.#tide =
      this.#tide < 0 ? goal : this.#tide + (goal - this.#tide) * (1 - Math.exp(-dt * 0.6));
    // Sand stays wet where the water has been, drying over a couple of minutes.
    this.#wetTo = Math.max(this.#tide, this.#wetTo - dt * 0.0015);

    // Camera: smooth follow with a look-ahead in the direction of travel, snapped so the steerer
    // keeps a whole-pixel place on screen while walking (no jitter).
    const vx = (p.x - this.#last.x) / Math.max(dt, 1e-3);
    const vy = (p.y - this.#last.y) / Math.max(dt, 1e-3);
    const moving = p.moving && Math.hypot(vx, vy) > 1;
    const lookGoal = moving
      ? { x: Math.max(-44, Math.min(44, vx * 0.7)), y: Math.max(-26, Math.min(26, vy * 0.45)) }
      : { x: this.#look.x * 0.6, y: this.#look.y * 0.6 };
    const lk = 1 - Math.exp(-dt * 1.6);
    this.#look.x += (lookGoal.x - this.#look.x) * lk;
    this.#look.y += (lookGoal.y - this.#look.y) * lk;
    const target = {
      x: p.x + this.#look.x - LOGICAL_WIDTH / 2,
      y: p.y - 20 + this.#look.y - LOGICAL_HEIGHT / 2,
    };
    const first = this.#last.x === 0 && this.#last.y === 0;
    const ck = first ? 1 : 1 - Math.exp(-dt * 5);
    this.#cam.x += (target.x - this.#cam.x) * ck;
    this.#cam.y += (target.y - this.#cam.y) * ck;
    // The offset from the steerer is what is rounded, so both move together by whole pixels.
    this.#camOffset = {
      x: Math.round(this.#cam.x - p.x),
      y: Math.round(this.#cam.y - p.y),
    };
    this.#last = { x: p.x, y: p.y };
    this.#shake *= Math.exp(-dt * 9);
    this.#shakeT += dt;

    // Footfalls: at each contact frame of the gait cycle.
    const gaitState = input.onFoot.carrying !== null || p.gait === 'carry' ? 'carry' : p.gait;
    const anim = input.anims.get(input.steererSheet)?.[gaitState];
    if (p.moving && anim !== undefined) {
      const frame = Math.floor(input.tick / anim.ticks) % anim.frames;
      const contact = Math.floor(frame / (anim.frames / 2));
      if (frame % (anim.frames / 2) === 0 && contact !== this.#lastStep) {
        this.#lastStep = contact;
        this.#footfall(p.x, p.y, contact, gaitState);
      }
      this.#idleSince = t;
    } else {
      this.#lastStep = -1;
      if (p.moving) this.#idleSince = t;
    }
    // Ripples round anyone standing in water.
    const people = [p, ...Object.values(input.onFoot.actors).filter((a) => a.pose !== 'carried')];
    for (const a of people) {
      if (this.surfaceAt(a.x, a.y) === 'water' && this.#rand() < dt * (p.moving ? 3 : 1.2))
        this.#emit({ kind: 'ripple', x: a.x, y: a.y + 1, vx: 0, vy: 0, life: 0.9, z: 0, vz: 0 });
    }

    // Spray where the sea breaks on the rocks, at the top of each swash.
    for (const b of this.#breakers) {
      if (!this.#near(b.x, b.y, 40)) continue;
      const s = swashAt(b.x, t);
      if (s > 0.06 && this.#rand() < dt * 4) {
        for (let k = 0; k < 3; k++) {
          this.#emit({
            kind: 'spray',
            x: b.x + (this.#rand() - 0.5) * 18,
            y: b.y + 4,
            vx: (this.#rand() - 0.5) * 14 + this.wind.dirX * 8,
            vy: (this.#rand() - 0.5) * 4,
            z: 2,
            vz: 26 + this.#rand() * 22,
            life: 0.9,
          });
        }
      }
    }
    // Sand lifting off the dry beach in the gusts, and midges in the lee by the stream.
    const reduced = this.reducedMotion ? 0.4 : 1;
    for (let k = 0; k < 3; k++) {
      const x = this.#cam.x + this.#rand() * LOGICAL_WIDTH;
      const y = this.#cam.y + this.#rand() * LOGICAL_HEIGHT;
      const e = heightAt(this.elevation, x, y);
      const g = gustAt(this.wind, x, y, t);
      if (e > this.#wetTo + 0.12 && e <= 1 && g > 0.45 && this.#rand() < dt * 30 * g * reduced) {
        this.#emit({
          kind: 'sand',
          x,
          y,
          vx: this.wind.dirX * (50 + 40 * g),
          vy: this.wind.dirY * (50 + 40 * g),
          z: 1,
          vz: 3,
          life: 1.1,
        });
      }
      if (e > 1.02 && e < 1.3 && g < 0.15 && this.#rand() < dt * 6 * reduced) {
        const nearStream =
          streamAt(this.elevation, x + 30, y) || streamAt(this.elevation, x - 30, y);
        if (nearStream) this.#emit({ kind: 'midge', x, y, vx: 0, vy: 0, z: 10, vz: 0, life: 2.6 });
      }
    }

    for (const q of this.#particles) {
      q.age += dt;
      if (q.kind === 'midge') {
        q.x += Math.sin(t * 7 + q.y) * 0.4;
        q.y += Math.cos(t * 5.3 + q.x) * 0.25;
        continue;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      if (q.kind === 'spray') q.vz -= 70 * dt;
      if (q.z < 0) q.z = 0;
    }
    this.#particles = this.#particles.filter((q) => q.age < q.life);
    for (const pr of this.#prints) pr.age += dt;
    // Prints fade; wet prints go when the water reaches them.
    this.#prints = this.#prints.filter(
      (pr) =>
        pr.age < PRINT_LIFE &&
        waterDepthAt(this.elevation, pr.x, pr.y, this.#tide, t) <= 0 &&
        !streamAt(this.elevation, pr.x, pr.y),
    );
  }

  #near(x: number, y: number, margin: number): boolean {
    return (
      x > this.#cam.x - margin &&
      y > this.#cam.y - margin &&
      x < this.#cam.x + LOGICAL_WIDTH + margin &&
      y < this.#cam.y + LOGICAL_HEIGHT + margin
    );
  }

  #footfall(x: number, y: number, foot: number, gait: string): void {
    const side = foot === 0 ? -3 : 3;
    const surface = this.surfaceAt(x, y);
    this.onStep?.(surface, x);
    if (surface === 'sand' || surface === 'wet_sand') {
      if (this.#prints.length >= MAX_PRINTS) this.#prints.shift();
      this.#prints.push({
        x: x + side * 0.6,
        y: y - 1 + (foot === 0 ? 0 : 1),
        age: 0,
        wet: surface === 'wet_sand',
      });
    }
    if (surface === 'water') {
      for (let k = 0; k < 2; k++)
        this.#emit({
          kind: 'spray',
          x: x + side,
          y,
          vx: (this.#rand() - 0.5) * 20,
          vy: 0,
          z: 1,
          vz: 18 + this.#rand() * 14,
          life: 0.5,
        });
    } else if ((surface === 'sand' || surface === 'shingle') && gait === 'run') {
      this.#emit({
        kind: 'dust',
        x: x + side,
        y,
        vx: -this.wind.dirX * -10,
        vy: 0,
        z: 1,
        vz: 5,
        life: 0.45,
      });
    }
  }

  /** The steerer's idle: a breath, a look round now and then, and bracing in a strong gust. */
  #idle(p: { x: number; y: number; moving: boolean }, anims: SheetAnims, sheet: string) {
    if (p.moving) return null;
    const t = this.seconds;
    const g = gustAt(this.wind, p.x, p.y, t);
    const a = anims.get(sheet);
    const pick = (state: string, rate: number): { state: string; frame: number } => {
      const anim = a?.[state];
      const n = anim?.frames ?? 1;
      return { state, frame: Math.floor(t * rate) % n };
    };
    if (g > 0.55 && a?.['idlewind'] !== undefined) return pick('idlewind', 60 / 9);
    const still = t - this.#idleSince;
    if (still > 3 && Math.floor((still - 3) / 2.2) % 3 === 1 && a?.['look'] !== undefined)
      return pick('look', 60 / 22);
    return pick('idle', 60 / 15);
  }

  /** The sky by the time of day: the sun's cast-shadow direction, cloud, light shafts and grade. */
  static sky(input: SkyInput, clouds: number): ZoneVisualView['effects'] & object {
    const span = Math.max(1, input.darkFrom - input.lightFrom);
    const f = (input.minuteOfDay - input.lightFrom) / span;
    const up = f > 0 && f < 1 ? Math.sin(Math.PI * f) : 0;
    const low = 1 - up;
    const length = 0.35 + 1.5 * low * low;
    const strength = f > 0 && f < 1 ? Math.min(1, up * 5) * (1 - 0.45 * clouds) : 0;
    // Low sun warms the light and cools the shadows; a clear midday is neutral.
    const warm = f > 0 && f < 1 ? low * low : 0;
    const dawnMist = f > -0.05 && f < 0.12 ? 0.16 * (1 - Math.abs(f - 0.02) / 0.12) : 0;
    return {
      water: null,
      sun: {
        x: -Math.cos(Math.PI * Math.max(0, Math.min(1, f))) * length,
        y: -0.3 * length,
        strength,
      },
      clouds,
      grade: {
        gain: [1 + 0.04 * warm, 1, 1 - 0.05 * warm],
        lift: [2 * warm, 3 * warm, 8 * warm],
      },
      // Shafts of light only while the sun is up and low, through broken cloud.
      shafts: f > 0 && f < 1 ? Math.max(0, 0.9 * low - 0.1) * (1 - clouds * 0.5) : 0,
      flash: 0,
      fog: Math.max(0, dawnMist),
    };
  }

  /** The visual view for this frame (after `update`). */
  view(input: FrameInput): ZoneVisualView {
    const p = input.onFoot.player;
    const shakeX = Math.round(Math.sin(this.#shakeT * 61) * this.#shake);
    const shakeY = Math.round(Math.cos(this.#shakeT * 47) * this.#shake);
    const cam = clampCamera(
      this.map,
      Math.round(p.x) + this.#camOffset.x + shakeX,
      Math.round(p.y) + this.#camOffset.y + shakeY,
    );
    const marks: VisualMark[] = [];
    for (const pr of this.#prints) {
      // Old dry prints soften: drawn on alternate frames of a dither as they fade.
      if (pr.age > PRINT_LIFE * 0.6 && (Math.floor(pr.x) + Math.floor(pr.y)) % 2 === 0) continue;
      marks.push({
        sheet: FX_SHEET,
        frame: `${pr.wet ? 'print_wet' : 'print_dry'}/-/0`,
        x: pr.x,
        y: pr.y,
        layer: 'decal',
      });
    }
    for (const q of this.#particles) {
      const frames = q.kind === 'midge' ? 2 : 3;
      const i =
        q.kind === 'midge'
          ? Math.floor(this.seconds * 6 + q.x) % 2
          : Math.min(frames - 1, Math.floor((q.age / q.life) * frames));
      marks.push({
        sheet: FX_SHEET,
        frame: `${q.kind}/-/${i}`,
        x: q.x,
        y: q.y - q.z,
        layer: 'actor',
        // A ripple lies on the water just behind the feet it rings; spray sorts with its foot.
        sort: q.kind === 'ripple' ? q.y - 1.5 : q.y + 0.5,
      });
    }
    const sky = ZoneVisuals.sky(input.sky, 0.55);
    return {
      camera: cam,
      seconds: this.seconds,
      wind: this.wind,
      reducedMotion: this.reducedMotion,
      idle: this.#idle(p, input.anims, input.steererSheet),
      stepFrame: null,
      marks,
      effects: {
        ...sky,
        water: { zone: this.map.zone, tide: Math.max(0, this.#tide), wetTo: this.#wetTo },
        flash: this.reducedMotion ? 0 : sky.flash,
        detail: this.detail,
      },
    };
  }
}
