# Screen-reader test plan: the solo turn

The owner runs this by hand. It finishes the first Accessibility acceptance criterion in `docs/requirements.md` ("A complete solo turn (draw, play a card to a location, rotate it, add a counter, undo) can be done with keyboard and screen reader alone in NVDA + Firefox and VoiceOver + Safari") and gives `docs/accessibility/acr.md` its manual evidence.

Automated tests already cover the same turn by keyboard (`e2e/solo-turn.spec.ts`) and check every announcement is a whole sentence (`src/actions/announcements.test.ts`). They can't tell what a real screen reader says, so this plan does.

## What to expect

- Each step says the keys to press and the text the app puts in its live region (A11Y-5). The screen reader should say that text, or something close to it. Wording around it (role, "button", "dialog") is the screen reader's own and differs between NVDA and VoiceOver.
- `<card>` stands for the name of whichever card comes up. The demo's decks are shuffled, so it changes from run to run. Counts such as "29 cards left" are exact for the demo.
- A step passes when the announcement is heard, in full, without moving focus away to look for it. A missing, cut-off or wrong announcement, or focus ending up somewhere unexpected, is a fail: write it in Notes.
- Keys are the same in every browser unless a step says otherwise. Single-letter keys only work while focus is in the table, the hand or the table tools (A11Y-4, WCAG 2.1.4).

## Setup

Do this once per run, in a fresh browser window with the screen reader already running.

1. Open the app (the live site, or a PR preview). Wait until "Loading your session…" has gone.
2. Open **This session** (the first button in the header, Enter or Space) and choose **New session…**.
3. In the New session dialog, under "Try a sample Co-op PvE game", choose **Load demo**. If the dialog asks "Load the demo?", choose **Load demo** again.
4. The dialog closes and focus goes to the table. Expected announcement: "Demo loaded: Co-op PvE session with 86 cards in 4 piles. Player 1 is the active seat."
5. Check the starting state by reading the table: its name is "Table, 0 cards, 4 piles" until a card is played.

### Screen readers and browsers

| Screen reader | Browser | Notes |
| --- | --- | --- |
| NVDA (Windows) | Firefox | Use browse mode to read, and let NVDA switch to focus mode on the table and dialogs. If keys like D or R are read as navigation shortcuts, focus mode isn't on: press NVDA+Space once. Note it if the app didn't switch modes by itself. |
| VoiceOver (macOS) | Safari | Safari needs "Press Tab to highlight each item on a webpage" turned on in Settings › Advanced, or Option+Tab. Quick Nav off, so single letters reach the app. Use VO keys (Control+Option) to move, and the keys below to act. |

## The solo turn

Player 1 is the active seat. Do the steps in order; each starts from where the one before ended.

| # | Do | Keys | Expected announcement | Pass |
| --- | --- | --- | --- | --- |
| 1 | Draw a card | With focus on the table or the hand, press **D**. Or Tab to the **Draw** button in Player 1's hand and press Enter or Space. | "Player 1 drew <card> from P1 main deck. 29 cards left." The hand's card count goes up by one. | |
| 2 | Move to the card in the hand | Tab to Player 1's hand (one Tab stop, announced with "Player 1's hand, 1 card. Arrow keys move between cards…"). The card button is named with the card's name. | The screen reader reads the card's name. | |
| 3 | Play it to the table | With focus on the hand card, press **P**. (Or Enter, then choose **Play to table** from the menu.) | "Moved <card> from Player 1's hand to the table." | |
| 4 | Go to the card on the table | Shift+Tab or Tab until the table is focused (it is one Tab stop, announced "Table, 1 card, 4 piles"), then **arrow keys** to move between cards and piles by position until the played card is focused. | The card's name is read, for example "<card>" followed by its details. A face-down card is read only as "face-down card". | |
| 5 | Choose where it goes: pick it up | With the card focused, press **Space**. | "Picked up <card>. Row R, column C. Arrow keys move it, Enter places it, Escape cancels." (Row and column are where the card is now.) A "Placing <card>" bar appears. | |
| 6 | Move it to a location | **Arrow keys** move it a little; **Shift+arrow keys** move it a card's width. Move it two steps to the right. | "Row R, column C." after each move, adding ", over <name>" when it covers another card or pile. | |
| 7 | Place it | **Enter** | "Moved <card> on the table." Focus returns to the card. | |
| 8 | Rotate it | With the card focused, press **R**. | "Rotated <card> to 90°." The card's name now includes "rotated 90°". | |
| 9 | Add a counter | Press **C**. The Counters dialog opens with focus in "New counter name". Type `Damage`, press **Enter**, then press **Escape**. | After Enter: "Added Damage 1 to <card>." After Escape the dialog closes, focus is back on the card, and the card's name now includes "Damage 1". | |
| 10 | Undo | **Ctrl+Z** (Windows) or **⌘+Z** (Mac), or Tab to **Undo** in the header and press Enter. | "Undone: Added Damage 1 to <card>." The card's name no longer mentions Damage. | |

Extra steps that aren't part of the acceptance criterion but are cheap to check while the demo is loaded:

| # | Do | Keys | Expected announcement | Pass |
| --- | --- | --- | --- | --- |
| 11 | Undo again | Ctrl+Z / ⌘+Z | "Undone: Rotated <card> to 90°." | |
| 12 | Redo | Ctrl+Shift+Z / ⌘+Shift+Z | "Redone: Rotated <card> to 90°." (the same wording as Undone, with Redone) | |
| 13 | A dialog | Press **?** with focus in the table | The Keyboard shortcuts dialog opens, its title is read, and Escape closes it with focus back where it was. | |
| 14 | Pile menu | Arrow to a pile, press **Enter** | A menu opens with focus in it and its items are read ("Draw cards…", "Peek at top cards…" and so on). Escape closes it. | |

## VoiceOver on iPhone, with a hardware keyboard and Full Keyboard Access

This is how the owner tests iOS, so it has its own short list. Touch behaviour on phones is covered in the "Owner's manual checks" in `docs/progress.md`.

Setup: Settings › Accessibility › Keyboards › Full Keyboard Access on, and VoiceOver on (Settings › Accessibility › VoiceOver). Pair the keyboard. Open the app in Safari and do the Setup steps above, using Tab and Space (Full Keyboard Access's "activate") in place of a pointer.

1. **Tab through the header.** Each of the 11 buttons is read with its name ("This session", "Undo (Ctrl+Z), nothing to undo", "Zoom in (+)" and so on). Pass: all 11 are reached and none is skipped.
2. **Draw.** Tab to the **Draw** button in Player 1's hand and press Space. Pass: "Player 1 drew <card> from P1 main deck. 29 cards left."
3. **Open a card's menu.** Tab to the hand card and press Space. Pass: the menu opens, focus is in it and "Play to table" is read. Choose it: "Moved <card> from Player 1's hand to the table."
4. **Rotate.** Tab to the table and use the arrow keys to reach the card. On a table card Space picks it up to move it, so rotate with **R** (the hardware keyboard works here), or Tab to the card's **Actions for <card> (Enter)** button, press Space and choose **Rotate 90° clockwise**. Pass: "Rotated <card> to 90°."
5. **Counter and undo.** In the same menu choose **Counters…**, type `Damage`, press Return, then choose **Done**. Pass: "Added Damage 1 to <card>." Then press ⌘+Z (the hardware keyboard) or Tab to **Undo** and press Space: "Undone: Added Damage 1 to <card>."
6. **Pile "activate".** A VoiceOver double-tap or Space on a pile draws its top card instead of opening its menu (a known limit, see Open problems in `docs/progress.md`). Note whether the draw is announced.

Record anything that differs from the expected text, and whether focus moves after each dialog closes.

## Results

One row per run. Copy the table to add runs. Status is Pass or Fail for the whole solo turn (steps 1 to 10); put failing step numbers and what was heard in Notes.

| Date | Screen reader and version | Browser and version | OS | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| | NVDA | Firefox | Windows | | |
| | VoiceOver | Safari | macOS | | |
| | VoiceOver (iPhone, hardware keyboard, Full Keyboard Access) | Safari | iOS | | |

When both desktop runs pass, tick the first Accessibility acceptance criterion in `docs/requirements.md` and update the Remarks column in `docs/accessibility/acr.md` for the criteria these runs settle (1.3.1, 2.1.1, 2.4.3, 3.3.2, 4.1.2, 4.1.3).
