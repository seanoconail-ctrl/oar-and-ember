/**
 * Generates content/balance.json from Book 10 (docs/10_balance_sheet.md), as Book 10 section 01
 * describes: each table under a level-two section becomes an array of rows keyed by its column
 * names. Section and table names become camelCase keys (a note in brackets is dropped); a table
 * straight under the section heading is called "table"; a code block becomes "<name>Text".
 */

export interface BalanceFile {
  readonly title: string;
  readonly revision: string;
  readonly source: string;
  readonly tables: Record<string, Record<string, Record<string, string>[] | string>>;
}

/** "Food, fuel and seasons" -> "foodFuelAndSeasons"; "Routes (base watches...)" -> "routes". */
export function camelKey(title: string): string {
  const words = title
    .replace(/\([^)]*\)/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w !== '');
  return words
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join('');
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim().replace(/`([^`]*)`/g, '$1'));
}

/** The design set's revision, stated in Book 1 ("_Revision 2.1 ..."). */
export function bookRevision(book1: string): string {
  const revision = /^_Revision (\d+(?:\.\d+)*)/m.exec(book1)?.[1];
  if (revision === undefined) throw new Error('Book 1 states no revision');
  return revision;
}

export function balanceFromBook(markdown: string, revision: string): BalanceFile {
  const lines = markdown.split(/\r?\n/);
  const tables: BalanceFile['tables'] = {};
  let section: string | null = null;
  let table = 'table';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const h2 = /^## \d+ \/ (.+)$/.exec(line);
    if (h2 !== null) {
      section = camelKey(h2[1] ?? '');
      table = 'table';
      continue;
    }
    const h3 = /^### (.+)$/.exec(line);
    if (h3 !== null) {
      table = camelKey(h3[1] ?? '');
      continue;
    }
    if (section === null) continue;
    if (line.startsWith('```')) {
      const body: string[] = [];
      for (i++; i < lines.length && !(lines[i] ?? '').startsWith('```'); i++)
        body.push(lines[i] ?? '');
      (tables[section] ??= {})[`${table}Text`] = body.join('\n');
      continue;
    }
    if (line.startsWith('|') && (lines[i + 1] ?? '').startsWith('|---')) {
      const header = cells(line);
      const rows: Record<string, string>[] = [];
      for (i += 2; i < lines.length && (lines[i] ?? '').startsWith('|'); i++) {
        const values = cells(lines[i] ?? '');
        const row: Record<string, string> = {};
        header.forEach((name, c) => (row[name] = values[c] ?? ''));
        rows.push(row);
      }
      i--;
      (tables[section] ??= {})[table] = rows;
    }
  }
  return { title: 'Oar and Ember balance sheet', revision, source: 'Book 10', tables };
}

/** The exact text of content/balance.json for a Book 10 markdown file. */
export function balanceJsonText(book10: string, book1: string): string {
  return JSON.stringify(balanceFromBook(book10, bookRevision(book1)), null, 1);
}
