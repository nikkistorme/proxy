import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const style = { size: 14, weight: 700, align: 'left', valign: 'top', font: 'sans', color: '#1e1c1a', background: '#e3e7ee' };
const hero = {
  id: 'l-hero',
  name: 'Hero',
  orientation: 'portrait',
  boxes: [
    { id: 'name', x: 5, y: 5, width: 90, height: 15, content: { kind: 'column', columns: ['name'], as: 'text' }, style },
    { id: 'rules', x: 5, y: 60, width: 90, height: 30, content: { kind: 'column', columns: ['rules'], as: 'text' }, style: { ...style, weight: 400 } },
  ],
  updatedAt: '2026-10-28T00:00:00.000Z',
  version: 1,
};
const csv = 'id,name,rules,back_of\nw,Werewolf,Howls at night,\n,Wolf form,Bites,w\nt,Troll,Regenerates,\n';

const editor = (page: Page) => page.getByRole('dialog', { name: 'Card layouts' });
const layoutsButton = (page: Page) => page.getByRole('button', { name: 'Card layouts (L)' });
const preview = (page: Page) => editor(page).getByRole('group', { name: 'Preview' });
const card = (page: Page) => editor(page).locator('.layout-canvas__card');

/** Saves the Hero layout straight into IndexedDB, where the app's storage keeps it (PS-7 keys). */
async function seedHero(page: Page) {
  await page.evaluate(
    (item) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(item, `/proxy/|guest|layout|${item.id}`);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    hero,
  );
}

/** Hero saved, and a CSV with a double-faced card loaded into P1's main deck. */
async function setUp(page: Page) {
  await page.goto('./');
  await seedHero(page);
  await page.reload();
  await page.getByRole('button', { name: /^P1 main deck,/ }).click({ button: 'right' });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles({ name: 'deck.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Done' }).click();
}

test.describe('LY-7 preview with real cards', () => {
  test('steps through the loaded cards by keyboard, drawing each on the canvas', async ({ page }) => {
    await setUp(page);
    await layoutsButton(page).focus();
    await page.keyboard.press('l');
    await editor(page).getByRole('button', { name: 'Edit Hero' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Add box' })).toBeFocused();
    await expect(preview(page)).toContainText('Werewolf 1 of 3');
    await expect(card(page).getByText('Howls at night')).toBeVisible();

    // Past Delete box and the two boxes on the card to the preview's Previous and Next, below the card.
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    await expect(preview(page).getByRole('button', { name: 'Previous card' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(preview(page).getByRole('button', { name: 'Next card' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(preview(page)).toContainText('Wolf form, back 2 of 3');
    await expect(editor(page).getByRole('status')).toHaveText('Previewing Wolf form, back, 2 of 3.');
    await expect(card(page).getByText('Bites')).toBeVisible();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(preview(page)).toContainText('Werewolf 1 of 3');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect(preview(page)).toContainText('Troll 3 of 3');
    await expect(card(page).getByText('Regenerates')).toBeVisible();
  });

  test('steps by mouse, with no axe violations', async ({ page }) => {
    await setUp(page);
    await layoutsButton(page).click();
    await editor(page).getByRole('button', { name: 'Edit Hero' }).click();
    await preview(page).getByRole('button', { name: 'Next card' }).click();
    await expect(card(page).getByText('Wolf form')).toBeVisible();

    const results = await new AxeBuilder({ page }).include('.layout-editor').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);

    // The previewed card stays while going back to the list and in again.
    await editor(page).getByRole('button', { name: 'Back to layouts' }).click();
    await editor(page).getByRole('button', { name: 'Edit Hero' }).click();
    await expect(preview(page)).toContainText('Wolf form, back 2 of 3');
  });
});

test.describe('LY-7 preview on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('fits the preview row below the card, with no sideways scroll', async ({ page }) => {
    await setUp(page);
    await layoutsButton(page).click();
    await editor(page).getByRole('button', { name: 'Edit Hero' }).click();
    const row = await preview(page).boundingBox();
    const cardBox = await card(page).boundingBox();
    if (!row || !cardBox) throw new Error('No preview');
    expect(row.x).toBeGreaterThanOrEqual(0);
    expect(row.x + row.width).toBeLessThanOrEqual(375);
    expect(row.y).toBeGreaterThanOrEqual(cardBox.y + cardBox.height);
    expect(cardBox.width).toBeGreaterThan(150);

    // Stepping to a longer name doesn't change the card's size.
    await preview(page).getByRole('button', { name: 'Next card' }).click();
    await expect(preview(page)).toContainText('Wolf form, back');
    // The screen may scroll to the row, so compare the card's size, not its place.
    expect(await card(page).boundingBox()).toMatchObject({ width: cardBox.width, height: cardBox.height });
    const canvas = editor(page).locator('.layout-canvas');
    expect(await canvas.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});
