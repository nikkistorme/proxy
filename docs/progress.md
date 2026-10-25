# Progress

## Current state

Phase 1: 1a, 1b and 1c are merged. PR preview deploys (CI/CD step 3) are in review on branch `ci-pr-previews`, ahead of 1d, the first UI issue.

## Done

### PR preview deploys (2026-10-25)

- `.github/workflows/preview.yml` (CI/CD step 3) builds each PR with `VITE_BASE=/proxy/pr-preview/pr-N/` and publishes it with `rossjrw/pr-preview-action` to `gh-pages/pr-preview/pr-N/`. It comments the link on the PR and removes the preview when the PR closes.
- `.github/workflows/deploy.yml` now pushes `dist` to the root of the `gh-pages` branch with `JamesIves/github-pages-deploy-action`, leaving `pr-preview/` alone.
- Pages serves from the `gh-pages` branch, root folder.
- `vite.config.ts` reads the base path from `VITE_BASE`, defaulting to `/proxy/`. `public/.nojekyll` turns off Jekyll.
- CLAUDE.md's Pull requests section now has the preview link, the How to test section, the rule to wait for the owner's check before merging, and the storage rule for previews.

### Phase 1c: Re-import merge (2026-10-25)

- `CardDefinition` (`src/model/card.ts`) is an `ImportedCard` plus an app `id` that stays stable across re-imports, and an optional `missing: true`.
- `cardNameKey` (trim and lower-case) lives in `src/model/card.ts`. 1b's duplicate-name warning and 1c's matching both use it.
- `mergeImport(existing, imported, newId)` in `src/model/mergeImport.ts` returns `{ definitions, added, updated, missing }` (CD-5):
  - Matching by CSV id comes first. Then name matching, in file order, unless the two cards have different CSV ids.
  - Matched definitions keep their id and take the new data. Unmatched cards get `newId()`.
  - Definitions no longer in the CSV are kept, flagged `missing`, and placed after the imported cards. The flag clears if the card comes back.
  - `newId` is passed in so tests can use predictable ids. The app should pass `crypto.randomUUID`.
- The model-level acceptance test checks that changed rules text updates the definition, and that a table card referring to it keeps its position, rotation, counters and face.

### Phase 1b: Card model and validation (2026-10-25)

- `src/model/card.ts` has two types:
  - `CardFace`: `name`, `image?`, `layout?`, `type?`, and `fields` for every other column.
  - `ImportedCard`: `row`, `sourceId?` (the CSV `id`), `qty`, `front`, `back?`.
  - Imported cards have no app id yet. 1c assigns ids when an import is merged into a pile.
- `src/csv/importCards.ts`: `importCards(text)` returns `{ cards, problems }` (CD-3, CD-4).
  - Fronts are read first and backs attached after, so a back row can come before its front.
  - Problems from parsing and from validation are merged into one list, sorted by row.
  - The named columns are trimmed; every other column keeps its exact text.
- Validation rules, as the owner confirmed:
  - A missing name skips the row.
  - A bad `qty` imports as 1 and is reported. `qty` 0 is allowed.
  - A duplicate `id` is reported, and the later row imports without it.
  - A shared name is reported when either card lacks an `id`, and both import.
  - These back faces are dropped and reported: one pointing at an unknown id, one pointing at another back face, and a second back for the same front.
- Fixtures: `double-faced.csv`, `import-errors.csv` (one row per problem) and `sixty-rows-two-dfc.csv`. The acceptance test confirms 60 rows give 58 cards, two of them with a back face.

### Phase 1a: CSV parsing (2026-10-25)

- `src/csv/parseCsv.ts`: `parseCsv(text)` returns `{ columns, rows, problems }` (CD-1, CD-2). Built on Papa Parse 5.
  - Row numbers match the spreadsheet: the header is row 1, and multi-line quoted cells don't shift later rows.
  - Column names are trimmed and lower-cased. Blank header cells are ignored. A repeated column is reported, and the first one is kept.
  - It strips a byte-order mark and skips blank lines.
  - Missing trailing values become `''`. Extra values are reported and dropped.
  - A row with a quote error (for example, an unclosed quote) is reported and dropped.
  - An empty file, or one with no header, is reported.
  - Cell values aren't trimmed here; 1b decides per column.
- `ImportProblem` is `{ row, column?, message }` (`src/csv/types.ts`). 1b adds the validation problems to this list.
- Fixtures are in `tests/fixtures/csv/`. Tests import them with Vite's `?raw`, so `src/` needs no Node types.
- QA-2 thresholds (85% lines and branches) for `src/model/**`, `src/actions/**` and `src/csv/**` are in `vitest.config.ts`. I confirmed they fail the run when not met.
- CLAUDE.md now has a Design section that points UI work at `design/`.

### Phase 0: Project scaffold and CI pipeline (2026-10-25)

- Vite 8 + React 18 + TypeScript 6 (strict, plus `noUncheckedIndexedAccess`). The app shell is a `<main>` with `<h1>Proxy</h1>`. Vite `base: '/proxy/'`.
- ESLint 9 flat config: `@eslint/js`, `typescript-eslint` strict, `react-hooks`, `jsx-a11y` strict (for `src/**/*.tsx`).
- Vitest 5 + Testing Library + jsdom, with v8 coverage (text, html, lcov). No thresholds yet. `src/App.test.tsx` covers the shell.
- Playwright: `e2e/smoke.spec.ts` checks the heading and runs an axe scan (WCAG 2.0/2.1/2.2 A and AA tags), expecting zero violations. It runs against `vite preview` of the production build. Locally it uses Chromium only; with `CI` set it uses Chromium, Firefox and WebKit. Trace and screenshot are kept on failure (QA-6).
- `.github/workflows/ci.yml` (pull requests and pushes to `main`) has two parts:
  - a `check` job: `npm ci`, typecheck, lint, `npm test` with coverage (uploaded as an artifact), build
  - an `e2e` matrix with one job per browser, which uploads `playwright-report/` and `test-results/` when it fails
- `.github/workflows/deploy.yml`: on push to `main`, builds and deploys `dist` to GitHub Pages.
- Node version is pinned in `.nvmrc` (22).
- CI verified on PR #1. All checks were green; the whole pipeline takes about 70 seconds. A deliberately broken E2E assertion turned all three browser checks red and uploaded `trace.zip` and `test-failed-1.png` for each. The break was then reverted.
- After the merge, the site deployed and loads at https://nikkistorme.github.io/proxy/. The `main` heading renders and there are no console errors.
- Owner steps done: Pages source is GitHub Actions. A ruleset on `main` requires a PR, the four CI checks and an up-to-date branch, and blocks deletion and force pushes.

## Next

Phase 1 issues, one PR each:

- **1d. UI (CD-6, CD-4 UI).** `CardArt` with a name placeholder, and the import-problems list. Follow `design/` (Import results isn't designed yet, so build it from the tokens and the `MoveDialog` pattern).

## Open problems

- For Phase 2 and 3: a changed `qty` only updates the definition. Piles still need a rule for adding or removing copies when `qty` changes on re-import.
- For Phase 3: a table card showing its back face whose definition loses its back on re-import should fall back to the front.
- For Phase 3: decide how cards on the table whose definition is `missing` should look. The import results in 1d can list them.
- The app's PR monitor still shows an error cached from the old npm `gh`. CI was checked with the real `gh` instead.
- Local Node is 22.12.0. Some ESLint deps want ≥ 22.13 (this is an engine warning only). CI uses the latest Node 22.

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-25 | Phase 0 covers QA-6 and CI/CD steps 1, 2 and 5, not the "QA-2, CI/CD 1–4" in the requirements phase table | Coverage thresholds wait until Phase 1, when there's code to measure. Lighthouse CI is in Phase 7. PR previews (step 3) are still undecided. Branch protection (step 4) is an owner step. |
| 2026-10-25 | ESLint 9 and TypeScript 6 rather than the latest majors | `eslint-plugin-jsx-a11y` and `typescript-eslint` don't support ESLint 10 or TypeScript 7 yet. Revisit when they do. |
| 2026-10-25 | E2E runs against the production build (`vite preview`) | Matches the CI/CD requirement that E2E runs against the built app |
| 2026-10-25 | One CI job per browser for E2E | Runs in parallel and keeps each check under the 10-minute budget. Each browser shows as its own required check. |
| 2026-10-25 | E2E jobs run in the `mcr.microsoft.com/playwright` container, and `@playwright/test` is pinned to an exact version | `playwright install --with-deps webkit` took 12 minutes on a plain runner. The image tag must match the pinned version, so bump both together. |
| 2026-10-25 | Phase 1 split into 1a parsing, 1b model and validation, 1c re-import merge, 1d UI | Each piece fits one session and one small PR (BP-2) |
| 2026-10-25 | Papa Parse runs without header mode; the header is mapped in our own code | Keeps row numbers equal to spreadsheet rows when quoted cells span lines (CD-4 needs accurate rows) |
| 2026-10-25 | A row with a quote error is dropped and reported, not imported | An unclosed quote swallows the rest of the file, so the row's data can't be trusted |
| 2026-10-25 | Cards removed from the CSV keep their definition, flagged `missing` | Copies already in play keep rendering, and import results can list them. Deleting would leave table cards pointing at nothing. |
| 2026-10-25 | Name matching on re-import also applies when only one side has a CSV id | Adding ids to an existing sheet shouldn't break the cards already in play. Two different ids never match. |
| 2026-10-25 | PR previews on GitHub Pages (gh-pages branch, `pr-preview/pr-N/`) | Netlify deploy previews; local testing only | Stays on GitHub with no new accounts or secrets. Production moved to the gh-pages branch so both can share it. |
| 2026-10-25 | UI PRs wait for the owner to test the preview before merging | Merging on green CI | Lets the owner check every UI change in a real build before production |
| 2026-10-25 | Saved data is keyed by the app's base path (applies from Phase 6) | Shared keys | Previews share the live site's web address, and so its storage |
