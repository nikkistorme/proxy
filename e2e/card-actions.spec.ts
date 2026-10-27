import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
});

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const status = (page: Page) => page.getByRole('status');
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const tableCard = (page: Page, name: string) => table(page).getByRole('button', { name, exact: true });
const cardMenu = (page: Page) => page.getByRole('menu', { name: /^Actions for / });

/** double-faced.csv in CSV order: Daylight Hunter (×2), Ember Shard and Locked Vault. Puts the first three on the table. */
async function threeOnTable(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('double-faced.csv'));
  await page.getByRole('button', { name: 'Done' }).click();
  await mainPile(page).focus();
  await page.keyboard.press('v');
  const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
  for (let i = 0; i < 3; i++) await viewer.getByRole('button', { name: /^To table/ }).first().click();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
}

test.describe('TT-5, TT-6, TT-10, TT-11 card actions', () => {
  test('mouse: right-click and the Actions button open the menu; flip, rotate, duplicate and delete with Undo, with no axe violations', async ({ page }) => {
    await threeOnTable(page);
    await tableCard(page, 'Ember Shard').click({ button: 'right' });
    await expect(cardMenu(page)).toHaveAccessibleName('Actions for Ember Shard');
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    // axe scrolls the table while it checks contrast; put it back.
    await page.locator('.table-viewport').evaluate((el) => el.scrollTo(0, 0));
    await page.getByRole('menuitem', { name: 'Flip face down' }).click();
    await expect(status(page)).toHaveText('Turned Ember Shard face down.');
    await expect(tableCard(page, 'Face-down card, Player 1')).toBeFocused();

    // A click makes a card current and shows its Actions button.
    await tableCard(page, 'Daylight Hunter, front face').first().click();
    await page.getByRole('button', { name: 'Actions for Daylight Hunter, front face (Enter)' }).click();
    await page.getByRole('menuitem', { name: 'Flip to back' }).click();
    await expect(status(page)).toHaveText('Flipped Daylight Hunter to its back: Moonrise Hunter.');
    await page.getByRole('button', { name: 'Actions for Moonrise Hunter, back face (Enter)' }).click();
    await page.getByRole('menuitem', { name: 'Rotate 90° clockwise' }).click();
    await expect(tableCard(page, 'Moonrise Hunter, back face, rotated 90°')).toBeFocused();

    await page.getByRole('button', { name: /^Actions for Moonrise Hunter/ }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect(table(page)).toHaveAccessibleName(/^Table, 4 cards/);
    await page.getByRole('button', { name: /^Actions for Moonrise Hunter/ }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(table(page)).toHaveAccessibleName(/^Table, 3 cards/);
    await expect(page.locator('.toast')).toContainText('Deleted Moonrise Hunter.');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(table(page)).toHaveAccessibleName(/^Table, 4 cards/);
    await expect(page.locator('.toast')).toHaveCount(0);
  });

  test('keyboard only: Enter opens the menu; R, F, M, Ctrl+D and Delete work on the focused card', async ({ page }) => {
    await threeOnTable(page);
    await tableCard(page, 'Daylight Hunter, front face').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Rotate 90° clockwise' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('Flipped Daylight Hunter to its back: Moonrise Hunter.');
    await expect(tableCard(page, 'Moonrise Hunter, back face')).toBeFocused();

    await page.keyboard.press('r');
    await page.keyboard.press('Shift+R');
    await page.keyboard.press('Shift+R');
    await expect(status(page)).toHaveText('Rotated Moonrise Hunter to 270°.');
    await page.keyboard.press('f');
    await expect(tableCard(page, 'Daylight Hunter, front face, rotated 270°')).toBeFocused();

    await page.keyboard.press('ControlOrMeta+d');
    await expect(status(page)).toHaveText('Duplicated Daylight Hunter.');
    await page.keyboard.press('Delete');
    await expect(status(page)).toHaveText('Deleted Daylight Hunter from the table.');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(table(page)).toHaveAccessibleName(/^Table, 4 cards/);

    // Move to… and back to the table: the card goes to the bottom of Board cards.
    await tableCard(page, 'Ember Shard').focus();
    await page.keyboard.press('m');
    const move = page.getByRole('dialog', { name: 'Ember Shard' });
    await page.keyboard.type('board');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(move).toBeHidden();
    await expect(status(page)).toHaveText('Moved Ember Shard from the table to the bottom of Board cards.');
    // Focus goes to the card that takes its place.
    await expect(table(page).locator('.table-card__button:focus')).toHaveCount(1);
  });

  test('details read every column, and Esc returns to the card', async ({ page }) => {
    await threeOnTable(page);
    await tableCard(page, 'Daylight Hunter, front face').first().focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'Details…' }).click();
    const details = page.getByRole('dialog', { name: 'Daylight Hunter' });
    await expect(details).toContainText('Day side.');
    await expect(details).toContainText('Night side.');
    await page.keyboard.press('Escape');
    await expect(tableCard(page, 'Daylight Hunter, front face').first()).toBeFocused();
  });
});

test.describe('TT-11 card menu on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('tap a card, then its Actions button; the menu fits the screen', async ({ page }) => {
    await threeOnTable(page);
    await tableCard(page, 'Ember Shard').click();
    await page.getByRole('button', { name: 'Actions for Ember Shard (Enter)' }).click();
    const menu = cardMenu(page);
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 375).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.getByRole('menuitem', { name: 'Rotate 90° clockwise' }).click();
    await expect(tableCard(page, 'Ember Shard, rotated 90°')).toBeVisible();
  });
});
