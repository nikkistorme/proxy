import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

const pile = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name},`) });
const pileLabels = (page: Page) => page.getByRole('list', { name: 'Piles' }).getByRole('button').evaluateAll((b) => b.map((x) => x.getAttribute('aria-label')));

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  expect(results.violations).toEqual([]);
}

test.describe('SP-4 manage piles', () => {
  test('mouse: add a pile for the environment, rename it, then delete a pile with cards into it', async ({ page }) => {
    await page.getByRole('button', { name: 'Add pile' }).click();
    const add = page.getByRole('dialog', { name: 'Add a pile' });
    await add.getByRole('textbox', { name: 'Name' }).fill('Env discard');
    await add.getByRole('radio', { name: 'Environment' }).check();
    await expectNoAxeViolations(page);
    await add.getByRole('button', { name: 'Add pile' }).click();
    await expect(pile(page, 'Env discard')).toHaveAccessibleName('Env discard, empty, 0 cards, Environment');
    await expect(pile(page, 'Env discard')).toBeFocused();

    await pile(page, 'Env discard').click();
    await page.getByRole('menuitem', { name: 'Rename…' }).click();
    const rename = page.getByRole('dialog', { name: 'Rename Env discard' });
    await rename.getByRole('textbox', { name: 'Name' }).fill('board cards');
    await rename.getByRole('button', { name: 'Rename' }).click();
    await expect(rename.getByRole('textbox')).toHaveAccessibleDescription('There is already a pile called Board cards.');
    await expectNoAxeViolations(page);
    await rename.getByRole('textbox', { name: 'Name' }).fill('Graveyard');
    await rename.getByRole('button', { name: 'Rename' }).click();
    await expect(pile(page, 'Graveyard')).toBeFocused();

    await pile(page, 'P1 main deck').click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
    await (await chooser).setFiles(fixture('double-faced.csv'));
    await page.getByRole('button', { name: 'Done' }).click();

    await pile(page, 'P1 main deck').click();
    await page.getByRole('menuitem', { name: 'Delete…' }).click();
    const del = page.getByRole('dialog', { name: 'Delete P1 main deck?' });
    await del.getByRole('radio', { name: /^Graveyard/ }).check();
    await expectNoAxeViolations(page);
    await del.getByRole('button', { name: 'Delete pile' }).click();
    expect(await pileLabels(page)).toEqual([
      'Environment deck, empty, 0 cards, Environment',
      'Board cards, empty, 0 cards, shared',
      'Graveyard, 4 cards, Environment',
    ]);
    await expect(page.getByRole('button', { name: /^Environment deck,/ })).toBeFocused();
  });

  test('keyboard only: add a shared pile, then delete it', async ({ page }) => {
    // Undo, Redo, three piles, then Add pile.
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Add pile' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('textbox', { name: 'Name' })).toBeFocused();
    await page.keyboard.type('Tokens');
    await page.keyboard.press('Tab');
    // Arrow keys move through the owner radios: Player 1, Environment, Shared.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: 'Shared' })).toBeChecked();
    await page.keyboard.press('Enter');
    await expect(pile(page, 'Tokens')).toBeFocused();
    await expect(pile(page, 'Tokens')).toHaveAccessibleName('Tokens, empty, 0 cards, shared');

    await page.keyboard.press('Enter');
    await page.keyboard.press('End');
    await expect(page.getByRole('menuitem', { name: 'Delete…' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Delete Tokens?' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(pile(page, 'Tokens')).toBeFocused();

    await page.keyboard.press('Enter');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Delete pile' }).focus();
    await page.keyboard.press('Enter');
    await expect(pile(page, 'Tokens')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveText('Deleted Tokens.');
  });
});
