/**
 * Scenes from people's lives (Stage 8): content/scenes.json, fired when their conditions hold.
 *
 * **Oddi's food theft** (Book 5 section 02; the household's first theft dispute, Book 5 section 10;
 * shaped as Book 8 section 12): a light-fingered resident tries the stores on going to bed (Book 10
 * "Traits": every 6 days, unless watched) and hides the food in their bedding. From the evening of
 * their second night in the household, when the steerer is at home within earshot of the fire,
 * whoever of the finders is at the fire finds it and brings it to the steerer; with none there, the
 * steerer finds it. The thief has a line; the finder another. The steerer judges (Book 2 section
 * 06): a fair way (shared shame, then responsibility: a compromise), a punishment, shaming at the
 * fire, siding with the thief, or letting it lie. Each moves happiness, friendship and fear for the
 * parties and those watching by Book 10's "Dispute judgements"; the thief's trait is known from then
 * on; the theft is a deed in the ledger and a memory for both; the outcome is a fact
 * (`scene.<beat>`), and the judgement is spoken at the fire.
 */
import type { SceneDef } from '../../content/registry.ts';
import type { Id } from '../../core/ids.ts';
import { appendDeed, fireOneShot, setFact } from '../ledger/ledger.ts';
import type { CampContext } from '../home/camp.ts';
import { homeOf } from '../home/camp.ts';
import type { Dispute, Person, TalkState, WorldState } from '../world.ts';
import { minutesOf } from './context.ts';
import type { PeopleContext } from './context.ts';
import { checkFeelings, meet, residents, tilesFromSteerer, treat } from './day.ts';
import type { Emit } from './day.ts';
import { clampMeasures, slight } from './measures.ts';
import { activityOf } from './schedule.ts';
import { LINE_SECONDS } from './talk.ts';

/** The fact a scene's outcome is kept under. */
export const sceneFact = (id: Id): string => `scene.${id.toLowerCase()}`;

/** Whether the scene's conditions hold now. */
export function sceneDue(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  scene: SceneDef,
  tile: number,
): boolean {
  if (Object.hasOwn(world.oneShots, scene.id) || world.talk !== null) return false;
  const thief = world.people[scene.thief];
  if (thief === undefined || !world.household.residents.includes(scene.thief)) return false;
  if (!thief.traits.some((t) => t.trait === scene.trait)) return false;
  if (thief.life.stash <= 0) return false;
  // "On the second night": the evening after their first night in the household.
  if (thief.life.nights < scene.nightsInHousehold - 1) return false;
  const m = world.calendar.minuteOfDay;
  if (m < minutesOf(scene.from) || m >= minutesOf(scene.until)) return false;
  if (!world.player.awake || world.onFoot?.player.sleep != null) return false;
  if (world.onFoot?.zone !== camp.def.zone) return false;
  const fire = camp.def.sites.find((s) => s.kind === 'FIRE');
  const p = world.onFoot.player;
  if (fire === undefined) return false;
  return Math.hypot(p.x / tile - fire.x, p.y / tile - fire.y) <= ctx.b.talk.earshotTiles;
}

/**
 * The finder: the first of the scene's finders awake at the fire, within reach of it (null: the
 * steerer finds it).
 */
function finderOf(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  scene: SceneDef,
  tile: number,
): Id | null {
  const fire = camp.def.sites.find((s) => s.kind === 'FIRE');
  for (const id of scene.finders) {
    if (id === scene.thief || !world.household.residents.includes(id)) continue;
    const act = activityOf(world, camp, ctx, id).kind;
    if (act === 'SLEEP' || act === 'BED' || act === 'TENDENCY' || act === 'WORK') continue;
    const a = world.onFoot?.zone === camp.def.zone ? world.onFoot.actors[id] : undefined;
    if (a === undefined || fire === undefined) continue;
    if (Math.hypot(a.x / tile - fire.x, a.y / tile - fire.y) <= ctx.b.talk.besideTiles) return id;
  }
  return null;
}

/** Opens the scene: the finding, the thief's word, the finder's. */
export function openScene(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  scene: SceneDef,
  tile: number,
  emit: Emit,
): void {
  const finder = finderOf(world, ctx, camp, scene, tile);
  const queue: TalkState['queue'][number][] = [];
  const open = scene.open[finder ?? 'none'];
  if (open !== undefined) queue.push({ speaker: finder ?? '', key: open });
  queue.push({ speaker: scene.thief, key: scene.excuse });
  const witness = finder === null ? undefined : scene.witness[finder];
  if (witness !== undefined && finder !== null) queue.push({ speaker: finder, key: witness });
  world.talk = {
    kind: 'SCENE',
    with: scene.thief,
    scene: scene.id,
    finder,
    node: null,
    topics: [],
    topic: null,
    queue,
    nextLineTick: world.tick,
    line: null,
    chosen: null,
    ending: false,
    since: world.tick,
  };
  emit({ type: 'TALK_STARTED', person: scene.thief, kind: 'SCENE' });
  emit({
    type: 'DISPUTE_RAISED',
    scene: scene.id,
    parties: finder === null ? [scene.thief] : [scene.thief, finder],
  });
}

/** Each game minute: a scene whose conditions hold opens. */
export function sceneMinute(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  tile: number,
  emit: Emit,
): void {
  for (const scene of ctx.scenes)
    if (sceneDue(world, ctx, camp, scene, tile)) {
      openScene(world, ctx, camp, scene, tile, emit);
      return;
    }
}

/** Whether a watcher's values fit siding with the thief (Gain) or against (Kin, Word). */
function fitsSide(p: Person): number {
  const v = p.values;
  const gain = v.GAIN ?? 0;
  const against = (v.KIN ?? 0) + (v.WORD ?? 0);
  return gain > against ? 1 : against > 0 ? -1 : 0;
}

/**
 * The steerer judges (Book 2 section 06; Book 10 "Dispute judgements"). The one-shot is recorded
 * before its effects (Book 2 section 05).
 */
export function chooseScene(
  world: WorldState,
  ctx: PeopleContext,
  camp: CampContext,
  index: number,
  tile: number,
  emit: Emit,
): void {
  const talk = world.talk;
  if (talk?.kind !== 'SCENE' || talk.chosen !== null || talk.queue.length > 0) return;
  const scene = ctx.scenes.find((s) => s.id === talk.scene);
  const choice = scene?.choices[index];
  if (scene === undefined || choice === undefined) return;
  const thief = world.people[scene.thief];
  if (thief === undefined) return;
  const finderId = talk.finder ?? null;
  const finder = finderId === null ? undefined : world.people[finderId];
  const b = ctx.b;
  const day = world.calendar.day;
  fireOneShot(world, scene.id, () => {
    talk.chosen = index;
    setFact(world, sceneFact(scene.id), choice.outcome);
    // The theft is known: a deed in the ledger, the thief's trait shown from now on.
    const deedId = `DEED_${world.ledger.length + 1}`;
    const present = residents(world).filter(
      (id) => id !== scene.thief && tilesFromSteerer(world, id, tile) <= b.talk.earshotTiles,
    );
    const witnesses = [...new Set([...(finderId === null ? [] : [finderId]), ...present])];
    appendDeed(world, {
      id: deedId,
      tag: 'THEFT',
      day,
      placeId: camp.def.home,
      doer: scene.thief,
      context: { ownStores: true, rd: thief.life.stash },
      victims: [],
      witnesses: witnesses.map((person) => ({ person, escaped: false })),
      identification: 1,
      marksSeen: [],
    });
    for (const t of thief.traits) if (t.trait === scene.trait) t.known = true;
    for (const p of [thief, ...(finder === undefined ? [] : [finder])])
      p.memories.push({
        day,
        kind: 'EVENT',
        about: 'THEFT_FOUND',
        source: 'SAW',
        deedId,
        detail: choice.outcome,
      });
    // The food goes back to the stores, or stays where it was hidden.
    const home = homeOf(world, camp);
    if (choice.returned && home !== undefined) {
      home.stores['RES_SALTED_FISH'] = (home.stores['RES_SALTED_FISH'] ?? 0) + thief.life.stash;
      thief.life.stash = 0;
    }
    // The judgement's effects on the parties and those watching (Book 10 "Dispute judgements").
    const j = b.judgements[choice.judgement];
    const watchers = residents(world).filter((id) => id !== scene.thief && id !== finderId);
    const change = (p: Person, f: number, h: number, fear: number): void => {
      p.friendship += slight(b, p, f);
      if (h !== 0) treat(world, ctx, p, h);
      if (fear !== 0) {
        p.fear += fear;
        p.life.fearDay = day;
      }
    };
    if (j !== undefined)
      switch (choice.judgement) {
        case 'COMPROMISE':
          change(thief, j.favoured.friendship, j.favoured.happiness, 0);
          if (finder !== undefined) change(finder, j.other.friendship, j.other.happiness, 0);
          for (const id of watchers) {
            const w = world.people[id];
            if (w !== undefined && (w.values.WORD ?? 0) > 0) change(w, j.watching.friendship, 0, 0);
          }
          break;
        case 'PUNISH': {
          const reply = choice.reply === undefined ? null : b.replies[choice.reply];
          change(thief, j.other.friendship, reply?.happiness ?? 0, j.other.fear);
          for (const p of [finder, ...watchers.map((id) => world.people[id])])
            if (p !== undefined) change(p, 0, 0, j.watching.fear);
          break;
        }
        case 'TAKE_SIDE': {
          const favoured = choice.favour === 'FINDER' ? finder : thief;
          const other = choice.favour === 'FINDER' ? thief : finder;
          if (favoured !== undefined)
            change(favoured, j.favoured.friendship, j.favoured.happiness, 0);
          if (other !== undefined) change(other, j.other.friendship, j.other.happiness, 0);
          for (const id of watchers) {
            const w = world.people[id];
            const fit = w === undefined ? 0 : fitsSide(w) * (choice.favour === 'FINDER' ? -1 : 1);
            if (w !== undefined && fit !== 0) change(w, fit * j.watching.friendship, 0, 0);
          }
          break;
        }
        case 'IGNORE':
          change(thief, 0, j.favoured.happiness, 0);
          if (finder !== undefined) change(finder, 0, j.other.happiness, 0);
          break;
        default:
          break;
      }
    if (choice.like !== undefined) meet(world, thief, choice.like);
    for (const p of [thief, finder, ...watchers.map((id) => world.people[id])])
      if (p !== undefined) {
        clampMeasures(p);
        checkFeelings(world, ctx, p, emit);
      }
    // The dispute, judged (Book 2 section 06).
    const dispute: Dispute = {
      id: `DISPUTE_${world.disputes.length + 1}`,
      kind: 'THEFT',
      day,
      parties: finderId === null ? [scene.thief] : [scene.thief, finderId],
      cause: deedId,
      watchers,
      status: choice.judgement === 'IGNORE' ? 'IGNORED' : 'JUDGED',
      ...(choice.judgement === 'IGNORE'
        ? {}
        : {
            judgement: {
              kind: choice.judgement,
              ...(choice.judgement === 'TAKE_SIDE'
                ? { favoured: choice.favour === 'FINDER' ? (finderId ?? scene.thief) : scene.thief }
                : {}),
              ...(choice.judgement === 'PUNISH' ? { punished: [scene.thief] } : {}),
              day,
            },
          }),
    };
    world.disputes.push(dispute);
    // The outcome spoken at the fire: the thief, then someone who watched.
    if (choice.thief !== '') talk.queue.push({ speaker: scene.thief, key: choice.thief });
    const reactor = finderId ?? watchers.find((id) => choice.reaction[id] !== undefined) ?? null;
    const reaction = reactor === null ? undefined : choice.reaction[reactor];
    if (reactor !== null && reaction !== undefined)
      talk.queue.push({ speaker: reactor, key: reaction });
    talk.ending = true;
    talk.nextLineTick = world.tick + Math.round(LINE_SECONDS * ctx.ticksPerSecond * 0.4);
    emit({ type: 'JUDGEMENT_GIVEN', scene: scene.id, outcome: choice.outcome });
  });
}
