/**
 * The action map (Book 2 section 21): every action the player can take, its default keyboard,
 * mouse and gamepad bindings, and which hold actions can be switched to toggles. Everything here
 * is remappable.
 */

export const ACTIONS = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'run',
  'sneak',
  'interact',
  'useItem',
  'slot1',
  'slot2',
  'slot3',
  'slot4',
  'slot5',
  'slot6',
  'slot7',
  'slot8',
  'slot9',
  'slot10',
  'slot11',
  'slot12',
  'slotNext',
  'slotPrev',
  'parry',
  'block',
  'dodge',
  'shove',
  'finisher',
  /** The user's third playtest (decision DG-2): let a beaten foe go. */
  'spare',
  /** Combat v2 (decision DE-3): lock-on, and binding a wound or eating. */
  'lockOn',
  'heal',
  'commandRing',
  'quick1',
  'quick2',
  'quick3',
  'quick4',
  'quick5',
  'quick6',
  'map',
  'inventory',
  'buildMenu',
  'report',
  'systemMenu',
] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * A physical input: a keyboard key (KeyboardEvent.code), a mouse button, a turn of the mouse
 * wheel, a pad button or axis.
 */
export type Binding =
  | { readonly device: 'key'; readonly code: string }
  | { readonly device: 'mouse'; readonly button: number }
  | { readonly device: 'wheel'; readonly dir: -1 | 1 }
  | { readonly device: 'pad'; readonly button: number }
  | { readonly device: 'axis'; readonly axis: number; readonly dir: -1 | 1 };

/** The twelve hotbar slot actions, in slot order (Book 10 section 21: 1 to 9, 0, minus, equals). */
export const SLOT_ACTIONS = [
  'slot1',
  'slot2',
  'slot3',
  'slot4',
  'slot5',
  'slot6',
  'slot7',
  'slot8',
  'slot9',
  'slot10',
  'slot11',
  'slot12',
] as const satisfies readonly Action[];

export type Bindings = Readonly<Record<Action, readonly Binding[]>>;

/** Hold actions that the accessibility option can turn into press-to-toggle (Book 2 section 21). */
/** Sneak is always a toggle in combat v2 (Book 10 sneakToggle), so it is not among them. */
export const TOGGLEABLE: readonly Action[] = ['run', 'block', 'commandRing'];

const key = (code: string): Binding => ({ device: 'key', code });
const mouse = (button: number): Binding => ({ device: 'mouse', button });
const wheel = (dir: -1 | 1): Binding => ({ device: 'wheel', dir });
/** Standard gamepad layout: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Back, 9 Start, 10 L3, 11 R3, 12-15 d-pad. */
const pad = (button: number): Binding => ({ device: 'pad', button });
const axis = (n: number, dir: -1 | 1): Binding => ({ device: 'axis', axis: n, dir });

export const DEFAULT_BINDINGS: Bindings = {
  moveUp: [key('KeyW'), key('ArrowUp'), axis(1, -1)],
  moveDown: [key('KeyS'), key('ArrowDown'), axis(1, 1)],
  moveLeft: [key('KeyA'), key('ArrowLeft'), axis(0, -1)],
  moveRight: [key('KeyD'), key('ArrowRight'), axis(0, 1)],
  run: [key('ShiftLeft'), pad(10)],
  // Combat v2 (decision DE-3): sneak moves on the pad from R3 to the d-pad's down.
  sneak: [key('KeyC'), pad(13)],
  // Right-click interacts at the cursor's tile; the key and the pad interact at the target tile.
  interact: [key('KeyE'), mouse(2), pad(0)],
  // Left-click uses the item in hand (attack with a weapon, hold to draw a bow or charge a heavy).
  useItem: [key('KeyF'), mouse(0), pad(7)],
  slot1: [key('Digit1')],
  slot2: [key('Digit2')],
  slot3: [key('Digit3')],
  slot4: [key('Digit4')],
  slot5: [key('Digit5')],
  slot6: [key('Digit6')],
  slot7: [key('Digit7')],
  slot8: [key('Digit8')],
  slot9: [key('Digit9')],
  slot10: [key('Digit0')],
  slot11: [key('Minus')],
  slot12: [key('Equal')],
  slotNext: [wheel(1), key('BracketRight'), pad(5)],
  slotPrev: [wheel(-1), key('BracketLeft'), pad(4)],
  parry: [key('KeyQ'), pad(3)],
  block: [key('ControlLeft'), pad(6)],
  dodge: [key('Space'), pad(1)],
  shove: [key('KeyR'), pad(2)],
  finisher: [key('KeyV')],
  // Let go on G (DG-22); on a pad, A lets go while the choice is offered (the session's context).
  spare: [key('KeyG')],
  // Combat v2 (decision DE-3): lock-on on Z, the middle mouse button and R3; heal on H (in the
  // command ring on a gamepad).
  lockOn: [key('KeyZ'), mouse(1), pad(11)],
  heal: [key('KeyH')],
  commandRing: [key('Tab'), pad(12)],
  // The number keys choose hotbar slots (Book 2 section 21), so quick commands are F1 to F6.
  // Quick command 1 left the pad for the command ring (decision DE-3).
  quick1: [key('F1')],
  quick2: [key('F2'), pad(14)],
  quick3: [key('F3'), pad(15)],
  quick4: [key('F4')],
  quick5: [key('F5')],
  quick6: [key('F6')],
  map: [key('KeyM'), pad(8)],
  inventory: [key('KeyI')],
  buildMenu: [key('KeyB')],
  report: [key('KeyJ')],
  // The pause menu also on P (the user's third playtest, DG-22).
  systemMenu: [key('Escape'), key('KeyP'), pad(9)],
};

export function sameBinding(a: Binding, b: Binding): boolean {
  if (a.device !== b.device) return false;
  switch (a.device) {
    case 'key':
      return b.device === 'key' && a.code === b.code;
    case 'mouse':
      return b.device === 'mouse' && a.button === b.button;
    case 'wheel':
      return b.device === 'wheel' && a.dir === b.dir;
    case 'pad':
      return b.device === 'pad' && a.button === b.button;
    case 'axis':
      return b.device === 'axis' && a.axis === b.axis && a.dir === b.dir;
  }
}

/**
 * Binds `binding` to `action`, replacing that action's binding on the same device kind. Any other
 * action that used `binding` loses it, and is reported as displaced so the UI can say so.
 */
export function rebind(
  bindings: Bindings,
  action: Action,
  binding: Binding,
): { bindings: Bindings; displaced: Action[] } {
  const displaced: Action[] = [];
  const out = {} as Record<Action, readonly Binding[]>;
  for (const a of ACTIONS) {
    let list = bindings[a];
    if (a !== action && list.some((b) => sameBinding(b, binding))) {
      list = list.filter((b) => !sameBinding(b, binding));
      displaced.push(a);
    }
    out[a] = list;
  }
  const kind = (b: Binding): string =>
    b.device === 'axis' ? 'pad' : b.device === 'mouse' || b.device === 'wheel' ? 'key' : b.device;
  const own = out[action];
  const at = own.findIndex((b) => kind(b) === kind(binding));
  out[action] = at === -1 ? [...own, binding] : own.map((b, i) => (i === at ? binding : b));
  return { bindings: out, displaced };
}

/** A short label for a binding, for menus and prompts ("E", "Mouse 1", "Pad 0"). */
export function bindingLabel(binding: Binding): string {
  switch (binding.device) {
    case 'key':
      return binding.code
        .replace(/^Key/, '')
        .replace(/^Digit/, '')
        .replace(/Left$/, '');
    case 'mouse':
      return `Mouse ${binding.button + 1}`;
    case 'wheel':
      return binding.dir < 0 ? 'Wheel up' : 'Wheel down';
    case 'pad':
      return `Pad ${binding.button}`;
    case 'axis':
      return `Stick ${binding.axis}${binding.dir < 0 ? '-' : '+'}`;
  }
}
