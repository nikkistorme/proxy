import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const editor = (page: Page) => page.getByRole('dialog', { name: 'Card layouts' });
const layoutsButton = (page: Page) => page.getByRole('button', { name: 'Card layouts (L)' });
const boxes = (page: Page) => page.getByRole('group', { name: 'Boxes on Layout 1' });

/** The saved layouts in IndexedDB (PS-7 keys). */
function savedLayouts(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ name: string; orientation: string; boxes: { x: number; y: number; width: number; height: number }[] }[]>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction('keyval').objectStore('keyval').getAll();
          request.onsuccess = () => {
            open.result.close();
            resolve((request.result as { boxes?: unknown }[]).filter((item) => item.boxes) as never);
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

test.describe('LY-2 layout canvas', () => {
  test('adds, moves and resizes a box and turns the layout landscape by keyboard, and it lasts after a reload', async ({ page }) => {
    await page.goto('./');
    await layoutsButton(page).focus();
    await page.keyboard.press('l');
    await expect(page.getByRole('button', { name: 'New layout' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Rename Layout 1' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Edit Layout 1' })).toBeFocused();
    await page.keyboard.press('Enter');

    const add = page.getByRole('button', { name: 'Add box' });
    await expect(add).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(boxes(page).getByRole('button', { name: 'Box 1, at 30% across, 40% down, 40% wide, 20% tall' })).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowUp');
    await expect(boxes(page).getByRole('button', { name: 'Box 1, at 28% across, 41% down, 41% wide, 19% tall' })).toBeFocused();
    await expect(editor(page).getByRole('status')).toHaveText('Box 1 41% wide, 19% tall.');

    // Back past Delete Box 1 and Add box to the orientation radios.
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Delete Box 1' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('radio', { name: 'Portrait' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Landscape' })).toBeChecked();
    // A landscape card is wider than tall.
    const card = await editor(page).locator('.layout-canvas__card').boundingBox();
    expect(card && card.width > card.height).toBe(true);

    // Esc goes back to the list, then to the table.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Edit Layout 1' })).toBeFocused();
    await expect(editor(page).getByText('Landscape · 1 box')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeHidden();

    await expect
      .poll(() => savedLayouts(page))
      .toEqual([expect.objectContaining({ name: 'Layout 1', orientation: 'landscape', boxes: [expect.objectContaining({ x: 28, y: 41, width: 41, height: 19 })] })]);
    await page.reload();
    await layoutsButton(page).click();
    await page.getByRole('button', { name: 'Edit Layout 1' }).click();
    await expect(boxes(page).getByRole('button', { name: 'Box 1, at 28% across, 41% down, 41% wide, 19% tall' })).toBeVisible();
  });

  test('draws, moves and resizes boxes by mouse, with no axe violations', async ({ page }) => {
    await openNewLayout(page);
    const overlay = await boxes(page).boundingBox();
    if (!overlay) throw new Error('No canvas');
    const at = (x: number, y: number) => [overlay.x + (overlay.width * x) / 100, overlay.y + (overlay.height * y) / 100] as const;

    // Draw from 10%, 10% to 60%, 30%.
    await page.mouse.move(...at(10, 10));
    await page.mouse.down();
    await page.mouse.move(...at(35, 20), { steps: 4 });
    await page.mouse.move(...at(60, 30), { steps: 4 });
    await page.mouse.up();
    const box = boxes(page).getByRole('button', { name: /^Box 1,/ });
    await expect(box).toHaveAccessibleName('Box 1, at 10% across, 10% down, 50% wide, 20% tall');

    // Move it 20% down by its middle.
    await page.mouse.move(...at(35, 20));
    await page.mouse.down();
    await page.mouse.move(...at(35, 30), { steps: 4 });
    await page.mouse.move(...at(35, 40), { steps: 4 });
    await page.mouse.up();
    await expect(box).toHaveAccessibleName('Box 1, at 10% across, 30% down, 50% wide, 20% tall');

    // Drag the bottom-right corner 10% right and down.
    await page.mouse.move(...at(60, 50));
    await page.mouse.down();
    await page.mouse.move(...at(70, 60), { steps: 4 });
    await page.mouse.up();
    await expect(box).toHaveAccessibleName('Box 1, at 10% across, 30% down, 60% wide, 30% tall');

    await page.getByRole('button', { name: 'Add box' }).click();
    await expect(boxes(page).getByRole('button')).toHaveCount(2);
    const results = await new AxeBuilder({ page }).include('.layout-editor').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);

    await page.getByRole('button', { name: 'Delete Box 2' }).click();
    await expect(boxes(page).getByRole('button')).toHaveCount(1);
    await page.getByRole('button', { name: 'Back to layouts' }).click();
    await expect(editor(page).getByText('Portrait · 1 box')).toBeVisible();
  });
});

test.describe('LY-2 layout canvas on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('fits the screen, with the tools in view and the whole card showing', async ({ page }) => {
    await openNewLayout(page);
    await page.getByRole('button', { name: 'Add box' }).click();
    expect(await editor(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const canvas = editor(page).locator('.layout-canvas');
    expect(await canvas.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const name of ['Back to layouts', 'Add box', 'Delete Box 1']) await expect(page.getByRole('button', { name })).toBeInViewport();
    await expect(page.getByRole('radio', { name: 'Landscape' })).toBeInViewport();

    for (const orientation of ['Portrait', 'Landscape']) {
      await page.getByRole('radio', { name: orientation }).check();
      const card = await editor(page).locator('.layout-canvas__card').boundingBox();
      if (!card) throw new Error('No card');
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(375);
      expect(card.y + card.height).toBeLessThanOrEqual(667);
      expect(card.width).toBeGreaterThan(150);
    }
  });
});
