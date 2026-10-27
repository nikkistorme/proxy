import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { tabTo } from './keyboard';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Fixture art points at example.test; never let it reach the network.
test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
});

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });

async function chooseFile(page: Page, trigger: () => Promise<void>, name: string) {
  const chooser = page.waitForEvent('filechooser');
  await trigger();
  await (await chooser).setFiles(fixture(name));
}

async function loadMain(page: Page, name: string, keepOrder = false) {
  await mainPile(page).click();
  if (keepOrder) await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  await chooseFile(page, () => page.getByRole('menuitem', { name: 'Load CSV…' }).click(), name);
}

test.describe('SP-1 and CD-4 load a deck into a pile', () => {
  test('mouse: load from the pile menu, read the problems, and close', async ({ page }) => {
    await loadMain(page, 'import-errors.csv');

    const dialog = page.getByRole('dialog', { name: 'Import results' });
    await expect(dialog).toContainText('import-errors.csv into P1 main deck');
    const rows = dialog.getByRole('table', { name: '8 problems' }).getByRole('row');
    await expect(rows).toHaveCount(9);
    await expect(rows.nth(1).getByRole('cell')).toHaveText(['2', 'name', 'Missing name.']);

    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);

    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toBeHidden();
    await expect(mainPile(page)).toBeFocused();
    // Troll has qty 0, so 4 cards make 3 copies.
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 3 cards, Player 1');
  });

  test('keyboard only: open the pile menu, load, and close with Escape', async ({ page }) => {
    await tabTo(page, mainPile(page));
    await page.keyboard.press('Enter');

    const menu = page.getByRole('menu', { name: 'Actions for P1 main deck' });
    await expect(menu.getByRole('menuitem', { name: 'Load CSV…' })).toBeFocused();
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);

    await chooseFile(page, () => page.keyboard.press('Enter'), 'import-errors.csv');
    const dialog = page.getByRole('dialog', { name: 'Import results' });
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Done' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(mainPile(page)).toBeFocused();
  });
});

test.describe('SP-5 and SP-6 piles and drawing', () => {
  test('mouse: load in CSV order, draw from the tray, and see the hand and count', async ({ page }) => {
    await loadMain(page, 'double-faced.csv', true);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 4 cards, Player 1');

    await page.getByRole('button', { name: 'Draw' }).click();
    const hand = page.getByRole('list', { name: /^Player 1's hand, 1 card\./ });
    await expect(hand.getByRole('button')).toHaveAccessibleName('Daylight Hunter, double-faced');
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 3 cards, Player 1');
    await expect(page.getByRole('status')).toHaveText('Player 1 drew Daylight Hunter from P1 main deck. 3 cards left.');
  });

  test('keyboard only: draw with D, and from the pile menu', async ({ page }) => {
    await loadMain(page, 'double-faced.csv', true);
    // Reading the file is async: wait for the results before Esc, or Esc can land before they open.
    const importResults = page.getByRole('dialog', { name: 'Import results' });
    await expect(importResults).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(importResults).toBeHidden();

    await page.keyboard.press('d');
    await expect(page.getByRole('status')).toHaveText('Player 1 drew Daylight Hunter from P1 main deck. 3 cards left.');

    await mainPile(page).focus();
    await page.keyboard.press('Enter');
    // Load CSV…, Reload double-faced.csv…, Keep CSV order, then Draw 1.
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Draw 1' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('list', { name: /^Player 1's hand, 2 cards\./ })).toBeVisible();
    await expect(mainPile(page)).toBeFocused();

    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('CD-6 card art placeholder', () => {
  test('a drawn card whose art fails to load keeps its layout', async ({ page }) => {
    await loadMain(page, 'sixty-rows-two-dfc.csv', true);
    await expect(page.getByRole('dialog')).toContainText('58 cards imported');
    await page.keyboard.press('Escape');
    await page.keyboard.press('d');

    // Card 01's art URL is aborted, so its art box shows the placeholder.
    await expect(page.getByRole('list', { name: /^Player 1's hand, 1 card\./ }).getByRole('button')).toHaveAccessibleName('Card 01');
    const card = page.locator('.hand-tray__card').first();
    await expect(card.locator('.card-art--placeholder')).toBeVisible();
    const box = await card.boundingBox();
    expect(box && [Math.round(box.width), Math.round(box.height)]).toEqual([104, 146]);
  });
});

test.describe('CD-4 import results on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the results fill most of the screen and the problem list scrolls', async ({ page }) => {
    await loadMain(page, 'import-errors.csv');
    const dialog = page.getByRole('dialog', { name: 'Import results' });
    const body = dialog.locator('.dialog__body');
    const dialogBox = await dialog.boundingBox();
    const bodyBox = await body.boundingBox();
    // Regression: the dialog collapsed to its header and footer on a phone.
    expect(dialogBox?.height).toBeGreaterThan(667 * 0.75);
    expect(bodyBox?.height).toBeGreaterThan(667 * 0.5);
    await expect(dialog.getByRole('button', { name: 'Done' })).toBeInViewport();
  });
});
