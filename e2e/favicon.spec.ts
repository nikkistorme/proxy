import { expect, test } from '@playwright/test';

test.describe('AR-8 app icon', () => {
  test('links the SVG, PNG and Apple touch icons under the base path, and each loads', async ({ page, baseURL }) => {
    await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
    const basePath = new URL(baseURL ?? '').pathname;

    const icons = [
      { selector: 'link[rel="icon"][type="image/svg+xml"]', file: 'favicon.svg', type: 'image/svg+xml' },
      { selector: 'link[rel="icon"][type="image/png"][sizes="32x32"]', file: 'favicon-32.png', type: 'image/png' },
      { selector: 'link[rel="apple-touch-icon"]', file: 'apple-touch-icon.png', type: 'image/png' },
    ];

    for (const icon of icons) {
      const href = await page.locator(icon.selector).getAttribute('href');
      // Served from the base path (live site or PR preview), never the domain root.
      expect(href).toBe(`${basePath}${icon.file}`);

      const response = await page.request.get(new URL(href ?? '', baseURL).href);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain(icon.type);
    }
  });

  test('the SVG icon has a dark-tab version', async ({ page }) => {
    const response = await page.request.get('favicon.svg');
    expect(await response.text()).toContain('prefers-color-scheme: dark');
  });
});
