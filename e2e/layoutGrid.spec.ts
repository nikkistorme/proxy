import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const editor = (page: Page) => page.getByRole('dialog', { name: 'Card layouts' });
const layoutsButton = (page: Page) => page.getByRole('button', { name: 'Card layouts (L)' });
const boxes = (page: Page) => page.getByRole('group', { name: 'Boxes on Layout 1' });
const snapToggle = (page: Page) => editor(page).getByRole('checkbox', { name: 'Snap to grid' });

/** A new layout, open on the canvas. */
async function openNewLayout(page: Page) {
  await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
  await layoutsButton(page).click();
  await page.getByRole('button', { name: 'New layout' }).click();
  await page.getByRole('button', { name: 'Edit Layout 1' }).click();
  await expect(page.getByRole('heading', { name: 'Layout 1' })).toBeVisible();
}

test.describe('LY-2 grid', () => {
  test('lines two boxes up edge to edge by keyboard, then nudges one by 1% with snapping off', async ({ page }) => {
    await openNewLayout(page);
    const add = page.getByRole('button', { name: 'Add box' });
    await add.focus();
    await page.keyboard.press('Enter');
    await expect(boxes(page).getByRole('button', { name: /^Box 1, empty, at 30% across, 40% down, 40% wide, 20% tall$/ })).toBeFocused();
    await add.focus();
    await page.keyboard.press('Enter');
    // A grid step past the first.
    const second = boxes(page).getByRole('button', { name: /^Box 2,/ });
    await expect(second).toHaveAccessibleName('Box 2, empty, at 32% across, 42% down, 40% wide, 20% tall');
    await expect(second).toBeFocused();

    // Under Box 1, whose bottom edge is at 60%.
    await page.keyboard.press('ArrowLeft');
    for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowDown');
    await expect(second).toHaveAccessibleName('Box 2, empty, at 30% across, 60% down, 40% wide, 20% tall');
    await expect(editor(page).getByRole('status')).toHaveText('Box 2 at 30% across, 60% down.');

    // Back past Box 1 to the toggle.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(snapToggle(page)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(snapToggle(page)).not.toBeChecked();
    await expect(editor(page).getByRole('status')).toHaveText('Snapping off.');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(second).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(second).toHaveAccessibleName('Box 2, empty, at 31% across, 60% down, 40% wide, 20% tall');
  });

  test('snaps boxes drawn and dragged by mouse, with no axe violations', async ({ page }) => {
    await openNewLayout(page);
    await expect(snapToggle(page)).toBeChecked();
    const overlay = await boxes(page).boundingBox();
    if (!overlay) throw new Error('No canvas');
    const at = (x: number, y: number) => [overlay.x + (overlay.width * x) / 100, overlay.y + (overlay.height * y) / 100] as const;

    // Drawn from 10.6%, 9.4% to 59.4%, 30.6%: its corners land on 10%, 10% and 60%, 30%.
    await page.mouse.move(...at(10.6, 9.4));
    await page.mouse.down();
    await page.mouse.move(...at(35, 20), { steps: 4 });
    await page.mouse.move(...at(59.4, 30.6), { steps: 4 });
    await page.mouse.up();
    const box = boxes(page).getByRole('button', { name: /^Box 1,/ });
    await expect(box).toHaveAccessibleName('Box 1, empty, at 10% across, 10% down, 50% wide, 20% tall');

    // Dragged about 19.4% down by its middle: it lands on the 30% line.
    await page.mouse.move(...at(35, 20));
    await page.mouse.down();
    await page.mouse.move(...at(35, 30), { steps: 4 });
    await page.mouse.move(...at(35, 39.4), { steps: 4 });
    await page.mouse.up();
    await expect(box).toHaveAccessibleName('Box 1, empty, at 10% across, 30% down, 50% wide, 20% tall');

    const results = await new AxeBuilder({ page }).include('.layout-editor').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);

    // With snapping off, a drag lands where it's let go.
    await snapToggle(page).click();
    await page.mouse.move(...at(35, 40));
    await page.mouse.down();
    await page.mouse.move(...at(36, 41), { steps: 2 });
    await page.mouse.move(...at(37, 42), { steps: 2 });
    await page.mouse.up();
    await expect(box).toHaveAccessibleName('Box 1, empty, at 12% across, 32% down, 50% wide, 20% tall');
  });
});

test.describe('LY-2 grid on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, colorScheme: 'dark' });

  test('the toggle fits with the tools, and the grid shows over the card', async ({ page }) => {
    await openNewLayout(page);
    await expect(snapToggle(page)).toBeInViewport();
    const toggle = await editor(page).locator('.layout-canvas__snap').boundingBox();
    expect(toggle && toggle.height).toBeGreaterThanOrEqual(24);
    const card = await editor(page).locator('.layout-canvas__card').boundingBox();
    if (!card) throw new Error('No card');
    expect(card.x + card.width).toBeLessThanOrEqual(375);
    expect(card.y + card.height).toBeLessThanOrEqual(667);
    await expect(editor(page).locator('.layout-canvas__grid')).toBeVisible();
    const canvas = editor(page).locator('.layout-canvas');
    expect(await canvas.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});
