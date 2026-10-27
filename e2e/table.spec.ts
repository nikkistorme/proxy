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
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const tableCard = (page: Page, name: string) => table(page).getByRole('button', { name, exact: true });

/** Loads the 60-row deck in CSV order and puts Card 01 to Card 04 on the table from the viewer. */
async function fourOnTable(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('sixty-rows-two-dfc.csv'));
  await page.getByRole('button', { name: 'Done' }).click();
  await mainPile(page).focus();
  await page.keyboard.press('v');
  const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
  for (let i = 0; i < 4; i++) await viewer.getByRole('button', { name: /^To table/ }).first().click();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
}

test.describe('A11Y-3 and A11Y-6 cards on the table', () => {
  test('mouse: cards played from the viewer appear on the table, named, with no axe violations', async ({ page }) => {
    await expect(table(page)).toHaveAccessibleName('Table, 0 cards, 3 piles. Arrow keys move between cards and piles. Shift and arrow keys pan.');
    await fourOnTable(page);
    await expect(table(page)).toHaveAccessibleName('Table, 4 cards, 3 piles. Arrow keys move between cards and piles. Shift and arrow keys pan.');
    for (const name of ['Card 01', 'Card 02', 'Card 03', 'Card 04']) await expect(tableCard(page, name)).toBeVisible();

    // Each card lands in the next free spot, left to right.
    const first = await tableCard(page, 'Card 01').boundingBox();
    const second = await tableCard(page, 'Card 02').boundingBox();
    expect(second && first && second.x - first.x).toBe(142);
    expect(second?.y).toBe(first?.y);

    // A click makes the card current: focused, ringed and drawn above the others.
    await tableCard(page, 'Card 03').click();
    await expect(tableCard(page, 'Card 03')).toBeFocused();
    await expect(tableCard(page, 'Card 03')).toHaveCSS('box-shadow', /rgb\(17, 17, 17\) 0px 0px 0px 5px/);
    const zIndex = await tableCard(page, 'Card 03').evaluate((b) => getComputedStyle(b.closest('.table-card') as HTMLElement).zIndex);
    expect(Number(zIndex)).toBeGreaterThan(4);
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
  });

  test('keyboard only: one Tab stop, arrows between piles and cards, Tab out, and back to the same card', async ({ page }) => {
    await fourOnTable(page);
    await page.getByRole('button', { name: 'Add pile' }).focus();
    await page.keyboard.press('Tab');
    // The piles come first, along the top of the table, then the cards after them.
    await expect(table(page).getByRole('button', { name: /^P1 main deck,/ })).toBeFocused();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await expect(tableCard(page, 'Card 01')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(tableCard(page, 'Card 03')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(tableCard(page, 'Card 02')).toBeFocused();

    // The focused card is drawn above the others.
    const zIndex = await tableCard(page, 'Card 02').evaluate((b) => getComputedStyle(b.closest('.table-card') as HTMLElement).zIndex);
    expect(Number(zIndex)).toBeGreaterThan(4);

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Draw' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(tableCard(page, 'Card 02')).toBeFocused();

    // Undo takes the last card off the table again.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(table(page)).toHaveAccessibleName('Table, 3 cards, 3 piles. Arrow keys move between cards and piles. Shift and arrow keys pan.');
  });
});

test.describe('A11Y-3 table on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the table scrolls inside its own area, never the page', async ({ page }) => {
    await fourOnTable(page);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(sideways).toBe(false);
    const scroller = page.locator('.table-viewport');
    expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

    // Rows are as wide as the table: two cards on this phone. Arrowing to a card brings it into view.
    const [first, third] = await Promise.all([tableCard(page, 'Card 01').boundingBox(), tableCard(page, 'Card 03').boundingBox()]);
    expect(third?.x).toBe(first?.x);
    await tableCard(page, 'Card 01').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await expect(tableCard(page, 'Card 04')).toBeFocused();
    await expect(tableCard(page, 'Card 04')).toBeInViewport();
  });
});
