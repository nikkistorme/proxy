import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { tabTo } from './keyboard';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const fixture = 'tests/fixtures/layouts/two-layouts.json';

const editor = (page: Page) => page.getByRole('dialog', { name: 'Card layouts' });
const layoutsButton = (page: Page) => page.getByRole('button', { name: 'Card layouts (L)' });
const files = (page: Page) => editor(page).getByRole('region', { name: 'Layout files' });
const names = (page: Page) => editor(page).locator('.layout-list__name');

/** Runs `body` on the app's IndexedDB store, where every save is kept (PS-7 keys). */
function onStore<T>(page: Page, body: 'list' | 'clear') {
  return page.evaluate(
    (body) =>
      new Promise<T>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const store = open.result.transaction('keyval', 'readwrite').objectStore('keyval');
          const request = body === 'list' ? store.getAll() : store.clear();
          request.onsuccess = () => {
            open.result.close();
            resolve(request.result as T);
          };
          request.onerror = () => reject(request.error);
        };
      }),
    body,
  );
}

/** The saved layouts, as their file would hold them: no save time or save version. */
async function savedLayouts(page: Page) {
  const items = await onStore<Record<string, unknown>[]>(page, 'list');
  return items
    .filter((item) => item.boxes)
    .map((item) => {
      const layout = { ...item };
      delete layout.updatedAt;
      delete layout.version;
      return layout;
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

const fixtureLayouts = async () => JSON.parse(await readFile(fixture, 'utf8')).layouts;

test.describe('LY-9 exporting and importing layouts', () => {
  test('exports, clears the browser data and imports the file by keyboard, restoring the layouts exactly', async ({ page }) => {
    // Start from the fixture's layouts, imported by mouse.
    await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
    await layoutsButton(page).click();
    await files(page).getByTestId('layout-file').setInputFiles(fixture);
    await expect(names(page)).toHaveText(['Default', 'Hero', 'Site']);
    await expect.poll(() => savedLayouts(page)).toEqual(await fixtureLayouts());
    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeHidden();

    await layoutsButton(page).focus();
    await page.keyboard.press('l');
    await expect(editor(page).getByRole('button', { name: 'New layout' })).toBeFocused();
    const exportButton = files(page).getByRole('button', { name: 'Export layouts' });
    await tabTo(page, exportButton);
    const download = page.waitForEvent('download');
    await page.keyboard.press('Enter');
    expect((await download).suggestedFilename()).toBe('proxy-layouts.json');
    const exported = await readFile(await (await download).path());
    await expect(editor(page).getByRole('status')).toHaveText('Exported 2 layouts to proxy-layouts.json.');
    expect(JSON.parse(exported.toString('utf8')).layouts).toEqual(await fixtureLayouts());

    // Clear the browser's saved data, and the layouts are gone.
    await onStore(page, 'clear');
    await page.reload();
    await layoutsButton(page).focus();
    await page.keyboard.press('l');
    await expect(names(page)).toHaveText(['Default']);
    await expect(exportButton).toHaveAttribute('aria-disabled', 'true');
    // Greyed out with the disabled token, unlike Import.
    const colour = (button: typeof exportButton) => button.evaluate((el) => getComputedStyle(el).color);
    expect(await colour(exportButton)).not.toBe(await colour(files(page).getByRole('button', { name: 'Import layouts…' })));

    const importButton = files(page).getByRole('button', { name: 'Import layouts…' });
    await tabTo(page, importButton);
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    await (await chooser).setFiles({ name: 'proxy-layouts.json', mimeType: 'application/json', buffer: exported });
    await expect(editor(page).getByRole('status')).toHaveText('Imported 2 layouts from proxy-layouts.json.');
    await expect(importButton).toBeFocused();
    await expect(names(page)).toHaveText(['Default', 'Hero', 'Site']);
    await expect.poll(() => savedLayouts(page)).toEqual(await fixtureLayouts());

    // They last after a reload.
    await page.reload();
    await layoutsButton(page).click();
    await expect(names(page)).toHaveText(['Default', 'Hero', 'Site']);
  });

  test('imports by mouse, refuses a file that is not layouts, with no axe violations', async ({ page }) => {
    await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
    await layoutsButton(page).click();
    const chooser = page.waitForEvent('filechooser');
    await files(page).getByRole('button', { name: 'Import layouts…' }).click();
    await (await chooser).setFiles('tests/fixtures/layouts/wrong-format.json');
    await expect(files(page).getByText("Couldn't import wrong-format.json. This file isn't a Proxy layouts file.")).toBeVisible();
    await expect(names(page)).toHaveText(['Default']);

    const again = page.waitForEvent('filechooser');
    await files(page).getByRole('button', { name: 'Import layouts…' }).click();
    await (await again).setFiles(fixture);
    await expect(files(page).getByText('Imported 2 layouts from two-layouts.json.')).toBeVisible();
    await expect(names(page)).toHaveText(['Default', 'Hero', 'Site']);
    await expect(editor(page).getByText('Landscape · 2 boxes')).toBeVisible();

    const results = await new AxeBuilder({ page }).include('.layout-editor').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('LY-9 layout files on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('puts Export and Import side by side, with no sideways scroll', async ({ page }) => {
    await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
    await layoutsButton(page).click();
    await files(page).getByTestId('layout-file').setInputFiles(fixture);
    const exportButton = files(page).getByRole('button', { name: 'Export layouts' });
    const importButton = files(page).getByRole('button', { name: 'Import layouts…' });
    await importButton.scrollIntoViewIfNeeded();
    await expect(exportButton).toBeInViewport();
    await expect(importButton).toBeInViewport();
    const left = await exportButton.boundingBox();
    const right = await importButton.boundingBox();
    if (!left || !right) throw new Error('No buttons');
    expect(right.y).toBeCloseTo(left.y, 0);
    expect(right.x + right.width).toBeLessThanOrEqual(375);
    expect(left.height).toBeGreaterThanOrEqual(24);
    const result = files(page).getByText('Imported 2 layouts from two-layouts.json.');
    await expect(result).toBeVisible();
    const body = editor(page).locator('.layout-editor__body');
    expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});
