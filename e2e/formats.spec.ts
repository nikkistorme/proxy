import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { tabTo } from './keyboard';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
});

const screen = (page: Page) => page.getByRole('dialog', { name: 'Formats' });
const setup = (page: Page) => page.getByRole('dialog', { name: 'New session' });
const sessionButton = (page: Page) => page.getByRole('button', { name: 'This session' });
const names = (page: Page) => screen(page).locator('.layout-list__name');
const header = (page: Page) => page.getByRole('banner');

async function openSetup(page: Page) {
  await sessionButton(page).click();
  await page.getByRole('menuitem', { name: 'New session…' }).click();
  await expect(setup(page)).toBeVisible();
}

test.describe('FS-2 saved formats', () => {
  test('keyboard: Edit a copy of 1v1 PvP, rename it, reload, start a session from it, then delete it', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Formats/ })).toHaveCount(0);
    await tabTo(page, sessionButton(page));
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // New session…, the first item
    await expect(page.getByRole('radio', { name: /^Solo PvE/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: /^1v1 PvP/ })).toBeChecked();
    await tabTo(page, page.getByRole('button', { name: 'Edit a copy of 1v1 PvP' }));
    await page.keyboard.press('Enter');
    await expect(screen(page)).toBeVisible();
    await expect(setup(page)).toBeHidden();
    // The copy opens in the editor (FS-2); Back to formats lists it.
    await expect(page.getByRole('button', { name: 'Back to formats' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(names(page)).toHaveText(['Solo PvE', 'Co-op PvE', '1v1 PvP', '1v1 PvP copy']);
    await expect(page.getByRole('button', { name: 'Edit 1v1 PvP copy', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Rename 1v1 PvP copy', exact: true })).toBeFocused();

    await page.keyboard.press('Enter');
    const rename = page.getByRole('dialog', { name: 'Rename 1v1 PvP copy' });
    await expect(rename.getByRole('textbox', { name: 'Name' })).toBeFocused();
    await page.keyboard.type('solo pve');
    await page.keyboard.press('Enter');
    await expect(rename.getByText('There is already a format called Solo PvE.')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Tourney');
    await page.keyboard.press('Enter');
    await expect(rename).toBeHidden();
    await expect(names(page)).toHaveText(['Solo PvE', 'Co-op PvE', '1v1 PvP', 'Tourney']);
    await expect(page.getByRole('button', { name: 'Rename Tourney', exact: true })).toBeFocused();

    // Esc returns to the setup dialog with the copy selected and focused.
    await page.keyboard.press('Escape');
    await expect(screen(page)).toBeHidden();
    await expect(setup(page)).toBeVisible();
    await expect(page.getByRole('radio', { name: /^Tourney/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /^Tourney/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(setup(page)).toBeHidden();
    await expect(sessionButton(page)).toBeFocused();

    // The format is still there after a reload (PS-1: saved a second after the last change).
    await page.waitForTimeout(1200);
    await page.reload();
    await openSetup(page);
    await page.getByRole('radio', { name: /^Tourney/ }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('radio', { name: /^Tourney/ })).toBeChecked();
    await page.keyboard.press('Enter');
    await expect(header(page)).toContainText('Tourney');
    await expect(page.getByRole('region', { name: 'Seats' }).getByRole('button', { name: /^Player 2, / })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Seats' }).getByRole('button', { name: /^Environment, / })).toHaveCount(0);

    // Reopen through Edit formats…, and delete it with the confirm step. The session keeps its seats.
    await openSetup(page);
    await expect(page.getByRole('radio', { name: /^Tourney/ })).toBeChecked();
    await tabTo(page, page.getByRole('button', { name: 'Edit formats…' }));
    await page.keyboard.press('Enter');
    await tabTo(page, page.getByRole('button', { name: 'Delete Tourney' }));
    await page.keyboard.press('Enter');
    const confirm = page.getByRole('dialog', { name: 'Delete Tourney?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete format' }).focus();
    await page.keyboard.press('Enter');
    await expect(confirm).toBeHidden();
    await expect(names(page)).toHaveText(['Solo PvE', 'Co-op PvE', '1v1 PvP']);
    await expect(page.getByRole('button', { name: 'Edit a copy of 1v1 PvP', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('radio', { name: /^Solo PvE/ })).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(header(page)).toContainText('Tourney');

    // Its saved item is gone. The session resumes with its seats, and the deleted default now means Solo PvE.
    await page.waitForTimeout(1200);
    await page.reload();
    await expect(header(page)).toContainText('Tourney');
    await openSetup(page);
    await expect(page.getByRole('radio')).toHaveCount(3);
    await expect(page.getByRole('radio', { name: /^Solo PvE/ })).toBeChecked();
  });

  test('mouse: Edit formats…, duplicate, rename and delete, with no axe violations', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('button', { name: 'Edit formats…' }).click();
    await page.getByRole('button', { name: 'Edit a copy of Co-op PvE', exact: true }).click();
    await page.getByRole('button', { name: 'Back to formats' }).click();
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
    await page.getByRole('button', { name: 'Back to New session' }).click();
    await expect(screen(page)).toBeHidden();
    await expect(setup(page)).toBeVisible();
    const setupResults = await new AxeBuilder({ page }).include('dialog[open]').withTags(axeTags).analyze();
    expect(setupResults.violations).toEqual([]);
  });
});

test.describe('FS-2 Formats screen on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('fits the screen, the list scrolls, and the dialogs’ buttons stay visible', async ({ page }) => {
    await openSetup(page);
    await expect(page.getByRole('button', { name: 'Start session' })).toBeInViewport();
    await page.getByRole('button', { name: 'Edit formats…' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Edit formats…' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Edit a copy of Solo PvE' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.getByRole('button', { name: 'Edit formats…' }).click();

    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Edit a copy of 1v1 PvP', exact: true }).click();
      await page.getByRole('button', { name: 'Back to formats' }).click();
    }
    await expect(names(page)).toHaveCount(6);

    expect(await screen(page).boundingBox()).toMatchObject({ x: 0, y: 0, width: 375, height: 667 });
    expect(await screen(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const body = screen(page).locator('.layout-editor__body');
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Back to New session' })).toBeInViewport();

    const last = page.getByRole('button', { name: 'Delete 1v1 PvP copy 3' });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await last.click();
    const confirm = page.getByRole('dialog', { name: 'Delete 1v1 PvP copy 3?' });
    await expect(confirm.getByRole('button', { name: 'Delete format' })).toBeInViewport();
    await confirm.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Rename 1v1 PvP copy', exact: true }).click();
    const rename = page.getByRole('dialog', { name: 'Rename 1v1 PvP copy' });
    await expect(rename.getByRole('button', { name: 'Rename', exact: true })).toBeInViewport();
    await expect(rename.getByRole('button', { name: 'Cancel' })).toBeInViewport();
    await rename.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Back to New session' }).click();

    // The setup dialog's longer list scrolls inside it, with the footer buttons visible.
    await expect(setup(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start session' })).toBeInViewport();
    await expect(page.getByRole('radio', { name: /^1v1 PvP copy 3/ })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
