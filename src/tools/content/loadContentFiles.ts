/** Reads every content file from disk for tools and tests. Node only. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_FILES, loadContent } from '../../content/registry.ts';
import type { Content, ContentFiles } from '../../content/registry.ts';
import type { Issue } from '../../content/schema.ts';
import { REPO_ROOT } from '../art/loadTitleArt.ts';

export function readContentFiles(): ContentFiles {
  const read = (path: string): unknown =>
    JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8')) as unknown;
  const out = {} as Record<keyof typeof CONTENT_FILES, unknown>;
  for (const [key, path] of Object.entries(CONTENT_FILES))
    out[key as keyof typeof CONTENT_FILES] = read(path);
  return out;
}

export function loadContentFromDisk(): { content: Content; issues: Issue[] } {
  return loadContent(readContentFiles());
}
