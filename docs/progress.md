# Progress

## Current state

Phase 2 (piles) is complete: 2a to 2h are merged. Next is Phase 3 (Table: TT-1 to TT-15, A11Y-1 to A11Y-6), which starts with a plan and a split once the owner gives the go-ahead.

## Done

### Phase 2h: Peek (2026-10-26)

- **Peek at top cards…** (SP-9) sits in the pile menu after Reveal top card, and is disabled on an empty pile.
  - It opens `PileCountDialog` in a new `peek` mode: "Peek at <pile>", "Cards to look at", starting at 3 or the pile size if that's smaller.
  - `peekTop` is a read, so `GameScreen` announces its text ("Top 3 of P1 main deck, top first: …") instead of dispatching anything.
- `PeekDialog` follows the MoveDialog patterns, on `Dialog`:
  - **Layout:** "Top N of <pile>", with the eyebrow "Shown face up to you only", and a numbered list, top first. Each row has its position, the card face at 100px, and **Up**, **Down** and **Move to…**, named for the card ("Up: Card 01").
  - **Up and Down** change only the dialog's order and announce each step ("Troll is now 1 of 3, the top."). Focus stays on the same button of the moved card. At the ends, Up and Down are `aria-disabled` and stay focusable.
  - **Move to…** opens the 2g `MoveDialog` without "<this pile> — top", because reordering does that. A move applies at once with `moveCard`, and focus goes to the next row's Move to…, or to Done when none are left.
  - **Closing:** Done, Esc and × all put the cards back in the order shown with one `reorderTop`, and only if the order changed. After moves this still works, because the cards left are exactly the pile's new top.
- `moveDestinations` takes `{ exceptTopOf }`.
- **`Dialog` acts only on its own `close` event.** React passes a nested dialog's close event up to its parents, which 2g fixed for the viewer only. A regression test covers it; I confirmed it fails without the fix.
- `GameScreen` only counts focus as lost when it's on the page body or inside a dialog that has closed. Before, focus inside the newly opened Peek dialog counted as lost, and the count dialog's late close event could pull focus back to the pile.
- Tests: 220 unit (`SP-9 peek`, `SP-9 peek N`, and the Dialog regression), and 26 E2E including `e2e/peek.spec.ts` (mouse with axe, keyboard only with Move to… "— bottom" and Esc, and phone size at 375 × 667).
- Checked by hand from screenshots at 1280 × 800 and 320 × 640.

### Workflow rules (2026-10-26)

- PR #16: after opening a PR, the session subscribes to its activity, so CI results and review comments reach it.
- This PR: every PR, docs-only ones included, updates this file. It's written as it will read after the merge, so `main` is never out of date.
- Also fixed lines that had gone stale: 2g was still "in review" and #16 still "waiting".

### Phase 2g: Move to… dialog (2026-10-26)

- `src/components/moveDestinations.ts` (SP-8):
  - `moveDestinations(state, cardId)` lists where a card can go, grouped Table, Hands, then Piles. Piles offer "— top" and "— bottom", and each destination has an "N cards" note.
  - It leaves out the table or hand the card is already in. The card's own pile stays in, because its top and bottom are real moves.
  - `matchDestinations` filters by label, ignoring case, and returns where the match is for highlighting.
- `MoveDialog`, following the MoveDialog board, built on `Dialog`:
  - **Header:** a 56px card thumbnail (`Dialog` gains a `media` slot and a 520px `medium` width) and "Move card · from <pile>".
  - **Search:** "Find a destination" is a combobox over a listbox with a named group for each heading. It uses `aria-activedescendant`, highlights the matched text with `<mark>`, and shows "N of M destinations match" as a status.
  - **Choosing:** ↑↓ choose and Enter moves. A click chooses a row and keeps focus in the search, and the main button names the choice ("Move to Board cards — bottom"). "Keep it face up (piles only)" applies to piles only.
  - **No match:** nothing moves.
- **In the viewer:** a **Move to…** button next to To table, and the **M** key on a card. After a move, focus goes to the next match. Cancelling returns focus to the same card.
- **Bug fixed during the build:** React passes a nested `<dialog>`'s `close` event up to its parents, so closing the Move dialog also closed the viewer. The viewer now only acts on its own `close`. A regression test covers it; I confirmed it fails without the fix.
- **Option names** come from their content, with a real space between the label and the note. With an `aria-label`, axe's label-in-name check joined the flex items without a space and failed.
- Tests: 209 unit (`SP-8 move destinations`, `SP-8 Move to… dialog`, `SP-8 Move to… from the pile viewer`), and 23 E2E including `e2e/move-dialog.spec.ts` (mouse, keyboard only, Esc closes only the Move dialog, axe with it open, and phone size at 375 × 667).
- Checked by hand from screenshots at 1280 × 800 and 320 × 640.
- CLAUDE.md's rule to watch each PR's activity went in its own PR (#16), as the owner asked.

### Phase 2f: Pile viewer (2026-10-26)

- `src/components/pileFilter.ts` (SP-7) has pure helpers:
  - `pileEntries` lists a pile's cards top first, with their position.
  - `filterColumns` offers a filter for `type` and for every other column with 2 to 12 different values. It never offers the free-text columns (`text`, `rules`, `rules text`), and sorts values naturally (2 before 10).
  - `filterEntries` keeps deck order. Search matches the name and every column, ignoring case and surrounding spaces.
- `PileViewer` (SP-7, SP-8) is a native modal sheet from the right, up to 720px wide, following the PileViewer board:
  - **Header:** a top edge in the seat colour, the seat shape, the pile name, "N cards · shown face up to you only", and a close button.
  - **Filters:** a search field with a Clear button, then one native `<select>` per filter column.
  - **Status line:** "4 of 24 match "ember" · Faction: Ember", with Clear all.
  - **Results:** a grid of 150px cards, each with "#N from top".
  - **Footer:** Shuffle, Draw top card and Reveal top card.
  - Each card is a transparent button over a decorative face, like the pile tiles. Its name is the full card text plus "#N from top".
  - Only the current card is in the tab order (roving tabindex), and only it shows **To hand** and **To table**.
  - **Keyboard:** arrows and Home/End browse, Enter sends the card to hand, T to the table. ↓ from the search goes to the results, and ↑ from the first row goes back to the search.
  - **After a move:** focus goes to the next match, then the previous one, then the search.
  - **No hand:** To hand and Draw top card say "<seat> has no hand." when the active seat has none.
  - **Announcements:** the viewer has its own live region, because the page's region sits outside the modal.
  - **Phones:** height uses `100dvh`, and the results scroll while the footer stays visible. At 320px wide the grid has one column; from about 340px it has two.
- **Opening the viewer:** a new **View cards…** menu item (after Mill cards…, shortcut V), or V on a focused pile.
- `cardFaceLabel` is exported from `CardFace`. Card labels now include the cost ("Cost 2"), in the order the card shows it.
- **Acceptance** (SP section): in the 58-card deck, open the viewer, search "Card 37", then To table. That's three actions, by mouse and by keyboard (V, type, ↓, T).
- Tests: 197 unit (`SP-7 pile viewer search and filters`, `SP-7 pile viewer`, `SP-8 move a card from the pile viewer`, `SP-6 pile viewer footer`), and 20 E2E including `e2e/pile-viewer.spec.ts` (mouse, keyboard only, axe while filtered, and phone size at 375 × 667).
- Checked by hand from screenshots at 1280 × 800 and 320 × 640, with no sideways scrolling.

### Phase 2e: Pile management (2026-10-26)

- `validatePileName(state, name, exceptPileId?)` in `src/actions/piles.ts` returns the reason a name can't be used. The dialogs show it, and the actions throw it, so they always agree.
- The store gains `announce(text)`, for things that aren't game changes. Draw and D now announce "Player 1 has no pile to draw from." when the active seat owns no pile.
- `Form.css` holds the shared dialog form styles (field, label, input, error, radio choices). `PileCountDialog` now uses it.
- **Add pile:**
  - A plain button sits after the pile row (`.pile-area` wraps the list and the button, so the list contains only piles).
  - `PileNameDialog` asks for a name and an owner: any seat, including Environment, or Shared. It defaults to the active seat.
  - Focus moves to the new pile.
- **Rename…:** `PileNameDialog` opens with the name selected. A pile can change the case of its own name. Focus stays on the pile.
- **Delete…:** `DeletePileDialog` always asks, because there's no undo yet.
  - A pile with cards also asks where they go (radio list), and they go to the bottom of that pile.
  - Delete… is disabled when the pile has cards and there's no other pile.
  - Focus moves to the next pile, or to Add pile if none are left. Cancelling keeps focus on the pile.
- Focus after adding or deleting uses a pending-focus ref that an effect applies after render, because the new or next tile only exists once the page has updated.
- Tests: 182 unit, and 16 E2E including `e2e/manage-piles.spec.ts`. They cover mouse and keyboard paths, duplicate and blank names, focus after each action, and axe on every dialog.

### Phase 2d: Pile actions (2026-10-26)

- `Dialog` (`src/components/Dialog.tsx`) is a shared native modal following `MoveDialog`. It has:
  - an eyebrow and title, a close button, and a footer with a hint, an optional Cancel, and a main button
  - `onSubmit` to turn it into a form, where Enter submits
  - `data-autofocus` to choose which element gets focus first
  - the phone-size fix from PR #11 built in
  - `ImportResults` now uses it, and `ImportResults.css` keeps only the results styles.
- `PileCountDialog` handles **Draw cards…** and **Mill cards…** (SP-6).
  - It has a number field from 1 to the pile size, with an inline error.
  - Mill also has a radio list of the other piles.
  - The game screen gives each request its own `key`, so every opening starts fresh.
- The pile menu adds **Draw cards…**, **Shuffle**, **Reveal top card** and **Mill cards…**.
  - Items that can't run are `aria-disabled`: on an empty pile, Shuffle with fewer than two cards, and Mill with no other pile.
- **Drop a CSV on a pile (SP-1):**
  - The pile gets a 3px accent ring and a "Drop to load" label, and the file loads with that pile's Keep CSV order setting.
  - A file that isn't a CSV is reported instead of loaded.
  - A file dropped elsewhere on the page doesn't make the browser navigate away to open it.
- **Bug fixed during the build:** a dialog's `close` event can arrive a moment after Done. When it did, `closeResults` pulled focus back to the pile even if you had already opened a menu, which closed the menu.
  - Focus now returns to the pile only if it was lost (on the page body or inside the closed dialog).
  - A regression test covers it; I confirmed it fails without the fix.
- Tests: 163 unit, and 14 E2E including `e2e/pile-actions.spec.ts`. They cover mouse and keyboard paths, axe with the count dialogs open, and dropping a file.

### Phase 2c: Game screen and pile loading (2026-10-25)

- **Zustand 5.0.16** (in the approved stack). `src/store/gameStore.ts`:
  - `createGameStore(game, context)` holds `{ game, announcement, dispatch }`.
  - `dispatch(action)` runs any 2a or 2b action, stores the result and returns it.
  - `GameStoreProvider` and `useGameStore` connect it to React; tests inject a store with the seeded context.
- `LiveRegion`: a polite `role="status"` region. It's keyed by announcement id, so the same text twice is read twice (AR-2).
- `GameScreen` replaces the temporary import panel. It follows `Main`, simplified until Phase 3:
  - a header and a seat bar showing which seat is active
  - a table area with piles in a row and an "On the table" grid
  - the active seat's hand tray
- `PileTile` (SP-5) has two edge layers and a seat-patterned back with a name and count plate. An empty pile shows a dashed outline. A revealed top card shows its face.
  - The card back or face is a decorative layer under the button, and the button holds only the plate text. Its `aria-label` always starts with the visible text, as WCAG 2.5.3 (label in name) requires.
- `Menu` is a reusable ARIA menu following `ActionMenu`: arrow keys, Home and End, Enter, Escape or Tab to close, and checkbox items.
  - It ignores presses inside its own container, so clicking the opener toggles it closed.
  - Shortcut keys use `aria-keyshortcuts`, and the visible key label is hidden from screen readers.
- `PileMenu` (SP-1, SP-2, SP-3, SP-6) has Load CSV…, Reload <file>…, Keep CSV order and Draw 1. 2d adds the rest.
- `CardFace` is the default face, at `Card.dc.html`'s 240 × 336 base size scaled to width, in the sample card's neutral palette.
  - It shows name and `cost`, the art (`CardArt` with a new `decorative` option), `type`, text from `text`, `rules` or `rules text`, and `stats`.
- `HandTray` (FS-3, SP-6) has a seat-coloured top edge and the hand's cards. Draw and the D key draw from the active seat's first pile. D is ignored in fields, in menus, in open dialogs and with modifier keys.
- `seatIdentity` (`src/components/seatIdentity.ts`) gives Player 1 the design's first seat (triangle, stripes) and Environment its own (square, fine rules). Player 2 gets the circle and dots. Shared piles get a neutral diamond with a hatched back.
- `ImportResults` now shows the target pile and any shortfalls.
- Tests:
  - 142 unit tests (component tests for CardFace, PileTile, Menu, HandTray, the store and the game screen).
  - 8 E2E tests, including load, draw and the menu by mouse and by keyboard only, with axe on the screen, with the menu open and with the dialog open.
- Checked by hand: the empty state, a loaded deck with drawn cards, the menu, and 320px wide (no sideways scrolling).
- Owner review: the import results dialog was too short to read on the owner's phone. I couldn't reproduce it in emulated iPhone sizes (WebKit and Chromium).
  - Made the CSS robust anyway: the scrolling body uses `flex: 1 1 auto` instead of a 0% basis, which some mobile Safari versions collapse, and the dialog's height limit uses `100dvh`.
  - Added a phone-size E2E regression test.

### Phase 2b: Moves and pile management (2026-10-25)

- `src/actions/moveCard.ts` (SP-8):
  - `moveCard` moves a card to the table, a seat's hand, or the top or bottom of a pile. Cards left behind keep their order.
  - A card lands face up on the table and face down on a pile, unless `faceUp` is set. In a hand its face doesn't change.
  - A move to where the card already is (table to table, or the same hand) changes nothing and says so.
  - `locateCard` finds which zone a card is in.
- `src/actions/peek.ts` (SP-9):
  - `peekTop` is a read, not an action: it returns the top N cards and an announcement.
  - `reorderTop` puts the top N back in a new order, and must be given exactly those cards.
  - Moving a peeked card uses `moveCard`.
- `src/actions/piles.ts` (SP-4):
  - `addPile` adds a pile owned by a seat or shared, and returns its `pileId`. `renamePile` renames one.
  - Names must be unique, ignoring case and surrounding spaces.
  - `deletePile` needs a target pile if the pile still has cards. They go to the target's bottom, in order. Cards elsewhere stay in play.
- `src/actions/testing.ts` now has `gameWithDeck` and `namesOf`.
- 24 new tests (116 in total), grouped as `SP-8 move a card`, `SP-9 peek` and `reorder`, and `SP-4 add`, `rename` and `delete a pile`.

### Phase 2a: Game state and pile actions (2026-10-25)

- `src/model/random.ts` (AR-3):
  - `cryptoRandomInt` uses `crypto.getRandomValues` and rejects values from the uneven tail of the range, so every result is equally likely.
  - `seededRandomInt` (mulberry32) gives repeatable results for tests only.
- `src/model/shuffle.ts`: Fisher–Yates `shuffled(items, randomInt)`.
- `src/model/game.ts` defines the state: `seats`, `activeSeatId`, `definitions`, `cards` (one per physical copy), `piles` (card ids top first, `sourceName`, the pile's `definitionIds`), `hands` per player seat, and `table` (a list until Phase 3).
  - `ActionContext` holds `{ randomInt, newId }`. Every action returns `{ state, announcement }` (AR-1, AR-2).
  - `createSoloGame()` fixes the Solo PvE preset in code until Phase 5: Player 1 and Environment, with P1 main deck, Environment deck and Board cards.
- `src/actions/loadPile.ts` (SP-3 and CD-5 in play):
  - It loads one copy per `qty` and shuffles unless `keepOrder` is set.
  - Reloading follows the agreed rule: copies outside the pile are never touched, and the pile adds or removes its own copies so the game total matches the new `qty`. New copies are shuffled in, or go to the bottom with `keepOrder`. Existing order is kept, and extra copies are removed from the bottom.
  - Copies it couldn't remove come back as `shortfalls` for the import results.
- `src/actions/pileActions.ts` (SP-6):
  - `shuffle` turns every card face down.
  - `draw(n)` moves cards to the active seat's hand and names them in the announcement.
  - `revealTop`
  - `mill(n)` deals cards one at a time onto another pile.
  - Empty piles produce an announcement, not an error.
- Tests:
  - Grouped as `AR-3 random source`, `SP-6 shuffle (Fisher–Yates)` (including the uniformity acceptance test: 60,000 shuffles, chi-square < 35), `SP-3 load a pile`, `CD-5 reload into a pile in play`, `SP-6 draw/reveal/mill` and `AR-1 actions are pure`.
  - `src/actions/testing.ts` provides the seeded context.

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

- **Phase 3 (Table)**, after the owner's go-ahead. Start by proposing a split into one-session issues. Open problems already noted for Phase 3:
  - the face state needs three values (front, back, face down)
  - cards whose definition is `missing`
  - choosing the dark theme
  - a back face lost on re-import
- From Phase 3 on, the table's card menu can reuse `MoveDialog`.

## Open problems

- The search-match highlight uses the board's `#FBE3A6` with ink text, which isn't a token. Add a highlight token if the design gets one.
- axe's label-in-name check joins text from separate blocks with no spaces, so a button containing a whole card face fails it. The viewer avoids that with the overlay pattern. Keep it in mind for table cards in Phase 3.
- In this cloud environment the pinned `@playwright/test` wants a newer Chromium than the one installed. Local E2E ran with a scratch config pointing `launchOptions.executablePath` at `/opt/pw-browsers/chromium`. That config isn't committed, and CI is unaffected.
- The form error colour uses `--seat-a` (5.4:1 on the panel), because the tokens have no error colour. Add an error token if the design gets one.
- **Reload is two clicks, not one:** "Reload <file>…" reopens the file picker, because browsers can't re-read a chosen file. A true one-click reload needs the File System Access API, which works in Chromium only and falls back to the picker elsewhere. That fits with Phase 6, where the file handle can be saved with the game.
- The default card face uses the UI font, not the sample card's Bitter, which would be another font dependency. Phase 4 layouts will set card fonts.
- The shared-pile back colour `#3F433D` isn't a design token. The design has no shared seat, so add a token if the design gets one.
- For Phase 3 (TT-6): face state is a boolean `faceUp`. Flipping a double-faced card to show its back needs a three-way state (front, back, face down), which Phase 3 should introduce.
- Dark theme isn't wired up. `tokens.css` has `[data-theme="dark"]` values, but nothing sets `data-theme` yet. Decide how the theme is chosen (follow the system setting, a toggle, or both) when the table is built.
- PR preview clean-up leaves an empty `pr-preview/pr-N/.nojekyll` on `gh-pages`. It's harmless (the URL returns 404), but it could be tidied later.
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
| 2026-10-25 | Solo PvE seats and piles fixed in code until Phase 5 | A single seat and pile | Gives draw a real active seat and hand, and Phase 5 adds the format picker on top |
| 2026-10-25 | Reloading a pile in play: only that pile's copies change, to match the new `qty`. Existing order is kept, new copies are shuffled in (or go to the bottom with keep-order), and extras are removed from the bottom. | Rebuilding the pile from scratch | Never disturbs cards in play or the pile's order. Copies that can't be removed are reported. |
| 2026-10-25 | Draw and mill announce the card names | Counts only | The person drawing sees the cards, so screen-reader users should hear them too |
| 2026-10-25 | Deleting a pile that still has cards moves them to the bottom of a chosen pile | Removing the cards from the game | No card silently leaves play |
| 2026-10-25 | Cards land face up on the table and face down on a pile (unless kept face up); a hand doesn't change their face | Keeping the card's previous face | Matches the MoveDialog's "Keep it face up (piles only)" option |
| 2026-10-25 | Pile names are unique, ignoring case and surrounding spaces | Allowing duplicate names | Destination lists such as Move to… must not show two piles with the same name |
| 2026-10-25 | Phase 2 re-split: 2c game screen and loading, 2d pile menu actions, 2e viewer, 2f peek | The original 2c covering every pile action | Keeps each PR reviewable |
| 2026-10-25 | Default card face columns: `cost`, `type`, the first of `text`, `rules` or `rules text`, and `stats` | Showing every column | Matches the sample card until Phase 4 layouts |
| 2026-10-25 | Seat identities: Player 1 gets the first design seat, Environment the environment one, and shared piles a neutral back | Using the design's seat names | Keeps the design's shape, colour and pattern system with our seat names |
| 2026-10-25 | Pile tiles: a fixed `aria-label` on a button that holds only the plate text, with the card art as a layer underneath | A name computed from visible text | Computed names differ between browsers and jsdom. This way the label always contains the visible text (WCAG 2.5.3). |
| 2026-10-25 | The D shortcut checks the page for an open dialog or menu, not React state | Gating on component state | State can lag the native dialog's close event, which drops a D pressed straight after Esc |
| 2026-10-26 | Pile management split into its own issue (2e); viewer and peek become 2f and 2g | One large 2d | Keeps each PR reviewable |
| 2026-10-26 | One shared `Dialog`, with `ImportResults` moved onto it | A separate dialog for each use | Every dialog gets the same focus, Escape and phone-size behaviour |
| 2026-10-26 | Draw N and Mill N use a dialog with a number field | A submenu of preset numbers | Allows any number, and is easier by keyboard and screen reader |
| 2026-10-26 | After a dialog closes, focus goes back to the pile only if it was lost | Always moving focus to the pile | The close event can arrive late, after the player has already moved on |
| 2026-10-26 | Draw with no pile to draw from stays enabled and announces why | Disabling Draw | Explains what's wrong instead of leaving a dead button |
| 2026-10-26 | New piles can belong to any seat, including Environment, or be shared | Player seats only | Matches the Solo PvE preset, which already has an Environment deck |
| 2026-10-26 | Deleting a pile always asks first | Deleting straight away | There's no undo until Phase 3 |
| 2026-10-26 | Move to… split from the viewer into 2g; Peek becomes 2h | One 2f covering all of SP-8 | Move to… is its own dialog that Phase 3 reuses, and the viewer alone filled a session |
| 2026-10-26 | Viewer filters are native `<select>`s, one per column with 2 to 12 values. Search covers every column. | Custom listbox dropdowns as on the board | Native selects work better on iOS and with screen readers. Search still covers long text columns, so any column can be filtered. |
| 2026-10-26 | Opening the viewer by mouse is the pile menu, then View cards…, and counts as one action | A one-click View button on the tile | The owner confirmed the two clicks are fine |
| 2026-10-26 | View cards… sits after Mill cards…, not first in the menu | First item | On an empty pile, Load CSV… should get first focus, and the viewer has V for speed |
| 2026-10-26 | Viewer cards are transparent buttons over a decorative face, named with the full card text and position | A button wrapping the face with a short label | Keeps visible text in the name (WCAG 2.5.3) and passes axe. Screen-reader users hear the card text. |
| 2026-10-26 | Move to… lists the Table as its own group, above Hands and Piles | Hands and Piles only, as on the board | Phase 3 reuses the dialog for cards in hands, where the table matters. The owner confirmed it. |
| 2026-10-26 | A click on a Move to… row chooses it, and the main button (or Enter) moves | Moving on a single click | Matches the board's footer button that names the choice, and leaves time to tick "Keep it face up" |
| 2026-10-26 | The rule to watch PRs went in its own PR | Bundling it into 2g | The owner asked for a separate PR |
| 2026-10-26 | Every PR updates progress.md, written as it will read after the merge | Updating only at the end of a session; writing "in review" | `main` stays correct the moment a PR merges. The owner asked for it, and it's recorded in CLAUDE.md. |
| 2026-10-26 | Peek: Done, Esc and × all keep the order shown. The count starts at 3. | Esc cancelling the reorder; starting at 1 | What you see is what's in the pile. 3 matches the sample card. The owner confirmed both. |
| 2026-10-26 | Peek reorders inside the dialog and puts the cards back with one `reorderTop` when it closes | One reorder action for every Up or Down | One action and one announcement for the whole rearrangement. Moves still apply at once. |
| 2026-10-26 | Peek's Move to… leaves out the peeked pile's top | Offering every destination | It duplicates reordering, and would put the card back among the cards being reordered |
