import { expect, test } from '@playwright/test';
import { attr, startPlay, step } from './strand.ts';
test('probe shelter prompt', async ({ page }) => {
  test.setTimeout(120_000);
  await startPlay(page, 'A', 'camp=broch&shelter=down&fire=lit&time=10:00&at=33.6,30.6&capture');
  await step(page, 5);
  console.log('PROMPT', await attr(page, 'prompt'), await attr(page, 'shelter'));
  expect(true).toBe(true);
});
