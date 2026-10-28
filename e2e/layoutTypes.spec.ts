import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const style = { size: 10, weight: 700, align: 'left', valign: 'top', font: 'sans', color: '#1e1c1a', background: '#e3e7ee' };
const villain = {
  id: 'l-villain',
  name: 'Villain',
  orientation: 'portrait',
  boxes: [
    { id: 'title', x: 0, y: 0, width: 100, height: 20, content: { kind: 'text', text: 'Villain frame' }, style },
    { id: 'name', x: 0, y: 40, width: 100, height: 20, content: { kind: 'column', columns: ['name'], as: 'text' }, style },
  ],
  updatedAt: '2026-10-28T00:00:00.000Z',
  version: 1,
};

const editor = (page: Page) => page.getByRole('dialog', { name: 'Card layouts' });
const layoutsButton = (page: Page) => page.getByRole('button', { name: 'Card layouts (L)' });
const choices = (page: Page) => editor(page).getByRole('region', { name: 'Choosing layouts' });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const face = (page: Page, label: string) => table(page).locator(`.card-face[aria-label="${label}"]`);

/** Saves the Villain layout straight into IndexedDB, where the app's storage keeps it (PS-7 keys). */
async function seedVillain(page: Page) {
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
    villain,
  );
}

/** Villain saved, and a Monster (Troll) and an untyped card (Goblin) on the table. */
async function setUp(page: Page) {
  await page.goto('./');
  await seedVillain(page);
  await page.reload();
  const mainPile = page.getByRole('button', { name: /^P1 main deck,/ });
  await mainPile.click({ button: 'right' });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles({ name: 'deck.csv', mimeType: 'text/csv', buffer: Buffer.from('name,type\nTroll,Monster\nGoblin,\n') });
  await page.getByRole('button', { name: 'Done' }).click();
  await mainPile.focus();
  await page.keyboard.press('v');
  const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
  for (let i = 0; i < 2; i++)
    await viewer
      .getByRole('button', { name: /^To table/ })
      .first()
      .click();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(face(page, 'Troll. Monster')).toBeVisible();
}

test.describe('LY-8 choosing layouts by type', () => {
  test('maps a type and adds one by keyboard, the table follows, and the choice lasts after a reload', async ({ page }) => {
    await setUp(page);
    await layoutsButton(page).focus();
    await page.keyboard.press('l');
    await expect(editor(page).getByRole('button', { name: 'New layout' })).toBeFocused();

    // From the default layout's picker on to the Monster type's.
    await choices(page).getByRole('combobox', { name: 'Default layout' }).focus();
    await page.keyboard.press('Tab');
    const monster = choices(page).getByRole('combobox', { name: 'Layout for Monster cards' });
    await expect(monster).toBeFocused();
    // Typing a letter picks an option without opening the list.
    await page.keyboard.type('V');
    await expect(monster).toHaveValue('l-villain');
    await expect(editor(page).getByRole('status')).toHaveText('Monster cards use Villain.');

    await page.keyboard.press('Tab');
    await expect(choices(page).getByRole('textbox', { name: 'Card type' })).toBeFocused();
    await page.keyboard.type('Boss');
    await page.keyboard.press('Enter');
    await expect(choices(page).getByRole('combobox', { name: 'Layout for Boss cards' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeHidden();
    await expect(face(page, 'Villain frame. Troll')).toBeVisible();
    await expect(face(page, 'Goblin')).toBeVisible();

    await page.reload();
    await layoutsButton(page).click();
    await expect(choices(page).getByRole('combobox', { name: 'Layout for monster cards' })).toHaveValue('l-villain');
  });

  test('sets the default layout by mouse, with no axe violations', async ({ page }) => {
    await setUp(page);
    await layoutsButton(page).click();
    await choices(page).getByRole('combobox', { name: 'Default layout' }).selectOption('Villain');
    await expect(editor(page).getByRole('status')).toHaveText('Cards with no other layout use Villain.');

    const results = await new AxeBuilder({ page }).include('.layout-editor').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);

    await editor(page).getByRole('button', { name: 'Back to table' }).click();
    await expect(face(page, 'Villain frame. Goblin')).toBeVisible();
    await expect(face(page, 'Villain frame. Troll')).toBeVisible();
  });
});

test.describe('LY-8 choosing layouts on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('puts each picker under its type, with no sideways scroll', async ({ page }) => {
    await setUp(page);
    await layoutsButton(page).click();
    const row = choices(page).getByRole('listitem').filter({ hasText: 'Monster' });
    await row.scrollIntoViewIfNeeded();
    const label = await row.getByText('Monster', { exact: true }).boundingBox();
    const picker = await row.getByRole('combobox').boundingBox();
    if (!label || !picker) throw new Error('No row');
    expect(picker.y).toBeGreaterThanOrEqual(label.y + label.height);
    expect(picker.x + picker.width).toBeLessThanOrEqual(375);
    const add = choices(page).getByRole('button', { name: 'Add type' });
    await add.scrollIntoViewIfNeeded();
    await expect(add).toBeInViewport();
    const body = editor(page).locator('.layout-editor__body');
    expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});
