import { expect, test, type Locator, type Page } from '@playwright/test';

const style = { size: 10, weight: 700, align: 'left', valign: 'top', font: 'sans', color: '#1e1c1a', background: '#e3e7ee' };
const hero = {
  id: 'l-hero',
  name: 'Hero',
  orientation: 'portrait',
  boxes: [
    { id: 'title', x: 0, y: 0, width: 100, height: 20, content: { kind: 'text', text: 'Hero frame' }, style },
    { id: 'name', x: 0, y: 40, width: 100, height: 20, content: { kind: 'column', columns: ['name'], as: 'text' }, style },
  ],
  updatedAt: '2026-10-27T00:00:00.000Z',
  version: 1,
};
const location = { ...hero, id: 'l-location', name: 'Location', orientation: 'landscape' };

/** Saves a layout item straight into IndexedDB, where the app's storage keeps it (PS-7 keys). */
async function seedLayout(page: Page, layout: typeof hero = hero) {
  await page.evaluate(
    (item) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(item, `/proxy/|guest|layout|${item.id}`);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    layout,
  );
}

const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });

/** Loads a two-card CSV (by default Troll naming the Hero layout and Goblin naming none) and puts both cards on the table. */
async function bothOnTable(page: Page, csv = 'name,layout\nTroll,Hero\nGoblin,\n') {
  await mainPile(page).click({ button: 'right' });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles({ name: 'deck.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Done' }).click();
  await mainPile(page).focus();
  await page.keyboard.press('v');
  const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
  for (let i = 0; i < 2; i++) await viewer.getByRole('button', { name: /^To table/ }).first().click();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
}

const face = (page: Page, label: string) => table(page).locator(`.card-face[aria-label="${label}"]`);

test.describe('LY-8 and PS-1 stored layouts', () => {
  test('a stored layout draws table cards and is still there after a reload', async ({ page }) => {
    await page.goto('./');
    await seedLayout(page);
    await page.reload();
    await bothOnTable(page);
    await expect(face(page, 'Hero frame. Troll')).toBeVisible();
    await expect(face(page, 'Goblin')).toBeVisible();

    // Sessions aren't saved until Phase 7, so load the deck again; the layout is saved.
    await page.reload();
    await bothOnTable(page);
    await expect(face(page, 'Hero frame. Troll')).toBeVisible();
  });
});

test.describe('LY-8 stored layouts on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('draws the stored layout without sideways scrolling', async ({ page }) => {
    await page.goto('./');
    await seedLayout(page);
    await page.reload();
    await bothOnTable(page);
    await expect(face(page, 'Hero frame. Troll')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

/** Where an element is on screen; it must be showing. */
async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error('Not showing');
  return found;
}

test.describe('TT-9 landscape layouts', () => {
  const csv = 'name,layout\nHarbour,Location\nGoblin,\n';

  test('a landscape card reads sideways on the table and upright when enlarged', async ({ page }) => {
    await page.goto('./');
    await seedLayout(page, location);
    await page.reload();
    await bothOnTable(page, csv);
    const onTable = await box(face(page, 'Hero frame. Harbour'));
    expect(onTable.width).toBeLessThan(onTable.height);
    // The text runs up the card: its box is taller than it is wide.
    const title = await box(table(page).getByText('Hero frame'));
    expect(title.height).toBeGreaterThan(title.width);

    await table(page).getByRole('button', { name: 'Harbour', exact: true }).focus();
    await page.keyboard.press('i');
    const preview = page.getByRole('dialog', { name: 'Enlarged: Harbour' });
    const enlarged = await box(preview.locator('.card-face'));
    expect(enlarged.width).toBeGreaterThan(enlarged.height);
    const upright = await box(preview.getByText('Hero frame'));
    expect(upright.width).toBeGreaterThan(upright.height);
    await page.keyboard.press('Escape');
    await expect(table(page).getByRole('button', { name: 'Harbour', exact: true })).toBeFocused();
  });
});

test.describe('TT-9 landscape layouts on a phone', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('the enlarged landscape card fits without sideways scrolling', async ({ page }) => {
    await page.goto('./');
    await seedLayout(page, location);
    await page.reload();
    await bothOnTable(page, 'name,layout\nHarbour,Location\nGoblin,\n');
    await table(page).getByRole('button', { name: 'Harbour', exact: true }).focus();
    // On a narrow screen focus scrolls the table, and a table scroll closes the preview, so let it land first.
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.keyboard.press('i');
    const preview = await box(page.getByRole('dialog', { name: 'Enlarged: Harbour' }));
    expect(preview.x).toBeGreaterThanOrEqual(0);
    expect(preview.x + preview.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

const rulesStyle = { ...style, size: 14, weight: 400 };
const rulesBox = { id: 'rules', x: 0, y: 50, width: 100, height: 20, content: { kind: 'column', columns: ['rules'], as: 'text' }, style: rulesStyle };
const rulesLayout = (id: string, orientation: 'portrait' | 'landscape') => ({ ...hero, id, name: id, orientation, boxes: [hero.boxes[1], rulesBox] });
const someRules = 'Draw two cards, then discard a card. Each opponent loses 1 life.';
const tooManyRules = Array(30).fill('Then do it again.').join(' ');

/** A text box's font size in points: its CSS px over the card's px per point. */
const fontPt = (box: Locator) =>
  box.evaluate((el) => parseFloat(getComputedStyle(el).fontSize) / parseFloat(getComputedStyle(el).getPropertyValue('--card-pt')));
/** Whether a text box's text is cut off at the bottom or side. */
const cutOff = (box: Locator) => box.evaluate((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);

test.describe('LY-4 shrink-to-fit', () => {
  test('long text shrinks to fit, and too much text clips at 6 pt', async ({ page }) => {
    await page.goto('./');
    await seedLayout(page, rulesLayout('Rules', 'portrait'));
    await page.reload();
    await bothOnTable(page, `name,layout,rules\nTroll,Rules,"${someRules}"\nGoblin,Rules,"${tooManyRules}"\n`);

    const shrunk = table(page).locator('.card-face__box--text', { hasText: someRules });
    await expect(shrunk).toHaveAttribute('data-fit', 'shrunk');
    expect(await fontPt(shrunk)).toBeLessThan(14);
    expect(await fontPt(shrunk)).toBeGreaterThan(6);
    expect(await cutOff(shrunk)).toBe(false);

    const clipped = table(page).locator('.card-face__box--text', { hasText: tooManyRules });
    await expect(clipped).toHaveAttribute('data-fit', 'clipped');
    expect(await fontPt(clipped)).toBeCloseTo(6, 1);
    expect(await cutOff(clipped)).toBe(true);

    // The name still fits at its set size.
    await expect(table(page).locator('.card-face__box--text', { hasText: /^Troll$/ })).not.toHaveAttribute('data-fit');
  });

  test('a landscape card shrinks its text on the table and in the enlarged preview', async ({ page }) => {
    await page.goto('./');
    await seedLayout(page, rulesLayout('Wide', 'landscape'));
    await page.reload();
    await bothOnTable(page, `name,layout,rules\nHarbour,Wide,"${someRules} ${someRules}"\nGoblin,\n`);

    const onTable = table(page).locator('.card-face__box--text', { hasText: someRules });
    await expect(onTable).toHaveAttribute('data-fit', 'shrunk');
    expect(await cutOff(onTable)).toBe(false);

    await table(page).getByRole('button', { name: 'Harbour', exact: true }).focus();
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.keyboard.press('i');
    const enlarged = page.getByRole('dialog', { name: 'Enlarged: Harbour' }).locator('.card-face__box--text', { hasText: someRules });
    await expect(enlarged).toHaveAttribute('data-fit', 'shrunk');
    expect(await cutOff(enlarged)).toBe(false);
    // Sizes are points on the card, so the fit is about the same at both widths.
    expect(Math.abs((await fontPt(enlarged)) - (await fontPt(onTable)))).toBeLessThan(1);
  });
});

test.describe('LY-4 shrink-to-fit on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('shrunk text fits without sideways scrolling', async ({ page }) => {
    await page.goto('./');
    await seedLayout(page, rulesLayout('Rules', 'portrait'));
    await page.reload();
    await bothOnTable(page, `name,layout,rules\nTroll,Rules,"${someRules}"\nGoblin,\n`);
    const shrunk = table(page).locator('.card-face__box--text', { hasText: someRules });
    await expect(shrunk).toHaveAttribute('data-fit', 'shrunk');
    expect(await cutOff(shrunk)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
