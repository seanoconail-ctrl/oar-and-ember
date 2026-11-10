/** The Book 2 section 02 dependency rules are enforced by lint: a violation fails. */
import { join } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../src/tools/art/loadTitleArt.ts';

// Lint virtual files without type information (they are not on disk).
const eslint = new ESLint({
  cwd: REPO_ROOT,
  overrideConfig: [tseslint.configs.disableTypeChecked],
});

async function importErrors(file: string, specifier: string): Promise<string[]> {
  const code = `import * as probe from '${specifier}';\nexport const used = probe;\n`;
  const [result] = await eslint.lintText(code, { filePath: join(REPO_ROOT, file) });
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-imports')
    .map((m) => m.message);
}

describe('layer dependency rules', () => {
  it.each([
    ['src/core/probe.ts', '../content/strings.ts'],
    ['src/content/probe.ts', '../sim/index.ts'],
    ['src/sim/combat/probe.ts', '../../render/presenter.ts'],
    ['src/sim/people/probe.ts', '../../ui/index.ts'],
    ['src/sim/probe.ts', '../audio/index.ts'],
    ['src/render/probe.ts', '../scenes/title.ts'],
    ['src/persist/probe.ts', '../render/index.ts'],
    ['src/scenes/probe.ts', '../tools/art/png.ts'],
  ])('%s may not import %s', async (file, specifier) => {
    expect((await importErrors(file, specifier)).join('\n')).toMatch(/Book 2 section 02/);
  });

  it.each([
    ['src/content/probe.ts', '../core/ids.ts'],
    ['src/sim/combat/probe.ts', '../../core/ids.ts'],
    ['src/sim/combat/probe.ts', '../ai/index.ts'],
    ['src/render/probe.ts', '../sim/index.ts'],
    ['src/scenes/probe.ts', '../render/presenter.ts'],
    ['src/tools/probe.ts', '../scenes/title.ts'],
  ])('%s may import %s', async (file, specifier) => {
    expect(await importErrors(file, specifier)).toEqual([]);
  });

  it('keeps Node built-ins out of game code but allows them in tools', async () => {
    expect((await importErrors('src/render/probe.ts', 'node:fs')).join('\n')).toMatch(/src\/tools/);
    expect((await importErrors('src/sim/probe.ts', 'fs')).join('\n')).toMatch(/src\/tools/);
    expect(await importErrors('src/tools/probe.ts', 'node:fs')).toEqual([]);
  });
});
