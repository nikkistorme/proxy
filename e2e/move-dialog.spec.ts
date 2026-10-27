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
const boardPile = (page: Page) => page.getByRole('button', { name: /^Board cards,/ });
const viewer = (page: Page) => page.getByRole('dialog', { name: 'P1 main deck' });
/** A viewer card button by its name and position ("Card 01. Spell. … #1 from top"). */
const card = (name: string, position: number | string = '\\d+') => new RegExp(`^${name}\\. .* #${position} from top$`);

/** Loads the 60-row deck (58 cards) into P1 main deck in CSV order, then opens the viewer. */
async function openViewer(page: Page) {
  await mainPile(page).click();
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('sixty-rows-two-dfc.csv'));
  await page.getByRole('button', { name: 'Done' }).click();
  await mainPile(page).focus();
  await page.keyboard.press('v');
  return viewer(page);
}

test.describe('SP-8 Move to… dialog', () => {
  test('mouse: move a card from the viewer to the bottom of another pile', async ({ page }) => {
    const sheet = await openViewer(page);
    await sheet.getByRole('button', { name: card('Card 02', 2) }).click();
    await sheet.getByRole('button', { name: 'Move to…: Card 02' }).click();

    const move = page.getByRole('dialog', { name: 'Card 02' });
    await expect(move).toContainText('Move card · from P1 main deck');
    await expect(move.getByRole('combobox', { name: 'Find a destination' })).toBeFocused();
    await move.getByRole('option', { name: /^Board cards — bottom/ }).click();
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await move.getByRole('button', { name: 'Move to Board cards — bottom' }).click();

    await expect(move).toBeHidden();
    await expect(sheet).toContainText('Moved Card 02 from P1 main deck to the bottom of Board cards.');
    await expect(sheet.getByRole('button', { name: card('Card 03', 2) })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(boardPile(page)).toHaveAccessibleName('Board cards, 1 card, shared');
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 57 cards, Player 1');
  });

  test('keyboard only: M, filter, choose and Enter; Esc closes only the Move dialog', async ({ page }) => {
    const sheet = await openViewer(page);
    await page.keyboard.type('Card 37');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('m');

    const move = page.getByRole('dialog', { name: 'Card 37' });
    const search = move.getByRole('combobox', { name: 'Find a destination' });
    await expect(search).toBeFocused();
    // Esc cancels the Move dialog and leaves the viewer open on the same card.
    await page.keyboard.press('Escape');
    await expect(move).toBeHidden();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: card('Card 37') })).toBeFocused();

    await page.keyboard.press('m');
    await page.keyboard.type('env');
    await expect(move.getByRole('status')).toHaveText('2 of 8 destinations match');
    await page.keyboard.press('ArrowDown');
    await expect(move.getByRole('option', { selected: true })).toHaveAccessibleName('Environment deck — bottom 0 cards');
    await page.keyboard.press('Enter');

    await expect(move).toBeHidden();
    await expect(sheet.getByRole('textbox', { name: 'Search name or text' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /^Environment deck,/ })).toHaveAccessibleName('Environment deck, 1 card, Environment');
  });
});

test.describe('SP-8 Move to… dialog on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('fits the screen with the Move button in view', async ({ page }) => {
    const sheet = await openViewer(page);
    await sheet.getByRole('button', { name: 'Move to…: Card 01' }).click();
    const move = page.getByRole('dialog', { name: 'Card 01' });
    const box = await move.boundingBox();
    expect(box?.height).toBeLessThanOrEqual(667);
    await expect(move.getByRole('button', { name: 'Move to Table — next free spot' })).toBeInViewport();
    const last = move.getByRole('option', { name: /^Board cards — bottom/ });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(sideways).toBe(false);
  });
});
