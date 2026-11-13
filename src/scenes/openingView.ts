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
  const raised = world.facts['ch1.shelter_raised'];
  const raising =
    world.onFoot?.player.work?.task === 'TASK_RAISE_SHELTER' ? world.onFoot.player.work : null;
  const raisedAt = Number(world.facts['ch1.shelter_raised_at'] ?? -1e9);
  const sail = ctx.rw.camp.sail;
  for (const p of stageProps) {
    if (p.sheet !== 'prop_sail_leanto') continue;
    if (raised === false) {
      // The torn sail folded beside the two oars, or being hauled up between them.
      const k =
        raising === null
          ? -1
          : Math.min(7, Math.floor(((tick - raising.since) / raising.ticks) * 8));
      out.push({
        sheet: 'prop_sail_raise',
        frame: k < 0 ? 'folded/-/0' : `raise/-/${k}`,
        x: p.x,
        y: p.y,
        fixed: true,
      });
    } else if (tick - raisedAt < 60) {
      // The cloth filling and settling.
      out.push({
        sheet: 'prop_sail_raise',
        frame: `fill/-/${Math.min(5, Math.floor((tick - raisedAt) / 10))}`,
        x: p.x,
        y: p.y,
        fixed: true,
      });
    }
  }
  if (raised !== false) {
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
  const stage = world.homes['ISLE_SKARV']?.stage ?? 'S0';
  for (const d of doorsHere(map, stage, world.facts)) {
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
  const raised = world.facts['ch1.shelter_raised'];
  const raisedAt = Number(world.facts['ch1.shelter_raised_at'] ?? -1e9);
  return props.filter(
    (p) => p.sheet !== 'prop_sail_leanto' || (raised !== false && tick - raisedAt >= 60),
  );
}

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
}

/** Whether the steerer stands under the raised sail (its cloth cut away, the rain heard on it). */
export function underSail(
  world: WorldState,
  ctx: WreckContext,
  map: ZoneMap,
  p: { x: number; y: number },
): boolean {
  const camp = ctx.camp;
  if (camp?.zone !== map.zone || world.facts['ch1.shelter_raised'] === false) return false;
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
  if (camp !== null && map.zone === camp.zone && world.facts['ch1.shelter_raised'] !== false) {
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
    const d = Math.hypot(s.x - pa.x, s.y - pa.y);
    if (s.sheet === 'actor_seal' && d < sink && map.zone === ctx.def.zone && s.y > pa.y + 40)
      sprites.splice(i, 1);
    else if (s.sheet === 'actor_gull' && s.frame.startsWith('stand') && d < lift) {
      const facing = s.x >= pa.x ? 'e' : 'w';
      sprites[i] = {
        ...s,
        frame: `fly/${facing}/${Math.floor(seconds * 10) % 4}`,
        y: s.y - 10 - (seconds % 1) * 4,
        sort: s.y + 40,
      };
    } else if (quiet && (s.sheet === 'actor_gull' || s.sheet === 'actor_cormorant'))
      sprites.splice(i, 1);
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
  return { ...scene, sprites, pools, ...(effects === undefined ? {} : { effects }) };
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
      ...scene,
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
