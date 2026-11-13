/**
 * The steerer's word over a body (the user's fourth playtest, request 4: "Interacting with some
 * bodies (Thorkel's first) gives a short comment from the steerer"; decisions DH-24 to DH-26).
 *
 * - **Thorkel** has his own lines, said in order, one each time the steerer looks at him (the
 *   first with his key, when it is taken from his body), wherever he lies: in the fold, on his bier
 *   by the broch, at the rite's place. Once his lines are said, he is no longer offered.
 * - **A fallen foe** lying dead gets one line, once, from the fallen pool, never the line said
 *   last (whoever it was over).
 * - The line is the steerer's own speech, shown under the steerer's name with a breath out and no
 *   blip (Book 11 section 08; decision DG-4's convention). It never names the steerer's gender
 *   (Book 8 section 03; the lines are lint-checked).
 *
 * State is in facts: `remark.<id>` (lines said over that body) and `remark.last` (the last line).
 * Pure and deterministic: no random stream is drawn here.
 */
import type { Content } from '../../content/registry.ts';
import { parseStory4Balance } from '../../content/story4Balance.ts';
import type { Id } from '../../core/ids.ts';
import type { PlacedUse } from '../home/camp.ts';
import { setFact } from '../ledger/ledger.ts';
import type { ZoneMap } from '../land/zoneMap.ts';
import type { WorldState } from '../world.ts';

export interface RemarksContext {
  readonly thorkel: Id;
  readonly thorkelLines: readonly string[];
  readonly fallenLines: readonly string[];
  /** Book 10 remarkReach, in tiles. */
  readonly reachTiles: number;
}

export function remarksContext(
  content: Pick<Content, 'opening' | 'balance'>,
): RemarksContext | null {
  const r = content.opening?.rework.story4?.remarks;
  if (r === undefined) return null;
  return {
    thorkel: r.thorkel,
    thorkelLines: r.thorkelLines,
    fallenLines: r.fallenLines,
    reachTiles: parseStory4Balance(content.balance).remarkReachTiles,
  };
}

/** The steerer's speech over a body: shown under the steerer's name, a breath out, no blip. */
export interface RemarkEvent {
  readonly type: 'STEERER_SPOKE';
  readonly lineKey: string;
  /** Whom it was said over. */
  readonly about: Id;
}

export const FACT_REMARK_LAST = 'remark.last';
const said = (world: WorldState, id: Id): number => Number(world.facts[`remark.${id}`] ?? 0);

/** The line the steerer would say over `id` now, or null if nothing is left to say. */
export function remarkFor(world: WorldState, ctx: RemarksContext, id: Id): string | null {
  const n = said(world, id);
  if (id === ctx.thorkel) return ctx.thorkelLines[n] ?? null;
  if (n > 0) return null;
  const last = world.facts[FACT_REMARK_LAST];
  // A pool never says its last line twice running: the first not said last, in the pool's order
  // after the last one (so a run of bodies walks through the pool).
  const pool = ctx.fallenLines;
  if (pool.length === 0) return null;
  const at = pool.indexOf(String(last));
  for (let k = 1; k <= pool.length; k++) {
    const key = pool[(at + k + pool.length) % pool.length];
    if (key !== undefined && key !== last) return key;
  }
  return pool[0] ?? null;
}

/** Whether the steerer may say a word over this actor: a body lying in the world. */
function speakable(world: WorldState, ctx: RemarksContext, id: Id): boolean {
  const a = world.onFoot?.actors[id];
  if (a?.pose !== 'dead') return false;
  if (id === ctx.thorkel) return true;
  // A fallen foe (their fight says whose side they were on).
  return a.fight?.side === 'ENEMY';
}

/** The words over bodies in the zone in view, at each body (the play view names them). */
export function bodyRemarkUses(world: WorldState, ctx: RemarksContext, map: ZoneMap): PlacedUse[] {
  const onFoot = world.onFoot;
  if (onFoot === null || world.talk !== null || onFoot.carrying !== null) return [];
  if (onFoot.zone !== map.zone) return [];
  const out: PlacedUse[] = [];
  for (const id of Object.keys(onFoot.actors).sort()) {
    const a = onFoot.actors[id];
    if (a === undefined || !speakable(world, ctx, id) || remarkFor(world, ctx, id) === null)
      continue;
    // An arrow still in the body is pulled first (Interact takes it); the word comes after.
    if (onFoot.stuck.some((s) => s.target === id && !s.broken)) continue;
    out.push({
      use: { kind: 'OPENING', site: 'remark', target: id },
      x: a.x,
      y: a.y,
      reach: ctx.reachTiles * map.tile,
    });
  }
  return out;
}

/** The steerer says the word over `id` (if one is left), once each. */
export function remark(
  world: WorldState,
  ctx: RemarksContext,
  id: Id,
  emit: (e: RemarkEvent) => void,
): void {
  const key = remarkFor(world, ctx, id);
  if (key === null) return;
  setFact(world, `remark.${id}`, said(world, id) + 1);
  setFact(world, FACT_REMARK_LAST, key);
  emit({ type: 'STEERER_SPOKE', lineKey: key, about: id });
}
