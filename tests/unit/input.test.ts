/** Stage 5: the action map, hold-or-toggle, remapping and its persistence (acceptance check 2). */
import { describe, expect, it } from 'vitest';
import { ACTIONS, bindingLabel, DEFAULT_BINDINGS, rebind } from '../../src/input/actions.ts';
import { InputMapper } from '../../src/input/inputState.ts';
import {
  loadSettings,
  parseSettings,
  saveSettings,
  SETTINGS_KEY,
} from '../../src/input/settingsStore.ts';

class MemoryStore {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('the action map (Book 2 section 21)', () => {
  it('binds every action on the keyboard or mouse', () => {
    for (const action of ACTIONS) {
      expect(
        DEFAULT_BINDINGS[action].some((b) => b.device === 'key' || b.device === 'mouse'),
        action,
      ).toBe(true);
    }
  });

  it('binds movement, attacks, defence, the ring and menus on a gamepad too', () => {
    for (const action of [
      'moveUp',
      'interact',
      'lightAttack',
      'heavy',
      'parry',
      'block',
      'dodge',
      'shove',
      'commandRing',
      'systemMenu',
    ] as const) {
      expect(
        DEFAULT_BINDINGS[action].some((b) => b.device === 'pad' || b.device === 'axis'),
        action,
      ).toBe(true);
    }
  });

  it('labels bindings for people', () => {
    expect(bindingLabel({ device: 'key', code: 'KeyE' })).toBe('E');
    expect(bindingLabel({ device: 'key', code: 'ShiftLeft' })).toBe('Shift');
    expect(bindingLabel({ device: 'mouse', button: 0 })).toBe('Mouse 1');
  });
});

describe('the input mapper', () => {
  it('reports presses, holds and releases once each', () => {
    const input = new InputMapper(DEFAULT_BINDINGS);
    input.keyDown('KeyE');
    expect([...input.sample().pressed]).toEqual(['interact']);
    const held = input.sample();
    expect(held.pressed.size).toBe(0);
    expect(held.held.has('interact')).toBe(true);
    input.keyUp('KeyE');
    expect([...input.sample().released]).toEqual(['interact']);
  });

  it('gives a movement vector no longer than 1, and reads the stick past its dead zone', () => {
    const input = new InputMapper(DEFAULT_BINDINGS);
    input.keyDown('KeyD');
    input.keyDown('KeyS');
    const { move } = input.sample();
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1, 5);
    input.releaseAll();
    input.pad([], [0.1, 0.1]);
    expect(input.sample().move).toEqual({ x: 0, y: 0 });
    input.pad([], [0.6, 0]);
    expect(input.sample().move).toEqual({ x: 0.6, y: 0 });
  });

  it('turns a hold action into a toggle when the option is on', () => {
    const input = new InputMapper(DEFAULT_BINDINGS, ['run']);
    input.keyDown('ShiftLeft');
    expect(input.sample().held.has('run')).toBe(true);
    input.keyUp('ShiftLeft');
    expect(input.sample().held.has('run')).toBe(true);
    input.keyDown('ShiftLeft');
    expect(input.sample().held.has('run')).toBe(false);
  });

  it('counts a tap that starts and ends between two frames', () => {
    const input = new InputMapper(DEFAULT_BINDINGS);
    input.keyDown('KeyE');
    input.keyUp('KeyE');
    expect(input.sample().pressed.has('interact')).toBe(true);
    expect(input.sample().released.has('interact')).toBe(true);
  });

  it('lets go of everything when the window loses focus', () => {
    const input = new InputMapper(DEFAULT_BINDINGS);
    input.keyDown('KeyW');
    input.sample();
    input.releaseAll();
    expect(input.sample().held.size).toBe(0);
  });
});

describe('remapping', () => {
  it('replaces the binding on the same device and takes it from any other action', () => {
    const { bindings, displaced } = rebind(DEFAULT_BINDINGS, 'interact', {
      device: 'key',
      code: 'KeyQ',
    });
    expect(bindings.interact[0]).toEqual({ device: 'key', code: 'KeyQ' });
    expect(bindings.interact).toContainEqual({ device: 'pad', button: 0 });
    expect(displaced).toEqual(['parry']);
    expect(bindings.parry.some((b) => b.device === 'key' && b.code === 'KeyQ')).toBe(false);
  });

  it('persists: a remapped key still works after saving and reloading', () => {
    const store = new MemoryStore();
    const { bindings } = rebind(DEFAULT_BINDINGS, 'interact', { device: 'key', code: 'KeyG' });
    expect(saveSettings(store, { bindings, toggle: ['run'] })).toBe(true);
    const reloaded = loadSettings(store);
    expect(reloaded.toggle).toEqual(['run']);
    const input = new InputMapper(reloaded.bindings, reloaded.toggle);
    input.keyDown('KeyG');
    expect(input.sample().pressed.has('interact')).toBe(true);
    input.releaseAll();
    input.sample();
    input.keyDown('KeyE');
    expect(input.sample().pressed.has('interact')).toBe(false);
  });

  it('falls back to the default for damaged or unknown settings', () => {
    expect(parseSettings('not json').bindings).toEqual(DEFAULT_BINDINGS);
    const partly = parseSettings(
      JSON.stringify({
        bindings: { interact: [{ device: 'teleport' }] },
        toggle: ['heavy', 'run'],
      }),
    );
    expect(partly.bindings.interact).toEqual(DEFAULT_BINDINGS.interact);
    expect(partly.toggle).toEqual(['run']);
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSettings(blocked).bindings).toEqual(DEFAULT_BINDINGS);
    expect(saveSettings(blocked, loadSettings(blocked))).toBe(false);
    expect(SETTINGS_KEY).toBe('oar-and-ember:controls');
  });
});
