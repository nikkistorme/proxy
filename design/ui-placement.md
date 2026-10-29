# Proxy — UI placement guide

Oct 29, 2026 · Draft 1

Every feature gets an address before it gets a button. This guide sets out the places features live in, the rules for choosing between them, and where every current and planned feature goes. Issues cite the rule IDs (`UI-n`) the same way they cite requirement IDs.

Visual reference: `design/mockups/FuturePlacement.dc.html` (low-fidelity, uses `tokens.css`). New dialogs follow `MoveDialog`, side sheets follow `PileViewer`, menus follow `ActionMenu`.

## Principles

- **UI-1: Place by what it acts on.** A feature goes where its object lives: a card, pile, stack, selection, seat, the session, the view, a library item or the person. Never "the header, because there was room".
- **UI-2: One action registry.** Every action is registered once, with its id, label, shortcut, the objects it applies to and a can() check. Menus, the command palette, #53 settings and announcements all read from it (extends AR-1, AR-2).
- **UI-3: The header has seven slots, total.** Back, Session ▾, Undo/Redo, Panels, Share, ⌘K, Account. A new feature goes inside a slot's menu or panel, never in a new slot.
- **UI-4: Show only when it applies.** Controls that depend on state (dice, Reload all, Share, the avatar) are hidden, not greyed out, when they don't apply. Same pattern as #106's tester mode.
- **UI-5: One side panel at a time.** Log, Piles and Details share the right-hand slot as tabs. Opening one replaces the other, so the table is never covered twice.
- **UI-6: Menus have a fixed shape.** Primary actions first, then groups divided by what they do, with destructive actions last. #53 can reorder and hide items within that shape.
- **UI-7: The palette lists everything.** Ctrl/⌘ K finds every registered action and place, whatever the menus are set to. This is #53's guarantee that no action becomes unreachable.
- **UI-8: The workspace is for editing, the table is for playing.** Editing reusable things (card sets, layouts, formats, setups) happens in the Library. The table only links to it ("Edit layout", "Open card set").

## Two modes

- **Play mode (the table):** full-screen table. Header, table tools, selection bar, one side panel and the seat dock sit around it.
- **Workspace mode (everything else):** a side rail (Home, Library, Settings, games list, account) with pages and full-screen editors. Home is organised by game; a game is a filter over sessions and Library items, not a separate area.
- The app keeps opening on the last session. Back on the table goes to Home.

## The places

| Key | Place | For | Holds |
| --- | --- | --- | --- |
| A | Header | Session-wide, always reachable | Seven fixed slots (section 03). Session menu, undo/redo, panel tabs, Share, palette, account. |
| B | Table objects | Card, pile, stack | Context menu (right-click, Enter, long-press) for one object. Click behaviour is set by #53. |
| C | Table tools | The view | Zoom, fit, snap, dice, shortcut help. Six at most, on the table surface. |
| D | Selection bar | 2+ selected things | Floats above the selection. Five actions + More. The same component is used in the pile viewer. |
| E | Side panel | Needs room while playing | Tabs: Log (with rewind and snapshots), Piles (the pile viewer), Details (the focused card's fields, counters, layout). |
| F | Seat dock | Belongs to a seat | Seat switcher, that seat's counters, its hand. Future seat-private things go here. |
| G | Rail | Getting around the workspace | Home, Library, Settings; the games list; account status in the footer. |
| H | Pages | Lists of things | Home (games and sessions), Library (card sets, layouts, formats, shared setups as tabs), Settings. |
| I | Editors | Making things | Card set grid, layout editor, format editor, game options. Full screen, one at a time, with Back to the page they came from. |

## Header

Today (`SessionScreen` + `TableTools`): logo, Proxy, format chip, This session ▾, then undo, redo, zoom out, zoom %, zoom in, fit, snap, Add pile, Card layouts, Keyboard shortcuts. The seat bar adds Dice & coins. That's 13 controls in one flat row, mixing session, view and app-level actions.

Proposed: seven fixed slots. A new feature goes inside a slot's menu or panel, never in a new slot (UI-3), and a slot that doesn't apply is hidden (UI-4).

| Slot | Holds | Shown when |
| --- | --- | --- |
| 1 · Back | To Home (workspace) | Always |
| 2 · Session ▾ | Game / session name; opens the session menu | Always. The game prefix only when the session is linked to a game (#65) |
| 3 · Undo / Redo | TT-15 | Always |
| 4 · Panels | Log · Piles · Details tabs for the side panel | Always. Details is disabled when nothing is focused |
| 5 · Share | Share dialog, My shared setups (#106) | Owner of a session, signed in. Hidden for testers |
| 6 · ⌘K | Command palette | Always. Collapses to an icon below 900px |
| 7 · Account | Avatar menu: sync status, Settings, Sign out (#45) | Signed in only |

**Session menu (title ▾)**, which replaces "This session". Grouped, with dividers between groups:
1. Rename session…, Game ▸ (#65)
2. Setup & piles…, Reload all card sets (CD-12, only if URL-backed)
3. Save snapshot… (PS-3), Snapshots ▸
4. New session…, Export session…

**Table tools** move onto the table surface (bottom right), six at most, for the view only: zoom in/out, fit all, snap, dice & coins (only if the format uses dice), keyboard shortcuts. Card layouts moves to the Library (the L key still works). Add pile moves to the table background menu and the session menu.

## Object actions

Every action comes from one action registry (UI-2): id, label, default shortcut, the objects it applies to, and a `can()` capability check. Menus, the command palette, #53's settings, the shortcut reference and announcements all read from it, so how actions are presented can change without a rework.

Options considered:
- **4a Context menus.** Right-click, Enter or long-press opens the object's menu. #53 lets you hide and reorder items. This is what exists now. Good: Already built. Takes no space on screen. Matches A11Y-1/2. Costs: Long menus as features grow, and it doesn't work for acting on several things at once.
- **4b Selection bar.** With 2+ selected, a bar floats above them: Rotate, Flip, Stack, Move to…, More. The pile viewer reuses it for multi-select. Good: One answer for three issues. Group actions are visible without a menu. Costs: Covers part of the table. Needs a clear focus order (bar → selection).
- **4c Inspector panel.** Selecting anything opens it in the side panel: four primary actions, plus counters, CSV fields and layout provenance. Good: Plenty of room for per-card state (counters, hidden info). Easy to scan. Costs: Takes table width. Doubles up the menu. Opening a panel on every click feels heavy.

**Recommendation:** 4a + 4b. Context menus act on one object, and a selection bar acts on several; #29, #30 and #57 all reuse that bar. The inspector idea from 4c becomes a Details tab in the side panel (counters, CSV fields, layout provenance), not a third way to act.

## Seat dock

The seat switcher, the active seat's counters and its hand become one strip (replacing the separate seat bar and hand tray), so S / Shift+S changes everything in one place. Seats with no hand show their counters only. The dock can collapse to one row. With more than 3 seats, the tabs become a dropdown. Seat-private things (hidden info, private piles) go here later.

## Card sets without CSV (new idea)

A card set is an editable table in Library › Card sets: a spreadsheet-style grid with a card preview. CSV and Sheets fill it; they aren't the only source. Edits reach cards in play the same way a re-import does (CD-5). Each set shows its source: "Edited in Proxy", "From ashfall.csv", or "Linked to Sheet · fetched 4 min ago". A Sheet-linked set is read-only in Proxy, with "Unlink to edit here", so edits in two places can't overwrite each other.

## Accounts (#45)

- Rail footer: "Guest · Saved in this browser only · Sign in to sync"; when signed in, avatar, name and sync status.
- Header avatar slot on the table, signed in only: sync status, Settings, Sign out.
- Settings › Account: profile, devices, export everything, delete account.
- Sign-in prompts only where an account is needed (Share, Sync). No banner on the table.
- Sync status extends the existing "Saved" indicator (Saved locally / Synced / Offline, will sync).

## Phone

- **Header:** Back, Session ▾, Undo, and ⋯ (overflow: Redo, panels, Share, search, account). Same slots, folded.
- **Context menu:** Becomes a bottom sheet with a 2×2 grid of primary actions, then the rest as a list. Targets ≥ 44px.
- **Selection bar:** Sticks to the bottom above the dock, scrolls sideways, and More opens a sheet.
- **Side panel:** Full-screen sheet with tabs. Close returns to the table at the same zoom.
- **Seat dock:** Seat dropdown + counters on one row, hand below. Swipe up to expand the hand.
- **Rail:** Becomes a bottom tab bar: Home · Library · Settings. Games become a picker at the top of Home.

## Feature map

Keys refer to the places table. "Change" says whether the current build has to move something, so it can happen as each feature is touched.

| Feature | Refs | Key | Address | Also reached from | Change |
| --- | --- | --- | --- | --- | --- |
| Undo / redo | TT-15 | A | Header slot 3 | Split from zoom in TableTools; Ctrl/⌘ Z | Move |
| New session · Setup | SP-1 | A | Session menu | Home › New session; palette | Move |
| Snapshots | PS-3 | A | Session menu | Log tab (snapshots are named points on the timeline) | New |
| Reload all card sets | CD-12 | A | Session menu | Shown only when a set is URL-backed | Move |
| Export / import bundle | PS-4 | H | Settings › Data | Session menu › Export session (current only) | Move |
| Session log + rewind | TT-14, #107 | E | Side panel › Log | Leaves the This session dialog for the dock HANDOFF #2 described | Move |
| Pile viewer, peek | SP-7–9 | E | Side panel › Piles | PileViewer sheet already slides from the right; dock it in the panel slot | Move |
| Pile viewer multi-select | #43, #57 | D | Selection bar (in the viewer) | Shift-click, Space | New |
| Card details | A11Y-6 | E | Side panel › Details | Card menu › Details; Shift+I | Move |
| Card actions (rotate, flip, z-order…) | TT-5–11 | B | Card context menu | Shortcuts; palette; selection bar for many | Keep |
| Card counters | TT-8 | B | Card menu › Add counter | Counters show on the card; edit in Details | Keep |
| Pile actions (draw, shuffle, mill…) | SP-6 | B | Pile context menu | Click = draw 1; shortcuts; palette | Keep |
| Add pile | SP-4 | B | Table background menu › New pile | Session menu › Setup & piles; palette. Leaves TableTools | Move |
| Rename / merge / delete pile | SP-4 | B | Pile menu (PileMenu) | Drag pile onto pile to merge | Keep |
| Selection & group actions | #29 | D | Selection bar | Marquee, Shift-click, Space | New |
| Stacks | #30 | B | Stack context menu | Selection bar › Stack; drop card on card | New |
| Zoom · fit · snap | TT-1, TT-2 | C | Table tools | + − 0 G | Keep |
| Dice & coins | TT-14 | C | Table tools | Leaves the seat bar. Only when the format uses dice; results in the Log | Move |
| Shortcut reference | A11Y-4 | C | Table tools › ? | ? key; palette | Keep |
| Seat switcher + counters + hand | FS-3, TT-12/13 | F | Seat dock | S / Shift+S | Move |
| Command palette | UI-7 | A | Header slot 6 | Ctrl/⌘ K anywhere | New |
| Games | #65 | G | Rail › Games; Home | Session menu › Game ▸ to link | New |
| Card sets library | #67 | H | Library › Card sets | Pile menu › Open card set; Home › In this game | New |
| Edit cards without CSV | new idea | I | Card set editor (grid) | Card menu › Edit card…; Details › Edit | New |
| Layouts + editor | LY-1–10 | I | Library › Layouts | Leaves TableTools. Card menu › Edit layout; L key | Move |
| Layout editor undo | #102 | I | Inside the layout editor | Ctrl/⌘ Z while the editor has focus | New |
| Formats + editor | FS-1/2, #119–121 | I | Library › Formats | New session dialog › Edit format | New |
| Shared setups | #106 | A | Header › Share | Library › Shared setups (manage, revoke) | New |
| Tester mode | #106 | A | Session ▾ shows "Shared:" | One-line notice; can() hides locked items | New |
| Control settings | #53 | H | Settings › Controls | Palette; shortcut reference › Customise | New |
| Game options / cascade | #65, AR-7 | H | Settings, with a scope switcher | Home › Game options | New |
| Accounts & sync | #45 | G | Rail footer; Settings › Account | Header avatar (signed in); Saved indicator | New |
| Demo | DM-5, #63 | H | Home › Load demo | /demo path | Move |
| PWA install | #59 | H | Settings › App | Browser install prompt only. No in-app banner | New |
| Theme, reduced motion | A11Y-9/10 | H | Settings › Appearance | Follows system by default | New |

## Issue checklist

Add to the issue template:

```
### Placement (UI-1 to UI-8)
- Acts on: card / pile / stack / selection / seat / session / view / library item / person
- Address: place key + name (design/ui-placement.md)
- Registry entry: action id, label, default shortcut (or none), applies to, can() capability
- Header impact: none (if not none, say which slot and why — UI-3)
- Shown when: always / condition (UI-4)
- Phone: how it shows (sheet, menu, ⋯)
- Testers (#106): visible / hidden
```

## Open questions

- 4a + 4b, or a full inspector (4c)?
- Does the side panel open by default (HANDOFF decision 2 had the log open by default) or only on demand?
- Is Home the landing page once games exist (#65), or does the app keep opening on the last session?
- Does a Sheet-linked card set stay read-only, or allow local edits that the next fetch overwrites?
