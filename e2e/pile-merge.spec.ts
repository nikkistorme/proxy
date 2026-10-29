import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
});

const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const pile = (page: Page, name: string) => table(page).getByRole('button', { name: new RegExp(`^${name},`) });
const status = (page: Page) => page.getByRole('status');
const mergeDialog = (page: Page) => page.getByRole('dialog', { name: /^Merge / });

async function centreOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Not on screen');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Where a pile sits on the table, in table px. */
async function spotOf(locator: Locator) {
  return locator.locator('xpath=ancestor::div[contains(@class, "table-pile")][1]').evaluate((el) => ({ x: parseFloat((el as HTMLElement).style.left), y: parseFloat((el as HTMLElement).style.top) }));
}

/** Loads two Sparks into Board cards. */
async function loadBoard(page: Page) {
  const board = pile(page, 'Board cards');
  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['name\nSpark\nSpark\n'], 'tokens.csv', { type: 'text/csv' }));
    return transfer;
  });
  await board.dispatchEvent('dragenter', { dataTransfer });
  await board.dispatchEvent('dragover', { dataTransfer });
  await board.dispatchEvent('drop', { dataTransfer });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(board).toHaveAccessibleName(/^Board cards, 2 cards/);
}

/** Drags Board cards by mouse until it covers Environment deck, without letting go. */
async function dragBoardOntoEnv(page: Page) {
  const from = await centreOf(pile(page, 'Board cards'));
  const to = await centreOf(pile(page, 'Environment deck'));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x + 10, to.y + 10, { steps: 8 });
}

test.describe('3m-3 merging piles', () => {
  test('mouse: dropping a pile on another asks how to merge them; Cancel changes nothing, and a merge can be undone', async ({ page }) => {
    await loadBoard(page);
    const board = pile(page, 'Board cards');
    const env = pile(page, 'Environment deck');
    const start = await spotOf(board);

    await dragBoardOntoEnv(page);
    await expect(page.locator('.pile-tile--drop-target')).toContainText('Drop: merge');
    let results = await new AxeBuilder({ page }).withTags(axeTags).exclude('.card-drag-origin').analyze();
    expect(results.violations).toEqual([]);
    await page.mouse.up();

    const dialog = mergeDialog(page);
    await expect(dialog).toHaveAccessibleName('Merge Board cards and Environment deck?');
    await expect(dialog).toContainText('Board cards will be deleted, and its 2 cards will go to the top of Environment deck.');
    results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await spotOf(board)).toEqual(start);
    await expect(board).toBeFocused();

    await dragBoardOntoEnv(page);
    await page.mouse.up();
    await mergeDialog(page).getByRole('button', { name: 'Merge piles' }).click();
    await expect(status(page)).toHaveText('Merged Board cards into Environment deck. 2 cards.');
    await expect(env).toBeFocused();
    await expect(env).toHaveAccessibleName(/^Environment deck, 2 cards/);
    await expect(board).toHaveCount(0);

    await page.keyboard.press('Control+z');
    await expect(board).toHaveAccessibleName(/^Board cards, 2 cards/);
    expect(await spotOf(board)).toEqual(start);
  });

  test('keyboard only: Enter with the outline over a pile merges them, choosing which pile goes and where its cards go', async ({ page }) => {
    await loadBoard(page);
    const board = pile(page, 'Board cards');
    await board.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: /^Placing Board cards/ })).toBeFocused();
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(status(page)).toHaveText('Row 1, column 2, over Environment deck. Enter merges them.');
    await page.keyboard.press('Enter');

    const dialog = mergeDialog(page);
    await expect(dialog.getByRole('radio', { name: 'Board cards 2 cards' })).toBeFocused();
    // Keep Board cards instead: Environment deck goes, and its cards go on the bottom.
    await page.keyboard.press('ArrowDown');
    await expect(dialog.getByRole('radio', { name: 'Environment deck 0 cards' })).toBeChecked();
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await expect(dialog.getByRole('radio', { name: 'Bottom' })).toBeChecked();
    await page.keyboard.press('Enter');

    await expect(status(page)).toHaveText('Merged Environment deck into Board cards. 2 cards.');
    await expect(board).toBeFocused();
    await expect(pile(page, 'Environment deck')).toHaveCount(0);
    // The kept pile stays where it was.
    expect(await spotOf(board)).toEqual({ x: 300, y: 16 });
  });
});

test.describe('3m-3 merging piles by touch at phone size', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('a held finger drops a pile on another, and the merge dialog fits the phone', async ({ page, browserName }) => {
    // Playwright only sends multi-step touch drags through Chromium's DevTools protocol.
    test.skip(browserName !== 'chromium', 'Touch drags need the Chromium DevTools protocol');
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', point?: { x: number; y: number }) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ x: Math.round(point.x), y: Math.round(point.y) }] : [] });

    const from = await centreOf(pile(page, 'Environment deck'));
    const to = await centreOf(pile(page, 'P1 main deck'));
    await touch('touchStart', from);
    await page.waitForTimeout(400);
    for (let i = 1; i <= 8; i++) await touch('touchMove', { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 });
    await expect(page.locator('.pile-tile--drop-target')).toContainText('Drop: merge');
    await touch('touchEnd');

    const dialog = mergeDialog(page);
    await expect(dialog).toHaveAccessibleName('Merge Environment deck and P1 main deck?');
    await expect(dialog.getByRole('button', { name: 'Merge piles' })).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport({ ratio: 1 });
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

    await dialog.getByRole('button', { name: 'Merge piles' }).tap();
    await expect(status(page)).toHaveText('Merged Environment deck into P1 main deck. 0 cards.');
    await expect(pile(page, 'Environment deck')).toHaveCount(0);
  });
});
