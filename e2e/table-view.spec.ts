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
const status = (page: Page) => page.getByRole('status');
const viewport = (page: Page) => page.locator('.table-viewport');
const tableCard = (page: Page, name: string) => page.getByRole('group', { name: /^Table, / }).getByRole('button', { name, exact: true });
const zoomButton = (page: Page) => page.getByRole('button', { name: /^Zoom \d+%, reset$/ });

/** Loads the 60-row deck in CSV order and puts Card 01 to Card 09 on the table: two rows. */
async function nineOnTable(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('sixty-rows-two-dfc.csv'));
  await page.getByRole('button', { name: 'Done' }).click();
  await mainPile(page).focus();
  await page.keyboard.press('v');
  const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
  for (let i = 0; i < 9; i++) await viewer.getByRole('button', { name: /^To table/ }).first().click();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
}

async function allCardsInView(page: Page) {
  // Fit all can frame the table to the exact pixel, so allow for sub-pixel rounding at the edge.
  for (let i = 1; i <= 9; i++) await expect(tableCard(page, `Card 0${i}`)).toBeInViewport({ ratio: 0.999 });
}

test.describe('TT-1 and TT-2 pan, zoom, fit all and grid snap', () => {
  test('mouse: zoom buttons, Ctrl+wheel, drag to pan, fit all and snap, with no axe violations', async ({ page }) => {
    await nineOnTable(page);
    // Regression: auto-placed rows fill the table's width (8 spots at 1280 wide), not a fixed 6.
    // The three piles take the first three, so the first row holds five cards.
    const [first, fifth, sixth, pile] = await Promise.all(
      [tableCard(page, 'Card 01'), tableCard(page, 'Card 05'), tableCard(page, 'Card 06'), mainPile(page)].map((l) => l.boundingBox()),
    );
    expect(fifth?.y).toBe(first?.y);
    expect(sixth?.x).toBe(pile?.x);
    // The app fills the window: the page itself doesn't scroll, and the hand stays in view.
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    await expect(page.getByRole('region', { name: "Player 1's hand" })).toBeInViewport();

    await page.getByRole('button', { name: 'Zoom in (+)' }).click();
    await expect(zoomButton(page)).toHaveText('110%');
    await expect(status(page)).toHaveText('Zoom 110%.');
    await page.getByRole('button', { name: 'Zoom out (−)' }).click();
    await page.getByRole('button', { name: 'Zoom out (−)' }).click();
    await expect(zoomButton(page)).toHaveText('90%');
    await zoomButton(page).click();
    await expect(zoomButton(page)).toHaveText('100%');

    // Ctrl+wheel over the table zooms in around the pointer.
    const box = await viewport(page).boundingBox();
    if (!box) throw new Error('No table');
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    await expect(zoomButton(page)).toHaveText('200%');

    // Dragging empty space pans. The mat reaches two cards past the last card, so its far right is empty.
    const before = await viewport(page).evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
      return el.scrollLeft;
    });
    await page.mouse.move(box.x + box.width - 260, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 60, box.y + 60, { steps: 5 });
    await page.mouse.up();
    expect(await viewport(page).evaluate((el) => el.scrollLeft)).toBe(before - 200);

    await page.getByRole('button', { name: 'Fit all cards (0)' }).click();
    await expect(status(page)).toHaveText(/^Showing all 9 cards and 3 piles at \d+%\.$/);
    await allCardsInView(page);

    const snap = page.getByRole('button', { name: 'Snap to grid (G)' });
    await expect(snap).toHaveAttribute('aria-pressed', 'false');
    await snap.click();
    await expect(snap).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.table-surface--grid')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
  });

  test('keyboard only: + and − zoom, 0 fits, G snaps, and Shift+arrows pan', async ({ page }) => {
    await nineOnTable(page);
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await expect(zoomButton(page)).toHaveText('125%');
    await page.keyboard.press('-');
    await expect(status(page)).toHaveText('Zoom 110%.');

    // At 200% the mat is bigger than the view both ways.
    for (let i = 0; i < 6; i++) await page.keyboard.press('+');
    await expect(zoomButton(page)).toHaveText('200%');
    await tableCard(page, 'Card 01').focus();
    const scroll = () => viewport(page).evaluate((el) => [el.scrollLeft, el.scrollTop]);
    const [left = 0, top = 0] = await scroll();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(scroll).toEqual([left + 64, top + 64]);
    await expect(tableCard(page, 'Card 01')).toBeFocused();

    await page.keyboard.press('0');
    await allCardsInView(page);
    await page.keyboard.press('g');
    await expect(status(page)).toHaveText('Snap to grid on.');
    await expect(page.getByRole('button', { name: 'Snap to grid (G)' })).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('TT-1 table view on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the toolbar fits, the page never scrolls sideways, and fit all frames every card', async ({ page }) => {
    await nineOnTable(page);
    await expect(page.getByRole('button', { name: 'Snap to grid (G)' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.getByRole('button', { name: 'Fit all cards (0)' }).click();
    await viewport(page).scrollIntoViewIfNeeded();
    await allCardsInView(page);
  });
});
