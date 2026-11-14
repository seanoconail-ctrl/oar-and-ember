/** Stage 1 acceptance check 3: the decision log contains all twenty Stage 0 decisions. */
import { describe, expect, it } from 'vitest';
import { bookSection, repoFile } from './books.ts';

function decisionRows(text: string): Map<number, string> {
  const rows = new Map<number, string>();
  for (const line of text.split('\n')) {
    const match = /^\| (\d+) \| ([^|]+) \| ([^|]+) \|$/.exec(line.trim());
    if (match !== null) rows.set(Number(match[1]), `${match[2]?.trim()} | ${match[3]?.trim()}`);
  }
  return rows;
}

describe('the decision log', () => {
  const log = repoFile('docs/decision-log.md');
  const stage0 = log.slice(
    log.indexOf('Stage 0 decisions'),
    log.indexOf('\n## ', log.indexOf('Stage 0 decisions')),
  );
  const logged = decisionRows(stage0);
  const planned = decisionRows(bookSection(3, '03') ?? '');

  it('holds decisions 1 to 20, each once, as Book 3 section 03 does', () => {
    expect([...planned.keys()]).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect([...logged.keys()]).toEqual([...planned.keys()]);
  });

  it('keeps decision 9 (campaign length) open, as Book 3 does', () => {
    expect(planned.get(9)).toMatch(/Open/);
    expect(logged.get(9)).toMatch(/OPEN/);
  });

  it('records what was decided for every row', () => {
    for (const [n, row] of logged) {
      const decided = row.split(' | ')[1] ?? '';
      expect(decided.length, `decision ${n}`).toBeGreaterThan(10);
    }
  });

  it('records the Stage 1 entries', () => {
    expect(log).toMatch(/Stage 1/);
  });
});
