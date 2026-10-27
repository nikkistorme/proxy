import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
});

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const status = (page: Page) => page.getByRole('status');

/** Loads the 60-row deck into P1 main deck in CSV order: Card 01 is on top. */
async function loadSixty(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('sixty-rows-two-dfc.csv'));
  await page.getByRole('button', { name: 'Done' }).click();
}

async function dropFile(page: Page, target: ReturnType<Page['getByRole']>, name: string, contents: string) {
  const dataTransfer = await page.evaluateHandle(
    ({ name, contents }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([contents], name, { type: name.endsWith('.csv') ? 'text/csv' : 'application/octet-stream' }));
      return transfer;
    },
    { name, contents },
  );
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
}

test.describe('SP-6 pile actions', () => {
  test('mouse: reveal, shuffle, draw N and mill N', async ({ page }) => {
    await loadSixty(page);

    await mainPile(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Reveal top card' }).click();
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 58 cards, Player 1, top card face up: Card 01');

    await mainPile(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Shuffle' }).click();
    await expect(status(page)).toHaveText('Shuffled P1 main deck. 58 cards.');
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 58 cards, Player 1');

    await mainPile(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Draw cards…' }).click();
    const drawDialog = page.getByRole('dialog', { name: 'Draw from P1 main deck' });
    await drawDialog.getByRole('spinbutton').fill('3');
    await drawDialog.getByRole('button', { name: 'Draw' }).click();
    const hand = page.getByRole('list', { name: /^Player 1's hand, 3 cards\./ });
    await expect(hand).toBeVisible();
    // After a shuffle, the chance of drawing Card 01, 02, 03 in order is about 1 in 180,000.
    const names = await hand.getByRole('button').evaluateAll((cards) => cards.map((c) => c.getAttribute('aria-label')?.split('.')[0]));
    expect(names).not.toEqual(['Card 01', 'Card 02', 'Card 03']);

    await mainPile(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Mill cards…' }).click();
    const millDialog = page.getByRole('dialog', { name: 'Mill from P1 main deck' });
    await millDialog.getByRole('spinbutton').fill('2');
    await millDialog.getByRole('radio', { name: /^Board cards/ }).check();
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await millDialog.getByRole('button', { name: 'Move' }).click();
    await expect(page.getByRole('button', { name: /^Board cards,/ })).toHaveAccessibleName('Board cards, 2 cards, shared');
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 53 cards, Player 1');
  });

  test('keyboard only: draw N with Enter, and cancel a mill with Escape', async ({ page }) => {
    await loadSixty(page);
    await mainPile(page).focus();

    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Draw cards…' })).toBeFocused();
    await page.keyboard.press('Enter');

    const field = page.getByRole('spinbutton', { name: "Cards to draw into Player 1's hand" });
    await expect(field).toBeFocused();
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('list', { name: /^Player 1's hand, 2 cards\./ })).toBeVisible();
    await expect(status(page)).toHaveText('Player 1 drew Card 01 and Card 02 from P1 main deck. 56 cards left.');
    await expect(mainPile(page)).toBeFocused();

    await page.keyboard.press('Enter');
    // End reaches Delete…; up past Rename…, Move on table and View cards… to Mill cards….
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitem', { name: 'Mill cards…' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Mill from P1 main deck' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(mainPile(page)).toBeFocused();
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 56 cards, Player 1');
  });

  test('an out-of-range number is refused with a message', async ({ page }) => {
    await loadSixty(page);
    await mainPile(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Draw cards…' }).click();
    const field = page.getByRole('spinbutton');
    await field.fill('99');
    await page.keyboard.press('Enter');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription('Enter a whole number from 1 to 58.');
    await expect(page.getByRole('dialog', { name: 'Draw from P1 main deck' })).toBeVisible();
  });
});

test.describe('SP-1 drop a CSV on a pile', () => {
  test('dropping a CSV on a pile loads it there', async ({ page }) => {
    const board = page.getByRole('button', { name: /^Board cards,/ });
    await dropFile(page, board, 'double-faced.csv', readFileSync(fixture('double-faced.csv'), 'utf8'));
    await expect(page.getByRole('dialog', { name: 'Import results' })).toContainText('double-faced.csv into Board cards');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(board).toHaveAccessibleName('Board cards, 4 cards, shared');
    await expect(board).toBeFocused();
  });

  test('dropping something that is not a CSV loads nothing', async ({ page }) => {
    await dropFile(page, mainPile(page), 'art.png', 'not a deck');
    await expect(page.getByRole('dialog', { name: 'Import results' })).toContainText("art.png isn't a CSV file. Nothing was loaded.");
  });
});

test.describe('Pile menu on a short screen', () => {
  test.use({ viewport: { width: 1280, height: 560 } });

  test('stays inside the viewport, scrolls, and shows an inner shadow while more options are hidden', async ({ page }) => {
    await loadSixty(page);
    await mainPile(page).click({ button: 'right' });
    const menu = page.getByRole('menu', { name: 'Actions for P1 main deck' });
    const box = await menu.boundingBox();
    // Regression: the menu ran past the bottom of the viewport.
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(560);
    expect(box?.y).toBeGreaterThanOrEqual(0);
    await expect(menu).toHaveAttribute('data-more-below', '');
    await expect(menu).not.toHaveAttribute('data-more-above');
    // The shadows are overlay layers above the items, so a hovered item can't cover them.
    const shadow = (edge: '::before' | '::after') =>
      menu.evaluate((m, pseudo) => {
        const style = getComputedStyle(m, pseudo);
        return { position: style.position, zIndex: style.zIndex, opacity: style.opacity };
      }, edge);
    expect(await shadow('::after')).toEqual({ position: 'sticky', zIndex: '1', opacity: '1' });
    expect((await shadow('::before')).opacity).toBe('0');

    await page.keyboard.press('End');
    const last = menu.getByRole('menuitem', { name: 'Delete…' });
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport();
    await expect(menu).toHaveAttribute('data-more-above', '');
    await expect(menu).not.toHaveAttribute('data-more-below');
    expect((await shadow('::before')).opacity).toBe('1');
    expect((await shadow('::after')).opacity).toBe('0');
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
  });
});
