import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { storedKinds } from './bundleSetup';
import { closeWith, tabTo } from './keyboard';
import { storedSession } from './storage';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SHEET = 'https://docs.google.com/spreadsheets/d/e/2PACX-invented-phase7/pub?gid=0&single=true&output=csv';

/** A double-faced Marsh Imp (front and back) and two Bog Rats. */
const CARDS = 'id,name,back_of,qty,type\nimp,Marsh Imp,,1,Creature\nimp-b,Marsh Imp Night,imp,,Creature\nrat,Bog Rat,,2,Creature\n';
const CARDS_EDITED = CARDS.replace('Marsh Imp Night', 'Marsh Imp Night the Elder');

interface Sheet {
  text: string;
  status: number;
}

/** Mocks every response of the sheet address, so nothing reaches Google. */
async function mockSheet(page: Page): Promise<Sheet> {
  const sheet: Sheet = { text: CARDS, status: 200 };
  await page.route('https://docs.google.com/spreadsheets/**', (route) =>
    route.fulfill({
      status: sheet.status,
      headers: { 'content-type': 'text/csv; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Disposition' },
      body: sheet.text,
    }),
  );
  return sheet;
}

type By = 'mouse' | 'keyboard';

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const envPile = (page: Page) => page.getByRole('button', { name: /^Environment deck,/ });
const status = (page: Page) => page.locator('.visually-hidden[role="status"]');
const hand = (page: Page) => page.getByRole('region', { name: "Player 1's hand" });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const tableCard = (page: Page) => table(page).locator('.table-card__button');
const life = (page: Page) => page.getByRole('group', { name: 'Player 1 Life' });
const undoButton = (page: Page) => page.getByRole('button', { name: /^Undo \(Ctrl\+Z\)/ });
const sessionButton = (page: Page) => page.getByRole('button', { name: 'This session' });
const results = (page: Page) => page.getByRole('dialog', { name: 'Import results' });
const urlDialog = (page: Page) => page.getByRole('dialog', { name: 'Load from URL' });

/** Chooses a pile menu item: right-click and click, or Enter on the pile and Enter on the item. */
async function pileMenu(page: Page, pile: Locator, item: string, by: By, firstToggle?: string) {
  if (by === 'mouse') {
    await pile.click({ button: 'right' });
    if (firstToggle) await page.getByRole('menuitemcheckbox', { name: firstToggle }).click();
    await page.getByRole('menuitem', { name: item }).click();
  } else {
    // A late focus return from a closed dialog can take the focus back, so try until the menu is open.
    await expect(async () => {
      await page.keyboard.press('Escape');
      await pile.focus();
      await expect(pile).toBeFocused({ timeout: 500 });
      await page.keyboard.press('Enter');
      await expect(page.getByRole('menu', { name: /^Actions for / })).toBeVisible({ timeout: 1000 });
    }).toPass();
    if (firstToggle) {
      // A checkbox item leaves the menu open.
      await page.getByRole('menuitemcheckbox', { name: firstToggle }).focus();
      await page.keyboard.press('Enter');
    }
    await page.getByRole('menuitem', { name: item }).focus();
    await page.keyboard.press('Enter');
  }
}

async function closeResults(page: Page, pile: Locator, by: By) {
  await expect(results(page)).toContainText('cards imported');
  if (by === 'mouse') await results(page).getByRole('button', { name: 'Done' }).click();
  else await closeWith(page, results(page), { focusOn: pile });
  await expect(results(page)).toHaveCount(0);
}

/** The cards of a pile, top first, read through the pile viewer. */
async function pileOrder(page: Page, pile: Locator, name: string, by: By) {
  await pileMenu(page, pile, 'View cards…', by);
  const viewer = page.getByRole('dialog', { name });
  const labels = await viewer.getByRole('button', { name: /from top$/ }).evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label')));
  await closeWith(page, viewer, { focusOn: pile });
  return labels;
}

/** Everything on screen that the save has to bring back. */
async function onScreen(page: Page) {
  const box = tableCard(page).locator('xpath=ancestor::*[contains(@class,"table-card ")][1]');
  return {
    cardAt: await box.evaluate((el) => [(el as HTMLElement).style.left, (el as HTMLElement).style.top]),
    cardName: await tableCard(page).getAttribute('aria-label'),
    handList: await hand(page).getByRole('list').getAttribute('aria-label'),
    handCards: await hand(page).locator('.hand-tray__card-button').evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label'))),
    life: await life(page).innerText(),
    main: await pileOrder(page, mainPile(page), 'P1 main deck', 'mouse'),
    env: await pileOrder(page, envPile(page), 'Environment deck', 'mouse'),
    pileNames: [await mainPile(page).getAttribute('aria-label'), await envPile(page).getAttribute('aria-label')],
    undo: await undoButton(page).getAttribute('aria-label'),
    roll: await readLog(page),
  };
}

async function readLog(page: Page) {
  await sessionButton(page).click();
  await page.getByRole('menuitem', { name: 'Session log' }).click();
  const log = page.getByRole('dialog', { name: 'Session log' });
  const rolls = await log.getByRole('listitem').allInnerTexts();
  await closeWith(page, log, { focusOn: sessionButton(page) });
  return rolls.map((text) => text.match(/Rolled d20: \d+/)?.[0]);
}

/** Loads a CSV deck into P1 main deck (CSV order) and the mocked sheet into Environment deck. */
async function loadPiles(page: Page, by: By) {
  const chooser = page.waitForEvent('filechooser');
  await pileMenu(page, mainPile(page), 'Load CSV…', by, 'Keep CSV order');
  await (await chooser).setFiles(fixture('double-faced.csv'));
  await closeResults(page, mainPile(page), by);

  await pileMenu(page, envPile(page), 'Load from URL…', by);
  const field = page.getByRole('textbox', { name: 'Published CSV address' });
  if (by === 'mouse') {
    await field.fill(SHEET);
    await page.getByRole('button', { name: 'Load', exact: true }).click();
  } else {
    await expect(field).toBeFocused();
    await page.keyboard.type(SHEET);
    await page.keyboard.press('Enter');
  }
  await expect(results(page)).toContainText('2 cards imported');
  await closeResults(page, envPile(page), by);
  await expect(envPile(page)).toHaveAccessibleName(/^Environment deck, 3 cards,/);
}

/** Draws two cards, puts Marsh Imp on the table, moves it, turns it over and round, and gives it a counter. */
async function play(page: Page, by: By) {
  if (by === 'mouse') {
    for (let i = 0; i < 2; i++) await hand(page).getByRole('button', { name: 'Draw' }).click();
  } else {
    await mainPile(page).focus();
    for (let i = 0; i < 2; i++) await page.keyboard.press('d');
  }
  await expect(hand(page).getByRole('list')).toHaveAccessibleName(/^Player 1's hand, 2 cards\./);

  // To the table, through the pile viewer.
  await pileMenu(page, envPile(page), 'View cards…', by);
  const viewer = page.getByRole('dialog', { name: 'Environment deck' });
  if (by === 'mouse') {
    await viewer.getByRole('button', { name: /^Marsh Imp\. / }).click();
    await viewer.getByRole('button', { name: 'To table: Marsh Imp' }).click();
  } else {
    await page.keyboard.type('Marsh');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('t');
  }
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(tableCard(page)).toHaveAccessibleName('Marsh Imp, front face');

  // Move it.
  const before = await tableCard(page).boundingBox();
  if (by === 'mouse') {
    const area = await page.locator('.table-viewport').boundingBox();
    if (!before || !area) throw new Error('Not on screen');
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(area.x + 520, area.y + area.height / 2, { steps: 8 });
    await page.mouse.up();
  } else {
    await tableCard(page).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
  }
  await expect(status(page)).toHaveText('Moved Marsh Imp on the table.');
  expect(await tableCard(page).boundingBox()).not.toEqual(before);

  // Flip it to its back, rotate it, add a counter.
  const act = async (item: string, key: string) => {
    if (by === 'mouse') {
      await tableCard(page).click();
      await page.getByRole('button', { name: /^Actions for Marsh Imp/ }).click();
      await page.getByRole('menuitem', { name: item }).click();
    } else {
      await tableCard(page).focus();
      await page.keyboard.press(key);
    }
  };
  await act('Flip to back', 'f');
  await act('Rotate 90° clockwise', 'r');
  await expect(tableCard(page)).toHaveAccessibleName('Marsh Imp Night, back face, rotated 90°');
  await act('Counters…', 'c');
  const counters = page.getByRole('dialog', { name: 'Counters on Marsh Imp Night' });
  if (by === 'mouse') {
    await counters.getByRole('textbox', { name: 'New counter name' }).fill('Damage');
    await counters.getByRole('button', { name: 'Add counter' }).click();
    await counters.getByRole('button', { name: 'Done' }).click();
  } else {
    await page.keyboard.type('Damage');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
  }
  await expect(counters).toBeHidden();
  await expect(tableCard(page)).toHaveAccessibleName('Marsh Imp Night, back face, rotated 90°, counters: Damage 1');

  // A roll for the log, a shuffle, and last a seat counter.
  await sessionButton(page).focus();
  const dice = page.getByRole('button', { name: 'Dice & coins' });
  await dice.click();
  await page.getByRole('button', { name: 'Roll d20' }).click();
  await expect(status(page)).toHaveText(/^Rolled d20: \d+\.$/);
  await page.getByRole('dialog', { name: 'Dice & coins' }).getByRole('button', { name: 'Done' }).click();

  await pileMenu(page, mainPile(page), 'Shuffle', by);
  await expect(status(page)).toHaveText('Shuffled P1 main deck. 2 cards.');
  const decrease = page.getByRole('button', { name: 'Decrease Player 1 Life' });
  if (by === 'mouse') await decrease.click();
  else {
    await tabTo(page, decrease, { backwards: true });
    await page.keyboard.press('Enter');
  }
  await expect(life(page)).toContainText('19');
}

/** Reloads once the stored session has the last change. */
async function reload(page: Page) {
  await expect
    .poll(async () => JSON.stringify(((await storedSession(page)) as { state: { seats: unknown[] } } | undefined)?.state.seats ?? []).includes('"value":19'))
    .toBe(true);
  await page.reload();
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
}

/** The whole phase: play, reload and find it all, then edit the sheet and fail a fetch. */
async function phase7(page: Page, by: By) {
  const sheet = await mockSheet(page);
  await page.goto('./');
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
  await loadPiles(page, by);
  await play(page, by);
  const before = await onScreen(page);
  expect(before.roll).toHaveLength(1);

  await reload(page);
  expect(await onScreen(page)).toEqual(before);
  // Undo and redo still work from the saved history.
  await undoButton(page).click();
  await expect(status(page)).toHaveText(/^Undone: /);
  await page.getByRole('button', { name: /^Redo/ }).click();
  await expect(status(page)).toHaveText(/^Redone: /);
  await expect(life(page)).toContainText('19');
  // Separate items: one session, a card set for each pile, nothing else of ours.
  expect(await storedKinds(page)).toMatchObject({ session: 1, cardSet: 2 });

  // The sheet is edited, then Reload from URL: the card changes where it is, still turned over.
  sheet.text = CARDS_EDITED;
  await pileMenu(page, envPile(page), 'Reload from URL', by);
  await expect(results(page)).toContainText('2 updated');
  await closeResults(page, envPile(page), by);
  const edited = await onScreen(page);
  expect(edited.cardName).toBe('Marsh Imp Night the Elder, back face, rotated 90°, counters: Damage 1');
  expect(edited.cardAt).toEqual(before.cardAt);

  // The next fetch fails: the error shows and the last good data stays.
  sheet.status = 500;
  await pileMenu(page, envPile(page), 'Reload from URL', by);
  await expect(urlDialog(page)).toContainText('Environment deck keeps its last good data.');
  await expect(tableCard(page)).toHaveAccessibleName(edited.cardName ?? '');
  await expect(envPile(page)).toHaveAccessibleName(/^Environment deck, 2 cards,/);
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
}

test.describe('Phase 7: save, reload and sheets', () => {
  test('mouse', async ({ page }) => {
    await phase7(page, 'mouse');
  });

  test('keyboard only', async ({ page }) => {
    await phase7(page, 'keyboard');
  });
});
