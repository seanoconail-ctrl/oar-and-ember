/**
 * Renders every sound-test item offline in Chromium (the page's OfflineAudioContext) and writes
 * WAVs and their levels to artifacts/audio/, for listening back and for analysis without a
 * speaker (Book 11 audio standard).
 *
 *   npm run audio:render            every item
 *   npm run audio:render -- hearth  items whose name contains "hearth"
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { REPO_ROOT } from '../art/loadTitleArt.ts';

/** What to render: item, seconds, settings, file name. */
export const RENDERS: readonly [string, number, Record<string, unknown>, string][] = [
  ['music:hearth', 38, {}, 'hearth-full'],
  [
    'music:hearth',
    38,
    { layers: { melody: false, voice: false, harp: false, drum: false } },
    'hearth-lyre-drone',
  ],
  ['music:skarvholm', 34, { variant: 'summer' }, 'skarvholm-summer'],
  ['music:skarvholm', 44, { variant: 'winter' }, 'skarvholm-winter'],
  [
    'music:raid',
    46,
    { change: { atBar: 4, layers: { alarm: true, calm: false } } },
    'raid-alarm-at-bar-5',
  ],
  ['ambience:strand', 30, { wind: 0.55, tide: 0.8 }, 'strand-high-tide'],
  ['ambience:strand', 30, { wind: 0.9, tide: 0.1 }, 'strand-gale-low-tide'],
  ['sfx:SFX_HIT_LIGHT', 1, { gore: 2 }, 'sfx-hit-light'],
  ['sfx:SFX_CHARGE_LEVEL_1', 1.2, {}, 'sfx-charge-1'],
  ['sfx:SFX_CHARGE_LEVEL_2', 1.8, {}, 'sfx-charge-2'],
  ['sfx:SFX_PARRY', 1, {}, 'sfx-parry'],
  ['sfx:SFX_BLOCK', 1, {}, 'sfx-block'],
  ['sfx:SFX_GUARD_BREAK', 1.2, {}, 'sfx-guard-break'],
  ['tell:SFX_TELL_RAN', 6, {}, 'tell-ran'],
  ['tell:SFX_TELL_MANANNAN', 7, {}, 'tell-manannan'],
  ['tell:SFX_TELL_DRAUGR', 6.5, {}, 'tell-draugr'],
  ['voice:C_HILD', 4, {}, 'voice-hild'],
  ['voice:C_BRAN', 5, {}, 'voice-bran'],
  ['voice:C_RUNA', 5, {}, 'voice-runa'],
  ['voice:C_ODDI', 5, {}, 'voice-oddi'],
];

if (import.meta.filename === process.argv[1]) {
  const filter = process.argv[2] ?? '';
  const out = join(REPO_ROOT, 'artifacts/audio');
  mkdirSync(out, { recursive: true });
  const server = await createServer({ root: REPO_ROOT, server: { port: 5291 }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => {
      console.error('page error:', e.message);
    });
    await page.goto('http://localhost:5291/sound.html');
    await page.waitForSelector('#sound[data-state=ready]', { timeout: 30_000 });
    const summary: Record<string, unknown> = {};
    for (const [item, seconds, settings, name] of RENDERS) {
      if (!name.includes(filter)) continue;
      const r = await page.evaluate(
        async ([i, s, st]) => {
          const w = window as unknown as {
            oeSound: {
              render: (
                i: string,
                s: number,
                st: unknown,
                wav: boolean,
              ) => Promise<{ peak: number; rms: number; perSecond: number[]; wav: string }>;
            };
          };
          return w.oeSound.render(i, s, st, true);
        },
        [item, seconds, settings] as const,
      );
      writeFileSync(join(out, `${name}.wav`), Buffer.from(r.wav, 'base64'));
      summary[name] = { peak: r.peak, rms: r.rms, perSecond: r.perSecond };
      console.log(`${name}: peak ${r.peak.toFixed(3)}, rms ${r.rms.toFixed(4)}`);
    }
    writeFileSync(join(out, 'levels.json'), `${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    await browser.close();
    await server.close();
  }
}
