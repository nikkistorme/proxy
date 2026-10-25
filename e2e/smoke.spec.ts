import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('App shell smoke', () => {
  test('loads with the app heading and no axe violations', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Proxy (deliberately wrong)' })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
  });
});
