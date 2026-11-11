/**
 * Feeds the browser's keyboard, mouse and first gamepad into an InputMapper. Keys the game uses
 * do not scroll the page or move focus. A raw-key hook lets a remapping screen capture the next key.
 */
import type { InputMapper } from './inputState.ts';

/** Keys whose browser default (scrolling, focus) would get in the way of play. */
const SWALLOW = new Set([
  'Tab',
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  // The quick commands (and the shell's rebind key) would otherwise open help, search or reload.
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F9',
]);

export interface BrowserInput {
  /** Reads the gamepad; call once per frame before sampling. */
  poll(): void;
  /** The pointer relative to the canvas centre, -1 to 1 across a quarter of its shorter side. */
  aim(): { x: number; y: number };
  /**
   * The pointer in device pixels of the canvas's drawing surface (as the viewport is measured),
   * or null before it has moved over the page; and the last device used (for the target cursor).
   */
  pointer(): { x: number; y: number } | null;
  /** Which device moved or pressed last: the mouse, the keyboard or the gamepad. */
  lastDevice(): 'mouse' | 'key' | 'pad';
  detach(): void;
}

export interface BrowserInputHooks {
  /** Called on every first press; return true to consume the key (for example to rebind). */
  rawKey?: (code: string) => boolean;
  /** Called on the first key or click: the moment browsers allow audio to start. */
  firstInput?: () => void;
}

export function attachBrowserInput(
  win: Window,
  canvas: HTMLElement,
  mapper: InputMapper,
  hooks: BrowserInputHooks = {},
): BrowserInput {
  let pointer = { x: 0, y: 0 };
  let surface: { x: number; y: number } | null = null;
  let device: 'mouse' | 'key' | 'pad' = 'key';
  const first = (): void => {
    hooks.firstInput?.();
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    first();
    device = 'key';
    if (SWALLOW.has(e.code)) e.preventDefault();
    if (!e.repeat && hooks.rawKey?.(e.code) === true) return;
    mapper.keyDown(e.code);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    mapper.keyUp(e.code);
  };
  const onMouseDown = (e: MouseEvent): void => {
    first();
    device = 'mouse';
    mapper.mouseDown(e.button);
  };
  const onWheel = (e: WheelEvent): void => {
    if (e.deltaY === 0) return;
    e.preventDefault();
    device = 'mouse';
    mapper.wheel(e.deltaY > 0 ? 1 : -1);
  };
  const onMouseUp = (e: MouseEvent): void => {
    mapper.mouseUp(e.button);
  };
  const onMove = (e: MouseEvent): void => {
    const rect = canvas.getBoundingClientRect();
    const reach = Math.min(rect.width, rect.height) / 4;
    pointer = {
      x: (e.clientX - rect.left - rect.width / 2) / reach,
      y: (e.clientY - rect.top - rect.height / 2) / reach,
    };
    const sx =
      rect.width > 0 && canvas instanceof HTMLCanvasElement ? canvas.width / rect.width : 1;
    const sy =
      rect.height > 0 && canvas instanceof HTMLCanvasElement ? canvas.height / rect.height : 1;
    surface = { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
    device = 'mouse';
  };
  const onBlur = (): void => {
    mapper.releaseAll();
  };
  const onMenu = (e: Event): void => {
    e.preventDefault();
  };
  win.addEventListener('keydown', onKeyDown);
  win.addEventListener('keyup', onKeyUp);
  win.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  win.addEventListener('mouseup', onMouseUp);
  win.addEventListener('mousemove', onMove);
  canvas.addEventListener('contextmenu', onMenu);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  return {
    poll() {
      const pad = typeof navigator.getGamepads === 'function' ? navigator.getGamepads()[0] : null;
      if (pad != null) {
        mapper.pad(
          pad.buttons.map((b) => b.pressed),
          pad.axes,
        );
        if (pad.buttons.some((b) => b.pressed) || pad.axes.some((a) => Math.abs(a) > 0.3))
          device = 'pad';
      }
    },
    aim() {
      return pointer;
    },
    pointer() {
      return surface;
    },
    lastDevice() {
      return device;
    },
    detach() {
      win.removeEventListener('keydown', onKeyDown);
      win.removeEventListener('keyup', onKeyUp);
      win.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousedown', onMouseDown);
      win.removeEventListener('mouseup', onMouseUp);
      win.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('contextmenu', onMenu);
      canvas.removeEventListener('wheel', onWheel);
    },
  };
}
