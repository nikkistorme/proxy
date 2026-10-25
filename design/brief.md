# Proxy — Design Brief

Oct 25, 2026 · @Nikki

## The brief

Design the interface for Proxy, a browser tabletop for playtesting card games that are still being designed. The design should make a busy table of cards feel calm and readable, and keep every tool one step away without covering the cards.

**What it does.** A designer loads decks from CSV files or Google Sheets. Cards are rendered through layouts the designer builds in the app, then played freely on a drag-and-drop table: drawn, moved, rotated, flipped, stacked and given counters. There are no rules built in; it's a sandbox.

**Who uses it.** One game designer at a laptop or desktop, controlling every seat (two players and an environment deck in some formats). They play long sessions, change cards often and need to read card text at a glance. The tool will also be shown publicly as a portfolio piece, so first impressions matter.

**What the design must achieve**

- The cards are the hero. Interface chrome stays quiet and out of the play area.
- Card text is readable at normal table zoom, with a quick enlarge for full detail.
- Every action is discoverable by mouse and fully usable by keyboard (see Accessibility).
- Switching between seats, piles and the layout editor feels fast and never loses your place.
- Works in light and dark themes.

## Screens

The table is home. Everything else opens over it or beside it and returns you to the same view.

&#91;embedded content: screen map · the table as hub\]

Import results, the format editor, saves and the shortcuts reference also open from the table the same way.

| Screen | What it shows | Priority |
| --- | --- | --- |
| Table | Free-form play surface with cards, piles, the active seat's hand tray, seat switcher, seat counters, dice, undo/redo, zoom controls and an action log | Must |
| Card enlarge | One card at full readable size; both faces for double-faced cards; landscape layouts turned upright | Must |
| Pile viewer | Every card in a pile, face-up, with search and column filters; move a card to the table, a hand or another pile | Must |
| Start and setup | New game: pick a format (Solo PvE, Co-op PvE, 1v1 PvP), then load a CSV file or Google Sheet URL into each pile. Also: resume last game, load demo | Must |
| Layout editor | Card canvas with drawn boxes bound to CSV columns, box properties panel, portrait/landscape toggle, live preview cycling real cards | Must |
| Import results | Rows imported, rows with problems (row, column, issue), last-fetched time for Sheets | Should |
| Format editor | Seats, piles per seat, counters and default sheet URLs for a format | Should |
| Saves | Named snapshots, JSON export and import | Should |
| Keyboard shortcuts | Reference sheet, opened with ? | Should |

## Core components

Design each with all the states listed.

| Component | Notes | States |
| --- | --- | --- |
| Card on table | MTG proportions, 63 × 88 mm (ratio 0.716). Content comes from user layouts, so the app supplies only the card's edge, shadow and overlays | Default, hover, focused, selected, dragging, rotated 90°/180°/270°, face-down, double-faced indicator, with counters, in a stack |
| Card back | Generic back for face-down cards and pile tops, distinct per seat or pile | Default, focused |
| Counter badge | Small labelled number on a card (for example "+1/+1 ×2", "Damage 3") | One, several, editing |
| Pile | Stack of card backs with name and count; top card face-down or revealed | Default, hover, focused, drop target, empty, revealed top |
| Hand tray | Docked bottom strip showing the active seat's cards, overlapping when crowded | Few cards, many cards (overflow), empty, drop target |
| Seat switcher | Shows who is active; two or three seats, each with a name and colour | Active, inactive, focused |
| Seat counters | Life and resource numbers per seat with step controls | Default, editing, changed (brief highlight) |
| Card action menu | Opens from right-click, a button on the selected card, or a key. Rotate, flip, add counter, move to…, duplicate, delete | Default, with submenu for destinations |
| Move-to dialog | Keyboard and single-pointer alternative to dragging: choose table, a hand, or top/bottom of a pile | Default, filtered by search |
| Action log | Short running list of recent actions ("Drew Ember Scout", "Rolled d20: 14") | Collapsed, expanded |
| Dice | d4 to d20 and a coin, with the result shown large for a moment | Idle, rolling, result |
| Toolbar | Undo, redo, zoom, fit all, grid snap toggle, save, layout editor, settings | Default, disabled undo/redo |
| Layout box | Drawn rectangle in the editor bound to a column; text or image | Unselected, selected with resize handles, overflow warning, contrast warning |

## Interaction notes

- **Free-form table.** No fixed rows, zones or snapping by default. Locations are ordinary cards the user arranges. Show an optional faint grid only when snapping is on.
- **Drag feedback.** While dragging, lift the card (scale and shadow) and highlight valid drop targets: piles, the hand tray, other cards for stacking.
- **Selection.** Click to select, Shift-click or marquee for many. Selected cards show one clear treatment that works on any card art.
- **Rotation.** Cards rotate in 90° steps around their centre. Landscape-layout cards enter the table portrait and are turned by hand to read.
- **Enlarge.** Hover (with a short delay), long-press, or a key shows the card at full size near the pointer or focused card, never covering the card itself.
- **Keyboard on the table.** The table is one tab stop. Arrow keys move focus between cards by position. Enter opens the card action menu, M opens Move to…, and single-key shortcuts handle rotate, flip and draw.
- **Feedback.** Every action gets a brief visible confirmation (log entry, subtle highlight) and a screen-reader announcement. Shuffles and rolls get a short motion moment, removed under reduced motion.
- **Undo everywhere.** Destructive actions (delete card, delete pile) don't ask for confirmation; they show a toast with Undo instead.

## Accessibility

The target is WCAG 2.2 AA, and the accessible play path is a headline feature of the project, not an afterthought. Show these in the designs.

- **Dragging is never required (2.5.7).** Design the Move to… dialog and card action menu as first-class UI, as polished as drag-and-drop.
- **Focus (2.4.7, 2.4.11).** A focus ring that reads on any card art and on both themes, for example a double ring (dark and light). A focused card must never be fully hidden behind other cards; bring it forward on focus.
- **Contrast (1.4.3, 1.4.11).** Text at least 4.5:1, UI components and focus indicators at least 3:1, in both themes.
- **Target size (2.5.8).** Every interactive target at least 24 × 24 CSS px, including counter steppers and card corner buttons.
- **Colour is never the only signal.** Seats, selection and drop targets also use shape, label or pattern.
- **Reduced motion.** Show what each animation becomes with reduced motion on (usually an instant change or a fade).
- **Zoom and reflow (1.4.10).** Side panels and dialogs work at 200% browser zoom and at 320 CSS px width. The table itself may scroll in two directions.

## Visual direction

Proxy should feel like a well-made physical play space translated to the screen: the table, sleeves and counters of a real game night, without skeuomorphic clutter.

- **Name.** Proxy, after the stand-in cards players make to test a deck. A wordmark or simple mark that hints at a card or a card stand-in is welcome.
- **The table surface.** A calm, low-contrast surface, like a playmat, that every kind of card art reads well against. Provide light and dark versions.
- **Chrome.** Quiet, compact toolbars and panels that dock to edges. Nothing floats over the middle of the table unless the user opened it.
- **Seat identity.** Each seat gets a colour plus a label and shape cue, used on the seat switcher, its hand tray, its piles and its card backs.
- **Type.** A highly legible UI face for controls, counters and the log, with tabular numerals for counters and dice.
- **Avoid** generic dashboard styling, neon gamer aesthetics, heavy fantasy textures and anything that competes with card art.

**Constraints**

- Desktop and laptop first (1280 px and wider). Phones must not break but aren't designed for in this pass.
- Card art and text come from the user, so overlays (selection, counters, focus) must work on any image.
- Static web app; fonts must be from Google Fonts or self-hosted.

## Deliverables

Start with the table; it sets the system for everything else.

1. **Table, mid-game** (Co-op PvE): about 15 cards in play including two landscape location cards, three piles, a hand of 6, one card selected, one focused, one with counters, one rotated, one stack. Light and dark.
2. **Card states sheet:** every card state from Core components on one board.
3. **Pile viewer** open over the table, with a search applied.
4. **Move to… dialog** and the card action menu, shown as the keyboard path for the same move as a drag.
5. **Start and setup** screens.
6. **Layout editor** with a portrait layout selected and one box being edited.
7. **A small design system:** colour tokens for both themes, type scale, spacing, focus treatment, seat colours, icons used.

Use sample cards with original, generic content (no real game's names or art). Mark which items are Must and which can wait if time runs short: items 1 to 4 are Must.

**Out of scope for this pass:** phone layouts, onboarding tutorial, marketing site, print-and-play export.

## Open questions

- [ ] Should the hand tray show only the active seat, or all seats' hands stacked with the inactive ones collapsed?
- [ ] Does the action log stay visible by default or live in a collapsible side panel?
- [ ] Any brand colours, typefaces or mood references to start from?
- [ ] Does the layout editor open as a full screen, or as a panel beside the table so changes show live on cards in play?
