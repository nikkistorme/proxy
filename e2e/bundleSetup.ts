import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export const csvFixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/csv/${name}`, import.meta.url));
export const bundleFixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/bundles/${name}`, import.meta.url));

const stamp = { updatedAt: '2026-10-29T00:00:00.000Z', version: 1 };
const style = { size: 10, weight: 700, align: 'left', valign: 'top', font: 'sans', color: '#1e1c1a', background: '#e3e7ee' };

/** A saved layout, a saved format and the account settings, as the app stores them. */
const items = [
  {
    kind: 'layout',
    item: {
      id: 'l-hero',
      name: 'Hero',
      orientation: 'portrait',
      boxes: [{ id: 'title', x: 0, y: 0, width: 100, height: 20, content: { kind: 'text', text: 'Hero frame' }, style }],
      ...stamp,
    },
  },
  {
    kind: 'format',
    item: {
      id: 'f-duel',
      name: 'Duel night',
      seats: [
        { id: 'seat-a', name: 'Alice', kind: 'player', counters: [] },
        { id: 'seat-b', name: 'Bruno', kind: 'player', counters: [] },
      ],
      piles: [{ id: 'pile-a', name: 'Alice deck', ownerSeatId: 'seat-a' }],
      usesDice: false,
      ...stamp,
    },
  },
  { kind: 'settings', item: { id: 'account', options: { theme: 'dark', defaultLayout: 'l-hero' }, ...stamp } },
];

/** Saves items straight into IndexedDB, where the app's storage keeps them (PS-7 keys). */
async function seed(page: Page) {
  await page.evaluate(
    (entries) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          for (const { kind, item } of entries) tx.objectStore('keyval').put(item, `/proxy/|guest|${kind}|${item.id}`);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    items,
  );
}

/** How many items of each kind are stored, by key (PS-7). */
export async function storedKinds(page: Page): Promise<Record<string, number>> {
  return page.evaluate(
    () =>
      new Promise<Record<string, number>>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction('keyval').objectStore('keyval').getAllKeys();
          request.onsuccess = () => {
            const counts: Record<string, number> = {};
            for (const key of request.result) {
              const kind = String(key).split('|')[2];
              if (kind) counts[kind] = (counts[kind] ?? 0) + 1;
            }
            open.result.close();
            resolve(counts);
          };
          request.onerror = () => reject(request.error);
        };
      }),
  );
}

export const sessionButton = (page: Page) => page.getByRole('button', { name: 'This session' });
export const mainPile = (page: Page) => page.getByRole('button', { name: /^P1 main deck,/ });

/** Opens a This session item with the keyboard. */
export async function chooseByKeyboard(page: Page, name: string) {
  // A late focus return from a closed dialog can take the focus back, so try until the menu is open.
  await expect(async () => {
    await page.keyboard.press('Escape');
    await sessionButton(page).focus();
    await expect(sessionButton(page)).toBeFocused({ timeout: 500 });
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByRole('menuitem', { name }).focus();
  await page.keyboard.press('Enter');
}

/**
 * Something of every kind to export: a layout, a format and settings (seeded),
 * a card set and a drawn card (basic.csv), and a snapshot.
 */
export async function prepareData(page: Page) {
  await page.goto('./');
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
  await seed(page);
  await page.reload();
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
  await mainPile(page).click({ button: 'right' });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles(csvFixture('basic.csv'));
  await page.getByRole('dialog', { name: 'Import results' }).getByRole('button', { name: 'Done' }).click();
  await mainPile(page).focus();
  await page.keyboard.press('d');
  await chooseByKeyboard(page, 'Save snapshot…');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Saved snapshot Snapshot 1.');
}

/** Exports the session by keyboard and returns the downloaded file's name and path. */
export async function exportByKeyboard(page: Page) {
  const download = page.waitForEvent('download');
  await chooseByKeyboard(page, 'Export session…');
  const file = await download;
  // Saved under its own name, so the import dialog names the file the way a person's download would.
  const name = file.suggestedFilename();
  const path = test.info().outputPath(name);
  await file.saveAs(path);
  return { name, path };
}
