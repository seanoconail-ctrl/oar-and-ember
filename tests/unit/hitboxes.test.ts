/**
 * The user's fourth playtest, request 20 (decision DH-76): "Collision detection is off, especially on
 * the spear. Check every weapon's hitboxes against its animation frames, and add a test."
 *
 * For every weapon layer the game draws an attack on (the seax: both steerers, Conn and Oddi; the
 * hand axe: Bran and Ketill; the spear: Svart), every move Book 10's "Frame data" gives that weapon,
 * and every facing, the drawn blade or spear tip in the move's active frame is measured over the
 * ground and compared with the reach its hitbox gives (Book 10 "Hitboxes": reach to the near edge of
 * the body struck, plus the step over the active ticks). Facing east or west the tip's reach is its
 * distance from the foot anchor along the row; facing south or north the tip is drawn over the
 * ground (DH-76), so its reach is its distance down or up the screen less (or plus) the height the
 * tip is carried at, read from the same move's east and west frames. Within hitboxTolerance, the
 * hitbox covers the drawn tip and reaches nothing well beyond it. A spear's thrust is a line: its
 * shaft is drawn where the hitbox holds it (right of the facing), and the hitbox meets nothing far
 * off that line. The sword, Dane axe and club are drawn only in finishers (no one fights with them
 * in Chapter 1), which strike the offered foe and use no hitbox.
 */
import { describe, expect, it } from 'vitest';
import { parseCombatBalance } from '../../src/content/combatBalance.ts';
import type { MeleeWeaponName, MoveName } from '../../src/content/combatBalance.ts';
import { parsePt4Balance } from '../../src/content/pt4Balance.ts';
import { NO_PIXEL } from '../../src/render/indexedImage.ts';
import type { IndexedImage } from '../../src/render/indexedImage.ts';
import { inHitbox } from '../../src/sim/land/fight.ts';
import { loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';

const balance = loadBalanceJson();
const cb = parseCombatBalance(balance);
const pt4 = parsePt4Balance(balance);
const sheets = new Map(loadSheets().map((s) => [s.name, s]));
const TILE = 24;
const TOL = pt4.hitboxToleranceTiles * TILE;

/** Each weapon layer the game draws attacks on, and its Book 10 weapon row. */
const LAYERS: readonly [string, MeleeWeaponName][] = [
  ['layer_weapon_seax_a', 'Seax'],
  ['layer_weapon_seax_b', 'Seax'],
  ['layer_weapon_seax_conn', 'Seax'],
  ['layer_weapon_seax_oddi', 'Seax'],
  ['layer_weapon_axe_bran_heavy', 'Hand axe'],
  ['layer_weapon_axe_ketill_heavy', 'Hand axe'],
  ['layer_weapon_spear_svart', 'Spear'],
];

/** Each Frame data move, the animation it is drawn with, and its active frame (zoneScene). */
const MOVES: readonly [MoveName, string, number][] = [
  ['light1', 'light1', 1],
  ['light2', 'light2', 1],
  ['light3', 'light3', 1],
  ['heavy', 'heavy', 1],
  ['charged', 'heavy', 1],
  ['riposte', 'riposte', 1],
  ['backstab', 'backstab', 1],
  ['lunge', 'lunge', 1],
];

interface Px {
  x: number;
  y: number;
}

/** The drawn pixels of a frame, relative to the sheet's foot anchor. */
function pixels(img: IndexedImage, pivot: Px): Px[] {
  const out: Px[] = [];
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if (img.pixels[y * img.width + x] !== NO_PIXEL) out.push({ x: x - pivot.x, y: y - pivot.y });
  return out;
}

/** The tip of a side view: the furthest pixel along the row, and the height it is carried at. */
function sideTip(px: Px[], sign: 1 | -1): { reach: number; height: number } {
  const reach = Math.max(...px.map((p) => sign * p.x));
  const tip = px.filter((p) => sign * p.x >= reach - 1);
  const height = -tip.reduce((s, p) => s + p.y, 0) / Math.max(1, tip.length);
  return { reach, height };
}

describe('every weapon’s hitbox matches its drawn active frames (request 20; DH-76)', () => {
  for (const [layer, weapon] of LAYERS) {
    it(`${layer} (${weapon})`, () => {
      const sheet = sheets.get(layer);
      expect(sheet, layer).toBeDefined();
      if (sheet === undefined) return;
      const row = cb.weapons[weapon];
      let measured = 0;
      for (const [move, anim, frame] of MOVES) {
        const m = row.moves[move];
        if (m === undefined || sheet.anims[anim] === undefined) continue;
        const reach =
          (row.reachTiles + (move === 'riposte' ? cb.parry.riposteReachExtra : 0)) * TILE;
        // The lunge's distance is covered in its wind-up's strides; its active ticks step nothing.
        const step = (move === 'lunge' ? 0 : m.step) * TILE;
        const frameOf = (facing: string) => sheet.frames.get(`${anim}/${facing}/${String(frame)}`);
        const east = frameOf('e');
        const west = frameOf('w');
        if (east === undefined || west === undefined) throw new Error(`${layer} ${anim}`);
        const e = sideTip(pixels(east, sheet.pivot), 1);
        const w = sideTip(pixels(west, sheet.pivot), -1);
        const height = (e.height + w.height) / 2;
        const drawn: Record<string, number | null> = { e: e.reach, w: w.reach };
        for (const facing of ['s', 'n'] as const) {
          const img = frameOf(facing);
          const px = img === undefined ? [] : pixels(img, sheet.pivot);
          // Facing away (north) a cut can be wholly behind the body: nothing drawn to compare.
          if (px.length === 0) {
            drawn[facing] = null;
            continue;
          }
          drawn[facing] =
            facing === 's'
              ? Math.max(...px.map((p) => p.y)) + height
              : Math.max(...px.map((p) => -p.y)) - height;
        }
        for (const [facing, r] of Object.entries(drawn)) {
          if (r === null) continue;
          const where = `${layer} ${move} facing ${facing}: drawn tip ${r.toFixed(1)} px, hitbox ${reach.toFixed(1)} (+${step.toFixed(1)} step)`;
          // The hitbox reaches the drawn tip (the tip is never beyond what it can hit)...
          expect(reach + step + TOL, where).toBeGreaterThanOrEqual(r);
          // ...and nothing well beyond it.
          expect(reach, where).toBeLessThanOrEqual(r + step + TOL);
          measured++;
        }
        // A thrust's shaft is drawn where the hitbox holds it: right of the facing line.
        const hb = pt4.hitboxes[weapon];
        if (hb?.shape === 'THRUST')
          for (const facing of ['s', 'n'] as const) {
            const img = frameOf(facing);
            if (img === undefined) continue;
            const px = pixels(img, sheet.pivot);
            const mid = px.reduce((s, p) => s + p.x, 0) / Math.max(1, px.length);
            // Facing south the right hand is to the screen's left; facing north, to its right.
            const right = facing === 's' ? -mid : mid;
            expect(
              Math.abs(right - hb.handTiles * TILE),
              `${layer} ${move} ${facing}: shaft ${right.toFixed(1)} px right of the facing line`,
            ).toBeLessThanOrEqual(hb.halfWidthTiles * TILE + 2);
          }
      }
      expect(measured).toBeGreaterThan(8);
    });
  }

  it('a spear thrust meets what its shaft touches, and nothing well off its line (it is no arc)', () => {
    const reach = (cb.weapons.Spear.reachTiles + cb.bodyRadiusTiles) * TILE;
    const f = { weapon: 'Spear' as const, angle: 0 };
    const hand = (pt4.hitboxes.Spear?.handTiles ?? 0) * TILE;
    // On the line, at the tip: met.
    expect(inHitbox({ cb, pt4 }, f, reach - 1, hand, reach, TILE)).toBe(true);
    // The old 100-degree arc met a body 45 degrees off at the same distance; a thrust does not.
    const off = reach * 0.9;
    expect(
      inHitbox(
        { cb, pt4 },
        f,
        off * Math.cos(Math.PI / 4),
        off * Math.sin(Math.PI / 4),
        reach,
        TILE,
      ),
    ).toBe(false);
    expect(
      inHitbox(
        { cb, pt4 },
        f,
        off * Math.cos(-Math.PI / 4),
        off * Math.sin(-Math.PI / 4),
        reach,
        TILE,
      ),
    ).toBe(false);
    // Beyond the reach, or behind: not met.
    expect(inHitbox({ cb, pt4 }, f, reach + 2, hand, reach, TILE)).toBe(false);
    expect(inHitbox({ cb, pt4 }, f, -6, hand, reach, TILE)).toBe(false);
    // A swing keeps its arc (the seax: 50 degrees either side within reach).
    const seax = { weapon: 'Seax' as const, angle: 0 };
    const sr = (cb.weapons.Seax.reachTiles + cb.bodyRadiusTiles) * TILE;
    expect(
      inHitbox({ cb, pt4 }, seax, sr * 0.9 * Math.cos(0.7), sr * 0.9 * Math.sin(0.7), sr, TILE),
    ).toBe(true);
    expect(
      inHitbox({ cb, pt4 }, seax, sr * 0.9 * Math.cos(1.0), sr * 0.9 * Math.sin(1.0), sr, TILE),
    ).toBe(false);
  });

  it('every swing’s drawn tip lies inside its arc, facing south and north', () => {
    let checked = 0;
    for (const [layer, weapon] of LAYERS) {
      const hb = pt4.hitboxes[weapon];
      const sheet = sheets.get(layer);
      if (hb?.shape !== 'SWING' || sheet === undefined) continue;
      for (const [move, anim, frame] of MOVES) {
        if (cb.weapons[weapon].moves[move] === undefined) continue;
        const side = (facing: string, sign: 1 | -1) => {
          const img = sheet.frames.get(`${anim}/${facing}/${String(frame)}`);
          return img === undefined ? null : sideTip(pixels(img, sheet.pivot), sign);
        };
        const e = side('e', 1);
        const w = side('w', -1);
        if (e === null || w === null) continue;
        const height = (e.height + w.height) / 2;
        for (const facing of ['s', 'n'] as const) {
          const img = sheet.frames.get(`${anim}/${facing}/${String(frame)}`);
          const px = img === undefined ? [] : pixels(img, sheet.pivot);
          if (px.length === 0) continue;
          const sign = facing === 's' ? 1 : -1;
          // The tip over the ground: along the facing (the screen's rows, less its height) and
          // across it (the screen's columns).
          const tip = px.reduce((a, p) => (sign * p.y > sign * a.y ? p : a));
          const along = sign * tip.y + sign * height;
          if (along < TILE * 0.25) continue;
          const off = (Math.atan2(Math.abs(tip.x), along) * 180) / Math.PI;
          expect(off, `${layer} ${move} ${facing}`).toBeLessThanOrEqual(hb.arcDegrees / 2);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
});
