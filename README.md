# Oar and Ember

A pixel-art Viking settlement RPG for the desktop browser.

- Design documents: `docs/` (start with `docs/01_game_bible.md`; PDFs in `docs/pdf/`)
- Build plan: `docs/03_stage_plan.md`; stage reports in `docs/stage-reports/`
- Decisions and departures from the books: `docs/decision-log.md`
- Instructions for coding sessions: `CLAUDE.md`
- Tuning numbers: `content/balance.json`; stable IDs: `content/ids.json`

Status: Stages 1 to 6 are done: the title, naming and body choice, and the opening on Wreck Strand (find Hild and carry her above the tide line). Stage reports say what each stage built and checked.

## Play

Every push to `main` is published by GitHub Actions to GitHub Pages:
<https://seanoconail-ctrl.github.io/oar-and-ember/>.

Press any key at the title, name the steerer (or leave it as Steerer), choose a body and press
Enter. Move with WASD or the arrows, run with Shift, sneak with C, interact with E.

Check views at the same address: `?view=play&name=Ash&body=B` (straight into play),
`?view=shell` (controls, menus, captions and sound), `?view=art-test&case=front|behind|dusk|night`
and `?view=sheet&sheet=<sheet name>` (renderer and art).

## Develop

Needs Node 22.12 or later.

```bash
npm ci                 # install exact dependencies
npm run dev            # play locally with live reload
npm run lint           # ESLint (including the Book 2 layer rules) and Prettier
npm test               # unit tests (Vitest)
npm run build          # type-check and build to dist/
npm run test:browser   # pixel-exact title screen check in Chromium and WebKit (after build)
npm run art:check      # render the title, every sheet and the opening at 1x and 4x to artifacts/
npm run art:sheets     # regenerate sheets from material maps and terrain recipes
npm run art:compile    # pack sheets into assets/atlases/
npm run zones          # regenerate content/zones/ maps from their plans and Book 9's grid
npm run golden         # rewrite golden save 2 (golden save 1 is frozen)
```

## Publishing

`.github/workflows/ci.yml` runs lint, tests, the build and the browser smoke tests on every push
(Chromium on Linux; WebKit on Linux in Playwright's image). Pushes to `main`, and to the
working branch `claude/lucid-bell-kgmdfi` while Stages 1 to 6 are built, also publish `dist/` to
GitHub Pages and re-run the smoke tests against the published address. Settings needed once:

- **Settings > Pages > Build and deployment > Source: GitHub Actions**
- **Settings > Environments > github-pages > Deployment branches:** allow `claude/lucid-bell-kgmdfi`
