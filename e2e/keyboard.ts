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
 * Presses a key that closes something (Escape by default), then waits for `closed` to be gone
 * and, when given, for `focusOn` to have focus, so the next key doesn't land while focus is
 * still moving back. A native dialog hands focus back as it closes, then the app moves it again
 * from a timeout (`focusAfterDialog`), so a focus check can pass before focus has settled. Timers
 * run in order, so one queued here runs after the app's.
 */
export async function closeWith(page: Page, closed: Locator, { key = 'Escape', focusOn }: { key?: string; focusOn?: Locator } = {}) {
  await page.keyboard.press(key);
  await expect(closed).toHaveCount(0);
  if (focusOn) await expect(focusOn).toBeFocused();
  await settle(page);
}

/** Waits for timers the app queued before now (like moving focus after a dialog closes) to run. */
export async function settle(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve)));
}
