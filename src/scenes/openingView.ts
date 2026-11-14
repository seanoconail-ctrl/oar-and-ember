/**
 * Design addendum 2.4's opening, drawn (Book 7 sections 05, 06, 07, 09, 10, 14 and 18): what the
 * opening adds to a zone's scene, presentation only, read from the simulation's state.
 *
 * - **Props** for the camp scene: the broken mast with the stores lashed at its head (or bare), the
 *   rock pool, the folded sail and the oars, the sail hauled up and filling, the shelter's inside
 *   (furs, gear, clothes drying), and the doors at their opening.
 * - **Over the scene**: the net round Hild and the waves washing over her; the faint outline of
 *   Thorkel's chest at its home while it is carried near; his chest opened; the lean-to cut away
 *   for the steerer under it, warm; the steerer lying in the surf on waking; the seal sinking and
 *   the gulls lifting as the steerer comes near; the pale light at the Hag's Seat on the first
 *   evening; the Hag's Stone's hush, cold light, glowing carvings, mist, still figure and gust; and
 *   the tactile particles (fibres, sparks, sand puffs, spray).
 * - **The cold open**: the storm at night on the strand's sea, Thorkel's boat with the household at
 *   the oars and the steerer at the steering oar, the strike on the skerry and the black.
 *
 * No `Math.random`: particles draw from a seeded generator; nothing here changes the simulation.
 */
import { withSprites } from '../render/scene.ts';
import type { Scene, SceneSprite } from '../render/scene.ts';
import type { CampDef } from '../content/registry.ts';
import { doorsHere } from '../sim/land/doors.ts';
import type { OnFootState } from '../sim/land/onFoot.ts';
import { TICKS_PER_SECOND } from '../sim/land/onFoot.ts';
import type { ZoneMap } from '../sim/land/zoneMap.ts';
import {
  coldOpenSeconds,
  hagNow,
  homeOutline,
  netted,
  wreckPhase,
} from '../sim/narrative/wreck.ts';
import type { WreckContext } from '../sim/narrative/wreck.ts';
import type { WorldState } from '../sim/world.ts';
import { leanToUp, shelterStage } from '../sim/home/camp.ts';
import {
  seaBalanceFor,
  seaBurialState,
  seaMoment,
  seaTimeline,
} from '../sim/narrative/seaBurial.ts';
import type { SeaPhase } from '../sim/narrative/seaBurial.ts';
import type { StormBalance } from '../content/presentationBalance.ts';
import { drawStorm, greenWater, strikeNow, strikes, waves } from './storm.ts';
import type { Strike, StormDrawing, Wave } from './storm.ts';

type CampProp = CampDef['props']['S0'][number] & { readonly fixed?: boolean };

/** The camp scene's props that the opening adds or changes in a zone. */
export function openingProps(
  world: WorldState,
  ctx: WreckContext,
  map: ZoneMap,
  stageProps: readonly CampProp[],
  tick: number,
  /** Where the second day's finishing is worked (the camp's BUILD site), for its mark (DH-11). */
  buildAt?: { readonly x: number; readonly y: number },
): CampProp[] {
  const out: CampProp[] = [];
  const zone = map.zone;
  const m = ctx.rw.mast;
  if (zone === m.zone) {
    const cut = world.facts['ch1.lashing_cut'] === true;
    out.push({
      sheet: 'prop_mast_broken',
      frame: `${cut ? 'cut' : 'lashed'}/-/0`,
      x: m.foot.x,
      y: m.foot.y,
    });
    if (world.onFoot?.items.some((i) => i.key === 'pool_arm_ring') === true || zone === m.zone)
      out.push({ sheet: 'prop_rockpool', frame: 'pool/-/0', x: 63.4, y: 35.75 });
  }
  const camp = ctx.camp;
  if (camp?.zone !== zone) return out;
  // The shelter's stages (the user's third playtest, decision DG-12; Book 7 section 06): the sail
  // folded with three oars; the oars stood and lashed (the steerer's build loop, frame by frame);
  // the frame standing, its guys stirring; the sail hauled over the ridge and lashed along it; the
  // cloth filling and settling into the lean-to; and the second day's finishing going on beside it.
  const stage = shelterStage(world);
  const work = world.onFoot?.player.work ?? null;
  const stageAt = Number(world.facts['ch1.shelter_at'] ?? -1e9);
  const share = (task: string): number =>
    work?.task === task ? Math.min(0.999, Math.max(0, (tick - work.since) / work.ticks)) : -1;
  const sail = ctx.rw.camp.sail;
  for (const p of stageProps) {
    if (p.sheet !== 'prop_sail_leanto') continue;
    const at = { x: p.x, y: p.y, fixed: true };
    // The user's fourth playtest (DH-11): the spot where the shelter is worked is marked on the
    // ground while it can be worked: stakes and a cord where the frame goes, the foot-stones and a
    // coil of lashing for the sail, and on the second morning a turf spade and the cutting line.
    const mark = shelterMark(world, stage);
    if (mark !== null) {
      const turf = mark === 'turf';
      out.push({
        sheet: SHELTER_MARK_SHEET,
        frame: `${mark}/-/${Math.floor(tick / 14) % SHELTER_MARK_FRAMES}`,
        x: turf ? (buildAt?.x ?? p.x) : camp.mark.x,
        y: turf ? (buildAt?.y ?? p.y) : camp.mark.y,
        fixed: true,
      });
    }
    if (stage === 'FOLDED') {
      const k = share('TASK_SHELTER_FRAME');
      out.push({
        sheet: SHELTER_SHEET,
        frame: k < 0 ? 'folded/-/0' : `raise/-/${Math.floor(k * SHELTER_RAISE_FRAMES)}`,
        ...at,
      });
    } else if (stage === 'FRAME') {
      const k = share('TASK_SHELTER_SAIL');
      out.push({
        sheet: SHELTER_SHEET,
        frame:
          k < 0
            ? `frame/-/${Math.floor(tick / 12) % SHELTER_FRAME_FRAMES}`
            : `haul/-/${Math.floor(k * SHELTER_HAUL_FRAMES)}`,
        ...at,
      });
    } else if ((stage === null || stage === 'SAIL') && tick - stageAt < 60) {
      // The cloth filling and settling.
      out.push({
        sheet: 'prop_sail_raise',
        frame: `fill/-/${Math.min(5, Math.floor((tick - stageAt) / 10))}`,
        ...at,
      });
    }
    // The second day's finishing (shelterFinish): turves cut and stacked on the weather side, a
    // mallet and pegs, as the work goes on (by its share of Book 10's worker-days).
    const building = world.homes['ISLE_SKARV']?.building;
    if (stage === 'SAIL' && building != null && building.progress > 0)
      out.push({
        sheet: SHELTER_SHEET,
        frame: `turf/-/${Math.min(SHELTER_TURF_FRAMES - 1, Math.floor((building.progress / Math.max(1, ctx.shelterNeedMinutes)) * SHELTER_TURF_FRAMES))}`,
        x: p.x - 2.1,
        y: p.y + 0.6,
        fixed: true,
      });
  }
  if (leanToUp(world)) {
    // Inside the shelter: a fur for each sleeper, the gear stowed, clothes and a net drying.
    const beds = ctx.campBeds;
    const n = Math.max(1, world.household.residents.length);
    beds.slice(0, Math.min(beds.length, n)).forEach((bed, k) =>
      out.push({
        sheet: 'prop_shelter_inside',
        frame: `furs/-/${k % 4}`,
        x: bed.x,
        y: bed.y + 0.25,
        fixed: true,
      }),
    );
    out.push({
      sheet: 'prop_shelter_inside',
      frame: 'gear/-/0',
      x: sail.x - 1.9,
      y: sail.y + 0.2,
      fixed: true,
    });
    out.push({
      sheet: 'prop_shelter_inside',
      frame: 'drying/-/0',
      x: sail.x + 0.3,
      y: sail.y - 0.1,
    });
  }
  // The doors at their opening (Book 7 section 06): a door over 3 frames, a flap over 2.
  const campStage = world.homes['ISLE_SKARV']?.stage ?? 'S0';
  for (const d of doorsHere(map, campStage, world.facts)) {
    const s = world.onFoot?.doors?.find((x) => x.id === d.id);
    const open = s?.open ?? 0;
    const flap = d.kind === 'FLAP';
    const frames = flap ? 3 : 4;
    const k = Math.min(frames - 1, Math.round(open * (frames - 1)));
    out.push({
      sheet: d.sheet,
      frame: s?.barred === true && !flap ? 'barred/-/0' : `${flap ? 'flap' : 'door'}/-/${k}`,
      x: d.pos.x,
      y: d.pos.y,
      fixed: true,
    });
  }
  return out;
}

/** The stage props without what the opening draws itself (the lean-to before it is up). */
export function stagePropsNow<T extends { readonly sheet: string }>(
  world: WorldState,
  props: readonly T[],
  tick: number,
): T[] {
  const stageAt = Number(world.facts['ch1.shelter_at'] ?? -1e9);
  return props.filter(
    (p) => p.sheet !== 'prop_sail_leanto' || (leanToUp(world) && tick - stageAt >= 60),
  );
}

/** The shelter's ground mark (the user's fourth playtest, DH-11): its sheet and frames. */
export const SHELTER_MARK_SHEET = 'prop_shelter_mark';
export const SHELTER_MARK_FRAMES = 4;

/**
 * Which mark shows where the shelter is worked, while it can be worked (DH-11): `pegs` for the
 * frame, `stones` for the sail, `turf` once Hild has asked for the finishing on the second morning
 * and before its first turf is cut. Null when there is nothing to do there.
 */
export function shelterMark(
  world: WorldState,
  stage: ReturnType<typeof shelterStage>,
): 'pegs' | 'stones' | 'turf' | null {
  const home = world.homes['ISLE_SKARV'];
  if (home?.stage !== 'S0' || world.facts['ch1.at_broch'] !== true) return null;
  if (stage === 'FOLDED') return 'pegs';
  if (stage === 'FRAME') return 'stones';
  const started = (home.building?.progress ?? 0) > 0;
  if (stage === 'SAIL' && world.facts['ch1.shelter_finish_said'] === true && !started)
    return 'turf';
  return null;
}

/** The shelter's stages' sheet (DG-12) and its states' frame counts (assets/art/sheets). */
export const SHELTER_SHEET = 'prop_shelter_frame';
export const SHELTER_RAISE_FRAMES = 8;
export const SHELTER_FRAME_FRAMES = 4;
export const SHELTER_HAUL_FRAMES = 8;
export const SHELTER_TURF_FRAMES = 4;

// ---------------------------------------------------------------------------- particles

interface Bit {
  kind: 'fibre' | 'spark' | 'puff' | 'spray' | 'drip' | 'rain' | 'smoke';
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  age: number;
  life: number;
}

const FRAMES: Record<Bit['kind'], number> = {
  fibre: 3,
  spark: 3,
  puff: 4,
  spray: 4,
  drip: 2,
  rain: 4,
  smoke: 6,
};

/** The opening's particles (Book 7 section 07: every action tactile), seeded, never Math.random. */
export class OpeningFx {
  #bits: Bit[] = [];
  #seed = 0x2f6e2b1;

  #rand(): number {
    this.#seed = (Math.imul(this.#seed, 1664525) + 1013904223) >>> 0;
    return this.#seed / 4294967296;
  }

  /** A burst of `n` of a kind at a world point. */
  burst(kind: Bit['kind'], x: number, y: number, n: number, height = 0): void {
    for (let i = 0; i < n; i++) {
      const a = this.#rand() * Math.PI * 2;
      const sp = kind === 'puff' ? 6 : kind === 'spark' ? 30 : kind === 'fibre' ? 22 : 18;
      this.#bits.push({
        kind,
        x: x + (this.#rand() - 0.5) * 6,
        y: y + (this.#rand() - 0.5) * 3,
        vx: Math.cos(a) * sp * (0.4 + this.#rand()),
        vy: Math.sin(a) * sp * 0.4,
        z: height + this.#rand() * 6,
        vz: kind === 'puff' ? 4 : kind === 'smoke' ? 6 : 20 + this.#rand() * 25,
        age: 0,
        life: kind === 'puff' ? 0.5 : kind === 'smoke' ? 2.2 : kind === 'spark' ? 0.4 : 0.7,
      });
    }
  }

  update(dt: number): void {
    for (const b of this.#bits) {
      b.age += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z = Math.max(0, b.z + b.vz * dt);
      if (b.kind !== 'smoke' && b.kind !== 'puff') b.vz -= 90 * dt;
    }
    this.#bits = this.#bits.filter((b) => b.age < b.life);
    if (this.#bits.length > 240) this.#bits.splice(0, this.#bits.length - 240);
  }

  sprites(camera: { readonly x: number; readonly y: number }): SceneSprite[] {
    return this.#bits.map((b) => ({
      sheet: 'fx_opening',
      frame: `${b.kind}/-/${Math.min(FRAMES[b.kind] - 1, Math.floor((b.age / b.life) * FRAMES[b.kind]))}`,
      x: b.x - camera.x,
      y: b.y - b.z - camera.y,
      layer: 'actor' as const,
      sort: b.y - camera.y + 0.5,
    }));
  }
}

// --------------------------------------------------------------------------- over the scene

export interface DecorateInput {
  readonly world: WorldState;
  readonly ctx: WreckContext;
  readonly map: ZoneMap;
  readonly onFoot: OnFootState;
  readonly camera: { readonly x: number; readonly y: number };
  readonly seconds: number;
  readonly tick: number;
  readonly reducedMotion: boolean;
  readonly fx: OpeningFx;
  /** The steerer's body sheet and its layers (to draw them lying on waking). */
  readonly steererSheets: readonly string[];
  readonly bodyModel: 'A' | 'B';
  /**
   * The first rain (Book 10 section 25 firstRain; DF-21): drops on screen over the island and the
   * slant, or null when it is dry. Presentation only: the simulation's rain is not yet applied.
   */
  readonly rain?: { readonly drops: number; readonly slant: number } | null;
  /**
   * The mast's stores just fallen (DF-82): `k` 0..1 of the swell carrying them from under the
   * lashing (`from`, world px) round into the stream's mouth where they lie.
   */
  readonly bundleDrift?: { readonly k: number; readonly from: { x: number; y: number } } | null;
  /** The sea's colour ramp, shallow to deep reversed as the water shader shades it (DG-14). */
  readonly seaRamp?: readonly (readonly [number, number, number])[];
}

/** Whether the steerer stands under the raised sail (its cloth cut away, the rain heard on it). */
export function underSail(
  world: WorldState,
  ctx: WreckContext,
  map: ZoneMap,
  p: { x: number; y: number },
): boolean {
  const camp = ctx.camp;
  if (camp?.zone !== map.zone || !leanToUp(world)) return false;
  const sail = ctx.rw.camp.sail;
  return (
    Math.abs(p.x / map.tile - (sail.x - 0.2)) < 1.9 &&
    p.y / map.tile > sail.y - 0.6 &&
    p.y / map.tile < sail.y + 1.6
  );
}

const W = 640;
const H = 360;

/** Adds the opening's drawing to a zone's scene and adjusts its light. */
export function decorate(scene: Scene, input: DecorateInput): Scene {
  const { world, ctx, map, onFoot, camera, seconds, tick } = input;
  const sprites: SceneSprite[] = [...scene.sprites];
  // How many of the sprites come before the plants (decision DH-161): a sprite taken out before
  // them moves them up one, as it did when they were in this list.
  let plantsAt = scene.plants?.at ?? 0;
  let effects = scene.effects;
  const pools = [...scene.pools];
  const scr = (x: number, y: number) => ({ x: x - camera.x, y: y - camera.y });
  const p = onFoot.player;
  // Hild in the net, and the waves over her.
  const hild = onFoot.actors[ctx.caller];
  if (hild !== undefined && netted(world)) {
    const at = scr(hild.x, hild.y);
    const cut = Number(world.facts['ch1.net_cut'] ?? 0);
    const working = p.work?.task === 'TASK_CUT_NET';
    const progress = working ? cut + (tick - (p.work?.since ?? tick)) : cut;
    const total = ctx.ob.firstMinutes.cutHoldSeconds * TICKS_PER_SECOND;
    const k = progress <= 0 ? -1 : Math.min(2, Math.floor((progress / total) * 3));
    sprites.push({
      sheet: 'fx_net',
      frame: k < 0 ? `net/-/${Math.floor(seconds * 6) % 4}` : `cut/-/${k}`,
      x: at.x,
      y: at.y,
      layer: 'actor',
      sort: at.y + 0.4,
    });
    const every = ctx.ob.firstMinutes.netWaveSeconds;
    const since = (tick - Number(world.facts['ch1.woke_at'] ?? 0)) / TICKS_PER_SECOND;
    const phase = (((since - every / 2) % every) + every) % every;
    if (phase < 0.6)
      sprites.push({
        sheet: 'fx_net',
        frame: `wave/-/${Math.min(5, Math.floor((phase / 0.6) * 6))}`,
        x: at.x,
        y: at.y + 2,
        layer: 'actor',
        sort: at.y + 0.6,
      });
  }
  // The faint outline at the chest's home while it is carried near.
  const outline = homeOutline(world, ctx, map.tile);
  if (outline !== null) {
    const at = scr(outline.x, outline.y);
    sprites.push({
      sheet: 'fx_outline',
      frame: `chest/${ctx.rw.chest.home.facing}/0`,
      x: at.x,
      y: at.y,
      layer: 'decal',
    });
  }
  // His chest opened: its lid thrown back.
  if (world.facts['ch1.chest_opened'] === true)
    for (let i = 0; i < sprites.length; i++) {
      const s = sprites[i];
      if (s?.sheet === 'prop_chest_thorkel' && !s.frame.startsWith('carried')) {
        const facing = s.frame.split('/')[1] ?? 's';
        sprites[i] = { ...s, sheet: 'prop_chest_open', frame: `open/${facing}/0` };
      }
    }
  // Under the lean-to, its cloth cut away and the inside warm (Book 7 section 06).
  const camp = ctx.camp;
  if (camp !== null && map.zone === camp.zone && leanToUp(world)) {
    const sail = ctx.rw.camp.sail;
    const under = underSail(world, ctx, map, p);
    const raining = input.rain != null && input.rain.drops > 0;
    for (let i = 0, n = sprites.length; i < n; i++) {
      const s = sprites[i];
      if (s?.sheet !== 'prop_sail_leanto') continue;
      if (under)
        sprites[i] = {
          ...s,
          sheet: 'fx_shelter_cut',
          frame: `cut/-/${s.frame.split('/')[2] ?? '0'}`,
        };
      // Rain beading on the cloth and running down it, drops falling from its edge (DE-27).
      if (raining)
        sprites.push({
          sheet: 'fx_rain_cloth',
          frame: `beads/-/${Math.floor(seconds * 6) % 12}`,
          x: s.x,
          y: s.y,
          layer: s.layer,
          sort: (s.sort ?? s.y) + 0.01,
        });
    }
    const home = world.homes['ISLE_SKARV'];
    if (home?.fire.lit === true) {
      const at = scr(sail.x * map.tile, (sail.y + 0.4) * map.tile);
      pools.push({ x: at.x, y: at.y - 18, radius: under ? 46 : 30, colour: [70, 38, 12] });
      // Smoke curling out under the cloth's edge.
      if (!input.reducedMotion && Math.floor(seconds * 2) % 3 === 0 && tick % 20 === 0)
        input.fx.burst('smoke', (sail.x + 1.4) * map.tile, (sail.y - 0.4) * map.tile, 1, 30);
    }
  }
  // The fallen stores carried by the swell into the shallows, bobbing as they go.
  const drift = input.bundleDrift;
  if (drift != null && drift.k < 1)
    for (let i = 0; i < sprites.length; i++) {
      const s = sprites[i];
      if (s?.sheet !== 'prop_stores_bundle' || !s.frame.startsWith('down')) continue;
      const e = drift.k * drift.k * (3 - 2 * drift.k);
      const fx = drift.from.x - camera.x;
      const fy = drift.from.y - camera.y;
      sprites[i] = {
        ...s,
        x: Math.round(fx + (s.x - fx) * e),
        y: Math.round(fy + (s.y - fy) * e + Math.sin(drift.k * 9) * 1.5),
      };
    }
  // Waking in the surf: the steerer lies, coughing, until up (decision DE-30).
  if (wreckPhase(world) === 'WAKING') {
    const at = scr(p.x, p.y);
    const getting = world.facts['ch1.getting_up'];
    const cough = Math.floor(seconds / 2.4) % 2 === 0 && seconds % 2.4 < 0.3 ? -1 : 0;
    for (let i = 0; i < sprites.length; i++) {
      const s = sprites[i];
      if (s === undefined || Math.abs(s.x - at.x) > 0.5 || Math.abs(s.y - at.y) > 0.5) continue;
      if (!input.steererSheets.includes(s.sheet)) continue;
      const facing = s.frame.split('/')[1] ?? 's';
      sprites[i] = {
        ...s,
        // Lying as the downed: the steerer's sheets name their lying state `downed` (combat v2).
        frame: typeof getting === 'number' ? `idle/${facing}/0` : `downed/${facing}/0`,
        y: s.y + cough,
      };
    }
  }
  // The seal sinks when the steerer comes near; standing gulls lift (Book 9 section 03).
  const sink = ctx.rw.life.sealSinkTiles * map.tile;
  const lift = ctx.rw.life.gullLiftTiles * map.tile;
  const pa = scr(p.x, p.y);
  const hag = hagNow(world, ctx);
  const quiet = hag !== null && hag.what !== 'HAG_SETTLE';
  for (let i = sprites.length - 1; i >= 0; i--) {
    const s = sprites[i];
    if (s === undefined) continue;
    // Only the seal and the gulls care how near the steerer is (a hypot for every sprite cost a
    // millisecond a frame among the machair's thousands of plants: decision DH-161).
    const bird = s.sheet === 'actor_gull' || s.sheet === 'actor_cormorant';
    if (s.sheet !== 'actor_seal' && !bird) continue;
    const d = Math.hypot(s.x - pa.x, s.y - pa.y);
    if (s.sheet === 'actor_seal' && d < sink && map.zone === ctx.def.zone && s.y > pa.y + 40) {
      sprites.splice(i, 1);
      if (i < plantsAt) plantsAt--;
    } else if (s.sheet === 'actor_gull' && s.frame.startsWith('stand') && d < lift) {
      const facing = s.x >= pa.x ? 'e' : 'w';
      sprites[i] = {
        ...s,
        frame: `fly/${facing}/${Math.floor(seconds * 10) % 4}`,
        y: s.y - 10 - (seconds % 1) * 4,
        sort: s.y + 40,
      };
    } else if (quiet && (s.sheet === 'actor_gull' || s.sheet === 'actor_cormorant')) {
      sprites.splice(i, 1);
      if (i < plantsAt) plantsAt--;
    }
  }
  // The pale light at the Hag's Seat on the first evening, seen far off in the west.
  if (
    world.facts['ch1.hag_light'] === true &&
    (map.zone === ctx.def.zone || map.zone === camp?.zone)
  ) {
    const lx = 12;
    const ly = 40 + Math.sin(seconds * 0.8) * 3;
    sprites.push({
      sheet: 'fx_opening',
      frame: `light/-/${Math.floor(seconds * 10) % 8}`,
      x: lx,
      y: ly,
      layer: 'actor',
      sort: -1000,
    });
    pools.push({ x: lx, y: ly - 8, radius: 22, colour: [40, 70, 66] });
  }
  // The Hag's Stone (decision DE-28).
  if (hag !== null && ctx.stone !== null && map.zone === ctx.stone.zone) {
    const s = ctx.ob.stone;
    const t = hag.seconds;
    const coldAt = s.hushSeconds;
    const holdAt = coldAt + s.coldSeconds;
    const gustAt = holdAt + hag.hold;
    const cold =
      t < coldAt
        ? 0
        : t < holdAt
          ? (t - coldAt) / s.coldSeconds
          : t < gustAt
            ? 1
            : Math.max(0, 1 - (t - gustAt) / s.gustSeconds);
    const at = scr(ctx.stone.x * map.tile, (ctx.stone.y + 0.4) * map.tile);
    if (effects !== undefined) {
      const g = effects.grade;
      const mix = (a: number, b: number): number => a + (b - a) * cold;
      const still =
        t < gustAt
          ? Math.min(1, t / s.hushSeconds)
          : Math.max(0, 1 - (t - gustAt) / (s.gustSeconds * 0.5));
      const gust = t >= gustAt && t < gustAt + s.gustSeconds ? 2.2 : 1;
      effects = {
        ...effects,
        grade: {
          gain: [mix(g.gain[0], 0.78), mix(g.gain[1], 0.96), mix(g.gain[2], 1.1)],
          lift: [mix(g.lift[0], 0), mix(g.lift[1], 16), mix(g.lift[2], 22)],
        },
        fog: Math.max(effects.fog, 0.45 * cold),
        wind: { ...effects.wind, strength: effects.wind.strength * (1 - still) * gust },
        flash: 0,
      };
    }
    if (cold > 0) {
      sprites.push({
        sheet: 'fx_hag',
        frame: `glow/-/${Math.floor(seconds * 6) % 4}`,
        x: at.x,
        y: at.y,
        layer: 'actor',
        sort: at.y + 0.2,
      });
      pools.push({ x: at.x, y: at.y - 24, radius: 30 * cold, colour: [20, 60, 56] });
      for (let k = 0; k < 3; k++) {
        const drift = input.reducedMotion ? 0 : Math.sin(seconds * 0.5 + k * 2) * 10;
        sprites.push({
          sheet: 'fx_hag_mist',
          frame: `mist/-/${(Math.floor(seconds * 2) + k) % 4}`,
          x: at.x + drift + (k - 1) * 28,
          y: at.y + 4 + k * 3,
          layer: 'actor',
          sort: at.y + 6 + k,
        });
      }
    }
    // Every second showing, a still figure at the very edge of the view, for a moment.
    if (hag.showing % s.figureEvery === 0 && t >= holdAt && t < holdAt + s.figureSeconds) {
      const side = at.x < W / 2 ? W - 10 : 10;
      sprites.push({
        sheet: 'fx_hag',
        frame: `figure/-/${Math.floor(seconds * 2) % 2}`,
        x: side,
        y: H * 0.62,
        layer: 'actor',
        sort: H,
      });
    }
  }
  plantsAt = drawSeaBurial(sprites, input, plantsAt);
  sprites.push(...input.fx.sprites(camera));
  // The first rain: a light overlay slanting downwind that never hides a threat (Book 7 section 08).
  const rain = input.rain;
  if (rain != null && rain.drops > 0)
    for (let i = 0; i < rain.drops; i++) {
      const fall = 300 + (i % 5) * 26;
      const ry = ((i * 61.7 + seconds * fall) % 380) - 10;
      const rx = ((((i * 113.3 - seconds * fall * rain.slant) % 680) + 680) % 680) - 20;
      sprites.push({
        sheet: 'fx_storm_drops',
        frame: `rain/-/${(i + Math.floor(seconds * 20)) % 4}`,
        x: Math.round(rx),
        y: Math.round(ry),
        layer: 'actor',
        sort: 1e6,
      });
    }
  const plants = scene.plants;
  return {
    ...scene,
    sprites,
    pools,
    ...(effects === undefined ? {} : { effects }),
    ...(plants === undefined || plants.at === plantsAt
      ? {}
      : { plants: { ...plants, at: plantsAt } }),
  };
}

// ------------------------------------------------------------------------- the sea burial

/** The sea burial's water: a ramp index by how deep it has gone (shallow wash to deeper sea). */
const SEA_FALLBACK: readonly (readonly [number, number, number])[] = [
  [15, 29, 46],
  [20, 42, 60],
  [25, 55, 74],
  [32, 70, 90],
  [41, 86, 105],
  [53, 104, 119],
  [74, 125, 136],
  [106, 151, 156],
];
/** The mask that has the whole bier under (px up from its anchor, taller than its drawing). */
const SEA_FULL_MASK = 26;
/** Afloat, the waterline rides this far up the bier from its anchor. */
const SEA_FLOAT_MASK = 4;

/** How the sea burial is drawn now (DG-14), or null when it is not on (also for tests). */
export interface SeaBurialView {
  readonly phase: SeaPhase | 'LAID';
  readonly t: number;
  /** The bier's frame, its lift off the ground (carried), its water mask and where it is. */
  readonly frame: string;
  readonly lift: number;
  readonly mask: number;
  readonly x: number;
  readonly y: number;
  readonly wave: number;
  readonly sinceWave: number;
  readonly underFoam: boolean;
  readonly ring: number;
}

export function seaBurialView(
  world: WorldState,
  ctx: WreckContext,
  map: ZoneMap,
  seconds: number,
): SeaBurialView | null {
  const sea = ctx.sea;
  const bodyId = ctx.bran?.body ?? 'C_THORKEL';
  const body = world.onFoot?.actors[bodyId];
  if (sea === null || body === undefined) return null;
  const ss = seaBurialState(world);
  const laid = world.facts['rites.pending'] === 'SEA' && world.facts['rites.laid'] === true;
  if (ss === null && !laid) return null;
  if (ss !== null && ss.zone !== map.zone) return null;
  if (ss === null)
    return {
      phase: 'LAID',
      t: 0,
      frame: 'bier/-/0',
      lift: 0,
      mask: 0,
      x: body.x,
      y: body.y,
      wave: 0,
      sinceWave: 0,
      underFoam: false,
      ring: 0,
    };
  const t = (world.tick - ss.at) / TICKS_PER_SECOND;
  const own = seaBalanceFor(ss, sea);
  const m = seaMoment(own, t);
  const turn = Math.abs(ss.turn) * m.turn;
  const frame =
    m.phase === 'BIER' || m.phase === 'SET' || m.phase === 'WAVES'
      ? m.wave === 0
        ? 'bier/-/0'
        : m.wave === 1
          ? 'bier/-/1'
          : `bier/-/${2 + (Math.floor(seconds * 4) % 2)}`
      : m.phase === 'BACKWASH' || m.phase === 'DRIFT'
        ? `float/-/${Math.max(0, Math.min(4, Math.round(turn / 15)))}`
        : `tilt/-/${Math.min(3, Math.floor(m.sink * 4))}`;
  const bier = own.bierSeconds;
  const lift =
    m.phase === 'BIER' ? Math.round(20 * Math.max(0, Math.min(1, t / 0.5, (bier - t) / 0.5))) : 0;
  let mask = 0;
  if (m.phase === 'SET' || m.phase === 'WAVES') {
    if (m.wave === 1 && m.sinceWave < 1.4)
      mask = Math.round(3 * Math.sin((Math.PI * m.sinceWave) / 1.4));
    if (m.wave === 2)
      mask = m.underFoam ? 10 : Math.max(0, Math.round(10 - (m.sinceWave - sea.underSeconds) * 16));
  } else if (m.phase === 'BACKWASH') mask = SEA_FLOAT_MASK;
  else if (m.phase === 'DRIFT') mask = SEA_FLOAT_MASK + m.lowerPx;
  else if (m.phase === 'SINK') {
    const from = SEA_FLOAT_MASK + m.lowerPx;
    mask = Math.round(from + (SEA_FULL_MASK - from) * m.sink);
  } else if (m.phase === 'GONE') mask = SEA_FULL_MASK;
  return {
    phase: m.phase,
    t,
    frame,
    lift,
    mask,
    x: body.x,
    y: body.y,
    wave: m.wave,
    sinceWave: m.sinceWave,
    underFoam: m.underFoam,
    ring: m.ring,
  };
}

/**
 * Thorkel on his bier at the sea's edge and the sea taking him (Book 7 section 07; DG-14): the
 * bier in place of his drawn body, carried, washed round, under the foam, afloat and turning,
 * riding lower, sinking under the water's mask (never faded), the waves' foam bands up the
 * shingle, the trail, the bubbles and the ring of foam where it went, and the gulls after.
 */
/** Returns how many sprites come before the plants once his drawn body has given way. */
function drawSeaBurial(sprites: SceneSprite[], input: DecorateInput, plantsAt: number): number {
  const { world, ctx, map, camera, seconds } = input;
  const v = seaBurialView(world, ctx, map, seconds);
  const sea = ctx.sea;
  if (v === null || sea === null) return plantsAt;
  let at = plantsAt;
  const sx = Math.round(v.x - camera.x);
  const sy = Math.round(v.y - camera.y);
  // His drawn body (its sheet and layers) gives way to the bier.
  for (let i = sprites.length - 1; i >= 0; i--) {
    const sp = sprites[i];
    if (sp?.sheet.includes('thorkel') !== true) continue;
    if (Math.abs(sp.x - sx) <= 1.5 && Math.abs(sp.y - sy) <= 1.5) {
      sprites.splice(i, 1);
      if (i < at) at--;
    }
  }
  const ramp = input.seaRamp ?? SEA_FALLBACK;
  const deep = v.phase === 'SINK' || v.phase === 'GONE' ? 4 : v.phase === 'DRIFT' ? 5 : 6;
  const colour = ramp[Math.max(0, Math.min(ramp.length - 1, deep))] ?? [53, 104, 119];
  const bob =
    !input.reducedMotion && (v.phase === 'BACKWASH' || v.phase === 'DRIFT')
      ? Math.round(Math.sin(seconds * 2.4))
      : 0;
  sprites.push({
    sheet: 'fx_sea_burial',
    frame: v.frame,
    x: sx,
    y: sy - v.lift + bob,
    layer: 'actor',
    sort: sy,
    ...(v.mask > 0 ? { wade: { mask: v.mask, colour } } : {}),
  });
  if (v.phase === 'LAID') return at;
  const ss = seaBurialState(world);
  if (ss === null) return at;
  const tl = seaTimeline(seaBalanceFor(ss, sea));
  const T = map.tile;
  // The three waves' foam bands rushing up the shingle and drawing back, each further up.
  tl.waves.forEach((at, i) => {
    const s = v.t - at;
    if (s < 0 || s >= 1.6) return;
    const k =
      s < 0.6 ? Math.floor((s / 0.6) * 4) : 4 + Math.min(3, Math.floor(((s - 0.6) / 1.0) * 4));
    const reach = ss.edge.y - (sea.firstWashTiles + 0.5 * i);
    const from = ss.edge.y + 2.5;
    const e = s < 0.6 ? Math.sin(((s / 0.6) * Math.PI) / 2) : 1 - (s - 0.6) / 1.0;
    const y = (from + (reach - from) * e) * T;
    sprites.push({
      sheet: 'fx_sea_burial',
      frame: `wave/-/${k}`,
      x: Math.round(ss.edge.x * T - camera.x),
      y: Math.round(y - camera.y) + 14,
      layer: 'decal',
    });
  });
  // The first wave washing round the bier; the second's foam over it.
  if (v.wave === 1 && v.sinceWave < 1.2)
    sprites.push({
      sheet: 'fx_sea_burial',
      frame: `wash/-/${Math.min(5, Math.floor((v.sinceWave / 1.2) * 6))}`,
      x: sx,
      y: sy,
      layer: 'actor',
      sort: sy + 0.5,
    });
  if (v.wave === 2 && v.sinceWave < sea.underSeconds + 0.4)
    sprites.push({
      sheet: 'fx_sea_burial',
      frame: `over/-/${Math.min(5, Math.floor((v.sinceWave / (sea.underSeconds + 0.4)) * 6))}`,
      x: sx,
      y: sy,
      layer: 'actor',
      sort: sy + 0.6,
    });
  // Foam trailing from it as it drifts; bubbles as it sinks; the ring of foam where it went.
  if (v.phase === 'BACKWASH' || v.phase === 'DRIFT')
    sprites.push({
      sheet: 'fx_sea_burial',
      frame: `trail/-/${Math.floor(seconds * 8) % 4}`,
      x: sx,
      y: sy - 6,
      layer: 'actor',
      sort: sy - 1,
    });
  if (v.phase === 'SINK')
    sprites.push({
      sheet: 'fx_sea_burial',
      frame: `bubble/-/${Math.floor(seconds * 10) % 4}`,
      x: sx,
      y: sy,
      layer: 'actor',
      sort: sy + 0.7,
    });
  if (v.phase === 'GONE' && v.ring < 1)
    sprites.push({
      sheet: 'fx_sea_burial',
      frame: `ring/-/${Math.min(7, Math.floor(v.ring * 8))}`,
      x: sx,
      y: sy,
      layer: 'actor',
      sort: sy + 0.7,
    });
  // Gulls cross over the place after (Book 10 seaAfter).
  if (v.t >= tl.line)
    for (let g = 0; g < 2; g++) {
      const k = (v.t - tl.line) / 3.5 - g * 0.18;
      if (k < 0 || k > 1) continue;
      sprites.push({
        sheet: 'actor_gull',
        frame: `fly/e/${Math.floor(seconds * 10 + g) % 4}`,
        x: Math.round(sx - 200 + k * 400),
        y: Math.round(sy - 60 - g * 14 + Math.sin(k * 6 + g) * 4),
        layer: 'actor',
        sort: sy + 100,
      });
    }
  return at;
}

/**
 * The camera holds the bier in view and eases out to sea with it, at most Book 10's seaCamera
 * from where it began, no cut and no zoom; calmer with reduced motion (DG-14).
 */
export function seaCamera(
  world: WorldState,
  ctx: WreckContext,
  map: ZoneMap,
  camera: { readonly x: number; readonly y: number },
  reducedMotion: boolean,
): { x: number; y: number } {
  const sea = ctx.sea;
  const ss = seaBurialState(world);
  const body = world.onFoot?.actors[ctx.bran?.body ?? 'C_THORKEL'];
  if (sea === null || ss?.zone !== map.zone || body === undefined) return camera;
  const tl = seaTimeline(seaBalanceFor(ss, sea));
  const t = (world.tick - ss.at) / TICKS_PER_SECOND;
  const ease0 = Math.max(0, Math.min(1, t / 1.5, (tl.control - t) / 1.5));
  const k = ease0 * ease0 * (3 - 2 * ease0) * (reducedMotion ? 0.5 : 1);
  let dx = (body.x - (camera.x + W / 2)) * k;
  let dy = (body.y - 30 - (camera.y + H / 2)) * k;
  const max = sea.cameraTiles * map.tile;
  const len = Math.hypot(dx, dy);
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  return { x: Math.round(camera.x + dx), y: Math.round(camera.y + dy) };
}

/** Where the Hag's Stone pulls the view (decision DE-28): a share of the way, at most 2 tiles. */
export function hagCamera(
  world: WorldState,
  ctx: WreckContext,
  map: ZoneMap,
  camera: { readonly x: number; readonly y: number },
  reducedMotion: boolean,
): { x: number; y: number } {
  const hag = hagNow(world, ctx);
  if (hag === null || ctx.stone?.zone !== map.zone) return camera;
  const s = ctx.ob.stone;
  const t = hag.seconds;
  const coldAt = s.hushSeconds;
  const holdAt = coldAt + s.coldSeconds;
  const gustAt = holdAt + hag.hold;
  const ease =
    t < coldAt
      ? 0
      : t < holdAt
        ? (t - coldAt) / s.coldSeconds
        : t < gustAt
          ? 1
          : Math.max(0, 1 - (t - gustAt) / s.gustSeconds);
  const k = ease * ease * (3 - 2 * ease) * s.cameraPull * (reducedMotion ? 0.5 : 1);
  const cx = camera.x + W / 2;
  const cy = camera.y + H / 2;
  let dx = (ctx.stone.x * map.tile - cx) * k;
  let dy = (ctx.stone.y * map.tile - 30 - cy) * k;
  const max = s.cameraPullMaxTiles * map.tile;
  const len = Math.hypot(dx, dy);
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  return { x: Math.round(camera.x + dx), y: Math.round(camera.y + dy) };
}

// ---------------------------------------------------------------------------- the cold open

/** Where Thorkel's boat is in the cold open (strand world pixels), and how it rolls. */
export function coldBoat(
  world: WorldState,
  ctx: WreckContext,
  tile: number,
): { x: number; y: number; roll: number; t: number } | null {
  const t = coldOpenSeconds(world);
  if (t === null) return null;
  const c = ctx.rw.coldOpen;
  const f = Math.min(1, t / c.strikeSeconds);
  const oar = Number(world.facts['ch1.cold_oar'] ?? 0);
  // Driven west on to the skerry whatever the oar does; the oar only checks her head a little.
  const x = (44 - 19 * f) * tile;
  const y = (57.5 - 3.2 * f + oar * 0.8) * tile + Math.sin(t * 1.9) * 4;
  return { x, y, roll: Math.sin(t * 1.3) * 2 + oar, t };
}

/** The night's ambient light (assets/art/render.json phases.night), as a share of the day's. */
const NIGHT_AMBIENT = [92 / 255, 116 / 255, 164 / 255] as const;

/** The storm's fixed parts for a cold open: its strikes, waves and green water (DF-16, DF-17). */
export interface ColdStorm {
  readonly b: StormBalance;
  readonly list: readonly Strike[];
  readonly waves: readonly Wave[];
  readonly green: readonly number[];
  /** Whether a world pixel is open sea (no swell is drawn over rock or sand). */
  readonly isSea: (x: number, y: number) => boolean;
}

/** The storm's fixed parts, from Book 10 section 25 and the cold open's script. */
export function coldStorm(
  b: StormBalance,
  ctx: WreckContext,
  isSea: (x: number, y: number) => boolean,
): ColdStorm {
  const until = ctx.rw.coldOpen.strikeSeconds;
  return { b, list: strikes(b, until), waves: waves(b, until), green: greenWater(b, until), isSea };
}

/**
 * The cold open's scene over the strand's sea at night (design addendum 2.5 section 3): the ship
 * pitching and rolling with its people braced, the storm's swells, foam, breaking waves, spray,
 * green water, rain, rolling mist, the lantern's swinging pool, light varying in drifting patches
 * and lightning lighting it all with hard shadows; then the strike on the skerry and the black.
 */
export function coldOpenScene(
  scene: Scene,
  world: WorldState,
  ctx: WreckContext,
  map: ZoneMap,
  camera: { readonly x: number; readonly y: number },
  bodyModel: 'A' | 'B',
  reducedMotion: boolean,
  storm: ColdStorm,
): { scene: Scene; drawing: StormDrawing | null } {
  const boat = coldBoat(world, ctx, map.tile);
  if (boat === null) return { scene, drawing: null };
  const c = ctx.rw.coldOpen;
  const t = boat.t;
  const drawing = drawStorm({
    t,
    b: storm.b,
    reduced: reducedMotion,
    bx: Math.round(boat.x - camera.x),
    by: Math.round(boat.y - camera.y),
    camera,
    tile: map.tile,
    isSea: storm.isSea,
    bodyModel,
    strikeSeconds: c.strikeSeconds,
    list: storm.list,
    waveList: storm.waves,
    greenList: storm.green,
  });
  const sprites: SceneSprite[] = [
    ...scene.sprites,
    ...drawing.under,
    ...drawing.ship,
    ...drawing.over,
  ];
  const black =
    t >= c.blackSeconds
      ? 1
      : t >= c.strikeSeconds
        ? (t - c.strikeSeconds) / (c.blackSeconds - c.strikeSeconds)
        : 0;
  const e = scene.effects;
  const dark = 1 - black;
  // The night grade under the night's blue ambience (render.json), dark so the foam, the spray,
  // the mist and the lantern read against it. In a flash the scene is lit to the lightning's share
  // of the day grade: drawn in the day's ambience with the gain eased from the night's effective
  // light (gain x ambient) up to that share, so the bright frames light ship, sea and land alike.
  const lit = drawing.flash;
  const night = { gain: [0.46, 0.54, 0.7], lift: [0, 1, 6] };
  const flashing = lit > 0.001;
  const gain = night.gain.map((g, i) => {
    const eff = g * (NIGHT_AMBIENT[i] ?? 1);
    return (flashing ? eff + (storm.b.flashDayShare - eff) * lit : g) * dark;
  }) as [number, number, number];
  const lift = night.lift.map((l) => l * (1 - lit) * dark) as [number, number, number];
  const strike = strikeNow(t, storm.list);
  const away = strike === null ? { x: 0, y: 1 } : { x: strike.across < 0.5 ? 1.2 : -1.2, y: 0.9 };
  const patch = storm.b.lightVaries;
  return {
    drawing,
    scene: {
      // Black: nothing drawn, the plants neither.
      ...(black >= 1 ? withSprites(scene, []) : scene),
      sprites: black >= 1 ? [] : sprites,
      pools: [...scene.pools, ...(black >= 1 ? [] : drawing.pools)],
      phase: flashing ? 'day' : 'night',
      ...(e === undefined
        ? {}
        : {
            effects: {
              ...e,
              flash: 0,
              fog: Math.max(e.fog * 0.3, 0.1),
              wind: { ...e.wind, strength: 1 },
              grade: { gain, lift },
              sun: {
                x: away.x,
                y: away.y,
                strength: drawing.flash >= 1 - 1e-6 ? 0.9 : 0,
              },
              shadows: drawing.flash > 0.5 ? [...e.shadows, ...drawing.shadows] : e.shadows,
              patches: {
                share: patch.share,
                size: patch.patchTiles * map.tile,
                vx: -patch.driftTiles * map.tile,
                vy: 0,
              },
            },
          }),
    },
  };
}
