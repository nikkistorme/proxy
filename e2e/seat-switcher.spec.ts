import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { tabTo } from './keyboard';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

// The app opens on Solo PvE until the setup screen (6c): Player 1 and the Environment.
const seats = (page: Page) => page.getByRole('region', { name: 'Seats' });
const status = (page: Page) => page.getByRole('status');
/** A seat's button, whichever way its name ends. */
const seat = (page: Page, name: string) => seats(page).getByRole('button', { name: new RegExp(`^${name}, `) });
const p1Hand = (page: Page) => page.getByRole('heading', { name: "Player 1's hand" });

test.describe('FS-3 seat switcher', () => {
  test('mouse: a click switches seats and swaps the hand tray, with no axe violations', async ({ page }) => {
    await expect(p1Hand(page)).toBeVisible();
    const env = seat(page, 'Environment');
    await expect(env).toHaveAccessibleName('Environment, switch to this seat');
    await env.click();
    await expect(env).toHaveAccessibleName('Environment, active seat');
    await expect(env).toHaveAttribute('aria-pressed', 'true');
    await expect(env).toBeFocused();
    await expect(p1Hand(page)).toHaveCount(0);
    await expect(status(page)).toHaveText('Environment is the active seat. It has no hand.');
    const results = await new AxeBuilder({ page }).include('[aria-label="Seats"]').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await seat(page, 'Player 1').click();
    await expect(p1Hand(page)).toBeVisible();
  });

  test('keyboard only: Enter on a seat, then S and Shift+S from the table', async ({ page }) => {
    const env = seat(page, 'Environment');
    await tabTo(page, env);
    await page.keyboard.press('Enter');
    await expect(env).toBeFocused();
    await expect(env).toHaveAccessibleName('Environment, active seat');
    await expect(p1Hand(page)).toHaveCount(0);
    // Single keys do nothing in the seat bar (WCAG 2.1.4); they work from the table.
    await page.keyboard.press('s');
    await expect(env).toHaveAccessibleName('Environment, active seat');
    // The table comes after the seat bar in Tab order. Firefox leaves the page rather than wrap round to the toolbar.
    const pile = page.getByRole('button', { name: /^P1 main deck/ });
    await tabTo(page, pile);
    await page.keyboard.press('s');
    await expect(p1Hand(page)).toBeVisible();
    await expect(status(page)).toHaveText('Player 1 is the active seat. Hand: 0 cards.');
    await page.keyboard.press('Shift+S');
    await expect(p1Hand(page)).toHaveCount(0);
    await expect(pile).toBeFocused();
  });
});

test.describe('FS-3 seat switcher on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the seat buttons fit with no sideways scrolling and switch on a tap', async ({ page }) => {
    const env = seat(page, 'Environment');
    const box = await env.boundingBox();
    expect(box && box.height >= 24 && box.x + box.width <= 375).toBe(true);
    await env.click();
    await expect(p1Hand(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
