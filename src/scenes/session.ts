/**
 * One frame of play: sample input, run the command ring and menus, turn the hotbar keys, the
 * wheel, the pointer, the right stick and the facing into commands (Book 2 section 21), and
 * advance the simulation by whole 60 Hz ticks unless an open menu has stopped time (Book 2
 * sections 02 and 03). The command ring is not a menu and never stops time. A use or interaction
 * on a tile out of reach sends nothing: the frame reports the refusal for the view to show.
 *
 * A drawn bow (Book 10 section 21, drawPlantsFeet): the mouse, the right stick (or the left), or
 * the movement keys in keyboard-only play turn the aim, since the feet are planted; the aim point
 * is the cursor's ground point (a cursor on a person aims at where they stand). Interact
 * (right-click), the system menu (Escape) and dodge (pad B) lower it instead of their own action,
 * and the use button must be let go before it draws again. With empty hands, use is a shove.
 */
import type { ControlsBalance } from '../content/balance.ts';
import { planSteps } from '../core/fixedStep.ts';
import type { Id } from '../core/ids.ts';
import { SLOT_ACTIONS } from '../input/actions.ts';
import { aimDirection, inReach, targetTile, tileAt } from '../input/targeting.ts';
import type { Device, Tile } from '../input/targeting.ts';
import { CommandRing } from '../input/commandRing.ts';
import type { CrewOrder } from '../input/commandRing.ts';
import type { InputFrame, InputMapper } from '../input/inputState.ts';
import { disabledActions, interactionAt } from '../sim/land/onFoot.ts';
import type { Action } from '../input/actions.ts';
import type { ItemUse, OnFootRules } from '../sim/land/onFoot.ts';
import type { ZoneMap } from '../sim/land/zoneMap.ts';
import { AIM_DIRECTIONS } from '../sim/simulation.ts';
import type { Simulation } from '../sim/simulation.ts';
import type { PeopleContext } from '../sim/people/context.ts';
import { talkOptions } from '../sim/people/talk.ts';
import type { SearchContext } from '../sim/narrative/searches.ts';
import { MenuController } from '../ui/menus.ts';
import type { MenuId, OpenResult, ThreatView } from '../ui/menus.ts';

/** Actions that lower a drawn bow instead of doing their own thing (Book 10 drawPlantsFeet). */
export const CANCEL_DRAW: readonly Action[] = ['interact', 'systemMenu', 'dodge'];

const MENU_ACTIONS: readonly [
  InputFrame['pressed'] extends ReadonlySet<infer A> ? A : never,
  MenuId,
][] = [
  ['map', 'map'],
  ['inventory', 'inventory'],
  ['buildMenu', 'build'],
  ['report', 'report'],
];

export interface FrameResult {
  readonly ticks: number;
  readonly orders: readonly CrewOrder[];
  readonly menuResults: readonly OpenResult[];
  readonly alpha: number;
  /** Actions pressed this frame that were refused, with the reason (none yet but CARRYING). */
  readonly refusedActions: readonly { readonly action: string; readonly reason: 'CARRYING' }[];
  /** The target tile and the hand, for the cursor and the hotbar (null off foot or in a menu). */
  readonly target: TargetView | null;
  /** The right stick this frame (the camera leads towards it with a gamepad). */
  readonly stick: { readonly x: number; readonly y: number };
  /** The frame's input, for the pause menu's navigation while it is open (decision DG-15). */
  readonly input: InputFrame;
}

/** What the controls need of the zone: its map, Book 10's reach, and how each item is used. */
export interface SessionLand {
  readonly map: ZoneMap;
  readonly controls: ControlsBalance;
  readonly rules: OnFootRules;
}

/** Where the pointer is and which device was used last, from the browser each frame. */
export interface TargetInput {
  readonly device: Device;
  /** The pointer in world pixels, or null. */
  readonly pointer: { readonly x: number; readonly y: number } | null;
}

export interface TargetView {
  readonly device: Device;
  readonly tile: Tile;
  readonly inReach: boolean;
  /** Reach in tiles for what a click there would do. */
  readonly reach: number;
  /** The hotbar slot in hand (predicted this frame) and its item. */
  readonly slot: number;
  readonly item: Id | null;
  readonly use: ItemUse | null;
  /** Something to interact with on the tile (a person to lift, or ground to set someone on). */
  readonly interactive: boolean;
  /** The aim direction (of AIM_DIRECTIONS) while drawing, else null. */
  readonly aimDir: number | null;
  /** A click this frame on a tile out of reach: refused and not sent. */
  readonly refused: 'TOO_FAR' | null;
}

export class Session {
  readonly sim: Simulation;
  readonly input: InputMapper;
  readonly menus: MenuController;
  readonly ring = new CommandRing();
  /** The zone's map and the controls' rules; replaced when the steerer walks into another zone. */
  land: SessionLand | null;
  #accumulator = 0;
  #lastMove = '';
  #aimDir: number | null = null;
  #aimDist: number | null = null;
  /** A draw was lowered: the use button must be let go before it draws again. */
  #cancelLatch = false;
  #wantSlot: number | null = null;
  /** Stage 9: a melee press held (its release is sent), the block and the finisher held. */
  #meleeHeld = false;
  #blockHeld = false;
  /** The stance's last aim sent (combat v2: FACE), one of AIM_DIRECTIONS. */
  #faceDir: number | null = null;
  #finisherHeld = false;
  /** USE_AT and INTERACT_AT commands sent (the tests check a refused click sends none). */
  tileCommands = 0;
  /** The household's people (Stage 8), for the conversation's options; null without them. */
  people: PeopleContext | null = null;
  /** Stage 10: the searches' words (their options come from here). */
  searches: SearchContext | null = null;
  /** The option highlighted in a conversation (the wheel and the pad move it). */
  talkCursor = 0;
  /**
   * The pause menu's back (decision DG-15): the system key on one of its pages goes back to its
   * list rather than closing it. Returns true when it did.
   */
  systemBack: (() => boolean) | null = null;
  /**
   * The user's third playtest (decision DG-2; Book 10 padContext): whether the finish-or-let-go
   * choice is offered with no other foe in reach winding up, so the pad's parry button (Y) held
   * finishes and its interact button (A) lets go. Set by the play view; null: never.
   */
  finishChoice: (() => boolean) | null = null;

  constructor(
    sim: Simulation,
    input: InputMapper,
    threat: ThreatView,
    land: SessionLand | null = null,
  ) {
    this.sim = sim;
    this.input = input;
    this.menus = new MenuController(threat);
    this.land = land;
  }

  /** Runs one rendered frame of `elapsedMs` wall-clock time. `aim` steers the command ring. */
  frame(
    elapsedMs: number,
    aim: { x: number; y: number } = { x: 0, y: 0 },
    pointing: TargetInput = { device: 'key', pointer: null },
  ): FrameResult {
    let input = padChoice(this.input.sample(), this.finishChoice?.() === true);
    const menuResults: OpenResult[] = [];
    // Lowering a drawn bow comes before everything those keys would otherwise do.
    const drawn = this.#aimDir !== null || this.sim.state.onFoot?.player.aim != null;
    if (drawn && CANCEL_DRAW.some((a) => input.pressed.has(a))) {
      this.sim.submit({ type: 'CANCEL_AIM' });
      this.#aimDir = null;
      this.#aimDist = null;
      this.#cancelLatch = true;
      input = {
        ...input,
        pressed: new Set([...input.pressed].filter((a) => !CANCEL_DRAW.includes(a))),
      };
    }
    // The system key comes first and closes whatever is open, so "close, then open another" works
    // even when both presses land in one frame (slow frames do this).
    if (input.pressed.has('systemMenu')) {
      if (this.menus.open === 'system' && this.systemBack?.() === true) {
        // A page of the pause menu went back to its list.
      } else if (this.menus.open !== null) this.menus.close();
      else menuResults.push(this.menus.request('system'));
    }
    for (const [action, menu] of MENU_ACTIONS) {
      // The pause menu's own keys are its pages' (DG-15): no other menu opens over it.
      if (!input.pressed.has(action) || this.menus.open === 'system') continue;
      if (this.menus.open === menu) this.menus.close();
      else menuResults.push(this.menus.request(menu));
    }
    this.menus.update();
    const orders = this.menus.timeStopped ? [] : this.ring.update(input, aim);
    for (const order of orders) this.sim.submit({ type: 'CREW_ORDER', order });
    // The ring's centre heals (DF-21: heal on the gamepad's command ring).
    if (this.ring.takeHeal() && !this.menus.timeStopped) this.sim.submit({ type: 'HEAL' });

    // On foot: the movement wanted and Interact, applied at the start of the very next tick, so
    // a key pressed before this frame moves the steerer in this frame (no added latency).
    const refusedActions: { action: string; reason: 'CARRYING' }[] = [];
    const onFoot = this.sim.state.onFoot;
    let target: TargetView | null = null;
    const p = onFoot?.player;
    const talk = this.sim.state.talk;
    if (talk !== null && this.people !== null && !this.menus.timeStopped) {
      // A conversation or scene (Book 8 section 09): a number chooses, the wheel or the pad moves
      // the highlight and use or interact takes it; Escape or dodge leaves a conversation (a
      // scene waits for its judgement). Time goes on; walking away ends a conversation.
      const options = talkOptions(this.sim.state, this.people, this.searches);
      const n = options.length;
      if (n > 0) {
        this.talkCursor = Math.min(this.talkCursor, n - 1);
        if (input.pressed.has('slotNext')) this.talkCursor = (this.talkCursor + 1) % n;
        if (input.pressed.has('slotPrev')) this.talkCursor = (this.talkCursor - 1 + n) % n;
        let chosen: number | null = null;
        SLOT_ACTIONS.forEach((action, i) => {
          if (input.pressed.has(action) && i < n) chosen = i;
        });
        if (input.pressed.has('useItem') || input.pressed.has('interact')) chosen = this.talkCursor;
        if (chosen !== null) {
          this.sim.submit({ type: 'TALK_CHOOSE', index: chosen });
          this.talkCursor = 0;
        }
      }
      if (
        (talk.kind === 'TALK' || talk.kind === 'SEARCH') &&
        (input.pressed.has('dodge') || menuResults.length > 0)
      )
        this.sim.submit({ type: 'TALK_END' });
      const walk = talk.kind === 'TALK' ? input.move : { x: 0, y: 0 };
      const key = `${walk.x},${walk.y},false,false`;
      if (key !== this.#lastMove) {
        this.sim.submit({ type: 'MOVE', x: walk.x, y: walk.y, run: false, sneak: false });
        this.#lastMove = key;
      }
    } else if (p?.work != null && !this.menus.timeStopped && this.menus.open === null) {
      // A hands-on action plays (Book 2 section 07): use or interact is the timing press; the
      // system key and dodge stop it. Movement waits until it ends.
      if (input.pressed.has('useItem') || input.pressed.has('interact'))
        this.sim.submit({ type: 'WORK_PRESS' });
      if (input.pressed.has('dodge')) this.sim.submit({ type: 'CANCEL_WORK' });
      const key = `0,0,false,false`;
      if (key !== this.#lastMove) {
        this.sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
        this.#lastMove = key;
      }
    } else if (p?.sleep != null) {
      // Lying down: nothing to do but let the night come.
    } else if (onFoot !== null && !this.menus.timeStopped && this.menus.open === null) {
      const move = {
        type: 'MOVE' as const,
        x: input.move.x,
        y: input.move.y,
        run: input.held.has('run'),
        // Combat v2: sneak is a toggle in the simulation (Book 10 sneakToggle; SNEAK below).
        sneak: false,
      };
      const key = `${move.x},${move.y},${move.run},${move.sneak}`;
      if (key !== this.#lastMove) {
        this.sim.submit(move);
        this.#lastMove = key;
      }
      const disabled = disabledActions(onFoot);
      for (const [action, reason] of disabled) {
        if (input.pressed.has(action as never)) refusedActions.push({ action, reason });
      }
      target = this.#controls(input, pointing, disabled.has('useItem'));
    } else if (onFoot !== null && this.#lastMove !== '0,0,false,false') {
      // A menu opened: stand still rather than walk on under it.
      this.sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
      this.#lastMove = '0,0,false,false';
    }

    const plan = planSteps(this.#accumulator, elapsedMs);
    this.#accumulator = plan.accumulator;
    let ticks = 0;
    if (!this.menus.timeStopped) {
      for (let i = 0; i < plan.steps; i++) this.sim.step();
      ticks = plan.steps;
    }
    return {
      ticks,
      orders,
      menuResults,
      alpha: plan.alpha,
      refusedActions,
      target,
      stick: input.stick,
      input,
    };
  }

  /** The hotbar, the target tile, use and interact (Book 2 section 21). */
  #controls(input: InputFrame, pointing: TargetInput, handsFull: boolean): TargetView | null {
    const onFoot = this.sim.state.onFoot;
    if (onFoot === null) return null;
    const p = onFoot.player;
    const hotbar = this.sim.state.player.hotbar;
    const land = this.land;
    const slots = land?.controls.hotbarSlots ?? hotbar.slots.length;
    // The hotbar: a slot key, or the wheel and shoulder buttons through the slots.
    // A choice sent but not yet applied (no tick ran since) still counts as in hand.
    if (this.#wantSlot === hotbar.selected) this.#wantSlot = null;
    let slot = this.#wantSlot ?? hotbar.selected;
    const was = slot;
    SLOT_ACTIONS.forEach((action, i) => {
      if (input.pressed.has(action) && i < slots) slot = i;
    });
    if (slots > 0) {
      if (input.pressed.has('slotNext')) slot = (slot + 1) % slots;
      if (input.pressed.has('slotPrev')) slot = (slot - 1 + slots) % slots;
    }
    if (slot !== was) {
      this.sim.submit({ type: 'SELECT_SLOT', slot });
      this.#wantSlot = slot;
    }
    if (land === null) {
      // Without a zone to target, Interact is the nearest thing in reach.
      if (input.pressed.has('interact')) this.sim.submit({ type: 'INTERACT' });
      return null;
    }
    const item = hotbar.slots[slot] ?? null;
    const use = item === null ? null : (land.rules.items[item]?.use ?? null);
    const tile = land.map.tile;
    const c = land.controls;
    const query = {
      device: pointing.device,
      steerer: p,
      pointer: pointing.pointer,
      stick: input.stick,
      tileSize: tile,
      deadZone: c.gamepadDeadZone,
    };
    // Reach for what a click would do: lifting or setting down is an interaction, else the tool.
    const toolTile = targetTile({ ...query, reach: c.toolReach });
    const near = targetTile({ ...query, reach: c.interactReach });
    const facts = this.sim.state.facts;
    const interactive = interactionAt(onFoot, land.map, land.rules, false, near, facts) !== null;
    const reach = interactive || item === null ? c.interactReach : c.toolReach;
    const at = interactive || item === null ? near : toolTile;
    const ok = inReach(p, at, { ...query, reach });
    let refused: 'TOO_FAR' | null = null;

    // Design addendum 2.4: the hold-to-cut at the net goes on only while Interact is held; let go,
    // it stops and keeps what is cut (Book 10 section 25, cutHold).
    if (input.released.has('interact') && onFoot.player.work?.task === 'TASK_CUT_NET')
      this.sim.submit({ type: 'CANCEL_WORK' });
    // Interact: right-click at the cursor's tile; the key and the pad at the nearest in reach.
    if (input.pressed.has('interact')) {
      if (input.byMouse.has('interact') && pointing.pointer !== null) {
        const t = tileAt(pointing.pointer.x, pointing.pointer.y, tile);
        if (inReach(p, t, { ...query, reach: c.interactReach })) {
          this.sim.submit({ type: 'INTERACT_AT', tile: t });
          this.tileCommands++;
        } else refused = 'TOO_FAR';
      } else this.sim.submit({ type: 'INTERACT' });
    }

    // Use the item in hand: draw and loose a bow, or use it at the target tile.
    let aimDir: number | null = null;
    if (!input.held.has('useItem')) this.#cancelLatch = false;
    if (use === 'AIM' && !handsFull) {
      const holding = input.held.has('useItem') && !this.#cancelLatch;
      if (holding) {
        const aim = this.#aimVector(input, pointing, c.gamepadDeadZone, tile);
        aimDir = aimDirection(aim.x, aim.y, AIM_DIRECTIONS);
        // The press always asks (a refusal, such as an empty quiver, is shown once); changes are
        // sent only while the draw holds.
        const changed = aimDir !== this.#aimDir || aim.dist !== this.#aimDist;
        if (input.pressed.has('useItem') || (p.aim !== null && changed)) {
          this.sim.submit({ type: 'AIM', dir: aimDir, dist: aim.dist });
          this.#aimDist = aim.dist;
        } else if (p.aim === null && this.#aimDir === null) aimDir = null;
      } else if (this.#aimDir !== null) this.sim.submit({ type: 'AIM', dir: null });
    } else if (this.#aimDir !== null) this.sim.submit({ type: 'AIM', dir: null });
    this.#aimDir = aimDir;
    if (aimDir === null) this.#aimDist = null;
    // A melee weapon (Stage 9): the press starts the charge towards the cursor (snapped to the
    // nearest facing), the stick, or the facing; letting go strikes (a light attack if let go
    // before level 1).
    if (use === 'MELEE') {
      if (input.pressed.has('useItem') && !handsFull) {
        this.sim.submit({ type: 'MELEE', facing: this.#meleeFacing(input, pointing) });
        this.#meleeHeld = true;
      }
      if (this.#meleeHeld && !input.held.has('useItem')) {
        this.sim.submit({ type: 'MELEE_RELEASE' });
        this.#meleeHeld = false;
      }
    } else if (this.#meleeHeld) {
      this.sim.submit({ type: 'MELEE_RELEASE' });
      this.#meleeHeld = false;
    }
    // Combat v2 (decisions DE-2, DE-3, DE-8, DE-9): the stance faces the cursor (or the stick, or
    // the way last moved on the keyboard alone); lock-on pressed and let go (a tap switches, a hold
    // releases); sneak toggles; heal binds a wound or eats.
    const face = this.#stanceDirection(input, pointing);
    if (face !== this.#faceDir) {
      this.sim.submit({ type: 'FACE', dir: face });
      this.#faceDir = face;
    }
    if (input.pressed.has('lockOn')) this.sim.submit({ type: 'LOCK_ON', down: true });
    if (input.released.has('lockOn')) this.sim.submit({ type: 'LOCK_ON', down: false });
    if (input.pressed.has('sneak')) this.sim.submit({ type: 'SNEAK' });
    if (input.pressed.has('heal') && !handsFull) this.sim.submit({ type: 'HEAL' });
    // Parry, block and dodge on their own keys; the finisher held (Book 2 section 21).
    if (input.pressed.has('parry') && !handsFull) this.sim.submit({ type: 'PARRY' });
    const block = input.held.has('block') && !handsFull;
    if (block !== this.#blockHeld) {
      this.sim.submit({ type: 'BLOCK', on: block });
      this.#blockHeld = block;
    }
    if (input.pressed.has('dodge'))
      this.sim.submit({ type: 'DODGE', x: input.move.x, y: input.move.y });
    const finisher = input.held.has('finisher');
    if (finisher !== this.#finisherHeld) {
      this.sim.submit({ type: 'FINISHER', on: finisher });
      this.#finisherHeld = finisher;
    }
    // Let go (decision DG-2): one press; the shout follows at once.
    if (input.pressed.has('spare')) this.sim.submit({ type: 'SPARE' });
    if (
      use !== 'AIM' &&
      use !== 'MELEE' &&
      use !== null &&
      input.pressed.has('useItem') &&
      !handsFull
    ) {
      if (inReach(p, toolTile, { ...query, reach: c.toolReach })) {
        this.sim.submit({ type: 'USE_AT', slot, tile: toolTile });
        this.tileCommands++;
      } else refused = 'TOO_FAR';
    }
    // Empty hands: use is a shove, towards the target tile; the shove key shoves too.
    const shove = (use === null && input.pressed.has('useItem')) || input.pressed.has('shove');
    if (shove && !handsFull && p.aim === null)
      this.sim.submit(
        pointing.device === 'key' ? { type: 'SHOVE' } : { type: 'SHOVE', tile: toolTile },
      );
    return {
      device: pointing.device,
      tile: at,
      inReach: ok,
      reach,
      slot,
      item,
      use,
      interactive,
      aimDir,
      refused,
    };
  }

  /**
   * The stance's aim as one of AIM_DIRECTIONS (combat v2, decision DE-2): towards the cursor from
   * the body's middle, the right stick past its dead zone, or in keyboard-only play the way last
   * moved; null with none.
   */
  #stanceDirection(input: InputFrame, pointing: TargetInput): number | null {
    const p = this.sim.state.onFoot?.player;
    if (p == null) return null;
    let x: number;
    let y: number;
    if (pointing.device === 'mouse' && pointing.pointer !== null) {
      x = pointing.pointer.x - p.x;
      y = pointing.pointer.y - (p.y - BODY_HEIGHT / 2);
    } else if (
      pointing.device === 'pad' &&
      Math.hypot(input.stick.x, input.stick.y) > (this.land?.controls.gamepadDeadZone ?? 0)
    ) {
      x = input.stick.x;
      y = input.stick.y;
    } else if (input.move.x !== 0 || input.move.y !== 0) {
      x = input.move.x;
      y = input.move.y;
    } else return this.#faceDir;
    if (Math.hypot(x, y) < 1e-6) return this.#faceDir;
    return aimDirection(x, y, AIM_DIRECTIONS);
  }

  /** The facing a melee blow goes towards: the cursor, the right stick, else the way one faces. */
  #meleeFacing(input: InputFrame, pointing: TargetInput): 's' | 'n' | 'e' | 'w' {
    const p = this.sim.state.onFoot?.player ?? { x: 0, y: 0, facing: 's' as const };
    let x = 0;
    let y = 0;
    if (pointing.device === 'mouse' && pointing.pointer !== null) {
      x = pointing.pointer.x - p.x;
      y = pointing.pointer.y - (p.y - BODY_HEIGHT / 2);
    } else if (
      pointing.device === 'pad' &&
      Math.hypot(input.stick.x, input.stick.y) > (this.land?.controls.gamepadDeadZone ?? 0)
    ) {
      x = input.stick.x;
      y = input.stick.y;
    } else if (input.move.x !== 0 || input.move.y !== 0) {
      x = input.move.x;
      y = input.move.y;
    }
    if (x === 0 && y === 0) return p.facing;
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'e' : 'w';
    return y > 0 ? 's' : 'n';
  }

  /**
   * Where the bow is aimed, from the steerer's feet: the cursor's ground point and its distance in
   * tiles (a cursor on a person's body aims at where they stand); the right stick, or the left
   * stick or the movement keys while the feet are planted; else the way the steerer faces. Only
   * the mouse gives a distance: the others fly to full range.
   */
  #aimVector(
    input: InputFrame,
    pointing: TargetInput,
    deadZone: number,
    tile: number,
  ): { x: number; y: number; dist: number | null } {
    const onFoot = this.sim.state.onFoot;
    const p = onFoot?.player ?? { x: 0, y: 0, facing: 's' as const };
    if (pointing.device === 'mouse' && pointing.pointer !== null) {
      let ground = pointing.pointer;
      for (const a of Object.values(onFoot?.actors ?? {})) {
        if (a.pose === 'carried') continue;
        if (Math.abs(ground.x - a.x) <= 8 && ground.y <= a.y + 2 && ground.y >= a.y - BODY_HEIGHT) {
          ground = { x: a.x, y: a.y - 1 };
          break;
        }
      }
      const x = ground.x - p.x;
      const y = ground.y - p.y;
      const d = Math.hypot(x, y);
      if (d > 0.5) return { x, y, dist: Math.round((d / tile) * 16) / 16 };
    }
    const stick = Math.hypot(input.stick.x, input.stick.y) > deadZone;
    if (pointing.device === 'pad' && stick) return { ...input.stick, dist: null };
    if (pointing.device !== 'mouse' && (input.move.x !== 0 || input.move.y !== 0))
      return { ...input.move, dist: null };
    if (this.#aimDir !== null) {
      const a = (this.#aimDir / AIM_DIRECTIONS) * 2 * Math.PI;
      return { x: Math.cos(a), y: Math.sin(a), dist: this.#aimDist };
    }
    const ahead = AHEAD_VECTOR[p.facing];
    return { ...ahead, dist: null };
  }
}

/** Body height of a person, in pixels, for aiming at someone with the cursor (Book 7: 40 px). */
const BODY_HEIGHT = 40;

const AHEAD_VECTOR: Readonly<Record<'s' | 'n' | 'e' | 'w', { x: number; y: number }>> = {
  s: { x: 0, y: 1 },
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
};

/**
 * The pad in the finish-or-let-go context (Book 10 padContext): its parry button held is the
 * finisher held, and its interact button pressed is let go; the keyboard's own keys are untouched.
 */
export function padChoice(input: InputFrame, offered: boolean): InputFrame {
  const pad = input.byPad;
  if (!offered || pad === undefined || pad.size === 0) return input;
  const swap = (set: ReadonlySet<Action>, from: Action, to: Action): Set<Action> => {
    const out = new Set(set);
    if (pad.has(from) && out.has(from)) {
      out.delete(from);
      out.add(to);
    }
    return out;
  };
  return {
    ...input,
    held: swap(swap(input.held, 'parry', 'finisher'), 'interact', 'spare'),
    pressed: swap(swap(input.pressed, 'parry', 'finisher'), 'interact', 'spare'),
  };
}
