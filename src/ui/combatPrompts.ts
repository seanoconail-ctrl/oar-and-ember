/**
 * The combat prompts (the user's third playtest; decisions DG-7, DG-9, DG-11 and DG-25; Book 2
 * section 18, CombatPromptView; Book 10 section 21, "Combat prompts"): the one limited exception to
 * "no combat text". Input prompts only, a control and its verb, at the screen's right edge, at most
 * two lines, fading out while a fighter, a missile or the locked target is drawn under them and
 * during story beats, scenes, talk and speech that is not a fight bark. They never report a hit, a
 * block, a parry, damage, a state or anything that happened.
 *
 * - Lock on and strike as a fight starts; parry and dodge (one line) at each enemy telegraph aimed at
 *   the steerer; block too when a shield is in hand: only in the steerer's first promptFights fights
 *   (world state, `player.teaching.fights`), each retired after promptRetire uses in fights.
 * - The finish-or-let-go choice whenever it is offered, never retired.
 * - Svart's parry prompt at each of his telegraphs, and Ketill's dodge prompt at each red blow's
 *   first wind-up tick, until each lesson is done (outside the three-fight count).
 * - The heal prompt on a hit that leaves the steerer below healPrompt's share (or a new wound) while
 *   carrying a binding or a ration, for healPromptHold or until a heal starts, until healPromptUntil
 *   heals.
 * - The sneak hint when the simulation says it is due (SNEAK_HINT), for sneakHintHold or until the
 *   steerer sneaks.
 *
 * Presentation only and pure, on the frame's clock (seconds); the counts it reads are world state
 * (the simulation keeps them, so replays and a second campaign stay exact).
 */
import type { Pt3Balance } from '../content/pt3Balance.ts';
import type { CombatPromptId, Teaching } from '../sim/world.ts';
import { PromptFade } from './prompts.ts';

/** The display option (Book 10 promptOption): the first fights (default), always, or off. */
export type CombatPromptOption = 'FIRST' | 'ALWAYS' | 'OFF';

/** One line shown: which prompt, its string, and its opacity now. */
export interface CombatPromptLine {
  readonly id: CombatPromptId;
  readonly textKey: string;
  readonly alpha: number;
}

/** What the frame tells the prompts about the game. */
export interface CombatPromptFrame {
  readonly now: number;
  readonly teaching: Teaching;
  readonly option: CombatPromptOption;
  /** A fight is under way (Book 10 inFight). */
  readonly inFight: boolean;
  /** The finish-or-let-go choice is offered now. */
  readonly offered: boolean;
  /** A shield is in hand (the block line). */
  readonly shield: boolean;
  /** The steerer is sneaking now (the sneak hint is done with for the moment). */
  readonly sneaking: boolean;
  /** A heal is under way (the heal prompt goes). */
  readonly healing: boolean;
  /** A story beat, scene, talk or a narrative speech line is showing (promptQuiet). */
  readonly quiet: boolean;
  /** A fighter, missile or the locked target is drawn under the prompts' box (promptClear). */
  readonly covered: boolean;
}

/** The events the prompts react to (a narrow view of the simulation's). */
export type CombatPromptEvent =
  | { readonly type: 'FIGHT_COUNTED' }
  | { readonly type: 'FIGHT_ENDED' }
  | {
      readonly type: 'TELEGRAPH';
      readonly flash: boolean;
      readonly at: string | null;
      readonly svart: boolean;
    }
  | { readonly type: 'RED_BLOW' }
  | {
      readonly type: 'HIT_TAKEN';
      readonly below: boolean;
      readonly wound: boolean;
      readonly carries: boolean;
    }
  | { readonly type: 'SNEAK_HINT' }
  | { readonly type: 'HEAL_STARTED' }
  | { readonly type: 'LESSON_DONE'; readonly lesson: 'PARRY' | 'RED' };

const KEYS: Readonly<Record<CombatPromptId, string>> = {
  LOCK_ON: 'ui.prompt.combat.lock_on',
  STRIKE: 'ui.prompt.combat.strike',
  PARRY_DODGE: 'ui.prompt.combat.parry_dodge',
  BLOCK: 'ui.prompt.combat.block',
  HEAL: 'ui.prompt.heal_bind',
  SNEAK: 'ui.prompt.sneak',
  TEACH_PARRY: 'ui.prompt.teach_parry',
  TEACH_DODGE: 'ui.prompt.teach_dodge',
  FINISH_OR_SPARE: 'ui.prompt.finish_or_spare',
};

/** Which shows first when more than two are wanted (the choice and the lessons come first). */
const ORDER: readonly CombatPromptId[] = [
  'FINISH_OR_SPARE',
  'TEACH_DODGE',
  'TEACH_PARRY',
  'PARRY_DODGE',
  'BLOCK',
  'HEAL',
  'LOCK_ON',
  'STRIKE',
  'SNEAK',
];

/** The prompts counted by the first fights (Book 10 promptFights). */
const FIRST_FIGHTS: readonly CombatPromptId[] = ['LOCK_ON', 'STRIKE', 'PARRY_DODGE', 'BLOCK'];

export class CombatPrompts {
  readonly #b: Pt3Balance['prompts'];
  readonly #fades = new Map<CombatPromptId, PromptFade>();
  /** Until when each is wanted (seconds), and when each was last shown in this fight. */
  readonly #until = new Map<CombatPromptId, number>();
  readonly #shownAt = new Map<CombatPromptId, number>();
  #heal: 'BIND' | 'EAT' = 'BIND';
  #now = 0;

  constructor(b: Pt3Balance['prompts']) {
    this.#b = b;
  }

  /** Whether a first-fights prompt may show with these counts and this option. */
  static firstFights(
    t: Teaching,
    option: CombatPromptOption,
    limit: number,
    id: CombatPromptId,
  ): boolean {
    if (option === 'OFF') return false;
    if (option === 'ALWAYS') return true;
    return t.fights <= limit && !t.retired.includes(id);
  }

  /** The heal prompt names binding (a binding carried) or eating (a ration selected). */
  set healKind(kind: 'BIND' | 'EAT') {
    this.#heal = kind;
  }

  #want(id: CombatPromptId, seconds: number, again = true): void {
    const now = this.#now;
    const last = this.#shownAt.get(id);
    if (again && last !== undefined && now - last < this.#b.againSeconds) return;
    this.#until.set(id, now + seconds);
    this.#shownAt.set(id, now);
  }

  /** An event from the game (mapped by the caller), at `now` seconds. */
  event(e: CombatPromptEvent, now: number, t: Teaching, option: CombatPromptOption): void {
    this.#now = now;
    const lim = this.#b.fights;
    const first = (id: CombatPromptId): boolean => CombatPrompts.firstFights(t, option, lim, id);
    const hold = this.#b.holdSeconds;
    switch (e.type) {
      case 'FIGHT_COUNTED':
        this.#shownAt.clear();
        if (first('LOCK_ON')) this.#want('LOCK_ON', hold);
        if (first('STRIKE')) this.#want('STRIKE', hold);
        return;
      case 'FIGHT_ENDED':
        for (const id of FIRST_FIGHTS) this.#until.delete(id);
        this.#until.delete('TEACH_PARRY');
        this.#until.delete('TEACH_DODGE');
        return;
      case 'TELEGRAPH':
        if (!e.flash) return;
        if (e.svart && !t.lessons.includes('PARRY') && option !== 'OFF')
          this.#want('TEACH_PARRY', hold, false);
        if (e.at === 'P_STEERER' && !e.svart && first('PARRY_DODGE'))
          this.#want('PARRY_DODGE', hold);
        return;
      case 'RED_BLOW':
        if (!t.lessons.includes('RED') && option !== 'OFF') this.#want('TEACH_DODGE', hold, false);
        return;
      case 'HIT_TAKEN':
        if ((e.below || e.wound) && e.carries && t.heals < this.#b.healUntil && option !== 'OFF')
          this.#want('HEAL', this.#b.healHoldSeconds, false);
        return;
      case 'SNEAK_HINT':
        if (option !== 'OFF') this.#want('SNEAK', this.#b.sneakHoldSeconds, false);
        return;
      case 'HEAL_STARTED':
        this.#until.delete('HEAL');
        return;
      case 'LESSON_DONE':
        this.#until.delete(e.lesson === 'PARRY' ? 'TEACH_PARRY' : 'TEACH_DODGE');
        return;
    }
  }

  /** A shield in hand at a telegraph aimed at the steerer: the block line too (first fights). */
  blockToo(now: number, t: Teaching, option: CombatPromptOption): void {
    this.#now = now;
    if (CombatPrompts.firstFights(t, option, this.#b.fights, 'BLOCK'))
      this.#want('BLOCK', this.#b.holdSeconds);
  }

  /** The lines to draw now (at most Book 10's maxLines), each with its opacity. */
  frame(f: CombatPromptFrame): CombatPromptLine[] {
    this.#now = f.now;
    const t = f.teaching;
    const wanted = (id: CombatPromptId): boolean => {
      if (id === 'FINISH_OR_SPARE') return f.offered && f.option !== 'OFF';
      const until = this.#until.get(id);
      if (until === undefined || f.now >= until) return false;
      if (FIRST_FIGHTS.includes(id))
        return f.inFight && CombatPrompts.firstFights(t, f.option, this.#b.fights, id);
      if (id === 'HEAL') return !f.healing && t.heals < this.#b.healUntil;
      if (id === 'SNEAK') return !f.sneaking && !f.inFight && !t.retired.includes('SNEAK');
      if (id === 'TEACH_PARRY') return !t.lessons.includes('PARRY');
      if (id === 'TEACH_DODGE') return !t.lessons.includes('RED');
      return true;
    };
    const chosen = ORDER.filter(wanted).slice(0, this.#b.maxLines);
    const out: CombatPromptLine[] = [];
    for (const id of ORDER) {
      let fade = this.#fades.get(id);
      if (fade === undefined) {
        fade = new PromptFade({
          promptFadeSeconds: this.#b.fadeSeconds,
          promptBackSeconds: this.#b.quietBackSeconds,
        });
        this.#fades.set(id, fade);
      }
      // A fight bark does not quiet them (the caller passes only narrative quiet); being drawn over
      // the action fades them at once, with no wait to come back.
      const alpha = fade.update(f.now, chosen.includes(id) && !f.covered, f.quiet);
      if (alpha <= 0) continue;
      const key = id === 'HEAL' && this.#heal === 'EAT' ? 'ui.prompt.heal_eat' : KEYS[id];
      out.push({ id, textKey: key, alpha });
    }
    return out.slice(0, this.#b.maxLines);
  }
}
