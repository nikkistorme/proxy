# Progress

## Current state

Phase 3 (Table) is under way. It's split into 3a to 3o, all under #20. Selection (#29), stacks (#30) and shortcut remapping (#34, folded into #53) moved after V1. 3a to 3f-2, 3m-1 to 3m-3, 3i (#31) and 3j (#32) are merged: undo and redo; placed table cards and table focus; pan, zoom, fit all and grid snap; the table card menu; the hand card menu; keyboard and single-pointer placement; dragging table and hand cards; dragging cards out of the pile viewer; piles on the table; moving piles, with a click on a pile drawing its top card; merging piles by dropping one on another; card counters; enlarging a card, with the double-faced badge; reordering the hand; and seat counters (3k-1, part of #33). 3k-2 (#33, dice, coin and roll log), 3o (#61, close-out) and 3n (#39, dark theme) are left. Selecting several cards in the pile viewer is its own feature issue, #57, outside the phases.

The V1 plan now makes the data model ready for games, card sets and accounts (#69): a play session is a "session" and "game" means the card game being designed. Saves will go through a storage interface over separate items, keyed by base path and profile (AR-6, PS-7), with card sets as their own model (AR-4) and one options resolver (AR-7). The code now says "session" for a play session (#73). The storage interface and card set model (#74) start Phase 6.

## Done

### Phase 3k-1: Seat counters (2026-10-27)

- **Model (TT-13, FS-4):** `Seat` has `counters`, using the card counters' `Counter` type. The Solo preset gives Player 1 Life 20 and Energy 0, from the Main board, and the Environment none. Formats set these in Phase 5.
- **Action:** `changeSeatCounter` in `actions/seatCounters.ts` steps a counter up or down, below zero too, and announces "Player 1 Life 20 → 19." Each step is one undo step.
- **UI:** `SeatCounter` puts the board's label, − and + buttons (26px) and mono value beside each seat's name in the seat bar, named "Player 1 Life". On either button, ↑ or + steps up and ↓ or − steps down, and focus stays put. The value gets a short highlight on change, a colour fade only, so it stays under reduced motion. At 520px wide and below, a seat's counters sit together on their own row under its name (from the owner's iPhone check).
- **Tests:** `seatCounters.test.ts`, `SeatCounter.test.tsx`, and `e2e/seat-counters.spec.ts` (keyboard only with undo, axe, and 375 × 667). The table, placement and table-piles E2E now Tab past the counters with `tabTo`.

### Phase 3j: Hand reordering (2026-10-27)

- **Action (TT-12):** `reorderHand` in `actions/handActions.ts` moves a hand card to a new place, keeps the others in order, and announces "Moved Imp to position 2 of 3 in Player 1's hand." Each reorder is one undo step.
- **Keyboard:** Shift with ← or → moves the focused card one place, and Shift with Home or End moves it to either end. Focus stays on the card. At either end, it announces that the card is already first or last. The hand's label says "Shift and arrow keys reorder."
- **Single pointer:** the hand card menu has **Move left** and **Move right**, showing Shift+← and Shift+→, and each is disabled at its end of the hand. `MenuEntry` gained `keyshortcuts` for an `aria-keyshortcuts` value that differs from the shown key.
- **Dragging:** a hand card dragged within its own hand drops between the cards either side of the pointer (the hand destination's new optional `index`). A line in the accent colour shows where it will land, in place of the whole-tray drop target. Landing back in its own place puts it back. A click without a drag still opens the menu.
- **Tests:** `handActions.test.ts`, more in `HandTray.test.tsx` and `CardDrag.test.tsx`. `e2e/hand.spec.ts` adds keyboard only (with axe and undo), a mouse drag, and the menu's Move left at 375 × 667.

### #73: play-session code renamed to "session" (2026-10-27)

- **Rename only, no behaviour change:** `GameState` is `SessionState`, and `model/game.ts`, `store/gameStore.ts` and `GameScreen` (with its CSS and `.game` classes) are `model/session.ts`, `store/sessionStore.ts` and `SessionScreen` (`.session`). The store's `game` field is `session`, `createSoloGame` is `createSoloSession`, and the `useGameStore…` hooks, test helpers, parameters, comments and test names follow. Files moved with `git mv`.
- **Drag code:** `cardDrag.ts` had its own `Session` for a drag in progress. It's `ActiveDrag` now, so "session" only means a play session.
- **Elsewhere:** the bug report form and CLAUDE.md's architecture rules say "session state" instead of "game state".
- "Game" is now free for the card game being designed. No UI copy used it for a play session.

### #69: V1 data model ready for games, card sets and accounts (2026-10-27)

- **Decision record:** `docs/decisions/0001-v1-data-model-ready-for-accounts.md`, the first in `docs/decisions/`.
- **Terms:** a glossary in the requirements defines game, session, card set, layout and format. Every requirement that said "game" for a play session now says "session". The owner chose "session" over #69's "playtest". The build rules say "Claude session" for a work session.
- **New requirements:** AR-6 (storage interface with per-item saves), AR-7 (options resolver, account level only in V1) and PS-7 (saves keyed by base path and profile, "guest" only in V1).
- **Changed:** AR-4 (card sets as their own model, a pile records its card set), PS-1, PS-2, PS-4, PS-5, CD-7, CD-11, CD-12, the Phase 4 to 6 rows, the Persistence acceptance criteria, the overview goal and Out of scope. CLAUDE.md's storage rule now names the profile and the storage interface.
- **Corrections to #69, which was written against an older repo:** the UI copy had no "game" for a play session, so the copy rename and the code rename are one issue (#73). Phase 4 doesn't save anything yet, so it only gives the layout model its id, `updatedAt` and `gameId`; saving layouts as items is Phase 6 (#74).
- **Issues:** filed #73 and #74, and commented on #45, #65 and #67 with what moved into V1.

### #66: no iOS zoom on text fields (2026-10-27)

- **A11Y-12 (new):** iOS Safari zooms the page into any focused field whose text is under 16px. On touch screens (`pointer: coarse`), `.form-input` goes from 15px to 16px and the pile viewer's filter dropdowns from 14px to 16px. Desktop keeps the design's sizes. The number fields were already 17px or more.
- **Test:** a phone E2E in `e2e/pile-viewer.spec.ts` checks that every text field and dropdown in the pile viewer and the Move to… dialog is at least 16px. Playwright can't reproduce Safari's zoom, so it checks the size that causes it. It fails at 14px without the fix.

### Phase 3i-2: Enlarge and the double-faced badge (2026-10-27)

- **Enlarge (TT-9):** `CardEnlarge` shows a card's face at 216px wide with "Name · Type" and an "I close" hint, from the Main and TableDark boards. It sits outside the zoomed mat, so it's the same size at any zoom, and it's always upright, however the card is turned. `enlargeSpot` puts it right of the card, then left, below or above, whichever fits, so it never covers the card. On a phone where nothing fits, it takes the side with the most room.
  - **Opening:** a mouse resting on a card for 400ms opens it without taking focus, and leaving both the card and the preview for 150ms closes it. **I** on a focused card, or **Enlarge** (I) in the card menu, opens it with focus inside. A press on the card, or a menu opening, cancels a waiting hover.
  - **Closing:** I or Escape (focus goes back to the card), a press outside it, focus leaving it, or the table scrolling or zooming.
  - **Double-faced cards (owner decision):** the preview starts on the face the card shows and has a **Show back** or **Show front** button that flips the preview only, with a half-turn animation. It's instant under `prefers-reduced-motion`. When the preview opens by key or menu, focus starts on that button.
  - **Face-down cards (owner decision):** I or the menu shows the front, a quick look at a hidden card. The card stays face down. A hover never shows it.
- **Escape on the table (owner decision):** Escape on a focused card (with no preview open) or pile moves focus back to the table itself.
- **Touch hold (owner decision):** a finger held on a table card and let go without moving opens the card's menu, as on a pile, and the menu has Enlarge. `DragSource.onHoldRelease` now works for table cards too, and hand cards are unchanged.
- **Double-faced badge (TT-6):** face-up double-faced table cards show the CardStates badge, a flip icon and "2". It sits below "Not in CSV" when a card has both. It's hidden face down, and the card's name already says which face shows.
- **Tests:** 397 unit tests, including `TableEnlarge.test.tsx` and `enlargePlacement.test.ts`. The new `e2e/enlarge.spec.ts` covers:
  - keyboard only: I, Show back, Escape, a turned card at 50% zoom shown upright at 216px beside the card, and Escape from a card and a pile back to the table
  - mouse hover with axe, the badge, and the flip button by mouse
  - a touch hold opening the menu, then Enlarge at 375 × 667 (Chromium)

### Phase 3i-1: Card counters (2026-10-27)

- **Issue split:** #31 (3i) became 3i-1, counters, and 3i-2, enlarge and the double-faced badge (owner approved).
- **Model (TT-8):** a `TableEntry` has an optional list of counters, each with an id, a name and a whole-number value. They belong to the card's place on the table, so they stay as it moves on the table, Duplicate copies them, and they're cleared when the card leaves the table.
- **Actions:** `addCounter`, `setCounter`, `renameCounter` and `removeCounter` in `src/actions/counters.ts`. A new counter starts at 1. Names are unique on a card, ignoring case. Values can go below zero. Every change is its own undo step, announced as "Added Damage 1 to Troll.", "Damage on Troll: 3.", "Renamed Damage on Troll to Wounds." or "Removed Damage from Troll.". A face-down card is "a face-down card".
- **Pills:** dark pills with a white edge, centred above the card's text box and stacking upward, from CardStates. Four or more show the first two and "+2 more". They turn with the card. The card's name ends ", counters: Damage 3, Shield 1", face down too.
- **Counters dialog:** `CountersDialog` on the shared `Dialog`, titled "Counters on Troll", following the CardStates "Edit counter" board. Each counter is a named group with its name field, − value +, and **Remove counter**. Below them, **New counter name** and **Add counter**.
  - **Opening:** C on a focused card, **Counters…** (C) in the card menu, or clicking a pill. Pills are 24px tall and stay out of the Tab order, like the Actions button.
  - **Focus:** opens on the clicked pill's counter, else the first counter, else the new counter's name. After Add, the new counter's value; after Remove, the new counter's name. On close, back to the card.
  - **Keys:** + and − (and the arrow keys in the value field) step the value on the value controls. Typed names and values are kept on Enter, Escape or leaving the field. Escape closes and keeps everything.
  - **Announcements:** the dialog has its own live region, like the pile viewer, because the page's region sits outside the modal.
  - **Touch screens (owner rule):** focus never goes straight to a text field, because that slides the keyboard up. `touchScreen()` (`pointer: coarse`) picks a button instead: the counter's + on opening or after Add, **Add counter** after Remove, else the dialog's first button.
- **Tests:** 382 unit tests, including `counters.test.ts` and `TableCounters.test.tsx`. The new `e2e/counters.spec.ts` covers keyboard only (add, step, rename, remove, undo), mouse with axe on the dialog and a pill click, the dialog at 375 × 667, and an emulated phone where no text field takes focus (Chromium and WebKit).

### Planning: post-V1 issues (2026-10-27)

- **Moved after V1 (owner decision):** #29 (selection and group actions, TT-3) and #30 (stacks, TT-7) are feature issues now, with no phase and no longer under #20. #29 has a suggested split and its open questions.
- **#34 (3l) closed:** shortcut remapping is folded into #53 (control settings, after V1).
- **New issue #61 (3o):** keeps #34's V1 work and closes Phase 3. It covers the ? shortcut reference, a WCAG 2.1.4 fix (D draws from anywhere on the page today), an announcement audit, and the solo-turn E2E.
- `docs/requirements.md`: TT-3 and TT-7 are marked after V1, A11Y-4 drops remapping from V1, the Phase 3 row leaves out TT-3 and TT-7, and Out of scope lists the post-V1 work.

### Phase 3m-3: Merging piles (2026-10-27)

- **Piles never overlap (TT-4):** a pile dropped or placed so that it covers another pile merges with the one it covers most (`pileUnder` in `tablePlacement.ts`). `movePile` refuses a spot over another pile. Cards may still overlap piles and each other.
  - **Mouse and touch:** the pile under a dragged pile shows the drop ring with "Drop: merge". Dropping there opens the merge dialog.
  - **Keyboard and single pointer:** with Space or **Move on table**, the outline over a pile says "Row 1, column 2, over Environment deck. Enter merges them." and that pile shows "Drop: merge". Enter, Space or **Place** opens the merge dialog.
- **Merge dialog:** `DeletePileDialog` has a merge mode, "Merge Board cards and Environment deck?". It asks which pile is deleted (the dragged one first) and whether its cards go on the **Top** (the default) or **Bottom** of the other, with a sentence saying what will happen. **Merge piles** confirms.
- **Merging (SP-4):** `mergePiles` deletes one pile and puts its cards on the kept pile, keeping their order. The kept pile stays where it is and keeps its name, owner and deck, as when a deleted pile's cards move to another pile. It's one undo step, announced as "Merged Board cards into Environment deck. 2 cards.", with a toast that has Undo.
  - **Focus:** the kept pile after a merge. After Cancel, nothing has moved, and focus goes back to the dragged pile.
- **Owner defaults:** the cards go on top by default, the kept pile doesn't move, and merging always asks, even when a pile is empty.
- **Tests:** 366 unit tests, including the merge tests in `piles.test.ts`, `tablePlacement.test.ts`, `DeletePileDialog.test.tsx` and `PileMove.test.tsx`. The new `e2e/pile-merge.spec.ts` covers a mouse drag with axe mid-drag and on the dialog, Cancel, undo, keyboard only, and touch at 375 × 667 (Chromium only).

### Phase 3f-2: Dragging cards from the pile viewer (2026-10-27)

- **Dragging (TT-4, SP-8):** a card in the pile viewer can be dragged by mouse or touch to a spot on the table, a hand, or the top of any pile. It uses the 3f-1 controller (5px mouse slop, 250ms touch hold, snap and edge clamping, Escape to cancel). Every drop goes through `moveCard`, so it's one undo step with the same announcement as Move to….
- **The viewer steps aside:** a modal leaves the page inert, so the drop zones behind it can't be reached. Once a card lifts, the viewer closes (without counting as the viewer closing), and after the drop or cancel it opens again (owner decision).
- **Focus:** after a drop, the next match, as after To hand or To table, or the search when none are left. After Escape or a drop on nothing, "Put Ogre back." and focus on the same card.
- **Its own pile:** a card dropped on its own pile goes to the top. The top card is just put back (owner decision).
- **Code:** `DragSource` gains `onLift`, and its `from` can be undefined for a card below a pile's top. The viewer ignores its own close events while a card is lifted.
- **Tests:** 353 unit tests, including `PileViewerDrag.test.tsx`. The new `e2e/viewer-drag.spec.ts` covers a mouse drag to the table with axe mid-drag and after the viewer comes back, drags to the hand and another pile, Escape, and touch at 375 × 667 (Chromium only).
- **New issue:** #57, selecting several cards in the pile viewer and acting on them together, including dragging. It's a feature issue, not tied to a phase.

### Phase 3m-2: Moving piles, and what pressing a pile does (2026-10-27)

- **Moving a pile (TT-4, A11Y-1):** piles move on the table like cards. `movePile` keeps the pile inside the top and left edges, says "Moved P1 main deck on the table.", and is one undo step. A pile already there adds no step.
  - **Keyboard and single pointer:** Space on a pile (on keyup), or **Move on table** in its menu, starts the 3e placement outline: arrows, Shift+arrows, Enter, Escape, and tap then Place. The outline names what's under it, leaving out the pile itself.
  - **Mouse and touch:** dragging a pile anywhere on its tile moves the whole pile, with the 3f-1 controller: a 5px mouse slop, a 250ms touch hold, snap and edge clamping, and Escape to cancel. A pile always lands on the table, even over a card or another pile. Over the hand it goes back.
  - **Look:** the dragged copy keeps the pile's name plate, and where it came from shows faded and dashed.
- **Pressing a pile (owner decision):**
  - **Click or tap** draws the top card into the active seat's hand, as Draw 1 does. With the pile's menu open, a click closes the menu instead.
  - **Right-click, Enter, the menu key or Shift+F10** open the pile's menu. On touch, **a finger held and let go without moving** opens it.
  - **Double-click** does nothing yet.
  - Every pile is described by "Click draws the top card. Enter, right-click, or a touch held and let go, opens actions. Space moves the pile." (`PILE_HINT`, through `aria-describedby`).
- **Bug fix:** a touch's click arrives a little after the finger lifts, so the click that follows a drag was getting through. It could open a hand card's menu, or close a pile's menu that had just opened. The drag now swallows its next pointer click, until the next press or for a second at most. Keyboard clicks are never swallowed.
- **Code:** `DragSource` is a card or a pile (`pileId`, `onHoldRelease`). The store's `placing` and `drag` can name a pile, and `TableSurface` takes `openPileMenu`.
- **Tests:** 347 unit tests, including `PileMove.test.tsx` and `movePile` in `piles.test.ts`. The new `e2e/pile-move.spec.ts` covers a mouse drag with axe mid-drag, then a CSV drop, the menu and a click draw on the moved pile; keyboard only; and touch at 375 × 667 with axe. E2E specs open pile menus with a right-click now.
- **Issues:** #49 is rewritten as "3f-2: Drag cards from the Pile Viewer". Dragging the top card straight off a pile is dropped. Merging piles is #56 (3m-3).

### Workflow: requirements upkeep and phase-free issues (2026-10-27)

- `CLAUDE.md`: every PR also updates `docs/requirements.md` when development changed something the spec covers, and lists the changed requirement IDs in the PR description.
- The **Feature or task** issue form no longer asks for a phase or adds a "[Phase N]" title prefix, since work after V1 won't be organised in phases.
- `CLAUDE.md` keeps the stay-in-the-current-phase rule only until V1 is finished. After that, work isn't restricted to phases.

### Phase 3m-1: Piles on the table (2026-10-27)

- **One surface (owner decision):** the separate pile row is gone. Piles sit on the table with the cards, as on the Main board, card-sized and under the cards.
  - **Positions:** each `Pile` has `x` and `y`. The Solo game's three piles start along the top row. Add pile puts a new pile at the next free spot, and `freeSpot` never puts a card or pile on a pile.
  - **Keyboard (A11Y-3):** piles and cards share the table's one Tab stop, and arrow keys move between them by position (`tableItems` in `tableNavigation.ts`). The table is named "Table, 2 cards, 3 piles. Arrow keys move between cards and piles. …".
  - **Pile behaviour is unchanged:** click or Enter opens the menu, V opens the viewer, CSV files drop on a pile, and dragged cards drop on top. A second press on a pile with its menu open closes it.
  - **Menus:** a pile's menu opens outside the zoomed table, like the card menu, so it's full size at any zoom and never clipped.
  - **Focus after deleting a pile:** the next pile or card in reading order, else the one before, else Add pile.
  - **Fit all (TT-1)** frames piles too: "Showing all 9 cards and 3 piles at 86%."
- **Add pile** is in the table toolbar, after grid snap, with its icon and visible label.
- **Code:** `TableSurface` takes a `renderPile` prop. `GameScreen` still owns pile menus, dialogs and loading, and draws each pile through it.
- **Tests:** 333 unit tests, including `TablePiles.test.tsx`. New `e2e/table-piles.spec.ts` covers the toolbar's Add pile, menus at 80% zoom with axe, the keyboard path, and phone size. E2E specs that relied on the pile row, Tab order or first-row positions are updated.
- **Split:** moving piles is 3m-2 (#51).

### Phase 3f-1: Dragging table and hand cards (2026-10-27)

- **Dragging (TT-4):** table cards and hand cards can be dragged by mouse and touch to a spot on the table, the top of a pile, or the hand. Every drop goes through `moveCard`, so it's one undo step with the same announcement as a keyboard move.
  - **Mouse:** a drag starts after the pointer moves 5px. A click without a drag still focuses a table card or opens a hand card's menu.
  - **Touch:** a finger has to rest on a card for 250ms before it lifts. Moving sooner scrolls the table as before, and a tap works as before. Once a card has lifted, the page doesn't scroll and the browser's long-press menu doesn't open.
  - **On the table:** the card keeps the point you took hold of under the pointer, snaps to the grid when snap is on, and never goes past the top or left edge (`clampToTable`).
  - **Cancelling:** Escape, or dropping outside the table, piles and hand, leaves the card where it was: "Put Imp back." Dropping a hand card on its own hand does the same.
  - **Focus:** after a drop on the table, the card has focus. A table card dropped elsewhere leaves focus to its neighbour, and a hand card to the next card in the hand, as Move to… does.
  - **Announcements:** "Dragging Imp. Escape cancels." on lifting, then the move or "Put Imp back."
- **Look (CardStates):** the dragged card is a copy that follows the pointer, scaled 1.06 and tilted −3° with the deep drag shadow. Where it came from shows faded and dashed. Under reduced motion it isn't scaled or tilted.
- **Drop targets:** only the target under the pointer is highlighted. The table shows the landing outline, a pile its accent ring with "Drop: top" above it, and the hand a dashed accent ring, tint and "Drop: Player 1's hand".
- **Code:** `useCardDrag` in `cardDrag.ts` runs one drag at a time with window listeners, hit-tests `[data-drop-zone]` elements with `elementFromPoint`, and hands the destination to the source's own `drop`. The store has a `drag` field for the origin and target highlights, and a `useGameStoreApi` accessor. The table viewport now isolates its cards' layers, so the dragged copy and menus stay above them.
- **Tests:** 326 unit tests, including 10 in `CardDrag.test.tsx`. `e2e/drag.spec.ts` covers mouse drags between every zone with an axe check mid-drag, Escape, reduced motion, and a touch drag at 375 × 667 (Chromium only).
- **Split:** dragging the top card off a pile is 3f-2 (#49).

### Phase 3e: Keyboard and single-pointer placement (2026-10-27)

- **Placing a card (A11Y-1):** a dashed outline shows where the card will land (the CardStates drop-target look). A bar shows "Placing Imp" with **Place** and **Cancel**.
  - **Starting it:** Space on a table card, **Move on table** in the table card menu, or **Table — choose a spot** in Move to… from the table or the hand.
  - **Where the outline starts:** at the card's own spot, or at the next free spot for a hand card.
  - **Keys:** arrows move 16px, Shift+arrows a whole card. With snap on, arrows move one grid step and Shift+arrows two. Enter or Space places the card and Esc cancels. Space acts on keyup, so one press never places and picks up again.
  - **Pointer:** a click or tap anywhere on the table, cards included, moves the outline there, centred on the pointer. Then Place confirms.
  - **Edges:** the outline never goes past the table's top or left edge, turned cards included.
  - **Announcements:** "Picked up Imp. Row 1, column 3. …", then the spot after each move ("Row 2, between columns 2 and 3, over Troll"), then the move or "Put Imp back."
  - **Focus:** while placing, focus is on the outline, and Tab reaches Place and Cancel. Afterwards it's on the placed card. Cancelling returns it to the table card, or to the hand card it started from.
  - **Undo:** the whole placement is one step.
- **`moveCard`** moves a table card to a new `position`, keeping its turn, side and layer: "Moved Imp on the table." A face-down card stays unnamed.
- **Move to…** now lists "Table — next free spot" and "Table — choose a spot". The second only appears where the dialog can pass the card to the table (the table and the hand), not in the pile viewer or peek.
- **Store:** `placing` and `setPlacing` say which card is being placed.
- Tests: 316 unit (`A11Y-1 keyboard and single-pointer placement`, `A11Y-1 placing a card by keyboard`, and the moveCard reposition) and 46 E2E, including `e2e/placement.spec.ts` (mouse with axe, keyboard only, and phone size).

### Phase 3d-2: Hand card menu (2026-10-27)

- **Hand cards are buttons.** Each is a transparent button over a decorative face, named for the card ("Imp", or "Daylight Hunter, double-faced").
  - The hand is one Tab stop, with ←, →, Home and End between cards (A11Y-3). The list's name ends "Arrow keys move between cards."
- **`HandTray`** now reads the hand from the store, so it no longer takes `cards`.
- **`HandCardMenu`:** Play to table (P), Move to… (M) and Details….
  - **Opening it:** a click or tap on the card, Enter, Shift+F10 or the Menu key, or a right-click.
  - **Placement:** it opens in a fixed anchor outside the scrolling hand row, which would clip it.
- **What each item does:**
  - **Play to table** uses `moveCard` to put the card in the next free spot.
  - **Move to…** reuses `MoveDialog`, "from Player 1's hand".
  - **Details…** uses `CardDetailsDialog`'s new `faceUp` option, because drawn cards keep their face-down side in the hand.
- **Focus after a card leaves:** the card now in its place, or the one before, or **Draw** when the hand is empty. Dialogs return focus to the card.
- **`Menu` shifts left** when it would run off the right edge of the screen. The phone E2E caught a hand card menu half off-screen. This also fixes the table card menu near the right edge.
- **Tests that read hand cards as images** now read them as buttons by name.
- Tests: 304 unit (`FS-3 hand tray`, `A11Y-3 hand focus` and `TT-4 and SP-8 hand card menu`) and 43 E2E, including `e2e/hand.spec.ts` (mouse with axe, keyboard only, and phone size).

### Phase 3d: Card action menu (2026-10-27)

- **The hand card menu moved to #41 (3d-2),** by agreement.
- **Actions (`src/actions/cardActions.ts`):**
  - `rotate`: clockwise or counter-clockwise (TT-5)
  - `flip` (TT-6): a double-faced card swaps faces, a single-faced card turns face down and back, and a face-down card turns front up. A card whose back was lost counts as single-faced. `flipKind` names the next flip for the menu.
  - `bringToFront` and `sendToBack` (TT-10)
  - `duplicate` (TT-11): a copy 24px down and to the right, on top, the same way up and turned the same way. It's flagged `duplicate`, so reloading a pile skips it when counting and removing copies.
  - `deleteCard` (TT-11)
  - `shownName` keeps face-down cards secret in announcements ("Turned Troll face down.", then "Rotated a face-down card to 90°.").
- **`CardMenu`** follows the ActionMenu board:
  - **Items:** Rotate 90° clockwise (R), Rotate 90° counter-clockwise (Shift+R), the flip item named for what it will do (F), Move to… (M), Details…, Duplicate (Ctrl+D), Bring to front, Send to back, then Delete (Del). Bring to front and Send to back are disabled at the ends.
  - **Opening it:** Enter, Shift+F10 or the Menu key on a card, a right-click, or the round Actions button.
  - **The Actions button** shows on the current card only, at the bottom-right of the area the card covers. It's out of the Tab order, because Enter does the same.
  - **Placement:** the menu opens in a fixed anchor outside the zoomed mat, so it's the same size at any zoom.
- **Table cards** have an outer box (what they cover on screen, from `cardBox`) and an inner `table-card__body` that turns. Before that change, the Actions button turned with the card and could land off the mat.
- **Card keys:** R, Shift+R, F, M, Delete or Backspace, and Ctrl/⌘+D only work while a table card has focus, which WCAG 2.1.4 allows.
- **Move to…** reuses `MoveDialog`. A face-down card shows as "Face-down card".
- **`CardDetailsDialog`** lists every column of each face, notes a missing definition or a duplicate, and keeps a face-down card hidden.
- **Toast (`Toast`, `store.toast`):** "Deleted Troll." with Undo and Dismiss. It goes with the next action, undo or redo, so it has no time limit.
- **Pile delete:** an empty pile now deletes straight away with the toast, and its menu item reads "Delete" (with cards, "Delete…" still asks where they go, then shows the toast). The dialog no longer says there's no undo.
- **Focus after each action:**
  - rotate, flip and stacking order: stays on the card
  - Duplicate: the copy
  - Delete or Move to…: the next card in reading order, else the toast's Undo (delete) or the table itself (move)
  - Dialogs: back to the card once they close
- Tests: 298 unit (`TT-5 rotate`, `TT-6 flip`, `TT-10 stacking order`, `TT-11 duplicate and delete`, the card menu, keys, Details and toast tests, and updated pile-delete tests) and 40 E2E, including `e2e/card-actions.spec.ts` (mouse with axe, keyboard only, Details, and phone size).
- Checked by hand from screenshots at 1280 × 800.

### Phase 3c: Pan, zoom, fit all and grid snap (2026-10-26)

- **The dark theme moved to its own issue, #39 (3n),** by agreement, because it needs every screen checked in dark.
- **View state** lives in the store as `view: { zoom, snap }`, apart from `game`, so it's never an undo step.
  - The table registers a `tableViewport` (`stepZoom`, `resetZoom`, `fitAll`), which the toolbar and keys call.
  - Changes are announced: "Zoom 110%.", "Showing all 9 cards at 62%.", "Snap to grid on.", and "No cards on the table to fit."
- **Layout.** At 768 × 600 and up, the app fills the window (`100dvh`). The header, seats, piles and hand stay put, and the table viewport takes the rest. Smaller screens scroll the page, and the table viewport is `60dvh` tall.
- **Zoom (`src/model/tableView.ts`):**
  - steps of 25, 33, 50, 67, 75, 90, 100, 110, 125, 150, 175 and 200%
  - `stepZoom`, from between steps after a pinch, goes to the nearest step that way
  - `scrollAfterZoom` keeps the point under the pointer or the centre in place
  - The mat is scaled with a CSS transform inside a sizer, so the scrollbars match.
  - The mat always fills the view and reaches two cards past the rightmost card and one card below the lowest, so there's room to pan and drop.
- **Input:**
  - Ctrl/⌘+wheel (and a trackpad pinch) zooms around the pointer, and a plain wheel scrolls.
  - A two-finger touch pinch zooms around the fingers. Touch events with `touch-action: pan-x pan-y` keep one-finger scrolling native, and Safari's `gesturestart` is stopped.
  - Dragging empty table space with the mouse pans, and Shift+arrow keys pan by 64px.
- **Fit all** frames every card and never zooms in past 100%.
- **Grid snap** is off by default. When it's on, a faint grid shows on the mat in `--mat-edge`, every 71 × 96px from 16,16 (half an auto-placement cell). `snapToGrid` is ready for 3e and 3f, which place cards at arbitrary spots.
- **Toolbar** (Main board): Zoom out (−), a "100%" zoom reset in the number font, Zoom in (+), Fit all cards (0), and Snap to grid (G) with `aria-pressed`, all with tooltips.
  - The keys are + or =, −, 0 and G. They're ignored with Ctrl/⌘ (browser zoom), in fields, and while a dialog or menu is open.
- **Owner review: cards didn't use the table's full width.** Auto-placement always wrapped after 6 cards (from 3b), which left a wide table half empty. Rows now wrap at the visible width.
  - The table sets `view.columns` with `columnsFor`, as it resizes and zooms. The store passes it to every action as `ActionContext.placementColumns`.
  - `moveCard` takes the context, and `freeSpot` takes the column count, which still defaults to 6.
  - Cards already on the table don't move.
  - Regression tests cover `columnsFor`, the store and E2E (8 cards in a row at 1280 wide). The E2E check fails without the fix.
- **The viewport has `tabIndex={-1}`.** Firefox makes any scrolling box a Tab stop, so CI's Firefox E2E found the table had two Tab stops (the viewport, then the cards). A unit test checks the attribute.
- **`e2e/keyboard.ts` `tabTo`** presses Tab until the target has focus. The keyboard tests that counted Tab presses use it now, so new toolbar buttons don't break them.
- Tests: 278 unit (`TT-1 zoom steps`, `TT-1 fit all`, `TT-2 snap to grid`, `TT-1 and TT-2 zoom, fit and snap controls` and `TT-1 panning and zooming the table`) and 36 E2E, including `e2e/table-view.spec.ts` (mouse with axe, keyboard only, and phone size).
- Checked by hand from screenshots at 1280 × 800 and 375 × 667.

### Phase 3b: Placed table cards and table focus (2026-10-26)

- **Card sides (TT-6).** `CardInstance.faceUp` is now `side: 'front' | 'back' | 'down'` (`CardSide`).
  - A card moved to the table shows its front. One moved to a pile is face down unless kept face up. Shuffle turns every card face down, and Reveal turns the top card's front up.
  - Nothing sets `back` yet: flipping comes in 3d.
- **Card owners.** Each copy records `ownerSeatId`, the seat of the pile it was loaded into (none for a shared pile), so a face-down card shows its owner's back.
- **Table entries.** `table` is a list of `TableEntry` objects (`{ cardId, x, y, rotation }`), bottom of the stacking order first.
  - `Rotation` is 0, 90, 180 or 270.
  - `moveCard` to the table takes an optional `position`. Without one, `freeSpot` (`src/model/tablePlacement.ts`) picks the first grid cell no card covers, six cards to a row (as wide as the visible table since 3c). A quarter-turned card counts by its turned size.
- **`TableSurface` and `TableCard`** replace the "On the table" list.
  - Cards sit at their positions on the mat, with the Main board's size, shadow and inset mat edge. The mat grows to fit its cards and scrolls inside its own area, so the page never scrolls sideways.
  - **Face down:** the owner's card back, with its frame and seat mark.
  - **Missing definition:** a "Not in CSV" dark pill.
  - **Back face:** a card showing its back whose definition lost its back falls back to its front.
  - Rotation is drawn around the card's centre.
- **Focus (A11Y-3).** The table is a group with one Tab stop, which is the last card focused, or the first in reading order once that card has gone.
  - Arrow keys go to the nearest card in that direction (`nearestInDirection` in `src/model/tableNavigation.ts`), where sideways distance counts double. At the edge, focus stays put.
  - A focused card is drawn above every other card (A11Y-7), visually only, so it isn't an action.
  - **Owner review: clicking a card did nothing visible.** The ring only showed after keyboard use (`:focus-visible`), and Safari doesn't focus a button on click. Table cards now focus themselves on click and show the ring on any focus, because the focused card is the current card that keys and the card menu act on. The E2E mouse test checks the ring and stacking after a click, and fails without the fix in Chromium and WebKit.
- **Names (A11Y-6), from `tableCardView`:**
  - the name, plus ", front face" or ", back face" for double-faced cards, then ", rotated 90°", then ", not in the CSV any more"
  - face-down cards: "Face-down card, Player 1" (or "shared")
  - Each card is a transparent button over a decorative face, the same pattern as the viewer.
- **New issues from planning:**
  - **#37 (3m):** movable piles on the table, at the owner's request.
  - **#26 (3d)** now also covers a hand card menu with Play to table and Move to….
- Tests: 261 unit (`TT-4 placing a card on the table`, `TT-4 cards on the table`, `TT-6 card sides`, `A11Y-3 table navigation`, `A11Y-3 table focus` and `A11Y-6 table card names`) and 33 E2E, including `e2e/table.spec.ts` (mouse with axe, keyboard only, and phone size at 375 × 667).
- Checked by hand from screenshots at 1280 and 320 wide.

### Phase 3a: Undo and redo (2026-10-26)

- Phase 3 is split into 12 issues, #23 to #34 (3a to 3l), linked as sub-issues of #20.
- **History in the store** (TT-15): `dispatch` saves the game from before each action, with that action's announcement, in `past`. Undo moves it to `future`, and any new action clears `future`.
  - Actions never change a game in place, so the saved games share every part that didn't change. Undo after a shuffle restores the exact order, and undoing a load also restores definitions.
  - An action that returns the same state, like drawing from an empty pile, adds no step and keeps redo.
  - History is capped at `HISTORY_LIMIT` (200 steps). The oldest step is dropped past that.
  - Undo and redo announce "Undone: <the action's announcement>" and "Redone: …", or "Nothing to undo." and "Nothing to redo." (A11Y-5).
- **`TableTools`** is the header's `<nav aria-label="Table tools">` from the Main board, with only Undo and Redo so far. They're 32px icon buttons labelled "Undo (Ctrl+Z)" and "Redo (Ctrl+Shift+Z)", with ", nothing to undo" or ", nothing to redo" added when there isn't one.
  - They use `aria-disabled`, not `disabled`, so focus stays put after the last undo and a press says why.
- **`Tooltip`** (`src/components/Tooltip.tsx`) gives icon-only buttons a visible label with their shortcut, as the Design System asks. It replaced `title`, after the owner's review found that hovering showed nothing.
  - It shows on mouse hover after `TOOLTIP_DELAY_MS` (300ms), and at once on keyboard focus. Esc hides it, and it stays while the pointer is over it (WCAG 1.4.13). Touch doesn't show it.
  - The control keeps its own accessible name, and the tooltip is `aria-hidden`, so the label isn't read twice.
  - `align="end"` lines it up with the button's right edge, for the toolbar at the right of the screen.
- **Keys:** Ctrl/⌘+Z undoes. Ctrl/⌘+Shift+Z and Ctrl+Y redo. They're ignored in fields, which keep their own undo, and while a dialog or menu is open, whose contents would go stale.
- **Two WebKit E2E races fixed.** They failed in CI, and the D one already failed on `main`:
  - `import.spec.ts` "draw with D" pressed Esc before the async Import results dialog had opened, so the dialog then blocked D. It now waits for the dialog to open and close.
  - `pile-viewer.spec.ts` "filters by column" ran axe during the viewer's 200ms fade-in, so axe read half-faded colours. It now waits for the sheet's animations to finish.
  - Each failed about 1 in 3 locally in WebKit, and passed 10 of 10 after the fix.
- The toolbar adds two Tab stops before the piles, so the Tab counts in `e2e/import.spec.ts` and `e2e/manage-piles.spec.ts` went up by two.
- Tests: 239 unit (`TT-15 undo and redo` in the store, `TT-15 undo and redo controls` and `Icon button tooltips`) and 30 E2E, including `e2e/undo.spec.ts` (mouse with axe and the tooltip on hover, keyboard only with the tooltip on focus, and phone size at 375 × 667 and 320 wide).
- Checked by hand from screenshots at 1280 and 320 wide, with the tooltip open.

### Issue templates (2026-10-26)

- Issue 21: `.github/ISSUE_TEMPLATE/` has a **Bug** form and a **Feature or task** form, and blank issues are turned off.
  - Bug asks for what happened, what should happen (with the requirement ID), steps, input method, browser and assistive tech, and evidence, and reminds the fix PR to add a regression test (QA-7).
  - Feature or task asks for the phase, requirement IDs, goal, in and out of scope, acceptance criteria, the agreed plan and notes.
- They apply the `bug` and `feature` labels. The `feature` label was created for this.
- The templates don't add issues to a project board. Add a `projects:` line to each template if you want that later.

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
- **Owner review: the pile menu ran past the bottom of the screen** on a 14-inch MacBook Pro.
  - `Menu` now fits itself to the viewport when it opens, and on resize and scroll. It opens below its opener if it fits, else above if that fits (`data-placement="above"`, placed by the container's CSS), else on the roomier side, capped to that space.
  - It scrolls inside, and an inner shadow shows on any edge with more options out of view (`data-more-above` and `data-more-below`).
  - The shadows are sticky `::before` and `::after` overlay layers, at 60% black. After the owner's second review, they replaced an inset `box-shadow` on the menu, which was too faint and painted underneath the items, so a hovered item covered it.
  - The E2E regression test at 1280 × 560 fails without the fix (the menu's bottom was at 872px).
- Tests: 223 unit (`SP-9 peek`, `SP-9 peek N`, the Dialog regression, and `Action menu stays inside the viewport`), and 27 E2E including `e2e/peek.spec.ts` (mouse with axe, keyboard only with Move to… "— bottom" and Esc, and phone size at 375 × 667) and the short-screen menu test.
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

- **#74: storage interface, profile keys and card set model**, at the start of Phase 6.
- **3k-2 (#33, dice, coin and roll log)**, next, after the owner's go-ahead. The owner changed the layout (see Decisions): no right dock. A **Dice & coins** button opens a dialog to roll d4 to d20 or flip a coin, with the result shown large. A menu on the session's name in the header has **Session log**, which shows the log. Settle at the start of 3k-2: whether the log lists only rolls (all TT-14 asks) or every action, and where the header control sits until named sessions exist. Update TT-14 in that PR. Then 3n (#39, dark theme) at any point, and 3o (#61) last: the ? shortcut reference, a WCAG 2.1.4 fix for the page-wide D shortcut, the announcement audit, and the solo-turn E2E that closes Phase 3.
- **#71: keys act on the hovered card or pile when nothing on the table has focus**, an owner request from the #70 review. Single-letter keys without focus need the shortcut switch (WCAG 2.1.4), so it goes with #61 and #53.
- **#68: no text-field focus on touch screens in the other dialogs** (Move to…, pile viewer, Draw/Mill/Peek count, pile name). It isn't tied to a phase, and the owner chooses when.
- **After V1, as feature issues:** selection and group actions (#29), stacks (#30), and control settings with shortcut remapping (#53).
- **Multi-select in the pile viewer (#57)**, a feature issue outside the phases, when the owner chooses. Open problems that belong to later issues:
  - #29 (after V1): move the Actions button to the selected card

## Open problems

- Seat counters step one at a time. Typing an exact value (for example Life 20 to 5) could reuse the card counters' value field, as a follow-up.
- A card dragged from the table or a pile into a hand always goes to the end of the hand. Only a drag within the hand chooses a place.
- Dragging to reorder the hand by touch needs a check on an iPhone, like the other touch drags.

- The iOS field zoom fix (#66, A11Y-12) needs a check on an iPhone: the E2E checks font sizes, not Safari's zoom itself.
- A card's menu opened by a touch hold doesn't take focus, the same as a pile's: the browser's own mousedown after a touch moves focus back to the card.
- The enlarge preview is sized in CSS px, so it shrinks with browser zoom like the rest of the page. The table's own zoom doesn't change it, as TT-9 asks (checked with the owner).
- The enlarge preview's hover runs on a mouse only. The preview closes when the table scrolls or zooms, rather than following the card.
- Until Phase 4 layouts, "landscape" in TT-9 means a card turned on the table. Landscape layouts will need the preview's size to swap.
- In the counters dialog, typing a minus in the value field steps it down rather than typing a negative number. Values below zero are reached with − or the arrow keys.
- Counter pills scale with the table's zoom like the Actions button, so below 100% they're under 24px tall. C and the card menu always work.
- Merging piles by touch needs a check on an iPhone, like the other touch drags.
- A pile's menu opened by a touch hold doesn't take focus, because the browser's own mousedown after a touch moves focus back to the pile. A tap outside closes it. Enter on the pile, or a right-click, opens it with focus in the menu.
- A screen reader's "activate" sends a click, so it draws rather than opening a pile's menu. The pile's description says Enter opens actions, and every draw is announced and can be undone. Check this with VoiceOver on a phone.
- Touch holds on piles, and Space with iOS Full Keyboard Access, need a check on an iPhone. The touch E2E runs in Chromium only.
- In E2E, axe skips the faded, dashed placeholder a dragged pile leaves behind (`.card-drag-origin`), because its name text is faded on purpose until the drop.
- The toolbar's "Fit all cards (0)" also fits piles now. Its label could say so if that confuses.
- Unit tests that draw only the table move the Solo piles out of the way (`pilesOutOfTheWay` in `actions/testing.ts`), so cards still auto-place from the top-left there.
- Dragging doesn't scroll the table when the pointer nears its edge. To drop beyond the visible table, pan or zoom out first.
- The touch drag E2E test runs in Chromium only, because Playwright sends multi-step touches through Chromium's DevTools protocol. Unit tests cover the touch rules, and iOS needs a check on a phone.
- The hand's "Drop: Player 1's hand" label sits mid-tray, so the dragged card can cover it. The ring and tint still show.
- The Actions button and card overlays scale with the table's zoom, so below 100% the button is smaller than 24 × 24px (A11Y-8 counts default zoom only). Enter and right-click always work. Revisit if it's a problem in play.
- A card turned a quarter at the table's left or top edge reaches up to 25px past the mat edge, because it turns around its centre. Placing keeps cards inside the edge (`clampToTable`), but turning a card in place doesn't move it.
- Pile viewer cards can be dragged to a spot on the table, but the keyboard can't choose a spot straight from the viewer or peek, because those dialogs would have to close first. Send the card to the table, then press Space on it.
- A card dragged out of the pile viewer keeps the viewer's 150px size under the pointer, not the table card's size at the current zoom.
- Dragging from the pile viewer by touch needs a check on an iPhone, like the other touch drags.
- In jsdom, the search in a Move to… dialog opened from the hand card menu doesn't always get focus before typing, so unit tests type into it directly. Browsers focus it, and the E2E covers that.
- `axe` scrolls the table while it checks contrast, so E2E tests that click cards after an axe check scroll the table back first.
- **Saving undo history (PS-2, Phase 6):** each step is a whole game, so plain JSON would repeat the card definitions in every step. Phase 6 needs a compact form, such as saving definitions once or saving the differences between steps.
- Local WebKit on macOS skips buttons when tabbing, unlike CI's Linux WebKit, so the keyboard-only E2E tests that press Tab fail locally in WebKit only. Use Chromium locally, as BP-4 says, and trust CI for WebKit.
- E2E: under the full suite's load, `e2e/move-dialog.spec.ts` (keyboard only) and `e2e/manage-piles.spec.ts` (keyboard only) each failed once in 3a and passed on rerun and alone. Watch for flakiness.
- The search-match highlight uses the board's `#FBE3A6` with ink text, which isn't a token. Add a highlight token if the design gets one.
- axe's label-in-name check joins text from separate blocks with no spaces, so a button containing a whole card face fails it. The viewer and table cards avoid that with the overlay pattern.
- In this cloud environment the pinned `@playwright/test` wants a newer Chromium than the one installed. Local E2E ran with a scratch config pointing `launchOptions.executablePath` at `/opt/pw-browsers/chromium`. That config isn't committed, and CI is unaffected.
- The form error colour uses `--seat-a` (5.4:1 on the panel), because the tokens have no error colour. Add an error token if the design gets one.
- **Reload is two clicks, not one:** "Reload <file>…" reopens the file picker, because browsers can't re-read a chosen file. A true one-click reload needs the File System Access API, which works in Chromium only and falls back to the picker elsewhere. That fits with Phase 6, where the file handle can be saved with the game.
- The default card face uses the UI font, not the sample card's Bitter, which would be another font dependency. Phase 4 layouts will set card fonts.
- The shared-pile back colour `#3F433D` isn't a design token. The design has no shared seat, so add a token if the design gets one.
- Dark theme isn't wired up. `tokens.css` has `[data-theme="dark"]` values, but nothing sets `data-theme` yet. #39 (3n) follows the system setting, with a toggle once Settings exists.
- PR preview clean-up leaves an empty `pr-preview/pr-N/.nojekyll` on `gh-pages`. It's harmless (the URL returns 404), but it could be tidied later.
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
| 2026-10-26 | Menus fit the viewport: below, else above, else capped to the roomier side and scrolling with inner shadows | Always opening below | The owner's MacBook showed the pile menu running past the bottom of the screen. The owner asked for scrolling with an inner shadow when a menu can't fit. |
| 2026-10-26 | Phase 3 split into 3a to 3l (#23 to #34), with undo first | One Phase 3 issue | Each fits one session and one PR (BP-2). Undo first means every later action gets it for free. |
| 2026-10-26 | Undo history saves the whole game before each action | Saving how to reverse each action | Actions are already pure, so nothing changes in them, and undo after a shuffle is exact by construction |
| 2026-10-26 | Actions that change nothing add no undo step | A step for every dispatch | Undo should always change something you can see |
| 2026-10-26 | Undo and Redo stay focusable with `aria-disabled` and announce why when there's nothing to do | `disabled` buttons, as on the board | Focus doesn't drop after the last undo. Matches "Draw stays enabled and announces why". |
| 2026-10-26 | Undo shortcuts do nothing in fields or while a dialog or menu is open | Undoing anywhere | Fields keep their own undo, and open dialogs hold card lists an undo would make stale |
| 2026-10-26 | Keep the delete-pile confirmation for now | Dropping it now that undo exists | The owner chose to revisit it with Undo toasts in 3d |
| 2026-10-26 | Icon buttons get our own `Tooltip`, shown on hover and on keyboard focus | The browser's `title` tooltip | `title` is slow, differs between browsers and never shows on focus or touch. The owner's review found it showed nothing. |
| 2026-10-26 | Card face state is `side: 'front' \| 'back' \| 'down'` | A `faceUp` flag plus a back flag | One value can't contradict itself, and flipping (3d) just changes it |
| 2026-10-26 | Table order is the stacking order, with no z numbers | A z-index on each card | Bring to front and send to back are list moves, and z values can never clash |
| 2026-10-26 | A card put on the table without a position goes in the first free grid cell | Stacking every card at one spot | New cards never land on top of others |
| 2026-10-26 | Face-down names include the owner: "Face-down card, Player 1" | Only "face-down card", as A11Y-6 says | The card back already shows whose it is, so it's the same information sighted players have. The owner confirmed it. |
| 2026-10-26 | Table card names are short: name, face and rotation | The full card text the viewer reads | Arrowing across the table would read whole rules boxes. The details command (3d) reads every column. The owner confirmed it. |
| 2026-10-26 | Piles stay in their row in 3b, and moving piles onto the table is its own issue (#37) | Doing it in 3b | It needs positions, drag and keyboard moves for piles, so it builds on 3c, 3e and 3f. The owner asked for it not to be lost. |
| 2026-10-26 | Bringing a focused card to the front is visual only (CSS) | A bring-to-front action | Focus shouldn't create undo steps or change the game |
| 2026-10-26 | Table cards show the focus ring after a click as well as keyboard use, and focus themselves on click | Only `:focus-visible`, as for other controls | The focused card is the current card that keys and the card menu act on, so it must be visible. Safari doesn't focus buttons on click. The owner's review found clicking showed nothing. |
| 2026-10-26 | Dark theme split from 3c into #39 (3n) | Doing it in 3c | Checking every screen in dark is unrelated to pan and zoom. The owner agreed. |
| 2026-10-26 | Zoom, scroll and snap are view state, outside the game and the undo history | Making them game actions | They change how you look at the table, not the game |
| 2026-10-26 | Shift+arrow keys pan; plain arrows stay for moving between cards | Plain arrows pan when the empty table has focus | One key, one meaning, wherever focus is. 3e uses plain arrows to move a picked-up card. The owner agreed. |
| 2026-10-26 | Ctrl/⌘+wheel and pinch zoom; a plain wheel scrolls | A plain wheel zooms | Trackpad two-finger scrolling sends wheel events, so a plain wheel zoom would stop trackpad panning. It matches Figma and Miro. The owner agreed. |
| 2026-10-26 | Fit all never zooms in past 100% | Fitting a few cards at up to 200% | A couple of cards shouldn't blow up. The owner agreed. |
| 2026-10-26 | The snap grid is half an auto-placement cell (71 × 96px) | A fine grid such as 16px | Snapped cards line up with auto-placed rows and columns, or sit halfway between them |
| 2026-10-26 | The app fills the window at 768 × 600 and up; smaller screens scroll the page with a 60dvh table | Always filling the window | On phones, the wrapped piles and the hand would leave almost no table |
| 2026-10-26 | Keyboard E2E tests reach controls with `tabTo`, not a fixed number of Tab presses | Counting Tab presses | Every new toolbar button broke the counts |
| 2026-10-27 | Auto-placed rows are as wide as the visible table, passed to actions as `ActionContext.placementColumns` | A fixed 6 columns; a width in the game state | The owner's wide screen showed half an empty table. The width is outside the game, and the context already carries outside inputs to actions. |
| 2026-10-27 | Hand card menu split from 3d into #41 (3d-2) | One 3d PR | The table card menu, actions, Details and the toast already filled a session. The owner agreed. |
| 2026-10-27 | Move to… in the card menu opens the dialog | The board's submenu | `Menu` has no submenus, and the dialog already searches and works by keyboard. The owner agreed. |
| 2026-10-27 | Ctrl/⌘+D duplicates a focused table card, as on the board | Another key, because browsers bookmark with it | It's blocked only while a table card has focus. The owner agreed. |
| 2026-10-27 | The Actions button shows on the current card until selection exists (3g) | Only on selected cards | Touch and mouse need a way to open the menu now. The owner agreed. |
| 2026-10-27 | Empty piles delete without asking, with an Undo toast | Always asking first | Undo exists now, and the brief asks for a toast instead of confirmations. A pile with cards still asks where they go. The owner agreed. |
| 2026-10-27 | Duplicates are flagged and skipped when a reload counts copies | Counting them | Otherwise duplicating a token would make a reload remove a real copy from the pile |
| 2026-10-27 | The toast stays until the next action, with no timer | Disappearing after a few seconds | No time limit to read or reach Undo (WCAG 2.2.1), and Ctrl+Z works anyway |
| 2026-10-27 | A click or tap on a hand card opens its menu | Only focusing it, as on the table | Hand cards have no other click action, and the issue asked for it. The owner agreed. |
| 2026-10-27 | Hand card names are short: the name, plus ", double-faced" | The full card text | Full text is in Details…, as on the table. The owner agreed. |
| 2026-10-27 | `Menu` shifts left to stay on screen | Fitting only vertically | Menus opened from cards near the right edge ran off a phone screen |
| 2026-10-27 | Placing shows an outline you move, then Place or Enter; a tap moves the outline instead of placing at once | A tap placing straight away | One mistap doesn't move a card, and the keyboard and pointer paths are the same steps |
| 2026-10-27 | Space picks up a table card, on keyup | A letter key | Space is the usual key for picking something up to move it. On keyup, the same press doesn't also click the outline. |
| 2026-10-27 | "Choose a spot" is offered only from the table and the hand | Also from the pile viewer and peek | Those are modal, and closing peek puts its cards back, so placing from them is its own change |
| 2026-10-27 | Arrows move the outline 16px, Shift+arrows a whole card; with snap on, one or two grid steps | Pixel steps only | Fine control and quick travel, and snapped steps line up with the grid |
| 2026-10-27 | Dragging uses pointer events and a copy of the card that follows the pointer | HTML5 drag and drop, or a drag library | HTML5 drag doesn't work for touch on iOS, and no new dependency is needed |
| 2026-10-27 | Touch drags start after resting on a card for 250ms | Starting on any touch move | A swipe that starts on a card must still scroll the table |
| 2026-10-27 | Only the drop target under the pointer is highlighted | Highlighting every valid target while dragging | Every pile, the hand and the table are always valid, so highlighting them all says nothing |
| 2026-10-27 | 3f is split: 3f-1 drags table and hand cards, 3f-2 (#49) drags cards off piles | One PR | At the owner's go-ahead, to keep the PR small |
| 2026-10-27 | Piles and cards share one table surface, with no separate pile row | Keeping the pile row above the table | Owner decision: pile dragging (3f-2, 3m-2) works on the same surface as cards |
| 2026-10-27 | 3m is split: 3m-1 puts piles on the table, 3m-2 (#51) moves them; both come before 3f-2 | One PR | At the owner's go-ahead, to keep the PR small |
| 2026-10-27 | Add pile lives in the table toolbar, with a visible label | A button on the table | The table is only for cards and piles, and the toolbar is always in view |
| 2026-10-27 | Dragging a pile anywhere on its tile moves the whole pile, as dragging a card does | Dragging the pile body takes its top card | Owner decision. One meaning for a drag on the table. |
| 2026-10-27 | A click or tap on a pile draws its top card; right-click, Enter, the menu key or Shift+F10 open its menu; on touch, a held finger let go in place opens it | Click opens the menu; double-click draws; a Take top card handle | Owner decision: drawing is the most common pile action, and no extra controls clutter the table. Enter opening the menu matches table cards, where a click only focuses. |
| 2026-10-27 | No dragging the top card straight off a pile; #49 becomes dragging cards from the pile viewer | Dragging the top card off the tile | Owner decision. Click draws the card into the hand, and it can be dragged from there. |
| 2026-10-27 | Piles must never overlap; dropping one on another merges them after a confirmation, in its own issue (#56) | Letting piles stack like cards; doing it in 3m-2 | Owner decision on #54 |
| 2026-10-27 | A drag swallows the next pointer click until the next press, or a second at most | Swallowing only clicks in the same task | A touch's click arrives after the finger lifts and got through. Keyboard clicks (detail 0) are never swallowed. |
| 2026-10-27 | Feature issues no longer name a phase; PRs keep `docs/requirements.md` in step with what was built | Keeping the phase dropdown after V1 | Work after V1 isn't organised in phases, and the spec should stay accurate as decisions change during development. |
| 2026-10-27 | The pile viewer closes while a card is dragged out of it, and opens again after the drop | Fading it but leaving it modal; closing it for good | A modal makes the page inert, so drop zones can't be hit. Coming back lets you drag several cards in a row, as To hand and To table allow. Owner decision. |
| 2026-10-27 | A viewer card dropped on its own pile goes to the top; the top card is put back | Ignoring drops on its own pile | Matches Move to…'s "own pile — top". Owner decision. |
| 2026-10-27 | Multi-select in the pile viewer is its own feature issue (#57), not tied to a phase | Adding it to 3f-2 | Owner request. Keeps 3f-2 small. |
| 2026-10-27 | A pile that covers another pile merges with the one it covers most, whatever is under the pointer | Merging only when the pointer is over a pile | Piles must never overlap, and the landing spot is what decides that. The keyboard outline works the same way. |
| 2026-10-27 | Merged cards go on top by default, the kept pile stays where it is, and a merge always asks first | Bottom by default, as Delete pile does; moving the kept pile to the drop spot | Dropping one pile on another is like stacking it on top. Owner approved the defaults. |
| 2026-10-27 | The merge dialog is a mode of `DeletePileDialog` | A separate dialog | The issue asked to reuse it. They share the dialog, form and radio pattern. |
| 2026-10-27 | Selection (#29), stacks (#30) and shortcut remapping (#34 into #53) move after V1, and #61 closes Phase 3 | Building them in Phase 3 | Owner decision. #61 keeps the V1 parts of #34, including WCAG 2.1.4, which V1's AA target needs. |
| 2026-10-27 | #31 (3i) split into 3i-1 counters and 3i-2 enlarge and the double-faced badge | One PR | Too much for one session and one small PR. Owner approved. |
| 2026-10-27 | Counters belong to a card's place on the table and are cleared when it leaves | Keeping them on the card instance | Like a real game: counters come off a card that leaves play. |
| 2026-10-27 | One counters dialog lists all of a card's counters, opened by C, the menu or a pill | The board's small popover for one counter | The shared `Dialog` brings focus, Escape and phone-size behaviour, and one place handles adding, changing and removing. |
| 2026-10-27 | Every counter change is its own undo step and applies straight away | Applying the changes on Done | The board says Escape keeps the value, and each step is announced. |
| 2026-10-27 | 3i-2 enlarge opens with I, and a still touch hold on a table card opens its menu | Space (moves a card); a hold that enlarges | Owner decision |
| 2026-10-27 | The enlarge preview flips its own face, not the card's | Showing both faces at once | Owner decision: one face at a time is easier to read, and looking isn't a game action, so it's no undo step. |
| 2026-10-27 | Enlarging a face-down card by key or menu shows its front; a hover doesn't | Not enlarging face-down cards | Owner decision: a quick way to check a hidden card. A passing hover mustn't reveal it. |
| 2026-10-27 | Escape on a focused card or pile moves focus to the table | Leaving focus on the card | Owner decision. Focus stays in the table region, so the keyboard isn't lost. |
| 2026-10-27 | Hover-plus-key actions are their own issue (#71) | Building them in #70 | Single-letter keys without focus need an off switch under WCAG 2.1.4 (#61, #53). Owner approved. |
| 2026-10-27 | A hover preview stays open while the pointer is over it, and Escape closes it | Closing as soon as the pointer leaves the card | WCAG 1.4.13: hover content must be hoverable and dismissible, and the flip button must be reachable by mouse. |
| 2026-10-27 | On touch screens, a dialog's focus goes to a button, never straight to a text field | Autofocusing the first field everywhere | Owner rule: the keyboard sliding up is jarring. Done in the counters dialog; the other dialogs follow in #68. |
| 2026-10-27 | Fix iOS field zoom with 16px text on touch screens only (#66) | `maximum-scale=1` in the viewport tag; 16px on every screen | `maximum-scale` also blocks pinch zoom, which fails WCAG 1.4.4. Keeping desktop at the design's 15px and 14px leaves the boards matched where they were drawn. |
| 2026-10-27 | Make the V1 data model ready for games, card sets and accounts, with no backend in V1 ([decision record](decisions/0001-v1-data-model-ready-for-accounts.md), #69) | Accounts in V1; leaving the model and migrating later | Avoids save migrations and a storage rewrite after V1, while V1 stays complete on its own. |
| 2026-10-27 | A play session is a "session" | "Playtest", as #45, #65, #67 and #69 proposed | Owner decision: clearer and more flexible. "Game" means the card game being designed. |
| 2026-10-27 | The UI copy and code renames are one issue (#73) | Two issues, as #69 proposed | The UI had no "game" copy for a play session left to rename. |
| 2026-10-27 | #33 (3k) split into 3k-1 seat counters and 3k-2 dice, coin and roll log | One PR | There was no log dock yet, so it was too much for one small PR. Owner approved. |
| 2026-10-27 | Seat counters are stepped with buttons and keys on the buttons, with no page-wide shortcut | New single-letter shortcuts | Page-wide single-letter keys wait on the WCAG 2.1.4 fix in #61. |
| 2026-10-27 | Dice and the log are shown on demand: a Dice & coins dialog, and a Session log item in a menu on the session's name | The design's always-open right dock (HANDOFF decisions 2 and 3) | Owner decision: neither is needed all the time, and the dock takes table space. |
