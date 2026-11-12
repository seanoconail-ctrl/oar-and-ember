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
  // Combat v2 (design addendum 2.4): the hurt, the parry's ring, the riposte, the lunge, the
  // backstab, the sidestep, turning alert, binding a wound and eating.
  ['sfx:SFX_STEERER_BREATH', 0.6, {}, 'combat2-steerer-breath'],
  ['sfx:SFX_GRUNT', 0.5, {}, 'combat2-grunt'],
  ['sfx:SFX_PARRY_RING', 1.5, {}, 'combat2-parry-ring'],
  ['sfx:SFX_RIPOSTE', 0.8, {}, 'combat2-riposte'],
  ['sfx:SFX_LUNGE', 0.5, {}, 'combat2-lunge'],
  ['sfx:SFX_BACKSTAB', 0.8, {}, 'combat2-backstab'],
  ['sfx:SFX_SIDESTEP', 0.4, {}, 'combat2-sidestep'],
  ['sfx:SFX_ALERT', 0.8, {}, 'combat2-alert'],
  ['sfx:SFX_BIND_WOUND', 2.8, {}, 'combat2-bind-wound'],
  ['sfx:SFX_EAT', 2.0, {}, 'combat2-eat'],
  ['call:SFX_ARROW_SHIELD', 0.8, {}, 'combat2-arrow-shield'],
  // Design addendum 2.4, the opening: the cold open, the net, the chest, the fire, the sail, the
  // mast, the ring, the doors and the Hag's Stone; the music's fade in, layers joining and fade out
  // (DE-29: Book 10 section 25, fadeIn 8 s, layers over 20 to 30 s, fadeOut 6 s).
  ...(
    [
      ['SFX_COLD_STRIKE', 3],
      ['SFX_COUGH', 1.5],
      ['SFX_NET_CUT', 2],
      ['SFX_CHEST_DRAG', 2],
      ['SFX_CHEST_THUD', 1],
      ['SFX_FLINT', 1.5],
      ['SFX_SAIL_RAISE', 3],
      ['SFX_CHEST_OPEN', 2],
      ['SFX_LASHING', 1.5],
      ['SFX_BUNDLE_SPLASH', 2],
      ['SFX_RING_CLINK', 1],
      ['SFX_DOOR_CREAK', 2],
      ['SFX_DOOR_KNOCK', 1],
      ['SFX_FLAP', 1.5],
      ['SFX_DOOR_BAR', 1.5],
      ['SFX_HAG_DRONE', 6],
      ['SFX_HAG_GUST', 3],
    ] as const
  ).map(([id, s]): [string, number, Record<string, unknown>, string] => [
    `sfx:${id}`,
    s,
    {},
    `opening-${id.slice(4).toLowerCase().replace(/_/g, '-')}`,
  ]),
  [
    'music:hearth',
    44,
    { fade: { fadeIn: 8, layersJoin: 25, stopAt: 34, fadeOut: 6 } },
    'opening-hearth-fades',
  ],
  ['tell:SFX_TELL_RAN', 6, {}, 'tell-ran'],
  ['tell:SFX_TELL_MANANNAN', 7, {}, 'tell-manannan'],
  ['tell:SFX_TELL_DRAUGR', 6.5, {}, 'tell-draugr'],
  ['voice:C_HILD', 4, {}, 'voice-hild'],
  ['voice:C_BRAN', 5, {}, 'voice-bran'],
  ['voice:C_RUNA', 5, {}, 'voice-runa'],
  ['voice:C_ODDI', 5, {}, 'voice-oddi'],
  // Stage 8: every resident's voice blip (Book 11 section 08), and the first dispute's stingers.
  ...(
    [
      'C_HILD',
      'C_ODDI',
      'C_BRAN',
      'C_RUNA',
      'C_EITHNE',
      'C_NESSA',
      'C_GUDRUN',
      'C_ARNBJORN',
      'C_KARI',
      'C_KOLLA',
      'C_TOFI',
      'C_YLVA',
      'C_KOLBEINN',
      'C_ASA',
      'C_THRAND',
      'C_AINE',
      'C_SENAN',
    ] as const
  ).map((id): [string, number, Record<string, unknown>, string] => [
    `resident:${id}`,
    5,
    {},
    `resident-${id.slice(2).toLowerCase()}`,
  ]),
  // Stage 10: the southern island's ambiences and the Hag's Seat's tell (Book 11 section 12).
  ['south:spring', 24, {}, 'south-kelda-spring'],
  ['south:gale', 24, {}, 'south-hagseat-gale'],
  ['south:fold', 30, {}, 'south-cairn-fold'],
  ['south:SFX_TELL_CAILLEACH', 7, {}, 'tell-cailleach'],
  // Stage 11: Seal Cave, every repair, fitting and rite sound, and Thorkel's lament.
  ['repairs:sealcave', 24, {}, 'amb-sealcave'],
  ...(
    [
      ['SFX_WORK_REPAIR', 3.5],
      ['SFX_RIGGING_CUT', 3.5],
      ['SFX_LOAD_LAID', 1.5],
      ['SFX_REPAIR_DONE', 3],
      ['SFX_OAR_TAKEN', 2],
      ['SFX_FITTING_DONE', 2.5],
      ['SFX_FITTING_UNSHIPPED', 2],
      ['SFX_WORK_ADZE', 2.5],
      ['SFX_STONES_SET', 3],
      ['SFX_SEA_BURIAL', 4.5],
      ['MUS_STINGER_BUILDING_FINISHED', 3.5],
      ['MUS_LAMENT_THORKEL', 50],
    ] as const
  ).map(([id, s]): [string, number, Record<string, unknown>, string] => [
    `repairs:${id}`,
    s,
    {},
    id.toLowerCase().replace(/_/g, '-'),
  ]),
  // Stage 12: the launch's music (the Ship theme) and sounds, and the chapter's end.
  ['music:ship', 20, {}, 'mus-launch-ship'],
  ...(
    [
      ['SFX_BEACHING', 3],
      ['SFX_OAR_CREAK', 1],
      ['SFX_OAR_SPLASH', 1.2],
      ['SFX_SAIL_FLAP', 2.2],
      ['SFX_SAIL_FILL', 2],
      ['MUS_STINGER_CHAPTER_END', 8],
    ] as const
  ).map(([id, s]): [string, number, Record<string, unknown>, string] => [
    `launch:${id}`,
    s,
    {},
    id.toLowerCase().replace(/_/g, '-'),
  ]),
  ...(['E_WRECKER_KETILL', 'E_WRECKER_SVART', 'E_WRECKER_CONN'] as const).map(
    (id): [string, number, Record<string, unknown>, string] => [
      `resident:${id}`,
      5,
      {},
      `voice-${id.slice(2).toLowerCase().replace('_', '-')}`,
    ],
  ),
  ['call:MUS_STINGER_DISPUTE', 3, {}, 'stinger-dispute'],
  ['call:MUS_STINGER_JUDGEMENT', 3, {}, 'stinger-judgement'],
  // Decision AU-10: footsteps by surface, walking and running.
  ...(['grass', 'shingle', 'sand', 'wet_sand', 'water', 'rock'] as const).flatMap(
    (s): [string, number, Record<string, unknown>, string][] => [
      [`step:${s}`, 4.5, { gait: 'walk', steps: 8 }, `steps-${s.replace('_', '-')}-walk`],
      [`step:${s}`, 3, { gait: 'run', steps: 8 }, `steps-${s.replace('_', '-')}-run`],
    ],
  ),
  // Decision AU-11: the horn, the stingers and the hearth, now that they play in the game.
  ['call:SFX_HORN', 3, {}, 'sfx-horn'],
  ['call:MUS_STINGER_HORN', 3, {}, 'stinger-horn'],
  ['call:MUS_STINGER_DISCOVERY', 3, {}, 'stinger-discovery'],
  // The Stage 6 rework: wading and the bow.
  ['call:SFX_SPLASH', 1, {}, 'sfx-splash'],
  ['call:SFX_BOW_DRAW', 1, {}, 'sfx-bow-draw'],
  ['call:SFX_BOW_LOOSE', 1, {}, 'sfx-bow-loose'],
  // Starting weapons and missiles (decisions DD-6 to DD-9).
  ['call:SFX_ARROW_FLIGHT', 1, {}, 'sfx-arrow-flight'],
  ['call:SFX_ARROW_WOOD', 1, {}, 'sfx-arrow-wood'],
  ['call:SFX_ARROW_SHIELD', 1, {}, 'sfx-arrow-shield'],
  ['call:SFX_ARROW_EARTH', 1, {}, 'sfx-arrow-earth'],
  ['call:SFX_ARROW_STONE', 1, {}, 'sfx-arrow-stone'],
  ['call:SFX_ARROW_WATER', 1, {}, 'sfx-arrow-water'],
  ['call:SFX_QUIVER_EMPTY', 1, {}, 'sfx-quiver-empty'],
  ['call:SFX_PICKUP', 1, {}, 'sfx-pickup'],
  ['ambience:hearth', 12, {}, 'hearth-fire'],
  // Stage 7: the hearth theme by time of day (the layers of MUS_HOME_DAWN/DAY/DUSK/NIGHT in
  // content/audio.json), the steading's life by time of day, and the work, fire and sleep sounds.
  ...(
    [
      ['dawn', { drone: false, lyre: true, melody: true, voice: false, harp: false, drum: false }],
      ['day', { drone: true, lyre: true, melody: true, voice: false, harp: false, drum: false }],
      ['dusk', { drone: true, lyre: true, melody: false, voice: true, harp: false, drum: false }],
      ['night', { drone: true, lyre: true, melody: false, voice: false, harp: false, drum: false }],
    ] as const
  ).map(([p, layers]): [string, number, Record<string, unknown>, string] => [
    'music:hearth',
    38,
    { layers },
    `home-music-${p}`,
  ]),
  ...(['dawn', 'day', 'dusk', 'night'] as const).map(
    (p): [string, number, Record<string, unknown>, string] => [
      `home:${p}`,
      40,
      { wind: 0.45 },
      `home-life-${p}`,
    ],
  ),
  ...(
    [
      'SFX_WORK_DRIFTWOOD',
      'SFX_DRIFTWOOD_PICKUP',
      'SFX_WORK_CAST',
      'SFX_WORK_CATCH',
      'SFX_WORK_TEND',
      'SFX_WORK_COOK',
      'SFX_WORK_HAMMER',
      'SFX_FIRE_LIT',
      'SFX_FIRE_FED',
      'SFX_FIRE_OUT',
      'SFX_TIMING_GOOD',
      'SFX_SLEEP',
    ] as const
  ).map((id): [string, number, Record<string, unknown>, string] => [
    `work:${id}`,
    2.5,
    {},
    `sfx-${id.slice(4).toLowerCase().replaceAll('_', '-')}`,
  ]),
  // Stage 9: the combat music at its three strengths, the fight's sounds at each gore setting
  // where the setting changes them, and game over's stinger.
  ...(
    [
      [1, { rhythm: true, melody: false, voice: false, danger: false }],
      [2, { rhythm: true, melody: true, voice: false, danger: false }],
      [3, { rhythm: true, melody: true, voice: true, danger: true }],
    ] as const
  ).map(([n, layers]): [string, number, Record<string, unknown>, string] => [
    'music:combat',
    18,
    { layers },
    `combat-music-${n}`,
  ]),
  ...(
    [
      'SFX_LIGHT_ATTACK',
      'SFX_HEAVY_SWING',
      'SFX_HIT_MAIL',
      'SFX_HIT_SHIELD',
      'SFX_DODGE',
      'SFX_SHOVE',
      'SFX_WEAPON_DROP',
      'SFX_SPEAR_THROW',
    ] as const
  ).map((id): [string, number, Record<string, unknown>, string] => [
    `fight:${id}`,
    1.5,
    {},
    `sfx-${id.slice(4).toLowerCase().replaceAll('_', '-')}`,
  ]),
  ...(
    [
      'SFX_HIT_FLESH',
      'SFX_GORE_WET_IMPACT',
      'SFX_GORE_BONE_CRACK',
      'SFX_GORE_DISMEMBERMENT',
      'SFX_DOWNED',
      'SFX_BODY_FALL',
    ] as const
  ).flatMap((id): [string, number, Record<string, unknown>, string][] =>
    ([2, 1, 0] as const).map((gore) => [
      `fight:${id}`,
      1.5,
      { gore },
      `sfx-${id.slice(4).toLowerCase().replaceAll('_', '-')}-gore-${['off', 'low', 'full'][gore] ?? ''}`,
    ]),
  ),
  ['call:MUS_STINGER_GAME_OVER', 5, {}, 'stinger-game-over'],
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
