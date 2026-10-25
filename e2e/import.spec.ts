import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Fixture art points at example.test; never let it reach the network.
test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
});

async function chooseFile(page: Page, trigger: () => Promise<void>, name: string) {
  const chooser = page.waitForEvent('filechooser');
  await trigger();
  await (await chooser).setFiles(fixture(name));
}

test.describe('CD-4 import results', () => {
  test('mouse: import a CSV with problems, read them, and close', async ({ page }) => {
    const choose = page.getByRole('button', { name: 'Choose CSV file' });
    await chooseFile(page, () => choose.click(), 'import-errors.csv');

    const dialog = page.getByRole('dialog', { name: 'Import results' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('import-errors.csv');
    const rows = dialog.getByRole('table', { name: '8 problems' }).getByRole('row');
    await expect(rows).toHaveCount(9);
    await expect(rows.nth(1).getByRole('cell')).toHaveText(['2', 'name', 'Missing name.']);

    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);

    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toBeHidden();
    await expect(choose).toBeFocused();
  });

  test('keyboard only: import, then close with Escape', async ({ page }) => {
    const choose = page.getByRole('button', { name: 'Choose CSV file' });
    await page.keyboard.press('Tab');
    await expect(choose).toBeFocused();
    await chooseFile(page, () => page.keyboard.press('Enter'), 'import-errors.csv');

    const dialog = page.getByRole('dialog', { name: 'Import results' });
    await expect(dialog).toBeVisible();
    // Focus moves into the dialog and Tab stays there.
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Done' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(choose).toBeFocused();
  });
});

test.describe('CD-6 card art placeholder', () => {
  test('cards whose art is missing or fails to load show their name', async ({ page }) => {
    await chooseFile(page, () => page.getByRole('button', { name: 'Choose CSV file' }).click(), 'sixty-rows-two-dfc.csv');
    await expect(page.getByRole('dialog')).toContainText('58 cards imported');
    await page.keyboard.press('Escape');

    const deck = page.getByRole('region', { name: 'Deck (58 cards)' });
    // Card 01's art URL fails (aborted); Card 05 has no image at all.
    for (const name of ['Card 01', 'Card 05']) {
      const art = deck.getByRole('img', { name, exact: true });
      await expect(art).toBeVisible();
      await expect(art).toContainText(name);
      // The placeholder fills the card frame exactly.
      const box = await art.boundingBox();
      expect(box && [Math.round(box.width), Math.round(box.height)]).toEqual([126, 176]);
    }

    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
  });
});
