import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { tabTo } from './keyboard';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

const sessionButton = (page: Page) => page.getByRole('button', { name: 'This session' });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'New session' });
const header = (page: Page) => page.getByRole('banner');
const status = (page: Page) => page.getByRole('status').filter({ hasText: /session started/ });

test.describe('SP-1 setup dialog', () => {
  test('mouse: choose 1v1 PvP, start it, and it is still 1v1 after a reload', async ({ page }) => {
    await expect(header(page)).toContainText('Solo PvE');
    await sessionButton(page).click();
    await page.getByRole('menuitem', { name: 'New session…' }).click();
    await expect(dialog(page)).toBeVisible();
    const results = await new AxeBuilder({ page }).include('dialog').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole('radio', { name: /^1v1 PvP/ }).check();
    await page.getByRole('button', { name: 'Start session' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(header(page)).toContainText('1v1 PvP');
    await expect(status(page)).toHaveText('New 1v1 PvP session started. Player 1 is the active seat.');
    await expect(page.getByRole('region', { name: 'Seats' }).getByRole('button', { name: /^Player 2, / })).toBeVisible();
    await page.reload();
    await expect(header(page)).toContainText('1v1 PvP');
  });

  test('keyboard only: choose with arrows, start, and focus lands on the table', async ({ page }) => {
    await tabTo(page, sessionButton(page));
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // New session…, the first item
    await expect(dialog(page)).toBeVisible();
    await expect(page.getByRole('radio', { name: /^Solo PvE/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: /^1v1 PvP/ })).toBeChecked();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toHaveCount(0);
    await expect(header(page)).toContainText('1v1 PvP');
    await expect(page.locator('.table-surface')).toBeFocused();
  });

  test('Escape returns focus to the menu button and changes nothing', async ({ page }) => {
    await sessionButton(page).click();
    await page.getByRole('menuitem', { name: 'New session…' }).click();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(sessionButton(page)).toBeFocused();
    await expect(header(page)).toContainText('Solo PvE');
  });

  test('a session with cards asks first, and Back keeps it', async ({ page }) => {
    await page.getByRole('button', { name: /^P1 main deck,/ }).click({ button: 'right' });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
    await (await chooser).setFiles(fixture('basic.csv'));
    await page.getByRole('button', { name: 'Close' }).click();
    await sessionButton(page).click();
    await page.getByRole('menuitem', { name: 'New session…' }).click();
    await page.getByRole('radio', { name: /^Co-op PvE/ }).check();
    await page.getByRole('button', { name: 'Start session' }).click();
    await expect(page.getByRole('dialog', { name: 'Start a new Co-op PvE session?' })).toContainText('The cards in this session will be cleared.');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('radio', { name: /^Co-op PvE/ })).toBeChecked();
    await page.getByRole('button', { name: 'Start session' }).click();
    await page.getByRole('button', { name: 'Start new session' }).click();
    await expect(header(page)).toContainText('Co-op PvE');
    await expect(page.getByRole('button', { name: /^P1 main deck, empty/ })).toBeVisible();
  });
});

test.describe('SP-1 setup dialog on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the dialog fits with its buttons visible and no sideways scrolling', async ({ page }) => {
    await sessionButton(page).click();
    await page.getByRole('menuitem', { name: 'New session…' }).click();
    const start = page.getByRole('button', { name: 'Start session' });
    await expect(start).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.getByRole('radio', { name: /^1v1 PvP/ }).check();
    await start.click();
    await expect(header(page)).toContainText('1v1 PvP');
  });
});
