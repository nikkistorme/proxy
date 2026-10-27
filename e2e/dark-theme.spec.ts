import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.use({ colorScheme: 'dark' });

test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
});

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const viewer = (page: Page) => page.getByRole('dialog', { name: 'P1 main deck' });
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

/** axe with zero violations, after fade-ins end so it reads final colours. */
async function noViolations(page: Page, scope?: string) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  const builder = new AxeBuilder({ page }).withTags(axeTags);
  if (scope) builder.include(scope);
  expect((await builder.analyze()).violations).toEqual([]);
}

/** Right-clicks a table card or pile. axe scrolls the table while it checks, so put it back first. */
async function openMenu(page: Page, target: Locator) {
  await page.locator('.table-viewport').evaluate((el) => el.scrollTo(0, 0));
  await target.click({ button: 'right' });
}

/** Loads double-faced.csv in CSV order and checks the import results dialog on the way. */
async function loadDeck(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await noViolations(page);
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('double-faced.csv'));
  await expect(page.getByRole('dialog', { name: 'Import results' })).toBeVisible();
  await noViolations(page);
  await page.getByRole('button', { name: 'Done' }).click();
}

test.describe('A11Y-9 dark theme', () => {
  test('follows the system setting, and switches while the app is open', async ({ page }) => {
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await expect.poll(() => theme(page)).toBe('dark');
    expect(await bg()).toBe('rgb(20, 23, 21)');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => theme(page)).toBe('light');
    expect(await bg()).toBe('rgb(246, 245, 241)');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => theme(page)).toBe('dark');
  });

  test('mouse: every screen has no axe violations in dark', async ({ page }) => {
    await noViolations(page);
    await loadDeck(page);

    // Pile viewer, then cards to the table.
    await mainPile(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'View cards…' }).click();
    await expect(viewer(page)).toBeVisible();
    await noViolations(page);
    for (let i = 0; i < 3; i++)
      await viewer(page)
        .getByRole('button', { name: /^To table/ })
        .first()
        .click();
    await page.keyboard.press('Escape');
    await expect(viewer(page)).toBeHidden();

    // The table with cards, a card menu and its counters.
    const shard = table(page).getByRole('button', { name: 'Ember Shard', exact: true });
    await noViolations(page);
    await openMenu(page, shard);
    await noViolations(page);
    await page.getByRole('menuitem', { name: 'Counters…' }).click();
    const counters = page.getByRole('dialog', { name: 'Counters on Ember Shard' });
    await counters.getByRole('button', { name: 'Add counter' }).click();
    await noViolations(page, 'dialog[open]');
    await page.keyboard.press('Escape');
    await expect(counters).toBeHidden();
    await noViolations(page);

    // Enlarge.
    await page.locator('.table-viewport').evaluate((el) => el.scrollTo(0, 0));
    await shard.focus();
    await page.keyboard.press('i');
    await expect(page.locator('.card-enlarge')).toBeVisible();
    await noViolations(page, '.card-enlarge');
    await page.keyboard.press('Escape');

    // Move to… from the card menu.
    await openMenu(page, shard);
    await page.getByRole('menuitem', { name: 'Move to…' }).click();
    await expect(page.getByRole('dialog', { name: 'Ember Shard' })).toBeVisible();
    await noViolations(page, 'dialog[open]');
    await page.keyboard.press('Escape');

    // Delete shows the toast with Undo.
    await openMenu(page, shard);
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.locator('.toast')).toBeVisible();
    await noViolations(page, '.toast');

    // Peek and the count dialogs.
    await openMenu(page, mainPile(page));
    await page.getByRole('menuitem', { name: 'Peek at top cards…' }).click();
    await noViolations(page, 'dialog[open]');
    await page.getByRole('dialog', { name: 'Peek at P1 main deck' }).getByRole('button', { name: 'Peek' }).click();
    await expect(page.getByRole('dialog', { name: /^Top \d+ of P1 main deck$/ })).toBeVisible();
    await noViolations(page, 'dialog[open]');
    await page.keyboard.press('Escape');

    // Draw a card so the hand has one, then check the hand card menu.
    await page.getByRole('button', { name: 'Draw' }).click();
    const hand = page.getByRole('list', { name: /^Player 1's hand, 1 card\./ });
    await hand.getByRole('button').first().click({ button: 'right' });
    await noViolations(page);
    await page.keyboard.press('Escape');

    // Add a pile.
    await page.getByRole('button', { name: 'Add pile' }).click();
    await noViolations(page, 'dialog[open]');
    await page.keyboard.press('Escape');

    // Dice and the session log.
    await page.getByRole('button', { name: 'Dice & coins' }).click();
    await page.getByRole('button', { name: 'Roll d6' }).click();
    await noViolations(page, 'dialog[open]');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'This session' }).click();
    await noViolations(page);
    await page.getByRole('menuitem', { name: 'Session log' }).click();
    await noViolations(page, 'dialog[open]');
    await page.keyboard.press('Escape');

    // The shortcut reference.
    await page.getByRole('button', { name: 'Keyboard shortcuts (?)' }).click();
    await noViolations(page, 'dialog[open]');
  });
});

test.describe('A11Y-9 dark theme on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the game screen and pile viewer have no axe violations', async ({ page }) => {
    await noViolations(page);
    await loadDeck(page);
    await mainPile(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'View cards…' }).click();
    await expect(viewer(page)).toBeVisible();
    await noViolations(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
