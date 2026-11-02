import { expect, test, type Page } from '@playwright/test';
import { closeWith } from './keyboard';

const ART = /\/demo\/art\//;
const VIEWER_CHUNK = /PileViewer-.*\.js/;

const sessionButton = (page: Page) => page.getByRole('button', { name: 'This session' });
const board = (page: Page) => page.getByRole('button', { name: /^Board cards,/ });
const viewer = (page: Page) => page.getByRole('dialog', { name: 'Board cards' });
const toast = (page: Page) => page.locator('.toast');

async function loadDemo(page: Page) {
  await sessionButton(page).click();
  await page.getByRole('menuitem', { name: 'New session…' }).click();
  await page.getByRole('dialog', { name: 'New session' }).getByRole('button', { name: 'Load demo' }).click();
  await expect(page.locator('.table-surface')).toBeFocused();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
});

test.describe('PF-3 pile viewer chunk', () => {
  test('is not requested at page load, and is requested on the first open', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      if (VIEWER_CHUNK.test(request.url())) requested.push(request.url());
    });
    await page.reload();
    await expect(page.getByText('Loading your session…')).toHaveCount(0);
    await loadDemo(page);
    expect(requested).toEqual([]);
    await board(page).focus();
    await page.keyboard.press('v');
    await expect(viewer(page)).toBeVisible();
    expect(requested.length).toBeGreaterThan(0);
  });

  test('on a slow network, opening by mouse puts focus in the viewer and closing returns it to the pile', async ({ page }) => {
    await loadDemo(page);
    await page.route(VIEWER_CHUNK, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await board(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: /View/ }).click();
    await expect(viewer(page)).toBeVisible();
    await expect(viewer(page).locator(':focus')).toHaveCount(1);
    await closeWith(page, viewer(page), { focusOn: board(page) });
  });

  test('on a slow network, opening by keyboard puts focus in the viewer and closing returns it to the pile', async ({ page }) => {
    await loadDemo(page);
    await page.route(VIEWER_CHUNK, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await board(page).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: /View/ }).click();
    await expect(viewer(page)).toBeVisible();
    await expect(viewer(page).locator(':focus')).toHaveCount(1);
    await closeWith(page, viewer(page), { focusOn: board(page) });
  });

  test('a blocked chunk shows a message, leaves the session as it was and returns focus to the pile', async ({ page }) => {
    await loadDemo(page);
    const pilesBefore = await page.getByRole('button', { name: /cards?,|empty/ }).allTextContents();
    await page.route(VIEWER_CHUNK, (route) => route.abort());
    await board(page).focus();
    await page.keyboard.press('v');
    await expect(toast(page)).toContainText("Couldn't open the pile viewer. Check your connection, then reload the page.");
    await expect(page.getByRole('status').filter({ hasText: /^Couldn't open/ })).toHaveCount(1);
    await expect(viewer(page)).toHaveCount(0);
    await expect(board(page)).toBeFocused();
    await expect(page.getByRole('banner')).toContainText('Co-op PvE');
    expect(await page.getByRole('button', { name: /cards?,|empty/ }).allTextContents()).toEqual(pilesBefore);
  });
});

test.describe('PF-1 card art', () => {
  test('late art does not move the card or its neighbours', async ({ page }) => {
    await loadDemo(page);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(ART, async (route) => {
      await held;
      await route.continue();
    });
    await board(page).focus();
    await page.keyboard.press('v');
    await viewer(page).getByRole('button', { name: /^To table/ }).first().click();
    await closeWith(page, viewer(page));
    const cards = page.locator('.table-surface [data-card-id], .table-surface .table-card');
    await expect(cards.first()).toBeVisible();
    const boxes = async () => Promise.all((await cards.all()).map((card) => card.boundingBox()));
    const before = await boxes();
    const image = page.locator('.table-surface img.card-art').first();
    await expect(image).toHaveCount(1);
    expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(0);
    release();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    expect(await boxes()).toEqual(before);
  });

  test('art shows in the viewer and on a card moved from the pile to the table', async ({ page }) => {
    await loadDemo(page);
    await board(page).focus();
    await page.keyboard.press('v');
    const first = viewer(page).locator('img.card-art').first();
    await expect(first).toBeVisible();
    await expect.poll(() => first.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await viewer(page).getByRole('button', { name: /^To table/ }).first().click();
    await closeWith(page, viewer(page));
    const onTable = page.locator('.table-surface img.card-art').first();
    await expect(onTable).toBeVisible();
    await expect.poll(() => onTable.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  });

  test('art below the fold in the viewer is not requested until scrolled to', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 420 });
    const requested = new Set<string>();
    await page.route('https://art.test/**', (route) => {
      requested.add(route.request().url());
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' });
    });
    const rows = Array.from({ length: 60 }, (_, i) => `Card ${i + 1},https://art.test/${i + 1}.svg`);
    const pile = page.getByRole('button', { name: /^P1 main deck,/ });
    await pile.click({ button: 'right' });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
    await (await chooser).setFiles({ name: 'art.csv', mimeType: 'text/csv', buffer: Buffer.from(`name,image\n${rows.join('\n')}\n`) });
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(pile).toHaveAccessibleName(/60 cards/);
    expect(requested.size).toBe(0);

    await pile.focus();
    await page.keyboard.press('v');
    const dialog = page.getByRole('dialog', { name: 'P1 main deck' });
    await expect(dialog).toBeVisible();
    const images = dialog.locator('img.card-art');
    await expect(images).toHaveCount(60);
    await expect.poll(() => requested.size).toBeGreaterThan(0);
    await page.waitForTimeout(300);
    const early = requested.size;
    expect(early).toBeLessThan(60);
    const lastSrc = await images.last().getAttribute('src');
    expect(requested.has(lastSrc ?? '')).toBe(false);
    await images.last().scrollIntoViewIfNeeded();
    await expect.poll(() => requested.has(lastSrc ?? '')).toBe(true);
    expect(requested.size).toBeGreaterThan(early);
  });
});
