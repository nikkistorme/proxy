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
const status = (page: Page) => page.getByRole('status').first();
const viewer = (page: Page) => page.getByRole('dialog', { name: 'P1 main deck' });
const viewerCard = (page: Page, name: string) => viewer(page).getByRole('button', { name: new RegExp(`^${name}\\. `) });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const hand = (page: Page) => page.getByRole('region', { name: "Player 1's hand" });

/** double-faced.csv in CSV order in P1 main deck (Daylight Hunter ×2, Ember Shard, Locked Vault), with the viewer open. */
async function setUp(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('double-faced.csv'));
  await page.getByRole('button', { name: 'Done' }).click();
  await mainPile(page).focus();
  await page.keyboard.press('v');
  await expect(viewer(page)).toBeVisible();
}

async function centreOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Not on screen');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses the mouse on `from` and moves in steps to wherever `to` gives once the viewer has stepped aside. */
async function pickUp(page: Page, from: Locator, to: () => Promise<{ x: number; y: number }>) {
  const start = await centreOf(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 20, start.y, { steps: 2 });
  await expect(viewer(page)).toBeHidden();
  const end = await to();
  await page.mouse.move(end.x, end.y, { steps: 8 });
}

/** Empty table to the right of the piles, in the middle of the view. */
async function emptyTable(page: Page) {
  const area = await page.locator('.table-viewport').boundingBox();
  if (!area) throw new Error('No table');
  return { x: area.x + Math.min(960, area.width - 80), y: area.y + area.height / 2 };
}

test.describe('TT-4 dragging from the pile viewer', () => {
  test('mouse: a card drags to the table, with the viewer out of the way, and the viewer comes back', async ({ page }) => {
    await setUp(page);
    await pickUp(page, viewerCard(page, 'Ember Shard'), () => emptyTable(page));
    await expect(page.locator('.drag-ghost')).toBeVisible();
    await expect(page.locator('.table-drop')).toBeVisible();
    await expect(status(page)).toHaveText('Dragging Ember Shard. Escape cancels.');
    const during = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(during.violations).toEqual([]);
    await page.mouse.up();

    await expect(viewer(page)).toBeVisible();
    await expect(viewer(page)).toContainText('3 cards');
    await expect(viewerCard(page, 'Locked Vault')).toBeFocused();
    await expect(table(page).getByRole('button', { name: 'Ember Shard', exact: true })).toHaveCount(1);
    await viewer(page).evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
    const after = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(after.violations).toEqual([]);
  });

  test('mouse: a card drags to the hand and to another pile; Escape puts one back', async ({ page }) => {
    await setUp(page);
    await pickUp(page, viewerCard(page, 'Locked Vault'), () => centreOf(hand(page)));
    await page.mouse.up();
    await expect(hand(page).getByRole('button', { name: /^Locked Vault/ })).toBeVisible();
    await expect(viewer(page)).toBeVisible();

    await pickUp(page, viewerCard(page, 'Ember Shard'), () => centreOf(boardPile(page)));
    await page.mouse.up();
    await expect(boardPile(page)).toHaveAccessibleName(/^Board cards, 1 card/);
    await expect(viewer(page)).toContainText('2 cards');

    await pickUp(page, viewerCard(page, 'Daylight Hunter').first(), () => emptyTable(page));
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(viewer(page)).toBeVisible();
    await expect(viewer(page)).toContainText('2 cards');
    await expect(viewerCard(page, 'Daylight Hunter').first()).toBeFocused();
  });
});

test.describe('TT-4 dragging from the pile viewer by touch at phone size', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('resting a finger on a card lifts it, and it drops in the hand', async ({ page, browserName }) => {
    // Playwright only sends multi-step touch drags through Chromium's DevTools protocol.
    test.skip(browserName !== 'chromium', 'Touch drags need the Chromium DevTools protocol');
    await setUp(page);
    await viewerCard(page, 'Ember Shard').scrollIntoViewIfNeeded();
    const from = await centreOf(viewerCard(page, 'Ember Shard'));
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', point?: { x: number; y: number }) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ x: Math.round(point.x), y: Math.round(point.y) }] : [] });
    await touch('touchStart', from);
    await page.waitForTimeout(400);
    await expect(page.locator('.drag-ghost')).toBeVisible();
    await expect(viewer(page)).toBeHidden();
    await hand(page).scrollIntoViewIfNeeded();
    const to = await centreOf(hand(page));
    for (let i = 1; i <= 8; i++) await touch('touchMove', { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 });
    await touch('touchEnd');
    await expect(viewer(page)).toBeVisible();
    await expect(viewer(page)).toContainText('3 cards');
    await page.keyboard.press('Escape');
    await expect(hand(page).getByRole('button', { name: 'Ember Shard', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
