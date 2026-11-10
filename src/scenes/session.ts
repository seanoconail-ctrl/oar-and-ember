/**
 * One frame of play: sample input, run the command ring and menus, and advance the simulation by
 * whole 60 Hz ticks unless an open menu has stopped time (Book 2 sections 02 and 03). The command
 * ring is not a menu and never stops time.
 */
import { planSteps } from '../core/fixedStep.ts';
import { CommandRing } from '../input/commandRing.ts';
import type { CrewOrder } from '../input/commandRing.ts';
import type { InputFrame, InputMapper } from '../input/inputState.ts';
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
}

export class Session {
  readonly sim: Simulation;
  readonly input: InputMapper;
  readonly menus: MenuController;
  readonly ring = new CommandRing();
  #accumulator = 0;

  constructor(sim: Simulation, input: InputMapper, threat: ThreatView) {
    this.sim = sim;
    this.input = input;
    this.menus = new MenuController(threat);
  }

  /** Runs one rendered frame of `elapsedMs` wall-clock time. `aim` steers the command ring. */
  frame(elapsedMs: number, aim: { x: number; y: number } = { x: 0, y: 0 }): FrameResult {
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

    const plan = planSteps(this.#accumulator, elapsedMs);
    this.#accumulator = plan.accumulator;
    let ticks = 0;
    if (!this.menus.timeStopped) {
      for (let i = 0; i < plan.steps; i++) this.sim.step();
      ticks = plan.steps;
    }
    return { ticks, orders, menuResults, alpha: plan.alpha };
  }
}
