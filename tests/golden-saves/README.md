# tests/golden-saves

Golden saves and their migration tests (Book 2 section 20). From Stage 3.

Each file is a whole save, made by a fixed scenario played through the simulation's commands. The
tests are in `tests/unit/saves.test.ts`; the scenarios and the writer are in
`src/tools/saves/golden.ts`.

| File           | Schema | Made at          | Scenario                                                | Test                                                        |
| -------------- | ------ | ---------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| golden-01.json | 1      | Stage 3          | A new campaign, two days on foot                        | Frozen: loads through the migration chain                   |
| golden-02.json | 2      | Stage 6          | The steerer named, Hild carried up, two days            | Frozen: loads through the migration chain                   |
| golden-03.json | 3      | Stage 6 rework   | The hotbar, Hild in the shallows                        | Frozen: loads through the migration chain                   |
| golden-04.json | 4      | Starting weapons | The seax, Hild, the bow, one arrow                      | Frozen: loads through the migration chain                   |
| golden-05.json | 5      | Stage 7          | The camp's first day and the second                     | Frozen: loads through the migration chain                   |
| golden-06.json | 6      | Stage 8          | The same day with Hild's talk and job                   | Frozen: loads through the migration chain                   |
| golden-07.json | 7      | Stage 9          | The same day with Second wind and a few blows           | Frozen: loads through the migration chain                   |
| golden-08.json | 8      | Stage 10         | The opening and the three searches                      | Frozen: loads through the migration chain                   |
| golden-09.json | 9      | Stage 11         | The repairs, the oar and a fitting                      | Frozen: loads through the migration chain                   |
| golden-10.json | 10     | Stage 12         | The rites and the launch: the chapter-end save          | Frozen from addendum 2.4: loads through the migration chain |
| golden-11.json | 11     | Addendum 2.4     | Chapter 1 as 2.4 plays it, to its end (the chapter run) | Reproduced exactly by its scenario                          |

Only the newest is written: `npm run golden` rewrites `golden-11.json` and nothing else. A frozen
file is never rewritten; when the world state's version goes up, the new version's migration must
load every frozen file, and the newest golden save is frozen in turn.

Golden save 10 was frozen early, by design addendum 2.4 (decision DE-80): its scenario began with
the opening that 2.4 replaced, so it could no longer be made again. Golden save 11 is the new
chapter-end save: the world of `playChapter('chapter-1')` in `src/tools/play/chapterRun.ts` at the
scripted pace, the same run whose telemetry the rework report gives.
