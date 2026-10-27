import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { tabTo } from './keyboard';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
});

const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const pile = (page: Page, name: string) => table(page).getByRole('button', { name: new RegExp(`^${name},`) });
const addPile = (page: Page) => page.getByRole('button', { name: 'Add pile' });

test.describe('3m piles on the table', () => {
  test('piles sit on the table, Add pile is in the toolbar, and pile menus open whole at any zoom', async ({ page }) => {
    await expect(page.getByRole('list', { name: 'Piles' })).toHaveCount(0);
    await expect(table(page)).toHaveAccessibleName(/^Table, 0 cards, 3 piles\./);
    await expect(page.getByRole('navigation', { name: 'Table tools' }).getByRole('button', { name: 'Add pile' })).toBeVisible();

    await addPile(page).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Discard');
    await page.getByRole('button', { name: 'Add pile', exact: true }).last().click();
    await expect(pile(page, 'Discard')).toBeFocused();
    await expect(table(page)).toHaveAccessibleName(/^Table, 0 cards, 4 piles\./);

    // Zoomed out, the menu is still full size and fully on screen.
    await page.getByRole('button', { name: 'Zoom out (−)' }).click();
    await page.getByRole('button', { name: 'Zoom out (−)' }).click();
    await pile(page, 'Board cards').click({ button: 'right' });
    const menu = page.getByRole('menu', { name: 'Actions for Board cards' });
    await expect(menu).toBeInViewport({ ratio: 1 });
    expect((await menu.getByRole('menuitem').first().boundingBox())?.height).toBeGreaterThanOrEqual(24);
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    // A second press on the pile closes its menu.
    await pile(page, 'Board cards').click();
    await expect(menu).toHaveCount(0);
  });

  test('keyboard only: Tab reaches the first pile, arrows move between piles, and Enter opens the menu', async ({ page }) => {
    await addPile(page).focus();
    await tabTo(page, pile(page, 'P1 main deck'));
    await page.keyboard.press('ArrowRight');
    await expect(pile(page, 'Environment deck')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu', { name: 'Actions for Environment deck' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(pile(page, 'Environment deck')).toBeFocused();
  });
});

test.describe('3m piles on the table at phone size', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('Add pile and the piles fit, the page never scrolls sideways, and there are no axe violations', async ({ page }) => {
    await expect(addPile(page)).toBeInViewport({ ratio: 1 });
    await expect(pile(page, 'P1 main deck')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
  });
});
