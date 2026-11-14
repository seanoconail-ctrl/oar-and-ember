/** Stage 5: the safe rule (acceptance check 1) and the command ring never stopping time (check 2). */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../../src/input/actions.ts';
import { CommandRing, orderAt } from '../../src/input/commandRing.ts';
import { InputMapper } from '../../src/input/inputState.ts';
import { Session } from '../../src/scenes/session.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent } from '../../src/sim/simulation.ts';
import { emptyWorld } from '../../src/sim/world.ts';
import { MENUS, MenuController } from '../../src/ui/menus.ts';
import { loadTimeBalance } from '../../src/tools/content/loadBalance.ts';

const b = loadTimeBalance();

/** A hostile that the test can make aware of the player or not. */
function testHostile() {
  let aware = false;
  return {
    set aware(v: boolean) {
      aware = v;
    },
    awareHostiles: () => (aware ? 1 : 0),
  };
}

describe('the safe rule (Book 2 section 02)', () => {
  it('refuses every menu while a test hostile is aware of the player, with the reason', () => {
    const hostile = testHostile();
    hostile.aware = true;
    const menus = new MenuController(hostile);
    for (const menu of MENUS.filter((m) => m !== 'system')) {
      expect(menus.request(menu)).toEqual({ ok: false, menu, reason: 'HOSTILES_AWARE', aware: 1 });
      expect(menus.open).toBeNull();
      expect(menus.timeStopped).toBe(false);
    }
  });

  it('opens the system menu as an overlay without stopping time while hostiles are aware', () => {
    const hostile = testHostile();
    hostile.aware = true;
    const menus = new MenuController(hostile);
    expect(menus.request('system')).toEqual({ ok: true, menu: 'system', timeStopped: false });
  });

  it('opens menus and stops time when it is safe, and closes them if danger arrives', () => {
    const hostile = testHostile();
    const menus = new MenuController(hostile);
    expect(menus.request('map')).toEqual({ ok: true, menu: 'map', timeStopped: true });
    hostile.aware = true;
    menus.update();
    expect(menus.open).toBeNull();
    expect(menus.timeStopped).toBe(false);
    hostile.aware = false;
    menus.request('system');
    hostile.aware = true;
    menus.update();
    expect([menus.open, menus.timeStopped]).toEqual(['system', false]);
  });
});

describe('the command ring (Book 2 section 12)', () => {
  it('places the six orders around the ring, FOLLOW at the top', () => {
    expect(orderAt(0, -1)).toBe('FOLLOW');
    expect(orderAt(1, -0.6)).toBe('HOLD');
    expect(orderAt(1, 0.6)).toBe('ATTACK');
    expect(orderAt(0, 1)).toBe('PROTECT');
    expect(orderAt(-1, 0.6)).toBe('CARRY');
    expect(orderAt(-1, -0.6)).toBe('WITHDRAW');
    expect(orderAt(0.1, 0.1)).toBeNull();
  });

  it('issues quick orders on F1 to F6, and the ring order on release', () => {
    const input = new InputMapper(DEFAULT_BINDINGS);
    const ring = new CommandRing();
    input.keyDown('F3');
    expect(ring.update(input.sample(), { x: 0, y: 0 })).toEqual(['ATTACK']);
    input.keyUp('F3');
    input.keyDown('Tab');
    expect(ring.update(input.sample(), { x: 0, y: 1 })).toEqual([]);
    expect(ring.state).toEqual({ open: true, selected: 'PROTECT' });
    input.keyUp('Tab');
    expect(ring.update(input.sample(), { x: 0, y: 1 })).toEqual(['PROTECT']);
    expect(ring.state.open).toBe(false);
  });

  it('never stops time: the simulation runs on while the ring is open', () => {
    const input = new InputMapper(DEFAULT_BINDINGS);
    const session = new Session(createSimulation(b, emptyWorld('ring', b)), input, testHostile());
    const events: SimEvent[] = [];
    session.sim.events.onAny((e) => events.push(e));
    input.keyDown('Tab');
    let ticks = 0;
    for (let f = 0; f < 120; f++) ticks += session.frame(1000 / 60, { x: 1, y: 0.6 }).ticks;
    expect(session.ring.state.open).toBe(true);
    expect(ticks).toBe(120);
    expect(session.sim.state.tick).toBe(120);
    input.keyUp('Tab');
    const result = session.frame(1000 / 60, { x: 1, y: 0.6 });
    expect(result.orders).toEqual(['ATTACK']);
    session.frame(1000 / 60);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'CREW_ORDER_GIVEN', order: 'ATTACK' }),
    );
  });

  it('while a menu is open, time does stop', () => {
    const input = new InputMapper(DEFAULT_BINDINGS);
    const session = new Session(createSimulation(b, emptyWorld('menu', b)), input, testHostile());
    input.keyDown('KeyM');
    session.frame(1000 / 60);
    input.keyUp('KeyM');
    const before = session.sim.state.tick;
    for (let f = 0; f < 60; f++) session.frame(1000 / 60);
    expect(session.menus.open).toBe('map');
    expect(session.sim.state.tick).toBe(before);
  });

  it('closes the open menu and opens another when both keys land in one frame', () => {
    const input = new InputMapper(DEFAULT_BINDINGS);
    const session = new Session(createSimulation(b, emptyWorld('keys', b)), input, testHostile());
    input.keyDown('Escape');
    input.keyUp('Escape');
    session.frame(1000 / 60);
    expect(session.menus.open).toBe('system');
    for (const code of ['Escape', 'KeyM']) {
      input.keyDown(code);
      input.keyUp(code);
    }
    session.frame(1000 / 60);
    expect(session.menus.open).toBe('map');
    input.keyDown('Escape');
    input.keyUp('Escape');
    session.frame(1000 / 60);
    expect(session.menus.open).toBeNull();
  });
});
