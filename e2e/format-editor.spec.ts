import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { tabTo } from './keyboard';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

const screen = (page: Page) => page.getByRole('dialog', { name: 'Formats' });
const setup = (page: Page) => page.getByRole('dialog', { name: 'New session' });
const sessionButton = (page: Page) => page.getByRole('button', { name: 'This session' });
const header = (page: Page) => page.getByRole('banner');

async function openSetup(page: Page) {
  await sessionButton(page).click();
  await page.getByRole('menuitem', { name: 'New session…' }).click();
  await expect(setup(page)).toBeVisible();
}

test.describe('FS-2 format editor', () => {
  test('keyboard: edit a copy of 1v1 PvP, change seats, piles and dice, reload and start a session from it', async ({ page }) => {
    await tabTo(page, sessionButton(page));
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // New session…
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: /^1v1 PvP/ })).toBeChecked();
    await tabTo(page, page.getByRole('button', { name: 'Edit a copy of 1v1 PvP' }));
    await page.keyboard.press('Enter');
    await expect(screen(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to formats' })).toBeFocused();
    await expect(screen(page).getByRole('heading', { name: '1v1 PvP copy' })).toBeVisible();

    // Rename Player 2.
    const seat2 = page.getByRole('textbox', { name: 'Seat 2 name' });
    await tabTo(page, seat2);
    await page.keyboard.type('Rival');
    await expect(seat2).toHaveValue('Rival');

    // An invalid name shows an error and isn't saved.
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('player 1');
    await expect(screen(page).getByText('There is already a seat called Player 1.')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Rival');

    // Add a pile and name it.
    await tabTo(page, screen(page).getByRole('button', { name: 'Add pile' }));
    await page.keyboard.press('Enter');
    const pile4 = page.getByRole('textbox', { name: 'Pile 4 name' });
    await expect(pile4).toBeFocused();
    await expect(screen(page).getByRole('status')).toHaveText('Added pile Pile 4.');
    await page.keyboard.type('Graveyard');
    await expect(pile4).toHaveValue('Graveyard');

    // Change its owner (the select is focused by Tab; type to pick Rival).
    await page.keyboard.press('Tab');
    const owner = page.getByRole('combobox', { name: 'Pile 4 owner' });
    await expect(owner).toBeFocused();
    await owner.selectOption({ label: 'Rival' });

    // Remove P2 main deck: focus lands on the next pile's Remove button.
    const removeP2 = page.getByRole('button', { name: 'Remove P2 main deck' });
    await tabTo(page, removeP2, { backwards: true, max: 40 });
    await page.keyboard.press('Enter');
    await expect(screen(page).getByRole('status')).toHaveText('Removed P2 main deck.');
    await expect(page.getByRole('button', { name: 'Remove Board cards' })).toBeFocused();

    // Turn dice off.
    const dice = page.getByRole('checkbox', { name: 'Uses dice' });
    await tabTo(page, dice);
    await page.keyboard.press('Space');
    await expect(dice).not.toBeChecked();
    await expect(screen(page).getByRole('status')).toHaveText('Dice turned off.');

    // Esc goes back to the list with focus on the row's Edit button, then back to the setup dialog.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Edit 1v1 PvP copy' })).toBeFocused();
    await expect(screen(page)).toContainText('Piles: P1 main deck, Board cards, Graveyard');
    await page.keyboard.press('Escape');
    await expect(setup(page)).toBeVisible();
    await expect(page.getByRole('radio', { name: /^1v1 PvP copy/ })).toBeChecked();

    // After a reload, the session starts with the edited seats and piles, and no Dice & coins.
    await page.waitForTimeout(1200);
    await page.reload();
    await openSetup(page);
    await page.getByRole('radio', { name: /^1v1 PvP copy/ }).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await expect(header(page)).toContainText('1v1 PvP copy');
    await expect(page.getByRole('region', { name: 'Seats' }).getByRole('button', { name: /^Rival, / })).toBeVisible();
    for (const name of ['P1 main deck', 'Board cards', 'Graveyard']) await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText('P2 main deck', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Dice/ })).toHaveCount(0);
  });

  test('mouse: Edit a saved format, with no axe violations', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('button', { name: 'Edit formats…' }).click();
    await page.getByRole('button', { name: 'Edit a copy of Co-op PvE' }).click();
    await expect(page.getByRole('textbox', { name: 'Seat 3 name' })).toHaveValue('Environment');
    await page.getByRole('textbox', { name: 'Seat 1 name' }).fill('Ann');
    await page.getByRole('textbox', { name: 'Pile 1 name' }).fill('');
    await expect(screen(page).getByText('A pile needs a name.')).toBeVisible();
    const results = await new AxeBuilder({ page }).include('.layout-editor').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole('textbox', { name: 'Pile 1 name' }).fill('Ann deck');
    await page.getByRole('button', { name: 'Back to formats' }).click();
    const row = screen(page).locator('[data-format-id]', { hasText: 'Co-op PvE copy' });
    await expect(row).toContainText('Ann');
    await expect(row).toContainText('Piles: Ann deck, P2 main deck');
    await page.getByRole('button', { name: 'Edit Co-op PvE copy' }).click();
    await expect(page.getByRole('textbox', { name: 'Seat 1 name' })).toHaveValue('Ann');
  });
});

test.describe('FS-2 format editor on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('fits the screen with no sideways scroll, and Back stays visible', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('button', { name: 'Edit a copy of Solo PvE' }).click();
    for (let i = 0; i < 3; i++) await screen(page).getByRole('button', { name: 'Add pile' }).click();
    await expect(page.getByRole('textbox', { name: 'Pile 6 name' })).toBeVisible();
    expect(await screen(page).boundingBox()).toMatchObject({ x: 0, y: 0, width: 375, height: 667 });
    expect(await screen(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    const body = screen(page).locator('.layout-editor__body');
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Back to formats' })).toBeInViewport();
    const dice = page.getByRole('checkbox', { name: 'Uses dice' });
    await dice.scrollIntoViewIfNeeded();
    await expect(dice).toBeInViewport();
  });
});

test.describe('FS-4 seat counters', () => {
  const seats = (page: Page) => page.getByRole('region', { name: 'Seats' });

  test('keyboard: set Life to 30, add and remove counters, reload and start a session from the copy', async ({ page }) => {
    await tabTo(page, sessionButton(page));
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // New session…
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: /^1v1 PvP/ })).toBeChecked();
    await tabTo(page, page.getByRole('button', { name: 'Edit a copy of 1v1 PvP' }));
    await page.keyboard.press('Enter');
    await expect(screen(page)).toBeVisible();

    // Life 30 for both players: focusing a field selects it, so typing replaces the value.
    for (const seat of [1, 2]) {
      const life = page.getByRole('textbox', { name: `Seat ${seat} counter 1 starting value` });
      await tabTo(page, life, { max: 60 });
      await page.keyboard.type('30');
      await expect(life).toHaveValue('30');
    }

    // An out-of-range value shows an error.
    const energy1 = page.getByRole('textbox', { name: 'Seat 1 counter 2 starting value' });
    await tabTo(page, energy1, { backwards: true, max: 60 });
    await page.keyboard.type('1000');
    await expect(screen(page).getByText('The starting value must be from -999 to 999.')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('-2');
    await expect(screen(page).getByText('The starting value must be from -999 to 999.')).toHaveCount(0);

    // Add a counter to Player 1 and name it.
    await tabTo(page, page.getByRole('button', { name: 'Add counter to Player 1' }), { max: 60 });
    await page.keyboard.press('Enter');
    const added = page.getByRole('textbox', { name: 'Seat 1 counter 3 name' });
    await expect(added).toBeFocused();
    await expect(screen(page).getByRole('status')).toHaveText('Added counter Counter 3 to Player 1.');
    await page.keyboard.type('Mana');

    // Remove Energy from Player 2: focus goes to the previous counter's Remove button.
    await tabTo(page, page.getByRole('button', { name: 'Remove Player 2 Energy' }), { max: 60 });
    await page.keyboard.press('Enter');
    await expect(screen(page).getByRole('status')).toHaveText('Removed Player 2 Energy.');
    await expect(page.getByRole('button', { name: 'Remove Player 2 Life' })).toBeFocused();

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(setup(page)).toBeVisible();

    await page.waitForTimeout(1200);
    await page.reload();
    await openSetup(page);
    await page.getByRole('radio', { name: /^1v1 PvP copy/ }).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await expect(header(page)).toContainText('1v1 PvP copy');
    for (const name of ['Player 1 Life', 'Player 2 Life']) await expect(seats(page).getByRole('group', { name })).toContainText('30');
    await expect(seats(page).getByRole('group', { name: 'Player 1 Energy' })).toContainText('-2');
    await expect(seats(page).getByRole('group', { name: 'Player 1 Mana' })).toContainText('0');
    await expect(seats(page).getByRole('group', { name: 'Player 2 Energy' })).toHaveCount(0);
  });

  test('mouse: counters on the Environment seat, remove and add, with no axe violations', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('button', { name: 'Edit formats…' }).click();
    await page.getByRole('button', { name: 'Edit a copy of Co-op PvE' }).click();
    await page.getByRole('button', { name: 'Add counter to Environment' }).click();
    await page.getByRole('textbox', { name: 'Seat 3 counter 1 name' }).fill('Doom');
    await page.getByRole('textbox', { name: 'Seat 3 counter 1 starting value' }).fill('5');
    await page.getByRole('button', { name: 'Remove Player 1 Energy' }).click();
    await page.getByRole('textbox', { name: 'Seat 1 counter 1 starting value' }).fill('x');
    await expect(screen(page).getByText('The starting value must be a whole number.')).toBeVisible();
    const results = await new AxeBuilder({ page }).include('.layout-editor').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole('textbox', { name: 'Seat 1 counter 1 starting value' }).fill('25');
    await page.getByRole('button', { name: 'Back to formats' }).click();
    await page.getByRole('button', { name: 'Edit Co-op PvE copy' }).click();
    await expect(page.getByRole('textbox', { name: 'Seat 1 counter 1 starting value' })).toHaveValue('25');
    await expect(page.getByRole('textbox', { name: 'Seat 3 counter 1 name' })).toHaveValue('Doom');
    await expect(page.getByRole('button', { name: 'Remove Player 1 Energy' })).toHaveCount(0);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('four counters fit the editor and the seat bar with no sideways scroll', async ({ page }) => {
      await openSetup(page);
      await page.getByRole('radio', { name: /^1v1 PvP/ }).check();
      await page.getByRole('button', { name: 'Edit a copy of 1v1 PvP' }).click();
      await page.getByRole('button', { name: 'Add counter to Player 1' }).click();
      await page.getByRole('button', { name: 'Add counter to Player 1' }).click();
      await expect(screen(page).getByText('A seat can have up to 4 counters.')).toBeVisible();
      expect(await screen(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      const body = screen(page).locator('.layout-editor__body');
      expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await expect(page.getByRole('button', { name: 'Back to formats' })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await page.getByRole('radio', { name: /^1v1 PvP copy/ }).check();
      await page.getByRole('button', { name: 'Start session' }).click();
      await expect(seats(page).getByRole('group', { name: 'Player 1 Counter 4' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      expect(await seats(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    });
  });
});
