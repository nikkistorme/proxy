import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));

test.describe('A11Y-12 dialogs never focus a text field on a touch screen', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });
  test.skip(({ browserName }) => browserName !== 'chromium', 'Firefox has no mobile emulation');

  test.beforeEach(async ({ page }) => {
    await page.route('https://example.test/**', (route) => route.abort());
    await page.goto('./');
    // The app can't be used until the saved session has been read (PS-2).
    await expect(page.getByText('Loading your session…')).toHaveCount(0);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
  });

  const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });

  /** Focus is inside the open dialog and not in an input or textarea. */
  async function expectNoTextFocus(page: Page, name: string | RegExp) {
    const dialog = page.getByRole('dialog', { name });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toMatch(/^(INPUT|TEXTAREA)$/);
  }

  async function loadDeck(page: Page) {
    await mainPile(page).click({ button: 'right' });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
    await (await chooser).setFiles(fixture('sixty-rows-two-dfc.csv'));
    await page.getByRole('button', { name: 'Done' }).click();
  }

  test('the pile viewer, Move to…, Draw cards… and Rename…', async ({ page }) => {
    await loadDeck(page);

    await mainPile(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'View cards…' }).click();
    await expectNoTextFocus(page, 'P1 main deck');

    await page.getByRole('button', { name: /^Move to…: / }).first().click();
    const move = page.locator('dialog[open] dialog[open]');
    await expect(move).toBeVisible();
    expect(await move.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toMatch(/^(INPUT|TEXTAREA)$/);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await mainPile(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Draw cards…' }).click();
    await expectNoTextFocus(page, 'Draw from P1 main deck');
    await page.keyboard.press('Escape');

    await mainPile(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename…' }).click();
    await expectNoTextFocus(page, /^Rename/);
  });
});
