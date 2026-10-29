import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('App shell smoke', () => {
  test('loads with the app heading and no axe violations', async ({ page }) => {
    await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
    await expect(page.getByRole('banner').getByRole('heading', { level: 1, name: 'Proxy' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
  });

  test('AR-5: makes no requests outside its own origin', async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? '').origin;
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    expect(requests.filter((url) => new URL(url).origin !== origin)).toEqual([]);
  });

  test('loads the self-hosted design fonts in every weight the design uses', async ({ page }) => {
    await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
    const loaded = await page.evaluate(async () => {
      const specs = [
        '400 16px "Atkinson Hyperlegible Next"',
        '600 16px "Atkinson Hyperlegible Next"',
        '700 16px "Atkinson Hyperlegible Next"',
        '500 16px "Atkinson Hyperlegible Mono"',
        '700 16px "Atkinson Hyperlegible Mono"',
      ];
      const faces = await Promise.all(specs.map((spec) => document.fonts.load(spec)));
      return faces.map((found, i) => `${specs[i]}: ${found.filter((face) => face.status === 'loaded').length > 0}`);
    });
    expect(loaded).toEqual([
      '400 16px "Atkinson Hyperlegible Next": true',
      '600 16px "Atkinson Hyperlegible Next": true',
      '700 16px "Atkinson Hyperlegible Next": true',
      '500 16px "Atkinson Hyperlegible Mono": true',
      '700 16px "Atkinson Hyperlegible Mono": true',
    ]);
  });
});
