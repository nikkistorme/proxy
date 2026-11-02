# Accessibility Conformance Report (draft)

**Draft: manual evaluation pending.** This report is built from what the app does and what the automated tests check. No criterion has been evaluated with a screen reader or in a manual audit yet, and none is marked "Supports" on automated results alone where a person's judgement is needed. It is not a final conformance claim.

Format: based on the VPAT 2.x layout (Accessibility Conformance Report, WCAG edition). Conformance Levels: Supports, Partially Supports, Does Not Support, Not Applicable. A fifth value, Not yet evaluated, is used in this draft where no check exists at all.

In this draft, **Supports** means the app is built for the criterion and the automated checks or tests named in Remarks pass. Where Remarks also say "Not yet evaluated by hand", a person still has to confirm it before the level is final.

| | |
| --- | --- |
| **Product** | Proxy: a browser-only tabletop for playtesting a card game (static web app, no accounts, no server) |
| **Version** | V1, `main` after Phase 8 (#180), 2026-11-02 |
| **Report date** | 2026-11-02 |
| **Standard** | WCAG 2.2 Level A and AA (4.1.1 Parsing is obsolete in 2.2 and left out) |
| **Contact** | The repository owner, through the issue tracker at github.com/nikkistorme/proxy |
| **Evaluation methods used so far** | Automated: axe-core through Playwright (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` tags) on every screen and open dialog in Chromium, Firefox and WebKit, run on every pull request. Targeted E2E checks for focus, target size, contrast, reduced motion and reflow (`e2e/a11y.spec.ts`). Unit and component tests queried by role and accessible name. Keyboard-only E2E for each main flow. |
| **Evaluation methods still to do** | A manual walk through WCAG 2.2 A and AA by the owner. The solo turn in NVDA + Firefox, VoiceOver + Safari and VoiceOver on iPhone with a hardware keyboard, by `docs/testing/screen-reader-plan.md`. Touch checks on an iPhone (listed in `docs/progress.md`, Next, "Owner's manual checks"). |
| **Browsers in automated runs** | Chromium, Firefox, WebKit (Playwright 1.64.1) |
| **Known limits that bear on the criteria** | See the section at the end. |

"Not yet evaluated by hand" in Remarks means the row rests on automated checks and the design, and the manual audit hasn't looked at it. Requirement IDs are from `docs/requirements.md`. Spec names are in `e2e/`.

## Level A

| Criterion | Conformance Level | Remarks |
| --- | --- | --- |
| 1.1.1 Non-text Content | Supports | Card art is an `img` named by the card's name, or `alt=""` where the card's own name already says it (`CardArt.tsx`). Icons are hidden from assistive technology or have a name. A card's art is the user's own image, so its content isn't described beyond the name (the layout editor lets the designer set a spoken label per box, LY). axe `image-alt` passes everywhere. Not yet evaluated by hand. |
| 1.2.1 Audio-only and Video-only (Prerecorded) | Not Applicable | No audio or video. |
| 1.2.2 Captions (Prerecorded) | Not Applicable | No audio or video. |
| 1.2.3 Audio Description or Media Alternative (Prerecorded) | Not Applicable | No audio or video. |
| 1.3.1 Info and Relationships | Supports | Semantic buttons, menus, dialogs, lists, headings and one `main`; the table is a named group, hands and piles have names that include their counts (A11Y-3, A11Y-6). Fields have labels and errors are tied to their field with `aria-describedby` (A11Y-13). axe passes. The table's reading order and descriptions need a screen-reader run. Not yet evaluated by hand. |
| 1.3.2 Meaningful Sequence | Partially Supports | DOM order follows the visual order for the header, table, hand and dialogs. Table cards are placed by position and the arrow keys move between them by position (A11Y-3), not by DOM order. Reading order on the free-form table needs a manual check. Not yet evaluated by hand. |
| 1.3.3 Sensory Characteristics | Supports | Instructions name controls by label and key, never by shape or position alone. Seat identity uses colour, shape and name together (`seatIdentity.ts`). |
| 1.4.1 Use of Color | Supports | A field error has an icon and starts with "Error:", and the border is not the only sign (A11Y-13, `e2e/field-errors.spec.ts`). Seats have a shape as well as a colour. Counters and state are written as text. Not yet evaluated by hand. |
| 1.4.2 Audio Control | Not Applicable | No audio. |
| 2.1.1 Keyboard | Supports | Every action has a keyboard route, including moving a card to a spot, the pile viewer and every dialog (A11Y-1, A11Y-2; the keyboard-only tests in `e2e/solo-turn.spec.ts`, `e2e/placement.spec.ts`, `e2e/phase7.spec.ts` and most other specs). Pile viewer cards can be dragged to a spot on the table but the keyboard can't choose a spot straight from the viewer; it sends the card to the table first, then Space places it. Screen-reader behaviour not yet evaluated by hand. |
| 2.1.2 No Keyboard Trap | Supports | Esc closes every menu and dialog and focus returns to where it was; the table is one Tab stop and Tab leaves it (A11Y-2, A11Y-3; `closeWith` checks in `e2e/keyboard.ts`). |
| 2.1.4 Character Key Shortcuts | Supports | Card, pile and hand keys work only while that item has focus. The page-wide single keys work only while focus is in the table, the hand or the table tools. Ctrl and ⌘ shortcuts work anywhere (A11Y-4, `e2e/shortcuts.spec.ts`). Remapping and an off switch come after V1 (#53). |
| 2.2.1 Timing Adjustable | Not Applicable | No time limits. Toasts stay until dismissed or replaced. |
| 2.2.2 Pause, Stop, Hide | Supports | No auto-updating or moving content. The only animations are short and switch off under reduced motion (A11Y-10). |
| 2.3.1 Three Flashes or Below Threshold | Supports | Nothing flashes. The dice result and seat counter changes fade rather than flash. |
| 2.4.1 Bypass Blocks | Supports | One screen with a header, a `main` landmark and the hand, so a screen-reader user can jump to `main`. There is no skip link, and a keyboard user Tabs past 11 header controls to reach the table. Whether that is enough hasn't been judged by hand. Not yet evaluated by hand. |
| 2.4.2 Page Titled | Supports | The page title is "Proxy". It doesn't change as screens open; dialogs and full-screen panels are named by their own headings. |
| 2.4.3 Focus Order | Supports | Focus moves in a logical order and returns to the control or card that opened a dialog, a menu or the pile viewer; after a move or a play it goes to the card (`closeWith` checks, `e2e/keyboard.ts`). Not yet evaluated by hand with a screen reader. |
| 2.4.4 Link Purpose (In Context) | Supports | The app has almost no links. The one it shows (publishing how-to in `PublishHowTo.tsx`) says where it goes. |
| 2.5.1 Pointer Gestures | Supports | Every path-based gesture (dragging, panning) has a single-pointer or keyboard alternative: Move to…, the placement bar, the zoom and fit buttons (A11Y-1). Pinch zoom is the browser's own. |
| 2.5.2 Pointer Cancellation | Not yet evaluated | Buttons and menu items act on click (the up event). Dragging a card acts on release, and Esc cancels a keyboard move; whether a pointer drag can be cancelled by moving back and releasing off target hasn't been checked. Not yet evaluated by hand. |
| 2.5.3 Label in Name | Supports | axe `label-in-name` passes. Visible text is at the start of accessible names. Table and viewer cards use the overlay button pattern for this (see Open problems in `docs/progress.md`). |
| 2.5.4 Motion Actuation | Not Applicable | Nothing responds to device motion. |
| 3.1.1 Language of Page | Supports | `<html lang="en">`. |
| 3.2.1 On Focus | Supports | Focus never changes the context or opens anything. |
| 3.2.2 On Input | Supports | Changing a field or checkbox doesn't submit or navigate. Dialogs act on their own buttons. |
| 3.2.6 Consistent Help | Not Applicable | No help mechanism is repeated across pages. The Keyboard shortcuts button is always in the same place in the header. |
| 3.3.1 Error Identification | Supports | Errors are shown in text next to the field, start with "Error:", and the field is marked invalid (A11Y-13, `e2e/field-errors.spec.ts`). Import problems are listed in the results dialog. Not yet evaluated by hand. |
| 3.3.2 Labels or Instructions | Supports | Every field has a visible label; instructions such as the Google Sheet publishing steps and hint lines are visible text (A11Y-13). |
| 3.3.7 Redundant Entry | Supports | Nothing asks for the same information twice in one process. A sheet URL set on a format is reused when a session starts from it (CD-12). |
| 4.1.2 Name, Role, Value | Supports | Custom controls are native elements or have roles, names and states (menus, dialogs, toggles with `aria-pressed` or `aria-checked`, disabled with `aria-disabled`). axe `aria-*` and `button-name` rules pass on every screen. Not yet evaluated by hand with NVDA and VoiceOver. |

## Level AA

| Criterion | Conformance Level | Remarks |
| --- | --- | --- |
| 1.2.4 Captions (Live) | Not Applicable | No audio or video. |
| 1.2.5 Audio Description (Prerecorded) | Not Applicable | No audio or video. |
| 1.3.4 Orientation | Supports | Nothing locks the orientation. The landscape card layout is a card face, not the page. |
| 1.3.5 Identify Input Purpose | Not Applicable | The fields collect card, pile and layout names and URLs, not personal data. |
| 1.4.3 Contrast (Minimum) | Supports | axe `color-contrast` over every screen in light, and the demo table's screens in dark, in `e2e/a11y.spec.ts` (A11Y-9), plus the whole dark theme in `e2e/dark-theme.spec.ts`. The layout editor warns when a card's text fails contrast. Text over card art isn't checked: the user's own images are outside the app's control. Not yet evaluated by hand. |
| 1.4.4 Resize Text | Supports | Browser zoom scales everything, and pinch zoom is never disabled: the viewport tag sets no `maximum-scale` (A11Y-12). Font sizes are in px, so a text-size-only setting that leaves the zoom alone may not enlarge them. The enlarge preview is sized in CSS px so it follows browser zoom. Not yet evaluated by hand at 200% zoom or with a text-size-only setting. |
| 1.4.5 Images of Text | Supports | Card text is real text in the layout (shrink-to-fit, LY). The user's art may contain text of its own; that's their content. |
| 1.4.10 Reflow | Partially Supports | At 640 × 400 (200% of 1280 × 800) and 320 × 568 there is no sideways page scroll, every header control is reachable and inside the viewport, and the main dialogs fit with their footers in view (A11Y-11, `e2e/a11y.spec.ts`; the import results dialog at 375 × 667 in `e2e/import.spec.ts`). The table itself scrolls in two dimensions, which the criterion allows for content that needs a 2D layout. Not every screen is scanned at 320 px (the layout and format editors have not been checked by hand). Not yet evaluated by hand. |
| 1.4.11 Non-text Contrast | Supports | Focus rings use two lines that contrast 3:1 with each other so one clears 3:1 on any surface (A11Y-7). Control borders and icons are checked by axe where it can, and error icons and borders are held to 3:1 by design tokens in both themes (A11Y-13). Not yet evaluated by hand for card art and counters on top of art. |
| 1.4.12 Text Spacing | Not yet evaluated | No test applies the text-spacing overrides. Layout boxes clip or shrink text by design, and text in fixed-size dialogs and card faces could be cut off. Needs a manual check with a text-spacing bookmarklet or override stylesheet. Not yet evaluated by hand. |
| 1.4.13 Content on Hover or Focus | Supports | Tooltips and the enlarge preview are dismissible with Esc, stay while the pointer is over them, and show on keyboard focus (`Tooltip.tsx`, `CardEnlarge.tsx`, `e2e/enlarge.spec.ts`). The enlarge preview is hover-only on a mouse and closes when the table scrolls or zooms. Not yet evaluated by hand. |
| 2.4.5 Multiple Ways | Not Applicable | One screen, not a set of pages. |
| 2.4.6 Headings and Labels | Supports | Dialogs, panels and the hand have headings and labels that say what they hold. Not yet evaluated by hand. |
| 2.4.7 Focus Visible | Supports | The two-line focus ring on every control and card in light and dark, checked by Tabbing through the whole page (A11Y-7, `e2e/a11y.spec.ts`). A focused card or pile comes to the front. A menu or pile menu opened by a touch hold doesn't take focus (a known limit below). |
| 2.4.11 Focus Not Obscured (Minimum) | Supports | `e2e/a11y.spec.ts` Tabs the header, every card and pile (one placed just above the hand tray), the hand, the placement bar and a toast, and checks each focused element is on screen and reachable at one of nine sample points. Nothing was covered. The fixed bottom bars don't overlap focused cards. The check uses computed colour, not pixels, for the ring. |
| 2.5.7 Dragging Movements | Supports | Every drag has a single-pointer and a keyboard route: Move to…, the placement bar with arrow keys, reorder in the hand with Shift+arrows, merge piles by a dialog (A11Y-1; `e2e/placement.spec.ts`, `e2e/drag.spec.ts`, `e2e/hand.spec.ts`, `e2e/pile-merge.spec.ts`). Touch drags need a check on an iPhone. |
| 2.5.8 Target Size (Minimum) | Partially Supports | At default zoom axe `target-size` finds nothing on the main screen, the session, pile, card and hand menus and their dialogs (A11Y-8). Below 100% table zoom the card's Actions button and counter pills scale down under 24 × 24 CSS px; the card menu, the C key and Enter always work. Box buttons on the layout canvas can overlap, which layouts need; arrow keys and the box list reach every box. The two exceptions are written into A11Y-8. |
| 3.1.2 Language of Parts | Not Applicable | The interface is English. Card text is the user's own and can be in any language; the app doesn't mark it. Revisit if card sets get a language. |
| 3.2.3 Consistent Navigation | Supports | One header with the same 11 controls in the same order on every screen state (UI-3). Full-screen panels (layouts, formats) replace the table with their own header and a Back control. |
| 3.2.4 Consistent Identification | Supports | The same actions carry the same names and icons wherever they appear (a card's menu on the table and in the pile viewer; Move to… in every menu). |
| 3.3.3 Error Suggestion | Supports | Errors say what is wrong and what to do, for example a pile name that already exists, a sheet URL that isn't a published CSV (with the publishing steps), a bundle that can't be read (A11Y-13, CD-8, PS-5). Not yet evaluated by hand. |
| 3.3.4 Error Prevention (Legal, Financial, Data) | Supports | The app handles no legal or financial data. Changes to the session can be undone (Undo, Redo, snapshots), and the steps that replace or remove saved data ask first: New session with cards, Delete pile, Import bundle, Load demo over a session, and deleting a format or a snapshot. Whether deleting a saved layout asks first hasn't been checked. Not yet evaluated by hand. |
| 3.3.8 Accessible Authentication (Minimum) | Not Applicable | No sign-in, accounts or authentication in V1. |
| 4.1.3 Status Messages | Supports | Every action that changes the session returns an announcement sentence, shown in one polite live region (A11Y-5, `src/actions/announcements.test.ts`, `LiveRegion.tsx`). Status text outside the actions (zoom, fit all, placement steps, Put … back) uses the same region. Toasts have no live region of their own, so each is also announced. What a screen reader actually says is not yet evaluated by hand. |

## Known limits that bear on the criteria

These are in `docs/progress.md` under Open problems and carried here so the final report doesn't miss them.

- **Overlays below 100% table zoom (2.5.8).** The card Actions button and counter pills scale with the table, so under 100% they are smaller than 24 × 24 CSS px. The menu, C and Enter always work.
- **Layout canvas (2.5.8).** Box buttons can overlap by design; arrow keys and the box list reach every box.
- **Touch holds open a menu without moving focus (2.4.3, 2.4.7).** On a card or pile, the browser's own mousedown after a touch moves focus back to the item. A tap outside closes the menu. Enter or a right-click opens it with focus inside.
- **A screen reader's "activate" on a pile draws its top card** instead of opening the menu (4.1.2 and 3.2.2 in spirit). The pile's description says Enter opens actions, every draw is announced and can be undone. Needs a VoiceOver check.
- **Touch and iOS need a phone check:** touch drags (A11Y-1), hand reordering, pile merging and dragging from the pile viewer by touch, Space with iOS Full Keyboard Access, the iOS field zoom fix (A11Y-12), the native colour picker. The touch E2E runs in Chromium only.
- **Page-wide single keys need focus in the table, hand or tools (2.1.4).** After a page load, or a click on the seat bar, D and S do nothing until focus moves into the table.
- **The ring's contrast is checked by computed colour, not pixels (2.4.7, 1.4.11).** A card's art or a layout box behind the ring isn't sampled.
- **Text over images isn't contrast-checked** in the layout editor warning (1.4.3).
- **Reduced motion:** every animation the app owns is off under `prefers-reduced-motion`; the one that wasn't, a seat counter fade, was fixed in 8f-1 (A11Y-10).
- **Local WebKit on macOS skips buttons when tabbing**, so the keyboard-only E2E tests that press Tab run in CI's Linux WebKit but not locally. This is a test limit, not an app one.

## What finishes this report

1. The owner's manual WCAG 2.2 A and AA audit, filling in each "Not yet evaluated by hand".
2. The screen-reader runs in `docs/testing/screen-reader-plan.md` (NVDA + Firefox, VoiceOver + Safari, VoiceOver on iPhone).
3. A text-spacing check (1.4.12) and a 320 px check of the layout and format editors (1.4.10).
4. Remove "Draft: manual evaluation pending" and fill in the date, versions and evaluator once the rows are settled. The last acceptance criterion in `docs/requirements.md` ("no failing criteria") is ticked then.
