# Proxy — design handoff

This folder holds everything needed to build Proxy's UI:

- `brief.md`: the design brief, covering scope, screens, components, interaction and accessibility rules.
- `tokens.css`: colour, type, spacing, radius and shadow tokens for light and dark themes.
  - `ui-placement.md`: where every current and planned feature lives, and the UI-1 to UI-8 rules issues cite. Read it before adding any control.
- `mockups/*.dc.html`: the design canvas source, one file per board.

Live canvas (view only): https://claude.ai/artifact/SXNrbAZTgX6KJxAbFFVGxp

## How to read the mockups

The `.dc.html` files are reference designs, not app code. Each one is HTML with inline styles. The sample data and computed values live in a `class Component` script block at the bottom. `{{hole}}` placeholders pull values from that script, and `<sc-for>` and `<sc-if>` are loops and conditionals. Read them for exact sizes, colours, copy and structure. Don't copy the templating.

| File | Board |
| --- | --- |
| `Main.dc.html` | Table, mid-game. This is the main reference: toolbar, seat bar, table, piles, cards, hand tray and log dock. |
| `TableDark.dc.html` | The same table in the dark theme, with the card enlarge preview open |
| `ActionMenu.dc.html` | Card action menu with the "Move to" submenu |
| `MoveDialog.dc.html` | Move to… dialog, filtered by search |
| `PileViewer.dc.html` | Pile viewer sheet with search and filters |
| `CardStates.dc.html` | Every card, card back, counter and pile state |
| `DesignSystem.dc.html` | Tokens, type, seat identity, motion, focus and icons |
| `Card.dc.html` | Sample card face. Stands in for user-built layouts and is not app chrome. |
| `FuturePlacement.dc.html` | Future-state placement guide: principles, the places, header slots, object-action options, seat dock, workspace, phone and the feature map. Low-fidelity; `ui-placement.md` is the text version. Where it differs from `Main.dc.html` (header, seat bar, table tools), it is the direction to move towards. |

## Decisions made during design

These answer the brief's open questions or go beyond it:

1. **Hand tray** shows only the active seat. Its top edge is 3px in the seat's colour, and its header shows the seat's shape and name.
2. **Log** sits in a collapsible right dock that is 280px wide and open by default.
3. **Dice are a per-format setting** ("Uses dice", off by default). When dice are off, the dice panel and dice shortcuts don't appear at all, and the log fills the dock.
4. **Pile viewer** is a modal sheet that slides in from the right, up to 720px wide.
5. **Card size** at 100% zoom is 126 × 176 px. Names and stats are readable at that size. Full rules text is read through enlarge (Space, or hover after 400ms).
6. **Focus ring:** 2px white inside a 3px black ring. One of the two always clears 3:1 against any art or table colour. A focused card is brought to the front.
7. **Selection:** a 3px accent ring set 4px out from the card, plus a check badge. It never relies on colour alone.
8. **Overlays on cards** (counters, the double-faced badge, the stack chip) are dark pills with a white edge, so they read on any card art.
9. **Seat identity:** Ash is a triangle with diagonal-stripe backs. Briar is a circle with dot-grid backs. Environment is a square with fine-rule backs.
10. **Fonts:** Atkinson Hyperlegible Next for the UI. Atkinson Hyperlegible Mono for every number that changes, so digits never shift.
11. **Placement (Oct 29, 2026):** features get an address in `ui-placement.md` before they get UI. The header has seven fixed slots, table tools move onto the table, the seat bar and hand tray merge into a seat dock, and the log, pile viewer and card details share one side-panel slot. Decision 2 (log dock open by default) is open again; see the guide's open questions.

## Not designed yet

The brief's start and setup screens, layout editor, import results, format editor, saves and shortcuts sheet aren't designed yet. Build them from the same tokens and patterns. Dialogs follow `MoveDialog`, side sheets follow `PileViewer`, and menus follow `ActionMenu`.

## Starter prompt for Claude Code

> Read `design/HANDOFF.md`, `design/brief.md` and `design/tokens.css`, then study `design/mockups/Main.dc.html` and `design/mockups/CardStates.dc.html`. Propose a component breakdown and a state model for the table (cards, piles, hands, seats, counters, undo history) before writing code. Then build the table screen as a static client-only app. Match the mockups' sizes, tokens and accessibility behaviour: keyboard play path, focus ring, 24px minimum targets, reduced motion. Use sample data for now; leave CSV import for the next step.
