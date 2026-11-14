/**
 * Atlases and manifests (Book 2 section 19, Book 7 section 11). The compiler packs each sheet's
 * frames into one image, one row per state and facing, and writes a manifest with every frame's
 * place and the sheet's pivot, footprint, animations and events.
 */
import { blit, createIndexedImage } from './indexedImage.ts';
import type { IndexedImage } from './indexedImage.ts';
import { frameKey } from './sheet.ts';
import type { Anim, Sheet, SheetKind } from './sheet.ts';

export interface Manifest {
  readonly sheet: string;
  readonly kind: SheetKind;
  readonly image: string;
  readonly width: number;
  readonly height: number;
  readonly pivot: { readonly x: number; readonly y: number };
  readonly footprint: { readonly w: number; readonly h: number };
  readonly facings: readonly string[];
  readonly anims: Readonly<Record<string, Anim>>;
  readonly events: Readonly<Record<string, string>>;
  readonly shadow: { readonly w: number; readonly h: number } | null;
  readonly placeholder: boolean;
  /** Frame key "state/facing/index" to its top-left corner in the atlas image. */
  readonly frames: Readonly<Record<string, readonly [number, number]>>;
}

/** Atlases stay within this size on each side, well inside every WebGL2 device's limit. */
export const MAX_ATLAS = 4096;

export function packSheet(sheet: Sheet): { image: IndexedImage; manifest: Manifest } {
  const states = Object.entries(sheet.anims);
  const rows = states.length * sheet.facings.length;
  const columns = Math.max(...states.map(([, a]) => a.frames));
  const frames: Record<string, readonly [number, number]> = {};
  const keys: string[] = [];
  for (const [state, anim] of states)
    for (const facing of sheet.facings)
      for (let i = 0; i < anim.frames; i++) keys.push(frameKey(state, facing, i));
  let image;
  if (rows * sheet.height <= MAX_ATLAS && columns * sheet.width <= MAX_ATLAS) {
    // One row per state and facing: easy to read when the atlas is inspected.
    image = createIndexedImage(columns * sheet.width, rows * sheet.height);
    let row = 0;
    for (const [state, anim] of states) {
      for (const facing of sheet.facings) {
        for (let i = 0; i < anim.frames; i++)
          frames[frameKey(state, facing, i)] = [i * sheet.width, row * sheet.height];
        row++;
      }
    }
  } else {
    // A large sheet (the autotiles) packs its frames in reading order into a square-ish grid.
    const across = Math.max(
      1,
      Math.min(Math.floor(MAX_ATLAS / sheet.width), Math.ceil(Math.sqrt(keys.length))),
    );
    const down = Math.ceil(keys.length / across);
    if (down * sheet.height > MAX_ATLAS)
      throw new Error(`${sheet.name}: too many frames for one atlas`);
    image = createIndexedImage(across * sheet.width, down * sheet.height);
    keys.forEach((key, n) => {
      frames[key] = [(n % across) * sheet.width, Math.floor(n / across) * sheet.height];
    });
  }
  for (const key of keys) {
    const frame = sheet.frames.get(key);
    const at = frames[key];
    if (frame === undefined || at === undefined)
      throw new Error(`${sheet.name}: missing frame ${key}`);
    blit(image, frame, at[0], at[1]);
  }
  return {
    image,
    manifest: {
      sheet: sheet.name,
      kind: sheet.kind,
      image: `${sheet.name}.png`,
      width: sheet.width,
      height: sheet.height,
      pivot: sheet.pivot,
      footprint: sheet.footprint,
      facings: sheet.facings,
      anims: sheet.anims,
      events: sheet.events,
      shadow: sheet.shadow,
      placeholder: sheet.placeholder,
      frames,
    },
  };
}
