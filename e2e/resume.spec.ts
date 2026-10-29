import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { tabTo } from './keyboard';

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const status = (page: Page) => page.getByRole('status');
const hand = (page: Page) => page.getByRole('region', { name: "Player 1's hand" });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const life = (page: Page) => page.getByRole('group', { name: 'Player 1 Life' });
const zoomButton = (page: Page) => page.getByRole('button', { name: /^Zoom \d+%, reset$/ });
const snapButton = (page: Page) => page.getByRole('button', { name: 'Snap to grid (G)' });
const sessionButton = (page: Page) => page.getByRole('button', { name: 'This session' });
const seat = (page: Page, name: string) => page.getByRole('region', { name: 'Seats' }).getByRole('button', { name: new RegExp(`^${name}, `) });

async function loadDeck(page: Page) {
  await mainPile(page).click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(fixture('double-faced.csv'));
  await page.getByRole('dialog', { name: 'Import results' }).getByRole('button', { name: 'Done' }).click();
}

/** Autosave waits up to a second after a change; leave time for it before a reload. */
async function reload(page: Page) {
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
}

test.describe('PS-2 Resume', () => {
  test('keyboard: play a few moves, reload, and the same session is back with an empty undo', async ({ page }) => {
    await loadDeck(page);
    await expect(mainPile(page)).toBeFocused();
    await page.keyboard.press('d');
    await expect(status(page)).toHaveText('Player 1 drew Daylight Hunter from P1 main deck. 3 cards left.');
    await page.keyboard.press('d');
    await expect(status(page)).toHaveText('Player 1 drew Daylight Hunter from P1 main deck. 2 cards left.');
    await tabTo(page, hand(page).locator('.hand-tray__card-button[tabindex="0"]'));
    await page.keyboard.press('p');
    await expect(status(page)).toHaveText("Moved Daylight Hunter from Player 1's hand to the table.");

    await tabTo(page, page.getByRole('button', { name: 'Decrease Player 1 Life' }), { backwards: true });
    await page.keyboard.press('Enter');
    await expect(life(page)).toContainText('19');

    const dice = page.getByRole('button', { name: 'Dice & coins' });
    await dice.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // Roll d20
    await expect(status(page)).toHaveText(/^Rolled d20: \d+\.$/);
    await page.keyboard.press('Escape');

    const zoomIn = page.getByRole('button', { name: 'Zoom in (+)' });
    await zoomIn.focus();
    await page.keyboard.press('Enter');
    await expect(zoomButton(page)).toHaveText('110%');
    await snapButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(snapButton(page)).toHaveAttribute('aria-pressed', 'true');

    // Switch seat last, so the active seat is the one to come back.
    await seat(page, 'Environment').focus();
    await page.keyboard.press('Enter');
    await expect(seat(page, 'Environment')).toHaveAccessibleName('Environment, active seat');

    await reload(page);

    await expect(seat(page, 'Environment')).toHaveAccessibleName('Environment, active seat');
    await seat(page, 'Player 1').click();
    await expect(hand(page).getByRole('list')).toHaveAccessibleName(/^Player 1's hand, 1 card\./);
    await expect(table(page).getByRole('button', { name: /^Daylight Hunter/ })).toHaveCount(1);
    await expect(mainPile(page)).toHaveAccessibleName(/2 cards/);
    await expect(life(page)).toContainText('19');
    await expect(zoomButton(page)).toHaveText('110%');
    await expect(snapButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Undo \(Ctrl\+Z\)/ })).toHaveAccessibleName('Undo (Ctrl+Z), nothing to undo');

    await sessionButton(page).click();
    await page.getByRole('menuitem', { name: 'Session log' }).click();
    await expect(page.getByRole('dialog', { name: 'Session log' }).getByRole('listitem')).toHaveCount(1);
    await expect(page.getByRole('dialog', { name: 'Session log' }).getByRole('listitem').first()).toContainText(/Rolled d20: \d+/);
  });

  test('mouse: New session… then reload opens the new session, with no axe violations', async ({ page }) => {
    await loadDeck(page);
    await sessionButton(page).click();
    await page.getByRole('menuitem', { name: 'New session…' }).click();
    await page.getByRole('radio', { name: /^1v1 PvP/ }).check();
    await page.getByRole('button', { name: 'Start session' }).click();
    await page.getByRole('button', { name: 'Start new session' }).click();
    await expect(page.getByRole('banner')).toContainText('1v1 PvP');
    await reload(page);
    await expect(page.getByRole('banner')).toContainText('1v1 PvP');
    await expect(mainPile(page)).toHaveAccessibleName(/0 cards|empty/);
    // The old session item is gone: exactly one session is saved.
    const sessions = await page.evaluate(async () => {
      const open = indexedDB.open('keyval-store');
      const db = await new Promise<IDBDatabase>((resolve) => (open.onsuccess = () => resolve(open.result)));
      const request = db.transaction('keyval').objectStore('keyval').getAllKeys();
      const keys = await new Promise<IDBValidKey[]>((resolve) => (request.onsuccess = () => resolve(request.result)));
      return keys.filter((key) => String(key).includes('|session|')).length;
    });
    expect(sessions).toBe(1);
    expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
  });

  test('PS-6 when the browser can’t save, the app still works', async ({ page }) => {
    await page.addInitScript(() => {
      indexedDB.open = () => {
        throw new DOMException('blocked', 'SecurityError');
      };
    });
    await page.reload();
    await expect(page.getByRole('note')).toContainText('progress won’t be saved');
    await expect(page.getByText('Loading your session…')).toHaveCount(0);
    await mainPile(page).click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Load CSV…' })).toBeVisible();
  });
});

test.describe('PS-2 Resume on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('a reload restores the session with no sideways scrolling', async ({ page }) => {
    await loadDeck(page);
    await hand(page).getByRole('button', { name: 'Draw' }).click();
    await reload(page);
    await expect(hand(page).getByRole('list')).toHaveAccessibleName(/^Player 1's hand, 1 card\./);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('the loading overlay fits the screen and blocks the app', async ({ page }) => {
    await page.route('**/*', (route) => route.continue());
    await page.addInitScript(() => {
      const open = indexedDB.open.bind(indexedDB);
      indexedDB.open = (...args) => {
        const request = open(...args);
        // Hold the storage check back so the overlay stays up.
        Object.defineProperty(request, 'result', { get: () => new Promise(() => {}) });
        return request;
      };
    });
    await page.reload();
    const overlay = page.getByRole('status').filter({ hasText: 'Loading your session…' });
    await expect(overlay).toBeVisible();
    const box = await overlay.boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, width: 375, height: 667 });
    expect(await page.evaluate(() => document.querySelector('.session-shell')?.hasAttribute('inert'))).toBe(true);
  });
});
