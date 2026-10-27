import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
});

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const counters = (page: Page) => page.getByRole('dialog', { name: 'Counters on Ember Shard' });

/** double-faced.csv in CSV order; puts Daylight Hunter and Ember Shard on the table. */
async function emberShardOnTable(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('double-faced.csv'));
  await page.getByRole('button', { name: 'Done' }).click();
  await mainPile(page).focus();
  await page.keyboard.press('v');
  const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
  for (let i = 0; i < 3; i++)
    await viewer
      .getByRole('button', { name: /^To table/ })
      .first()
      .click();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  return table(page).getByRole('button', { name: /^Ember Shard/ });
}

test.describe('TT-8 card counters', () => {
  test('keyboard only: C opens counters; add, step, rename and remove, each announced; Esc keeps the value', async ({ page }) => {
    const card = await emberShardOnTable(page);
    await card.focus();
    await page.keyboard.press('c');
    await expect(counters(page).getByRole('textbox', { name: 'New counter name' })).toBeFocused();
    await page.keyboard.type('Damage');
    await page.keyboard.press('Enter');
    const status = counters(page).getByRole('status');
    await expect(status).toHaveText('Added Damage 1 to Ember Shard.');
    await expect(counters(page).getByRole('textbox', { name: 'Damage', exact: true })).toBeFocused();
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await expect(status).toHaveText('Damage on Ember Shard: 3.');
    await page.keyboard.press('-');
    await expect(status).toHaveText('Damage on Ember Shard: 2.');
    await page.keyboard.press('Escape');
    await expect(counters(page)).toBeHidden();
    await expect(
      table(page).getByRole('button', {
        name: 'Ember Shard, counters: Damage 2',
        exact: true,
      }),
    ).toBeFocused();

    // Opening again starts on the counter. Rename it from its name field.
    await page.keyboard.press('c');
    await expect(counters(page).getByRole('textbox', { name: 'Damage', exact: true })).toBeFocused();
    // Back past the − button to the name.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(
      counters(page).getByRole('textbox', {
        name: 'Counter name',
        exact: true,
      }),
    ).toBeFocused();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Wounds');
    await page.keyboard.press('Enter');
    await expect(status).toHaveText('Renamed Damage on Ember Shard to Wounds.');
    await counters(page).getByRole('button', { name: 'Remove counter' }).focus();
    await page.keyboard.press('Enter');
    await expect(status).toHaveText('Removed Wounds from Ember Shard.');
    await page.keyboard.press('Escape');
    await expect(table(page).getByRole('button', { name: 'Ember Shard', exact: true })).toBeFocused();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(
      table(page).getByRole('button', {
        name: 'Ember Shard, counters: Wounds 2',
        exact: true,
      }),
    ).toBeVisible();
  });

  test('mouse: the menu and a pill open counters, with no axe violations', async ({ page }) => {
    const card = await emberShardOnTable(page);
    await card.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Counters…' }).click();
    await page.keyboard.type('Shield');
    await counters(page).getByRole('button', { name: 'Add counter' }).click();
    await counters(page).getByRole('button', { name: 'Increase Shield' }).click();
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await counters(page).getByRole('button', { name: 'Done' }).click();

    const pill = table(page).getByRole('button', {
      name: 'Shield 2',
      exact: true,
    });
    await expect(pill).toBeVisible();
    const box = await pill.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(24);
    await page.locator('.table-viewport').evaluate((el) => el.scrollTo(0, 0));
    await pill.click();
    await expect(counters(page).getByRole('textbox', { name: 'Shield', exact: true })).toBeFocused();
    await counters(page).getByRole('button', { name: 'Decrease Shield' }).click();
    await expect(counters(page).getByRole('status')).toHaveText('Shield on Ember Shard: 1.');
  });
});

test.describe('TT-8 counters on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the dialog fits the screen with Done in view', async ({ page }) => {
    const card = await emberShardOnTable(page);
    await card.focus();
    await page.keyboard.press('c');
    for (const name of ['Damage', 'Shield', 'Poison', 'Charge']) {
      await page.keyboard.type(name);
      await page.keyboard.press('Enter');
      await counters(page).getByRole('textbox', { name: 'New counter name' }).focus();
    }
    const box = await counters(page).boundingBox();
    expect(box?.height).toBeLessThanOrEqual(667);
    await expect(counters(page).getByRole('button', { name: 'Done' })).toBeInViewport();
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(sideways).toBe(false);
  });
});
