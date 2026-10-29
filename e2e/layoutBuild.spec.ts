import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { tabTo } from './keyboard';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// A tiny inline image, so the art box draws real art without a network call. The `ability` column is one the built-in layout doesn't show.
const art =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22%3E%3Crect width=%2210%22 height=%2210%22 fill=%22%238e9db6%22/%3E%3C/svg%3E';
const csv = `name,cost,ability,image\nTroll,3,Regenerates at night.,"${art}"\n`;

/** The four boxes the issue asks for (QA-5): where each ends up, and what it shows. */
const built = [
  { x: 4, y: 12, width: 92, height: 42, content: { kind: 'column', columns: ['image'], as: 'image' } },
  { x: 4, y: 2, width: 76, height: 8, content: { kind: 'column', columns: ['name'], as: 'text' } },
  { x: 82, y: 2, width: 14, height: 8, content: { kind: 'column', columns: ['cost'], as: 'text' }, label: 'Cost' },
  { x: 4, y: 58, width: 92, height: 38, content: { kind: 'column', columns: ['ability'], as: 'text' } },
];

const editor = (page: Page) => page.getByRole('dialog', { name: 'Card layouts' });
const layoutsButton = (page: Page) => page.getByRole('button', { name: 'Card layouts (L)' });
const boxes = (page: Page) => page.getByRole('group', { name: 'Boxes on Layout 1' });
const panel = (page: Page) => editor(page).getByRole('region', { name: /properties$/ });
const choices = (page: Page) => editor(page).getByRole('region', { name: 'Choosing layouts' });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
/** Troll as the built layout draws it: the ability only shows there. */
const builtTroll = (page: Page) => table(page).locator('.card-face[aria-label="Troll. Cost 3. Regenerates at night."]');

/** The saved layouts' boxes in IndexedDB (PS-7 keys). */
function savedBoxes(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction('keyval').objectStore('keyval').getAll();
          request.onsuccess = () => {
            open.result.close();
            resolve((request.result as { boxes?: unknown[] }[]).flatMap((item) => item.boxes ?? []));
          };
          request.onerror = () => reject(request.error);
        };
      }),
  );
}

/** Troll loaded into P1's main deck and put on the table, drawn with the built-in layout. */
async function setUp(page: Page) {
  await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
  const mainPile = page.getByRole('button', { name: /^P1 main deck,/ });
  await mainPile.click({ button: 'right' });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
  await (await chooser).setFiles({ name: 'deck.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Done' }).click();
  await mainPile.focus();
  await page.keyboard.press('v');
  const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
  await viewer.getByRole('button', { name: /^To table/ }).click();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(table(page).locator('.card-face[aria-label="Troll. Cost 3"]')).toBeVisible();
}

async function press(page: Page, key: string, times: number) {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
}

/** The table's Troll is drawn with the built layout, art included. */
async function expectBuiltOnTable(page: Page) {
  await expect(builtTroll(page)).toBeVisible();
  await expect(builtTroll(page).locator('img')).toHaveAttribute('src', art);
  await expect.poll(() => savedBoxes(page)).toEqual(built.map((box) => expect.objectContaining(box)));
}

test.describe('QA-5 build a layout', () => {
  test('builds a layout with art, name, cost and rules-text boxes by keyboard only', async ({ page }) => {
    await setUp(page);
    await layoutsButton(page).focus();
    await page.keyboard.press('l');
    await expect(page.getByRole('button', { name: 'New layout' })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Edit Layout 1' })).toBeFocused();
    await page.keyboard.press('Enter');
    const add = page.getByRole('button', { name: 'Add box' });
    await expect(add).toBeFocused();

    /**
     * Adds a box at 30%, 40%, 40% wide and 20% tall, shapes it with arrow keys (each a 2% grid step),
     * then sets what it shows: `up` presses from Fixed text reach Column as image (1) or Column as text (2).
     */
    async function addBox(n: number, keys: [string, number][], up: number, column: string, label?: string) {
      if (!(await add.evaluate((el) => el === document.activeElement))) await tabTo(page, add, { backwards: true, max: 40 });
      await page.keyboard.press('Enter');
      const box = boxes(page).getByRole('button', { name: new RegExp(`^Box ${n}, empty,`) });
      await expect(box).toBeFocused();
      for (const [key, times] of keys) await press(page, key, times);
      // On past the other boxes and the preview's buttons into the panel, the checked kind first.
      await tabTo(page, panel(page).getByRole('radio', { name: 'Fixed text' }));
      await press(page, 'ArrowUp', up);
      await page.keyboard.press('Tab');
      await expect(panel(page).getByRole('combobox', { name: 'Column' })).toBeFocused();
      await page.keyboard.type(column);
      if (label) {
        await page.keyboard.press('Tab');
        await expect(panel(page).getByRole('textbox', { name: 'Spoken label' })).toBeFocused();
        await page.keyboard.type(label);
      }
    }

    // Moves before growing, and shrinks before moving, so no box is held back by the card's edge.
    await addBox(
      1,
      [
        ['ArrowLeft', 13],
        ['ArrowUp', 14],
        ['Shift+ArrowRight', 26],
        ['Shift+ArrowDown', 11],
      ],
      1,
      'image',
    );
    await addBox(
      2,
      [
        ['ArrowLeft', 13],
        ['ArrowUp', 19],
        ['Shift+ArrowRight', 18],
        ['Shift+ArrowUp', 6],
      ],
      2,
      'name',
    );
    await addBox(
      3,
      [
        ['Shift+ArrowLeft', 13],
        ['Shift+ArrowUp', 6],
        ['ArrowRight', 26],
        ['ArrowUp', 19],
      ],
      2,
      'cost',
      'Cost',
    );
    await addBox(
      4,
      [
        ['ArrowLeft', 13],
        ['ArrowDown', 9],
        ['Shift+ArrowRight', 26],
        ['Shift+ArrowDown', 9],
      ],
      2,
      'ability',
    );
    await expect(boxes(page).getByRole('button', { name: 'Box 3, shows cost, at 82% across, 2% down, 14% wide, 8% tall' })).toBeVisible();
    // The canvas previews Troll, the loaded card.
    await expect(editor(page).locator('.layout-canvas__card').getByText('Regenerates at night.')).toBeVisible();

    // Back to the list, and make it the default layout so the table uses it.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Edit Layout 1' })).toBeFocused();
    const picker = choices(page).getByRole('combobox', { name: 'Default layout' });
    await tabTo(page, picker);
    await page.keyboard.type('L');
    await expect(editor(page).getByRole('status')).toHaveText('Cards with no other layout use Layout 1.');
    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeHidden();
    await expectBuiltOnTable(page);
  });

  test('builds the same layout by mouse, with no axe violations', async ({ page }) => {
    await setUp(page);
    await layoutsButton(page).click();
    await page.getByRole('button', { name: 'New layout' }).click();
    await page.getByRole('button', { name: 'Edit Layout 1' }).click();
    const overlay = await boxes(page).boundingBox();
    if (!overlay) throw new Error('No canvas');
    const at = (x: number, y: number) => [overlay.x + (overlay.width * x) / 100, overlay.y + (overlay.height * y) / 100] as const;

    for (const [index, box] of built.entries()) {
      // Drawn from the bottom-right corner up, so the cost box doesn't start on the name box's resize handle.
      await page.mouse.move(...at(box.x + box.width, box.y + box.height));
      await page.mouse.down();
      await page.mouse.move(...at(box.x + box.width / 2, box.y + box.height / 2), { steps: 4 });
      await page.mouse.move(...at(box.x, box.y), { steps: 4 });
      await page.mouse.up();
      await expect(page.getByRole('heading', { name: `Box ${index + 1} properties` })).toBeVisible();
      await panel(page)
        .getByRole('radio', { name: box.content.as === 'image' ? 'Column as image' : 'Column as text' })
        .click();
      await panel(page)
        .getByRole('combobox', { name: 'Column' })
        .fill(box.content.columns[0] ?? '');
      if (box.label) await panel(page).getByRole('textbox', { name: 'Spoken label' }).fill(box.label);
    }
    await expect(editor(page).locator('.layout-canvas__card').getByText('Regenerates at night.')).toBeVisible();

    const results = await new AxeBuilder({ page }).include('.layout-editor').withTags(axeTags).analyze();
    expect(results.violations).toEqual([]);

    await editor(page).getByRole('button', { name: 'Back to layouts' }).click();
    await choices(page).getByRole('combobox', { name: 'Default layout' }).selectOption('Layout 1');
    await editor(page).getByRole('button', { name: 'Back to table' }).click();
    await expectBuiltOnTable(page);
  });
});
