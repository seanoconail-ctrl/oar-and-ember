/** Stage 1 deliverables: the Book 2 layout, the build id, the workflow and the balance file. */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILD_ID, BUILD_ID_PATTERN } from '../../src/core/build.ts';
import { decodePng, encodePng, scaleNearest } from '../../src/tools/art/png.ts';
import { REPO_ROOT } from '../../src/tools/art/loadTitleArt.ts';
import { bookSection, repoFile } from './books.ts';

const SIM = bookSection(2, '02')?.match(/people\/[^\n]+\n\s+[^\n]+/)?.[0] ?? '';

describe('the Book 2 folder layout', () => {
  const simFolders = SIM.split(/\s+/)
    .filter((s) => s.endsWith('/'))
    .map((s) => s.slice(0, -1));
  const modules = [
    'core',
    'content',
    'sim',
    ...simFolders.map((s) => `sim/${s}`),
    'scenes',
    'render',
    'audio',
    'input',
    'ui',
    'persist',
    'tools',
  ];

  it('lists the sixteen simulation folders of Book 2 section 02', () => {
    expect(simFolders).toHaveLength(16);
    expect(simFolders).toContain('calendar');
  });

  it.each(modules)('src/%s exists with a README and an index module', (module) => {
    expect(existsSync(join(REPO_ROOT, 'src', module, 'README.md'))).toBe(true);
    expect(existsSync(join(REPO_ROOT, 'src', module, 'index.ts'))).toBe(true);
  });

  it.each([
    'content/README.md',
    'content/balance.json',
    'content/ids.json',
    'content/strings/en.json',
    'assets/README.md',
    'tests/unit/README.md',
    'tests/property/README.md',
    'tests/scenario/README.md',
    'tests/reachability/README.md',
    'tests/golden-saves/README.md',
    'docs/decision-log.md',
    'docs/stage-reports/README.md',
  ])('%s exists', (path) => {
    expect(existsSync(join(REPO_ROOT, path))).toBe(true);
  });

  it('keeps the Book 10 balance sheet as data', () => {
    const balance = JSON.parse(repoFile('content/balance.json')) as {
      source?: string;
      tables?: object;
    };
    expect(balance.source).toBe('Book 10');
    expect(Object.keys(balance.tables ?? {}).length).toBeGreaterThan(5);
  });
});

describe('the build id', () => {
  it('is injected at build time as <version>+<commit>', () => {
    expect(BUILD_ID).toMatch(BUILD_ID_PATTERN);
    const version = (JSON.parse(repoFile('package.json')) as { version: string }).version;
    expect(BUILD_ID.startsWith(`${version}+`)).toBe(true);
  });
});

describe('the GitHub Actions workflow', () => {
  const workflow = repoFile('.github/workflows/ci.yml');

  it('runs lint, tests and the build on every push', () => {
    expect(workflow).toMatch(/on:\s*\n\s+push:/);
    for (const step of [
      'npm ci',
      'npm run lint',
      'npm test',
      'npm run build',
      'npm run test:browser',
    ]) {
      expect(workflow).toContain(step);
    }
  });

  it('checks Firefox and WebKit on macOS, which has a GPU (decision S1-16)', () => {
    expect(workflow).toMatch(/runs-on: macos-15-intel[\s\S]*--project=firefox --project=webkit/);
  });

  it('publishes to GitHub Pages only from a push, and checks the published address', () => {
    expect(workflow).toContain('actions/upload-pages-artifact');
    expect(workflow).toContain('actions/deploy-pages');
    // Published from main and, while Stages 1 to 6 are built, the working branch (decision S1-17).
    expect(workflow).toMatch(
      /if: github\.event_name == 'push' && \(github\.ref == 'refs\/heads\/main' \|\|/,
    );
    expect(workflow).toContain('BASE_URL: ${{ needs.deploy.outputs.page_url }}');
  });
});

describe('PNG tools', () => {
  it('round-trips an image and enlarges it by whole numbers', () => {
    const data = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 9, 8, 7, 255]);
    const image = { width: 2, height: 2, data };
    expect(decodePng(encodePng(image))).toEqual(image);
    const big = scaleNearest(image, 3);
    expect([big.width, big.height]).toEqual([6, 6]);
    expect([...big.data.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...big.data.subarray((5 * 6 + 5) * 4, (5 * 6 + 6) * 4)]).toEqual([9, 8, 7, 255]);
  });
});
