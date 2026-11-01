import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { closeWith, tabTo } from './keyboard';
import { storedSession } from './storage';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const ANNOUNCEMENT = 'Demo loaded: Co-op PvE session with 86 cards in 4 piles. Player 1 is the active seat.';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
});

const sessionButton = (page: Page) => page.getByRole('button', { name: 'This session' });
const setup = (page: Page) => page.getByRole('dialog', { name: 'New session' });
const confirm = (page: Page) => page.getByRole('dialog', { name: 'Load the demo?' });
const header = (page: Page) => page.getByRole('banner');
const loadDemo = (page: Page) => setup(page).getByRole('button', { name: 'Load demo' });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const p1Pile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });

async function openSetup(page: Page) {
  await sessionButton(page).click();
  await page.getByRole('menuitem', { name: 'New session…' }).click();
  await expect(setup(page)).toBeVisible();
}

/** Every stored item of one kind, by id. */
async function stored(page: Page, kind: string): Promise<Record<string, unknown>> {
  return page.evaluate(
    (wanted) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const store = open.result.transaction('keyval').objectStore('keyval');
          const keys = store.getAllKeys();
          keys.onsuccess = () => {
            const values = store.getAll();
            values.onsuccess = () => {
              const found: Record<string, unknown> = {};
              keys.result.forEach((key, i) => {
                const [, , itemKind, id] = String(key).split('|');
                if (itemKind === wanted && id) found[id] = values.result[i];
              });
              open.result.close();
              resolve(found);
            };
          };
          keys.onerror = () => reject(keys.error);
        };
      }),
    kind,
  );
}

/** Replaces a stored layout, as an edit saved in an earlier visit would have. */
async function editStoredLayout(page: Page, id: string, edit: Record<string, unknown>) {
  await page.evaluate(
    ({ id: layoutId, edit: changes }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          const store = tx.objectStore('keyval');
          const key = `/proxy/|guest|layout|${layoutId}`;
          const got = store.get(key);
          got.onsuccess = () => store.put({ ...got.result, ...changes }, key);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    { id, edit },
  );
}

async function expectDemoOnTheTable(page: Page) {
  await expect(header(page)).toContainText('Co-op PvE');
  await expect(page.getByRole('status').filter({ hasText: /^Demo loaded/ })).toHaveText(ANNOUNCEMENT);
  await expect(page.locator('.table-surface')).toBeFocused();
  await expect(page.getByRole('button', { name: /^P1 main deck, 30 cards/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^P2 main deck, 30 cards/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Environment deck, 20 cards/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Board cards, 6 cards/ })).toBeVisible();
}

/** Puts the top card of the board pile on the table, where its layout and art are drawn. */
async function boardCardToTable(page: Page) {
  await page.getByRole('button', { name: /^Board cards,/ }).focus();
  await page.keyboard.press('v');
  const viewer = page.getByRole('dialog', { name: 'Board cards' });
  await viewer.getByRole('button', { name: /^To table/ }).first().click();
  await closeWith(page, viewer);
}

test.describe('DM-5 Load demo', () => {
  test('mouse: one click fills the four piles, focuses the table, and the art loads', async ({ page }) => {
    await openSetup(page);
    const results = await new AxeBuilder({ page }).include('dialog').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await expect(setup(page).getByText('Try a sample Co-op PvE game')).toBeVisible();
    await loadDemo(page).click();
    await expect(setup(page)).toHaveCount(0);
    await expectDemoOnTheTable(page);
    await boardCardToTable(page);
    const image = table(page).locator('img.card-art').first();
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    const after = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(after.violations).toEqual([]);
  });

  test('keyboard only: Load demo by Tab and Enter, focus on the table', async ({ page }) => {
    await tabTo(page, sessionButton(page));
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // New session…, the first item
    await expect(setup(page)).toBeVisible();
    await tabTo(page, loadDemo(page));
    await page.keyboard.press('Enter');
    await expect(setup(page)).toHaveCount(0);
    await expectDemoOnTheTable(page);
  });

  test('a session with cards asks first; Back keeps it, Load demo replaces it; Escape closes', async ({ page }) => {
    await p1Pile(page).click({ button: 'right' });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
    await (await chooser).setFiles({ name: 'deck.csv', mimeType: 'text/csv', buffer: Buffer.from('name\nTroll\nGoblin\n') });
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(p1Pile(page)).toHaveAccessibleName(/2 cards/);

    await openSetup(page);
    await loadDemo(page).click();
    await expect(confirm(page)).toContainText('Load the demo? The cards in this session will be cleared.');
    await expect(header(page)).toContainText('Solo PvE');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(confirm(page)).toHaveCount(0);
    await expect(loadDemo(page)).toBeVisible();
    await loadDemo(page).click();
    await closeWith(page, confirm(page), { focusOn: sessionButton(page) });
    await expect(header(page)).toContainText('Solo PvE');

    await openSetup(page);
    await loadDemo(page).click();
    await confirm(page).getByRole('button', { name: 'Load demo' }).click();
    await expect(confirm(page)).toHaveCount(0);
    await expectDemoOnTheTable(page);
  });

  test('undo leaves an empty Co-op PvE session', async ({ page }) => {
    await openSetup(page);
    await loadDemo(page).click();
    await expectDemoOnTheTable(page);
    await page.getByRole('button', { name: /^Undo/ }).click();
    await expect(header(page)).toContainText('Co-op PvE');
    await expect(page.getByRole('button', { name: /^P1 main deck, 0 cards|^P1 main deck, empty/ })).toBeVisible();
  });

  test('the demo chunk is requested after the click, not at page load', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      if (/demoData|emberguard|layouts-/i.test(request.url())) requested.push(request.url());
    });
    await page.reload();
    await expect(page.getByText('Loading your session…')).toHaveCount(0);
    await openSetup(page);
    expect(requested).toEqual([]);
    await loadDemo(page).click();
    await expectDemoOnTheTable(page);
    expect(requested.length).toBeGreaterThan(0);
  });

  test('a blocked chunk shows the error and leaves the session unchanged', async ({ page }) => {
    await page.route(/demoData/i, (route) => route.abort());
    await openSetup(page);
    await loadDemo(page).click();
    await expect(setup(page).getByText(/Couldn't load the demo\. Check your connection, then reload the page\./)).toBeVisible();
    await expect(setup(page)).toBeVisible();
    await expect(loadDemo(page)).toBeVisible();
    const results = await new AxeBuilder({ page }).include('dialog').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);
    await closeWith(page, setup(page), { focusOn: sessionButton(page) });
    await expect(header(page)).toContainText('Solo PvE');
    await expect(p1Pile(page)).toHaveAccessibleName(/0 cards|empty/);
  });

  test('two loads leave one copy of each demo layout, and an edited one is kept', async ({ page }) => {
    await openSetup(page);
    await loadDemo(page).click();
    await expectDemoOnTheTable(page);
    await expect.poll(async () => Object.keys(await stored(page, 'layout')).sort()).toEqual(['demo-action', 'demo-creature', 'demo-location']);
    await editStoredLayout(page, 'demo-creature', { orientation: 'landscape' });
    await page.reload();
    await expect(page.getByText('Loading your session…')).toHaveCount(0);

    await openSetup(page);
    await loadDemo(page).click();
    await confirm(page).getByRole('button', { name: 'Load demo' }).click();
    await expectDemoOnTheTable(page);
    // Wait for the late layout saves, then check nothing was added or overwritten.
    await page.waitForTimeout(1500);
    const layouts = await stored(page, 'layout');
    expect(Object.keys(layouts).sort()).toEqual(['demo-action', 'demo-creature', 'demo-location']);
    expect((layouts['demo-creature'] as { orientation: string }).orientation).toBe('landscape');
    expect(Object.keys(await stored(page, 'cardSet')).sort()).toEqual(['demo-emberguard', 'demo-harbour-board', 'demo-the-fog', 'demo-tidewardens']);
  });

  test('a reload keeps the session, layouts and art', async ({ page }) => {
    await openSetup(page);
    await loadDemo(page).click();
    await expectDemoOnTheTable(page);
    await boardCardToTable(page);
    await expect.poll(async () => (await storedSession(page))?.state.table.length).toBe(1);
    await expect.poll(async () => Object.keys(await stored(page, 'layout')).length).toBe(3);
    await expect.poll(async () => Object.keys(await stored(page, 'cardSet')).length).toBe(4);
    await page.reload();
    await expect(page.getByText('Loading your session…')).toHaveCount(0);
    await expect(header(page)).toContainText('Co-op PvE');
    await expect(page.getByRole('button', { name: /^P1 main deck, 30 cards/ })).toBeVisible();
    const image = table(page).locator('img.card-art').first();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  });
});

test.describe('DM-5 on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the dialog and the confirm step fit with the footer visible and no sideways scrolling', async ({ page }) => {
    await openSetup(page);
    await expect(loadDemo(page)).toBeVisible();
    await loadDemo(page).scrollIntoViewIfNeeded();
    await expect(setup(page).getByRole('button', { name: 'Start session' })).toBeInViewport();
    const box = await setup(page).boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
    expect(box?.height).toBeLessThanOrEqual(667);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(await setup(page).evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);

    await loadDemo(page).click();
    await expectDemoOnTheTable(page);
    await openSetup(page);
    await loadDemo(page).click();
    await expect(confirm(page)).toBeVisible();
    await expect(confirm(page).getByRole('button', { name: 'Back' })).toBeInViewport();
    await expect(confirm(page).getByRole('button', { name: 'Load demo' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
