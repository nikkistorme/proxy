import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { closeWith, tabTo } from './keyboard';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
});

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const status = (page: Page) => page.getByRole('status');
const hand = (page: Page) => page.getByRole('region', { name: "Player 1's hand" });
const hunter = (page: Page) => hand(page).getByRole('button', { name: 'Daylight Hunter, double-faced', exact: true }).first();
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const shard = (page: Page) => table(page).getByRole('button', { name: /^Ember Shard/ });
const life = (page: Page) => page.getByRole('group', { name: 'Player 1 Life' });

/** Setup, not part of the turn: double-faced.csv in CSV order, so draws are Daylight Hunter, Daylight Hunter, Ember Shard. */
async function loadDeck(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('double-faced.csv'));
  await page.getByRole('dialog', { name: 'Import results' }).getByRole('button', { name: 'Done' }).click();
}

/** Presses an arrow key until `target` has focus, as a keyboard user moving across the table would. */
async function arrowTo(page: Page, target: Locator, key = 'ArrowRight', max = 8) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(key);
  }
  await expect(target).toBeFocused();
}

// Phase 3's "done when": a solo turn works by mouse and by keyboard. Draw, play a
// card, rotate it, give it a counter, change Life, move a card, roll and undo.
test.describe('Phase 3 solo turn', () => {
  test('mouse', async ({ page }) => {
    await loadDeck(page);
    for (let i = 0; i < 3; i++) await hand(page).getByRole('button', { name: 'Draw' }).click();
    await expect(status(page)).toHaveText('Player 1 drew Ember Shard from P1 main deck. 1 card left.');

    await hand(page).getByRole('button', { name: 'Ember Shard', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Play to table' }).click();
    await expect(status(page)).toHaveText("Moved Ember Shard from Player 1's hand to the table.");

    await shard(page).click();
    await page.getByRole('button', { name: /^Actions for Ember Shard/ }).click();
    await page.getByRole('menuitem', { name: 'Rotate 90° clockwise' }).click();
    await expect(status(page)).toHaveText('Rotated Ember Shard to 90°.');

    await page.getByRole('button', { name: /^Actions for Ember Shard/ }).click();
    await page.getByRole('menuitem', { name: 'Counters…' }).click();
    const counters = page.getByRole('dialog', { name: 'Counters on Ember Shard' });
    await counters.getByRole('textbox', { name: 'New counter name' }).fill('Damage');
    await counters.getByRole('button', { name: 'Add counter' }).click();
    await counters.getByRole('button', { name: 'Done' }).click();
    await expect(shard(page)).toHaveAccessibleName(/Damage 1/);

    await page.getByRole('button', { name: 'Decrease Player 1 Life' }).click();
    await expect(life(page)).toContainText('19');

    await hunter(page).click();
    await page.getByRole('menuitem', { name: 'Move to…' }).click();
    const move = page.getByRole('dialog', { name: 'Daylight Hunter' });
    await move.getByRole('option', { name: /^Board cards — top/ }).click();
    await move.getByRole('button', { name: 'Move to Board cards — top' }).click();
    await expect(status(page)).toHaveText(/^Moved Daylight Hunter from Player 1's hand to .*Board cards\.$/);

    await page.getByRole('button', { name: 'Dice & coins' }).click();
    await page.getByRole('button', { name: 'Roll d6' }).click();
    await expect(status(page)).toHaveText(/^Rolled d6: [1-6]\.$/);
    await page.getByRole('dialog', { name: 'Dice & coins' }).getByRole('button', { name: 'Done' }).click();

    // A roll is never an undo step, so Undo takes back the move.
    await page.getByRole('button', { name: 'Undo (Ctrl+Z)' }).click();
    await expect(status(page)).toHaveText(/^Undone: Moved Daylight Hunter/);
    await expect(hand(page).getByRole('list')).toHaveAccessibleName(/^Player 1's hand, 2 cards\./);
    expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
  });

  test('keyboard only', async ({ page }) => {
    await loadDeck(page);
    // Closing the import results puts focus back on the deck.
    await expect(mainPile(page)).toBeFocused();
    for (let i = 0; i < 3; i++) await page.keyboard.press('d');
    await expect(status(page)).toHaveText('Player 1 drew Ember Shard from P1 main deck. 1 card left.');

    await tabTo(page, hunter(page));
    await page.keyboard.press('End');
    await page.keyboard.press('p');
    await expect(status(page)).toHaveText("Moved Ember Shard from Player 1's hand to the table.");

    // The table is one Tab stop; arrows go from the deck to the card.
    await tabTo(page, mainPile(page), { backwards: true });
    await arrowTo(page, shard(page));
    await page.keyboard.press('r');
    await expect(status(page)).toHaveText('Rotated Ember Shard to 90°.');

    await page.keyboard.press('c');
    const counters = page.getByRole('dialog', { name: 'Counters on Ember Shard' });
    await expect(counters.getByRole('textbox', { name: 'New counter name' })).toBeFocused();
    await page.keyboard.type('Damage');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(counters).toBeHidden();
    await expect(shard(page)).toBeFocused();
    await expect(shard(page)).toHaveAccessibleName(/Damage 1/);

    const decrease = page.getByRole('button', { name: 'Decrease Player 1 Life' });
    await tabTo(page, decrease, { backwards: true });
    await page.keyboard.press('Enter');
    await expect(life(page)).toContainText('19');

    // The hand is one Tab stop too.
    await tabTo(page, hand(page).locator('.hand-tray__card-button[tabindex="0"]'));
    await page.keyboard.press('Home');
    await expect(hunter(page)).toBeFocused();
    await page.keyboard.press('m');
    const move = page.getByRole('dialog', { name: 'Daylight Hunter' });
    await page.keyboard.type('board');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(move).toBeHidden();
    await expect(status(page)).toHaveText(/^Moved Daylight Hunter from Player 1's hand to .*Board cards\.$/);
    // ? only works with focus in the hand, and it's pressed straight away: the app puts focus back
    // as the dialog closes, not from a timer (A11Y-3).
    // ? from the hand shows the shortcuts, and Esc comes back.
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await closeWith(page, page.getByRole('dialog', { name: 'Keyboard shortcuts' }));
    await expect(hand(page).locator('button:focus')).toHaveCount(1);

    const dice = page.getByRole('button', { name: 'Dice & coins' });
    await tabTo(page, dice, { backwards: true });
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText(/^Rolled d20: \d+\.$/);
    await page.keyboard.press('Escape');
    await expect(dice).toBeFocused();

    await page.keyboard.press('ControlOrMeta+z');
    await expect(status(page)).toHaveText(/^Undone: Moved Daylight Hunter/);
    await expect(hand(page).getByRole('list')).toHaveAccessibleName(/^Player 1's hand, 2 cards\./);
  });
});
