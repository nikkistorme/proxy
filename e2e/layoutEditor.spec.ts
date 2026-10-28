import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const editor = (page: Page) => page.getByRole('dialog', { name: 'Card layouts' });
const layoutsButton = (page: Page) => page.getByRole('button', { name: 'Card layouts (L)' });
const names = (page: Page) => editor(page).locator('.layout-list__name');

/** The names of the layouts saved in IndexedDB (PS-7 keys). */
function savedNames(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction('keyval').objectStore('keyval').getAll();
          request.onsuccess = () => {
            open.result.close();
            resolve((request.result as { id?: string; name?: string; boxes?: unknown }[]).filter((item) => item.boxes).map((item) => item.name ?? '').sort());
          };
          request.onerror = () => reject(request.error);
        };
      }),
  );
}

test.describe('LY-1 layout list', () => {
  test('creates, renames, duplicates and deletes layouts by keyboard, and they last after a reload', async ({ page }) => {
    // PF-3: the layout screen's code loads the first time it opens.
    const editorScripts: string[] = [];
    page.on('request', (request) => {
      if (/LayoutEditor/.test(request.url())) editorScripts.push(request.url());
    });
    await page.goto('./');
    await expect(layoutsButton(page)).toBeVisible();
    expect(editorScripts).toEqual([]);

    await layoutsButton(page).focus();
    await page.keyboard.press('l');
    await expect(editor(page)).toBeVisible();
    expect(editorScripts.length).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'New layout' })).toBeFocused();

    // Create, then rename from the Rename button that takes focus.
    await page.keyboard.press('Enter');
    await expect(names(page)).toHaveText(['Default', 'Layout 1']);
    await expect(page.getByRole('button', { name: 'Rename Layout 1' })).toBeFocused();
    await page.keyboard.press('Enter');
    const rename = page.getByRole('dialog', { name: 'Rename Layout 1' });
    await expect(rename.getByRole('textbox', { name: 'Name' })).toBeFocused();
    await page.keyboard.type('default');
    await page.keyboard.press('Enter');
    await expect(rename.getByText('There is already a layout called Default.')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Hero');
    await page.keyboard.press('Enter');
    await expect(rename).toBeHidden();
    await expect(names(page)).toHaveText(['Default', 'Hero']);
    await expect(page.getByRole('button', { name: 'Rename Hero' })).toBeFocused();

    // Duplicate, then delete the copy.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Duplicate Hero' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(names(page)).toHaveText(['Default', 'Hero', 'Hero copy']);
    await expect(page.getByRole('button', { name: 'Rename Hero copy' })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Delete Hero copy' })).toBeFocused();
    await page.keyboard.press('Enter');
    const confirm = page.getByRole('dialog', { name: 'Delete Hero copy?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete layout' }).focus();
    await page.keyboard.press('Enter');
    await expect(confirm).toBeHidden();
    await expect(names(page)).toHaveText(['Default', 'Hero']);
    await expect(page.getByRole('button', { name: 'Rename Hero' })).toBeFocused();

    // Esc goes back to the table, with focus where it was.
    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeHidden();
    await expect(layoutsButton(page)).toBeFocused();

    // Each layout saves a second after its last change (PS-1).
    await expect.poll(() => savedNames(page)).toEqual(['Hero']);
    await page.reload();
    await layoutsButton(page).click();
    await expect(names(page)).toHaveText(['Default', 'Hero']);
  });

  test('duplicates, renames and deletes layouts by mouse, with no axe violations', async ({ page }) => {
    await page.goto('./');
    await layoutsButton(page).click();
    await page.getByRole('button', { name: 'Duplicate Default' }).click();
    await expect(names(page)).toHaveText(['Default', 'Default copy']);
    const results = await new AxeBuilder({ page }).include('.layout-editor').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole('button', { name: 'Rename Default copy' }).click();
    const field = page.getByRole('dialog', { name: 'Rename Default copy' }).getByRole('textbox', { name: 'Name' });
    await field.fill('Hero');
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await page.getByRole('button', { name: 'Delete Hero' }).click();
    await page.getByRole('button', { name: 'Delete layout' }).click();
    await expect(names(page)).toHaveText(['Default']);
    await expect(page.getByRole('button', { name: 'New layout' })).toBeFocused();
    await page.getByRole('button', { name: 'Back to table' }).click();
    await expect(editor(page)).toBeHidden();
  });
});

test.describe('LY-1 layout list on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('fits the screen, the list scrolls, and the rename dialog’s buttons stay visible', async ({ page }) => {
    await page.goto('./');
    await layoutsButton(page).click();
    const create = page.getByRole('button', { name: 'New layout' });
    for (let i = 0; i < 6; i++) await create.click();
    await expect(names(page)).toHaveCount(7);

    const screenBox = await editor(page).boundingBox();
    expect(screenBox).toMatchObject({ x: 0, y: 0, width: 375, height: 667 });
    expect(await editor(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const body = editor(page).locator('.layout-editor__body');
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Back to table' })).toBeInViewport();
    await expect(create).toBeInViewport();

    // The last row scrolls into view, and its buttons fit.
    const last = page.getByRole('button', { name: 'Delete Layout 6' });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await last.click();
    const confirm = page.getByRole('dialog', { name: 'Delete Layout 6?' });
    await expect(confirm.getByRole('button', { name: 'Delete layout' })).toBeInViewport();
    await confirm.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Rename Layout 1' }).click();
    const rename = page.getByRole('dialog', { name: 'Rename Layout 1' });
    await expect(rename.getByRole('button', { name: 'Rename', exact: true })).toBeInViewport();
    await expect(rename.getByRole('button', { name: 'Cancel' })).toBeInViewport();
  });
});
