# Performance

How Proxy measures up to the budgets in the Performance section of `docs/requirements.md`, how the numbers were taken, and what changed between runs. CI enforces only the initial JavaScript size; everything else here is measured by hand and recorded (owner decision, #172).

## Method

- **Stress table:** `tests/fixtures/bundles/stress.json`, imported with **This session › Import bundle…**. Co-op PvE with two 60-card decks, a 40-card environment deck and 80 cards in play from the demo game, with its art and layouts: 73 face up, 7 face down, 9 turned sideways and 11 with a counter. `npm run perf:fixture` rebuilds it, and `tests/fixtures/csv/two-hundred-rows.csv`, from `src/demo/stressBundle.ts`. A unit test fails if either fixture drifts from its builder.
- **Run:** `npm run test:perf` runs `e2e/perf/stress.perf.ts` against the production build, in Chromium only, one test at a time, at a 1440 × 900 viewport. It prints a table per CPU rate and writes `test-results/perf-<rate>x.json`. It isn't part of `npm run test:e2e` or CI: INP and frame rate are too noisy on shared runners (owner decision, #167).
- **Mid-range laptop:** the development machine with the CPU slowed 2× through the Chrome DevTools Protocol (`Emulation.setCPUThrottlingRate`). 1× and 4× are recorded too, for the range.
- **INP:** Event Timing entries (`PerformanceObserver`, `type: 'event'`, `durationThreshold: 16`), grouped by `interactionId`; the worst interaction counts. Each action runs 5 times and the table shows the worst. Chromium rounds durations to 8 ms and doesn't report anything under 16 ms, so **16 means 16 ms or less**.
  - Draw: D, with a table card focused.
  - Rotate: R on a table card. Flip: F on a table card.
  - Keyboard move: Space picks a card up, Right and Down move the outline, Enter places it. The worst of the four keys counts.
  - Open card menu: Enter on a table card.
  - Change counter: C on a card with a Damage counter, then **Increase Damage** clicked in the dialog.
- **Drag frame rate:** one table card dragged with the mouse back and forth across the table, through other cards and empty table, for 2 seconds (about 120 pointer moves). Frames are counted with `requestAnimationFrame`; long animation frames are counted too. Headless Chromium paints at most 60 frames a second, so 60 is the ceiling. **Script per move** is the main thread's script time over the drag (`Performance.getMetrics`, `ScriptDuration`) divided by the pointer moves: what each move costs.
- **CSV import:** the 200-row CSV loaded into the empty Board cards pile on the stress table, timed from the file input's `change` event to the first frame where the pile's name says 200 cards. Art downloads aren't included. 3 runs, undone in between; the table shows the worst.

## Machine

MacBook with an Apple M4 (10 cores, 16 GB), macOS 15.6.1, Playwright 1.64.1's headless Chromium, mains power.

## 8d: Stress table (#171, 2026-11-02)

Before is `main` after 8c. After is with 8d's fix: memoised table cards (below).

| Budget | Budget value | 1× before | 1× after | **2× before** | **2× after** | 4× before | 4× after |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INP: draw | ≤ 200 ms | 24 | 32 | **24** | **16** | 24 | 24 |
| INP: rotate | ≤ 200 ms | 24 | 24 | **16** | **16** | 24 | 16 |
| INP: flip | ≤ 200 ms | 16 | 16 | **16** | **16** | 16 | 16 |
| INP: keyboard move | ≤ 200 ms | 24 | 32 | **16** | **16** | 24 | 24 |
| INP: open card menu | ≤ 200 ms | 16 | 16 | **16** | **16** | 24 | 16 |
| INP: change counter | ≤ 200 ms | 16 | 16 | **16** | **16** | 32 | 24 |
| Drag one card | 60 fps sustained | 60 | 60 | **60** | **60** | 60 | 60 |
| Drag: worst frame | | 17 ms | 17 ms | **17 ms** | **17 ms** | 17 ms | 17 ms |
| Drag: frames over 20 ms | | 0 | 0 | **0** | **0** | 0 | 0 |
| Drag: script per move | | 2.0 ms | 1.2 ms | **2.3 ms** | **1.2 ms** | 4.7 ms | 2.3 ms |
| CSV import, 200 rows | ≤ 300 ms | 27 | 28 | **27** | **27** | 25 | 26 |

INP values are in ms. Every budget passed before the fix, with a wide margin. The INP differences between runs are within the 8 ms rounding and run-to-run noise.

### What changed

- Before, every drag move over the table re-rendered all 80 table cards: the drop outline follows the pointer through the store, and `TableSurface` gave each card a new view object and new handlers on every render. Any action did the same. A unit test counted 18 renders of a card that wasn't moving during one short drag.
- `TableCard` is now memoised. `TableSurface` gets each card's view from `createTableCardViews` (`src/components/tableCardView.ts`), which keeps a view while its table entry, card, definition and owner's place and name are unchanged, and hands cards handlers that keep one identity. The cards that aren't moving no longer re-render on a drag, a change of drop target or an action on another card (PF-2, `src/components/TableRenders.test.tsx`).
- That halved the script time per drag move. The drag already ran at 60 fps; the fix leaves more headroom for slower machines.

### Not measured here

- Dragging a 10-card stack: stacks are #30, and the stack version of the drag budget moved there.
- Phones. The budgets are for a mid-range laptop; phone checks stay manual.

## 8e: JavaScript size and Lighthouse (#172, 2026-11-02)

### Initial JavaScript (enforced in CI)

`npm run check:size` (`scripts/check-bundle-size.mjs`) reads `dist/index.html`, gzips every script loaded at start (the entry and any `modulepreload`) and fails above 150 kB (150,000 bytes). It runs in the `check` job right after `npm run build`. Lazy chunks (layout editor, Formats screen, pile viewer, demo data) aren't counted.

| File | Gzipped |
| --- | --- |
| `assets/index-4Ynw3sd4.js` (the only start script) | 107.77 kB |
| **Total** | **107.77 kB** (limit 150 kB) |

Vite prints 108.95 kB for the same file. It compresses a little differently from Node's default gzip; the two agree to about 1%.

### Lighthouse

One run by hand on the production build's main page, not the demo (the demo is #63, which repeats this run on `/demo/` and records it here). Median of 3 runs each, performance category only.

- **Command:** `npm run build`, `npx vite preview --port 4173`, then `CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npx lighthouse@13.6.0 http://localhost:4173/proxy/ --chrome-flags="--headless=new" --only-categories=performance`, adding `--preset=desktop` for desktop. Lighthouse's default simulated throttling applies to mobile.
- **Machine:** the one above, Chrome 156 headless, Node 22.12.0 (Lighthouse warns it wants 22.19; it ran without errors).

| Metric | Budget | Mobile median | Desktop median |
| --- | --- | --- | --- |
| LCP | ≤ 2.5 s | 0.76 s | 0.21 s |
| CLS | ≤ 0.1 | 0.000 | 0.000 |
| TBT | (not budgeted) | 0 ms | 0 ms |
| Performance score | ≥ 90 | 100 | 100 |

Mobile LCP over the 3 runs: 1.51, 0.75, 0.76 s (the first run was slower, probably a cold start). Desktop: 0.21, 0.36, 0.20 s. All runs scored 100. This is a local server with no network delay beyond Lighthouse's simulation, so a real visit over the internet will be slower; #63 measures the deployed demo page.
