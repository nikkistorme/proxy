import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { closeWith, tabTo } from './keyboard';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const A = 'https://docs.google.com/spreadsheets/d/e/2PACX-invented-main/pub?gid=0&single=true&output=csv';
const B = 'https://docs.google.com/spreadsheets/d/e/2PACX-invented-env/pub?gid=0&single=true&output=csv';
const EDIT_LINK = 'https://docs.google.com/spreadsheets/d/invented-main/edit?usp=sharing';

/** What each mocked sheet answers. Tests change `text` or `status` between fetches. */
interface Sheet {
  text: string;
  status: number;
  requests: number;
}

/** Mocks both sheets, shaped like real published ones: `text/csv`, open CORS. Nothing reaches Google. */
async function mockSheets(page: Page, texts: { main: string; env: string }) {
  const sheets: Record<'main' | 'env', Sheet> = {
    main: { text: texts.main, status: 200, requests: 0 },
    env: { text: texts.env, status: 200, requests: 0 },
  };
  await page.route('https://docs.google.com/spreadsheets/**', (route) => {
    const sheet = route.request().url().includes('invented-main') ? sheets.main : sheets.env;
    sheet.requests++;
    return route.fulfill({
      status: sheet.status,
      headers: { 'content-type': 'text/csv; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Disposition', 'cache-control': 'private, max-age=300' },
      body: sheet.text,
    });
  });
  return sheets;
}

const MAIN = 'id,name,qty,type\nimp-1,Marsh Imp,1,Creature\n';
const MAIN_EDITED = 'id,name,qty,type\nimp-1,Marsh Imp the Elder,1,Creature\n';
const ENV = 'id,name,qty,type\nstorm-1,Gathering Storm,2,Event\n';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
});

const sessionButton = (page: Page) => page.getByRole('button', { name: 'This session' });
const setup = (page: Page) => page.getByRole('dialog', { name: 'New session' });
const formats = (page: Page) => page.getByRole('dialog', { name: 'Formats' });
const results = (page: Page) => page.getByRole('dialog', { name: 'Sheet results' });
const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const envPile = (page: Page) => page.getByRole('button', { name: /^Environment deck,/ });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });

/** Opens the editor on a copy of Solo PvE, sets the two sheet URLs and returns to the setup dialog with the copy chosen. */
async function makeFormat(page: Page, urls: { main: string; env?: string }) {
  await sessionButton(page).click();
  await page.getByRole('menuitem', { name: 'New session…' }).click();
  await page.getByRole('button', { name: 'Edit a copy of Solo PvE' }).click();
  await page.getByRole('textbox', { name: 'Pile 1 sheet URL' }).fill(urls.main);
  if (urls.env) await page.getByRole('textbox', { name: 'Pile 2 sheet URL' }).fill(urls.env);
  await page.keyboard.press('Escape'); // to the list
  await page.keyboard.press('Escape'); // back to the setup dialog
  await expect(setup(page)).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Solo PvE copy/ })).toBeChecked();
}

async function startSession(page: Page) {
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(setup(page)).toHaveCount(0);
}

async function reloadAll(page: Page) {
  await sessionButton(page).click();
  await page.getByRole('menuitem', { name: 'Reload all' }).click();
}

/** Puts the main deck's one card on the table: draw it, then place it from the hand by keyboard. */
async function putCardOnTable(page: Page) {
  await mainPile(page).focus();
  await page.keyboard.press('d');
  await page.getByRole('region', { name: "Player 1's hand" }).locator('.hand-tray__card-button[tabindex="0"]').focus();
  await page.keyboard.press('p');
  await expect(table(page).getByRole('button', { name: /^Marsh Imp/ })).toHaveCount(1);
}

test.describe('CD-12 default sheet URLs, by keyboard', () => {
  test('start a session from a format with two sheets, Reload all, and a failed sheet keeps its data', async ({ page }) => {
    const sheets = await mockSheets(page, { main: MAIN, env: ENV });

    // Set the two URLs by keyboard in the editor.
    await tabTo(page, sessionButton(page));
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // New session…
    await tabTo(page, page.getByRole('button', { name: 'Edit a copy of Solo PvE' }));
    await page.keyboard.press('Enter');
    const first = page.getByRole('textbox', { name: 'Pile 1 sheet URL' });
    await tabTo(page, first);
    await page.keyboard.type(A);
    await expect(first).toHaveValue(A);
    const second = page.getByRole('textbox', { name: 'Pile 2 sheet URL' });
    await tabTo(page, second);
    await page.keyboard.type(B);
    // An edit link is refused with the publish steps, and the saved value stays.
    const third = page.getByRole('textbox', { name: 'Pile 3 sheet URL' });
    await tabTo(page, third);
    await page.keyboard.type(EDIT_LINK);
    await expect(third).toHaveAttribute('aria-invalid', 'true');
    await expect(formats(page).getByText('To load a Google Sheet, publish it as CSV:')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await expect(third).toHaveAttribute('aria-invalid', 'false');
    expect((await new AxeBuilder({ page }).include('.layout-editor').withTags(axeTags).analyze()).violations).toEqual([]);
    expect(sheets.main.requests + sheets.env.requests).toBe(0);

    await closeWith(page, page.getByRole('heading', { name: 'Solo PvE copy' }));
    await page.keyboard.press('Escape');
    await expect(setup(page)).toBeVisible();
    await page.getByRole('button', { name: 'Start session' }).focus();
    await page.keyboard.press('Enter');

    // Both piles load at once, and a clean start only announces.
    await expect(mainPile(page)).toHaveAccessibleName(/^P1 main deck, 1 card,/);
    await expect(envPile(page)).toHaveAccessibleName(/^Environment deck, 2 cards,/);
    await expect(results(page)).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Loaded 2 of 2 sheets.' })).toHaveCount(1);
    await expect(page.locator('.table-surface')).toBeFocused();

    // A card in play is updated in place by Reload all, without moving.
    await putCardOnTable(page);
    const card = table(page).getByRole('button', { name: /^Marsh Imp/ });
    const before = await card.boundingBox();
    const cardId = await card.locator('xpath=ancestor-or-self::*[@data-card-id]').first().getAttribute('data-card-id');
    sheets.main.text = MAIN_EDITED;

    await tabTo(page, sessionButton(page), { backwards: true, max: 60 });
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'Reload all' }).focus();
    await page.keyboard.press('Enter');
    await expect(results(page)).toBeVisible();
    await expect(results(page)).toContainText('Reloaded 2 of 2 sheets');
    await expect(results(page)).toContainText('P1 main deck');
    await expect(results(page)).toContainText('Environment deck');
    expect((await new AxeBuilder({ page }).include('dialog[open]').withTags(axeTags).analyze()).violations).toEqual([]);
    await closeWith(page, results(page), { focusOn: sessionButton(page) });
    const moved = table(page).getByRole('button', { name: /^Marsh Imp the Elder/ });
    await expect(moved).toHaveCount(1);
    expect(await moved.boundingBox()).toEqual(before);
    expect(await moved.locator('xpath=ancestor-or-self::*[@data-card-id]').first().getAttribute('data-card-id')).toBe(cardId);

    // One sheet fails: the results list it and its pile keeps the last good data.
    sheets.env.status = 404;
    await reloadAll(page);
    await expect(results(page)).toContainText('Reloaded 1 of 2 sheets');
    await expect(results(page)).toContainText('Environment deck keeps its last good data.');
    await expect(results(page)).toContainText('The server answered 404');
    await closeWith(page, results(page), { focusOn: sessionButton(page) });
    await expect(envPile(page)).toHaveAccessibleName(/^Environment deck, 2 cards,/);
  });

  test('undo reverts Reload all in one step', async ({ page }) => {
    const sheets = await mockSheets(page, { main: MAIN, env: ENV });
    await makeFormat(page, { main: A, env: B });
    await startSession(page);
    await expect(mainPile(page)).toHaveAccessibleName(/^P1 main deck, 1 card,/);
    sheets.main.text = 'id,name,qty,type\nimp-1,Marsh Imp,3,Creature\n';
    sheets.env.text = 'id,name,qty,type\nstorm-1,Gathering Storm,1,Event\n';
    await reloadAll(page);
    await expect(results(page)).toBeVisible();
    await closeWith(page, results(page));
    await expect(mainPile(page)).toHaveAccessibleName(/^P1 main deck, 3 cards,/);
    await expect(envPile(page)).toHaveAccessibleName(/^Environment deck, 1 card,/);
    await page.locator('.table-surface').focus();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(mainPile(page)).toHaveAccessibleName(/^P1 main deck, 1 card,/);
    await expect(envPile(page)).toHaveAccessibleName(/^Environment deck, 2 cards,/);
  });
});

test.describe('CD-12 a sheet that fails at the start', () => {
  test('shows a warning on its empty pile, opens the results, and retry through Load from URL… clears it', async ({ page }) => {
    const sheets = await mockSheets(page, { main: MAIN, env: ENV });
    sheets.env.status = 404;
    await makeFormat(page, { main: A, env: B });
    await startSession(page);

    await expect(results(page)).toBeVisible();
    await expect(results(page)).toContainText('Loaded 1 of 2 sheets');
    await expect(results(page)).toContainText('The server answered 404');
    await expect(mainPile(page)).toHaveAccessibleName(/^P1 main deck, 1 card,/);
    await closeWith(page, results(page), { focusOn: page.locator('.table-surface') });

    const failed = page.getByRole('button', { name: /^Environment deck, empty, couldn't load: .*404/ });
    await expect(failed).toBeVisible();
    await expect(page.locator('.pile-tile__warning')).toHaveCount(1);

    sheets.env.status = 200;
    await failed.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Load from URL…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Load from URL' });
    await expect(dialog.getByRole('textbox', { name: 'Published CSV address' })).toHaveValue(B);
    await expect(dialog).toContainText('The server answered 404');
    await dialog.getByRole('button', { name: 'Load', exact: true }).click();
    await page.getByRole('dialog', { name: 'Import results' }).getByRole('button', { name: 'Done' }).click();
    await expect(envPile(page)).toHaveAccessibleName(/^Environment deck, 2 cards,/);
    await expect(page.locator('.pile-tile__warning')).toHaveCount(0);
  });

  test('Reload all retries it too', async ({ page }) => {
    const sheets = await mockSheets(page, { main: MAIN, env: ENV });
    sheets.env.status = 500;
    await makeFormat(page, { main: A, env: B });
    await startSession(page);
    await page.getByRole('dialog', { name: 'Sheet results' }).getByRole('button', { name: 'Done' }).click();
    sheets.env.status = 200;
    await reloadAll(page);
    await expect(results(page)).toContainText('Reloaded 2 of 2 sheets');
    await results(page).getByRole('button', { name: 'Done' }).click();
    await expect(envPile(page)).toHaveAccessibleName(/^Environment deck, 2 cards,/);
  });
});

test.describe('CD-12 by mouse', () => {
  test('the format field, the start and Reload all', async ({ page }) => {
    const sheets = await mockSheets(page, { main: MAIN, env: ENV });
    await makeFormat(page, { main: A });
    await startSession(page);
    await expect(mainPile(page)).toHaveAccessibleName(/^P1 main deck, 1 card,/);
    await expect(envPile(page)).toHaveAccessibleName(/^Environment deck, empty,/);
    sheets.main.text = MAIN_EDITED;
    await reloadAll(page);
    await expect(results(page)).toContainText('Reloaded 1 of 1 sheet');
    await results(page).getByRole('button', { name: 'Done' }).click();
    await expect(sessionButton(page)).toBeFocused();
    // Without a URL pile the item is hidden (UI-4).
    await sessionButton(page).click();
    await page.getByRole('menuitem', { name: 'New session…' }).click();
    await page.getByRole('radio', { name: /^Co-op PvE/ }).check();
    await page.getByRole('button', { name: 'Start session' }).click();
    await page.getByRole('button', { name: 'Start new session' }).click();
    await expect(page.getByRole('banner')).toContainText('Co-op PvE');
    await sessionButton(page).click();
    await expect(page.getByRole('menuitem', { name: 'New session…' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Reload all' })).toHaveCount(0);
  });
});

test.describe('CD-12 on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the editor field with a long URL and the results dialog fit, with the footer visible', async ({ page }) => {
    const sheets = await mockSheets(page, { main: MAIN, env: ENV });
    sheets.env.status = 404;
    const long = A + '&x=' + 'y'.repeat(400);
    await sessionButton(page).click();
    await page.getByRole('menuitem', { name: 'New session…' }).click();
    await page.getByRole('button', { name: 'Edit a copy of Solo PvE' }).click();
    await page.getByRole('textbox', { name: 'Pile 1 sheet URL' }).fill(long);
    await page.getByRole('textbox', { name: 'Pile 2 sheet URL' }).fill(B);
    await page.getByRole('textbox', { name: 'Pile 3 sheet URL' }).fill(EDIT_LINK + '&' + 'z'.repeat(300));
    await expect(formats(page).getByRole('listitem').filter({ hasText: 'In the sheet, choose' })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    const body = formats(page).locator('.layout-editor__body');
    expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Back to formats' })).toBeInViewport();

    await page.getByRole('textbox', { name: 'Pile 3 sheet URL' }).fill('');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await startSession(page);
    const dialog = results(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Done' })).toBeInViewport();
    const box = await dialog.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
    expect(box?.height).toBeLessThanOrEqual(667);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  });
});
