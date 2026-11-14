/**
 * `npm run test:browser`: the Playwright tests in two passes (decision DG-95).
 *
 * 1. Every test in parallel, except the frame-budget measures (tagged `@budget`).
 * 2. The `@budget` measures alone, one worker, so the script time per frame they read is the
 *    game's own cost and not that of another browser running beside it. The limits are unchanged.
 *
 * Arguments (such as `--project=chromium`) are passed to both passes. Both passes always run; the
 * command fails if either fails.
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

function pass(extra: string[], env: Record<string, string>): number {
  const result = spawnSync('npx', ['playwright', 'test', ...args, ...extra], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  return result.status ?? 1;
}

const main = pass(['--grep-invert', '@budget'], {});
console.log('\nThe frame-budget measures, alone (one worker):');
const budget = pass(['--grep', '@budget', '--workers=1', '--pass-with-no-tests'], {});
process.exit(main !== 0 ? main : budget);
