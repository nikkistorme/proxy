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
const viewer = (page: Page) => page.getByRole('dialog', { name: 'P1 main deck' });
/** A viewer card button by its name and position ("Card 01. Spell. … #1 from top"). */
const card = (name: string, position: number | string = '\\d+') => new RegExp(`^${name}\\. .* #${position} from top$`);
const tableCards = (page: Page) => page.getByRole('list', { name: /^Cards on the table/ });

/** Loads the 60-row deck (58 cards) into P1 main deck in CSV order: Card 01 is on top. */
async function loadSixty(page: Page) {
  await mainPile(page).click();
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('sixty-rows-two-dfc.csv'));
  await page.getByRole('button', { name: 'Done' }).click();
}

test.describe('SP-7, SP-8 pile viewer', () => {
  test('acceptance, mouse: find a named card in a 60-card deck and put it on the table in three actions', async ({ page }) => {
    await loadSixty(page);

    // 1. Open the viewer (the pile menu, then View cards…).
    await mainPile(page).click();
    await page.getByRole('menuitem', { name: 'View cards…' }).click();
    const sheet = viewer(page);
    await expect(sheet).toContainText('58 cards · shown face up to you only');
    // 2. Search for the card.
    await sheet.getByRole('textbox', { name: 'Search name or text' }).fill('Card 37');
    await expect(sheet.getByRole('button', { name: /from top$/ })).toHaveCount(1);
    // 3. Put it on the table.
    await sheet.getByRole('button', { name: 'To table: Card 37' }).click();

    await expect(sheet).toContainText('Moved Card 37 from P1 main deck to the table.');
    await expect(sheet).toContainText('No cards match.');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(mainPile(page)).toBeFocused();
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 57 cards, Player 1');
    await expect(tableCards(page).getByRole('img')).toHaveAccessibleName(/^Card 37\./);
  });

  test('keyboard only: V opens the viewer, arrows browse, T and Enter move, Esc closes', async ({ page }) => {
    await loadSixty(page);
    await mainPile(page).focus();
    await page.keyboard.press('v');
    const sheet = viewer(page);
    const search = sheet.getByRole('textbox', { name: 'Search name or text' });
    await expect(search).toBeFocused();

    await page.keyboard.type('Card 37');
    await page.keyboard.press('ArrowDown');
    await expect(sheet.getByRole('button', { name: card('Card 37') })).toBeFocused();
    await page.keyboard.press('t');
    await expect(search).toBeFocused();

    await search.fill('');
    await page.keyboard.press('ArrowDown');
    await expect(sheet.getByRole('button', { name: card('Card 01', 1) })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(sheet).toContainText('Moved Card 02 from P1 main deck to Player 1\'s hand.');
    await expect(sheet.getByRole('button', { name: card('Card 03', 2) })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(mainPile(page)).toBeFocused();
    await expect(page.getByRole('list', { name: "Player 1's hand, 1 card" })).toBeVisible();
    await expect(tableCards(page).getByRole('img')).toHaveAccessibleName(/^Card 37\./);
  });

  test('filters by column, and has no axe violations while filtered', async ({ page }) => {
    await loadSixty(page);
    await mainPile(page).click();
    await page.getByRole('menuitem', { name: 'View cards…' }).click();
    const sheet = viewer(page);
    await sheet.getByRole('combobox', { name: 'Type' }).selectOption('Spell');
    await sheet.getByRole('textbox', { name: 'Search name or text' }).fill('card 3');
    await expect(sheet.getByText(/match/)).toContainText('· Type: Spell');
    const names = await sheet.getByRole('button', { name: /from top$/ }).evaluateAll((b) => b.map((e) => e.getAttribute('aria-label')));
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => n?.startsWith('Card 3') && n.includes('. Spell. '))).toBe(true);

    // Let the sheet finish fading in, or axe reads half-faded text colours.
    await sheet.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('SP-7 pile viewer on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('fills the screen, scrolls its cards, and keeps the footer in view', async ({ page }) => {
    await loadSixty(page);
    await mainPile(page).click();
    await page.getByRole('menuitem', { name: 'View cards…' }).click();
    const sheet = viewer(page);
    const box = await sheet.boundingBox();
    expect(box?.width).toBeCloseTo(375, 0);
    expect(box?.height).toBeGreaterThan(667 * 0.95);
    await expect(sheet.getByRole('button', { name: 'Reveal top card' })).toBeInViewport();

    // Two cards a row, and the last one is reachable by scrolling the results.
    const first = await sheet.getByRole('button', { name: card('Card 01', 1) }).boundingBox();
    const second = await sheet.getByRole('button', { name: card('Card 02', 2) }).boundingBox();
    expect(second?.y).toBe(first?.y);
    const last = sheet.getByRole('button', { name: card('.*', 58) });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await expect(sheet.getByRole('button', { name: 'Reveal top card' })).toBeInViewport();

    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(sideways).toBe(false);
  });
});
