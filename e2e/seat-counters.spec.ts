import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { tabTo } from './keyboard';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

const status = (page: Page) => page.getByRole('status');
const life = (page: Page) => page.getByRole('group', { name: 'Player 1 Life' });

test.describe('TT-13 seat counters', () => {
  test('keyboard only: step Life with the buttons and arrow keys, each announced and undoable', async ({ page }) => {
    const decrease = page.getByRole('button', { name: 'Decrease Player 1 Life' });
    await tabTo(page, decrease);
    await page.keyboard.press('Enter');
    await expect(life(page)).toContainText('19');
    await expect(status(page)).toHaveText('Player 1 Life 20 → 19.');
    await page.keyboard.press('ArrowDown');
    await expect(life(page)).toContainText('18');
    await page.keyboard.press('ArrowUp');
    await expect(life(page)).toContainText('19');
    await expect(decrease).toBeFocused();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(life(page)).toContainText('18');
    await expect(status(page)).toHaveText('Undone: Player 1 Life 18 → 19.');
  });

  test('mouse: the counters have no axe violations', async ({ page }) => {
    await page.getByRole('button', { name: 'Increase Player 1 Energy' }).click();
    await expect(page.getByRole('group', { name: 'Player 1 Energy' })).toContainText('1');
    const results = await new AxeBuilder({ page }).include('[aria-label="Seats"]').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('TT-13 seat counters on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the seat bar wraps with no sideways scrolling, and the buttons are at least 24px', async ({ page }) => {
    const increase = page.getByRole('button', { name: 'Increase Player 1 Life' });
    const box = await increase.boundingBox();
    expect(box && box.width >= 24 && box.height >= 24 && box.x + box.width <= 375).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    // Regression (PR #78 review): the counters share one row under the seat's name, not split across lines.
    const name = await page.getByRole('region', { name: 'Seats' }).getByText('Player 1', { exact: true }).boundingBox();
    const lifeBox = await life(page).boundingBox();
    const energyBox = await page.getByRole('group', { name: 'Player 1 Energy' }).boundingBox();
    expect(lifeBox && energyBox && Math.abs(lifeBox.y - energyBox.y) < 2).toBe(true);
    expect(name && lifeBox && lifeBox.y >= name.y + name.height).toBe(true);
    await increase.click();
    await expect(life(page)).toContainText('21');
  });
});
