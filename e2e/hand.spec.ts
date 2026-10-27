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
const hand = (page: Page) => page.getByRole('region', { name: "Player 1's hand" });
const handCard = (page: Page, name: string) => hand(page).getByRole('button', { name, exact: true });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });

/** double-faced.csv in CSV order, then three cards drawn: Daylight Hunter, Daylight Hunter, Ember Shard. */
async function threeInHand(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('double-faced.csv'));
  await page.getByRole('button', { name: 'Done' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Draw' }).click();
  await expect(hand(page).getByRole('list')).toHaveAccessibleName(/^Player 1's hand, 3 cards\./);
}

test.describe('TT-4 and SP-8 hand card menu', () => {
  test('mouse: click a hand card and play it to the table, with no axe violations', async ({ page }) => {
    await threeInHand(page);
    await handCard(page, 'Ember Shard').click();
    const menu = page.getByRole('menu', { name: 'Actions for Ember Shard' });
    await expect(menu).toBeVisible();
    await expect(menu).toBeInViewport({ ratio: 1 });
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await menu.getByRole('menuitem', { name: 'Play to table' }).click();
    await expect(status(page)).toHaveText("Moved Ember Shard from Player 1's hand to the table.");
    await expect(table(page).getByRole('button', { name: 'Ember Shard', exact: true })).toBeVisible();
    await expect(handCard(page, 'Daylight Hunter, double-faced').last()).toBeFocused();
  });

  test('keyboard only: one Tab stop, arrows, P plays, M moves, and focus ends on Draw', async ({ page }) => {
    await threeInHand(page);
    await tabTo(page, handCard(page, 'Daylight Hunter, double-faced').first());
    await page.keyboard.press('End');
    await expect(handCard(page, 'Ember Shard')).toBeFocused();
    await page.keyboard.press('p');
    await expect(status(page)).toHaveText("Moved Ember Shard from Player 1's hand to the table.");

    await page.keyboard.press('m');
    const move = page.getByRole('dialog', { name: 'Daylight Hunter' });
    await page.keyboard.type('board');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(move).toBeHidden();
    await expect(status(page)).toHaveText("Moved Daylight Hunter from Player 1's hand to the bottom of Board cards.");

    await expect(handCard(page, 'Daylight Hunter, double-faced')).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText("Moved Daylight Hunter from Player 1's hand to the table.");
    await expect(page.getByRole('button', { name: 'Draw' })).toBeFocused();
  });
});

test.describe('TT-4 hand card menu on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('tap a hand card; the menu fits the screen', async ({ page }) => {
    await threeInHand(page);
    await handCard(page, 'Ember Shard').scrollIntoViewIfNeeded();
    await handCard(page, 'Ember Shard').click();
    const menu = page.getByRole('menu', { name: 'Actions for Ember Shard' });
    await expect(menu).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await menu.getByRole('menuitem', { name: 'Play to table' }).click();
    await expect(table(page)).toHaveAccessibleName(/^Table, 1 card/);
  });
});

/** The hand's card names, left to right. */
const handOrder = (page: Page) => hand(page).getByRole('list').getByRole('button').evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label')));
const DH = 'Daylight Hunter, double-faced';

test.describe('TT-12 hand reordering', () => {
  test('keyboard only: Shift and arrow keys move the focused card, with no axe violations', async ({ page }) => {
    await threeInHand(page);
    await tabTo(page, handCard(page, DH).first());
    await page.keyboard.press('End');
    await page.keyboard.press('Shift+Home');
    await expect(status(page)).toHaveText("Moved Ember Shard to position 1 of 3 in Player 1's hand.");
    expect(await handOrder(page)).toEqual(['Ember Shard', DH, DH]);
    await expect(handCard(page, 'Ember Shard')).toBeFocused();
    await page.keyboard.press('Shift+ArrowRight');
    expect(await handOrder(page)).toEqual([DH, 'Ember Shard', DH]);
    await expect(handCard(page, 'Ember Shard')).toBeFocused();
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await page.keyboard.press('Control+z');
    await expect(status(page)).toHaveText(/^Undone: Moved Ember Shard to position 2/);
    expect(await handOrder(page)).toEqual(['Ember Shard', DH, DH]);
  });

  test('mouse: drag a card to a new place in the hand', async ({ page }) => {
    await threeInHand(page);
    const from = await handCard(page, 'Ember Shard').boundingBox();
    const to = await handCard(page, DH).first().boundingBox();
    if (!from || !to) throw new Error('no layout');
    await page.mouse.move(from.x + from.width / 2, from.y + 20);
    await page.mouse.down();
    await page.mouse.move(to.x + 10, to.y + 30, { steps: 8 });
    await expect(page.locator('.hand-tray__card--insert-before')).toHaveCount(1);
    await page.mouse.up();
    await expect(status(page)).toHaveText("Moved Ember Shard to position 1 of 3 in Player 1's hand.");
    expect(await handOrder(page)).toEqual(['Ember Shard', DH, DH]);
    await expect(handCard(page, 'Ember Shard')).toBeFocused();
  });
});

test.describe('TT-12 hand reordering on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("tap a card and use the menu's Move left", async ({ page }) => {
    await threeInHand(page);
    await handCard(page, 'Ember Shard').scrollIntoViewIfNeeded();
    await handCard(page, 'Ember Shard').click();
    const menu = page.getByRole('menu', { name: 'Actions for Ember Shard' });
    await expect(menu).toBeInViewport({ ratio: 1 });
    await expect(menu.getByRole('menuitem', { name: 'Move right' })).toHaveAttribute('aria-disabled', 'true');
    await menu.getByRole('menuitem', { name: 'Move left' }).click();
    expect(await handOrder(page)).toEqual([DH, 'Ember Shard', DH]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
