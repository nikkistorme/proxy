import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
});

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const status = (page: Page) => page.getByRole('status');
const hand = (page: Page) => page.getByRole('region', { name: "Player 1's hand" });
const sessionButton = (page: Page) => page.getByRole('button', { name: 'This session' });

async function loadDeck(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('double-faced.csv'));
  await page.getByRole('dialog', { name: 'Import results' }).getByRole('button', { name: 'Done' }).click();
}

/** Opens a This session item with the keyboard. */
async function chooseByKeyboard(page: Page, name: string) {
  await sessionButton(page).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name }).focus();
  await page.keyboard.press('Enter');
}

async function reload(page: Page) {
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
}

const handCount = (page: Page, n: number) => expect(hand(page).getByRole('list')).toHaveAccessibleName(new RegExp(`^Player 1's hand, ${n} cards?\\.`));

test.describe('PS-3 snapshots', () => {
  test('keyboard: save, play on, load, undo the load, reload and axe', async ({ page }) => {
    await loadDeck(page);
    await page.keyboard.press('d');
    await handCount(page, 1);

    await chooseByKeyboard(page, 'Save snapshot…');
    const nameDialog = page.getByRole('dialog', { name: 'Save snapshot' });
    await expect(nameDialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Snapshot 1');
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('Saved snapshot Snapshot 1.');
    await expect(sessionButton(page)).toBeFocused();

    await mainPile(page).focus();
    await page.keyboard.press('d');
    await page.keyboard.press('d');
    await handCount(page, 3);

    await chooseByKeyboard(page, 'Snapshots…');
    const dialog = page.getByRole('dialog', { name: 'Snapshots' });
    await expect(dialog.getByRole('listitem')).toHaveCount(1);
    await expect(dialog.getByRole('listitem')).toContainText('Solo PvE');
    expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
    await dialog.getByRole('button', { name: 'Load Snapshot 1' }).focus();
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('Loaded snapshot Snapshot 1.');
    await expect(page.locator('.table-surface')).toBeFocused();
    await handCount(page, 1);

    await page.keyboard.press('Control+z');
    await handCount(page, 3);

    await reload(page);
    await chooseByKeyboard(page, 'Snapshots…');
    await expect(page.getByRole('dialog', { name: 'Snapshots' }).getByRole('listitem')).toHaveCount(1);
  });

  test('mouse: save, rename, load, delete', async ({ page }) => {
    await loadDeck(page);
    await page.keyboard.press('d');
    await sessionButton(page).click();
    await page.getByRole('menuitem', { name: 'Save snapshot…' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Turn 4, before combat');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(status(page)).toHaveText('Saved snapshot Turn 4, before combat.');

    await mainPile(page).focus();
    await page.keyboard.press('d');
    await handCount(page, 2);

    await sessionButton(page).click();
    await page.getByRole('menuitem', { name: 'Snapshots…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Snapshots' });
    await dialog.getByRole('button', { name: 'Rename Turn 4, before combat' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Turn 4');
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await expect(status(page)).toHaveText('Renamed snapshot Turn 4, before combat to Turn 4.');

    await dialog.getByRole('button', { name: 'Load Turn 4' }).click();
    await expect(dialog).toBeHidden();
    await handCount(page, 1);
    await page.getByRole('button', { name: /^Undo \(Ctrl\+Z\)/ }).click();
    await handCount(page, 2);

    await sessionButton(page).click();
    await page.getByRole('menuitem', { name: 'Snapshots…' }).click();
    await dialog.getByRole('button', { name: 'Delete Turn 4' }).click();
    await page.getByRole('dialog', { name: 'Delete snapshot Turn 4?' }).getByRole('button', { name: 'Delete snapshot' }).click();
    await expect(dialog.getByText(/No snapshots yet\./)).toBeFocused();
  });

  test('375 × 667: the dialog fits with its footer visible and no sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loadDeck(page);
    for (const name of ['One', 'Two', 'Three', 'Four', 'Five', 'Six']) {
      await sessionButton(page).click();
      await page.getByRole('menuitem', { name: 'Save snapshot…' }).click();
      await page.getByRole('textbox', { name: 'Name' }).fill(`Snapshot ${name}`);
      await page.getByRole('textbox', { name: 'Name' }).press('Enter');
    }
    await sessionButton(page).click();
    await page.getByRole('menuitem', { name: 'Snapshots…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Snapshots' });
    await expect(dialog.getByRole('listitem')).toHaveCount(6);
    const done = dialog.getByRole('button', { name: 'Done' });
    await expect(done).toBeInViewport();
    const box = await dialog.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 375 && box.y + box.height <= 667).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await dialog.locator('.dialog__body').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});
