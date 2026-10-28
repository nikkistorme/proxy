import { expect, test, type Page } from '@playwright/test';

const style = { size: 10, weight: 700, align: 'left', valign: 'top', font: 'sans', color: '#1e1c1a', background: '#e3e7ee' };
const hero = {
  id: 'l-hero',
  name: 'Hero',
  orientation: 'portrait',
  boxes: [
    { id: 'title', x: 0, y: 0, width: 100, height: 20, content: { kind: 'text', text: 'Hero frame' }, style },
    { id: 'name', x: 0, y: 40, width: 100, height: 20, content: { kind: 'column', columns: ['name'], as: 'text' }, style },
  ],
  updatedAt: '2026-10-27T00:00:00.000Z',
  version: 1,
};

/** Saves a layout item straight into IndexedDB, where the app's storage keeps it (PS-7 keys). */
async function seedLayout(page: Page) {
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

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });

/** Loads a two-card CSV, Troll naming the Hero layout, and puts both cards on the table. */
async function bothOnTable(page: Page) {
  await mainPile(page).click({ button: 'right' });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles({ name: 'deck.csv', mimeType: 'text/csv', buffer: Buffer.from('name,layout\nTroll,Hero\nGoblin,\n') });
  await page.getByRole('button', { name: 'Done' }).click();
  await mainPile(page).focus();
  await page.keyboard.press('v');
  const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
  for (let i = 0; i < 2; i++) await viewer.getByRole('button', { name: /^To table/ }).first().click();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
}

const face = (page: Page, label: string) => table(page).locator(`.card-face[aria-label="${label}"]`);

test.describe('LY-8 and PS-1 stored layouts', () => {
  test('a stored layout draws table cards and is still there after a reload', async ({ page }) => {
    await page.goto('./');
    await seedLayout(page);
    await page.reload();
    await bothOnTable(page);
    await expect(face(page, 'Hero frame. Troll')).toBeVisible();
    await expect(face(page, 'Goblin')).toBeVisible();

    // Sessions aren't saved until Phase 7, so load the deck again; the layout is saved.
    await page.reload();
    await bothOnTable(page);
    await expect(face(page, 'Hero frame. Troll')).toBeVisible();
  });
});

test.describe('LY-8 stored layouts on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('draws the stored layout without sideways scrolling', async ({ page }) => {
    await page.goto('./');
    await seedLayout(page);
    await page.reload();
    await bothOnTable(page);
    await expect(face(page, 'Hero frame. Troll')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
