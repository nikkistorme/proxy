# Progress

## Current state

Phase 1 (card data) is complete. Self-hosted fonts are in review on branch `fonts-self-hosted`, waiting for the owner to test the preview. Phase 2 (piles) is next, after the owner's go-ahead.

## Done

### Self-hosted fonts (2026-10-25)

- `@fontsource/atkinson-hyperlegible-next` and `@fontsource/atkinson-hyperlegible-mono` (5.3.0, OFL-1.1) are approved dependencies.
- `src/fonts.ts` loads only the design's weights: Next 400, 600 and 700, and Mono 500 and 700. It's imported in `src/main.tsx` after the tokens.
- Vite bundles the fonts, about 94 kB of woff2 in total, and browsers fetch only the weights and character ranges a page uses.
- The font names match `design/tokens.css`, so the design file is unchanged.
- New E2E checks in `e2e/smoke.spec.ts`:
  - **AR-5:** the page requests nothing outside its own origin.
  - **Fonts:** all five weights load. I confirmed this test fails without the fonts import.

### Phase 1d: Card art and import results UI (2026-10-25)

- `src/main.tsx` imports `design/tokens.css` directly, so a fresh design export updates the app. `src/index.css` holds the base styles, the design's double focus ring, and button styles.
- `src/components/CardArt.tsx` (CD-6) renders `<img alt={name}>` filling its frame.
  - With no image, or once the image fails to load, it shows a placeholder: the `--mat-edge` colour, an icon and the card name, labelled with the name.
  - A new URL gets a fresh try.
- `src/components/ImportResults.tsx` (CD-4 UI) is a native `<dialog>` following the MoveDialog board.
  - It shows the file name, a summary (imported, new, updated, missing), the cards no longer in the CSV, and a problems table (Row, Column, Problem).
  - Close it with Done, the × button or Esc.
- Interim import panel in `App.tsx`: "Choose CSV file" runs `importCards` and `mergeImport`, shows the results, then shows the deck as a card grid. Importing again re-imports into the same deck. **Temporary:** replace it with the Start and setup screen.
- Tests:
  - Component tests: `CD-6 card art placeholder`, `CD-4 import results`, and the interim panel, which also covers CD-5 and focus return.
  - E2E (`e2e/import.spec.ts`): import by mouse and by keyboard only, the problems table, Esc, focus return, axe with the dialog open and with the card grid, and the placeholder filling a 126 × 176 frame. The fixtures' `example.test` art requests are aborted in the test.
- jsdom has no `<dialog>` methods. `src/test-setup.ts` adds a small stand-in, and real dialog behaviour is covered by E2E.
- Checked by hand in the dev server: the dialog at desktop width and at 320px, Esc returning focus, and the placeholders in the grid.

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

- Owner tests the fonts preview, then merges.
- Phase 2 (piles), once the owner gives the go-ahead. Read SP-1 to SP-9 in the requirements, and `PileViewer`, `CardStates` and `Main` in `design/mockups/`.

## Open problems

- Dark theme isn't wired up. `tokens.css` has `[data-theme="dark"]` values, but nothing sets `data-theme` yet. Decide how the theme is chosen (follow the system setting, a toggle, or both) when the table is built.
- PR preview clean-up leaves an empty `pr-preview/pr-N/.nojekyll` on `gh-pages`. It's harmless (the URL returns 404), but it could be tidied later.
- For Phase 2 and 3: a changed `qty` only updates the definition. Piles still need a rule for adding or removing copies when `qty` changes on re-import.
- For Phase 3: a table card showing its back face whose definition loses its back on re-import should fall back to the front.
- For Phase 3: decide how cards on the table whose definition is `missing` should look. The import results in 1d can list them.
- The app's PR monitor still shows an error cached from the old npm `gh`. CI was checked with the real `gh` instead.
- Local Node is 22.12.0. Some ESLint deps want ≥ 22.13 (this is an engine warning only). CI uses the latest Node 22.

## Decisions

| Date | Decision | Rejected | Why |
| --- | --- | --- | --- |
|  2026-10-25 | Phase 0 covers QA-6 and CI/CD steps 1, 2 and 5, not the "QA-2, CI/CD 1–4" in the requirements phase table | — | Coverage thresholds wait until Phase 1, when there's code to measure. Lighthouse CI is in Phase 7. PR previews (step 3) are still undecided. Branch protection (step 4) is an owner step.  |
|  2026-10-25 | ESLint 9 and TypeScript 6 rather than the latest majors | — | `eslint-plugin-jsx-a11y` and `typescript-eslint` don't support ESLint 10 or TypeScript 7 yet. Revisit when they do.  |
|  2026-10-25 | E2E runs against the production build (`vite preview`) | — | Matches the CI/CD requirement that E2E runs against the built app  |
|  2026-10-25 | One CI job per browser for E2E | — | Runs in parallel and keeps each check under the 10-minute budget. Each browser shows as its own required check.  |
|  2026-10-25 | E2E jobs run in the `mcr.microsoft.com/playwright` container, and `@playwright/test` is pinned to an exact version | — | `playwright install --with-deps webkit` took 12 minutes on a plain runner. The image tag must match the pinned version, so bump both together.  |
|  2026-10-25 | Phase 1 split into 1a parsing, 1b model and validation, 1c re-import merge, 1d UI | — | Each piece fits one session and one small PR (BP-2)  |
|  2026-10-25 | Papa Parse runs without header mode; the header is mapped in our own code | — | Keeps row numbers equal to spreadsheet rows when quoted cells span lines (CD-4 needs accurate rows)  |
|  2026-10-25 | A row with a quote error is dropped and reported, not imported | — | An unclosed quote swallows the rest of the file, so the row's data can't be trusted  |
|  2026-10-25 | Cards removed from the CSV keep their definition, flagged `missing` | — | Copies already in play keep rendering, and import results can list them. Deleting would leave table cards pointing at nothing.  |
|  2026-10-25 | Name matching on re-import also applies when only one side has a CSV id | — | Adding ids to an existing sheet shouldn't break the cards already in play. Two different ids never match.  |
| 2026-10-25 | PR previews on GitHub Pages (gh-pages branch, `pr-preview/pr-N/`) | Netlify deploy previews; local testing only | Stays on GitHub with no new accounts or secrets. Production moved to the gh-pages branch so both can share it. |
| 2026-10-25 | UI PRs wait for the owner to test the preview before merging | Merging on green CI | Lets the owner check every UI change in a real build before production |
| 2026-10-25 | Saved data is keyed by the app's base path (applies from Phase 6) | Shared keys | Previews share the live site's web address, and so its storage |
|  2026-10-25 | Import `design/tokens.css` directly instead of copying it into `src/` | — | Keeps one source of truth, so a fresh design export updates the app  |
|  2026-10-25 | Missing-art placeholder: solid `--mat-edge` fill, icon and name, no dashed border | — | `CardStates` uses a dashed outline for empty piles and drop targets, so a dashed placeholder would read as an empty slot  |
|  2026-10-25 | Interim import panel on the app shell until the Start and setup screen exists | — | Gives every UI PR something to test in the preview  |
|  2026-10-25 | Fonts deferred to their own issue before the table work | — | Self-hosting is needed under AR-5 and may add a dependency, so it needs its own decision  |
| 2026-10-25 | Focus returned after a dialog closes uses standard `:focus-visible`: the ring shows after keyboard use, not after a mouse click | Forcing the ring after every close | Matches browser and platform conventions. Keyboard users always see it (WCAG 2.4.7), and E2E checks focus returns either way. Applies to all dialogs. |
| 2026-10-25 | Self-host fonts with static `@fontsource` packages, five weights only | Font files copied into `public/`; `@fontsource-variable` packages; Google Fonts | Keeps AR-5. Static packages use the same font names as `tokens.css`, so the design file needs no edits. Updates come through npm. |
