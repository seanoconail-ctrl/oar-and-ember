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
  'lightAttack',
  'heavy',
  'parry',
  'block',
  'dodge',
  'shove',
  'finisher',
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

/** A physical input: a keyboard key (KeyboardEvent.code), a mouse button, a pad button or axis. */
export type Binding =
  | { readonly device: 'key'; readonly code: string }
  | { readonly device: 'mouse'; readonly button: number }
  | { readonly device: 'pad'; readonly button: number }
  | { readonly device: 'axis'; readonly axis: number; readonly dir: -1 | 1 };

export type Bindings = Readonly<Record<Action, readonly Binding[]>>;

/** Hold actions that the accessibility option can turn into press-to-toggle (Book 2 section 21). */
export const TOGGLEABLE: readonly Action[] = ['run', 'sneak', 'block', 'commandRing'];

const key = (code: string): Binding => ({ device: 'key', code });
const mouse = (button: number): Binding => ({ device: 'mouse', button });
/** Standard gamepad layout: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Back, 9 Start, 10 L3, 11 R3, 12-15 d-pad. */
const pad = (button: number): Binding => ({ device: 'pad', button });
const axis = (n: number, dir: -1 | 1): Binding => ({ device: 'axis', axis: n, dir });

export const DEFAULT_BINDINGS: Bindings = {
  moveUp: [key('KeyW'), key('ArrowUp'), axis(1, -1)],
  moveDown: [key('KeyS'), key('ArrowDown'), axis(1, 1)],
  moveLeft: [key('KeyA'), key('ArrowLeft'), axis(0, -1)],
  moveRight: [key('KeyD'), key('ArrowRight'), axis(0, 1)],
  run: [key('ShiftLeft'), pad(10)],
  sneak: [key('KeyC'), pad(11)],
  interact: [key('KeyE'), pad(0)],
  lightAttack: [mouse(0), pad(2)],
  heavy: [mouse(2), pad(3)],
  parry: [key('KeyQ'), pad(5)],
  block: [key('ControlLeft'), pad(7)],
  dodge: [key('Space'), pad(1)],
  shove: [key('KeyR'), pad(6)],
  finisher: [key('KeyV'), pad(4)],
  commandRing: [key('Tab'), pad(12)],
  quick1: [key('Digit1'), pad(13)],
  quick2: [key('Digit2'), pad(14)],
  quick3: [key('Digit3'), pad(15)],
  quick4: [key('Digit4')],
  quick5: [key('Digit5')],
  quick6: [key('Digit6')],
  map: [key('KeyM'), pad(8)],
  inventory: [key('KeyI')],
  buildMenu: [key('KeyB')],
  report: [key('KeyJ')],
  systemMenu: [key('Escape'), pad(9)],
};

export function sameBinding(a: Binding, b: Binding): boolean {
  if (a.device !== b.device) return false;
  switch (a.device) {
    case 'key':
      return b.device === 'key' && a.code === b.code;
    case 'mouse':
      return b.device === 'mouse' && a.button === b.button;
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
    b.device === 'axis' ? 'pad' : b.device === 'mouse' ? 'key' : b.device;
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
    case 'pad':
      return `Pad ${binding.button}`;
    case 'axis':
      return `Stick ${binding.axis}${binding.dir < 0 ? '-' : '+'}`;
  }
}
