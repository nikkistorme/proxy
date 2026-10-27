import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
});

const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const pile = (page: Page, name: string) => table(page).getByRole('button', { name: new RegExp(`^${name},`) });
const status = (page: Page) => page.getByRole('status');
const hand = (page: Page) => page.getByRole('list', { name: /hand/i });

async function centreOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Not on screen');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Where a pile sits on the table, in table px. */
async function spotOf(locator: Locator) {
  return locator.locator('xpath=ancestor::div[contains(@class, "table-pile")][1]').evaluate((el) => ({ x: parseFloat((el as HTMLElement).style.left), y: parseFloat((el as HTMLElement).style.top) }));
}

async function dropFile(page: Page, target: Locator, name: string, contents: string) {
  const dataTransfer = await page.evaluateHandle(
    ({ name, contents }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([contents], name, { type: 'text/csv' }));
      return transfer;
    },
    { name, contents },
  );
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
}

test.describe('3m-2 moving piles', () => {
  test('mouse: dragging moves a pile, then a click still draws, right-click opens its menu, and CSV drops still load', async ({ page }) => {
    const board = pile(page, 'Board cards');
    const from = await centreOf(board);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    // Empty table, in the middle of the view.
    const area = await page.locator('.table-viewport').boundingBox();
    if (!area) throw new Error('No table');
    await page.mouse.move(area.x + 700, area.y + area.height / 2, { steps: 8 });
    await expect(page.locator('.drag-ghost')).toContainText('Board cards');
    await expect(status(page)).toHaveText('Dragging Board cards. Escape cancels.');
    // Where the pile came from is a faded, dashed placeholder until the drop, as for cards.
    const results = await new AxeBuilder({ page }).withTags(axeTags).exclude('.card-drag-origin').analyze();
    expect(results.violations).toEqual([]);
    await page.mouse.up();
    await expect(status(page)).toHaveText('Moved Board cards on the table.');
    await expect(board).toBeFocused();
    const moved = await spotOf(board);
    expect(moved.x).toBeGreaterThan(500);
    expect(moved.y).toBeGreaterThan(16);

    // Its CSV drop, menu and click still work where it is now.
    await dropFile(page, board, 'tokens.csv', 'name\nSpark\nSpark\n');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(board).toHaveAccessibleName(/^Board cards, 2 cards/);
    await board.click({ button: 'right' });
    await expect(page.getByRole('menu', { name: 'Actions for Board cards' })).toBeVisible();
    await page.keyboard.press('Escape');
    await board.click();
    await expect(status(page)).toContainText('Player 1 drew Spark from Board cards.');
    await expect(hand(page).getByRole('button', { name: /^Spark/ })).toHaveCount(1);
    expect(await spotOf(board)).toEqual(moved);
  });

  test('keyboard only: Space picks a pile up, arrows move it, Enter places it, and Move on table works from the menu', async ({ page }) => {
    const main = pile(page, 'P1 main deck');
    await main.focus();
    await page.keyboard.press('Space');
    const outline = page.getByRole('button', { name: /^Placing P1 main deck/ });
    await expect(outline).toBeFocused();
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('Moved P1 main deck on the table.');
    await expect(main).toBeFocused();
    expect(await spotOf(main)).toEqual({ x: 16, y: 208 });

    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: /^Move on table/ }).press('Enter');
    await expect(outline).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(status(page)).toHaveText('Put P1 main deck back.');
    await expect(main).toBeFocused();
    expect(await spotOf(main)).toEqual({ x: 16, y: 208 });
  });
});

test.describe('3m-2 moving piles by touch at phone size', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('a held finger moved drags a pile, a held finger let go opens its menu, and a tap draws', async ({ page, browserName }) => {
    // Playwright only sends multi-step touch drags through Chromium's DevTools protocol.
    test.skip(browserName !== 'chromium', 'Touch drags need the Chromium DevTools protocol');
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', point?: { x: number; y: number }) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ x: Math.round(point.x), y: Math.round(point.y) }] : [] });
    const main = pile(page, 'P1 main deck');

    // Held and let go in place: the menu, which fits the phone.
    let from = await centreOf(main);
    await touch('touchStart', from);
    await page.waitForTimeout(400);
    await touch('touchEnd');
    const menu = page.getByRole('menu', { name: 'Actions for P1 main deck' });
    await expect(menu).toBeInViewport({ ratio: 1 });
    expect(await spotOf(main)).toEqual({ x: 16, y: 16 });
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    // A tap on empty table closes it.
    const area = await page.locator('.table-viewport').boundingBox();
    if (!area) throw new Error('No table');
    await page.touchscreen.tap(area.x + area.width - 20, area.y + area.height - 20);
    await expect(menu).toHaveCount(0);

    // Held and moved: the pile follows the finger down the table.
    from = await centreOf(main);
    const to = { x: from.x + 20, y: from.y + 200 };
    await touch('touchStart', from);
    await page.waitForTimeout(400);
    await expect(page.locator('.drag-ghost')).toBeVisible();
    for (let i = 1; i <= 8; i++) await touch('touchMove', { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 });
    await touch('touchEnd');
    await expect(status(page)).toHaveText('Moved P1 main deck on the table.');
    expect((await spotOf(main)).y).toBeGreaterThan(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

    // A tap draws: the empty pile says so.
    await main.tap();
    await expect(status(page)).toHaveText('P1 main deck is empty. No cards drawn.');
  });
});
