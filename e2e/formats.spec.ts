import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { tabTo } from './keyboard';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

const screen = (page: Page) => page.getByRole('dialog', { name: 'Formats' });
const formatsButton = (page: Page) => page.getByRole('button', { name: 'Formats', exact: true });
const names = (page: Page) => screen(page).locator('.layout-list__name');
const header = (page: Page) => page.getByRole('banner');

async function openSetup(page: Page) {
  await page.getByRole('button', { name: 'This session' }).click();
  await page.getByRole('menuitem', { name: 'New session…' }).click();
  await expect(page.getByRole('dialog', { name: 'New session' })).toBeVisible();
}

test.describe('FS-2 saved formats', () => {
  test('keyboard: duplicate 1v1 PvP, rename it, reload, start a session from it, then delete it', async ({ page }) => {
    await tabTo(page, formatsButton(page));
    await page.keyboard.press('Enter');
    await expect(screen(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to table' })).toBeFocused();
    await expect(names(page)).toHaveText(['Solo PvE', 'Co-op PvE', '1v1 PvP']);

    await tabTo(page, page.getByRole('button', { name: 'Duplicate 1v1 PvP', exact: true }));
    await page.keyboard.press('Enter');
    await expect(names(page)).toHaveText(['Solo PvE', 'Co-op PvE', '1v1 PvP', '1v1 PvP copy']);
    await expect(page.getByRole('button', { name: 'Rename 1v1 PvP copy', exact: true })).toBeFocused();

    await page.keyboard.press('Enter');
    const rename = page.getByRole('dialog', { name: 'Rename 1v1 PvP copy', exact: true });
    await expect(rename.getByRole('textbox', { name: 'Name' })).toBeFocused();
    await page.keyboard.type('solo pve');
    await page.keyboard.press('Enter');
    await expect(rename.getByText('There is already a format called Solo PvE.')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Tourney');
    await page.keyboard.press('Enter');
    await expect(rename).toBeHidden();
    await expect(names(page)).toHaveText(['Solo PvE', 'Co-op PvE', '1v1 PvP', 'Tourney']);
    await expect(page.getByRole('button', { name: 'Rename Tourney' })).toBeFocused();

    // Esc goes back to the table, with focus where it was.
    await page.keyboard.press('Escape');
    await expect(screen(page)).toBeHidden();
    await expect(formatsButton(page)).toBeFocused();

    // The format is still there after a reload (PS-1: saved a second after the last change).
    await page.waitForTimeout(1200);
    await page.reload();
    await formatsButton(page).click();
    await expect(names(page)).toHaveText(['Solo PvE', 'Co-op PvE', '1v1 PvP', 'Tourney']);
    await page.keyboard.press('Escape');

    // Start a session from it (SP-1).
    await openSetup(page);
    await page.getByRole('radio', { name: /^Tourney/ }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('radio', { name: /^Tourney/ })).toBeChecked();
    await page.keyboard.press('Enter');
    await expect(header(page)).toContainText('Tourney');
    await expect(page.getByRole('region', { name: 'Seats' }).getByRole('button', { name: /^Player 2, / })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Seats' }).getByRole('button', { name: /^Environment, / })).toHaveCount(0);

    // Delete it with the confirm step. The session keeps its seats.
    await formatsButton(page).focus();
    await page.keyboard.press('Enter');
    await tabTo(page, page.getByRole('button', { name: 'Delete Tourney' }));
    await page.keyboard.press('Enter');
    const confirm = page.getByRole('dialog', { name: 'Delete Tourney?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete format' }).focus();
    await page.keyboard.press('Enter');
    await expect(confirm).toBeHidden();
    await expect(names(page)).toHaveText(['Solo PvE', 'Co-op PvE', '1v1 PvP']);
    await expect(page.getByRole('button', { name: 'Duplicate 1v1 PvP', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(header(page)).toContainText('Tourney');

    // Its saved item is gone, and the deleted default now means Solo PvE.
    await page.waitForTimeout(300);
    await page.reload();
    await expect(header(page)).toContainText('Solo PvE');
    await formatsButton(page).click();
    await expect(names(page)).toHaveText(['Solo PvE', 'Co-op PvE', '1v1 PvP']);
  });

  test('mouse: duplicate, rename and delete, with no axe violations', async ({ page }) => {
    await formatsButton(page).click();
    await page.getByRole('button', { name: 'Duplicate Co-op PvE' }).click();
    await expect(names(page)).toHaveText(['Solo PvE', 'Co-op PvE', '1v1 PvP', 'Co-op PvE copy']);
    const results = await new AxeBuilder({ page }).include('.layout-editor').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole('button', { name: 'Rename Co-op PvE copy' }).click();
    const rename = page.getByRole('dialog', { name: 'Rename Co-op PvE copy' });
    await rename.getByRole('textbox', { name: 'Name' }).fill('Raid night');
    await rename.getByRole('button', { name: 'Rename', exact: true }).click();
    await expect(names(page)).toHaveText(['Solo PvE', 'Co-op PvE', '1v1 PvP', 'Raid night']);
    await page.getByRole('button', { name: 'Delete Raid night' }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete Raid night?' });
    const dialogResults = await new AxeBuilder({ page }).include('dialog[open]').withTags(axeTags).analyze();
    expect(dialogResults.violations).toEqual([]);
    await confirm.getByRole('button', { name: 'Delete format' }).click();
    await expect(names(page)).toHaveText(['Solo PvE', 'Co-op PvE', '1v1 PvP']);
    await page.getByRole('button', { name: 'Back to table' }).click();
    await expect(screen(page)).toBeHidden();
  });
});

test.describe('FS-2 Formats screen on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('fits the screen, the list scrolls, and the dialogs’ buttons stay visible', async ({ page }) => {
    await formatsButton(page).click();
    const duplicate = page.getByRole('button', { name: 'Duplicate 1v1 PvP', exact: true });
    for (let i = 0; i < 3; i++) await duplicate.click();
    await expect(names(page)).toHaveCount(6);

    expect(await screen(page).boundingBox()).toMatchObject({ x: 0, y: 0, width: 375, height: 667 });
    expect(await screen(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const body = screen(page).locator('.layout-editor__body');
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Back to table' })).toBeInViewport();

    const last = page.getByRole('button', { name: 'Delete 1v1 PvP copy 3' });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await last.click();
    const confirm = page.getByRole('dialog', { name: 'Delete 1v1 PvP copy 3?' });
    await expect(confirm.getByRole('button', { name: 'Delete format' })).toBeInViewport();
    await confirm.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Rename 1v1 PvP copy', exact: true }).click();
    const rename = page.getByRole('dialog', { name: 'Rename 1v1 PvP copy', exact: true });
    await expect(rename.getByRole('button', { name: 'Rename', exact: true })).toBeInViewport();
    await expect(rename.getByRole('button', { name: 'Cancel' })).toBeInViewport();
    await rename.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Back to table' }).click();

    // The setup dialog's longer list scrolls inside it, with Start session visible.
    await openSetup(page);
    await expect(page.getByRole('button', { name: 'Start session' })).toBeInViewport();
    await expect(page.getByRole('radio', { name: /^1v1 PvP copy 3/ })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
