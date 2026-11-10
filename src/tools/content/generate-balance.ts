/**
 * Regenerates content/balance.json from Book 10 (Book 10 section 01). Run after changing a number
 * in Book 10, then record the change in the decision log:  npm run balance
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../art/loadTitleArt.ts';
import { balanceJsonText } from './balanceFromBook.ts';

const read = (path: string): string => readFileSync(join(REPO_ROOT, path), 'utf8');
const text = balanceJsonText(read('docs/10_balance_sheet.md'), read('docs/01_game_bible.md'));
writeFileSync(join(REPO_ROOT, 'content/balance.json'), text);
console.log(`wrote content/balance.json (${text.length} characters)`);
