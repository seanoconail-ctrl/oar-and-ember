/**
 * Plays Chapter 1's gate, the launch (Stage 12), through the simulation's commands as the
 * interface would send them: looks the boat over and asks to launch it (the readiness screen is
 * the interface's), waits for the tide to float the boat if it must, confirms, names it, marks its
 * sail, lets the scene play, and closes the sea map.
 */
import { floatLine, launchPhase } from '../../sim/narrative/launch.ts';
import type { LaunchContext } from '../../sim/narrative/launch.ts';
import { RepairBot } from './repairBot.ts';

export class LaunchBot extends RepairBot {
  get launchCtx(): LaunchContext {
    const ctx = this.land.launch ?? null;
    if (ctx === null) throw new Error('no launch in the content');
    return ctx;
  }

  /** Looks the boat over and chooses "Launch the boat" (the gate must be open). */
  askToLaunch(): void {
    this.lookAtBoat();
    if (!this.options().includes('p_steerer.boat.launch'))
      throw new Error('the launch is not offered at the boat');
    const seen = { asked: false };
    const off = this.sim.events.onAny((e) => {
      if (e.type === 'READINESS_ASKED') seen.asked = true;
    });
    this.choose('p_steerer.boat.launch');
    off();
    if (!seen.asked) throw new Error('the readiness screen was not asked for');
    this.waitFor(() => this.sim.state.talk === null, 60 * 30);
  }

  /** Waits (time passing on the strand) until the tide would float the boat. */
  waitForWater(): void {
    const b = this.timeBalance;
    this.waitFor(
      () => floatLine(this.sim.state, this.launchCtx, this.land, b) !== null,
      60 * 60 * 20,
    );
  }

  /**
   * Starts the gate, names the boat and marks its sail, plays the scene to the sea map, waits
   * `mapSeconds` over the map, and closes it (Chapter 1 ends).
   */
  launch(name: string, pattern: string, dye: string | null, mapSeconds = 0): void {
    this.sim.submit({ type: 'START_GATE', gate: this.launchCtx.def.gate });
    this.sim.submit({ type: 'NAME_SHIP', name });
    this.sim.submit({ type: 'MARK_SAIL', pattern, dye });
    this.step();
    if (this.sim.state.gates[this.launchCtx.def.gate]?.status !== 'STARTED')
      throw new Error('the launch did not start');
    this.waitFor(() => launchPhase(this.sim.state) === 'MAP', 60 * 120);
    // The sea map stops time: the reader's seconds are held time (the interface sends them).
    if (mapSeconds > 0) this.sim.submit({ type: 'TIME_HELD', ms: mapSeconds * 1000 });
    this.sim.submit({ type: 'CLOSE_SEA_MAP' });
    this.step();
    if (launchPhase(this.sim.state) !== 'DONE') throw new Error('the chapter did not end');
  }
}
