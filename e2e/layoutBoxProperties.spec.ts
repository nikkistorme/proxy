import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const editor = (page: Page) => page.getByRole('dialog', { name: 'Card layouts' });
const layoutsButton = (page: Page) => page.getByRole('button', { name: 'Card layouts (L)' });
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

/** A new layout, open on the canvas. */
async function openNewLayout(page: Page) {
  await page.goto('./');
  await layoutsButton(page).click();
  await page.getByRole('button', { name: 'New layout' }).click();
  await page.getByRole('button', { name: 'Edit Layout 1' }).click();
  await expect(page.getByRole('heading', { name: 'Layout 1' })).toBeVisible();
}

test.describe('LY-3 box properties', () => {
  test('binds a box to a column and labels it by keyboard, and it lasts after a reload', async ({ page }) => {
    await page.goto('./');
    await layoutsButton(page).focus();
    await page.keyboard.press('l');
    await expect(page.getByRole('button', { name: 'New layout' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Rename Layout 1' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Edit Layout 1' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Add box' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(boxes(page).getByRole('button', { name: /^Box 1, empty,/ })).toBeFocused();

    // On into the panel: the checked kind first, and up to Column as text.
    await page.keyboard.press('Tab');
    // Firefox stops on the panel itself first when it scrolls, so its content can be scrolled by keyboard.
    if (await panel(page).evaluate((el) => el === document.activeElement)) await page.keyboard.press('Tab');
    await expect(panel(page).getByRole('radio', { name: 'Fixed text' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(panel(page).getByRole('radio', { name: 'Column as text' })).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(panel(page).getByRole('textbox', { name: 'Column' })).toBeFocused();
    await page.keyboard.type('Cost');
    await page.keyboard.press('Tab');
    await expect(panel(page).getByRole('textbox', { name: 'Spoken label' })).toBeFocused();
    await page.keyboard.type('Cost');

    await expect(boxes(page).getByRole('button', { name: /^Box 1, shows cost,/ })).toBeVisible();
    // The sample card shows the column's name until real cards can be previewed.
    await expect(editor(page).locator('.layout-canvas__card').getByText('[cost]')).toBeVisible();

    await expect
      .poll(() => savedBoxes(page))
      .toEqual([expect.objectContaining({ content: { kind: 'column', columns: ['cost'], as: 'text' }, label: 'Cost' })]);
    await page.reload();
    await layoutsButton(page).click();
    await page.getByRole('button', { name: 'Edit Layout 1' }).click();
    await boxes(page).getByRole('button', { name: /^Box 1, shows cost,/ }).click();
    await expect(panel(page).getByRole('textbox', { name: 'Column' })).toHaveValue('cost');
    await expect(panel(page).getByRole('textbox', { name: 'Spoken label' })).toHaveValue('Cost');
  });
});

test.describe('LY-5 fixed text and colour boxes', () => {
  test('sets fixed text and a colour by mouse, with no axe violations', async ({ page }) => {
    await openNewLayout(page);
    await page.getByRole('button', { name: 'Add box' }).click();
    await panel(page).getByRole('textbox', { name: 'Text' }).fill('Hero');
    await expect(editor(page).locator('.layout-canvas__card').getByText('Hero')).toBeVisible();

    // A second box drawn apart from the first, from 10%, 75% to 60%, 90%.
    const overlay = await boxes(page).boundingBox();
    if (!overlay) throw new Error('No canvas');
    const at = (x: number, y: number) => [overlay.x + (overlay.width * x) / 100, overlay.y + (overlay.height * y) / 100] as const;
    await page.mouse.move(...at(10, 75));
    await page.mouse.down();
    await page.mouse.move(...at(35, 82), { steps: 4 });
    await page.mouse.move(...at(60, 90), { steps: 4 });
    await page.mouse.up();
    await expect(page.getByRole('heading', { name: 'Box 2 properties' })).toBeVisible();
    await panel(page).getByRole('radio', { name: 'Colour' }).click();
    const hex = panel(page).getByRole('textbox', { name: 'Colour', exact: true });
    await hex.fill('#29303b');
    await expect(boxes(page).getByRole('button', { name: /^Box 2, colour,/ })).toBeVisible();

    const results = await new AxeBuilder({ page }).include('.layout-editor').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);

    await hex.fill('nope');
    await expect(panel(page).getByText('Enter a hex colour, such as #29303b.')).toBeVisible();
    await expect
      .poll(() => savedBoxes(page))
      .toEqual([
        expect.objectContaining({ content: { kind: 'text', text: 'Hero' } }),
        expect.objectContaining({ content: { kind: 'color' }, style: expect.objectContaining({ background: '#29303b' }) }),
      ]);
  });
});

test.describe('LY-3 box properties on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('sit below the card, which keeps its size, with no sideways scroll', async ({ page }) => {
    await openNewLayout(page);
    const card = editor(page).locator('.layout-canvas__card');
    const before = await card.boundingBox();
    if (!before) throw new Error('No card');
    expect(before.x).toBeGreaterThanOrEqual(0);
    expect(before.x + before.width).toBeLessThanOrEqual(375);
    expect(before.width).toBeGreaterThan(150);

    await page.getByRole('button', { name: 'Add box' }).click();
    await expect(page.getByRole('heading', { name: 'Box 1 properties' })).toBeVisible();
    expect(await card.boundingBox()).toEqual(before);
    const panelBox = await panel(page).boundingBox();
    expect(panelBox && panelBox.y).toBeGreaterThanOrEqual(before.y + before.height);
    expect(panelBox && panelBox.x + panelBox.width).toBeLessThanOrEqual(375);

    const canvas = editor(page).locator('.layout-canvas');
    expect(await canvas.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const label = panel(page).getByRole('textbox', { name: 'Spoken label' });
    await label.scrollIntoViewIfNeeded();
    await expect(label).toBeInViewport();
  });
});
