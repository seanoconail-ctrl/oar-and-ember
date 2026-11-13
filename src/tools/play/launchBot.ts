/**
 * Plays Chapter 1's gate, the launch (Stage 12), through the simulation's commands as the
 * interface would send them: looks the boat over and asks to launch it (the readiness screen is
 * the interface's), waits for the tide to float the boat if it must, confirms, names it, marks its
 * sail, lets the scene play, and closes the sea map.
 */
import { floatLine, launchPhase } from '../../sim/narrative/launch.ts';
import type { LaunchContext } from '../../sim/narrative/launch.ts';
import type { Intent } from '../../sim/narrative/raid.ts';
import { RepairBot } from './repairBot.ts';

export class LaunchBot extends RepairBot {
  get launchCtx(): LaunchContext {
    const ctx = this.land.launch ?? null;
    if (ctx === null) throw new Error('no launch in the content');
    return ctx;
  }

  /**
   * A reason for the first raid (DH-140): calls the household to council at the fire once the
   * launch's gate is open, waits while they gather and speak, and chooses the intent. Nothing to do
   * without content/raid.json, or once the council has been held.
   */
  council(intent: Intent): void {
    const raid = this.land.raid ?? null;
    if (raid === null || this.sim.state.facts['ch1.council'] !== undefined) return;
    this.waitFor(() => this.sim.state.facts['council.open'] === true, 60 * 60 * 30);
    const call = raid.def.council;
    this.waitFor(() => this.sim.state.talk === null, 60 * 30);
    this.useAt(call.zone, call.call.x, call.call.y, 1.2);
    if (this.sim.state.facts['council.stage'] === undefined)
      throw new Error('the household was not called to council');
    this.waitFor(() => this.sim.state.talk?.scene === call.talk.id, 60 * 60);
    this.waitFor(() => this.options().length > 0, 60 * 120);
    this.choose(`p_steerer.council.${intent.toLowerCase()}`);
    this.waitFor(() => this.sim.state.talk === null, 60 * 120);
    const held: unknown = this.sim.state.facts['ch1.council'];
    if (held !== intent) throw new Error('the council was not held');
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
