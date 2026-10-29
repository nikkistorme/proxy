import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { tabTo } from './keyboard';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
});

const status = (page: Page) => page.getByRole('status');
const seats = (page: Page) => page.getByRole('region', { name: 'Seats' });
const seat = (page: Page, name: string) => seats(page).getByRole('button', { name: new RegExp(`^${name}, `) });
const hand = (page: Page, name: string) => page.getByRole('region', { name: `${name}'s hand` });
const pile = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name},`) });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const life = (page: Page, name: string) => page.getByRole('group', { name: `${name} Life` });

/** Starts a 1v1 PvP session from the setup dialog, by mouse. */
async function startPvp(page: Page) {
  await page.getByRole('button', { name: 'This session' }).click();
  await page.getByRole('menuitem', { name: 'New session…' }).click();
  await page.getByRole('radio', { name: /^1v1 PvP/ }).check();
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page.getByRole('dialog', { name: 'New session' })).toHaveCount(0);
}

/** Setup, not part of the play: basic.csv into a seat's main deck, in CSV order. */
async function loadDeck(page: Page, deck: string) {
  await pile(page, deck).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('basic.csv'));
  await page.getByRole('dialog', { name: 'Import results' }).getByRole('button', { name: 'Done' }).click();
}

/** Presses an arrow key until `target` has focus, as a keyboard user moving across the table would. */
async function arrowTo(page: Page, target: Locator, key: string, max = 8) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(key);
  }
  await expect(target).toBeFocused();
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
}

// Phase 6's "done when": a 1v1 PvP session can be set up and played, by mouse and
// by keyboard. Two seats with their own hands, a deck each, a card played from each
// hand, and each player's Life changed.
test.describe('Phase 6: 1v1 PvP session', () => {
  test('mouse', async ({ page }) => {
    await startPvp(page);
    // FS-1, SP-1: two seats, two empty hands, three empty piles.
    await expect(seats(page).locator('.seat-bar__switch')).toHaveCount(2);
    await expect(seat(page, 'Player 1')).toHaveAccessibleName('Player 1, active seat');
    await expect(hand(page, 'Player 1')).toContainText('No cards in hand');
    await seat(page, 'Player 2').click();
    await expect(hand(page, 'Player 2')).toContainText('No cards in hand');
    await seat(page, 'Player 1').click();
    for (const name of ['P1 main deck', 'P2 main deck', 'Board cards']) await expect(pile(page, name)).toHaveAccessibleName(/0 cards/);

    await loadDeck(page, 'P1 main deck');
    await loadDeck(page, 'P2 main deck');

    // FS-3: each seat draws into its own hand.
    await hand(page, 'Player 1').getByRole('button', { name: 'Draw' }).click();
    await expect(status(page)).toHaveText('Player 1 drew Goblin from P1 main deck. 3 cards left.');
    await seat(page, 'Player 2').click();
    await expect(seat(page, 'Player 2')).toHaveAccessibleName('Player 2, active seat');
    await hand(page, 'Player 2').getByRole('button', { name: 'Draw' }).click();
    await expect(status(page)).toHaveText('Player 2 drew Goblin from P2 main deck. 3 cards left.');

    // Play a card from each hand to the table.
    await hand(page, 'Player 2').getByRole('button', { name: 'Goblin', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Play to table' }).click();
    await expect(status(page)).toHaveText("Moved Goblin from Player 2's hand to the table.");
    await seat(page, 'Player 1').click();
    await hand(page, 'Player 1').getByRole('button', { name: 'Goblin', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Play to table' }).click();
    await expect(status(page)).toHaveText("Moved Goblin from Player 1's hand to the table.");
    await expect(table(page).getByRole('button', { name: /^Goblin/ })).toHaveCount(2);

    // FS-4: each player's Life changes on its own.
    await page.getByRole('button', { name: 'Decrease Player 1 Life' }).click();
    await page.getByRole('button', { name: 'Increase Player 2 Life' }).click();
    await expect(life(page, 'Player 1')).toContainText('19');
    await expect(life(page, 'Player 2')).toContainText('21');
    expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
  });

  test('keyboard only', async ({ page }) => {
    await page.getByRole('button', { name: 'This session' }).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // New session…
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: /^1v1 PvP/ })).toBeChecked();
    await page.keyboard.press('Enter');
    await expect(page.locator('.table-surface')).toBeFocused();
    await expect(seats(page).locator('.seat-bar__switch')).toHaveCount(2);

    // Deck setup uses the mouse: loading a file isn't part of the play. Closing the import results returns focus to the deck.
    await loadDeck(page, 'P1 main deck');
    await expect(pile(page, 'P1 main deck')).toBeFocused();
    await loadDeck(page, 'P2 main deck');
    await expect(pile(page, 'P2 main deck')).toBeFocused();

    // S and Shift+S work from the table; D draws for the active seat.
    await page.keyboard.press('d');
    await expect(status(page)).toHaveText('Player 1 drew Goblin from P1 main deck. 3 cards left.');
    await page.keyboard.press('s');
    await expect(status(page)).toHaveText('Player 2 is the active seat. Hand: 0 cards.');
    await page.keyboard.press('d');
    await expect(status(page)).toHaveText('Player 2 drew Goblin from P2 main deck. 3 cards left.');

    // Play Player 2's card from the hand with P.
    const p2Card = hand(page, 'Player 2').getByRole('button', { name: 'Goblin', exact: true });
    await tabTo(page, p2Card);
    await page.keyboard.press('p');
    await expect(status(page)).toHaveText("Moved Goblin from Player 2's hand to the table.");

    // Shift+S from the table goes back to Player 1, and plays its card.
    // The table is one Tab stop, so Shift+Tab lands on the deck last used; arrows reach the other.
    await tabTo(page, page.locator('.table-surface [tabindex="0"]').first(), { backwards: true });
    await arrowTo(page, pile(page, 'P1 main deck'), 'ArrowLeft');
    await page.keyboard.press('Shift+S');
    await expect(status(page)).toHaveText('Player 1 is the active seat. Hand: 1 card.');
    await expect(pile(page, 'P1 main deck')).toBeFocused();
    const p1Card: Locator = hand(page, 'Player 1').getByRole('button', { name: 'Goblin', exact: true });
    await tabTo(page, p1Card);
    await page.keyboard.press('p');
    await expect(status(page)).toHaveText("Moved Goblin from Player 1's hand to the table.");
    await expect(table(page).getByRole('button', { name: /^Goblin/ })).toHaveCount(2);

    // Each player's Life, by Enter on the − and + buttons.
    await tabTo(page, page.getByRole('button', { name: 'Decrease Player 1 Life' }), { backwards: true, max: 40 });
    await page.keyboard.press('Enter');
    await expect(life(page, 'Player 1')).toContainText('19');
    const up = page.getByRole('button', { name: 'Increase Player 2 Life' });
    await tabTo(page, up, { max: 40 });
    await page.keyboard.press('Enter');
    await expect(life(page, 'Player 2')).toContainText('21');
  });
});

test.describe('Phase 6: 1v1 PvP session on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the seat bar with both Life counters and the hand tray fit with no sideways scrolling', async ({ page }) => {
    await startPvp(page);
    await expect(life(page, 'Player 1')).toBeVisible();
    await expect(life(page, 'Player 2')).toBeVisible();
    await expect(hand(page, 'Player 1')).toBeVisible();
    await expectNoOverflow(page);
    await seat(page, 'Player 2').click();
    await expect(hand(page, 'Player 2')).toBeVisible();
    await expectNoOverflow(page);
  });
});
