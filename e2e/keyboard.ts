import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Presses Tab (or Shift+Tab) until `target` has focus, as a keyboard user would,
 * so tests don't break each time a control is added before it in Tab order.
 */
export async function tabTo(page: Page, target: Locator, { backwards = false, max = 30 } = {}) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  await expect(target).toBeFocused();
}

/**
 * Presses a key that closes something (Escape by default), then checks that `closed` is gone and,
 * when given, that `focusOn` has focus.
 */
export async function closeWith(page: Page, closed: Locator, { key = 'Escape', focusOn }: { key?: string; focusOn?: Locator } = {}) {
  await page.keyboard.press(key);
  await expect(closed).toHaveCount(0);
  if (focusOn) await expect(focusOn).toBeFocused();
}
