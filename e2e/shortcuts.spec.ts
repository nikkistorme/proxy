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
const reference = (page: Page) => page.getByRole('dialog', { name: 'Keyboard shortcuts' });
const opener = (page: Page) => page.getByRole('button', { name: 'Keyboard shortcuts (?)' });
const snap = (page: Page) => page.getByRole('button', { name: 'Snap to grid (G)' });

async function loadDeck(page: Page) {
  await mainPile(page).click({ button: 'right' });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('double-faced.csv'));
  await page.getByRole('dialog', { name: 'Import results' }).getByRole('button', { name: 'Done' }).click();
}

test.describe('A11Y-4 shortcut reference', () => {
  test('keyboard only: ? on a pile and the toolbar button open it; arrows scroll it; Esc goes back', async ({ page }) => {
    await tabTo(page, mainPile(page));
    await page.keyboard.press('?');
    const list = reference(page).getByRole('region', { name: 'Shortcuts' });
    await expect(list).toBeFocused();
    await expect(reference(page).getByRole('heading', { name: 'Card in the hand' })).toBeVisible();
    // The list scrolls by keyboard when it's taller than the dialog.
    const scrollable = await list.evaluate((el) => el.scrollHeight > el.clientHeight);
    if (scrollable) {
      await page.keyboard.press('End');
      await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    }
    await page.keyboard.press('Escape');
    await expect(reference(page)).toBeHidden();
    await expect(mainPile(page)).toBeFocused();

    await tabTo(page, opener(page), { backwards: true });
    await page.keyboard.press('Enter');
    await expect(reference(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(opener(page)).toBeFocused();
  });

  test('mouse: no axe violations', async ({ page }) => {
    await opener(page).click();
    await expect(reference(page)).toBeVisible();
    expect((await new AxeBuilder({ page }).include('dialog[open]').withTags(axeTags).analyze()).violations).toEqual([]);
    await reference(page).getByRole('button', { name: 'Done' }).click();
    await expect(reference(page)).toBeHidden();
  });
});

test.describe('A11Y-4 single-key shortcuts meet WCAG 2.1.4', () => {
  test('D, G and ? do nothing outside the table, hand and toolbar, and work inside them', async ({ page }) => {
    await loadDeck(page);
    const outside = page.getByRole('button', { name: 'Increase Player 1 Life' });
    await outside.focus();
    await page.keyboard.press('d');
    await page.keyboard.press('g');
    await page.keyboard.press('?');
    await expect(reference(page)).toBeHidden();
    await expect(snap(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('No cards in hand. Draw from Player 1\'s deck to start.')).toBeVisible();

    await mainPile(page).focus();
    await page.keyboard.press('d');
    await expect(status(page)).toHaveText(/^Player 1 drew /);
    await snap(page).focus();
    await page.keyboard.press('g');
    await expect(snap(page)).toHaveAttribute('aria-pressed', 'true');
    // Ctrl/⌘ shortcuts aren't single keys, so they work anywhere.
    await outside.focus();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(status(page)).toHaveText(/^Undone: Player 1 drew/);
  });
});

test.describe('A11Y-4 shortcut reference on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('fits the screen, scrolls inside, and keeps Done visible', async ({ page }) => {
    await opener(page).click();
    const box = await reference(page).boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 375 && box.y >= 0 && box.y + box.height <= 667).toBe(true);
    await expect(reference(page).getByRole('button', { name: 'Done' })).toBeInViewport();
    const list = reference(page).getByRole('region', { name: 'Shortcuts' });
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await list.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(reference(page).getByText('Move to…').last()).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
