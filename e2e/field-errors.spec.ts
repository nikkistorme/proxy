import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
});

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  expect(results.violations).toEqual([]);
}

/** The field reads its error, the message shows "Error:" after an icon, and the field shows an icon inside its right end. */
async function expectFieldError(field: Locator, message: string) {
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toHaveAccessibleDescription(`Error: ${message}`);
  const id = await field.getAttribute('aria-describedby');
  const error = field.page().locator(`[id="${id}"]`);
  await expect(error).toHaveText(`Error: ${message}`);
  await expect(error.locator('svg')).toBeVisible();
  const icon = field.locator('xpath=..').locator('.form-control__icon');
  await expect(icon).toBeVisible();
  const box = await field.boundingBox();
  const mark = await icon.boundingBox();
  if (!box || !mark) throw new Error('No field or icon');
  expect(mark.x).toBeGreaterThan(box.x);
  expect(mark.x + mark.width).toBeLessThan(box.x + box.width);
}

async function addPileWithTakenName(page: Page) {
  await page.getByRole('button', { name: 'Add pile' }).click();
  const field = page.getByRole('dialog', { name: 'Add a pile' }).getByRole('textbox', { name: 'Name' });
  await field.fill('Board cards');
  await page.keyboard.press('Enter');
  return field;
}

test.describe('A11Y-13 error identification', () => {
  test('pile name: the error has an icon and "Error:", and the field keeps its icon with focus', async ({ page }) => {
    const field = await addPileWithTakenName(page);
    await expect(field).toBeFocused();
    await expectFieldError(field, 'There is already a pile called Board cards.');
    await expectNoAxeViolations(page);
  });

  test('pile count: an out-of-range number shows the error pattern', async ({ page }) => {
    await mainPile(page).click({ button: 'right' });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
    await (await chooser).setFiles(fixture('double-faced.csv'));
    await page.getByRole('button', { name: 'Done' }).click();
    await mainPile(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Draw cards…' }).click();
    const field = page.getByRole('spinbutton');
    await field.fill('99');
    await page.keyboard.press('Enter');
    await expectFieldError(field, 'Enter a whole number from 1 to 4.');
    await expectNoAxeViolations(page);
  });

  test('card type: the layout screen uses the same error pattern', async ({ page }) => {
    await page.getByRole('button', { name: 'Card layouts (L)' }).click();
    const choices = page.getByRole('dialog', { name: 'Card layouts' }).getByRole('region', { name: 'Choosing layouts' });
    await choices.getByRole('button', { name: 'Add type' }).click();
    await expectFieldError(choices.getByRole('textbox', { name: 'Card type' }), 'Enter a card type.');
    await expectNoAxeViolations(page);
  });

  test('forced colours: both icons stay visible', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    const field = await addPileWithTakenName(page);
    await expectFieldError(field, 'There is already a pile called Board cards.');
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('the error fits without sideways scrolling', async ({ page }) => {
      const field = await addPileWithTakenName(page);
      await expectFieldError(field, 'There is already a pile called Board cards.');
      const dialog = page.getByRole('dialog', { name: 'Add a pile' });
      await expect(dialog.getByRole('button', { name: 'Add pile' })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
});
