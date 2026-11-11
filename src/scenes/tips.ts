/**
 * Pickup tooltips (Book 10 section 21, pickupTooltip): shown once per item kind when first picked
 * up, naming its controls for the input in use (mouse and keyboard, keyboard only, or gamepad), and
 * kept afterwards in the help pages. The controls come from the player's bindings, so a remapped
 * key is named as remapped. Pure: the play view supplies the string table and the bindings.
 */
import type { Id } from '../core/ids.ts';
import { bindingLabel } from '../input/actions.ts';
import type { Action, Binding, Bindings } from '../input/actions.ts';
import { SLOT_ACTIONS } from '../input/actions.ts';
import type { Device } from '../input/targeting.ts';

type Translate = (key: string, vars?: Record<string, string>) => string;

/** Which tooltip text a device reads: the base key for mouse and keyboard, else `.keys` or `.pad`. */
export function tipKeyFor(base: string, device: Device, has: (key: string) => boolean): string {
  const suffix = device === 'mouse' ? '' : device === 'key' ? '.keys' : '.pad';
  return suffix !== '' && has(`${base}${suffix}`) ? `${base}${suffix}` : base;
}

/** A binding's name as the interface says it: "Left-click", "F", "B", "the right stick". */
export function bindingName(b: Binding, t: Translate): string {
  switch (b.device) {
    case 'mouse':
      return t(`ui.input.mouse.${Math.min(2, b.button)}`);
    case 'wheel':
      return t(b.dir < 0 ? 'ui.input.wheel.up' : 'ui.input.wheel.down');
    case 'pad':
      return b.button <= 15 ? t(`ui.input.pad.${b.button}`) : bindingLabel(b);
    case 'axis':
      return t(b.axis < 2 ? 'ui.input.stick.left' : 'ui.input.stick.right');
    case 'key':
      return bindingLabel(b);
  }
}

/** The kinds of binding a device reads, in preference order. */
const READS: Readonly<Record<Device, readonly Binding['device'][]>> = {
  mouse: ['mouse', 'key', 'wheel'],
  key: ['key'],
  pad: ['pad', 'axis'],
};

/** How an action is pressed on a device: its first binding of the kinds the device reads. */
export function controlName(
  bindings: Bindings,
  action: Action,
  device: Device,
  t: Translate,
): string {
  for (const kind of READS[device]) {
    const b = bindings[action].find((x) => x.device === kind);
    if (b !== undefined) return bindingName(b, t);
  }
  const any = bindings[action][0];
  return any === undefined ? '' : bindingName(any, t);
}

/** Lowering a drawn bow on each device (Book 10 drawPlantsFeet: right-click, Escape or pad B). */
export function cancelName(bindings: Bindings, device: Device, t: Translate): string {
  if (device === 'pad') return controlName(bindings, 'dodge', 'pad', t);
  const escape = controlName(bindings, 'systemMenu', 'key', t);
  if (device === 'key') return escape;
  const right = bindings.interact.find((b) => b.device === 'mouse');
  return right === undefined ? escape : t('ui.input.or', { a: bindingName(right, t), b: escape });
}

export interface TipContext {
  readonly bindings: Bindings;
  readonly device: Device;
  /** The hotbar slot the item is in, if any. */
  readonly slot: number | null;
  /** Arrows carried. */
  readonly arrows: number;
}

/** A tooltip's text for the device in use, its controls filled from the bindings. */
export function tipText(
  base: string,
  ctx: TipContext,
  t: Translate,
  has: (key: string) => boolean,
): string {
  const { bindings, device } = ctx;
  const slotAction = ctx.slot === null ? undefined : SLOT_ACTIONS[ctx.slot];
  const slot =
    device === 'pad'
      ? t('ui.input.or', {
          a: controlName(bindings, 'slotPrev', 'pad', t),
          b: controlName(bindings, 'slotNext', 'pad', t),
        })
      : slotAction === undefined
        ? ''
        : controlName(bindings, slotAction, 'key', t);
  const move = (['moveUp', 'moveLeft', 'moveDown', 'moveRight'] as const)
    .map((a) => controlName(bindings, a, 'key', t))
    .join(' ');
  return t(tipKeyFor(base, device, has), {
    use: controlName(bindings, 'useItem', device, t),
    interact: controlName(bindings, 'interact', device, t),
    cancel: cancelName(bindings, device, t),
    slot,
    move,
    count: String(ctx.arrows),
  });
}

/** The help page: every tooltip shown so far, as "Name: text", in the order they were seen. */
export function helpLines(
  seen: readonly Id[],
  items: Readonly<Record<Id, { readonly nameKey: string; readonly tipKey?: string }>>,
  ctx: (item: Id) => TipContext,
  t: Translate,
  has: (key: string) => boolean,
): string[] {
  const out: string[] = [];
  for (const item of seen) {
    const def = items[item];
    if (def?.tipKey === undefined) continue;
    out.push(`${t(def.nameKey)}: ${tipText(def.tipKey, ctx(item), t, has)}`);
  }
  return out;
}
