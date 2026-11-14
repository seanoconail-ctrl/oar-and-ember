/**
 * The user's fourth playtest, the enemy's choices of whom and how far (Book 10 section 07,
 * "Guarding and pursuit", "Target choice" and "Running off"; decisions DH-72 to DH-75):
 *
 * - **Target choice by threat.** At each decision a fighter scores every foe it can see (damage done
 *   to its group lately, a blow on itself, the steerer, a foe in an attack on its group, nearness, a
 *   hurt foe) and keeps its foe unless another scores clearly more. Striking one wrecker turns the
 *   others on the striker, not on Bran.
 * - **Guards and pursuers, with no pacing at a limit.** A band with a post guards it: when its foe
 *   is further from the post than guardRadius it runs back, and comes out again only when the foe
 *   is within guardResume of the post (or strikes it). A band without one pursues to its leash, held
 *   the same way, and keeps together: ahead of its friends it walks, then waits.
 * - **Running off.** A foe let go plans a way out of the steerer's sight (or to the zone's edge) that
 *   never brings it nearer the steerer, runs it, and is gone once out of sight.
 *
 * Deterministic: no stream is drawn; ties fall to the id's order.
 */
import type { Id } from '../../core/ids.ts';
import type { TileXY } from './path.ts';
import { tileBlocks, tileOf } from './zoneMap.ts';
import type { ZoneMap } from './zoneMap.ts';
import type { OnFootActor, OnFootState } from './onFoot.ts';
import type { ActorFight, Battle, FightWorld } from './fight.ts';

const STEERER = 'P_STEERER';

/** One blow's harm to a group, remembered for Book 10 threatMemory. */
export interface Harm {
  readonly by: Id;
  readonly victim: Id;
  readonly group: Id | null;
  readonly dmg: number;
  readonly tick: number;
}

/** Notes a blow's damage to an enemy (for Book 10 threatDamage and threatStruckMe). */
export function noteHarm(
  fw: Pick<FightWorld, 'world' | 'ctx'>,
  victim: Id,
  by: Id,
  dmg: number,
): void {
  const onFoot = fw.world.onFoot;
  const battle = onFoot?.battle ?? null;
  const fa = onFoot?.actors[victim]?.fight;
  // A blow turned, blocked or parried is still a blow at them (no damage, but struck at).
  if (battle === null || fa === undefined || by === victim || dmg < 0) return;
  const tick = fw.world.tick;
  const keep = fw.ctx.pt4.threat.memoryTicks;
  const list = (battle.harm ?? []).filter((h) => tick - h.tick <= keep);
  list.push({ by, victim, group: fa.group, dmg, tick });
  battle.harm = list;
}

/** Whether `by` struck `victim` within Book 10's threatMemory (or `within` ticks). */
export function struckBy(
  battle: Battle | null | undefined,
  victim: Id,
  by: Id,
  tick: number,
  within: number,
): boolean {
  return (battle?.harm ?? []).some(
    (h) => h.victim === victim && h.by === by && tick - h.tick <= within,
  );
}

/** A foe seen: who, where, how far. */
export interface Seen {
  readonly id: Id;
  readonly pos: { readonly x: number; readonly y: number };
  readonly d: number;
}

/**
 * Book 10 "Target choice": a foe's threat to a fighter, by what it has done lately and what it is
 * doing, where it is and how hurt it is, with a bonus for the foe the fighter already has.
 */
export function threatOf(fw: FightWorld, me: Id, fa: ActorFight, foe: Seen): number {
  const { world, ctx, map } = fw;
  const onFoot = world.onFoot;
  if (onFoot === null) return 0;
  const t = ctx.pt4.threat;
  const tick = world.tick;
  const battle = onFoot.battle ?? null;
  let score = 0;
  for (const h of battle?.harm ?? []) {
    if (h.by !== foe.id || tick - h.tick > t.memoryTicks) continue;
    if (h.victim === me || (fa.group !== null && h.group === fa.group))
      score += t.perDamage * h.dmg;
  }
  if (struckBy(battle, me, foe.id, tick, t.memoryTicks)) score += t.struckMe;
  if (foe.id === STEERER) score += t.steerer;
  if (attackingMine(onFoot, foe.id, me, fa, tick)) score += t.attacking;
  score += t.near * Math.max(0, 1 - foe.d / Math.max(1, t.nearTiles * map.tile));
  const share = vitalityShare(fw, foe.id);
  score += t.weak * (1 - share);
  if (fa.ai.target === foe.id) score += t.keep;
  return score;
}

function vitalityShare(fw: FightWorld, id: Id): number {
  if (id === STEERER) return fw.world.player.vitality / Math.max(1, fw.ctx.cb.vitality);
  const fa = fw.world.onFoot?.actors[id]?.fight;
  return fa === undefined ? 1 : fa.vitality / Math.max(1, fa.maxVitality);
}

/** Whether `foe` is in an attack on, or locked on to, this fighter or one of its group. */
function attackingMine(
  onFoot: OnFootState,
  foe: Id,
  me: Id,
  fa: ActorFight,
  tick: number,
): boolean {
  const mine = (id: Id | null | undefined): boolean =>
    id != null &&
    (id === me || (fa.group !== null && onFoot.actors[id]?.fight?.group === fa.group));
  if (foe === STEERER) {
    const f = onFoot.player.fight;
    if (mine(onFoot.player.stance?.lockOn ?? null)) return true;
    if (f == null || tick >= f.activeEnd) return false;
    const attacking = [
      'light1',
      'light2',
      'light3',
      'heavyRelease',
      'lunge',
      'riposte',
      'backstab',
      'chargeL0',
      'chargeL1',
      'chargeL2',
    ];
    if (!attacking.includes(f.state)) return false;
    // In an attack: on whoever it faces nearest in front.
    return mine(facedNearest(onFoot, onFoot.player, f.angle));
  }
  const of = onFoot.actors[foe]?.fight;
  if (of === undefined) return false;
  const busy = [
    'light1',
    'light2',
    'light3',
    'heavyRelease',
    'lunge',
    'riposte',
    'chargeL0',
    'chargeL1',
    'chargeL2',
  ];
  return busy.includes(of.f.state) && mine(of.ai.target);
}

/** The enemy nearest in front of a point facing `angle` (within 60 degrees), if any. */
function facedNearest(
  onFoot: OnFootState,
  from: { readonly x: number; readonly y: number },
  angle: number,
): Id | null {
  let best: Id | null = null;
  let bestD = Infinity;
  for (const [id, a] of Object.entries(onFoot.actors).sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
    if (a.fight?.side !== 'ENEMY' || a.fight.dead !== null) continue;
    const dx = a.x - from.x;
    const dy = a.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;
    const off = Math.acos(
      Math.max(-1, Math.min(1, (dx * Math.cos(angle) + dy * Math.sin(angle)) / d)),
    );
    if (off > Math.PI / 3 || d >= bestD) continue;
    best = id;
    bestD = d;
  }
  return best;
}

/**
 * Book 10 "Target choice": the foe to go for among those seen. It keeps the one it has unless
 * another scores at least threatSwitch more; ties go to the nearer, then the id's order.
 */
export function chooseTarget(
  fw: FightWorld,
  me: Id,
  fa: ActorFight,
  seen: readonly Seen[],
): Seen | null {
  if (seen.length === 0) return null;
  const scored = seen
    .map((s) => ({ s, v: threatOf(fw, me, fa, s) }))
    .sort((a, b) => b.v - a.v || a.s.d - b.s.d || (a.s.id < b.s.id ? -1 : 1));
  const best = scored[0];
  if (best === undefined) return null;
  const current = scored.find((x) => x.s.id === fa.ai.target);
  if (current !== undefined && best.v - current.v < fw.ctx.pt4.threat.switchAt) return current.s;
  return best.s;
}

/** The post a fighter guards, in world px, or null (Book 10 "Guarding and pursuit"). */
export function postOf(fw: FightWorld, fa: ActorFight): { x: number; y: number } | null {
  const enc = fw.ctx.def.encounters.find((e) => e.id === fa.group);
  if (enc?.post === undefined) return null;
  return { x: enc.post.x * fw.map.tile, y: enc.post.y * fw.map.tile };
}

/**
 * Book 10 "Guarding and pursuit": whether a fighter is holding its ground this decision (going back
 * to its post or home, or standing there) rather than fighting; it sets its walk when so. Each side
 * of the choice holds until its other limit is reached, so it never walks back and forth at a line.
 */
export function holdGround(
  fw: FightWorld,
  id: Id,
  a: OnFootActor,
  fa: ActorFight,
  foe: { readonly id: Id; readonly x: number; readonly y: number } | null,
): boolean {
  const { world, ctx, map } = fw;
  const g = ctx.pt4.guard;
  const tile = map.tile;
  const tick = world.tick;
  const ai = fa.ai;
  const post = postOf(fw, fa);
  const ground = post ?? { x: ai.home.x, y: ai.home.y };
  const battle = world.onFoot?.battle ?? null;
  // Struck: a guard chases its striker at least guardChase before it weighs its post again.
  if (foe !== null && struckBy(battle, id, foe.id, tick, ctx.ai.habits.awarenessEvery))
    ai.chaseUntil = tick + g.chaseTicks;
  const chasing = (ai.chaseUntil ?? -1) > tick;
  const far = (p: { x: number; y: number }, tiles: number): boolean =>
    Math.hypot(p.x - ground.x, p.y - ground.y) > tiles * tile;
  if (ai.back !== undefined) {
    // On the way back (or standing at the post): out again only when the foe comes near enough.
    const near = foe !== null && !far(foe, post !== null ? g.resumeTiles : g.pursuitResumeTiles);
    if (chasing || near) {
      delete ai.back;
      return false;
    }
  } else {
    if (chasing || foe === null) return false;
    // A guard: its foe too far from the post. A pursuer: itself too far from home (the leash), or
    // the last of its band still after the foe (Book 10 pursuitTogether).
    const gone =
      post !== null
        ? far(foe, g.radiusTiles)
        : far(a, ctx.ai.self.leashTiles) || bandGoneBack(fw, id, fa);
    if (!gone) return false;
    ai.back = tick;
    fw.emit({ type: 'GUARD_RETURNS', person: id, post: post !== null });
  }
  ai.mode = 'GUARD';
  const home = Math.hypot(a.x - ground.x, a.y - ground.y) <= g.homeTiles * tile;
  // At the post it stands guard (the caller turns it to face its foe); else it runs back.
  ai.goal = home ? null : { x: ground.x, y: ground.y, run: true };
  return true;
}

/** Whether every other standing member of a fighter's band has gone back (and there is one). */
function bandGoneBack(fw: FightWorld, id: Id, fa: ActorFight): boolean {
  const onFoot = fw.world.onFoot;
  if (onFoot === null || fa.group === null) return false;
  let others = 0;
  for (const [oid, o] of Object.entries(onFoot.actors)) {
    const of = o.fight;
    if (oid === id || of?.group !== fa.group || !standing(o, of)) continue;
    if (of.ai.back === undefined) return false;
    others++;
  }
  return others > 0;
}

/** A member still on its feet and in the fight (not down, dead, fled, gone or yielding). */
function standing(o: OnFootActor, of: ActorFight): boolean {
  if (of.dead !== null || o.pose === 'down' || o.pose === 'dead') return false;
  if (of.ai.mode === 'FLEE' || of.ai.mode === 'LEAVE' || of.ai.mode === 'SURRENDER') return false;
  return of.f.state !== 'downed' && of.f.state !== 'surrendered';
}

/**
 * Book 10 cohesionSpread and cohesionWait: a pursuer ahead of its nearest standing friend (ahead:
 * nearer the foe than that friend is) walks, then waits; null when it keeps no cohesion (alone, a
 * guard, or with no friend behind it). The wait holds until a friend is back within the spread.
 */
export function cohesionPace(
  fw: FightWorld,
  id: Id,
  a: OnFootActor,
  fa: ActorFight,
  foe: { readonly x: number; readonly y: number },
): 'WALK' | 'WAIT' | null {
  const onFoot = fw.world.onFoot;
  if (onFoot === null || fa.group === null || postOf(fw, fa) !== null) return null;
  const g = fw.ctx.pt4.guard;
  const tile = fw.map.tile;
  const mine = Math.hypot(foe.x - a.x, foe.y - a.y);
  let gap = Infinity;
  for (const [oid, o] of Object.entries(onFoot.actors).sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
    const of = o.fight;
    // Friends still after the foe only (one gone back is not followed: bandGoneBack decides).
    if (oid === id || of?.group !== fa.group || !standing(o, of) || of.ai.back !== undefined)
      continue;
    // Only a friend behind it (further from the foe) holds it back.
    if (Math.hypot(foe.x - o.x, foe.y - o.y) <= mine) return null;
    gap = Math.min(gap, Math.hypot(o.x - a.x, o.y - a.y));
  }
  if (gap === Infinity) return null;
  const ai = fa.ai;
  if (ai.waiting === true) {
    if (gap <= g.spreadTiles * tile) delete ai.waiting;
    else return 'WAIT';
  } else if (gap > g.waitTiles * tile) {
    ai.waiting = true;
    return 'WAIT';
  }
  return gap > g.spreadTiles * tile ? 'WALK' : null;
}

/** Book 10 runOffSight: whether a point is out of the steerer's sight (the view and its margin). */
export function outOfSight(fw: FightWorld, x: number, y: number): boolean {
  const p = fw.world.onFoot?.player;
  if (p === undefined) return true;
  const r = fw.ctx.pt4.runOff;
  const tile = fw.map.tile;
  const extra = (r.lookTiles + r.marginTiles) * tile;
  return Math.abs(x - p.x) > r.viewW / 2 + extra || Math.abs(y - p.y) > r.viewH / 2 + extra;
}

/** Whether a point is at the zone's edge (a tile on its border). */
function atEdge(map: ZoneMap, t: TileXY): boolean {
  return t.tx <= 0 || t.ty <= 0 || t.tx >= map.width - 1 || t.ty >= map.height - 1;
}

/**
 * Book 10 runOffWay: a way over open ground from where the foe stands to the nearest tile out of the
 * steerer's sight (else at the zone's edge), never through a tile nearer the steerer than where it
 * began less runOffKeep. Breadth first, so the nearest such tile; null with none.
 */
export function planRunOff(fw: FightWorld, a: OnFootActor): TileXY[] | null {
  const { map, world } = fw;
  const p = world.onFoot?.player;
  if (p === undefined) return null;
  const tile = map.tile;
  const keep = fw.ctx.pt4.runOff.keepTiles * tile;
  const start = tileOf(map, a.x, a.y);
  const centre = (t: TileXY): { x: number; y: number } => ({
    x: (t.tx + 0.5) * tile,
    y: (t.ty + 0.6) * tile,
  });
  const floor = Math.hypot(a.x - p.x, a.y - p.y) - keep;
  const key = (t: TileXY): number => t.ty * map.width + t.tx;
  const came = new Map<number, TileXY | null>([[key(start), null]]);
  const queue: TileXY[] = [start];
  let edge: TileXY | null = null;
  for (const t of queue) {
    const c = centre(t);
    if (t !== start && outOfSight(fw, c.x, c.y)) return pathTo(came, key, t);
    if (edge === null && t !== start && atEdge(map, t)) edge = t;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n = { tx: t.tx + dx, ty: t.ty + dy };
      if (n.tx < 0 || n.ty < 0 || n.tx >= map.width || n.ty >= map.height) continue;
      if (came.has(key(n)) || tileBlocks(map, n.tx, n.ty, fw.tidalGroundOpen)) continue;
      const nc = centre(n);
      if (Math.hypot(nc.x - p.x, nc.y - p.y) < floor) continue;
      if (fw.avoid?.(nc.x, nc.y) === true) continue;
      came.set(key(n), t);
      queue.push(n);
    }
  }
  return edge === null ? null : pathTo(came, key, edge);
}

function pathTo(
  came: ReadonlyMap<number, TileXY | null>,
  key: (t: TileXY) => number,
  to: TileXY,
): TileXY[] {
  const path: TileXY[] = [];
  for (let at: TileXY | null | undefined = to; at != null; at = came.get(key(at))) path.unshift(at);
  return path;
}

/**
 * One tick of a let-go foe's run (Book 10 "Running off"): its goal is the next tile of its planned
 * way; planned when it starts, and again after runOffReplan without moving. Returns whether it is
 * gone (out of sight, or at the zone's edge with nowhere further).
 */
export function runOffStep(fw: FightWorld, a: OnFootActor, fa: ActorFight): boolean {
  const { map, world } = fw;
  const tile = map.tile;
  const tick = world.tick;
  const ai = fa.ai;
  if (outOfSight(fw, a.x, a.y)) return true;
  const run = ai.runOff;
  const stalled = run !== undefined && tick - run.moved >= fw.ctx.pt4.runOff.replanTicks;
  if (run === undefined || stalled) {
    const path = planRunOff(fw, a);
    ai.runOff = { path: path ?? [], next: 1, moved: tick };
  }
  const r = ai.runOff;
  if (r === undefined) return false;
  if (a.moving === true) r.moved = tick;
  // Past each waypoint in turn (within half a tile of its centre).
  for (;;) {
    const w = r.path[r.next];
    if (w === undefined) break;
    const cx = (w.tx + 0.5) * tile;
    const cy = (w.ty + 0.6) * tile;
    if (Math.hypot(cx - a.x, cy - a.y) > tile * 0.5) break;
    r.next++;
  }
  const w = r.path[r.next];
  if (w === undefined) {
    // At the end of its way: at the zone's edge, it is gone; else it holds (and plans again).
    const last = r.path[r.path.length - 1];
    if (last !== undefined && atEdge(map, last)) return true;
    ai.goal = null;
    return false;
  }
  ai.goal = { x: (w.tx + 0.5) * tile, y: (w.ty + 0.6) * tile, run: true };
  return false;
}
