import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { bundleFixture, chooseByKeyboard, exportByKeyboard, mainPile, prepareData, sessionButton, storedKinds } from './bundleSetup';
import { closeWith, tabTo } from './keyboard';
import { storedSession } from './storage';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** The live region. The loading overlay is a status too, so it is picked out by its class. */
const status = (page: Page) => page.locator('.visually-hidden[role="status"]');

async function ready(page: Page) {
  await page.goto('./');
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
}

/** Import bundle… by keyboard, choosing `file`. */
async function chooseBundle(page: Page, file: string) {
  const chooser = page.waitForEvent('filechooser');
  await chooseByKeyboard(page, 'Import bundle…');
  await (await chooser).setFiles(file);
}

test.describe('PS-4 JSON bundle', () => {
  test('keyboard: export, import into empty storage, and everything is back', async ({ browser, baseURL, page }) => {
    await prepareData(page);
    const exported = await exportByKeyboard(page);
    expect(exported.name).toMatch(/^proxy-solo-pve-\d{4}-\d{2}-\d{2}\.json$/);
    await expect(status(page)).toHaveText(`Exported session to ${exported.name}.`);

    // A new browser context has empty storage, like clearing site data.
    const context = await browser.newContext({ baseURL });
    const fresh = await context.newPage();
    await ready(fresh);
    expect(await storedKinds(fresh)).not.toHaveProperty('layout');
    await expect(mainPile(fresh)).toHaveAccessibleName(/0 cards/);

    await chooseBundle(fresh, exported.path);
    const confirm = fresh.getByRole('dialog', { name: `Import ${exported.name}?` });
    await expect(confirm).toContainText('1 session, 1 snapshot, 1 card set, 1 layout, 1 format and your settings');
    expect((await new AxeBuilder({ page: fresh }).withTags(axeTags).analyze()).violations).toEqual([]);
    await tabTo(fresh, confirm.getByRole('button', { name: 'Import', exact: true }));
    await fresh.keyboard.press('Enter');

    // The page reloads; the announcement comes once the session is back.
    await expect(status(fresh)).toHaveText(`Imported ${exported.name}.`);
    await expect(fresh.getByText('Loading your session…')).toHaveCount(0);
    await expect(mainPile(fresh)).toHaveAccessibleName(/3 cards/);
    await expect(fresh.getByRole('list', { name: /^Player 1's hand, 1 card\./ })).toBeVisible();
    await expect(fresh.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Only the imported session is kept, and every kind is stored.
    await expect.poll(async () => storedKinds(fresh)).toMatchObject({ session: 1, snapshot: 1, cardSet: 1, layout: 1, format: 1, settings: 1 });
    await chooseByKeyboard(fresh, 'Snapshots…');
    const snapshots = fresh.getByRole('dialog', { name: 'Snapshots' });
    await expect(snapshots.getByRole('listitem')).toHaveCount(1);
    await closeWith(fresh, snapshots, { focusOn: sessionButton(fresh) });
    await chooseByKeyboard(fresh, 'New session…');
    await expect(fresh.getByRole('radio', { name: /^Duel night/ })).toBeVisible();
    await closeWith(fresh, fresh.getByRole('dialog', { name: 'New session' }), { focusOn: sessionButton(fresh) });
    // Undo history is cleared by an import.
    await expect(fresh.getByRole('button', { name: /^Undo \(Ctrl\+Z\)/ })).toHaveAccessibleName(/nothing to undo/);
    await context.close();
  });

  test('a good file can be cancelled, which changes nothing and returns focus to the menu', async ({ page }) => {
    await ready(page);
    await chooseBundle(page, bundleFixture('basic.json'));
    const confirm = page.getByRole('dialog', { name: 'Import basic.json?' });
    await tabTo(page, confirm.getByRole('button', { name: 'Cancel' }));
    await page.keyboard.press('Enter');
    await expect(confirm).toBeHidden();
    await expect(sessionButton(page)).toBeFocused();
    expect(await storedKinds(page)).not.toHaveProperty('layout');
  });

  for (const [file, reason] of [
    ['not-json.json', "This file isn't a Proxy bundle: it isn't JSON."],
    ['wrong-shape.json', "The session in this bundle isn't valid."],
    ['older-version.json', "This bundle is from an older version of Proxy and can't be imported."],
    ['newer-version.json', "This bundle is from a newer version of Proxy and can't be imported. Update Proxy and try again."],
  ] as const) {
    test(`${file}: says why and changes nothing`, async ({ page }) => {
      await ready(page);
      // The first autosave may still be coming; count the stored items only after it.
      await expect.poll(async () => await storedSession(page)).toBeDefined();
      const before = await storedKinds(page);
      await chooseBundle(page, bundleFixture(file));
      const dialog = page.getByRole('dialog', { name: "Can't import" });
      await expect(dialog).toContainText(`Error: Couldn't import ${file}. ${reason}`);
      await page.keyboard.press('Enter');
      await expect(dialog).toBeHidden();
      await expect(sessionButton(page)).toBeFocused();
      expect(await storedKinds(page)).toEqual(before);
    });
  }

  test('storage unavailable: Import bundle… says the browser can’t save and changes nothing', async ({ page }) => {
    await page.addInitScript(() => {
      IDBFactory.prototype.open = () => {
        throw new DOMException('Storage is blocked', 'SecurityError');
      };
    });
    await ready(page);
    await chooseByKeyboard(page, 'Import bundle…');
    const dialog = page.getByRole('dialog', { name: "Can't import" });
    await expect(dialog).toContainText("Error: Couldn't import a bundle. This browser can't save, so the bundle can't be imported.");
    await page.keyboard.press('Enter');
    await expect(sessionButton(page)).toBeFocused();
  });

  test('375 × 667: the confirm dialog fits with its footer visible and no sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await ready(page);
    await sessionButton(page).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('menuitem', { name: 'Import bundle…' }).click();
    await (await chooser).setFiles(bundleFixture('basic.json'));
    const dialog = page.getByRole('dialog', { name: 'Import basic.json?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Import', exact: true })).toBeInViewport();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport();
    const box = await dialog.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 375 && box.y + box.height <= 667).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const name of ['Import', 'Cancel']) {
      const target = await dialog.getByRole('button', { name, exact: true }).boundingBox();
      expect(target && target.width >= 24 && target.height >= 24).toBe(true);
    }
  });
});
