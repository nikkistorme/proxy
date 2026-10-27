import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { tabTo } from './keyboard';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

const status = (page: Page) => page.getByRole('status');
const dice = (page: Page) => page.getByRole('dialog', { name: 'Dice & coins' });
const log = (page: Page) => page.getByRole('dialog', { name: 'Session log' });

test.describe('TT-14 dice, coin and session log', () => {
  test('keyboard only: roll a d20 and flip a coin, each announced, then read them in the session log', async ({ page }) => {
    const opener = page.getByRole('button', { name: 'Dice & coins' });
    await tabTo(page, opener);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Roll d20' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText(/^Rolled d20: ([1-9]|1[0-9]|20)\.$/);
    await tabTo(page, page.getByRole('button', { name: 'Flip a coin' }));
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText(/^Flipped a coin: (heads|tails)\.$/);
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();

    const menuButton = page.getByRole('button', { name: 'This session' });
    await tabTo(page, menuButton, { backwards: true });
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Session log' })).toBeFocused();
    await page.keyboard.press('Enter');
    const items = log(page).getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText(/Flipped a coin: (heads|tails)/);
    await expect(items.nth(1)).toContainText(/Rolled d20: \d+/);
    await page.keyboard.press('Escape');
    await expect(menuButton).toBeFocused();
  });

  test('mouse: both dialogs have no axe violations', async ({ page }) => {
    await page.getByRole('button', { name: 'Dice & coins' }).click();
    await page.getByRole('button', { name: 'Roll d6' }).click();
    await expect(dice(page).getByText('d6', { exact: true }).last()).toBeVisible();
    expect((await new AxeBuilder({ page }).include('dialog[open]').withTags(axeTags).analyze()).violations).toEqual([]);
    await dice(page).getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'This session' }).click();
    await page.getByRole('menuitem', { name: 'Session log' }).click();
    await expect(log(page).getByRole('listitem')).toHaveCount(1);
    expect((await new AxeBuilder({ page }).include('dialog[open]').withTags(axeTags).analyze()).violations).toEqual([]);
  });
});

test.describe('TT-14 dice and log on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('both dialogs fit the screen with their Done button visible', async ({ page }) => {
    await page.getByRole('button', { name: 'Dice & coins' }).click();
    await page.getByRole('button', { name: 'Roll d12' }).click();
    const diceBox = await dice(page).boundingBox();
    expect(diceBox && diceBox.x >= 0 && diceBox.x + diceBox.width <= 375 && diceBox.y + diceBox.height <= 667).toBe(true);
    await expect(dice(page).getByRole('button', { name: 'Done' })).toBeInViewport();
    await dice(page).getByRole('button', { name: 'Done' }).click();
    for (let i = 0; i < 20; i++) {
      await page.getByRole('button', { name: 'Dice & coins' }).click();
      await page.getByRole('button', { name: 'Roll d4' }).click();
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: 'This session' }).click();
    await page.getByRole('menuitem', { name: 'Session log' }).click();
    const box = await log(page).boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 375 && box.y + box.height <= 667).toBe(true);
    await expect(log(page).getByRole('button', { name: 'Done' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
