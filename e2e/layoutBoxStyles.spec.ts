import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const editor = (page: Page) => page.getByRole('dialog', { name: 'Card layouts' });
const boxes = (page: Page) => page.getByRole('group', { name: 'Boxes on Layout 1' });
const panel = (page: Page) => editor(page).getByRole('region', { name: /properties$/ });

/** The saved layouts' boxes in IndexedDB (PS-7 keys). */
function savedBoxes(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction('keyval').objectStore('keyval').getAll();
          request.onsuccess = () => {
            open.result.close();
            resolve((request.result as { boxes?: unknown[] }[]).flatMap((item) => item.boxes ?? []));
          };
          request.onerror = () => reject(request.error);
        };
      }),
  );
}

/** A new layout, open on the canvas, with one box showing fixed text. */
async function openWithTextBox(page: Page, text: string) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Card layouts (L)' }).click();
  await page.getByRole('button', { name: 'New layout' }).click();
  await page.getByRole('button', { name: 'Edit Layout 1' }).click();
  await page.getByRole('button', { name: 'Add box' }).click();
  await panel(page).getByRole('textbox', { name: 'Text', exact: true }).fill(text);
}

test.describe('LY-4 text styles', () => {
  test('sets the text styles by keyboard, and they last after a reload', async ({ page }) => {
    await openWithTextBox(page, 'Hero');
    const size = panel(page).getByRole('spinbutton', { name: 'Size (pt)' });
    await size.focus();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('14');
    await page.keyboard.press('Tab');
    await expect(panel(page).getByRole('combobox', { name: 'Weight' })).toBeFocused();
    // Typing a letter picks an option without opening the list.
    await page.keyboard.type('B');
    await expect(panel(page).getByRole('combobox', { name: 'Weight' })).toHaveValue('700');
    await page.keyboard.press('Tab');
    await expect(panel(page).getByRole('radio', { name: 'Text', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(panel(page).getByRole('radio', { name: 'Numbers' })).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(panel(page).getByRole('radio', { name: 'Left' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Tab');
    await expect(panel(page).getByRole('radio', { name: 'Top' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Tab');
    await expect(panel(page).getByRole('textbox', { name: 'Text colour', exact: true })).toBeFocused();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('#29303b');
    await panel(page).getByRole('checkbox', { name: 'No background' }).focus();
    await page.keyboard.press('Space');
    await expect(panel(page).getByRole('textbox', { name: 'Background', exact: true })).toHaveValue('#ffffff');

    const style = { size: 14, weight: 700, align: 'center', valign: 'middle', font: 'mono', color: '#29303b', background: '#ffffff' };
    await expect.poll(() => savedBoxes(page)).toEqual([expect.objectContaining({ style })]);
    await page.reload();
    await page.getByRole('button', { name: 'Card layouts (L)' }).click();
    await page.getByRole('button', { name: 'Edit Layout 1' }).click();
    await boxes(page).getByRole('button', { name: /^Box 1,/ }).click();
    await expect(panel(page).getByRole('spinbutton', { name: 'Size (pt)' })).toHaveValue('14');
    await expect(panel(page).getByRole('radio', { name: 'Centre' })).toBeChecked();
    await expect(panel(page).getByRole('radio', { name: 'Middle' })).toBeChecked();
  });
});

test.describe('LY-4 and A11Y-9 box warnings', () => {
  test('warn about clipped text and low contrast, with no axe violations', async ({ page }) => {
    await openWithTextBox(page, 'Hero');
    const box = boxes(page).getByRole('button', { name: /^Box 1,/ });
    await expect(box).not.toHaveAccessibleName(/clipped|contrast/);
    const results = await new AxeBuilder({ page }).include('.layout-editor').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);

    await panel(page).getByRole('textbox', { name: 'Text', exact: true }).fill('Draw two cards, then discard one. '.repeat(20));
    await expect(box).toHaveAccessibleName(/, text clipped$/);
    await expect(panel(page).getByText("Text is clipped: it doesn't fit even at 6 pt.", { exact: false })).toBeVisible();
    await expect(editor(page).locator('.layout-canvas__box-warning')).toBeVisible();

    await panel(page).getByRole('textbox', { name: 'Text', exact: true }).fill('Hero');
    await expect(box).not.toHaveAccessibleName(/clipped/);
    await panel(page).getByRole('textbox', { name: 'Text colour', exact: true }).fill('#eeeeee');
    await expect(box).toHaveAccessibleName(/, low contrast 1.1 to 1$/);
    await expect(panel(page).getByText('Low contrast: 1.1 to 1 against the background.', { exact: false })).toBeVisible();

    // A dark background brings it back above 4.5:1.
    await panel(page).getByRole('checkbox', { name: 'No background' }).click();
    await panel(page).getByRole('textbox', { name: 'Background', exact: true }).fill('#29303b');
    await expect(box).not.toHaveAccessibleName(/contrast/);
    await expect(editor(page).locator('.layout-canvas__box-warning')).toHaveCount(0);
  });
});

test.describe('LY-4 text styles on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('fit the panel with no sideways scroll', async ({ page }) => {
    await openWithTextBox(page, 'Hero');
    const canvas = editor(page).locator('.layout-canvas');
    expect(await canvas.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const name of ['Right', 'Bottom', 'Numbers']) {
      const radio = panel(page).getByRole('radio', { name });
      await radio.scrollIntoViewIfNeeded();
      const box = await radio.locator('xpath=..').boundingBox();
      expect(box && box.x + box.width).toBeLessThanOrEqual(375);
    }
    const background = panel(page).getByRole('checkbox', { name: 'No background' });
    await background.scrollIntoViewIfNeeded();
    await expect(background).toBeInViewport();
  });
});
