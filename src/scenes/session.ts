/**
 * One frame of play: sample input, run the command ring and menus, turn the hotbar keys, the
 * wheel, the pointer, the right stick and the facing into commands (Book 2 section 21), and
 * advance the simulation by whole 60 Hz ticks unless an open menu has stopped time (Book 2
 * sections 02 and 03). The command ring is not a menu and never stops time. A use or interaction
 * on a tile out of reach sends nothing: the frame reports the refusal for the view to show.
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
import { disabledActions, interactionAt, NEEDS_LIFT } from '../sim/land/onFoot.ts';
import type { ItemUse, OnFootRules } from '../sim/land/onFoot.ts';
import type { ZoneMap } from '../sim/land/zoneMap.ts';
import { AIM_DIRECTIONS } from '../sim/simulation.ts';
import type { Simulation } from '../sim/simulation.ts';
import { MenuController } from '../ui/menus.ts';
import type { MenuId, OpenResult, ThreatView } from '../ui/menus.ts';

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
  readonly land: SessionLand | null;
  #accumulator = 0;
  #lastMove = '';
  #aimDir: number | null = null;
  #wantSlot: number | null = null;
  /** USE_AT and INTERACT_AT commands sent (the tests check a refused click sends none). */
  tileCommands = 0;

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
    const input = this.input.sample();
    const menuResults: OpenResult[] = [];
    // The system key comes first and closes whatever is open, so "close, then open another" works
    // even when both presses land in one frame (slow frames do this).
    if (input.pressed.has('systemMenu')) {
      if (this.menus.open !== null) this.menus.close();
      else menuResults.push(this.menus.request('system'));
    }
    for (const [action, menu] of MENU_ACTIONS) {
      if (!input.pressed.has(action)) continue;
      if (this.menus.open === menu) this.menus.close();
      else menuResults.push(this.menus.request(menu));
    }
    this.menus.update();
    const orders = this.menus.timeStopped ? [] : this.ring.update(input, aim);
    for (const order of orders) this.sim.submit({ type: 'CREW_ORDER', order });

    // On foot: the movement wanted and Interact, applied at the start of the very next tick, so
    // a key pressed before this frame moves the steerer in this frame (no added latency).
    const refusedActions: { action: string; reason: 'CARRYING' }[] = [];
    const onFoot = this.sim.state.onFoot;
    let target: TargetView | null = null;
    if (onFoot !== null && !this.menus.timeStopped && this.menus.open === null) {
      const move = {
        type: 'MOVE' as const,
        x: input.move.x,
        y: input.move.y,
        run: input.held.has('run'),
        sneak: input.held.has('sneak'),
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
    const interactive =
      interactionAt(onFoot, land.map, land.rules, false, near) !== null &&
      (onFoot.carrying !== null ||
        Object.values(onFoot.actors).some((a) => NEEDS_LIFT.includes(a.pose)));
    const reach = interactive || item === null ? c.interactReach : c.toolReach;
    const at = interactive || item === null ? near : toolTile;
    const ok = inReach(p, at, { ...query, reach });
    let refused: 'TOO_FAR' | null = null;

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
    if (use === 'AIM' && !handsFull) {
      if (input.held.has('useItem')) {
        const stick = Math.hypot(input.stick.x, input.stick.y) > c.gamepadDeadZone;
        const hand = { x: p.x, y: p.y - 26 };
        const v =
          pointing.device === 'mouse' && pointing.pointer !== null
            ? { x: pointing.pointer.x - hand.x, y: pointing.pointer.y - hand.y }
            : pointing.device === 'pad' && stick
              ? input.stick
              : AHEAD_VECTOR[p.facing];
        aimDir = aimDirection(v.x, v.y, AIM_DIRECTIONS);
        if (aimDir !== this.#aimDir) this.sim.submit({ type: 'AIM', dir: aimDir });
      } else if (this.#aimDir !== null) this.sim.submit({ type: 'AIM', dir: null });
    } else if (this.#aimDir !== null) this.sim.submit({ type: 'AIM', dir: null });
    this.#aimDir = aimDir;
    if (use !== 'AIM' && use !== null && input.pressed.has('useItem') && !handsFull) {
      if (inReach(p, toolTile, { ...query, reach: c.toolReach })) {
        this.sim.submit({ type: 'USE_AT', slot, tile: toolTile });
        this.tileCommands++;
      } else refused = 'TOO_FAR';
    }
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
}

const AHEAD_VECTOR: Readonly<Record<'s' | 'n' | 'e' | 'w', { x: number; y: number }>> = {
  s: { x: 0, y: 1 },
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
};
