/** Loads content/balance.json from disk for tools and tests. Node only. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTimeBalance } from '../../content/balance.ts';
import type { TimeBalance } from '../../content/balance.ts';
import { REPO_ROOT } from '../art/loadTitleArt.ts';

export function loadBalanceJson(): unknown {
  return JSON.parse(readFileSync(join(REPO_ROOT, 'content/balance.json'), 'utf8')) as unknown;
}

export function loadTimeBalance(): TimeBalance {
  return parseTimeBalance(loadBalanceJson());
}
