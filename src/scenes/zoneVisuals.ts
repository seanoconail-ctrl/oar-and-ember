/**
 * The visual state of an on-foot zone (Book 7 section 14): everything that moves for the eye
 * alone and needs memory from one frame to the next. The camera's smooth look-ahead towards the
 * cursor (Book 10 section 21) and shake, the drawn tide easing between the simulation's states,
 * sand drying after the water, footprints, dust, splashes, ripple rings, dripping and wet sprites
 * after wading (Book 7 section 07, Book 10 section 02), blown sand, spray on the rocks and round a
 * wader, midges, the steerer's gait frames from distance walked and idles, and the sky (sun,
 * cloud, grade) by the time of day.
 *
 * Nothing here is simulation: it reads the simulation's view each frame and is never saved. It
 * uses its own deterministic noise, never Math.random, so a capture is repeatable.
 */
import {
  parseControlsBalance,
  parseMovementBalance,
  parseWaterBalance,
} from '../content/balance.ts';
import type {
  ControlsBalance,
  DepthBand,
  MovementBalance,
  WaterBalance,
} from '../content/balance.ts';
import type { Palette } from '../render/palette.ts';
import { hash01 } from '../render/noise.ts';
import { heightAt, streamAt, swashAt, tideHeight, waterDepthAt } from '../render/elevation.ts';
import type { Elevation } from '../render/elevation.ts';
import { TILE } from '../render/autotile.ts';
import type { Wade } from '../render/scene.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport.ts';
import { gustAt, STRAND_WIND } from '../render/wind.ts';
import type { Wind } from '../render/wind.ts';
import type { Gait, OnFootPlayer, OnFootState } from '../sim/land/onFoot.ts';
import { bandAt, stillWaterLevel } from '../sim/land/water.ts';
import type { ZoneMap } from '../sim/land/zoneMap.ts';
import { clampCamera, FX_SHEET, PEOPLE_FX_SHEET } from './zoneScene.ts';
import type {
  PersonAnim,
  PersonWater,
  SheetAnims,
  VisualMark,
  ZoneVisualView,
} from './zoneScene.ts';

/** The ground a foot lands on, for prints, dust and footstep sounds. */
export type Surface = 'water' | 'wet_sand' | 'sand' | 'shingle' | 'grass' | 'rock';

export interface SkyInput {
  readonly minuteOfDay: number;
  readonly lightFrom: number;
  readonly darkFrom: number;
}

type Kind =
  | 'spray'
  | 'sand'
  | 'midge'
  | 'dust'
  | 'splash'
  | 'ripple'
  | 'drip'
  | 'surf'
  | 'smoke'
  | 'spark'
  | 'moth'
  /** Stage 9: a drop of blood in flight (fx_gore spray), and a hit's flash. */
  | 'blood'
  | 'flash';
/** The camp fire's particles, drawn from fx_fire (Stage 7). */
const FIRE_FX: ReadonlySet<Kind> = new Set(['smoke', 'spark', 'moth']);
/** Particles drawn from fx_people (the people's own effects); the rest are the place's (fx_strand). */
const PEOPLE_FX: ReadonlySet<Kind> = new Set(['dust', 'splash', 'ripple', 'drip', 'surf']);

/** A blood stain on the ground (Book 7 section 12): drops, or a drag smear. */
interface Stain {
  readonly frame: string;
  readonly x: number;
  readonly y: number;
  age: number;
}
/** Stains kept at once; the oldest fade first. */
const MAX_STAINS = 60;

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  /** Height above the ground, drawn above its foot line. */
  z: number;
  vz: number;
}

interface Print {
  x: number;
  y: number;
  age: number;
  wet: boolean;
  facing: string;
  foot: number;
}

/** Book 10 numbers the visuals follow, and the sea's colours for water over a wading person. */
export interface VisualTuning {
  readonly water: WaterBalance;
  readonly movement: MovementBalance;
  readonly controls: ControlsBalance;
  /** The palette's sea ramp, dark to light, 0 to 255. */
  readonly sea: readonly (readonly [number, number, number])[];
}

/** The tuning from balance.json and the palette's sea ramp. */
export function visualTuning(balance: unknown, palette: Palette): VisualTuning {
  const sea = (palette.ramps.get('sea') ?? []).map((i) => {
    const rgb = palette.entries[i]?.rgb ?? [0, 0, 0];
    return [rgb[0], rgb[1], rgb[2]] as const;
  });
  return {
    water: parseWaterBalance(balance),
    movement: parseMovementBalance(balance),
    controls: parseControlsBalance(balance),
    sea,
  };
}

/**
 * Where the camera leads (Book 2 section 21, camera): towards the mouse cursor (world pixels),
 * towards the right stick (-1 to 1), or in keyboard-only play in the direction of travel.
 */
export type CameraLead =
  | { readonly kind: 'cursor'; readonly x: number; readonly y: number }
  | { readonly kind: 'stick'; readonly x: number; readonly y: number }
  | { readonly kind: 'travel' };

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
  /** The steerer's body sheet (its anims time the gait). */
  readonly steererSheet: string;
  /** Body sheets of the people in the zone, by id. */
  readonly peopleSheets?: Readonly<Record<string, string>>;
  readonly lead?: CameraLead;
  /** Drawing a bow: the camera leads further (lookAheadAiming). */
  readonly aiming?: boolean;
  /** The camp fire in this zone (world pixels), burning or not; and whether it is dark. */
  readonly fire?: { readonly x: number; readonly y: number; readonly lit: boolean } | null;
  readonly night?: boolean;
}

const MAX_PRINTS = 80;
const MAX_PARTICLES = 260;
const PRINT_LIFE = 24;
/** The view's offset from the steerer's feet before any look-ahead: the body sits mid-screen. */
const BASE = { x: -LOGICAL_WIDTH / 2, y: -20 - LOGICAL_HEIGHT / 2 };
/** A critically damped spring from rest halves its error after this many 1/omega. */
const HALF_LIFE_OMEGA = 1.678;
const STEERER = 'P_STEERER';

/** One person's water: their band now and before, and the dripping after they leave it. */
interface Wetness {
  band: DepthBand | null;
  depth: number;
  dripUntil: number;
  dripFor: number;
  nextRipple: number;
  nextSpray: number;
  nextDrip: number;
}

const BAND_ORDER: Readonly<Record<DepthBand, number>> = {
  WET: 0,
  ANKLE: 1,
  KNEE: 2,
  WAIST: 3,
  DEEP: 4,
};
const deeper = (band: DepthBand | null, than: DepthBand): boolean =>
  band !== null && BAND_ORDER[band] >= BAND_ORDER[than];

export class ZoneVisuals {
  readonly map: ZoneMap;
  readonly elevation: Elevation;
  readonly tuning: VisualTuning;
  readonly wind: Wind;
  reducedMotion: boolean;
  /** Effect detail (2 full, 1 lite, 0 low): the play view steps it down on a slow machine. */
  detail: 0 | 1 | 2 = 2;
  seconds = 0;
  /** The smoothed camera offset from the steerer's feet (sub-pixel), its velocity, and the drawn one. */
  #off = { x: 0, y: 0 };
  /** The camera's smoothed point in the world (sub-pixel) and its velocity. */
  #cam = { x: 0, y: 0 };
  #camV = { x: 0, y: 0 };
  /** The keyboard's direction-of-travel lead, eased towards the heading. */
  #kbLead = { x: 0, y: 0 };
  /** The view's corner last drawn, in world pixels, so a change never steps against its motion. */
  #view = { x: 0, y: 0 };
  /** The direction the view last stepped on each axis (-1, 0 or 1). */
  #viewStep = { x: 0, y: 0 };
  #drawn = { x: Math.round(BASE.x), y: Math.round(BASE.y) };
  #started = false;
  #shake = 0;
  #shakeT = 0;
  #tide = -1;
  /** The drawn tide's height, 0 (low) to 1 (high), for the ambience (-1 before the first frame). */
  get tideLevel(): number {
    return this.#tide;
  }
  /** The look-ahead now drawn, in logical pixels from the centred view (for the tests' cap check). */
  get lead(): { x: number; y: number } {
    return { x: this.#drawn.x - Math.round(BASE.x), y: this.#drawn.y - Math.round(BASE.y) };
  }
  #wetTo = 0;
  #prints: Print[] = [];
  #particles: Particle[] = [];
  #stains: Stain[] = [];
  /** Stage 9: the gore setting (Book 7 section 12): 0 off, 1 low, 2 full. Presentation only. */
  gore: 0 | 1 | 2 = 2;
  /** How long stains last at gore low and full, in seconds (assets/art/render.json). */
  stainSeconds = { low: 60, full: 600 };
  #last = { x: 0, y: 0 };
  #idleSince = 0;
  #spawnN = 0;
  /** Distance walked in the current gait (px), which drives the gait's frames. */
  #dist = 0;
  #frame = 0;
  #gait: Gait | null = null;
  #runStartUntil = -1;
  #runStopUntil = -1;
  #wasRunning = false;
  #looseUntil = -1;
  #shoveFrom = -1;
  #wasAiming = false;
  #anim: PersonAnim | null = null;
  #wet = new Map<string, Wetness>();
  /** Rock edges the sea breaks on, in world pixels. */
  readonly #breakers: { x: number; y: number }[] = [];
  /** Called on each footfall with the surface it lands on (for footstep sounds). */
  onStep: ((surface: Surface, x: number) => void) | null = null;
  /** Called on each splash (entering knee or waist water, running in it), for its sound. */
  onSplash: ((x: number) => void) | null = null;

  constructor(map: ZoneMap, elevation: Elevation, reducedMotion: boolean, tuning: VisualTuning) {
    this.map = map;
    this.elevation = elevation;
    this.reducedMotion = reducedMotion;
    this.tuning = tuning;
    this.wind = STRAND_WIND;
    for (let ty = 0; ty < map.height; ty++) {
      const row = map.rows[ty] ?? '';
      for (let tx = 0; tx < map.width; tx++) {
        if (row[tx] !== 'r') continue;
        const sea = [map.rows[ty + 1]?.[tx], map.rows[ty - 1]?.[tx], row[tx + 1], row[tx - 1]];
        if (sea.includes('~')) this.#breakers.push({ x: tx * TILE + 12, y: ty * TILE + 14 });
      }
    }
  }

  /** Capture only (`?camera=`): the view's top-left in world pixels, held still. */
  cameraAt: { x: number; y: number } | null = null;

  /**
   * The steerer shoves (empty hands, or the shove key). The body sheets have no shove yet (Book 7
   * asks for 4 frames; Stage 9 draws them): until then it is the draw's arms-out frames, played
   * out and back, which with no bow in hand read as a two-handed push.
   */
  shove(): void {
    this.#shoveFrom = this.seconds;
  }

  /**
   * A missile came to rest: a splash where it went into water, a puff of sand where it went into
   * the ground (Book 7 section 14: what moves leaves a mark).
   */
  missileStruck(strike: string, x: number, y: number): void {
    if (strike === 'water') {
      this.#emit({ kind: 'splash', x, y, vx: 0, vy: 0, life: 0.25, z: 0, vz: 0 });
      this.#emit({ kind: 'ripple', x, y: y + 1, vx: 0, vy: 0, life: 0.9, z: 0, vz: 0 });
    } else if (strike === 'ground' && this.surfaceAt(x, y) !== 'grass') {
      this.#emit({ kind: 'dust', x, y, vx: 0, vy: 0, z: 0, vz: 0, life: 0.27 });
    } else if (strike === 'stone') {
      for (let k = 0; k < 2; k++)
        this.#emit({
          kind: 'spray',
          x,
          y,
          vx: (this.#rand() - 0.5) * 30,
          vy: 0,
          z: 6,
          vz: 20 + this.#rand() * 10,
          life: 0.35,
        });
    }
  }

  /**
   * A blow landed (Book 7 section 12): 4 to 10 drops of blood fly from it in the blow's direction
   * (more for a heavy blow), falling to leave drops on the ground; with the gore setting low fewer
   * and darker, off only a flash; the camera shakes briefly.
   */
  blood(x: number, y: number, dx: number, dy: number, heavy: boolean): void {
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l;
    const uy = dy / l;
    this.shake(heavy ? 2 : 1);
    if (this.gore === 0) {
      this.#emit({ kind: 'flash', x, y, vx: 0, vy: 0, z: 22, vz: 0, life: 0.15 });
      return;
    }
    const n = this.gore === 1 ? (heavy ? 4 : 2) : heavy ? 10 : 4 + Math.floor(this.#rand() * 3);
    for (let k = 0; k < n; k++) {
      const spread = (this.#rand() - 0.5) * 1.2;
      const speed = 30 + this.#rand() * (heavy ? 60 : 35);
      this.#emit({
        kind: 'blood',
        x,
        y: y + (this.#rand() - 0.5) * 3,
        vx: (ux - uy * spread) * speed,
        vy: (uy + ux * spread) * speed * 0.6,
        z: 18 + this.#rand() * 10,
        vz: 10 + this.#rand() * 20,
        life: 0.5,
      });
    }
  }

  /** A drag trail behind someone carried (Book 7 section 12: smears and drag trails). */
  smear(x: number, y: number): void {
    if (this.gore === 0) return;
    if (this.#stains.some((s) => Math.hypot(s.x - x, s.y - y) < 10)) return;
    this.#stain(`smear/-/${Math.floor(this.#rand() * 2)}`, x, y);
  }

  #stain(frame: string, x: number, y: number): void {
    if (this.#stains.length >= MAX_STAINS) this.#stains.shift();
    this.#stains.push({ frame, x, y, age: 0 });
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

  #ripple(x: number, y: number): void {
    const life = this.tuning.water.rippleLifeSeconds;
    this.#emit({ kind: 'ripple', x, y: y + 1, vx: 0, vy: 0, life, z: 0, vz: 0 });
  }

  #splash(x: number, y: number): void {
    this.onSplash?.(x);
    this.#emit({ kind: 'splash', x, y, vx: 0, vy: 0, life: 0.25, z: 0, vz: 0 });
    for (let k = 0; k < 2; k++)
      this.#emit({
        kind: 'spray',
        x: x + (this.#rand() - 0.5) * 8,
        y,
        vx: (this.#rand() - 0.5) * 20,
        vy: 0,
        z: 1,
        vz: 18 + this.#rand() * 14,
        life: 0.5,
      });
  }

  /** The band at a point under the simulation's still water level (what movement obeys). */
  #band(x: number, y: number, level: number): { band: DepthBand | null; depth: number } {
    const b = bandAt(this.tuning.water, this.elevation, x, y, level);
    return { band: b?.band ?? null, depth: level - heightAt(this.elevation, x, y) };
  }

  /** Follows one person in and out of the water: splashes, ripples, spray and dripping. */
  #water(id: string, x: number, y: number, level: number, moving: boolean): void {
    const t = this.seconds;
    const w = this.tuning.water;
    const now = this.#band(x, y, level);
    let state = this.#wet.get(id);
    if (state === undefined) {
      state = {
        band: now.band,
        depth: now.depth,
        dripUntil: -1,
        dripFor: 1,
        nextRipple: t,
        nextSpray: t + w.sprayAroundWaderSeconds * hash01(x, y, 3),
        nextDrip: t,
      };
      this.#wet.set(id, state);
    }
    const before = state.band;
    // Entering knee or waist water splashes (Book 10, water effects).
    if (deeper(now.band, 'KNEE') && !deeper(before, 'KNEE')) this.#splash(x, y);
    // Leaving knee, waist or deep water: dripping and darker for the Book 10 time.
    if (deeper(before, 'KNEE') && !deeper(now.band, 'KNEE')) {
      state.dripFor = deeper(before, 'WAIST') ? w.dripAfterWaistSeconds : w.dripAfterKneeSeconds;
      state.dripUntil = t + state.dripFor;
    }
    state.band = now.band;
    state.depth = now.depth;
    // A ring every rippleStanding seconds while standing in water (steps ring on each footfall).
    if (deeper(now.band, 'ANKLE') && !moving && t >= state.nextRipple) {
      this.#ripple(x, y);
      state.nextRipple = t + w.rippleStandingSeconds;
    } else if (moving) state.nextRipple = t + w.rippleStandingSeconds;
    // Spray round someone standing in the surf, and drips off someone who has just left it.
    if (deeper(now.band, 'KNEE') && !moving && t >= state.nextSpray) {
      this.#emit({ kind: 'surf', x, y, vx: 0, vy: 0, life: 0.34, z: 0, vz: 0 });
      for (let k = 0; k < 3; k++)
        this.#emit({
          kind: 'spray',
          x: x + (this.#rand() - 0.5) * 14,
          y: y + 1,
          vx: (this.#rand() - 0.5) * 12 + this.wind.dirX * 6,
          vy: 0,
          z: 2,
          vz: 20 + this.#rand() * 16,
          life: 0.8,
        });
      state.nextSpray = t + w.sprayAroundWaderSeconds;
    }
    if (t < state.dripUntil && t >= state.nextDrip) {
      this.#emit({
        kind: 'drip',
        x: x + (this.#rand() - 0.5) * 10,
        y: y + 0.5,
        vx: 0,
        vy: 0,
        z: 6 + this.#rand() * 16,
        vz: -30,
        life: 0.3,
      });
      state.nextDrip = t + 0.18;
    }
  }

  /** How a person is drawn for the water: masked at their band's waterline, or wet and darker. */
  #personWater(id: string): PersonWater {
    const state = this.#wet.get(id);
    if (state === undefined) return { dark: 0 };
    const bands = this.tuning.water.bands;
    // A person standing (not swimming) is never hidden entirely: deep water draws at the waist.
    const band = bands.find((b) => b.band === (state.band === 'DEEP' ? 'WAIST' : state.band));
    const mask = band?.maskPx ?? 0;
    const remaining = Math.max(0, state.dripUntil - this.seconds);
    // Darker while dripping, fading back over the last part of the time.
    const dark = remaining > 0 ? Math.min(1, remaining / (0.3 * state.dripFor)) : 0;
    const wade: Wade | undefined =
      mask > 0 ? { mask, colour: this.#waterColour(state.depth) } : undefined;
    return wade === undefined ? { dark } : { dark, wade, band: state.band };
  }

  /** The sea's colour over water this deep, as the water shader shades it (pale to deep). */
  #waterColour(depth: number): readonly [number, number, number] {
    const sea = this.tuning.sea;
    const i = Math.floor(9 - 6.2 * Math.pow(Math.max(0, Math.min(1, depth / 1.2)), 0.6));
    return sea[Math.max(0, Math.min(sea.length - 1, i))] ?? [74, 125, 136];
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
    const level = stillWaterLevel(input.tide);

    // Distance since the last frame, measured before the last position is replaced.
    const moved = Math.hypot(p.x - this.#last.x, p.y - this.#last.y);
    this.#camera(input, dt);
    this.#last = { x: p.x, y: p.y };
    this.#shake *= Math.exp(-dt * 9);
    this.#shakeT += dt;

    // The steerer's frames, from distance walked; footfalls on the contact frames.
    this.#steerer(input, p, level, moved);

    // People in the water: the steerer and everyone standing in the zone.
    this.#water(STEERER, p.x, p.y, level, p.moving);
    for (const [id, a] of Object.entries(input.onFoot.actors)) {
      if (a.pose === 'carried') {
        this.#wet.delete(id);
        continue;
      }
      this.#water(id, a.x, a.y, level, false);
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
    const cam = this.#viewCorner(p);
    for (let k = 0; k < 3; k++) {
      const x = cam.x + this.#rand() * LOGICAL_WIDTH;
      const y = cam.y + this.#rand() * LOGICAL_HEIGHT;
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

    // The camp fire: smoke rising straight in the sheltered court, then bending downwind once it
    // clears the wall head; sparks; moths round it at night (Book 7 section 14).
    const fire = input.fire;
    if (fire?.lit === true && this.#near(fire.x, fire.y, 160)) {
      if (this.#rand() < dt * 5)
        this.#emit({
          kind: 'smoke',
          x: fire.x + (this.#rand() - 0.5) * 3,
          y: fire.y,
          vx: 0,
          vy: 0,
          z: 6,
          vz: 16 + this.#rand() * 6,
          life: 4.2,
        });
      if (this.#rand() < dt * (input.night === true ? 3 : 1.2))
        this.#emit({
          kind: 'spark',
          x: fire.x + (this.#rand() - 0.5) * 6,
          y: fire.y,
          vx: (this.#rand() - 0.5) * 6,
          vy: 0,
          z: 8,
          vz: 30 + this.#rand() * 25,
          life: 1.2,
        });
      if (
        input.night === true &&
        this.#rand() < dt * 0.6 &&
        this.#particles.filter((q) => q.kind === 'moth').length < 4
      )
        this.#emit({ kind: 'moth', x: fire.x, y: fire.y, vx: 0, vy: 0, z: 22, vz: 0, life: 9 });
    }

    for (const q of this.#particles) {
      q.age += dt;
      if (q.kind === 'moth' && fire != null) {
        // Circling the fire's light in loose loops.
        const a = q.age * 2.1 + q.life;
        q.x = fire.x + Math.cos(a) * (10 + 4 * Math.sin(q.age * 1.3)) + Math.sin(q.age * 5) * 2;
        q.y = fire.y + Math.sin(a) * 4;
        q.z = 20 + Math.sin(q.age * 3.1) * 6;
        continue;
      }
      if (q.kind === 'smoke' || q.kind === 'spark') {
        // Above the wall head the wind takes it east.
        const over = Math.max(0, q.z - 56);
        q.vx = this.wind.dirX * Math.min(40, over * 0.9);
      }
      if (q.kind === 'midge') {
        q.x += Math.sin(t * 7 + q.y) * 0.4;
        q.y += Math.cos(t * 5.3 + q.x) * 0.25;
        continue;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      if (q.kind === 'spray') q.vz -= 70 * dt;
      if (q.kind === 'blood') {
        q.vz -= 160 * dt;
        if (q.z <= 0 && q.age < q.life) {
          // Fallen: a few drops on the ground where it landed.
          q.age = q.life;
          if (this.#rand() < 0.45) this.#stain(`drops/-/${Math.floor(this.#rand() * 4)}`, q.x, q.y);
        }
      }
      if (q.z < 0) q.z = 0;
    }
    this.#particles = this.#particles.filter((q) => q.age < q.life);
    const stainLife = this.gore === 2 ? this.stainSeconds.full : this.stainSeconds.low;
    for (const st of this.#stains) st.age += dt;
    this.#stains = this.#stains.filter((st) => st.age < stainLife && this.gore > 0);
    for (const pr of this.#prints) pr.age += dt;
    // Prints fade; wet prints go when the water reaches them.
    this.#prints = this.#prints.filter(
      (pr) =>
        pr.age < PRINT_LIFE &&
        waterDepthAt(this.elevation, pr.x, pr.y, this.#tide, t) <= 0 &&
        !streamAt(this.elevation, pr.x, pr.y),
    );
  }

  /**
   * The camera (Book 10 section 21): a look-ahead towards the cursor, the stick or the direction
   * of travel, critically damped with cameraHalfLife below the pixel; the drawn offset is whole
   * pixels and changes only once the smoothed offset is cameraSnap past the halfway point, so a
   * still cursor never makes the view step back and forth.
   */
  #camera(input: FrameInput, dt: number): void {
    const p = input.onFoot.player;
    const c = this.tuning.controls;
    const cap = (input.aiming === true ? c.lookAheadAiming : c.lookAheadMax) * TILE;
    let lx = 0;
    let ly = 0;
    const lead = input.lead ?? { kind: 'travel' };
    // The keyboard's lead in the direction of travel, eased so a turn swings it round and a stop
    // lets it fade, rather than flipping the goal from one side to the other in a frame.
    let kx = 0;
    let ky = 0;
    if (lead.kind === 'travel' && p.moving && this.#started && dt > 0) {
      const vx = (p.x - this.#last.x) / dt;
      const vy = (p.y - this.#last.y) / dt;
      const d = Math.hypot(vx, vy);
      if (d > 1) {
        const k = Math.min(cap, c.lookAheadScale * d) / d;
        kx = vx * k;
        ky = vy * k;
      }
    }
    const ease = 1 - Math.pow(0.5, dt / Math.max(1e-3, c.keyboardLeadHalfLife));
    this.#kbLead.x += (kx - this.#kbLead.x) * ease;
    this.#kbLead.y += (ky - this.#kbLead.y) * ease;
    if (lead.kind === 'cursor') {
      // From the steerer's body, not the feet (the cursor rests on what it points at).
      const dx = lead.x - p.x;
      const dy = lead.y - (p.y - 20);
      const d = Math.hypot(dx, dy);
      const dead = c.lookAheadDeadZone * TILE;
      if (d > dead) {
        const k = Math.min(cap, c.lookAheadScale * (d - dead)) / d;
        lx = dx * k;
        ly = dy * k;
      }
    } else if (lead.kind === 'stick') {
      const d = Math.hypot(lead.x, lead.y);
      if (d > c.gamepadDeadZone) {
        lx = (lead.x / Math.max(1, d)) * cap;
        ly = (lead.y / Math.max(1, d)) * cap;
      }
    } else {
      lx = this.#kbLead.x;
      ly = this.#kbLead.y;
    }
    // The point the camera wants, in the world: the steerer plus the framing and the lead.
    const goal = { x: p.x + BASE.x + lx, y: p.y + BASE.y + ly };
    // A jump of more than half a screen in one frame is a new zone or a placement: cut to it.
    const jumped =
      Math.abs(p.x - this.#last.x) > LOGICAL_WIDTH / 2 ||
      Math.abs(p.y - this.#last.y) > LOGICAL_HEIGHT / 2;
    if (!this.#started || jumped) {
      this.#kbLead = { x: 0, y: 0 };
      this.#cam = { ...goal };
      this.#camV = { x: 0, y: 0 };
      this.#off = { x: goal.x - p.x, y: goal.y - p.y };
      this.#drawn = { x: Math.round(this.#off.x), y: Math.round(this.#off.y) };
      this.#view = this.#viewCorner(p);
      this.#started = true;
      return;
    }
    const omega = HALF_LIFE_OMEGA / Math.max(1e-3, c.cameraHalfLife);
    // A critically damped spring moves the camera's point in the world towards the goal,
    // integrated exactly over dt. Springing the world point (not the offset from the steerer)
    // means a turn decelerates the view and carries it round, with no jolt when the feet reverse.
    const decay = Math.exp(-omega * dt);
    for (const axis of ['x', 'y'] as const) {
      const e = this.#cam[axis] - goal[axis];
      const temp = (this.#camV[axis] + omega * e) * dt;
      this.#camV[axis] = (this.#camV[axis] - omega * temp) * decay;
      this.#cam[axis] = goal[axis] + (e + temp) * decay;
      const feet = Math.round(axis === 'x' ? p.x : p.y);
      this.#off[axis] = this.#cam[axis] - feet;
      // Drawn in whole pixels. While the view is within the snap of where the camera wants it, it
      // keeps its offset from the steerer's pixel, so a steady walk never jitters the steerer; past
      // that, it is the camera's own pixel, which moves the way the camera moves. A step against
      // the camera's motion (or back the way the view last stepped) waits while it is within a
      // pixel and a half, so a turn eases round without wobbling.
      const want = this.#cam[axis];
      const locked = feet + this.#drawn[axis];
      let view = Math.abs(locked - want) <= 0.5 + c.cameraSnap ? locked : Math.round(want);
      const step = Math.sign(view - this.#view[axis]);
      const against =
        step !== 0 && (step !== Math.sign(this.#camV[axis]) || step === -this.#viewStep[axis]);
      if (against && Math.abs(this.#view[axis] - want) <= 1.5 + c.cameraSnap)
        view = this.#view[axis];
      this.#drawn[axis] = view - feet;
    }
    const view = this.#viewCorner(p);
    for (const axis of ['x', 'y'] as const) {
      const moved = Math.sign(view[axis] - this.#view[axis]);
      if (moved !== 0) this.#viewStep[axis] = moved;
    }
    this.#view = view;
  }

  #viewCorner(p: { x: number; y: number }): { x: number; y: number } {
    return { x: Math.round(p.x) + this.#drawn.x, y: Math.round(p.y) + this.#drawn.y };
  }

  #near(x: number, y: number, margin: number): boolean {
    const cam = this.#viewCorner(this.#last);
    return (
      x > cam.x - margin &&
      y > cam.y - margin &&
      x < cam.x + LOGICAL_WIDTH + margin &&
      y < cam.y + LOGICAL_HEIGHT + margin
    );
  }

  /**
   * The steerer's animation: walk, run, sneak and carry frames from the distance walked, so the
   * planted foot keeps pace with the ground at any speed (the cycle's length is the Book 10 speed
   * times the cycle's time); a one-frame lean into a run and a short skid out of it; the bow drawn
   * and loosed; and the idles when still.
   */
  #steerer(input: FrameInput, p: OnFootPlayer, level: number, moved: number): void {
    const t = this.seconds;
    const a = input.anims.get(input.steererSheet);
    const gait: Gait = input.onFoot.carrying !== null ? 'carry' : p.gait;
    const running = p.moving && gait === 'run';
    if (running && !this.#wasRunning && a?.['runstart'] !== undefined)
      this.#runStartUntil = t + (a['runstart'].frames * a['runstart'].ticks) / 60;
    if (!running && this.#wasRunning && !p.moving && a?.['runstop'] !== undefined)
      this.#runStopUntil = t + (a['runstop'].frames * a['runstop'].ticks) / 60;
    this.#wasRunning = running;
    const aiming = p.aim !== null;
    if (!aiming && this.#wasAiming && a?.['draw'] !== undefined)
      this.#looseUntil = t + (a['draw'].ticks * 2) / 60;
    this.#wasAiming = aiming;

    const shoveFrames = [1, 2, 2, 1];
    const shoveTick = a?.['draw']?.ticks ?? 8;
    const shoveAt = Math.floor(((t - this.#shoveFrom) * 60) / shoveTick);
    if (
      !aiming &&
      this.#shoveFrom >= 0 &&
      shoveAt < shoveFrames.length &&
      a?.['draw'] !== undefined
    ) {
      this.#anim = { state: 'draw', frame: shoveFrames[shoveAt] ?? 1 };
    } else if (aiming && a?.['draw'] !== undefined) {
      const draw = a['draw'];
      const held = (input.tick - (p.aim?.since ?? input.tick)) / draw.ticks;
      // Raise, draw, then hold the full draw; the last frame is the loose.
      this.#anim = {
        state: 'draw',
        frame: Math.max(0, Math.min(draw.frames - 2, Math.floor(held))),
      };
    } else if (t < this.#looseUntil && a?.['draw'] !== undefined && !p.moving) {
      this.#anim = { state: 'draw', frame: a['draw'].frames - 1 };
    } else if (p.moving) {
      this.#idleSince = t;
      const anim = a?.[gait];
      if (gait !== this.#gait) {
        this.#gait = gait;
        this.#dist = 0;
        this.#frame = -1;
      }
      const speed = this.tuning.movement[gait] * TILE;
      if (anim !== undefined && speed > 0) {
        const cycle = (speed * anim.frames * anim.ticks) / 60;
        this.#dist = (this.#dist + moved) % cycle;
        const frame = Math.floor((this.#dist / cycle) * anim.frames) % anim.frames;
        const half = anim.frames / 2;
        if (frame !== this.#frame && frame % half === 0)
          this.#footfall(p, frame / half, gait, level);
        this.#frame = frame;
        this.#anim =
          gait === 'run' && t < this.#runStartUntil
            ? { state: 'runstart', frame: 0 }
            : { state: gait, frame };
      } else this.#anim = { state: gait, frame: 0 };
    } else {
      this.#gait = null;
      this.#frame = -1;
      if (t < this.#runStopUntil && a?.['runstop'] !== undefined) {
        const stop = a['runstop'];
        const left = (this.#runStopUntil - t) * 60;
        const frame = Math.min(stop.frames - 1, stop.frames - 1 - Math.floor(left / stop.ticks));
        this.#anim = { state: 'runstop', frame: Math.max(0, frame) };
      } else if (input.onFoot.carrying !== null) {
        this.#anim = { state: 'carry', frame: 0 };
      } else this.#anim = this.#idle(p, input.anims, input.steererSheet);
    }
  }

  #footfall(p: OnFootPlayer, foot: number, gait: Gait, level: number): void {
    const { x, y } = p;
    const side = foot === 0 ? -3 : 3;
    const surface = this.surfaceAt(x, y);
    this.onStep?.(surface, x);
    const { band } = this.#band(x, y, level);
    const wet = this.#wet.get(STEERER);
    const dripping = wet !== undefined && this.seconds < wet.dripUntil;
    // A ring on every step in ankle, knee and waist water; a splash on every running step there.
    if (deeper(band, 'ANKLE')) this.#ripple(x + side * 0.5, y);
    if (deeper(band, 'KNEE') && gait === 'run') this.#splash(x + side, y);
    if ((surface === 'sand' || surface === 'wet_sand') && !deeper(band, 'ANKLE')) {
      if (this.#prints.length >= MAX_PRINTS) this.#prints.shift();
      this.#prints.push({
        x: x + side * 0.6,
        y: y - 1 + (foot === 0 ? 0 : 1),
        age: 0,
        // Wet prints on wet sand, and on dry sand from feet just out of the water.
        wet: surface === 'wet_sand' || dripping,
        facing: p.facing,
        foot,
      });
    }
    if (surface === 'sand' && gait === 'run' && band === null)
      this.#emit({
        kind: 'dust',
        x: x + side,
        y,
        vx: this.wind.dirX * 10,
        vy: 0,
        z: 0,
        vz: 0,
        life: 0.27,
      });
  }

  /**
   * The steerer's idles: a breath; after a few seconds still, now and then a weight shift or a
   * glance round; bracing with the cloak held in a strong gust.
   */
  #idle(p: { x: number; y: number }, anims: SheetAnims, sheet: string): PersonAnim {
    const t = this.seconds;
    const g = gustAt(this.wind, p.x, p.y, t);
    const a = anims.get(sheet);
    const pick = (state: string): PersonAnim => {
      const anim = a?.[state];
      const n = anim?.frames ?? 1;
      return { state, frame: Math.floor((t * 60) / (anim?.ticks ?? 15)) % n };
    };
    if (g > 0.55 && a?.['idlewind'] !== undefined) return pick('idlewind');
    const still = t - this.#idleSince;
    if (still > 3) {
      // In spells of 2.4 s: mostly breathing, sometimes a shift or a glance (chosen by the spell).
      const spell = Math.floor((still - 3) / 2.4);
      const r = hash01(spell, 31);
      if (r < 0.22 && a?.['shift'] !== undefined) return pick('shift');
      if (r > 0.7 && a?.['glance'] !== undefined) return pick('glance');
    }
    return pick('idle');
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
    const corner = this.#viewCorner(p);
    const cam =
      this.cameraAt === null
        ? clampCamera(this.map, corner.x + shakeX, corner.y + shakeY)
        : clampCamera(this.map, this.cameraAt.x, this.cameraAt.y);
    const marks: VisualMark[] = [];
    for (const pr of this.#prints) {
      // Old dry prints soften: drawn on alternate frames of a dither as they fade.
      if (pr.age > PRINT_LIFE * 0.6 && (Math.floor(pr.x) + Math.floor(pr.y)) % 2 === 0) continue;
      marks.push({
        sheet: PEOPLE_FX_SHEET,
        frame: `${pr.wet ? 'print_wet' : 'print_dry'}_${pr.facing}/-/${pr.foot}`,
        x: pr.x,
        y: pr.y,
        layer: 'decal',
      });
    }
    for (const st of this.#stains)
      marks.push({ sheet: 'fx_gore', frame: st.frame, x: st.x, y: st.y, layer: 'decal' });
    for (const q of this.#particles) {
      if (q.kind === 'blood' || q.kind === 'flash') {
        const frames = q.kind === 'blood' ? 3 : 3;
        const i = Math.min(frames - 1, Math.floor((q.age / q.life) * frames));
        marks.push({
          sheet: 'fx_gore',
          frame: `${q.kind === 'blood' ? 'spray' : 'flash'}/-/${i}`,
          x: q.x,
          y: q.y - q.z,
          layer: 'actor',
          sort: q.y + 0.6,
        });
        continue;
      }
      const people = PEOPLE_FX.has(q.kind);
      const fireFx = FIRE_FX.has(q.kind);
      const frames = people
        ? (input.anims.get(PEOPLE_FX_SHEET)?.[q.kind]?.frames ?? 1)
        : fireFx
          ? (input.anims.get('fx_fire')?.[q.kind]?.frames ?? 1)
          : q.kind === 'midge'
            ? 2
            : 3;
      const i =
        q.kind === 'midge' || q.kind === 'moth'
          ? Math.floor(this.seconds * 6 + q.x) % 2
          : Math.min(frames - 1, Math.floor((q.age / q.life) * frames));
      marks.push({
        sheet: people ? PEOPLE_FX_SHEET : fireFx ? 'fx_fire' : FX_SHEET,
        frame: `${q.kind}/-/${i}`,
        x: q.x,
        y: q.y - q.z,
        layer: 'actor',
        // A ripple lies on the water just behind the feet it rings; spray sorts with its foot.
        sort: q.kind === 'ripple' || q.kind === 'surf' ? q.y - 1.5 : q.y + 0.5,
      });
    }
    const water: Record<string, PersonWater> = { [STEERER]: this.#personWater(STEERER) };
    for (const id of Object.keys(input.onFoot.actors)) water[id] = this.#personWater(id);
    const sky = ZoneVisuals.sky(input.sky, 0.55);
    return {
      camera: cam,
      seconds: this.seconds,
      wind: this.wind,
      reducedMotion: this.reducedMotion,
      steerer: this.#anim,
      water,
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
