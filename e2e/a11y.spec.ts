import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeWith } from './keyboard';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.route('https://example.test/**', (route) => route.abort());
  await page.goto('./');
  // The app can't be used until the saved session has been read (PS-2).
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
});

const sessionButton = (page: Page) => page.getByRole('button', { name: 'This session' });
const table = (page: Page) => page.getByRole('group', { name: /^Table, / });
const pile = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name},`) });
const handCards = (page: Page) => page.getByRole('list', { name: /^Player 1's hand/ }).getByRole('button');
const overlays = (page: Page) => page.locator('dialog[open], [role="menu"]');
const scrollTableHome = (page: Page) => page.locator('.table-viewport').evaluate((el) => el.scrollTo(0, 0));

async function openSessionItem(page: Page, item: string) {
  await sessionButton(page).click();
  await page.getByRole('menuitem', { name: item }).click();
}

/** The demo game (DM-5): four piles, Co-op PvE, with focus on the table. */
async function loadDemo(page: Page) {
  await openSessionItem(page, 'New session…');
  await page.getByRole('dialog', { name: 'New session' }).getByRole('button', { name: 'Load demo' }).click();
  await expect(page.getByRole('dialog', { name: 'New session' })).toHaveCount(0);
  await expect(pile(page, 'Board cards')).toBeVisible();
}

/** Puts the top `count` cards of a pile on the table, then draws one to Player 1's hand. */
async function filledTable(page: Page, count = 3) {
  await loadDemo(page);
  await pile(page, 'Board cards').focus();
  await page.keyboard.press('v');
  const viewer = page.getByRole('dialog', { name: 'Board cards' });
  for (let i = 0; i < count; i++) await viewer.getByRole('button', { name: /^To table/ }).first().click();
  await closeWith(page, viewer);
  await page.getByRole('button', { name: 'Draw' }).click();
  await expect(handCards(page)).toHaveCount(1);
}

/** The first card (not pile) on the table. */
const firstTableCard = (page: Page) => page.locator('.table-card__button').first();

/** Right-clicks something on the table; axe scrolls the table while it checks, so put it back first. */
async function rightClick(page: Page, target: Locator) {
  await scrollTableHome(page);
  await target.click({ button: 'right' });
}

/** Every screen that A11Y-8 and A11Y-9 scan, reached from a filled table. */
const SCREENS: { name: string; open: (page: Page) => Promise<void> }[] = [
  { name: 'main screen', open: async () => {} },
  { name: 'This session menu', open: (page) => sessionButton(page).click() },
  { name: 'New session', open: (page) => openSessionItem(page, 'New session…') },
  { name: 'Save snapshot', open: (page) => openSessionItem(page, 'Save snapshot…') },
  { name: 'Snapshots', open: (page) => openSessionItem(page, 'Snapshots…') },
  { name: 'Session log', open: (page) => openSessionItem(page, 'Session log') },
  { name: 'Dice & coins', open: (page) => page.getByRole('button', { name: 'Dice & coins' }).click() },
  { name: 'Keyboard shortcuts', open: (page) => page.getByRole('button', { name: 'Keyboard shortcuts (?)' }).click() },
  { name: 'Add pile', open: (page) => page.getByRole('button', { name: 'Add pile' }).click() },
  { name: 'pile menu', open: (page) => rightClick(page, pile(page, 'P1 main deck')) },
  ...['Peek at top cards…', 'Draw cards…', 'View cards…', 'Load from URL…', 'Rename…'].map((item) => ({
    name: `pile menu: ${item}`,
    open: async (page: Page) => {
      await rightClick(page, pile(page, 'P1 main deck'));
      await page.getByRole('menuitem', { name: item }).click();
    },
  })),
  { name: 'card menu', open: (page) => rightClick(page, firstTableCard(page)) },
  ...['Counters…', 'Move to…', 'Details…'].map((item) => ({
    name: `card menu: ${item}`,
    open: async (page: Page) => {
      await rightClick(page, firstTableCard(page));
      await page.getByRole('menuitem', { name: item }).click();
    },
  })),
  { name: 'hand card menu', open: (page) => handCards(page).first().click({ button: 'right' }) },
  ...['Move to…', 'Details…'].map((item) => ({
    name: `hand card menu: ${item}`,
    open: async (page: Page) => {
      await handCards(page).first().click({ button: 'right' });
      await page.getByRole('menuitem', { name: item }).click();
    },
  })),
];

/** Opens each screen in turn, runs `check`, and closes it again. */
async function eachScreen(page: Page, check: (name: string) => Promise<void>, only?: string[]) {
  await filledTable(page);
  for (const screen of SCREENS.filter((s) => !only || only.includes(s.name))) {
    await screen.open(page);
    if (screen.name !== 'main screen') await expect(overlays(page).first()).toBeVisible();
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    await check(screen.name);
    if (screen.name !== 'main screen') {
      // Two Escapes cover a dialog opened from a menu that is already closed.
      await page.keyboard.press('Escape');
      if ((await overlays(page).count()) > 0) await page.keyboard.press('Escape');
      await expect(overlays(page)).toHaveCount(0);
    }
  }
}

/** The rendered colour of a CSS value, as [r, g, b], read through a probe element. */
const luminance = ([r, g, b]: number[]) => {
  const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

interface FocusReport {
  name: string;
  visible: boolean;
  covered: boolean;
  focusVisible: boolean;
  inner: number[];
  outer: number[];
  around: number[];
}

/** What the focused element looks like to a keyboard user: is it hit-testable, and which ring colours sit around it. */
function focusReport(page: Page): Promise<FocusReport> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const rgb = (value: string) => (value.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
    const probe = (variable: string) => {
      const p = document.createElement('span');
      p.style.color = `var(${variable})`;
      document.body.append(p);
      const colour = getComputedStyle(p).color;
      p.remove();
      return rgb(colour);
    };
    let around = rgb(getComputedStyle(document.body).backgroundColor);
    for (let node = el.parentElement; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      const alpha = bg.startsWith('rgba') ? Number(bg.split(',')[3]?.replace(')', '')) : 1;
      if (alpha > 0.9) {
        around = rgb(bg);
        break;
      }
    }
    const box = el.getBoundingClientRect();
    const xs = [0.1, 0.5, 0.9];
    let inViewport = 0;
    let hit = 0;
    for (const fx of xs)
      for (const fy of xs) {
        const x = box.left + box.width * fx;
        const y = box.top + box.height * fy;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        inViewport++;
        const top = document.elementFromPoint(x, y);
        if (top && el.contains(top)) hit++;
      }
    return {
      name: `${el.tagName.toLowerCase()}.${el.className} ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40)}`,
      visible: inViewport > 0,
      covered: hit === 0,
      focusVisible: el.matches(':focus-visible'),
      inner: probe('--focus-inner'),
      outer: probe('--focus-outer'),
      around,
    };
  });
}

/** A11Y-7: not fully covered, and the double ring is readable against what's around it. */
function expectFocusSeen(report: FocusReport, where: string) {
  const label = `${where}: ${report.name}`;
  expect(report.visible, `${label} is on screen`).toBe(true);
  expect(report.covered, `${label} is covered`).toBe(false);
  expect(report.focusVisible, `${label} shows :focus-visible`).toBe(true);
  // The ring is a 2px light line inside a 3px dark one (design/tokens.css), so the two always contrast
  // with each other, and at least one of them has to stand out from the surface around the element.
  expect(ratio(report.inner, report.outer), `${label}: inner against outer ring`).toBeGreaterThanOrEqual(3);
  const best = Math.max(ratio(report.inner, report.around), ratio(report.outer, report.around));
  expect(best, `${label}: ring against its surroundings`).toBeGreaterThanOrEqual(3);
}

/** Tabs from the header's first control until focus comes back to it, reporting each stop. */
async function tabAround(page: Page, where: string) {
  const first = page.getByRole('banner').getByRole('button').first();
  await first.focus();
  const seen = new Set<string>();
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab');
    // Past the last control, focus leaves the page.
    if (await page.evaluate(() => document.activeElement === document.body)) break;
    const report = await focusReport(page);
    expectFocusSeen(report, where);
    if (seen.has(report.name) && (await first.evaluate((el) => el === document.activeElement))) break;
    seen.add(report.name);
  }
  return seen;
}

/**
 * Focuses a table item the way a keyboard user arrives: Firefox only treats focus moved by the app as a
 * keyboard focus (:focus-visible) when the focus before it came from the keyboard.
 */
async function focusByKeyboard(page: Page, target: Locator) {
  await target.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
}

/** Moves a table card down with Shift+Down until it sits just above the hand tray. */
async function placeNearTray(page: Page) {
  await focusByKeyboard(page, firstTableCard(page));
  await page.keyboard.press('Space');
  const outline = page.getByRole('button', { name: /^Placing / });
  await expect(outline).toBeFocused();
  const trayTop = await page.locator('.hand-tray').evaluate((el) => el.getBoundingClientRect().top);
  for (let i = 0; i < 20; i++) {
    const bottom = await outline.evaluate((el) => el.getBoundingClientRect().bottom);
    if (bottom > trayTop - 40) break;
    await page.keyboard.press('Shift+ArrowDown');
  }
  await page.keyboard.press('Enter');
  await expect(outline).toHaveCount(0);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`A11Y-7 focus visible (${colorScheme})`, () => {
    test.use({ colorScheme });

    test('Tab reaches the header, table, hand and their cards with a ring that is never fully covered', async ({ page, browserName }) => {
      // Local WebKit tabs to fewer controls than Chromium (Open problems); CI's WebKit runs this.
      test.skip(browserName === 'webkit' && !process.env.CI, 'Local WebKit tab order differs');
      await filledTable(page);
      await placeNearTray(page);
      await page.locator('.table-surface').focus();
      const stops = await tabAround(page, 'Tab');
      expect(stops.size).toBeGreaterThan(10);

      // Every card and pile on the table, which Tab reaches one stop at a time and arrows reach the rest.
      const items = table(page).getByRole('button');
      const count = await items.count();
      expect(count).toBeGreaterThanOrEqual(7);
      for (let i = 0; i < count; i++) {
        await items.nth(i).focus();
        expectFocusSeen(await focusReport(page), 'table');
      }
      for (let i = 0; i < (await handCards(page).count()); i++) {
        await handCards(page).nth(i).focus();
        expectFocusSeen(await focusReport(page), 'hand');
      }
    });

    test('the placement bar and a toast do not cover the focused card or pile', async ({ page }) => {
      await filledTable(page);
      await placeNearTray(page);
      // Placement bar: stays up while the card is focused.
      await focusByKeyboard(page, firstTableCard(page));
      await page.keyboard.press('Space');
      await expect(page.getByRole('group', { name: /^Placing / })).toBeVisible();
      expectFocusSeen(await focusReport(page), 'placing');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('group', { name: /^Placing / })).toHaveCount(0);

      // Toast: delete a card so the Undo toast shows, then walk every table item.
      const second = page.locator('.table-card__button').nth(1);
      await second.focus();
      await page.keyboard.press('Delete');
      await expect(page.locator('.toast')).toBeVisible();
      const items = table(page).getByRole('button');
      for (let i = 0; i < (await items.count()); i++) {
        await items.nth(i).focus();
        expectFocusSeen(await focusReport(page), 'with a toast');
      }
    });
  });
}

test.describe('A11Y-8 target size', () => {
  // Known exceptions, written into A11Y-8: table overlays (the Actions button, counter pills) shrink with the
  // table's zoom below 100%, and overlapping box buttons on the layout canvas. Neither is on a screen scanned
  // here, which is all at default zoom, so nothing is excluded.
  test('axe target-size finds nothing on the main screen, each dialog and each menu', async ({ page }) => {
    test.slow(); // about 25 screens, each opened and scanned
    await eachScreen(page, async (name) => {
      await scrollTableHome(page);
      const results = await new AxeBuilder({ page }).withRules(['target-size']).analyze();
      expect(results.violations, name).toEqual([]);
    });
  });
});

test.describe('A11Y-9 contrast (light)', () => {
  // dark-theme.spec.ts scans the same kinds of screen in dark; this is the light counterpart over the demo table.
  test.use({ colorScheme: 'light' });

  test('axe color-contrast finds nothing on the main screen, each dialog and each menu', async ({ page }) => {
    test.slow(); // about 25 screens, each opened and scanned
    await eachScreen(page, async (name) => {
      await scrollTableHome(page);
      const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(results.violations, name).toEqual([]);
    });
  });
});

test.describe('A11Y-9 contrast (dark, demo table)', () => {
  test.use({ colorScheme: 'dark' });

  test('the demo table and its dialogs pass axe in dark as well', async ({ page }) => {
    test.slow(); // about 25 screens, each opened and scanned
    await eachScreen(
      page,
      async (name) => {
        await scrollTableHome(page);
        const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
        expect(results.violations, name).toEqual([]);
      },
      ['main screen', 'New session', 'Dice & coins', 'pile menu', 'card menu', 'hand card menu'],
    );
  });
});

test.describe('A11Y-10 reduced motion', () => {
  const running = (page: Page) => page.evaluate(() => document.getAnimations().map((a) => a.id || (a as CSSAnimation).animationName || a.constructor.name));
  /** Elements that have a transition or an animation, which reduced motion must switch off. */
  const motionStyles = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .map((el) => ({ el, style: getComputedStyle(el) }))
        .filter(({ style }) => parseFloat(style.transitionDuration) > 0 || (style.animationName !== 'none' && parseFloat(style.animationDuration) > 0))
        .map(({ el, style }) => `${el.className || el.tagName}: ${style.animationName} ${style.animationDuration} / ${style.transitionDuration}`),
    );

  test.describe('on', () => {
    test.use({ reducedMotion: 'reduce' });

    test('a draw, flip, shuffle, move, seat counter, dice roll and the pile viewer run nothing', async ({ page }) => {
      await filledTable(page);
      const settled = async (step: string) => {
        expect(await running(page), step).toEqual([]);
        expect(await motionStyles(page), step).toEqual([]);
      };
      await page.getByRole('button', { name: 'Draw' }).click();
      await settled('draw');

      await firstTableCard(page).focus();
      await page.keyboard.press('f');
      await settled('flip');

      await rightClick(page, pile(page, 'P1 main deck'));
      await page.getByRole('menuitem', { name: 'Shuffle' }).click();
      await settled('shuffle');

      await pile(page, 'P1 main deck').focus();
      await page.keyboard.press('v');
      const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
      await expect(viewer).toBeVisible();
      await settled('pile viewer open');
      await viewer.getByRole('button', { name: /^To table/ }).first().click();
      await settled('move to the table');
      await closeWith(page, viewer);

      await page.getByRole('button', { name: 'Increase Player 1 Energy' }).click();
      await expect(page.getByRole('group', { name: 'Player 1 Energy' })).toContainText('1');
      await settled('seat counter');

      await page.getByRole('button', { name: 'Dice & coins' }).click();
      await page.getByRole('button', { name: 'Roll d6' }).click();
      await expect(page.locator('.dice__value')).toBeVisible();
      await settled('dice roll');
    });
  });

  test.describe('off', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('the seat counter still fades on a change, so the rule above is what stops it', async ({ page }) => {
      await page.getByRole('button', { name: 'Increase Player 1 Energy' }).click();
      const value = page.locator('.seat-counter__value--changed');
      await expect(value).toBeVisible();
      expect(await value.evaluate((el) => getComputedStyle(el).animationName)).toBe('seat-counter-changed');
    });
  });
});

for (const size of [
  { width: 640, height: 400 }, // 200% browser zoom of 1280 × 800
  { width: 320, height: 568 },
]) {
  test.describe(`A11Y-11 zoom and reflow at ${size.width} × ${size.height}`, () => {
    test.use({ viewport: size });

    const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    test('the page does not scroll sideways and every header control can be reached', async ({ page, browserName }) => {
      test.skip(browserName === 'webkit' && !process.env.CI, 'Local WebKit tab order differs');
      await filledTable(page);
      expect(await noSidewaysScroll(page)).toBeLessThanOrEqual(0);

      const controls = page.getByRole('banner').getByRole('button');
      const total = await controls.count();
      expect(total).toBeGreaterThanOrEqual(11);
      await controls.first().focus();
      const reached = new Set<string>();
      for (let i = 0; i < total; i++) {
        const where = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const box = el.getBoundingClientRect();
          return {
            name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
            inHeader: !!el.closest('header'),
            inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
          };
        });
        expect(where.inHeader, `focus left the header at stop ${i}`).toBe(true);
        expect(where.inside, `${where.name} is inside the viewport`).toBe(true);
        reached.add(where.name);
        await page.keyboard.press('Tab');
      }
      expect(reached.size).toBe(total);
      expect(await noSidewaysScroll(page)).toBeLessThanOrEqual(0);
    });

    test('the setup dialog, pile viewer, Move dialog and Snapshots dialog fit with their footer buttons visible', async ({ page }) => {
      await filledTable(page);
      const fits = async (dialog: Locator, footer: Locator) => {
        await expect(dialog).toBeVisible();
        const box = await dialog.boundingBox();
        expect(box?.width).toBeLessThanOrEqual(size.width + 1);
        expect(box?.height).toBeLessThanOrEqual(size.height);
        await expect(footer).toBeInViewport({ ratio: 1 });
        expect(await noSidewaysScroll(page)).toBeLessThanOrEqual(0);
        expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
      };

      await openSessionItem(page, 'New session…');
      const setup = page.getByRole('dialog', { name: 'New session' });
      await fits(setup, setup.getByRole('button', { name: 'Start session' }));
      await closeWith(page, setup, { focusOn: sessionButton(page) });

      await openSessionItem(page, 'Snapshots…');
      const snapshots = page.getByRole('dialog', { name: 'Snapshots' });
      await fits(snapshots, snapshots.getByRole('button', { name: 'Done' }));
      await closeWith(page, snapshots, { focusOn: sessionButton(page) });

      await pile(page, 'P1 main deck').focus();
      await page.keyboard.press('v');
      const viewer = page.getByRole('dialog', { name: 'P1 main deck' });
      await fits(viewer, viewer.locator('.pile-viewer__footer button').last());
      await closeWith(page, viewer);

      await handCards(page).first().click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Move to…' }).click();
      const move = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /^Cancel$/ }) });
      await fits(move, move.getByRole('button', { name: 'Cancel' }));
    });
  });
}
