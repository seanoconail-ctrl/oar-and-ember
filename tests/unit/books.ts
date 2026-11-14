/** Reads the design books in docs/ for tests that check data against them. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../../src/tools/art/loadTitleArt.ts';

const DOCS = join(REPO_ROOT, 'docs');
const cache = new Map<number, string>();

/** The markdown text of Book `n` (1 to 11). */
export function book(n: number): string {
  const cached = cache.get(n);
  if (cached !== undefined) return cached;
  const prefix = `${String(n).padStart(2, '0')}_`;
  const file = readdirSync(DOCS).find((f) => f.startsWith(prefix) && f.endsWith('.md'));
  if (file === undefined) throw new Error(`No markdown file for Book ${n} in docs/`);
  const text = readFileSync(join(DOCS, file), 'utf8');
  cache.set(n, text);
  return text;
}

/** The text of "## NN / ..." section `section` of Book `n`, up to the next "## " heading. */
export function bookSection(n: number, section: string): string | null {
  const text = book(n);
  const start = text.indexOf(`\n## ${section} / `);
  if (start === -1) return null;
  const end = text.indexOf('\n## ', start + 1);
  return text.slice(start, end === -1 ? undefined : end);
}

export function repoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}
