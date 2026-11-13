/**
 * The play view's side of the user's third playtest's combat (decisions DG-2 to DG-11, DG-25,
 * DG-26, DG-29): the combat prompts at the screen's right edge (src/ui/combatPrompts.ts), the let-go
 * shout and the spared foe's reply (chosen here, on the presentation's own seeded stream, never one
 * twice running: the lines are not state), the talk at the fold (src/scenes/foldTalk.ts), and the
 * sounds of the finisher, the spare, a guard turned and the red blow. Presentation only: it reads
 * the world and the simulation's events, never changes them.
 */
import { nextFloat, seedStream } from '../core/rng.ts';
import type { RngState } from '../core/rng.ts';
import type { Pt3Balance } from '../content/pt3Balance.ts';
import type { CombatDef } from '../content/registry.ts';
import type { FightContext } from '../sim/land/fight.ts';
import { finishOffer } from '../sim/land/fight.ts';
import type { SimEvent } from '../sim/simulation.ts';
import type { WorldState } from '../sim/world.ts';
import { CombatPrompts } from '../ui/combatPrompts.ts';
import type { CombatPromptLine, CombatPromptOption } from '../ui/combatPrompts.ts';
import { FoldTalk } from './foldTalk.ts';

/** What the play view lends: words, keys, the speech line, blips and sounds. */
export interface TeachHost {
  readonly t: (key: string, vars?: Record<string, string>) => string;
  readonly has: (key: string) => boolean;
  /** The steerer's name, and a person's short name (Book 8 section 01). */
  readonly steererName: () => string;
  readonly nameOf: (id: string) => string;
  /** A speech line ("Name: words"), at `now` ms. */
  readonly say: (text: string, now: number) => void;
  /** A line in the speaker's voice blips, at a level (a murmur is quieter). */
  readonly voice: (person: string, text: string, pan: number, level?: number) => void;
  readonly pan: (person: string) => number;
  /** A sound by its audio event, from a person, with a variant. */
  readonly sound: (event: string, person: string, variant?: number) => void;
  /** A key's label for an action, for the input in use. */
  readonly key: (action: string) => string;
  /** How long a speech line's subtitle shows, in seconds (Book 10 speechHold). */
  readonly speechSeconds: (text: string) => number;
}

/** A finisher's weapon by its blow's kind (Book 11: a thrust, a chop, a crushing blow). */
const FINISH_KIND: Readonly<Record<string, number>> = {
  Seax: 0,
  Spear: 0,
  'Hand axe': 1,
  'Dane axe': 1,
  Sword: 1,
  'Club or hammer': 2,
};

/** Escapes text for the prompt's markup. */
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class CombatTeach {
  readonly prompts: CombatPrompts;
  readonly #b: Pt3Balance;
  readonly #host: TeachHost;
  readonly #def: CombatDef | null;
  readonly #fold: FoldTalk | null;
  readonly #rng: RngState;
  #lastShout: string | null = null;
  readonly #lastReply = new Map<string, string>();
  /** When the steerer last let a foe go (frame ms): the spare gesture is drawn for a moment. */
  spareAt = -Infinity;
  #html = '';

  constructor(b: Pt3Balance, def: CombatDef | null, host: TeachHost, seed: string) {
    this.#b = b;
    this.#def = def;
    this.#host = host;
    this.prompts = new CombatPrompts(b.prompts);
    const talk = def?.talk;
    this.#fold = talk === undefined ? null : new FoldTalk(talk.exchanges, b.fold, seed);
    this.#rng = seedStream(`${seed}/spare-lines`, 'generation');
  }

  /** A line from a numbered pool (`prefix.01`...), never the last one said. */
  #pick(prefix: string, last: string | null | undefined): string | null {
    const pool: string[] = [];
    for (let i = 1; i <= 12; i++) {
      const key = `${prefix}.${String(i).padStart(2, '0')}`;
      if (this.#host.has(key)) pool.push(key);
    }
    const from = pool.length > 1 ? pool.filter((k) => k !== last) : pool;
    return from[Math.floor(nextFloat(this.#rng) * from.length)] ?? null;
  }

  /** The reply pool of a spared person: their own, else their voice's (Book 8 section 07). */
  #replyPrefix(person: string): string | null {
    const own = `${person.toLowerCase()}.spared`;
    if (this.#host.has(`${own}.01`)) return own;
    const voice = this.#def?.fighters.find((f) => f.person === person)?.voice;
    return voice === 'GAELIC'
      ? 'e_generic_gael.spared'
      : voice === 'NORSE'
        ? 'e_generic_norse.spared'
        : null;
  }

  /** An event from the simulation (at `now` ms). */
  event(
    e: SimEvent,
    now: number,
    world: WorldState,
    option: CombatPromptOption,
    ctx: FightContext | null,
  ): void {
    const h = this.#host;
    const t = world.player.teaching;
    const secs = now / 1000;
    const prompt = (pe: Parameters<CombatPrompts['event']>[0]): void => {
      if (t !== undefined) this.prompts.event(pe, secs, t, option);
    };
    switch (e.type) {
      case 'FIGHT_COUNTED':
        prompt({ type: 'FIGHT_COUNTED' });
        return;
      case 'FIGHT_ENDED':
        prompt({ type: 'FIGHT_ENDED' });
        return;
      case 'TELEGRAPH': {
        if (!e.flash) return;
        const fa = world.onFoot?.actors[e.who]?.fight;
        const svart = fa?.teach?.rule === 'PARRY';
        prompt({ type: 'TELEGRAPH', flash: true, at: e.at ?? null, svart });
        if (
          e.at === 'P_STEERER' &&
          world.player.hotbar.slots.includes('ITEM_SHIELD') &&
          t !== undefined
        )
          this.prompts.blockToo(secs, t, option);
        return;
      }
      case 'ATTACK_STARTED':
        if (e.kind === 'red') {
          prompt({ type: 'RED_BLOW' });
          h.sound('RED_SCRAPE', e.who);
        }
        return;
      case 'BLOW': {
        if (e.defender !== 'P_STEERER') return;
        const landed = e.outcome === 'HIT' || e.outcome === 'GUARD_BROKEN';
        if (!landed) return;
        const inv = world.player.inventory;
        const carries = (inv['ITEM_BINDING'] ?? 0) > 0 || (inv['ITEM_RATION'] ?? 0) > 0;
        this.prompts.healKind = (inv['ITEM_BINDING'] ?? 0) > 0 ? 'BIND' : 'EAT';
        // The vitality maximum, less what light wounds take (Book 10 section 08, Wounds).
        const lights = world.player.wounds.filter((w) => w.severity === 'LIGHT').length;
        const max =
          ctx === null
            ? world.player.vitality
            : ctx.cb.vitality - ctx.cb.lightWoundVitality * lights;
        prompt({
          type: 'HIT_TAKEN',
          below: world.player.vitality < max * this.#b.prompts.healBelow,
          wound: false,
          carries,
        });
        return;
      }
      case 'HEAL_STARTED':
        prompt({ type: 'HEAL_STARTED' });
        return;
      case 'LESSON_DONE':
        prompt({ type: 'LESSON_DONE', lesson: e.lesson });
        return;
      case 'SNEAK_HINT':
        prompt({ type: 'SNEAK_HINT' });
        return;
      case 'GUARD_TURNED':
        h.sound('GUARD_TURN', e.who, e.shield ? 1 : 0);
        return;
      case 'FINISHER_LANDED': {
        const drawn = world.onFoot?.player.fight?.finish?.drawn ?? e.weapon;
        h.sound('FINISHER', e.target, FINISH_KIND[drawn ?? 'Seax'] ?? 0);
        return;
      }
      case 'STEERER_SHOUTED': {
        // The shout: speech under the steerer's name, a breath, no blip (Book 11 section 08).
        const key = this.#pick('p_steerer.spare', this.#lastShout);
        this.spareAt = now;
        h.sound('SPARE', 'P_STEERER');
        if (key === null) return;
        this.#lastShout = key;
        h.say(h.t('caption.format.subtitle', { speaker: h.steererName(), line: h.t(key) }), now);
        return;
      }
      case 'SPARED_REPLY': {
        const prefix = this.#replyPrefix(e.person);
        if (prefix === null) return;
        const key = this.#pick(prefix, this.#lastReply.get(e.person));
        if (key === null) return;
        this.#lastReply.set(e.person, key);
        const text = h.t(key);
        h.say(h.t('caption.format.subtitle', { speaker: h.nameOf(e.person), line: text }), now);
        h.voice(e.person, text, h.pan(e.person));
        return;
      }
      default:
        return;
    }
  }

  /**
   * One frame: the fold's talk (a line said, or its murmur) and the prompts' lines, drawn into the
   * overlay region (markup, rebuilt only when it changes).
   */
  frame(
    now: number,
    world: WorldState,
    ctx: FightContext | null,
    tile: number,
    view: {
      readonly option: CombatPromptOption;
      readonly inFight: boolean;
      readonly quiet: boolean;
      readonly covered: boolean;
      readonly region: HTMLElement;
    },
  ): readonly CombatPromptLine[] {
    const h = this.#host;
    const secs = now / 1000;
    this.#foldFrame(secs, world, tile, now);
    const t = world.player.teaching;
    if (t === undefined) return [];
    const p = world.onFoot?.player;
    const offered = ctx !== null && finishOffer(world, ctx, tile) !== null;
    const lines = this.prompts.frame({
      now: secs,
      teaching: t,
      option: view.option,
      inFight: view.inFight,
      offered,
      shield: world.player.hotbar.slots.includes('ITEM_SHIELD'),
      sneaking: p?.gait === 'sneak' || p?.stance?.sneaking === true,
      healing: p?.fight?.state === 'heal',
      quiet: view.quiet,
      covered: view.covered,
    });
    const caps: Record<string, string> = {
      key: '',
      parry: h.key('parry'),
      dodge: h.key('dodge'),
      finish: h.key('finisher'),
      spare: h.key('spare'),
    };
    const keyOf: Record<string, string> = {
      LOCK_ON: 'lockOn',
      STRIKE: 'useItem',
      BLOCK: 'block',
      HEAL: 'heal',
      SNEAK: 'sneak',
      TEACH_PARRY: 'parry',
      TEACH_DODGE: 'dodge',
    };
    const html = lines
      .map((l) => {
        const vars: Record<string, string> = { ...caps, key: h.key(keyOf[l.id] ?? '') };
        const marked: Record<string, string> = {};
        for (const [k, v] of Object.entries(vars)) marked[k] = `\u0001${v}\u0002`;
        const text = esc(h.t(l.textKey, marked))
          .replace(/\u0001/g, '<span class="cap">')
          .replace(/\u0002/g, '</span>');
        return `<p data-prompt="${l.id}" style="opacity:${l.alpha.toFixed(2)}">${text}</p>`;
      })
      .join('');
    if (html !== this.#html) {
      this.#html = html;
      view.region.innerHTML = html;
    }
    return lines;
  }

  /** The fold's talk this frame (Book 10 "At the fold"). */
  #foldFrame(secs: number, world: WorldState, tile: number, now: number): void {
    const fold = this.#fold;
    const talk = this.#def?.talk;
    const onFoot = world.onFoot;
    if (fold === null || talk === undefined || onFoot === null) return;
    const battle = onFoot.battle ?? null;
    const waiting =
      battle !== null && battle.scene === talk.encounter && !battle.engaged && !battle.over;
    const members = Object.values(battle?.groups ?? {}).flatMap((g) => g.members);
    const aware = members.some((m) => {
      const st = onFoot.actors[m]?.fight?.ai.awareness.state;
      return st !== undefined && st !== 'UNAWARE';
    });
    const p = onFoot.player;
    const h = this.#host;
    const line = fold.update({
      now: secs,
      waiting,
      aware,
      present: (who) => {
        const a = onFoot.actors[who];
        const st = world.people[who]?.status;
        return (
          a !== undefined &&
          a.pose !== 'dead' &&
          a.pose !== 'carried' &&
          (st === 'alive' || st === 'wounded' || st === 'downed')
        );
      },
      tiles: (who) => {
        const a = onFoot.actors[who];
        return a === undefined ? Infinity : Math.hypot(a.x - p.x, a.y - p.y) / tile;
      },
      hold: (key) => h.speechSeconds(h.t(key)),
    });
    if (line === null) return;
    const text = h.t(line.key);
    if (!line.murmur)
      h.say(h.t('caption.format.subtitle', { speaker: h.nameOf(line.person), line: text }), now);
    h.voice(line.person, text, h.pan(line.person), line.murmur ? 0.35 : 1);
  }
}
