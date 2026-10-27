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
const boardPile = (page: Page) => page.getByRole('button', { name: /^Board cards,/ });
const status = (page: Page) => page.getByRole('status');
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const tableCard = (page: Page, name: string) => table(page).getByRole('button', { name, exact: true });
const hand = (page: Page) => page.getByRole('region', { name: "Player 1's hand" });
const handCard = (page: Page, name: string) => hand(page).getByRole('button', { name, exact: true });

/** double-faced.csv in CSV order: Daylight Hunter (×2) and Ember Shard on the table, and Locked Vault in the hand. */
async function setUp(page: Page) {
  await mainPile(page).click();
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

async function centreOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Not on screen');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses the mouse on `from`, moves in steps to `to`, and leaves the button down. */
async function pickUp(page: Page, from: Locator, to: { x: number; y: number }) {
  const start = await centreOf(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
}

/** Empty table to the right of the cards, in the middle of the view. */
async function emptyTable(page: Page) {
  const area = await page.locator('.table-viewport').boundingBox();
  if (!area) throw new Error('No table');
  return { x: area.x + 640, y: area.y + area.height / 2 };
}

test.describe('TT-4 drag and drop', () => {
  test('mouse: a table card moves on the table, with a lifted copy, a drop outline and no axe violations', async ({ page }) => {
    await setUp(page);
    const target = await emptyTable(page);
    await pickUp(page, tableCard(page, 'Ember Shard'), target);
    await expect(page.locator('.drag-ghost')).toBeVisible();
    await expect(page.locator('.table-drop')).toBeVisible();
    await expect(status(page)).toHaveText('Dragging Ember Shard. Escape cancels.');
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await page.mouse.up();

    await expect(status(page)).toHaveText('Moved Ember Shard on the table.');
    await expect(tableCard(page, 'Ember Shard')).toBeFocused();
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
    const box = await tableCard(page, 'Ember Shard').boundingBox();
    expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - target.x)).toBeLessThan(3);
    // No menu opened by the drag's own click.
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('mouse: Escape puts the card back', async ({ page }) => {
    await setUp(page);
    const before = await tableCard(page, 'Ember Shard').boundingBox();
    await pickUp(page, tableCard(page, 'Ember Shard'), await emptyTable(page));
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(status(page)).toHaveText('Put Ember Shard back.');
    expect(await tableCard(page, 'Ember Shard').boundingBox()).toEqual(before);
  });

  test('mouse: table to a pile and to the hand, and hand to the table and a pile', async ({ page }) => {
    await setUp(page);
    await pickUp(page, tableCard(page, 'Ember Shard'), await centreOf(boardPile(page)));
    await expect(page.locator('.pile-tile--drop-target')).toContainText('Drop: top');
    await page.mouse.up();
    await expect(status(page)).toHaveText('Moved Ember Shard from the table to the top of Board cards.');
    await expect(boardPile(page)).toHaveAccessibleName(/^Board cards, 1 card/);

    await pickUp(page, tableCard(page, 'Daylight Hunter, front face').first(), await centreOf(hand(page)));
    await expect(page.locator('.hand-tray--drop-target')).toContainText("Drop: Player 1's hand");
    await page.mouse.up();
    await expect(status(page)).toHaveText("Moved Daylight Hunter from the table to Player 1's hand.");

    await pickUp(page, handCard(page, 'Locked Vault, double-faced'), await emptyTable(page));
    await page.mouse.up();
    await expect(status(page)).toHaveText("Moved Locked Vault from Player 1's hand to the table.");
    await expect(tableCard(page, 'Locked Vault, front face')).toBeFocused();

    await pickUp(page, handCard(page, 'Daylight Hunter, double-faced'), await centreOf(boardPile(page)));
    await page.mouse.up();
    await expect(status(page)).toHaveText("Moved Daylight Hunter from Player 1's hand to the top of Board cards.");
    await expect(hand(page)).toContainText('No cards in hand');
  });

  test('reduced motion: the lifted card neither grows nor tilts', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setUp(page);
    await pickUp(page, tableCard(page, 'Ember Shard'), await emptyTable(page));
    await expect(page.locator('.drag-ghost__lift')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    await page.mouse.up();
  });
});

test.describe('TT-4 drag and drop by touch at phone size', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('resting a finger on a card lifts it, and moving drops it on the table', async ({ page, browserName }) => {
    // Playwright only sends multi-step touch drags through Chromium's DevTools protocol.
    test.skip(browserName !== 'chromium', 'Touch drags need the Chromium DevTools protocol');
    await setUp(page);
    await page.locator('.table-viewport').evaluate((el) => el.scrollTo(0, 0));
    const from = await centreOf(tableCard(page, 'Ember Shard'));
    const area = await page.locator('.table-viewport').boundingBox();
    if (!area) throw new Error('No table');
    const to = { x: from.x - 40, y: area.y + area.height - 30 };
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', point?: { x: number; y: number }) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ x: Math.round(point.x), y: Math.round(point.y) }] : [] });
    await touch('touchStart', from);
    await page.waitForTimeout(400);
    await expect(page.locator('.drag-ghost')).toBeVisible();
    for (let i = 1; i <= 8; i++) await touch('touchMove', { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 });
    await touch('touchEnd');
    await expect(status(page)).toHaveText('Moved Ember Shard on the table.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
