# Oar and Ember

A pixel-art Viking settlement RPG for the desktop browser.

- Design documents: `docs/` (start with `docs/01_game_bible.md`; PDFs in `docs/pdf/`)
- Build plan: `docs/03_stage_plan.md`; stage reports in `docs/stage-reports/`
- Decisions and departures from the books: `docs/decision-log.md`
- Instructions for coding sessions: `CLAUDE.md`
- Tuning numbers: `content/balance.json`; stable IDs: `content/ids.json`

Status: Stage 1 (project setup) is done: the title screen builds, tests and publishes itself.

## Play

Every push to `main` is published by GitHub Actions to GitHub Pages:
<https://seanoconail-ctrl.github.io/oar-and-ember/> (once Pages is switched on, see below).

## Develop

Needs Node 22.12 or later.

```bash
npm ci                 # install exact dependencies
npm run dev            # play locally with live reload
npm run lint           # ESLint (including the Book 2 layer rules) and Prettier
npm test               # unit tests (Vitest)
npm run build          # type-check and build to dist/
npm run test:browser   # pixel-exact title screen check in Chromium, Firefox and WebKit (after build)
npm run art:check      # render the title and fonts at 1x and 4x to artifacts/ for inspection
```

## Publishing

`.github/workflows/ci.yml` runs lint, tests, the build and the browser smoke tests on every push
(Chromium on Linux; Firefox and WebKit on macOS, which has a GPU). Pushes to `main`, and to the
working branch `claude/lucid-bell-kgmdfi` while Stages 1 to 6 are built, also publish `dist/` to
GitHub Pages and re-run the smoke tests against the published address. Settings needed once:

- **Settings > Pages > Build and deployment > Source: GitHub Actions**
- **Settings > Environments > github-pages > Deployment branches:** allow `claude/lucid-bell-kgmdfi`
