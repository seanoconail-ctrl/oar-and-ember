/**
 * The text audit (Book 8 section 10, "The audit"; design addendum 2.5 section 2; decisions DF-11
 * to DF-13 and the user's DF-80): every kind of information line the game can show, by its string
 * key, with what happens to it. A line the picture or sound already conveys is cut; a kept line
 * has its class, which is its priority (Book 2 section 18): safety, then a call's direction, then
 * story information, then a sound.
 *
 * A key with no row here is never shown ("a new kind of message needs a row before it is shown").
 * Combat sounds are never captioned, in any mode (DF-80 cancels DF-14's option): the drawn
 * telegraph twin (the draw-back and flash, sparks, the parry's spark) is their only cue.
 */
export type InfoClass = 'SAFETY' | 'DIRECTION' | 'STORY' | 'SOUND';

/** Priority, highest first (Book 10 infoPriority). */
export const CLASS_RANK: Readonly<Record<InfoClass, number>> = {
  SAFETY: 3,
  DIRECTION: 2,
  STORY: 1,
  SOUND: 0,
};

export type Verdict =
  | { readonly show: true; readonly cls: InfoClass; readonly unseenOnly?: true }
  | { readonly show: false; readonly why: 'CUT' | 'MERGED' | 'COMBAT' | 'UNLISTED' };

const keep = (cls: InfoClass): Verdict => ({ show: true, cls });
const CUT: Verdict = { show: false, why: 'CUT' };
const MERGED: Verdict = { show: false, why: 'MERGED' };
const COMBAT: Verdict = { show: false, why: 'COMBAT' };

/** Exact keys first. */
const EXACT: Readonly<Record<string, Verdict>> = {
  // Safety lines (Book 8 section 10, "In a fight"): shown at once, even in a fight.
  'caption.search.neck_gale': keep('SAFETY'),
  'caption.info.finish_warning': keep('SAFETY'),
  'caption.info.second_wind': keep('SAFETY'),
  'caption.stinger.horn': keep('SAFETY'),
  'caption.sfx.horn': keep('SAFETY'),
  'caption.sfx.tell_ran': keep('SAFETY'),
  // An arrow from out of sight: only when the shooter is unseen, with its direction; the
  // presentation says it itself (the router's flight sound is never captioned).
  'caption.sfx.arrow_flight': { show: true, cls: 'SAFETY', unseenOnly: true },
  // Direction class: a distant call names the caller and the direction; the pale light.
  'caption.voice.hild_calling': keep('DIRECTION'),
  'caption.voice.runa_calling': keep('DIRECTION'),
  'caption.voice.bran_calling': keep('DIRECTION'),
  'caption.voice.oddi_calling': keep('DIRECTION'),
  'caption.search.oddi_calling': keep('DIRECTION'),
  'caption.hag.light': keep('DIRECTION'),
  // Story class: held through a fight and shown after it.
  'caption.info.brought_home': keep('STORY'),
  'caption.info.left_behind': keep('STORY'),
  'caption.hag.whisper': keep('STORY'),
  'caption.stinger.dispute': keep('STORY'),
  'caption.scene.theft_found': keep('STORY'),
  'caption.repair.oar_seen': keep('STORY'),
  // A reason for the first raid (DH-142, DH-139): the smoke on the Irish coast is far off the view's
  // edge, so its direction is told; the skin boat's goods go into the stores out of sight.
  'caption.raid.smoke_far': keep('DIRECTION'),
  'caption.raid.goods_stored': keep('STORY'),
  'info.launch.not_yet': keep('STORY'),
  // Cut: seen in the world.
  'caption.voice.approach': CUT,
  'caption.info.surrender': CUT,
  'caption.info.flee': CUT,
  'caption.hag.hush': CUT,
  'caption.hag.gust': CUT,
  // Merged: Thorkel's shout into his speech line, which names him.
  'caption.cold.shout': MERGED,
};

/** Then prefixes, longest first. */
const PREFIX: readonly (readonly [string, Verdict])[] = [
  ['caption.edge.', keep('SAFETY')],
  ['caption.tell.', keep('SAFETY')],
  ['caption.search.', keep('STORY')],
  ['info.boat.', keep('STORY')],
  // A reason for the first raid: what is in the skin boat, said in the talk panel (DH-138).
  ['info.skinboat.', keep('STORY')],
  // Combat and missile sounds: read by sight and sound only, never captioned (DF-9, DF-80).
  ['caption.sfx.light_attack', COMBAT],
  ['caption.sfx.heavy_swing', COMBAT],
  ['caption.sfx.hit_', COMBAT],
  ['caption.sfx.block', COMBAT],
  ['caption.sfx.parry', COMBAT],
  ['caption.sfx.guard_break', COMBAT],
  ['caption.sfx.charge_level', COMBAT],
  ['caption.sfx.dodge', COMBAT],
  ['caption.sfx.shove', COMBAT],
  ['caption.sfx.grunt', COMBAT],
  ['caption.sfx.steerer_breath', COMBAT],
  ['caption.sfx.riposte', COMBAT],
  ['caption.sfx.lunge', COMBAT],
  ['caption.sfx.backstab', COMBAT],
  ['caption.sfx.sidestep', COMBAT],
  ['caption.sfx.alert', COMBAT],
  ['caption.sfx.gore', COMBAT],
  ['caption.sfx.downed', COMBAT],
  ['caption.sfx.body_fall', COMBAT],
  ['caption.sfx.weapon_drop', COMBAT],
  ['caption.sfx.telegraph', COMBAT],
  ['caption.sfx.exhausted', COMBAT],
  ['caption.sfx.miss', COMBAT],
  ['caption.sfx.bow_', COMBAT],
  ['caption.sfx.arrow_', COMBAT],
  ['caption.sfx.spear_', COMBAT],
  ['caption.sfx.quiver_', COMBAT],
  // Healing: the kneeling loop and its sound show it.
  ['ui.heal.', CUT],
  ['caption.sfx.bind_wound', CUT],
  ['caption.sfx.eat', CUT],
  // The small finds off the paths (the user's fourth playtest, DH-118): what was found and its
  // story, which the picture alone cannot tell; held through a fight like the story lines.
  ['caption.find.', keep('STORY')],
  // Work, camp, repairs, rites and launch: seen in their loops and scenes.
  ['caption.sfx.', CUT],
  ['caption.repair.', CUT],
  ['caption.rites.', CUT],
  ['caption.launch.', CUT],
  // The opening's actions and moments, doors, music, the other stingers: seen and heard.
  ['caption.action.', CUT],
  ['caption.door.', CUT],
  ['caption.net.', CUT],
  ['caption.wake.', CUT],
  ['caption.chest.', CUT],
  ['caption.cold.', CUT],
  ['caption.ring.', CUT],
  ['caption.mast.', CUT],
  ['caption.seal.', CUT],
  ['caption.gulls.', CUT],
  ['caption.rain.', CUT],
  ['caption.music.', CUT],
  ['caption.stinger.', CUT],
  // The sound test page's ambience and footsteps: never in play.
  ['caption.amb.', CUT],
];

/** What the audit says about an information line's string key. */
export function auditInfo(key: string): Verdict {
  const exact = EXACT[key];
  if (exact !== undefined) return exact;
  for (const [prefix, verdict] of PREFIX) if (key.startsWith(prefix)) return verdict;
  return { show: false, why: 'UNLISTED' };
}

/**
 * The prompt line's notices merged into refusal words at the cursor (Book 8 section 10's audit,
 * "Notices in the prompt line"): the reason a press was refused, in one or two words.
 */
export const NOTICE_REFUSALS: Readonly<Record<string, string>> = {
  BELOW_TIDE_LINE: 'ui.refusal.below_tide',
  NO_ROOM: 'ui.refusal.no_room',
  HANDS_FULL: 'ui.refusal.hands_full',
};
