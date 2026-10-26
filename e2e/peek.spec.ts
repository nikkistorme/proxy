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
const peekDialog = (page: Page, count: number) => page.getByRole('dialog', { name: `Top ${count} of P1 main deck` });

/** Loads the 60-row deck (58 cards) into P1 main deck in CSV order: Card 01 is on top. */
async function loadSixty(page: Page) {
  await mainPile(page).click();
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('sixty-rows-two-dfc.csv'));
  await page.getByRole('button', { name: 'Done' }).click();
}

/** Names of the shown cards, top first. */
async function shownNames(page: Page, count: number) {
  const cards = peekDialog(page, count).getByRole('list', { name: 'Top cards, top first' }).getByRole('img');
  return cards.evaluateAll((list) => list.map((c) => c.getAttribute('aria-label')?.split('.')[0]));
}

test.describe('SP-9 peek', () => {
  test('mouse: peek at 3, put the top card at the bottom of the three, and Done keeps that order', async ({ page }) => {
    await loadSixty(page);
    await mainPile(page).click();
    await page.getByRole('menuitem', { name: 'Peek at top cards…' }).click();
    const countDialog = page.getByRole('dialog', { name: 'Peek at P1 main deck' });
    await expect(countDialog.getByRole('spinbutton', { name: 'Cards to look at' })).toHaveValue('3');
    await countDialog.getByRole('button', { name: 'Peek' }).click();

    const peek = peekDialog(page, 3);
    await expect(peek).toContainText('Top 3 of P1 main deck, top first: Card 01, Card 02 and Card 03.');
    expect(await shownNames(page, 3)).toEqual(['Card 01', 'Card 02', 'Card 03']);
    await peek.getByRole('button', { name: 'Down: Card 01' }).click();
    await peek.getByRole('button', { name: 'Down: Card 01' }).click();
    expect(await shownNames(page, 3)).toEqual(['Card 02', 'Card 03', 'Card 01']);
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await peek.getByRole('button', { name: 'Done' }).click();

    await expect(peek).toBeHidden();
    await expect(mainPile(page)).toBeFocused();
    await page.keyboard.press('v');
    const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
    await expect(viewer.getByRole('button', { name: /^Card 02\. .* #1 from top$/ })).toBeVisible();
    await expect(viewer.getByRole('button', { name: /^Card 01\. .* #3 from top$/ })).toBeVisible();
  });

  test('keyboard only: peek, move a card to the bottom, reorder, and Esc keeps the order shown', async ({ page }) => {
    await loadSixty(page);
    await mainPile(page).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'Peek at top cards…' }).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');

    const peek = peekDialog(page, 2);
    await expect(peek).toBeVisible();
    await peek.getByRole('button', { name: 'Move to…: Card 01' }).focus();
    await page.keyboard.press('Enter');
    const move = page.getByRole('dialog', { name: 'Card 01' });
    await expect(move.getByRole('combobox', { name: 'Find a destination' })).toBeFocused();
    await page.keyboard.type('main deck');
    await expect(move.getByRole('option', { selected: true })).toHaveAccessibleName('P1 main deck — bottom 58 cards');
    await page.keyboard.press('Enter');

    // The Peek dialog stays open with the one card left, and focus on its Move to….
    await expect(move).toBeHidden();
    await expect(peekDialog(page, 1).getByRole('button', { name: 'Move to…: Card 02' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(peekDialog(page, 1)).toBeHidden();
    await expect(mainPile(page)).toBeFocused();

    await page.keyboard.press('v');
    const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
    await expect(viewer.getByRole('button', { name: /^Card 02\. .* #1 from top$/ })).toBeVisible();
    await expect(viewer.getByRole('button', { name: /^Card 01\. .* #58 from top$/ })).toBeVisible();
  });
});

test.describe('SP-9 peek on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('fits the screen, scrolls its cards, and keeps Done in view', async ({ page }) => {
    await loadSixty(page);
    await mainPile(page).click();
    await page.getByRole('menuitem', { name: 'Peek at top cards…' }).click();
    const countDialog = page.getByRole('dialog', { name: 'Peek at P1 main deck' });
    await countDialog.getByRole('spinbutton').fill('5');
    await countDialog.getByRole('button', { name: 'Peek' }).click();

    const peek = peekDialog(page, 5);
    const box = await peek.boundingBox();
    expect(box?.height).toBeLessThanOrEqual(667);
    await expect(peek.getByRole('button', { name: 'Done' })).toBeInViewport();
    const last = peek.getByRole('button', { name: 'Move to…: Card 05' });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(sideways).toBe(false);
  });
});
