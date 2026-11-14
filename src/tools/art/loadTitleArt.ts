/**
 * Loads the title screen's art and strings from disk, exactly as the browser build does from its
 * bundled copies, so tools and tests compose the same frame the player sees. Node only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseStringTable } from '../../content/strings.ts';
import type { StringTable } from '../../content/strings.ts';
import { compileFont } from '../../render/bitmapFont.ts';
import { parsePalette } from '../../render/palette.ts';
import { parseTitleLayout } from '../../scenes/title.ts';
import type { TitleArt } from '../../scenes/title.ts';

/** Repository root, found from this file's location (src/tools/art). */
export const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

export const TITLE_FILES = {
  palette: 'assets/palette/book07.json',
  fontTitle: 'assets/art/ui/font_title.txt',
  fontSmall: 'assets/art/ui/font_small.txt',
  layout: 'assets/art/ui/title_screen.json',
  strings: 'content/strings/en.json',
} as const;

function text(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}

function json(path: string): unknown {
  return JSON.parse(text(path)) as unknown;
}

export function loadTitleArt(): TitleArt {
  const palette = parsePalette(json(TITLE_FILES.palette));
  const fonts = new Map(
    [TITLE_FILES.fontTitle, TITLE_FILES.fontSmall].map((file) => {
      const font = compileFont(text(file), file, palette);
      return [font.name, font] as const;
    }),
  );
  return { palette, fonts, layout: parseTitleLayout(json(TITLE_FILES.layout), TITLE_FILES.layout) };
}

export function loadStrings(): StringTable {
  return parseStringTable(json(TITLE_FILES.strings), TITLE_FILES.strings);
}
