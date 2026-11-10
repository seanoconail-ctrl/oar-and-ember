import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

/**
 * The build id shown on the title screen: the package version (0.<stage>.<patch>) plus the
 * short commit hash, so a playtest note can always be matched to the exact code that ran.
 */
function shortCommit(): string {
  const fromCi = process.env['GITHUB_SHA'];
  if (fromCi !== undefined && fromCi.length >= 7) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '0000000';
  }
}

const buildId = `${pkg.version}+${shortCommit()}`;

export default defineConfig({
  // Relative base so the same build works at the GitHub Pages project path and locally.
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    // Art sources are imported as text and decoded at load; keep them out of separate requests.
    assetsInlineLimit: 0,
    // Two pages: the game, and the sound test page (Book 11, generated audio).
    rolldownOptions: {
      input: { main: 'index.html', sound: 'sound.html' },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
