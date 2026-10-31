import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { closeWith, tabTo } from './keyboard';
import { storedSession } from './storage';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SHEET = 'https://docs.google.com/spreadsheets/d/e/2PACX-invented-sheet-id/pub?gid=0&single=true&output=csv';
const EDIT_LINK = 'https://docs.google.com/spreadsheets/d/invented-sheet-id/edit?usp=sharing';
const FILE_NAME = 'Invented Deck - Main cards.csv';

/** What the mocked sheet answers: tests change `text` or `status` between fetches. */
interface Sheet {
  text: string;
  status: number;
  requests: number;
}

/**
 * Mocks every response of the sheet address, shaped like a real published sheet: `text/csv`,
 * open CORS, a readable Content-Disposition with a `filename*`. Nothing reaches Google.
 */
async function mockSheet(page: Page, text: string): Promise<Sheet> {
  const sheet: Sheet = { text, status: 200, requests: 0 };
  await page.route('https://docs.google.com/spreadsheets/**', (route) => {
    sheet.requests++;
    return route.fulfill({
      status: sheet.status,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'Content-Disposition',
        'cache-control': 'private, max-age=300',
        'content-disposition': `attachment; filename="InventedDeck-Maincards.csv"; filename*=UTF-8''${encodeURIComponent(FILE_NAME)}`,
      },
      body: sheet.text,
    });
  });
  return sheet;
}

const CARDS = 'id,name,qty,type\nimp-1,Marsh Imp,1,Creature\n';
const CARDS_EDITED = 'id,name,qty,type\nimp-1,Marsh Imp the Elder,1,Creature\n';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
});

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const loadDialog = (page: Page) => page.getByRole('dialog', { name: 'Load from URL' });
const results = (page: Page) => page.getByRole('dialog', { name: 'Import results' });
const urlField = (page: Page) => page.getByRole('textbox', { name: 'Published CSV address' });

/** Puts the one card on the table: draw it, then place it from the hand by keyboard. */
async function putCardOnTable(page: Page) {
  await mainPile(page).focus();
  await page.keyboard.press('d');
  const handCard = page.getByRole('region', { name: "Player 1's hand" }).locator('.hand-tray__card-button[tabindex="0"]');
  await handCard.focus();
  await page.keyboard.press('p');
  await expect(table(page).getByRole('button', { name: /^Marsh Imp/ })).toHaveCount(1);
}

async function openMenu(page: Page) {
  await mainPile(page).click({ button: 'right' });
}

async function loadFromUrl(page: Page, url = SHEET) {
  await openMenu(page);
  await page.getByRole('menuitem', { name: 'Load from URL…' }).click();
  await urlField(page).fill(url);
  await page.getByRole('button', { name: 'Load', exact: true }).click();
}

test.describe('CD-7 CD-9 CD-10 load from a URL by keyboard', () => {
  test('load, edit the sheet, reload: the card changes in place', async ({ page }) => {
    const sheet = await mockSheet(page, CARDS);

    await tabTo(page, mainPile(page));
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: 'Actions for P1 main deck' });
    await expect(menu.getByRole('menuitem').nth(0)).toHaveText('Load CSV…');
    await expect(menu.getByRole('menuitem').nth(1)).toHaveText('Load from URL…');
    await expect(menu.getByRole('menuitem', { name: 'Reload from URL' })).toHaveCount(0);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(loadDialog(page)).toBeVisible();
    await expect(urlField(page)).toBeFocused();
    await page.keyboard.type(SHEET);
    await page.keyboard.press('Enter');

    await expect(results(page)).toContainText(`${FILE_NAME} into P1 main deck`);
    await expect(results(page)).toContainText('Google can take a few minutes');
    await expect(results(page)).toContainText('1 card imported');
    const scan = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(scan.violations).toEqual([]);
    await closeWith(page, results(page), { focusOn: mainPile(page) });
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 1 card, Player 1');

    await putCardOnTable(page);
    const card = table(page).locator('.table-card');
    const before = { style: await card.getAttribute('style'), name: await card.getByRole('button').getAttribute('aria-label') };

    // The sheet is edited, then Reload from URL fetches at once.
    sheet.text = CARDS_EDITED;
    await mainPile(page).focus();
    await page.keyboard.press('Enter');
    await expect(menu.getByRole('menuitem', { name: /^Reload .*\.csv/ })).toHaveCount(0);
    await menu.getByRole('menuitem', { name: 'Reload from URL' }).focus();
    await page.keyboard.press('Enter');

    await expect(results(page)).toContainText('1 updated');
    await expect(results(page)).toContainText('Fetched');
    await closeWith(page, results(page), { focusOn: mainPile(page) });
    await expect(table(page).getByRole('button', { name: /^Marsh Imp the Elder/ })).toHaveCount(1);
    const after = { style: await card.getAttribute('style'), name: await card.getByRole('button').getAttribute('aria-label') };
    expect(after.style).toBe(before.style);
    expect(after.name).toBe(before.name?.replace('Marsh Imp', 'Marsh Imp the Elder'));
    expect(sheet.requests).toBe(2);
  });

  test('the dialog shows the last fetch time and the Google note for a URL pile', async ({ page }) => {
    await mockSheet(page, CARDS);
    await loadFromUrl(page);
    await results(page).getByRole('button', { name: 'Done' }).click();

    await openMenu(page);
    await page.getByRole('menuitem', { name: 'Load from URL…' }).click();
    await expect(urlField(page)).toHaveValue(SHEET);
    await expect(loadDialog(page)).toContainText('Last fetched');
    await expect(loadDialog(page)).toContainText('Google can take a few minutes');
    await closeWith(page, loadDialog(page), { focusOn: mainPile(page) });
  });
});

test.describe('CD-7 CD-9 load from a URL by mouse', () => {
  test('load, then Reload from URL from the pile menu', async ({ page }) => {
    const sheet = await mockSheet(page, CARDS);
    await loadFromUrl(page);
    await expect(results(page)).toContainText(FILE_NAME);
    await results(page).getByRole('button', { name: 'Done' }).click();

    sheet.text = CARDS_EDITED;
    await openMenu(page);
    await page.getByRole('menuitem', { name: 'Reload from URL' }).click();
    await expect(results(page)).toContainText('1 updated');
    expect(sheet.requests).toBe(2);
  });
});

test.describe('CD-8 edit links', () => {
  test('show the how-to and make no request', async ({ page }) => {
    const sheet = await mockSheet(page, CARDS);
    await loadFromUrl(page, EDIT_LINK);
    await expect(urlField(page)).toHaveAttribute('aria-invalid', 'true');
    const steps = loadDialog(page).getByRole('listitem');
    await expect(steps).toHaveCount(4);
    await expect(steps.first()).toContainText('File → Share → Publish to web');
    await expect(loadDialog(page)).toContainText('Comma-separated values (.csv)');
    const scan = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(scan.violations).toEqual([]);
    expect(sheet.requests).toBe(0);
    await closeWith(page, loadDialog(page));
  });
});

test.describe('CD-11 a failed fetch keeps the last good data', () => {
  test('a failed Reload reopens the dialog; a retry from it works', async ({ page }) => {
    const sheet = await mockSheet(page, CARDS);
    await loadFromUrl(page);
    await results(page).getByRole('button', { name: 'Done' }).click();

    sheet.status = 404;
    await openMenu(page);
    await page.getByRole('menuitem', { name: 'Reload from URL' }).click();
    await expect(loadDialog(page)).toBeVisible();
    await expect(urlField(page)).toHaveValue(SHEET);
    await expect(loadDialog(page)).toContainText('404');
    await expect(loadDialog(page)).toContainText('P1 main deck keeps its last good data.');
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 1 card, Player 1');
    const scan = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(scan.violations).toEqual([]);

    sheet.status = 200;
    sheet.text = CARDS_EDITED;
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await expect(results(page)).toContainText('1 updated');
    await expect(loadDialog(page)).toHaveCount(0);
  });

  test('a CSV with no cards is a failed fetch and nothing goes missing', async ({ page }) => {
    const sheet = await mockSheet(page, CARDS);
    await loadFromUrl(page);
    await results(page).getByRole('button', { name: 'Done' }).click();

    sheet.text = 'title,cost\nImp,2\n';
    await openMenu(page);
    await page.getByRole('menuitem', { name: 'Reload from URL' }).click();
    await expect(loadDialog(page)).toContainText('Missing name.');
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 1 card, Player 1');
    await expect(results(page)).toHaveCount(0);
  });

  test('a first load that fails shows the error and can be retried', async ({ page }) => {
    const sheet = await mockSheet(page, CARDS);
    sheet.status = 403;
    await loadFromUrl(page);
    await expect(loadDialog(page)).toContainText('may not be published');
    sheet.status = 200;
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await expect(results(page)).toContainText('1 card imported');
  });
});

test.describe('CD-11 playing offline from the saved copy', () => {
  test('the saved session reopens with the network blocked and keeps its URL', async ({ page }) => {
    await mockSheet(page, CARDS);
    await loadFromUrl(page);
    await results(page).getByRole('button', { name: 'Done' }).click();
    await expect.poll(async () => {
      const saved = (await storedSession(page)) as { state: { cardSets: Record<string, { source: { kind: string; url?: string } }> } } | undefined;
      return Object.values(saved?.state.cardSets ?? {})[0]?.source.url;
    }).toBe(SHEET);

    await page.unroute('https://docs.google.com/spreadsheets/**');
    let blocked = 0;
    await page.route('https://docs.google.com/**', (route) => {
      blocked++;
      return route.abort();
    });
    await page.reload();
    await expect(page.getByText('Loading your session…')).toHaveCount(0);
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 1 card, Player 1');
    expect(blocked).toBe(0);

    await openMenu(page);
    await page.getByRole('menuitem', { name: 'Reload from URL' }).click();
    await expect(loadDialog(page)).toContainText("Couldn't reach that address");
    await expect(loadDialog(page)).toContainText('keeps its last good data');
    await expect(mainPile(page)).toHaveAccessibleName('P1 main deck, 1 card, Player 1');
  });
});

test.describe('CD-7 on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the dialog fits, its footer stays visible and a long URL does not scroll the page', async ({ page }) => {
    await mockSheet(page, CARDS);
    await openMenu(page);
    await page.getByRole('menuitem', { name: 'Load from URL…' }).click();
    // An edit link adds the how-to, the tallest the dialog gets.
    await urlField(page).fill(EDIT_LINK + '&' + 'y'.repeat(400));
    await page.getByRole('button', { name: 'Load', exact: true }).click();

    const dialog = loadDialog(page);
    await expect(dialog.getByRole('listitem')).toHaveCount(4);
    await expect(dialog.getByRole('button', { name: 'Load', exact: true })).toBeInViewport();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport();
    const box = await dialog.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
    expect(box?.height).toBeLessThanOrEqual(667);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const dialogOverflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(dialogOverflow).toBeLessThanOrEqual(0);
  });
});
