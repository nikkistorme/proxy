import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const notice = (page: Page) => page.getByRole('note');

/** Makes IndexedDB refuse to open, like a private window or blocked site data. */
async function blockStorage(page: Page) {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException('Storage is blocked', 'SecurityError');
    };
  });
}

test.describe('PS-6 storage unavailable', () => {
  test('shows no notice when the browser can save', async ({ page }) => {
    await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^P1 main deck,/ })).toBeVisible();
    // The startup check is quick; give it a moment to show a notice if it were going to.
    await page.waitForTimeout(300);
    await expect(notice(page)).toHaveCount(0);
  });

  test('says progress won’t be saved and the table still works', async ({ page }) => {
    await blockStorage(page);
    await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
    await expect(notice(page)).toHaveText('This browser can’t save right now, so progress won’t be saved.');
    await page.getByRole('button', { name: /^P1 main deck,/ }).click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Load CSV…' })).toBeVisible();
    await page.keyboard.press('Escape');
    expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
  });
});

test.describe('PS-6 storage notice on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('fits without sideways scrolling', async ({ page }) => {
    await blockStorage(page);
    await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
    await expect(notice(page)).toBeVisible();
    const box = await notice(page).boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
