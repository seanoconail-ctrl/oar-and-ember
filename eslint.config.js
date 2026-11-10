// ESLint flat config. Layer rules follow Book 2 section 02: one-way dependencies, and the
// simulation never imports rendering, audio or UI.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const LAYERS = [
  'core',
  'content',
  'sim',
  'scenes',
  'render',
  'audio',
  'input',
  'ui',
  'persist',
  'tools',
];

/** Matches a relative import that climbs out of the current layer into one of `layers`. */
function intoLayers(layers) {
  return `^(\\.\\./)+(${layers.join('|')})(/|$)`;
}

/** Book 2: what each layer may NOT import. */
const FORBIDDEN = {
  core: LAYERS.filter((l) => l !== 'core'),
  content: LAYERS.filter((l) => l !== 'core' && l !== 'content'),
  sim: ['scenes', 'render', 'audio', 'input', 'ui', 'persist', 'tools'],
  render: ['scenes', 'persist', 'tools'],
  audio: ['scenes', 'persist', 'tools'],
  input: ['scenes', 'persist', 'tools'],
  ui: ['scenes', 'persist', 'tools'],
  persist: ['scenes', 'render', 'audio', 'input', 'ui', 'tools'],
  scenes: ['tools'],
};

const DETERMINISM =
  'Book 2 section 03: no Math.random() or wall-clock time in sim/ or core/; use the RNG streams and the tick.';

const NODE_BUILTINS = '^(node:|(fs|path|os|child_process|crypto|url|util|zlib|stream)(/|$))';

const layerRules = Object.entries(FORBIDDEN).map(([layer, forbidden]) => ({
  files: [`src/${layer}/**/*.ts`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            regex: intoLayers(forbidden),
            message: `Book 2 section 02: ${layer}/ may not import ${forbidden.join(', ')}.`,
          },
          {
            regex: NODE_BUILTINS,
            message: 'Game code runs in the browser: Node built-ins are allowed only in src/tools.',
          },
        ],
      },
    ],
  },
}));

export default defineConfig(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'artifacts/',
      'docs/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/tools/**/*.ts', 'tests/**/*.ts', '*.config.ts', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  ...layerRules,
  {
    // Book 2 sections 03 and 24: the simulation is deterministic. No Math.random, wall-clock time
    // or timers in sim/ or core/; randomness comes from the named RNG streams in core/rng.ts.
    files: ['src/sim/**/*.ts', 'src/core/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: DETERMINISM },
        { object: 'Date', property: 'now', message: DETERMINISM },
        { object: 'performance', property: 'now', message: DETERMINISM },
        { object: 'crypto', property: 'getRandomValues', message: DETERMINISM },
        { object: 'crypto', property: 'randomUUID', message: DETERMINISM },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'Date',
          'performance',
          'setTimeout',
          'setInterval',
          'requestAnimationFrame',
          'crypto',
        ].map((name) => ({ name, message: DETERMINISM })),
      ],
    },
  },
  prettier,
);
