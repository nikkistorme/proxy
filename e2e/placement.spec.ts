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
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const tableCard = (page: Page, name: string) => table(page).getByRole('button', { name, exact: true });
const outline = (page: Page) => page.getByRole('button', { name: /^Placing / });
const bar = (page: Page) => page.getByRole('group', { name: /^Placing / });
const hand = (page: Page) => page.getByRole('region', { name: "Player 1's hand" });
/** Where a card sits on the mat, which doesn't change as the table scrolls. */
const spot = (page: Page, name: string) =>
  page.locator('.table-card', { has: page.getByRole('button', { name, exact: true }) }).evaluate((el: HTMLElement) => [parseFloat(el.style.left), parseFloat(el.style.top)]);

/** double-faced.csv in CSV order: Daylight Hunter (×2) and Ember Shard on the table, and Locked Vault in the hand. */
async function setUp(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('double-faced.csv'));
  await page.getByRole('button', { name: 'Done' }).click();
  await mainPile(page).focus();
  await page.keyboard.press('v');
  const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
  for (let i = 0; i < 3; i++) await viewer.getByRole('button', { name: /^To table/ }).first().click();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await page.getByRole('button', { name: 'Draw' }).click();
}

test.describe('A11Y-1 keyboard and single-pointer placement', () => {
  test('mouse: Move on table, click a spot, then Place, with no axe violations', async ({ page }) => {
    await setUp(page);
    await tableCard(page, 'Ember Shard').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Move on table' }).click();
    await expect(outline(page)).toBeFocused();
    await expect(bar(page)).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    // axe scrolls the table while it checks contrast; put it back.
    await page.locator('.table-viewport').evaluate((el) => el.scrollTo(0, 0));

    const area = await page.locator('.table-viewport').boundingBox();
    if (!area) throw new Error('No table');
    // Empty table to the right of the piles and cards.
    const target = { x: area.x + 960, y: area.y + area.height / 2 };
    await page.mouse.click(target.x, target.y);
    await expect(status(page)).toHaveText(/^(Row|Near row) 1, near column 7\.$/);
    await expect(outline(page)).toBeFocused();
    await bar(page).getByRole('button', { name: 'Place' }).click();
    await expect(status(page)).toHaveText('Moved Ember Shard on the table.');
    await expect(tableCard(page, 'Ember Shard')).toBeFocused();
    await expect(bar(page)).toHaveCount(0);
    const box = await tableCard(page, 'Ember Shard').boundingBox();
    expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - target.x)).toBeLessThan(3);
  });

  test('keyboard only: Space picks up, arrows move, Enter places, Esc cancels; Move to… places a hand card', async ({ page }) => {
    await setUp(page);
    // Tab into the table from Add pile, the last tool: the first pile has the Tab stop.
    await page.getByRole('button', { name: 'Add pile' }).focus();
    await page.keyboard.press('Tab');
    await expect(mainPile(page)).toBeFocused();
    await tableCard(page, 'Ember Shard').focus();
    const before = await spot(page, 'Ember Shard');
    await page.keyboard.press('Space');
    await expect(outline(page)).toBeFocused();
    await expect(status(page)).toHaveText(/^Picked up Ember Shard\./);
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Escape');
    await expect(status(page)).toHaveText('Put Ember Shard back.');
    await expect(tableCard(page, 'Ember Shard')).toBeFocused();
    expect(await spot(page, 'Ember Shard')).toEqual(before);

    await page.keyboard.press('Space');
    await expect(outline(page)).toBeFocused();
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('Moved Ember Shard on the table.');
    await expect(tableCard(page, 'Ember Shard')).toBeFocused();
    const [x, y] = before;
    expect(await spot(page, 'Ember Shard')).toEqual([(x ?? 0) + 16, (y ?? 0) + 176 + 16]);

    // From the hand, through Move to… "Table — choose a spot".
    await tabTo(page, hand(page).getByRole('button', { name: 'Locked Vault, double-faced', exact: true }));
    await page.keyboard.press('m');
    await expect(page.getByRole('dialog', { name: 'Locked Vault' })).toBeVisible();
    await page.keyboard.type('choose');
    await page.keyboard.press('Enter');
    await expect(outline(page)).toBeFocused();
    await expect(status(page)).toHaveText(/^Picked up Locked Vault\./);
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText("Moved Locked Vault from Player 1's hand to the table.");
    await expect(tableCard(page, 'Locked Vault, front face')).toBeFocused();
  });
});

test.describe('A11Y-1 placement at phone size', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the bar fits the screen, and a tap then Place moves the card', async ({ page }) => {
    await setUp(page);
    await tableCard(page, 'Ember Shard').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Move on table' }).click();
    await expect(bar(page)).toBeInViewport({ ratio: 1 });
    await expect(bar(page).getByRole('button', { name: 'Place' })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.locator('.table-viewport').evaluate((el) => el.scrollTo(0, 0));
    const area = await page.locator('.table-viewport').boundingBox();
    if (!area) throw new Error('No table');
    await page.mouse.click(area.x + area.width - 40, area.y + area.height / 2);
    await bar(page).getByRole('button', { name: 'Place' }).click();
    await expect(status(page)).toHaveText('Moved Ember Shard on the table.');
  });
});
