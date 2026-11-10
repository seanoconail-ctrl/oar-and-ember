/**
 * The title screen's art and strings as bundled into the browser build. The Node tools load the
 * same files from disk (src/tools/art/loadTitleArt.ts), so tests compose the identical frame.
 */
import stringsJson from '../../content/strings/en.json';
import paletteJson from '../../assets/palette/book07.json';
import layoutJson from '../../assets/art/ui/title_screen.json';
import fontSmall from '../../assets/art/ui/font_small.txt?raw';
import fontTitle from '../../assets/art/ui/font_title.txt?raw';
import { parseStringTable } from '../content/strings.ts';
import type { StringTable } from '../content/strings.ts';
import { compileFont } from '../render/bitmapFont.ts';
import { parsePalette } from '../render/palette.ts';
import { parseTitleLayout } from './title.ts';
import type { TitleArt } from './title.ts';

export function bundledTitleArt(): TitleArt {
  const palette = parsePalette(paletteJson);
  const fonts = new Map(
    [
      ['assets/art/ui/font_title.txt', fontTitle],
      ['assets/art/ui/font_small.txt', fontSmall],
    ].map(([file = '', text = '']) => {
      const font = compileFont(text, file, palette);
      return [font.name, font] as const;
    }),
  );
  return {
    palette,
    fonts,
    layout: parseTitleLayout(layoutJson, 'assets/art/ui/title_screen.json'),
  };
}

export function bundledStrings(): StringTable {
  return parseStringTable(stringsJson, 'content/strings/en.json');
}
