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

export function packSheet(sheet: Sheet): { image: IndexedImage; manifest: Manifest } {
  const states = Object.entries(sheet.anims);
  const rows = states.length * sheet.facings.length;
  const columns = Math.max(...states.map(([, a]) => a.frames));
  const image = createIndexedImage(columns * sheet.width, rows * sheet.height);
  const frames: Record<string, readonly [number, number]> = {};
  let row = 0;
  for (const [state, anim] of states) {
    for (const facing of sheet.facings) {
      for (let i = 0; i < anim.frames; i++) {
        const key = frameKey(state, facing, i);
        const frame = sheet.frames.get(key);
        if (frame === undefined) throw new Error(`${sheet.name}: missing frame ${key}`);
        const x = i * sheet.width;
        const y = row * sheet.height;
        blit(image, frame, x, y);
        frames[key] = [x, y];
      }
      row++;
    }
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
