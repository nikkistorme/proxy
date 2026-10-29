# Progress

## Current state

Phase 3 (Table) is done: a solo turn works by mouse and by keyboard. It was split into 3a to 3o, all under #20. Selection (#29), stacks (#30) and shortcut remapping (#34, folded into #53) moved after V1. 3a to 3f-2, 3m-1 to 3m-3, 3i (#31) and 3j (#32) are merged: undo and redo; placed table cards and table focus; pan, zoom, fit all and grid snap; the table card menu; the hand card menu; keyboard and single-pointer placement; dragging table and hand cards; dragging cards out of the pile viewer; piles on the table; moving piles, with a click on a pile drawing its top card; merging piles by dropping one on another; card counters; enlarging a card, with the double-faced badge; reordering the hand; seat counters (3k-1); dice, a coin and the session log (3k-2, closing #33); the dark theme, which follows the system setting (3n, #39); and the close-out (3o, #61): the ? shortcut reference, single-key shortcuts limited to the table, hand and toolbar for WCAG 2.1.4, the announcement audit and the solo-turn E2E. Selecting several cards in the pile viewer is its own feature issue, #57, outside the phases. The app has a favicon and an iPhone home-screen icon (#44, outside the phases).

The V1 plan now makes the data model ready for games, card sets and accounts (#69): a play session is a "session" and "game" means the card game being designed. Saves will go through a storage interface over separate items, keyed by base path and profile (AR-6, PS-7), with card sets as their own model (AR-4) and one options resolver (AR-7). The code now says "session" for a play session (#73).

The phases after 3 were reordered (2026-10-27): Phase 4 is now storage and card sets (#74), then layouts (5, #35), formats (6), session saves and Sheets (7) and polish (8). Item ids are random UUIDs so sync can come later (#45), and until V1 ships older saves are dropped rather than migrated.

Phase 4 (#74) is done, split into 4a (#84) and 4b (#85). 4a: every save goes through one storage interface (`src/storage/storage.ts`) with keys built from the base path and the "guest" profile, older saves are dropped with a notice, a browser that can't save shows a one-line notice, and options are read through one resolver (`src/options/resolver.ts`). The theme is the first option read that way, from the account settings item. 4b: loading a CSV into a pile saves a card set item, the pile records its id, and the session keeps its own copy of the definitions. Card sets are the only items the app writes so far.

Phase 5 (Layouts, #35) is split into 5a to 5j, sub-issues #88 to #96 and #111, with 5j landing before 5i. 5a (#88) is done: every card face is drawn from a layout's boxes, through the built-in default layout, which looks close to the old face. 5b (#89) is done: each card's layout is chosen by its `layout` column, then the type mapping, then the default option, and saved layouts load at start and autosave as their own items. 5c (#90) is done: a landscape layout draws sideways on the portrait card and upright, on a card turned on its side, in the enlarge preview. 5d (#91) is done: text that overflows its box shrinks to fit, down to 6 pt, then clips, and each box reports how it fit for the editor's warning (5g). 5e (#92) is done: a full-screen layout screen, opened from the toolbar or with L and loaded on first use, lists the layouts with create, rename, duplicate and delete. 5f (#93) is done: Edit on a saved layout opens it on a canvas in the same screen, where boxes are added by button or drawn by pointer, moved and resized by pointer or arrow keys, and deleted, and the layout can be turned landscape. 5g (#94) is done, in two parts. 5g-1: a box properties panel beside the card (below it on a phone) sets what the chosen box shows, a column as text or image, fixed text or a colour, and its spoken label. 5g-2: the panel sets text size, weight, font, alignment, text colour and background, and the canvas warns about clipped text and low contrast. 5h (#95) is done, in two parts. 5h-1: the canvas draws real cards from a loaded card set, with Previous and Next, so the warnings check real text. 5h-2: a Choosing layouts section below the layout list sets the default layout and a layout for each card type, the first options the app saves. 5j (#111) is done: the canvas has a 2% grid that boxes snap to by pointer and arrow keys, with a Snap to grid toggle for 1% steps and free dragging. 5i (#96) is done, which finishes Phase 5: layouts export to and import from a JSON file, with layout fixtures in `tests/fixtures/layouts/`, and E2E tests build a layout with art, name, cost and rules-text boxes by mouse and by keyboard. The close-out checked #35's acceptance criteria, the grid included.

Field errors no longer rely on colour (#42, A11Y-13, outside the phases): every field error has an icon and starts with "Error:", an invalid field shows an icon inside its right end, focused or not, and errors use the new `--error` token. Later forms reuse `FieldError` and `FieldControl` from `src/components/FieldError.tsx`.

Phase 6 (Formats, #115) is planned as 6a to 6g, sub-issues #116 to #122. 6a (#116) is done: sessions are built from a format with `createSession(format)`, the three presets are in `src/model/format.ts`, each seat's colour, shape and card back follow its place (first player, second player or environment), and the header shows the format name. The app still starts from Solo PvE until the setup screen (6c). 6b (#117) is done: each seat in the seat bar is a button that makes it the active seat, which swaps the hand tray, and S and Shift+S step to the next and previous seat. Switching isn't an undo step; undo and redo show the hand of the seat that took the action. 6c (#118) is done: **New session…** in the This session menu opens a setup dialog with the three presets (seats and piles shown), asks first when the session has cards, and starts a session from the chosen format. The choice is saved as the `defaultFormat` option, and on reload an untouched session switches to it.

## Done

### Phase 6c: Setup dialog (#118, 2026-10-29)

- The This session menu has **New session…** above Session log. It opens `SetupDialog` (`src/components/SetupDialog.tsx`) on the shared `Dialog`: the three presets as radio choices, each with its seats (shape and colour from `seatIdentity`) and piles, the current format selected and focused. Cancel and Escape return focus to the menu button; Start session moves focus to the table and announces "New 1v1 PvP session started. Player 1 is the active seat."
- A session with any cards first shows a confirm step in the same dialog ("Start a new 1v1 PvP session? The cards in this session will be cleared." with Start new session and Back). `Dialog` gained an `onCancel` prop so Back doesn't close it.
- `startSession(format, { silent })` in the store replaces the session and clears past, future, log, lastRoll, placing, drag and toast. `presetById` (falls back to Solo PvE) is in `src/model/format.ts`, and `defaultFormat` is a new option in the resolver.
- `DefaultFormat` (inside both providers) runs once when storage is ready: an untouched session (no undo steps, no cards) on a different format than the saved `defaultFormat` switches to it, silently.
- Tests: `src/components/SetupDialog.test.tsx` (SP-1), store and resolver tests, `e2e/setup.spec.ts` by mouse and keyboard with an axe scan, a reload and a 375 × 667 check.

### Phase 6b: Seat switcher (#117, 2026-10-29)

- `src/actions/seats.ts`: `setActiveSeat` makes a seat active and announces it ("Player 2 is the active seat. Hand: 3 cards." or "Environment is the active seat. It has no hand."). `neighbourSeatId` gives the next or previous seat in seat bar order, wrapping round.
- The store's `switchSeat` runs it outside the undo history and leaves the redo list alone (owner decision). Undo and redo set the active seat to the one that took the action being undone or redone, so its hand is in the tray (owner decision, 2026-10-29: revisit if it feels odd in play).
- Each seat's name in the seat bar is a button, "Player 1, active seat" or "Player 2, switch to this seat", with `aria-pressed`, styled as on the Main board: the active seat's group is outlined and lifted. Focus stays on the button after a click or Enter.
- S and Shift+S switch seats from the table, the hand or the table tools (WCAG 2.1.4), and are in the shortcut reference. Pressed in the hand, focus moves to the new seat's Draw button, or to the table if the new seat has no hand.
- The hand tray is keyed by seat, so its focus and drag state start fresh for each seat.
- Tests: `src/actions/seats.test.ts` and `src/components/SeatSwitcher.test.tsx` (FS-3), `e2e/seat-switcher.spec.ts` by mouse and keyboard with an axe scan and a 375 × 667 check.

### Phase 6a: Format model and the three presets (#116, 2026-10-29)

- `src/model/format.ts`: `Format` has seats (id, name, kind: player or environment, counters with starting values), starting piles (id, name, owning seat or shared) and Uses dice. `SOLO_PVE`, `COOP_PVE` and `PVP_1V1` are the presets (FS-1), with fixed ids `preset-solo-pve`, `preset-coop-pve` and `preset-1v1-pvp`. Player 2 starts with Life 20 and Energy 0, like Player 1.
- `createSession(format)` in `src/model/session.ts` replaces `createSoloSession`. Session seats and piles keep the format's ids, so Solo PvE builds the same session as before. Piles go along the top of the table in format order, 142 px apart. Each player seat gets an empty hand; the first player seat starts active.
- `Seat.place` is `player-1`, `player-2` or `environment`, from the seat's kind and its order among the format's player seats. `seatIdentity(place)` now takes the place, and `seatPlace(seats, seatId)` looks it up; table card views, Move to… options and pile tiles carry the place.
- `SessionState` records `formatId` and `formatName`; the header shows the format name.
- Pile names are "P1 main deck" and "P2 main deck" in every preset. The spec's format table said "P1 main" for Co-op and PvP, and now matches.
- Tests: `src/model/format.test.ts` (FS-1 for all three presets, FS-4 starting counters, identity by place). Every existing test passes with only the factory call changed.

### Planning: Phase 6 split (#115, 2026-10-28)

- **Issues:** parent #115 with sub-issues 6a to 6g (#116 to #122), each with requirement IDs, scope, out of scope and acceptance criteria.
- **Owner decisions:** the format editor renames seats but doesn't add or remove them in V1; the app keeps opening on the table with the last format set up until Phase 7 adds Resume; switching seats isn't an undo step.
- **Left out of Phase 6:** default Sheet URLs on formats and Resume (Phase 7), the demo (#63), exporting and importing formats.
- **Changed requirements:** FS-2, FS-3, and the decision log.

### Error identification beyond colour (#42, 2026-10-28)

- **Token:** `--error` in `design/tokens.css`, `#B42318` light (6.0:1 on `--bg`, 6.6:1 on `--panel`) and `#FF8A80` dark (7.9:1 and 7.2:1). Field errors no longer borrow `--seat-a`.
- **Pattern (`src/components/FieldError.tsx`, `Form.css`):** `FieldError` shows an error icon (24px grid, 1.8 stroke, round caps, hidden from screen readers), a bold visible "Error:", then the message. Fields point `aria-describedby` at it, so they read "Error: …". `FieldControl` wraps a field and, while it's invalid, shows the same icon inside its right end. The red 2px border stays while the field has focus, and focus adds a 2px accent ring outside it. In forced colours both icons take the text colour.
- **Where:** the pile name and pile count dialogs, the counters dialog's two name fields, the layout name dialog, the card type field in Choosing layouts, the colour and size fields in box properties, and a refused layout import's message. The layout editor's clipping and contrast warnings were left as they are (out of scope).
- **Owner decisions:** the icon inside the field rather than a thicker border, and a visible "Error:" rather than one for screen readers only.
- **Changed tests:** unit and E2E checks of error descriptions now expect the "Error: " prefix.
- **Tests:** `FieldError.test.tsx` (A11Y-13) and `e2e/field-errors.spec.ts`: the pile name, pile count and card type errors with axe scans, the icon inside the field while focused, forced colours, and a 375 × 667 check.
- **Changed requirements:** A11Y-13 (new), and the Phase 8 row now lists A11Y-7 to A11Y-13.

### Phase 5i: Layout export, import and the Phase 5 close-out (#96, 2026-10-28)

- **The file (`src/model/layoutFile.ts`):** `layoutsToFile` writes `{ "format": "proxy-layouts", "version": 1, "layouts": [...] }`, each layout with its id, name, orientation and boxes, but no save time or save version. `readLayoutFile` refuses the whole file if it isn't JSON, isn't a Proxy layouts file, is from a newer version, or has a layout or box that isn't valid, with a message naming it. `mergeImportedLayouts` keeps ids, so a layout with the same id is replaced, and gives a copy name to an imported layout whose name another layout or the built-in Default uses.
- **The screen (`src/editor/LayoutFiles.tsx`):** a Layout files section between the layout list and Choosing layouts, with Export layouts (greyed out while there are no saved layouts, still focusable, and saying so if pressed, like the canvas's Delete box) and Import layouts…, which opens a `.json` file picker. Each result is shown under the buttons and announced. On a phone the two buttons share a line. Imported layouts save through `saveLayout`, so they go through the storage interface.
- **Fixtures (QA-4):** `tests/fixtures/layouts/` has `two-layouts.json` (a portrait layout with art, name, cost and rules-text boxes, and a landscape one with fixed text), `not-json.json`, `wrong-format.json` and `bad-box.json`.
- **Tests:** LY-9 cases in `layoutFile.test.ts` and `LayoutEditor.test.tsx`. `e2e/layoutExport.spec.ts` exports by keyboard, clears the saved data, imports the downloaded file and checks the saved layouts match the fixture exactly, then imports by mouse with a refused file and an axe scan, and checks the buttons at 375 × 667. `e2e/layoutBuild.spec.ts` (QA-5, build a layout) builds art, name, cost and rules-text boxes by keyboard only, with arrow keys in grid steps, and by mouse with snapped drawing and an axe scan. Each path makes the layout the default and checks Troll on the table draws with it, art included.
- **Phase 5 close-out (#35):**
  - Export, clear browser data and import restores layouts exactly: `e2e/layoutExport.spec.ts` checks it.
  - A layout with art, name, cost and rules-text boxes can be built by mouse and by keyboard, the grid included: `e2e/layoutBuild.spec.ts` checks it. The "under five minutes without documentation" part is a person's check, in the PR's How to test steps.
  - A custom layout renders cards on the table and is still there after a reload: checked in 5b, and again here.
  - The sheet-mocking criterion has nothing to check yet: Google Sheets come in Phase 7.
- **Changed requirements:** LY-9.

### Phase 5j: Grid on the layout canvas (#111, 2026-10-28)

- **New sub-issue (owner request):** #111 was added to #35 after 5h, to land before 5i so the close-out checks it. Owner decisions: the grid is fixed (5% at first, then 2% after the owner's review), a toggle turns snapping off, and boxes off the grid stay put until moved.
- **Geometry (`src/model/layoutBoxes.ts`):** `GRID = 2`. `stepBox` and `stepSize` take an arrow key to the next grid line, so a box at 31% goes right to 32% and left to 30%. Shift moves the right or bottom edge the same way, keeping boxes at least 2%. `snapPoint` snaps a pointer to the nearest line, so drawn boxes and dragged corners land on lines. `dragBox` snaps a moved box's top-left corner. Add box still steps a new box 2% past one already there, which is a grid step. With snapping off, everything is as before: free dragging and 1% steps.
- **Canvas:** a **Snap to grid** checkbox after Delete box, on to start. The editor keeps it while you move between layouts, but it isn't saved. Turning it on or off is announced, and the hint line changes to match. While it's on, faint grid lines in the `--divider` token show under the card face (owner review: the first lines were too strong and crossed boxes), so boxes with a background cover them and text draws over them. The grid layer is hidden from screen readers and sits under the pointer layer.
- **Changed tests:** the 5f keyboard E2E now expects grid steps (26%, 42% and so on) and Tabs past the toggle, and the 5h preview E2E Tabs past it too. One LY-2 unit test turns snapping off to keep checking 1% steps.
- **Tests:** LY-2 grid cases in `layoutBoxes.test.ts` and `LayoutCanvas.test.tsx` (the toggle, arrow keys from off-grid boxes, a snapped pointer draw), and `e2e/layoutGrid.spec.ts`: lining two boxes up edge to edge by keyboard, then a 1% nudge with snapping off; a snapped draw and drag by mouse with an axe scan; and a 375 × 667 check in the dark theme.
- **Changed requirements:** LY-2.

### Phase 5h-2: Choosing layouts by type (#95, 2026-10-28)

- **Saving options (AR-7, `src/storage/StorageProvider.tsx`):** `useSetOption()` sets an option at the account level. Every reader gets it at once, then the one settings item (id `account`) is saved through the storage interface. An option set before the startup check finishes wins over the saved one. A failed save is silent and keeps the option for the visit, like layouts. These are the first options the app writes.
- **Card types (`cardTypes` in `src/model/card.ts`):** each `type` in the loaded cards, fronts and backs, once each ignoring case and outer spaces, sorted. `SessionScreen` passes them to the layout screen.
- **The section (`src/editor/LayoutChoices.tsx`):** "Choosing layouts", below the layout list, with a line saying the `layout` column comes first, then the type, then the default.
  - **Default layout:** a picker with "Default (built in)" and every saved layout.
  - **Card types:** a row per type, with the loaded types and any already mapped (stored lowercased, so those show lowercased when no loaded card has them). Each picker starts at "Use default layout", which removes the mapping. A mapping to a deleted layout shows as "Use default layout", which is what the card gets. A picker's name is "Layout for Monster cards".
  - **Add type:** a Card type field and Add type button, so a type can be mapped before a CSV is loaded. A blank or listed type shows an error. A new type's picker takes focus. Hand-added types that aren't mapped are forgotten when the screen closes.
  - Each change is announced ("Monster cards use Villain.") and reaches cards on the table at once (LY-10).
  - On a phone, each picker goes on its own line under its type.
- **Tests:** an AR-7 case in `StorageProvider.test.tsx`, LY-8 cases in `card.test.ts` and `LayoutEditor.test.tsx` (mapping and clearing, the default, mapped types with no cards and deleted layouts, adding types), and `e2e/layoutTypes.spec.ts`: the keyboard path, with the table following and the choice lasting after a reload; the default by mouse with an axe scan; and a 375 × 667 check.
- **Changed requirements:** LY-8 (where the mapping and default are set) and AR-7 (setting an option).

### Phase 5h-1: Preview with real cards (#95, 2026-10-28)

- **Split (owner decision):** 5h is two PRs. 5h-1 previews layouts with real cards (LY-7). 5h-2 adds the screen that maps card types to layouts (LY-8), which also needs the first way to save an option. #95 stays open until 5h-2.
- **Which cards (`src/model/preview.ts`):** `previewCardSets` lists each card set loaded into a pile, in pile order, with its cards in file order. Cards no longer in the CSV are left out. A double-faced card counts twice, front then back ("Wolf form, back"), since both faces are drawn through layouts. Two sets from files with the same name are told apart by pile ("deck.csv (P1 main deck)").
- **The preview row:** centred below the card, so it never pushes the card down, and after the boxes in Tab order. It has Previous card, the card's name with "2 of 3", and Next card. Stepping wraps at either end and is announced ("Previewing Ogre, 2 of 3."). With more than one set loaded, a Card set picker comes first. The name stays on one line and truncates, so stepping never moves or resizes the card. The editor keeps the chosen card while you go back to the list and open another layout. The choice isn't saved.
- **The canvas** draws the previewed card instead of the "[column]" sample. The clipped-text and contrast warnings follow, so a box with no value on this card has no warnings. With no CSV loaded, the sample stays and a line says "Load a CSV into a pile to preview the layout with real cards".
- **Tests:** `preview.test.ts`, LY-7 cases in `LayoutCanvas.test.tsx` (stepping and wrapping, warnings following the card, choosing a set and keeping the card, the no-CSV line), and `e2e/layoutPreview.spec.ts`: the keyboard path, the mouse path with an axe scan, and a 375 × 667 check that the row fits below the card, the card still fits the screen, and stepping doesn't resize it.
- **Changed requirements:** LY-7.

### Phase 5g-2: Text styles and box warnings (#94, 2026-10-28)

- **Text styles (LY-4):** text boxes get Size (pt, 4 to 72 in 0.5 steps), Weight (Regular, Medium, Semibold, Bold), Font (Text or Numbers), Align (Left, Centre, Right), Vertical align (Top, Middle, Bottom) and Text colour. Font and the alignments are small radio groups drawn like Portrait / Landscape. A size out of range shows an error and isn't saved.
- **Background:** text and image boxes have a No background checkbox, and a hex field with a picker when it's unticked (white to start). Colour boxes keep their one Colour field.
- **Clipped text (LY-4):** the canvas passes `onFit` to the card and remembers each box's fit. A box whose text still overflows at 6 pt gets ", text clipped" in its name.
- **Contrast (A11Y-9, `src/model/contrast.ts`):** a text box's colour is checked against its own background, else the nearest box drawn below it that covers it whole, else white. Text over an image isn't checked, nor are colours that aren't hex. The bar is 4.5:1, or 3:1 for large text (18 pt, or 14 pt and bold). A failing box gets ", low contrast 2.1 to 1" in its name, rounded down so a failing ratio never reads as passing.
- **How warnings show:** a ⚠ badge, a dark pill with a white edge like the number chip, in the box's top-right corner on the canvas; the box's name; and a line of text at the top of the panel saying what's wrong and what to do. The panel's warnings stay in view while it scrolls. A box with no text to draw has no warnings.
- **Tests:** `contrast.test.ts`, LY-4 and A11Y-9 cases in `LayoutCanvas.test.tsx` (every style by keyboard, size errors, which boxes get which controls, a clipped box with a stubbed measure, contrast on and off), and `e2e/layoutBoxStyles.spec.ts`: the style keyboard path through to a reload, real clipped-text and contrast warnings with an axe scan, and a 375 × 667 check that the style controls fit.
- **Changed requirements:** LY-4 (the controls and ranges) and A11Y-9 (what the contrast warning checks against, and the bars).

### Phase 5g-1: Box content (#94, 2026-10-28)

- **Split (owner decision):** 5g is two PRs. 5g-1 sets what a box shows (LY-3, LY-5). 5g-2 sets the text styles (LY-4) and adds the clipped-text and contrast warnings (A11Y-9). #94 stays open until 5g-2.
- **The panel (owner decision, `src/editor/BoxProperties.tsx`):** a 320px column right of the card, always there, so choosing a box never resizes the card. It says "Choose a box on the card to set what it shows" until one is chosen, then "Box 1 properties". Below 720px wide it sits under the card, the card keeps a steady 55% of the small viewport height (`svh`, so Safari's toolbars don't resize it), and the screen scrolls. It follows the boxes in Tab order. When it scrolls, Firefox stops on the panel itself first so it can be scrolled by keyboard.
- **What a box shows:** a Shows radio group, with Column as text, Column as image, Fixed text and Colour. Switching kind and back keeps the column or text typed before.
  - **Column (owner decision):** a text field that suggests the columns of the loaded cards (`cardColumns` in `src/model/card.ts`, from `SessionScreen`). It works with no CSV loaded. Names are matched like CSV headers, ignoring case and outer spaces. Commas separate alternatives, and the first with a value shows, as the default layout's rules box does.
  - **Fixed text:** a text area.
  - **Colour:** a hex field beside the browser's colour picker, so a colour can always be typed. A hex code that isn't a colour shows an error and isn't saved. A new colour box starts at the default layout's plate colour, `#e3e7ee`.
  - **Spoken label:** for text boxes, read before the box's text (`box.label`). An empty field removes it.
- **On the canvas:** each box's name says what it shows ("Box 1, shows cost, at …", "Box 2, colour, at …", "Box 3, empty, at …"). Until the live preview (5h), the sample card shows each text column's name in brackets, such as "[cost]", so a box's place and style show (`sampleFace` in `src/model/layoutBoxes.ts`).
- **Tests:** `layoutBoxes.test.ts` (column parsing, descriptions, sample face, hex colours), `card.test.ts` (column suggestions), LY-3 and LY-5 cases in `LayoutCanvas.test.tsx` (every property by keyboard, suggestions, keeping values across kinds, refusing a bad hex), and `e2e/layoutBoxProperties.spec.ts`: the keyboard path through to a reload, a mouse path with an axe scan, and a 375 × 667 check that the panel sits below the card, the card keeps its size and nothing scrolls sideways.
- **Changed requirements:** LY-3 (the panel, alternative columns, spoken label) and LY-5 (colours by hex code or picker).

### Phase 5f: Editor canvas (#93, 2026-10-28)

- **List and canvas (owner decision):** each saved layout's row has an Edit button ("Edit Hero") that swaps the list for the canvas in the same full-screen dialog (`src/editor/LayoutCanvas.tsx`). The built-in Default has no Edit, so it's duplicated to change it. The canvas has Back to layouts, the layout's name, a Portrait / Landscape radio pair, Add box, and Delete <box>. Delete stays in place, dimmed and `aria-disabled`, while no box is chosen, so choosing one doesn't reflow the tools and resize the card (owner review: on iOS the card shrank). Back to layouts, or Esc on the canvas, returns to the list with focus on that row's Edit button. Esc on the list still closes the screen. New layout is hidden while the canvas shows.
- **The canvas (LY-2):** the card is drawn from the layout, upright for landscape, as large as the space allows (a `ResizeObserver` on the stage), with a 1px `--control` edge so it shows against the screen in the dark theme too (owner review). The sample card face is hidden from screen readers. Over it each box is a button, "Box 1, at 30% across, 40% down, 40% wide, 20% tall", with a dashed edge (dark outside, light inside, so it shows on any card colour) and a number chip. The chosen box has an accent edge and four corner handles with 24px hit areas.
- **Keyboard (owner decisions):** Add box puts a 40% × 20% box in the middle of the card (stepped 2% down and right past a box already there) and focuses it. Arrow keys move the focused box 1% of the card, Shift + arrow keys resize it from its top-left corner (Right and Down grow it), and Delete or Backspace removes it. Each step is announced. After a delete, focus goes to the box that took its place, else the one before, else Add box. A 5% step with Alt could follow if 1% feels slow.
- **Pointer:** a drag on empty card draws a box (shorter than 2% each way counts as a click and draws nothing). A drag on a box moves it after 3px of travel, and a drag on a handle resizes from that corner with the opposite one fixed. The canvas has `touch-action: none`, so drawing by touch doesn't scroll. Pressing a box focuses it, for Safari.
- **Geometry (`src/model/layoutBoxes.ts`):** boxes stay on the card, at least 2% each way, with values rounded to 0.01% so steps don't drift. New boxes are empty text boxes, so they draw nothing on cards until 5g gives them content.
- **Saving:** every change goes through `saveLayout`, so it autosaves a second later and reaches cards on the table (LY-10). There's no undo in the editor: that's #102, after V1 (owner decision).
- **Tests:** `src/model/layoutBoxes.test.ts`, `src/editor/LayoutCanvas.test.tsx` (keyboard add, move, resize and delete, orientation, pointer draw, move and resize), and `e2e/layoutCanvas.spec.ts`: the keyboard path through to a reload, the mouse path with an axe scan, and a 375 × 667 check that the tools and the whole card fit in both orientations.

### Phase 5e: Layout list (#92, 2026-10-28)

- **Full screen (owner decision):** the layout screen (`src/editor/LayoutEditor.tsx`) is a full-screen modal `<dialog>` over the table, which stays as it was underneath. Back to table or Esc closes it, and focus goes back to where it was. It opens from the toolbar's Card layouts button (the Main board's icon) and with L, a page-wide single key like D and ? (WCAG 2.1.4), listed in the ? reference.
- **Loaded on first use (PF-3):** `SessionScreen` loads it with `React.lazy`, so its code is its own chunk (about 2 KB gzipped) fetched the first time it opens.
- **The list (LY-1):** the built-in Default comes first, which can only be duplicated, then the saved layouts sorted by name. Each row has a small card thumbnail, the name, the orientation and box count, and Rename, Duplicate and Delete buttons named for the layout ("Rename Hero").
  - New layout adds a blank portrait layout, "Layout 1", "Layout 2" and so on. Duplicate makes "<name> copy" ("copy 2" and on if taken), the built-in layout included. Both focus the new row's Rename button.
  - Rename (`LayoutNameDialog`) refuses an empty name or one another layout has, ignoring case and outer spaces, with Default counted as taken, because the `layout` column picks a layout by name (LY-8). On a touch screen it doesn't focus the field.
  - Delete asks first (`DeleteLayoutDialog`), then focus moves to the next row, the one before, or New layout. Cards that used the layout fall through to their next one (LY-8).
  - Each action is announced in a live region inside the screen, since a modal dialog hides the page's own.
- **Model and storage:** `src/model/layoutNames.ts` has the name check and `newLayout` and `duplicateLayout`. `useLayouts().deleteLayout(id)` removes the layout at once, drops a save still waiting for it and deletes its item. A layout deleted before storage is ready isn't brought back by the first read.
- **Enter in the rename field:** it submits on keydown, and the closing dialog hands focus back to the row's Rename button, which the same key's keypress then clicked in Chrome, reopening the dialog. The screen ignores a keyboard click on Rename from the key that just renamed. The keyboard E2E covers it.
- **Tests:** `layoutNames.test.ts`, LY-1 cases in `LayoutsProvider.test.tsx` (delete, a dropped waiting save) and `LayoutEditor.test.tsx` (the list, create, rename with refused names, duplicate, delete and cancel with focus, toolbar and L), and `e2e/layoutEditor.spec.ts` (the whole keyboard path with a reload, PF-3's chunk loading only on open, a mouse path, and 375 × 667: full screen, the list scrolls inside, no sideways scroll, dialog buttons visible).
- **Changed requirements:** LY-1 (the screen, names, the built-in layout, delete) and A11Y-4 (the L key), plus a decision-log entry for the full-screen editor.

### Phase 5d: Shrink-to-fit text (#91, 2026-10-27)

- **Shrink-to-fit (LY-4):** `CardFace`'s text boxes measure themselves before they paint. Text taller or wider than its box drops to the largest size, to within a quarter point, that fits, down to `MIN_TEXT_PT` (6 pt). Text that still overflows stays at 6 pt and the end clips. A box set below 6 pt never grows. The search is `fitTextSize` in `src/model/layout.ts`.
- **Every width:** the fitted size is in points, so it's worked out again when the face width, the text, the style or the box size changes, and once more when the bundled fonts finish loading. It works the same on table, hand, viewer and enlarge faces, and on a landscape layout's turned canvas.
- **Padding:** a text box's padding follows its set size (`--box-size`), so shrinking only frees room for text.
- **For the editor (5g):** each text box has `data-fit="shrunk"` or `data-fit="clipped"`, and `CardFace` takes `onFit(boxId, { size, clipped })`, called after each fit.
- **Tests:** LY-4 cases in `layout.test.ts` (the search) and `CardFace.test.tsx` (mocked measurements: unchanged, shrunk with its padding, clipped at 6 pt, `onFit`), and in `e2e/layouts.spec.ts` (shrinks and clips on table cards, a landscape card on the table and enlarged, 375 × 667 without sideways scroll). The TT-9 phone E2E from 5c now waits two frames after focusing the card before pressing I: on a narrow screen, focus scrolls the table, and that scroll closed the preview as it opened.
- **Changed requirements:** LY-4 (the 6 pt minimum, padding, every width).

### Phase 5c: Landscape layouts (#90, 2026-10-27)

- **On the card (Layouts orientation):** `CardFace` draws a landscape layout's boxes on an 88 × 63 mm canvas (`.card-face__canvas`) turned 90° anticlockwise inside the portrait card, so a card turned once on the table (clockwise) reads upright. Box percentages are of that canvas; text sizes in points are unchanged. Hand, piles, viewer and dialogs show the same portrait card.
- **Enlarged (TT-9):** `CardFace` takes `upright`, which shows a landscape layout unturned on a card turned on its side. `CardEnlarge` passes it, so a landscape card's preview is 302 × 216 px, upright however the card sits on the table. On a phone narrower than about 360 px it shrinks to fit. The footer follows the preview's width, and the preview is placed again when a flip changes the orientation.
- **Tests:** landscape cases in `CardFace.test.tsx`, a TT-9 case in `LayoutsProvider.test.tsx` (sideways on the table, 302 × 216 when enlarged), and two in `e2e/layouts.spec.ts` (text runs up the table card and across the enlarged one; at 320 × 568 the preview fits with no sideways scroll).
- **Changed requirements:** TT-9 (the preview's swapped size), the Layouts Orientation paragraph (the turn direction, percentages of the canvas, portrait everywhere but the preview), and the landscape open question, marked answered.

### Phase 5b: Layout choice, storage and autosave (#89, 2026-10-27)

- **Choosing a layout (LY-8):** `chooseLayout` in `src/model/layoutChoice.ts` takes the saved layout named in the `layout` column (case and outer spaces ignored), then the layout the card's `type` maps to, then the default layout option, then `DEFAULT_LAYOUT`. A name or id that matches nothing falls through.
- **Options (AR-7):** the resolver has `layoutByType` (lowercased type to layout id, empty by default) and `defaultLayout` (a layout id, or `null` for the built-in layout). They're read from the account settings item through `useOption`.
- **Layouts in the app:** `LayoutsProvider` (`src/layouts/LayoutsProvider.tsx`, inside `StorageProvider` in `App`) lists the saved `layout` items once storage is ready. `useLayoutFor(face)` and `useLayoutChooser()` give the chosen layout. `CardFace` uses it when no `layout` prop is passed, so every face (table, hand, piles, viewer, dialogs, enlarge) follows it, and the pile viewer's card names read through it.
- **Saving (PS-1, LY-10):** `saveLayout(layout)` from `useLayouts()` updates the app at once, so every card using that layout redraws, then saves only that item, one second after its first unsaved change (`LAYOUT_SAVE_DELAY`), so at most once a second. Waiting saves are written on `pagehide`. The editor (5e onward) will call it.
- **Not stored on cards (AR-4):** a card's layout is worked out from its columns each time it's drawn, so edits and mapping changes reach cards in play.
- **Tests:** `layoutChoice.test.ts`, new AR-7 cases in `resolver.test.ts`, `LayoutsProvider.test.tsx` (table cards over memory storage: the column, the mapping and default from settings, redraw on save, one save per second for the changed item only, save on `pagehide`), and `e2e/layouts.spec.ts` (a layout seeded in IndexedDB draws a table card and is still there after a reload; 375 × 667 without sideways scroll).
- **Changed requirements:** LY-8 (name matching, the default option, fall-through), AR-4 (no layout id on table cards), AR-7 (the layout options).

### Phase 5a: Layout model and renderer (#88, 2026-10-27)

- **Layout model (LY-3, LY-5, LY-6):** `src/model/layout.ts` has `Layout` (a stored item), `LayoutDesign` (what draws), `LayoutBox` and `BoxStyle`. Box position and size are percentages of the card. A box shows a column as text or image, fixed text, or a solid colour. Text sizes are points on the 63 mm wide card (`CARD_WIDTH_PT`), so they scale with the card. A box can carry a `label`, read before its text by screen readers ("Cost 2").
- **Column lists:** a column box lists columns and shows the first that isn't empty. The built-in default uses that so `text`, `rules`, `rules text` and `card text` all show as rules text, and `image`, `card art` and `art` as art. The editor will set one column.
- **Renderer:** `CardFace` takes an optional `layout` (the default is `DEFAULT_LAYOUT`) and draws its boxes in order. A column box with nothing to show is left out, background and all, except image boxes, which keep the CD-6 placeholder. Every place that shows a face is unchanged.
- **Labels:** `layoutLabel` reads text boxes top to bottom, then left to right. The default layout gives the same labels as before.
- **Shared column reading:** `faceValue` in `src/model/card.ts` reads a column (`name`, `image`, `layout`, `type` or a field). The pile viewer's filters use it too.
- **Tests:** `layout.test.ts` and new LY-3, LY-5 and LY-6 cases in `CardFace.test.tsx`.
- **Changed requirements:** LY-3 (the built-in default's column lists) and LY-4 (font size in points, weight, horizontal and vertical alignment, colours, and the bundled sans or numbers font; no font choice in V1).

### Phase 4b: Card set model (#85, 2026-10-27)

- **Card set item (AR-4):** `src/model/cardSet.ts` has `CardSet` (a stored item with `name`, `source: { kind: 'file', name }` and `definitions`), the session's `CardSetSummary`, `fileCardSet` and `cardSetItem`. The saved set holds only the cards in the CSV as last loaded. Definitions flagged `missing` stay in the session for the copies still in play.
- **Piles record their set:** `Pile.sourceName` is now `Pile.cardSetId`, and `SessionState.cardSets` holds each loaded set's name and source. `SessionState.definitions` stays as the session's own copy (decision below). The pile menu's "Reload deck.csv…" reads the name from `cardSets`.
- **Saving:** `SessionScreen.loadFile` uses the pile's `cardSetId`, or `newItemId()` on a first load, passes it to `loadPile` and then calls `storage.put('cardSet', …)`. A reload updates the same item and takes the new file name (CD-5 matching is unchanged). If storage isn't ready yet or the save fails, the session carries on with its copy.
- **Tests:** `cardSet.test.ts`, AR-4 tests in `loadPile.test.ts`, and two `App.test.tsx` tests over memory storage: a load saves one set with a UUID, and a reload updates that set and keeps its definition ids.
- **Changed requirements:** AR-4 (the session keeps a copy; load creates and reload updates the set), SP-2 (the file name comes through the card set).

### Phase 4a: Storage interface, profile keys and options resolver (#84, 2026-10-27)

- **Storage interface (AR-6):** `createStorage(backend)` in `src/storage/storage.ts` gives `get`, `put`, `list` and `delete` by item kind. `put` stamps `updatedAt` and `version` (`SAVE_VERSION`, now 1), and `newItemId()` makes UUIDs. Under it is a plain key-value backend: `indexedDbBackend()` (`idb-keyval`, the only file that touches IndexedDB) or `memoryBackend()` for tests. Both live in `src/storage/backends.ts`.
- **Profile keys (PS-7):** `itemKey` builds `basePath|profile|kind|id`, with `import.meta.env.BASE_URL` and "guest". The separator after the base path keeps `/proxy/` from matching `/proxy/pr-preview/…` when listing.
- **Older saves (PS-5 before V1):** reading an item with an older version deletes it and calls `onDropped`. The app then shows "Saves from an older version of Proxy were removed." An item from a newer version is skipped but kept.
- **Storage unavailable (PS-6):** `StorageProvider` checks at start that the backend can save. If not, it switches to memory and `StorageNotice` shows "This browser can't save right now, so progress won't be saved." under the header (a `role="note"` line, tokens only).
- **Options resolver (AR-7):** `resolveOption` checks session, game, then account, then `DEFAULT_OPTIONS`. `useOption` reads the account level from the settings item (fixed id `account`, `ACCOUNT_SETTINGS_ID`). The theme now comes from `useOption('theme')` in `App`, so `main.tsx` no longer calls `applyTheme`.
- **Swapping storage (AR-6 pass):** `App` takes an optional `storageBackend`. A test seeds memory storage with a dark theme and the app reads it.
- **Tests:** `storage.test.ts` (keys, UUIDs, the interface on both backends with `idb-keyval` mocked, the drop rule, the save check), `resolver.test.ts`, `StorageProvider.test.tsx` (App reads through memory storage; both notices), and `e2e/storage.spec.ts` (IndexedDB blocked by an init script: notice, axe, the table still works, 375 × 667 without sideways scroll).
- **Changed requirement:** AR-6 (one-per-profile items have a fixed id).

### Planning: phase order after Phase 3 (2026-10-27)

- **New order:** 4. Storage and card sets (#74), 5. Layouts (#35), 6. Formats, 7. Session saves and Sheets, 8. Polish. The requirements' phase table, AR-4 and the open problems here now use these numbers. Done entries below keep the numbers they had at the time.
- **Changed requirements:** AR-6 (item ids are random UUIDs, ids inside an item stay local), PS-5 (older saves are dropped, not migrated, until V1 ships), and the phase table rows for Phases 4 to 8.
- **Issues:** #35 has a comparison with the repo and a suggested split. #74 is retitled as Phase 4 and lists the sync-ready item rules.

### Phase 3o: Shortcut reference and Phase 3 close-out (#61, 2026-10-27)

- **Shortcut reference (A11Y-4):** `ShortcutsDialog` lists every shortcut in six groups (anywhere; table, hand and toolbar; card on the table; pile; moving on the table; card in the hand). It opens with **?** and from a new Keyboard shortcuts (?) button at the end of the table tools, with the Main board's help icon and kbd style, and focus goes back to where it was. The list is hand-kept in `SHORTCUT_GROUPS`, beside the key handlers.
- **Scrolling by keyboard:** `Dialog` has a new `bodyLabel` prop. It makes the body a named region and the first tab stop, so arrow keys and Page Down scroll a long read-only list in every browser, including Safari. Its focus ring is drawn inside, so the dialog's edge can't clip it.
- **WCAG 2.1.4:** `inShortcutScope` in `shortcutScope.ts` lets D, ?, +, −, 0 and G work only while focus is in the table (`.session__main`, which holds the table and the hand) or the table tools. In the seat bar, the header or with nothing focused they do nothing. Ctrl and ⌘ shortcuts still work anywhere. Card, pile and hand keys already needed focus.
- **Announcement audit (A11Y-5):** `actions/announcements.test.ts` runs all 28 game actions mid-turn and checks each changes the session and returns a whole sentence. All passed, so no action needed a fix. Undo, redo, rolls and the view keys (zoom, fit, snap) were already announced. Panning isn't, because it only scrolls.
- **Tests:** `Shortcuts.test.tsx`; `e2e/shortcuts.spec.ts` (keyboard path, axe, 2.1.4, and 375 × 667); `e2e/solo-turn.spec.ts`, a solo turn by mouse and by keyboard only (draw, play, rotate, a counter, Life, Move to…, a roll, ? and undo); and the dialog joins the dark-theme axe pass. Unit and E2E tests that pressed D or G with nothing focused now focus the table, hand or toolbar first.

### App icon (#44, 2026-10-27)

- **Favicon (AR-8):** `public/favicon.svg` is the header mark redrawn on a 32px grid so it reads at 16px: a thicker, longer-dashed stand-in and two text lines instead of three. Colours are the `tokens.css` hex values, and an inline `prefers-color-scheme: dark` switches to the dark values, so the dashed outline stays visible on dark tabs.
- **Fallbacks:** `favicon-32.png` for browsers without SVG favicons (Safari before 26), so none falls back to the domain root's `/favicon.ico`, and a 180 × 180 `apple-touch-icon.png` on solid `--bg` for iOS home screens. Both PNGs were rendered once from the SVG with Playwright and committed, with no build step.
- **Links:** in `index.html` as root paths into `public/`, which Vite's build prefixes with `base`, so they resolve under `/proxy/` and `/proxy/pr-preview/pr-N/`.
- **Tests:** `e2e/favicon.spec.ts` checks each link's path is under the base and each file loads with the right type, and that the SVG has its dark version. The smoke test's axe check covers the page.

### Phase 3n: Dark theme (2026-10-27)

- **Following the system (A11Y-9):** `applyTheme` in `src/theme.ts` sets `data-theme` on `<html>` from `prefers-color-scheme` before the first render, and follows changes while the app is open. It takes a preference (`system`, `light` or `dark`) so the Settings toggle can use it later. `index.css` sets `color-scheme` to match, so native controls and scrollbars follow.
- **Colours:** the dark values in `design/tokens.css` were already right on every screen. The one fix is the toast's hover tint, which was a fixed white and vanished on the dark theme's light toast. It now uses the toast's text colour. Card faces, backs and the dark pills on cards stay the same in both themes, as the design says.
- **Checked against TableDark** in the browser at 1440 × 900.
- **Tests:** `theme.test.ts`, and `e2e/dark-theme.spec.ts`: axe with zero violations in dark on the import results, game screen, table and hand card menus, counters, enlarge, Move to…, toast, peek, Add pile, dice and the session log, and the game screen and pile viewer at 375 × 667. It also checks that the theme switches while the app is open.

### Phase 3k-2: Dice, coin and session log (2026-10-27)

- **Rolling (TT-14):** `roll` in `actions/dice.ts` rolls d4 to d20 or flips a coin with the injectable random source, and announces "Rolled d20: 14." or "Flipped a coin: heads."
- **Store:** `roll` in the store logs and announces each result and keeps the latest for the dialog. The log (`log`, last 50 entries) sits beside the undo history, not in the session, so a roll is never an undo step and undo can't reroll. Its entries are `{ id, text, at }`, so other actions can join it later.
- **Dice & coins:** a button at the seat bar's right end, shown when the session's `usesDice` is on (on in the Solo preset). Its dialog has the 7 buttons and the latest result shown large, with a short pop that's off under reduced motion. Focus starts on d20 and stays on the button rolled, so Enter rolls again.
- **This session menu:** a menu button after "Solo PvE" in the header, labelled "This session" until sessions have names. Its one item, **Session log**, opens a dialog listing entries newest first with "just now" or "3 min ago".
- **Tests:** `dice.test.ts`, new store tests, `DiceAndLog.test.tsx`, and `e2e/dice.spec.ts` (keyboard only, axe on both dialogs, and both at 375 × 667).

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

- **Phase 6 (Formats, #115):** split into 6a to 6g, sub-issues #116 to #122. 6a (#116), 6b (#117) and 6c (#118) are done. Each of the rest starts only with the owner's go-ahead, 6d next.
  - 6d (#119): saved formats as their own items, and a Formats screen with duplicate, rename and delete.
  - 6e (#120): format editor for seats, piles and Uses dice.
  - 6f (#121): format editor for seat counters.
  - 6g (#122): close-out, a 1v1 PvP session set up and played by mouse and keyboard.
- **After V1, in this order:** the demo on its own path (#63), the card set library (#67), games (#65), then accounts and sync (#45). #45's docs-only step 1 (confirming Supabase, writing the accounts requirements) can happen any time.
- **#71: keys act on the hovered card or pile when nothing on the table has focus**, an owner request from the #70 review. Single-letter keys without focus need an off switch (WCAG 2.1.4), so it goes with #53.
- **#68: no text-field focus on touch screens in the other dialogs** (Move to…, pile viewer, Draw/Mill/Peek count, pile name). It isn't tied to a phase, and the owner chooses when.
- **After V1, as feature issues:** selection and group actions (#29), stacks (#30), and control settings with shortcut remapping (#53).
- **Multi-select in the pile viewer (#57)**, a feature issue outside the phases, when the owner chooses. Open problems that belong to later issues:
  - #29 (after V1): move the Actions button to the selected card

## Open problems

- Saved layouts load a moment after the page starts, so cards may first draw with the built-in layout and then switch.
- Keyboard E2E tests that check focus (counters, Move to…, the solo turn) sometimes fail when the whole suite runs locally at full load. They fail on `main` too and pass on a rerun, so they're timing-related, not from a change.
- A layout save or delete that fails is silent: the layout stays as it is in the app for the visit. The layout screen could say so, perhaps with the storage notice.
- The pile viewer isn't code-split yet, although PF-3 asks for it. Only the layout editor is.
- Only card sets and layouts are saved so far. Nothing reads card sets back yet: the card library (#67) will list them. A theme choice needs the Settings screen, so the theme option can only be seen with hand-made data.
- Undoing a CSV load reverts the session but leaves the saved card set as loaded. The set belongs to the library, not to the session.
- A card set saved before the startup storage check finishes (the first moments after the page loads) isn't saved. The session still has its copy.
- Loading a different file into a pile updates that pile's card set and renames it after the new file, rather than making a new set. The card library (#67) may want to split them.
- The storage notice can't be dismissed. It's one line, and it matters for the whole visit, but a close button could come with the Settings screen.
- Page-wide single keys (D, S, ?, zoom, fit, snap) need focus in the table, the hand or the table tools (WCAG 2.1.4). Straight after the page loads, or after a click on the seat bar, D and S do nothing until you Tab or click into the table. An off switch with #53 could let them work everywhere for those who want it.
- The shortcut reference is a hand-kept list (`SHORTCUT_GROUPS`), so a new key needs adding there too. Remapping (#53) would make one list drive both.
- The session log lists only rolls for now. The goal is every action (owner, 2026-10-27), which could reuse each action's announcement.
- The session log isn't saved yet. Phase 7 should save it with the session.
- The session log's times are worked out when it opens, so they don't tick while it stays open.
- Seat counters step one at a time. Typing an exact value (for example Life 20 to 5) could reuse the card counters' value field, as a follow-up.
- A card dragged from the table or a pile into a hand always goes to the end of the hand. Only a drag within the hand chooses a place.
- Dragging to reorder the hand by touch needs a check on an iPhone, like the other touch drags.

- The iOS field zoom fix (#66, A11Y-12) needs a check on an iPhone: the E2E checks font sizes, not Safari's zoom itself.
- A card's menu opened by a touch hold doesn't take focus, the same as a pile's: the browser's own mousedown after a touch moves focus back to the card.
- The enlarge preview is sized in CSS px, so it shrinks with browser zoom like the rest of the page. The table's own zoom doesn't change it, as TT-9 asks (checked with the owner).
- The enlarge preview's hover runs on a mouse only. The preview closes when the table scrolls or zooms, rather than following the card.
- A layout file holds layouts only. The default layout and the type mapping are options, so they aren't exported. Games (#65) or the session bundle (Phase 7) could carry them.
- Importing replaces a layout with the same id without asking first. Exporting first keeps a copy.
- The layout editor has no undo yet (#102, after V1). A box deleted by mistake has to be drawn again.
- axe's target-size check fails when two box buttons on the canvas overlap, which layouts often need (a plate under a name). The E2E draws its boxes apart. Arrow keys and the box list in Tab order reach every box.
- The contrast warning treats an empty card as white, and only counts a box below as the backdrop when it covers the text box whole. Text over two part-covering boxes is checked against the next box that covers it whole, or white.
- The Size field saves each valid size as it's typed, so typing 90 saves 9 before showing the error for 90.
- The native colour picker needs a check on an iPhone. The hex field always works.
- A type can only be mapped to a saved layout, not to the built-in Default. Mapping to Default while the default option is another layout would need the built-in layout to have an id.
- Mappings for types no longer in any CSV stay listed until set to Use default layout. There's no remove button.
- Dragging a box snaps its top-left corner only, so a box with an off-grid size keeps its right and bottom edges off the grid until it's resized.
- The preview row's card name truncates on narrow screens. Its full text is in the step announcement and a tooltip.
- The preview shows only cards loaded in this session. Saved card sets from earlier visits aren't listed until the card library (#67) reads them back.
- Box number chips sit over the top-left of each box, so on small boxes or a phone they can cover the first letters of the box's text.
- Drawing, moving and resizing boxes by touch needs a check on an iPhone. The E2E uses a mouse.
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
- **Saving undo history (PS-2, Phase 7):** each step is a whole game, so plain JSON would repeat the card definitions in every step. Phase 7 needs a compact form, such as saving definitions once or saving the differences between steps.
- Local WebKit on macOS skips buttons when tabbing, unlike CI's Linux WebKit, so the keyboard-only E2E tests that press Tab fail locally in WebKit only. Use Chromium locally, as BP-4 says, and trust CI for WebKit.
- E2E: under the full suite's load, `e2e/move-dialog.spec.ts` (keyboard only) and `e2e/manage-piles.spec.ts` (keyboard only) each failed once in 3a and passed on rerun and alone. Watch for flakiness. `e2e/counters.spec.ts` (keyboard only) did the same in 4a: a focus check failed once in the full run and passed six times alone. `e2e/solo-turn.spec.ts` (keyboard only) fails about one run in eight when its two tests run in parallel, on main as well (found in 4b): after Move to… from the hand, ? sometimes opens no shortcut reference. It passes when run alone. In 5g-1 it also failed alone, in about one run in five with `--repeat-each 8 --workers 1` (main: one in 35 at the same time), at the same step. Nothing in 5g-1 runs on the table, so this looks like the same race made more likely by timing.
- The search-match highlight uses the board's `#FBE3A6` with ink text, which isn't a token. Add a highlight token if the design gets one.
- axe's label-in-name check joins text from separate blocks with no spaces, so a button containing a whole card face fails it. The viewer and table cards avoid that with the overlay pattern.
- In this cloud environment the pinned `@playwright/test` wants a newer Chromium than the one installed. Local E2E ran with a scratch config pointing `launchOptions.executablePath` at `/opt/pw-browsers/chromium`. That config isn't committed, and CI is unaffected.
- **Reload is two clicks, not one:** "Reload <file>…" reopens the file picker, because browsers can't re-read a chosen file. A true one-click reload needs the File System Access API, which works in Chromium only and falls back to the picker elsewhere. That fits with the card library (#67), where the file handle can be saved with the card set.
- Shrink-to-fit measures each text box on every card as it draws. A table full of long-text cards hasn't been timed; boxes that fit at their set size cost one measurement.
- The default layout has square corners on its plates and the cost and stats pills, since boxes have no corner radius (LY-4 doesn't list it).
- The shared-pile back colour `#3F433D` isn't a design token. The design has no shared seat, so add a token if the design gets one.
- The dark theme follows the system only. A manual light/dark toggle goes in the Settings screen when it exists (`applyTheme` already takes the choice).
- The 32px PNG favicon fallback uses the light colours only, so on a dark tab in an older browser its dashed outline is faint. Browsers with SVG favicons use the SVG's dark version.
- The dark theme is set by the app's script, so on a slow load the page background can show light for a moment first. An inline script in `index.html` would fix that if it's noticeable.
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
| 2026-10-27 | Rolls go in a session log outside the undo history, and aren't undo steps | Rolls as session actions that undo removes | Undo would allow rerolls, and the log should keep what happened. |
| 2026-10-27 | The header's session menu says "This session" until sessions have names | The format name, or no menu until then | Owner decision. |
| 2026-10-27 | Dark-theme axe checks live in one spec, `e2e/dark-theme.spec.ts`, that visits every screen | Running the whole E2E suite again in dark | Keeps CI time about the same. Colours come from tokens, so a screen that passes in dark here passes wherever it's used. |
| 2026-10-27 | The dark E2E waits for animations to end before running axe | Turning motion off | axe read fading-in text as low contrast. Waiting checks the real final colours. |
| 2026-10-27 | App icon: an SVG favicon with a dark version, plus a 32px PNG fallback and a PNG Apple touch icon, all static in `public/` | A `favicon.ico`, or generating PNGs in the build | A PNG link covers browsers without SVG favicons and stops requests to the root `/favicon.ico`. Rendering once with Playwright needs no new dependency. |
| 2026-10-27 | Page-wide single keys work only while focus is in the table, the hand or the table tools (WCAG 2.1.4) | An on/off switch for single keys | Owner decision (#61). No setting to save before Phase 6. The switch comes with #53 and #71. |
| 2026-10-27 | The shortcut reference's list is the first tab stop in its dialog | Focus on the close button | A long read-only list must scroll by keyboard in Safari, which doesn't focus scroll areas by itself. |
| 2026-10-27 | Storage and card sets (#74) become Phase 4, ahead of layouts | Storage after layouts and formats | Layouts, formats and the resolver all save something; storage first avoids stand-in state, export-only layouts and rewiring the layout preview onto card sets |
| 2026-10-27 | Until V1 ships, older saves are dropped with a notice, not migrated | Migrations from the first save | Models keep changing through Phases 5 to 7; migrations start at V1, before sync makes old data expensive to drop |
| 2026-10-27 | After V1: #63, #67, #65, then #45 | Accounts earlier | Sync needs every item kind settled, and #45 builds on the demo path, games and card sets |
| 2026-10-27 | One-per-profile items, such as the account settings, use a fixed id; everything else gets a UUID (AR-6) | A UUID for every item | The same settings item on two devices should stay one item when sync arrives |
| 2026-10-27 | Storage is a thin layer (keys, stamps, the drop rule) over a key-value backend | One full implementation per store | Keys and the PS-5 rule live in one place, so the IndexedDB and memory versions can't drift |
| 2026-10-27 | If the browser can't save, the app keeps going on memory storage | Turning saves off | Callers use one interface either way, and the notice says progress won't be kept (PS-6) |
| 2026-10-27 | A session keeps its own copy of the card definitions, and each pile records its card set's id (AR-4, #85) | Referencing the card set only | Works offline, survives a deleted set, and a Phase 7 session save is complete on its own |
| 2026-10-27 | Reloading a pile updates the card set it records, even from a differently named file | A new set per file name | Keeps one set per pile until the card library (#67) can manage sets |
| 2026-10-27 | A card's layout is worked out from its columns each time it's drawn, not stored on table cards (LY-8, AR-4, #89) | A layout id on each table card | Owner decision. Edits and mapping changes reach cards in play (LY-10) |
| 2026-10-27 | Layout autosave is per item: one second after a layout's first unsaved change (PS-1) | One timer for all layouts | A change rewrites only that layout's item, and each item saves at most once a second |
| 2026-10-27 | A landscape layout's canvas turns 90° anticlockwise on the portrait card (#90) | Clockwise | Turning on the table goes clockwise, so one turn makes it read upright |
| 2026-10-28 | The layout editor is a full screen over the table (#92) | A panel beside the table | Owner decision. A panel has no room on a phone for the canvas, box settings and preview; edits show on the table when it closes (LY-10) |
| 2026-10-28 | Layout names are unique, ignoring case and outer spaces, and "Default" is taken (LY-1) | Allowing duplicate names | The `layout` column picks a layout by name (LY-8), so two layouts with one name couldn't both be chosen |
| 2026-10-28 | The built-in Default layout can't be edited, only duplicated (LY-2, #93) | Editing it in place | Owner decision. It's every card's last fallback, so it stays as built |
| 2026-10-28 | Arrow keys move and resize boxes by 1% of the card (LY-2) | 0.5%, or a larger step | Owner decision. A 5% step with Alt can follow if 1% feels slow in testing |
| 2026-10-28 | Boxes can be deleted with Delete or Backspace and a Delete <box> button (LY-2) | Leaving deletes for later | Owner decision. Otherwise a box added by mistake can't be removed |
| 2026-10-28 | No undo in the layout editor for V1 (#102) | Building it into 5f | Owner decision. Undo comes after V1 |
| 2026-10-28 | 5g split into 5g-1 (what a box shows) and 5g-2 (text styles and warnings) | One PR | Owner decision. Smaller PRs to test |
| 2026-10-28 | Box properties sit in a column beside the card, below it on a phone, and are always shown (LY-3) | A bottom sheet on phones | Owner decision. The card never resizes when a box is chosen |
| 2026-10-28 | A box's column is a text field with suggestions from loaded cards; commas separate alternatives (LY-3) | A drop-down of loaded columns only | Owner decision. Layouts can be built before a CSV is loaded |
| 2026-10-28 | The contrast warning checks a text box against its own background, the nearest box below that covers it whole, or white, and skips text over images (A11Y-9) | Sampling the drawn card's pixels | Pixel sampling needs a canvas render per box. Layouts mostly put text on a plate that covers it |
| 2026-10-28 | 5h split into 5h-1 (preview with real cards) and 5h-2 (type mapping) | One PR | Owner decision. The mapping also needs the first option save, so it's its own PR |
| 2026-10-28 | The layout preview steps through a double-faced card's back as its own step (LY-7) | Fronts only, or a Front / Back switch | Backs are drawn through layouts too, and one Next button reaches every face |
| 2026-10-28 | Type mapping and the default layout sit in a Choosing layouts section below the layout list (LY-8) | A separate screen or a Settings screen | One place for everything about layouts, and no Settings screen exists yet |
| 2026-10-28 | Card types can be added by name before a CSV is loaded (LY-8) | Only types from loaded cards | Matches the Column field: layouts can be set up before a CSV is loaded |
| 2026-10-28 | The canvas grid is fixed at 2%, with a Snap to grid toggle, and boxes off the grid stay put until moved (LY-2, #111) | 5% (the first version), a grid size setting, or a held key to skip snapping | Owner decisions. 5% was too coarse in review |
| 2026-10-28 | The grid is drawn under the card face in the `--divider` colour (LY-2) | Lines over the card, dark and light for any card colour | Owner review: the lines over the card were too strong and crossed boxes. Card faces have no background of their own, so the grid sits on the screen colour |
| 2026-10-28 | Snapping is on to start and isn't saved; the grid shows only while it's on (LY-2) | Saving it as an option, or always showing the grid | A per-visit tool setting like the preview card. Hiding the grid tells you snapping is off |
| 2026-10-28 | Dragging a box snaps its top-left corner, not whichever edge is nearest | Snapping the nearest edge | Simple and predictable. Boxes made on the grid have grid sizes, so their other edges land on lines too |
| 2026-10-28 | Layout files keep layout ids, and an import replaces a layout with the same id (LY-9) | New ids on every import, or asking about each clash | Restores layouts exactly after clearing data, so the type mapping and default layout still find them. Owner approved the plan |
| 2026-10-28 | An import is refused whole if any layout or box in it is wrong | Importing the valid layouts and skipping the rest | Never brings in half a layout, and the message names what's wrong |
| 2026-10-28 | An invalid field shows the error icon inside its right end, and "Error:" is visible (A11Y-13, #42) | A thicker border; "Error:" for screen readers only | The icon shows in greyscale, with focus and in forced colours, and the visible label helps without colour. Owner's choice |
| 2026-10-28 | The new requirement is A11Y-13, not the A11Y-12 the issue proposed | — | #66 had already used A11Y-12 for the iOS field zoom rule |
| 2026-10-28 | Phase 6 split into 6a to 6g (#115); seats renamed but not added or removed; the app opens on the table with the last format; switching seats isn't an undo step | Adding seats in V1; a start screen in Phase 6; switching as an undo step | Owner decisions while planning Phase 6 |
| 2026-10-29 | Session seats and piles keep the format's own ids, and seat identity follows `Seat.place` (#116) | New ids for every session; identity by seat id | Solo PvE builds the same session as before, so saved ids and tests stay valid, and a renamed or re-id'd seat still gets its place's colour and shape |
| 2026-10-29 | Undo and redo make the seat that took the action active (FS-3, owner) | Keeping whichever seat is active | The tray then shows the hand the undo changed. Revisit if it feels odd in play. |
| 2026-10-29 | Starting a new session clears undo history and isn't undoable; on reload the saved default format applies only while the session is untouched (#118, owner) | Making a new session an undo step; always switching to the default format on load | The confirm step is the guard, and a reload must never replace a session being played |
