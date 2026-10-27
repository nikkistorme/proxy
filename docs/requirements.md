# Proxy — Requirements

Oct 25, 2026 · @Nikki

## Overview

Proxy is a browser-based tabletop for playtesting an in-development card game: load cards from CSV files, render them through editable layouts, and play them freely on a drag-and-drop table.

**Primary user:** one designer playtesting their own game, controlling every seat from one screen.

**Goals**

- Go from an edited CSV to cards on the table in under a minute.
- Change anything mid-game (piles, card positions, layouts) without restarting.
- Make every action available without a mouse, to WCAG 2.2 AA.
- Run entirely in the browser as a static site, with no accounts or server.

**Non-goals**

- Rules enforcement. The app is a sandbox; players apply the rules.
- Online or networked multiplayer.
- Print-and-play export (possible later, see Out of scope).

## Formats and seats

A format is a preset that defines the seats at the table and the piles each one starts with. One person drives every seat.

| Format | Seats | Starting piles |
| --- | --- | --- |
| Solo PvE | Player 1, Environment | P1 main deck, Environment deck, Board cards |
| Co-op PvE | Player 1, Player 2, Environment | P1 main, P2 main, Environment deck, Board cards |
| 1v1 PvP | Player 1, Player 2 | P1 main, P2 main, Board cards |

**Requirements**

- FS-1: Ship the three presets above.
- FS-2: Users can edit a preset (rename seats, add or remove piles) and save it as a new format.
- FS-3: Each player seat has its own hand. A seat switcher changes which hand is shown in the hand tray.
- FS-4: Each seat has its own counters (for example, life and resources). Counter names and starting values are set per format.

**Acceptance criteria**

- [ ] Starting a 1v1 PvP game creates two seats, two empty hands and three empty piles.
- [ ] Switching seats swaps the hand tray in one action, by click or keyboard shortcut.

## Card data

Each deck is its own CSV file. The file is loaded into a pile, so no column says which deck a card belongs to.

| Column | Required | Purpose |
| --- | --- | --- |
| `name` | Yes | Card name; also the art's alt text |
| `image` | No | URL of the card art |
| `qty` | No | Copies in the deck; defaults to 1 |
| `layout` | No | Name of the layout to render with |
| `type` | No | Fallback for choosing a layout when `layout` is blank |
| `id` | Only for double-faced cards | Stable identifier for the front face |
| `back_of` | Only for back faces | The `id` of the front face this row belongs to |
| Any other column | No | Free-form; can be bound to a layout slot |

**Requirements**

- CD-1: Parse CSV with a header row, quoted fields, commas and line breaks inside quotes, and UTF-8 text.
- CD-2: Treat column names as case-insensitive and trim surrounding whitespace.
- CD-3: A row with `back_of` attaches to its front as the second face and is not added to the deck as its own card.
- CD-4: Report import problems in a list the user can read: row number, column and what is wrong (missing `name`, `back_of` pointing at an unknown `id`, unparseable `qty`). Valid rows still import.
- CD-5: Re-importing a CSV into the same pile updates every copy of those cards already in play, matched by `id`, else by `name`. Card positions, rotation, counters and face state stay as they were.
- CD-6: A missing or failed image shows a placeholder with the card name. It never breaks the layout.

**Acceptance criteria**

- [ ] A 60-row CSV with two double-faced pairs imports as 58 cards, two of them with a back face.
- [ ] Changing a card's rules text in the CSV and re-importing updates the card on the table without moving it.

**Loading from a published Google Sheet**

A pile can read its CSV from a Google Sheet published to the web, so card edits in the sheet reach the table with one click. Each sheet tab is published separately, so one tab is still one deck.

- CD-7: A pile's source can be a URL instead of a file. Accept Google Sheets' published-CSV link (File → Share → Publish to web, format CSV), which looks like `docs.google.com/spreadsheets/d/e/…/pub?gid=…&output=csv`. Any other public URL that returns CSV also works.
- CD-8: If the user pastes a normal edit or share link, don't try to read it. Show a short how-to for publishing the tab as CSV instead.
- CD-9: Fetch on load and on "Reload". Show when the data was last fetched, and note that Google can take a few minutes to update published data after an edit.
- CD-10: Reloading from a URL follows the same update rules as re-importing a file (CD-5).
- CD-11: If a fetch fails (offline, unpublished, blocked), show what went wrong and keep the last good data. The URL and last fetched data save with the game, so a saved game opens offline.
- CD-12: A format can store a default source URL per pile, and a "Reload all" control refreshes every URL-backed pile at once.

**Acceptance criteria**

- [ ] Editing a card's text in the sheet, then clicking Reload once the published data updates, changes the card on the table without moving it.
- [ ] Pasting an edit link shows the publishing how-to and makes no request.
- [ ] E2E tests mock the sheet responses; CI never calls Google.

## Layouts

A layout is a reusable card template: a set of boxes on the card, each bound to a CSV column. Every card is the same physical size, MTG standard (63 × 88 mm, portrait).

**Orientation.** A layout is either portrait or landscape. A landscape layout arranges its content on an 88 × 63 mm canvas turned 90° on the portrait card, so the card comes onto the table portrait and is read by rotating it.

**Requirements**

- LY-1: Create, rename, duplicate and delete layouts.
- LY-2: Add boxes by drawing them on the card. Move and resize them with pointer or keyboard (arrow keys move, Shift + arrow resizes).
- LY-3: Each box binds to one column and renders it as text or as an image.
- LY-4: Text boxes set font size, weight, alignment, text color and background color. Text that overflows shrinks to fit down to a minimum size, then clips with a visible warning in the editor.
- LY-5: Boxes can also hold fixed text or a solid color, for frame elements that don't come from the CSV.
- LY-6: Box positions are stored as percentages of the card, so layouts render at any zoom.
- LY-7: The editor shows a live preview using real cards from a loaded CSV, with next and previous controls.
- LY-8: Choose the layout for a card by its `layout` column, then by a type-to-layout mapping, then a built-in default layout.
- LY-9: Layouts save in the browser and export to and import from a JSON file.
- LY-10: Editing a layout re-renders every card using it, including cards on the table.

**Acceptance criteria**

- [ ] A user builds a layout with art, name, cost and rules-text boxes in under five minutes without documentation.
- [ ] Exporting layouts, clearing browser data and importing the file restores them exactly.

## Setup and piles

Setup only fills piles; nothing is placed on the table automatically. The user pulls cards out of piles as the game calls for it.

**Setup**

- SP-1: Pick a format, then load a CSV into each of its piles by file picker, by dropping the file on the pile, or from a published Google Sheet URL (CD-7).
- SP-2: Remember the last file name per pile and offer "Reload" for a quick re-import.
- SP-3: Shuffle each pile on load, with an option to keep CSV order.

**Piles**

- SP-4: Users can add, rename, delete and merge piles during a game, owned by a seat or shared. Merging deletes one pile and puts its cards on the top or bottom of the other.
- SP-5: A pile shows its name, card count and top card (face-down by default).
- SP-6: One-click actions: shuffle, draw 1, draw N to the active seat's hand, reveal top card, and mill N to another pile. A click or tap on a pile draws 1. Right-click, Enter, or a touch held and let go opens the pile's menu with the rest.
- SP-7: Open any pile at any time in a viewer that shows every card face-up, with search by name and filter by any column.
- SP-8: From the viewer, move a card to the table, a hand, the top or bottom of any pile. Order inside the pile is kept unless shuffled. A card can also be dragged out of the viewer onto the table, a hand or the top of a pile; the viewer steps aside during the drag and comes back afterwards.
- SP-9: Peek at the top N cards and reorder or move them before closing.

**Acceptance criteria**

- [ ] Finding a named card in a 60-card deck and putting it on the table takes three actions or fewer.
- [ ] Shuffle produces a uniform random order (Fisher–Yates with a cryptographic random source).

## Tabletop

The table is a free-form surface with no fixed rows, zones or snapping. Locations and other board cards are ordinary cards the user places and rearranges at will.

**Table**

- TT-1: Pan by dragging empty space or with arrow keys; zoom with wheel, pinch, or + and −. A "fit all" control frames every card.
- TT-2: Optional, toggleable grid snapping for tidy placement. Off by default.
- TT-3 (after V1, #29): Select one card or many (click, Shift-click, marquee). Group actions apply to the selection.

**Cards**

- TT-4: Drag cards between the table, hands and piles, and drag piles to move them on the table. Cards come off a pile by drawing, Move to…, or dragging them out of the pile viewer, not by dragging the pile itself. Piles never overlap: dropping or placing a pile on another pile asks which pile is deleted and whether its cards go on the top or bottom of the other, and Cancel leaves both where they were. Cards may overlap piles and each other.
- TT-5: Rotate in 90° steps, clockwise or counter-clockwise.
- TT-6: Flip: a double-faced card shows its other face; a single-faced card turns face-down.
- TT-7 (after V1, #30): Stack cards by dropping one on another; a stack moves as one and can be fanned out.
- TT-8: Add named numeric counters to any card on the table (for example, +1/+1 or damage), adjustable with buttons or keys. A new counter starts at 1, names are unique on a card, and values are whole numbers that can go below zero. Counters stay with a card while it moves on the table and are copied by Duplicate, but are cleared when it leaves the table.
- TT-9: Enlarge a card on hover (after 400ms), with the I key, or from the card's menu, which a long-press opens. It's readable at full size regardless of table zoom and sits beside the card, never over it. A double-faced card shows one face at a time, with a button that flips the preview (not the card). Cards turned on the table, and landscape layouts once they exist, are shown upright in the enlarged view. A face-down card can't be enlarged.
- TT-10: Change the z-order: bring to front, send to back.
- TT-11: Duplicate a card on the table (for tokens and quick tests) and delete it.

**Hands and table tools**

- TT-12: A hand tray along the bottom shows the active seat's hand; cards can be reordered.
- TT-13: Seat counters (life, resources) always visible, editable with buttons or keys.
- TT-14: Dice (d4, d6, d8, d10, d12, d20) and a coin, with results announced and shown in a short roll log.
- TT-15: Undo and redo every game action, at least 200 steps.

**Acceptance criteria**

- [ ] Every action in TT-4 to TT-15 can be completed with keyboard alone.
- [ ] Undo after a shuffle restores the previous order exactly.

## Persistence

All data stays in the user's browser, with file export as the durable backup.

- PS-1: Autosave the current game, layouts and formats to IndexedDB after every change, debounced to at most once per second.
- PS-2: Reopening the app restores the last game exactly, including undo history for the current session.
- PS-3: Save named game snapshots and load them later (for example, "Turn 4, before combat").
- PS-4: Export and import a single JSON bundle containing cards, layouts, formats and the game state.
- PS-5: Version the saved data format and migrate older saves on load.
- PS-6: If storage is unavailable (private window, blocked site data), the app still works and shows a one-line notice that progress won't be saved.

**Acceptance criteria**

- [ ] Closing the tab mid-game and reopening it restores every card position, rotation, counter and pile order.
- [ ] A bundle exported from version N loads in version N+1.

## Accessibility

Target: WCAG 2.2 Level AA across the whole app, including the layout editor. Dragging is never the only way to do anything.

**Requirements**

- A11Y-1 (2.5.7 Dragging Movements): every drag has a single-pointer and keyboard alternative. Select a card, choose a destination (table position, hand, pile, top or bottom), confirm.
- A11Y-2 (2.1.1 Keyboard, 2.1.2 No Keyboard Trap): every control and card is reachable and operable by keyboard. Focus never gets stuck in the table or a dialog.
- A11Y-3: The table is one focusable region. Inside it, arrow keys move focus between cards by position, and Tab leaves the region (roving tabindex).
- A11Y-4: Keyboard shortcuts for frequent actions (draw, rotate, flip, shuffle, undo). Single-key shortcuts meet 2.1.4 Character Key Shortcuts: they work only while their card, pile or region has focus, or they can be turned off. A shortcut reference opens with ?. Remapping shortcuts comes after V1, with the control settings (#53).
- A11Y-5 (4.1.3 Status Messages): announce every game action in a polite live region, for example "Draw: Ember Scout to Player 1's hand. Deck: 41 cards."
- A11Y-6: Each card has an accessible name that includes its name, face state and rotation, for example "Ember Scout, rotated 90°". A details command reads every bound column. Face-down cards announce only "face-down card".
- A11Y-7 (2.4.7, 2.4.11): a clearly visible focus indicator on cards and controls that is never fully hidden behind other cards.
- A11Y-8 (2.5.8 Target Size): interactive targets at least 24 × 24 CSS px at default zoom.
- A11Y-9 (1.4.3, 1.4.11): text and controls meet contrast minimums in both light and dark themes. The layout editor warns when a text box fails contrast against its background.
- A11Y-10: honor `prefers-reduced-motion` for shuffles, flips and card movement.
- A11Y-11: the app works at 200% browser zoom and reflows its panels at 320 CSS px width (1.4.10). The table itself may scroll in two dimensions, which is an allowed exception.

**Acceptance criteria**

- [ ] A complete solo game turn (draw, play a card to a location, rotate it, add a counter, undo) can be done with keyboard and screen reader alone in NVDA + Firefox and VoiceOver + Safari.
- [ ] Automated axe checks pass with zero violations on every screen.
- [ ] A manual audit against WCAG 2.2 AA produces an accessibility conformance report (VPAT format) with no failing criteria.

## Performance

The stress case is a full 1v1 table: 2 × 60-card decks, a 40-card environment or board pile, and 80 cards in play with art.

| Metric | Budget | Measured on |
| --- | --- | --- |
| Largest Contentful Paint | ≤ 2.5 s | Demo page, Lighthouse mobile profile |
| Interaction to Next Paint | ≤ 200 ms | Any action on the stress table |
| Cumulative Layout Shift | ≤ 0.1 | Load and CSV import |
| Drag frame rate | 60 fps sustained | Dragging a 10-card stack, mid-range laptop |
| JavaScript, initial load | ≤ 150 KB gzipped | Production build |
| CSV import of 200 rows | ≤ 300 ms to cards in pile | Excluding image downloads |
| Lighthouse Performance score | ≥ 90 | Demo page, mobile |

**Requirements**

- PF-1: Card art is lazy-loaded, decoded off the main thread, and cached after first load.
- PF-2: Dragging uses CSS transforms only and doesn't re-render cards that aren't moving.
- PF-3: The layout editor and pile viewer are code-split and load on first use.
- PF-4: A performance check runs in CI against the demo build and fails the build when a budget is exceeded.

## Testing and CI/CD

The app ships with a full automated test suite that runs on every pull request; nothing merges or deploys unless it passes.

**Test layers**

| Layer | Tool | What it covers |
| --- | --- | --- |
| Unit | Vitest | Pure logic: CSV parsing and validation, shuffle, layout selection, action reducers, undo/redo, save migrations |
| Component | Vitest + Testing Library | Pile viewer, hand tray, layout editor controls, dialogs; queried by role and accessible name |
| End-to-end | Playwright (Chromium, Firefox, WebKit) | Full user flows against the production build |
| Accessibility | @axe-core/playwright | Automated WCAG checks on every screen and open dialog in the E2E suite |
| Performance | Lighthouse CI | Budgets from the Performance section |

**Requirements**

- QA-1: Every requirement ID in this doc has at least one automated test or a documented manual check. Tests name the requirement they cover (for example, `describe('SP-6 shuffle')`).
- QA-2: Coverage thresholds of 85% lines and branches for `src/model/`, `src/actions/` and `src/csv/`. CI fails below the threshold. UI code is covered by component and E2E tests instead.
- QA-3: Tests are deterministic: randomness uses the injectable source (AR-3) with a fixed seed, and storage uses a fresh in-memory or test-scoped IndexedDB.
- QA-4: Test fixtures live in `tests/fixtures/`: valid CSVs, CSVs with each import error, a double-faced pair, layouts and a saved game bundle.
- QA-5: E2E tests cover at least these flows, each run once by mouse and once by keyboard only: import a deck, shuffle and draw, find a card in a pile and place it, rotate and flip, add a counter, undo, save and reload, export and import a bundle, build a layout.
- QA-6: Playwright records a trace and screenshot on failure, attached to the CI run.
- QA-7: Bugs fixed during development get a regression test in the same PR.

**CI/CD pipeline (GitHub Actions)**

1. On every pull request: install with a locked lockfile, then type-check, lint, unit and component tests with coverage, production build.
2. Same pull request: run E2E and axe tests in all three browsers against the built app, then Lighthouse CI against budgets.
3. Deploy a preview of the PR build and post its link on the PR.
4. Branch protection on `main` requires every check above to pass before merge.
5. On merge to `main`: rebuild, run the full suite again, and deploy to production (GitHub Pages or Netlify).
6. On a version tag: publish a GitHub release with notes from `CHANGELOG.md`.

**Acceptance criteria**

- [ ] A PR that breaks shuffle, an E2E flow or an axe rule shows a failed check and cannot be merged.
- [ ] The full pipeline finishes in under 10 minutes for a typical PR.
- [ ] `npm test` and `npm run test:e2e` run the same suites locally as CI.

## Tech stack and architecture

A static single-page app: Vite, React and TypeScript, deployable to any static host.

&#91;embedded content: data flow · inputs, actions, store, outputs\]

Pointer, keyboard and import all call the same actions, which is what keeps the keyboard path and screen-reader announcements in step with mouse play.

| Concern | Choice | Why |
| --- | --- | --- |
| Build | Vite | Fast dev loop; static output |
| UI | React 18 + TypeScript (strict) | Familiar stack; typed card and layout models |
| State | Zustand with an action log | One store for game state; undo, redo and autosave fall out of the log |
| CSV | Papa Parse | Handles quoting, line breaks and encodings |
| Storage | IndexedDB via `idb-keyval` | Larger quota than localStorage; async |
| Table movement | Custom pointer events + CSS transforms | Free-form placement with full control; keyboard moves call the same actions |
| Testing | Vitest, Testing Library, Playwright, axe-core | Unit, component, end-to-end and accessibility checks |
| Hosting | GitHub Pages or Netlify | Free, static, public URL for the portfolio |

**Architecture rules**

- AR-1: Every change to game state goes through a named action (for example `moveCard`, `shuffle`, `flip`). Pointer, keyboard and menu input all call the same actions.
- AR-2: Actions produce the live-region announcement text, so screen-reader output can't drift from what happened.
- AR-3: Random numbers come from an injectable source, so tests can shuffle deterministically.
- AR-4: Card data, layouts and game state are separate models. A card instance on the table references its card definition and layout by id.
- AR-5: No network calls except loading card art from the URLs in the CSV and fetching CSVs from URLs the user enters (CD-7).

## Demo sample data

The public demo ships with an original, generic sample game so the designer's own game stays private until they choose to share it.

- DM-1: Include two player decks (about 30 cards each), one environment deck and about 6 board cards, each as its own CSV.
- DM-2: Include three layouts: a portrait creature-style card, a portrait action card and a landscape location card.
- DM-3: Include at least one double-faced card.
- DM-4: Art is original or openly licensed (for example CC0), bundled with the app, with credits listed in the repo.
- DM-5: A "Load demo" button on the start screen sets up a Co-op PvE game in one click.
- DM-6: The repo's `.gitignore` excludes a `private/` folder for the designer's real CSVs and layouts.

## Process and portfolio artifacts

The code is AI-generated. The designer acts as product owner, requirements writer, code reviewer and tester. The repo should make that division of work visible.

**How work is done**

1. Each feature starts as an issue that cites requirement IDs from this doc (for example, `SP-7`, `A11Y-1`).
2. Claude Code implements it on a branch and opens a small pull request, one feature per PR.
3. The designer reviews the PR with written comments, and requests changes where needed.
4. The designer tests against the acceptance criteria and records results in the PR.
5. Merge only when tests, axe checks and performance budgets pass in CI.

**Artifacts the repo keeps**

- `docs/requirements.md`: this document, versioned.
- `docs/decisions/`: one short record per significant decision (what was chosen, what was rejected, why).
- `docs/testing/`: test plans and manual test results, including screen-reader runs.
- `docs/accessibility/acr.md`: the accessibility conformance report.
- `docs/performance.md`: Lighthouse runs over time and what changed between them.
- `docs/case-study.md`: written at the end. Covers the problem, the designer's role, key decisions, accessibility and performance work, and lessons about directing AI.
- A `CLAUDE.md` with project conventions for Claude Code.

## Build phases and usage limits

The build runs on a personal Claude account with usage limits, so work happens in small phases. Each phase must end with working, tested, merged code, even if later phases never happen.

| Phase | Scope | Requirements | Done when |
| --- | --- | --- | --- |
| 0. Scaffold | Vite + React + TS, lint, Vitest, Playwright, CI pipeline, empty app shell | QA-2, QA-6, CI/CD steps 1–4 | CI runs green on a placeholder test |
| 1. Card data | CSV parsing, card model, double-faced cards, import errors | CD-1 to CD-6 | Fixture CSVs import correctly in unit tests |
| 2. Piles | Piles, shuffle, draw, pile viewer, default card rendering | SP-1 to SP-9 | A deck loads and cards can be drawn and searched |
| 3. Table | Free-form table, card actions, keyboard moves, announcements, undo | TT-1 to TT-15 except TT-3 and TT-7, A11Y-1 to A11Y-6 | A solo turn works by mouse and keyboard |
| 4. Layouts | Layout editor, portrait and landscape, preview | LY-1 to LY-10 | A custom layout renders cards on the table |
| 5. Formats | Seats, hands, presets, counters, dice | FS-1 to FS-4 | A 1v1 PvP game can be set up and played |
| 6. Persistence and Sheets | Autosave, snapshots, JSON bundle, Google Sheets URLs | PS-1 to PS-6, CD-7 to CD-12 | Reload restores a game; a sheet URL loads a deck |
| 7. Polish | Demo data, performance budgets, remaining accessibility | DM-1 to DM-6, PF-1 to PF-4, A11Y-7 to A11Y-11 | All budgets and axe checks pass |

**Rules for Claude Code**

- BP-1: Work on one phase at a time, split into issues small enough for one session and one PR. Never start the next phase or issue without the owner's go-ahead.
- BP-2: If a task looks bigger than one session, stop and propose how to split it before writing code.
- BP-3: Read only the sections of this doc and the files the current issue needs. Don't re-read the whole repo or the whole requirements doc each session.
- BP-4: While developing, run only the tests for the files being changed and Chromium-only E2E. Run the full suite once before opening the PR; CI covers all browsers.
- BP-5: Don't rewrite or reformat files outside the issue's scope, and don't regenerate code that already works.
- BP-6: Ask before adding a dependency not listed in the tech stack.
- BP-7: End every session by updating `docs/progress.md`: what was done, what's next, open problems, and any decisions made. The next session starts by reading that file instead of exploring the codebase.
- BP-8: When a fix fails twice, stop and report the problem instead of trying more variations.

## Out of scope

Not in the first version; each may be revisited later.

- Rules enforcement, turn structure or phase tracking.
- Online or networked multiplayer, accounts or a backend.
- Print-and-play PDF export of rendered cards.
- Deck building from a larger card library (one CSV per deck covers the need for now).
- Reading private or unpublished spreadsheets, or any import that needs a Google sign-in. Only published CSV URLs are supported.
- Mobile-first touch play. Phones must not break, but the target is a laptop or desktop screen.
- Selecting several table cards and group actions (TT-3, #29), stacks (TT-7, #30), and remapping shortcuts or customising menus and clicks (#53). These come after V1 as feature issues, not phases.

## Open questions

- [ ] Is the landscape reading right: the card's physical shape is always portrait and only the content is laid out sideways (like Magic's Battles)?
- [ ] Is one CSV per deck comfortable in practice, or does a single master CSV with a `seat` or `deck` column work better? Revisit after the first playtests.
- [ ] Do cards need hidden information beyond face-down, such as a card only one seat can see?
- [ ] Should layouts support icons or symbols inside text (for example, `{fire}` rendered as an icon)?
- [ ] Which counters does each seat need by default, and do they differ by format?

## Decision log

| Date | Decision | Rejected | Why |
| --- | --- | --- | --- |
| 2026-10-25 | Orientation is a layout setting; cards enter the table portrait and are rotated by hand | A per-card orientation column | Keeps card data simple; layouts are where visual decisions are being explored |
| 2026-10-25 | Free-form table with no fixed rows or zones | Fixed location row and play zones | A playtest tool must allow changing board structure mid-game |
| 2026-10-25 | One CSV per deck | One master CSV with a `deck` column | Simpler to start; easy to swap a PvP opponent's deck. Revisit after playtests |
| 2026-10-25 | No `start_on_field` column; any pile can be browsed and cards pulled out at any time | Marking cards eligible to start in play | More flexible while starting rules are still undecided |
| 2026-10-25 | Static, client-only app | Backend with accounts | No hosting cost; nothing to secure; fits solo use |
| 2026-10-25 | Generic sandbox with format presets | App hardcoded to one game | The game is still changing; presets cover Solo PvE, Co-op PvE and 1v1 PvP |
| 2026-10-25 | Cards rendered from layouts, with an art column | Pre-rendered card images only | Card text changes often during design; rendering avoids re-exporting images |
| 2026-10-27 | Selection (TT-3), stacks (TT-7) and shortcut remapping move after V1 | Building them in Phase 3 | Owner decision. A solo turn works without them. Phase 3 closes with #61 (shortcut reference, 2.1.4, announcements, solo-turn E2E). |
