/**
 * Parser for palette-indexed art source files (Book 2 section 19, Book 7 section 11).
 *
 * A source is plain text:
 *
 *   # comment lines start with '#'
 *   sheet: font_title          header lines are "key: value"
 *   palette: book07
 *   glyph O                    a block starts with "<kind> <name>" ...
 *   ..#####..                  ... holds rows of single-character codes ...
 *   end                        ... and ends with "end"
 *
 * Stage 4 extends this format (frames, pivots, footprints, animation events) and moves
 * compilation into the art compiler; Stage 1 uses it for the title screen's lettering.
 */

export interface HeaderValue {
  readonly value: string;
  readonly line: number;
}

export interface SourceBlock {
  readonly kind: string;
  readonly name: string;
  readonly rows: readonly string[];
  /** Line number of the block's opening line. */
  readonly line: number;
}

export interface ArtSource {
  readonly file: string;
  readonly header: ReadonlyMap<string, HeaderValue>;
  readonly blocks: readonly SourceBlock[];
}

export class ArtSourceError extends Error {
  readonly file: string;
  readonly line: number;
  readonly reason: string;

  constructor(file: string, line: number, reason: string) {
    super(`${file}:${line}: ${reason}`);
    this.name = 'ArtSourceError';
    this.file = file;
    this.line = line;
    this.reason = reason;
  }
}

const HEADER = /^([a-zA-Z][\w.-]*):\s*(.*)$/;
const BLOCK_OPEN = /^([a-z]+)\s+(\S)$/;

export function parseArtSource(text: string, file: string): ArtSource {
  const header = new Map<string, HeaderValue>();
  const blocks: SourceBlock[] = [];
  const lines = text.split(/\r?\n/);
  let open: { kind: string; name: string; line: number; rows: string[] } | null = null;

  for (const [i, raw] of lines.entries()) {
    const lineNo = i + 1;
    const line = raw.trimEnd();
    if (open !== null) {
      if (line === 'end') {
        if (open.rows.length === 0) throw new ArtSourceError(file, open.line, 'empty block');
        blocks.push({ kind: open.kind, name: open.name, rows: open.rows, line: open.line });
        open = null;
      } else if (line === '') {
        throw new ArtSourceError(file, lineNo, `blank line inside ${open.kind} "${open.name}"`);
      } else {
        open.rows.push(line);
      }
      continue;
    }
    if (line === '' || line.startsWith('#')) continue;
    const blockMatch = BLOCK_OPEN.exec(line);
    if (blockMatch !== null) {
      const [, kind = '', name = ''] = blockMatch;
      open = { kind, name, line: lineNo, rows: [] };
      continue;
    }
    const headerMatch = HEADER.exec(line);
    if (headerMatch !== null) {
      const [, key = '', value = ''] = headerMatch;
      if (header.has(key)) throw new ArtSourceError(file, lineNo, `duplicate header "${key}"`);
      header.set(key, { value, line: lineNo });
      continue;
    }
    throw new ArtSourceError(file, lineNo, `cannot read line "${line}"`);
  }

  if (open !== null) {
    throw new ArtSourceError(file, open.line, `${open.kind} "${open.name}" has no "end"`);
  }
  return { file, header, blocks };
}

/** A required header value, or an error naming the file and key. */
export function requireHeader(source: ArtSource, key: string): HeaderValue {
  const value = source.header.get(key);
  if (value === undefined) throw new ArtSourceError(source.file, 1, `missing header "${key}"`);
  return value;
}

/** A required non-negative integer header. */
export function requireInt(source: ArtSource, key: string): number {
  const { value, line } = requireHeader(source, key);
  if (!/^\d+$/.test(value)) {
    throw new ArtSourceError(source.file, line, `"${key}" must be a whole number`);
  }
  return Number.parseInt(value, 10);
}
