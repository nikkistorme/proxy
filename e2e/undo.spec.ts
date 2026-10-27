import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { tabTo } from './keyboard';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
});

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const status = (page: Page) => page.getByRole('status');
const hand = (page: Page) => page.getByRole('region', { name: "Player 1's hand" });
const undoButton = (page: Page) => page.getByRole('button', { name: /^Undo \(Ctrl\+Z\)/ });
const redoButton = (page: Page) => page.getByRole('button', { name: /^Redo \(Ctrl\+Shift\+Z\)/ });

/** Loads the 60-row deck into P1 main deck in CSV order: Card 01 is on top. */
async function loadSixty(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('sixty-rows-two-dfc.csv'));
  await page.getByRole('button', { name: 'Done' }).click();
}

test.describe('TT-15 undo and redo', () => {
  test('mouse: undo a shuffle back to the revealed top card, then redo it', async ({ page }) => {
    await expect(undoButton(page)).toHaveAccessibleName('Undo (Ctrl+Z), nothing to undo');
    // The tooltip shows the same label on hover, and goes when the pointer leaves.
    const tooltip = page.locator('.tooltip__text', { hasText: 'Undo (Ctrl+Z), nothing to undo' });
    await undoButton(page).hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toBeInViewport({ ratio: 1 });
    await page.mouse.move(400, 400);
    await expect(tooltip).toBeHidden();
    await loadSixty(page);
    await mainPile(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Reveal top card' }).click();
    const revealed = 'P1 main deck, 58 cards, Player 1, top card face up: Card 01';
    await expect(mainPile(page)).toHaveAccessibleName(revealed);

    await mainPile(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Shuffle' }).click();
    await expect(mainPile(page)).not.toHaveAccessibleName(revealed);

    await undoButton(page).click();
    await expect(status(page)).toHaveText('Undone: Shuffled P1 main deck. 58 cards.');
    await expect(mainPile(page)).toHaveAccessibleName(revealed);
    await expect(redoButton(page)).toHaveAccessibleName('Redo (Ctrl+Shift+Z)');
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);

    await redoButton(page).click();
    await expect(status(page)).toHaveText('Redone: Shuffled P1 main deck. 58 cards.');
    await expect(mainPile(page)).not.toHaveAccessibleName(revealed);
    await expect(redoButton(page)).toHaveAccessibleName('Redo (Ctrl+Shift+Z), nothing to redo');
  });

  test('keyboard only: draw, undo and redo with shortcuts and the toolbar', async ({ page }) => {
    await loadSixty(page);
    await mainPile(page).focus();
    await page.keyboard.press('d');
    await page.keyboard.press('d');
    await expect(hand(page)).toContainText('2 cards');

    await page.keyboard.press('ControlOrMeta+z');
    await expect(hand(page)).toContainText('1 card');
    await expect(status(page)).toHaveText('Undone: Player 1 drew Card 02 from P1 main deck. 56 cards left.');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(hand(page)).toContainText('2 cards');

    // The toolbar comes before the piles in Tab order. Press Undo until nothing is left.
    await expect(mainPile(page)).toBeFocused();
    await tabTo(page, undoButton(page), { backwards: true });
    await expect(page.locator('.tooltip__text', { hasText: /^Undo \(Ctrl\+Z\)$/ })).toBeVisible();
    await expect(undoButton(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(hand(page)).toContainText('No cards in hand');
    await expect(mainPile(page)).toHaveAccessibleName(/^P1 main deck, empty/);
    await expect(undoButton(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('Nothing to undo.');
  });
});

test.describe('TT-15 undo and redo at phone size', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the toolbar fits with no sideways scrolling', async ({ page }) => {
    await expect(undoButton(page)).toBeInViewport();
    await expect(redoButton(page)).toBeInViewport();
    await page.setViewportSize({ width: 320, height: 640 });
    await expect(redoButton(page)).toBeInViewport();
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(sideways).toBe(false);
  });
});
