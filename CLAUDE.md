# Proxy

A static, browser-only tabletop for playtesting an in-development card game. Cards load from CSV files (or published Google Sheet CSV URLs), render through user-editable layouts, and are played on a free-form drag-and-drop table by one person controlling every seat.

The full spec is `docs/requirements.md`. Requirement IDs (`CD-3`, `A11Y-1`, `BP-4`) are referenced in issues, PRs and test names.

## How we work (read first)

This project runs on the owner's personal Claude usage. Be economical.

- Work on **one issue at a time**, in the current phase only (see "Build phases" in the requirements). One issue = one branch = one small PR.
- **Start every session by reading `docs/progress.md`**, then only the requirement sections and files the current issue needs. Do not explore the whole repo or re-read the whole spec.
- **Propose a short plan before coding** (files to touch, tests to add). Wait for approval.
- If the task looks bigger than one session, **stop and propose a split** before writing code.
- Do not touch files outside the issue's scope. No drive-by refactors or reformatting.
- **Ask before adding any dependency** not listed under Stack.
- If a fix fails twice, stop and report the problem instead of trying more variations.
- Never start the next issue or phase without the owner's go-ahead.
- **End every session by updating `docs/progress.md`**: done, next, open problems, decisions made.

## Stack

- Vite, React 18, TypeScript (strict)
- Zustand store with an action log (undo/redo/autosave)
- Papa Parse for CSV; `idb-keyval` for IndexedDB
- Vitest + Testing Library; Playwright + @axe-core/playwright; Lighthouse CI
- GitHub Actions; deploy to GitHub Pages (Vite `base: '/proxy/'`)

## Architecture rules

- Every game-state change goes through a named action (`moveCard`, `shuffle`, `flip`, …). Pointer, keyboard and menu input call the same actions.
- Actions return the screen-reader announcement text for the live region.
- Randomness comes from an injectable source; tests use a fixed seed.
- Card definitions, layouts and game state are separate models; table instances reference definitions and layouts by id.
- No network calls except card art URLs from the CSV and CSV URLs the user enters.

## Accessibility (WCAG 2.2 AA)

- Dragging is never the only way: every move has a keyboard and single-pointer alternative.
- Use semantic elements and accessible names; manage focus after moves and in dialogs; visible focus that is never hidden behind cards.
- Respect `prefers-reduced-motion`. Targets at least 24 × 24 CSS px.

## Testing

- Name tests after the requirement they cover: `describe('SP-6 shuffle', …)`.
- While developing: run only tests for changed files, and E2E in Chromium only.
- Before opening a PR: run `npm test` and `npm run test:e2e` once.
- Every bug fix gets a regression test in the same PR.
- E2E tests mock Google Sheets responses; never call Google from tests.

## Pull requests

- Title cites the issue; description lists requirement IDs, what changed, how it was tested, and accessibility notes.
- Keep PRs small. CI must pass before review.