# Proxy

A static, browser-only tabletop for playtesting an in-development card game. Cards load from CSV files (or published Google Sheet CSV URLs), render through user-editable layouts, and are played on a free-form drag-and-drop table by one person controlling every seat.

The full spec is `docs/requirements.md`. Requirement IDs (`CD-3`, `A11Y-1`, `BP-4`) are referenced in issues, PRs and test names.

## How we work (read first)

This project runs on the owner's personal Claude usage. Be economical.

- Work on **one issue at a time**. One issue = one branch = one small PR.
- Until V1 is finished, stay in the current phase only (see "Build phases" in the requirements). Once the existing phases are done, work is no longer organised in phases, so the phase restriction no longer applies.
- **Start every session by reading `docs/progress.md`**, then only the requirement sections and files the current issue needs. Do not explore the whole repo or re-read the whole spec.
- `docs/progress.md` holds the current state, what's next, **open problems** and the **decision log** from earlier sessions. Check them before re-deciding anything or reopening a settled question.
- The PR workflow (preview links, How to test steps, waiting for the owner to test, and the storage rule for previews) is under **Pull requests** below.
- **Propose a short plan before coding** (files to touch, tests to add). Wait for approval.
- **Plan in Opus, build in Sonnet.** Plan the issue in an Opus session. Once the owner approves the plan, start a fresh Sonnet session (medium effort) on the issue's branch to build it. Its brief carries the whole approved plan, the owner's decisions and what done looks like, and says which parts of `docs/progress.md` to read. The build session opens the PR, turns on Auto-fix and stops for the owner's test.
- If the task looks bigger than one session, **stop and propose a split** before writing code.
- Do not touch files outside the issue's scope. No drive-by refactors or reformatting.
- **Ask before adding any dependency** not listed under Stack.
- If a fix fails twice, stop and report the problem instead of trying more variations.
- Never start the next issue (or, during V1, the next phase) without the owner's go-ahead.
- **End every session by updating `docs/progress.md`**: done, next, open problems, decisions made.
- **Every PR updates `docs/progress.md`**, docs-only PRs included. Write it as it will read after the merge: Current state and Next must still be true once the owner merges, so never write "in review".
- **Every PR also updates `docs/requirements.md` when needed**, so the spec matches what was built. If development changed behaviour, scope, copy or a decision the spec covers (a requirement added, changed, split, dropped or deferred), edit the affected requirements in the same PR and list the changed IDs in the PR description.

## Stack

- Vite, React 18, TypeScript (strict)
- Zustand store with an action log (undo/redo/autosave)
- Papa Parse for CSV; `idb-keyval` for IndexedDB
- Vitest + Testing Library; Playwright + @axe-core/playwright; Lighthouse CI
- GitHub Actions; deploy to GitHub Pages (Vite `base: '/proxy/'`)

## Architecture rules

- Every session-state change goes through a named action (`moveCard`, `shuffle`, `flip`, …). Pointer, keyboard and menu input call the same actions.
- Actions return the screen-reader announcement text for the live region.
- Randomness comes from an injectable source; tests use a fixed seed.
- Card definitions, layouts and session state are separate models; table instances reference definitions and layouts by id.
- No network calls except card art URLs from the CSV and CSV URLs the user enters.

## Accessibility (WCAG 2.2 AA)

- Dragging is never the only way: every move has a keyboard and single-pointer alternative.
- Use semantic elements and accessible names; manage focus after moves and in dialogs; visible focus that is never hidden behind cards.
- Respect `prefers-reduced-motion`. Targets at least 24 × 24 CSS px.

## Phones

The owner tests UI previews on a phone, including iOS, so phone-size layout matters even though desktop is the main target.

- Every screen works from 320 CSS px wide with no sideways page scrolling. Rows wrap; long rows scroll inside their own region.
- Dialogs and sheets fit the phone screen: their content scrolls and the footer buttons stay visible. Use `100dvh` for height limits, and don't rely on a `flex: 1` (0%) basis inside auto-height containers, which some mobile Safari versions collapse.
- New screens or dialogs get a phone-size E2E check (for example a 375 × 667 viewport), like the import results test in `e2e/import.spec.ts`.
- For keyboard testing on iOS, the owner uses a hardware keyboard with Full Keyboard Access turned on.

## Design

UI follows the Claude Design export in `design/`. Before building or changing any UI, read `design/HANDOFF.md`, then only the parts the issue needs:

- `design/ui-placement.md` before adding or moving any control: where each feature lives, and the UI-1 to UI-8 rules issues cite. Fill in the issue's Placement section from it. No new header controls (UI-3).
- `design/tokens.css` for every colour, type, spacing, radius and shadow value. Don't hard-code values the tokens cover.
- `design/brief.md` for screen scope and interaction rules.
- `design/mockups/*.dc.html` for exact sizes, copy and structure. The HANDOFF table says which board covers what. These are reference designs, so don't copy their templating.
- Screens not designed yet (import results, setup, layout editor and others) are built from the same tokens and patterns: dialogs follow `MoveDialog`, side sheets follow `PileViewer`, and menus follow `ActionMenu`.

Non-UI issues (parsing, model, actions) don't need the design files.

## Testing

- Name tests after the requirement they cover: `describe('SP-6 shuffle', …)`.
- While developing: run only tests for changed files, and E2E in Chromium only.
- Before opening a PR: run `npm test` and `npm run test:e2e` once.
- Every bug fix gets a regression test in the same PR.
- E2E tests mock Google Sheets responses; never call Google from tests.
- After a key that closes something, check it's gone and where focus went (`closeWith` in `e2e/keyboard.ts`).
- Before a reload or a storage check, wait for the stored item (`e2e/storage.ts`), never a fixed time.
- New or changed E2E specs run 5 times in Chromium and Firefox (`--repeat-each=5`) before the PR opens.

## Pull requests

- Title cites the issue; description lists requirement IDs, what changed, how it was tested, and accessibility notes.
- Keep PRs small. CI must pass before review.
- Every PR gets a preview at `https://nikkistorme.github.io/proxy/pr-preview/pr-N/`. A bot comments the link on the PR, and the preview is removed when the PR closes.
- PRs that change anything visible or interactive include a **How to test** section: the preview link, then numbered steps saying what to click or press and what should happen. Cover the keyboard path too.
- After opening a PR, subscribe to its activity so CI results and review comments reach the session. Fix CI failures and answer review comments as they arrive.
- For those PRs, stop once CI is green and wait for the owner to test the preview. Only the owner merges, after their own check.
- Previews share the live site's web address, so they share its browser storage. Anything saved (IndexedDB, localStorage) must be keyed by the app's base path and the profile (PS-7, only "guest" in V1), so a preview never reads or overwrites the live site's saves. Saves go through the storage interface (AR-6), never straight to IndexedDB.
