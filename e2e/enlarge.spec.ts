import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
});

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const hunter = (page: Page) =>
  table(page)
    .getByRole('button', { name: /^Daylight Hunter, front face/ })
    .first();
const shard = (page: Page) => table(page).getByRole('button', { name: 'Ember Shard', exact: true });
const preview = (page: Page) => page.locator('.card-enlarge');

/** double-faced.csv in CSV order; puts Daylight Hunter (double-faced) and Ember Shard on the table. */
async function cardsOnTable(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('double-faced.csv'));
  await page.getByRole('button', { name: 'Done' }).click();
  await mainPile(page).focus();
  await page.keyboard.press('v');
  const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
  for (let i = 0; i < 3; i++)
    await viewer
      .getByRole('button', { name: /^To table/ })
      .first()
      .click();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
}

/** The preview and its card must not overlap (brief: never covering the card itself). */
async function besideCard(page: Page, card: ReturnType<typeof shard>) {
  const a = await preview(page).boundingBox();
  const b = await card.locator('xpath=ancestor::div[contains(@class, "table-card ")]').boundingBox();
  if (!a || !b) throw new Error('No boxes');
  const apart = a.x >= b.x + b.width || b.x >= a.x + a.width || a.y >= b.y + b.height || b.y >= a.y + a.height;
  expect(apart).toBe(true);
}

test.describe('TT-9 enlarge', () => {
  test('keyboard only: I opens it, Show back flips the preview, and I or Escape close it', async ({ page }) => {
    await cardsOnTable(page);
    await hunter(page).focus();
    await page.keyboard.press('i');
    await expect(page.getByRole('dialog', { name: 'Enlarged: Daylight Hunter' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show back' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Enlarged: Moonrise Hunter' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show front' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(preview(page)).toHaveCount(0);
    // The card itself never flipped.
    await expect(hunter(page)).toBeFocused();

    // Turned on the table, it's still shown upright, and the preview's size ignores zoom.
    await shard(page).focus();
    await page.keyboard.press('r');
    await page.getByRole('button', { name: 'Zoom out (−)' }).click();
    const turned = table(page).getByRole('button', { name: 'Ember Shard, rotated 90°', exact: true });
    await turned.focus();
    await page.keyboard.press('i');
    await expect(preview(page)).toBeVisible();
    expect(
      await preview(page)
        .locator('.card-face')
        .evaluate((el) => getComputedStyle(el).transform),
    ).toBe('none');
    expect((await preview(page).locator('.card-face').boundingBox())?.width).toBeCloseTo(216, 1);
    await besideCard(page, turned);
    await page.keyboard.press('i');
    await expect(preview(page)).toHaveCount(0);
    await expect(turned).toBeFocused();

    // Escape steps back from a card or a pile to the table.
    await page.keyboard.press('Escape');
    await expect(table(page)).toBeFocused();
    await mainPile(page).focus();
    await page.keyboard.press('Escape');
    await expect(table(page)).toBeFocused();
  });

  test('mouse: resting on a card enlarges it beside the card, with no axe violations', async ({ page }) => {
    await cardsOnTable(page);
    await shard(page).hover();
    await expect(page.getByRole('dialog', { name: 'Enlarged: Ember Shard' })).toBeVisible();
    await expect(shard(page)).not.toBeFocused();
    await besideCard(page, shard(page));
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await page.mouse.move(5, 5);
    await expect(preview(page)).toHaveCount(0);

    // The double-faced badge shows, and the preview's button works by mouse.
    await expect(hunter(page).locator('xpath=..').locator('.table-card__badge--dfc')).toBeVisible();
    await hunter(page).hover();
    await page.getByRole('button', { name: 'Show back' }).click();
    await expect(page.getByRole('dialog', { name: 'Enlarged: Moonrise Hunter' })).toBeVisible();
  });
});

test.describe('TT-9 enlarge on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('a held finger let go opens the card menu, and Enlarge fits the screen', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Touch holds need the Chromium DevTools protocol');
    await cardsOnTable(page);
    // The setup's clicks leave the mouse resting on a card; move it off the table.
    await page.mouse.move(370, 660);
    const card = table(page)
      .getByRole('button', { name: /^Daylight Hunter/ })
      .first();
    const box = await card.boundingBox();
    if (!box) throw new Error('No card');
    const cdp = await page.context().newCDPSession(page);
    const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.waitForTimeout(400);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const menu = page.getByRole('menu', { name: 'Actions for Daylight Hunter' });
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Enlarge' }).tap();
    await expect(preview(page)).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    // A tap elsewhere closes it.
    await page.touchscreen.tap(360, 600);
    await expect(preview(page)).toHaveCount(0);
  });
});
