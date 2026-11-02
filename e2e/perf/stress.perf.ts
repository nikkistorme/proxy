import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { bundleFixture, chooseByKeyboard, csvFixture } from '../bundleSetup';

/**
 * The Performance budgets on the stress table (8d, #171): INP on table actions, the
 * frame rate while dragging one card, and a 200-row CSV import. Run with
 * `npm run test:perf`; results go to the console and `test-results/perf-<rate>x.json`,
 * and are recorded by hand in `docs/performance.md`.
 */

/** "Mid-range laptop" is 2× CPU slowdown (docs/performance.md); 4× shows the headroom. */
const RATES = [1, 2, 4] as const;
const REPEATS = 5;

declare global {
  interface Window {
    __perf: {
      events: { name: string; duration: number; interactionId: number }[];
      csvStart?: number;
    };
  }
}

/** Collects Event Timing entries for interactions (INP), and when a CSV file is chosen. */
function installObservers() {
  window.__perf = { events: [] };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceEventTiming[]) {
      if (entry.interactionId) window.__perf.events.push({ name: entry.name, duration: entry.duration, interactionId: entry.interactionId });
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  document.addEventListener(
    'change',
    (event) => {
      if ((event.target as HTMLInputElement).type === 'file') window.__perf.csvStart = performance.now();
    },
    true,
  );
}

/** Lets two frames paint, so the observer has every entry for what just happened. */
async function settle(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50)))));
}

/**
 * Runs `act` and returns its worst interaction's duration in ms. Entries under 16 ms
 * aren't reported, so 16 means "16 or less".
 */
async function worstInteraction(page: Page, act: () => Promise<void>): Promise<number> {
  await page.evaluate(() => (window.__perf.events = []));
  await act();
  await settle(page);
  const events = await page.evaluate(() => window.__perf.events);
  const byInteraction = new Map<number, number>();
  for (const e of events) byInteraction.set(e.interactionId, Math.max(byInteraction.get(e.interactionId) ?? 0, e.duration));
  return Math.max(16, ...byInteraction.values());
}

const tableCards = (page: Page) => page.locator('.table-card__button');

/** Focuses the nth table card, in DOM (stacking) order, without an interaction of its own. */
async function focusCard(page: Page, index: number) {
  await tableCards(page).nth(index).focus();
}

async function importStressTable(page: Page) {
  await page.addInitScript(installObservers);
  await page.goto('./');
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
  const chooser = page.waitForEvent('filechooser');
  await chooseByKeyboard(page, 'Import bundle…');
  await (await chooser).setFiles(bundleFixture('stress.json'));
  await page.getByRole('dialog', { name: 'Import stress.json?' }).getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText('Loading your session…')).toHaveCount(0);
  await expect(page.getByRole('group', { name: /^Table, 80 cards, 4 piles/ })).toBeVisible();
  // Let art load and the import's work finish before measuring.
  await page.waitForLoadState('networkidle');
  await settle(page);
}

type Results = Record<string, number | string>;

for (const rate of RATES) {
  test(`stress table at ${rate}× CPU slowdown`, async ({ page }) => {
    await importStressTable(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const results: Results = { rate: `${rate}×` };
    const record = (name: string, samples: number[]) => {
      results[`${name} (worst ms)`] = Math.max(...samples);
      results[`${name} (median ms)`] = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)] ?? 0;
    };

    // Draw: D draws the active seat's top card into the hand.
    const draws: number[] = [];
    for (let i = 0; i < REPEATS; i++) {
      await focusCard(page, 10);
      draws.push(await worstInteraction(page, () => page.keyboard.press('d')));
    }
    record('Draw', draws);

    const rotates: number[] = [];
    for (let i = 0; i < REPEATS; i++) {
      await focusCard(page, 20 + i);
      rotates.push(await worstInteraction(page, () => page.keyboard.press('r')));
    }
    record('Rotate', rotates);

    const flips: number[] = [];
    for (let i = 0; i < REPEATS; i++) {
      await focusCard(page, 30 + i);
      flips.push(await worstInteraction(page, () => page.keyboard.press('f')));
    }
    record('Flip', flips);

    // A keyboard move: Space picks the card up, arrows move the outline, Enter places it.
    const moves: number[] = [];
    for (let i = 0; i < REPEATS; i++) {
      await focusCard(page, 40 + i);
      moves.push(
        await worstInteraction(page, async () => {
          await page.keyboard.press(' ');
          await expect(page.locator('.table-placement')).toBeFocused();
          await page.keyboard.press('ArrowRight');
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');
          await expect(page.locator('.table-placement')).toHaveCount(0);
        }),
      );
    }
    record('Keyboard move', moves);

    const menus: number[] = [];
    for (let i = 0; i < REPEATS; i++) {
      await focusCard(page, 50 + i);
      menus.push(
        await worstInteraction(page, async () => {
          await page.keyboard.press('Enter');
          await expect(page.getByRole('menu')).toBeVisible();
        }),
      );
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);
    }
    record('Open card menu', menus);

    // Change a counter: card 3 carries a Damage counter (the stress fixture puts one on every 7th card from it).
    await focusCard(page, 3);
    await page.keyboard.press('c');
    const dialog = page.getByRole('dialog', { name: /counters/i });
    await expect(dialog).toBeVisible();
    const counters: number[] = [];
    for (let i = 0; i < REPEATS; i++) counters.push(await worstInteraction(page, () => dialog.getByRole('button', { name: 'Increase Damage' }).click()));
    record('Change counter', counters);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // Drag one table card across the table with the mouse for about two seconds, counting frames.
    // Card 11 is in the second row, on screen at 1440 × 900.
    const card = tableCards(page).nth(11);
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    if (!box) throw new Error('No card to drag');
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __lofs: number[]; __running: boolean };
      w.__frames = [];
      w.__lofs = [];
      w.__running = true;
      const tick = (t: number) => {
        w.__frames.push(t);
        if (w.__running) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      try {
        new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__lofs.push(e.duration))).observe({ type: 'long-animation-frame' });
      } catch {
        // Not every browser has long-animation-frame entries.
      }
    });
    // Past the drag threshold, so the card lifts and its ghost follows the pointer.
    await page.mouse.move(startX + 20, startY + 20);
    await expect(page.locator('.drag-ghost')).toHaveCount(1);
    await cdp.send('Performance.enable');
    const scriptMs = async () => ((await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'ScriptDuration')?.value ?? 0) * 1000;
    const scriptBefore = await scriptMs();
    const began = Date.now();
    let pointerMoves = 0;
    for (let step = 0; Date.now() - began < 2000; step++, pointerMoves++) {
      // Back and forth across the table, through other cards and empty table.
      const phase = (step % 120) / 120;
      const along = phase < 0.5 ? phase * 2 : 2 - phase * 2;
      await page.mouse.move(startX + along * 800, startY + along * 150);
    }
    const dragScript = (await scriptMs()) - scriptBefore;
    const frames = await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __lofs: number[]; __running: boolean };
      w.__running = false;
      const gaps = w.__frames.slice(1).map((t, i) => t - (w.__frames[i] ?? t));
      const elapsed = (w.__frames.at(-1) ?? 0) - (w.__frames[0] ?? 0);
      return { fps: ((w.__frames.length - 1) * 1000) / elapsed, worstGap: Math.max(...gaps), over20: gaps.filter((g) => g > 20).length, count: gaps.length, longFrames: w.__lofs.length };
    });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    results['Drag one card (fps)'] = Math.round(frames.fps * 10) / 10;
    results['Drag worst frame (ms)'] = Math.round(frames.worstGap);
    results['Drag frames over 20 ms'] = `${frames.over20} of ${frames.count}`;
    results['Drag long animation frames'] = frames.longFrames;
    results['Drag pointer moves sent'] = pointerMoves;
    // Main-thread script time over the drag: how much each pointer move costs.
    results['Drag script ms per move'] = Math.round((dragScript / pointerMoves) * 100) / 100;

    // 200-row CSV into the empty Board cards pile, timed from choosing the file to the count showing. Undo empties it again.
    const board = page.getByRole('button', { name: /^Board cards,/ });
    const imports: number[] = [];
    for (let i = 0; i < 3; i++) {
      await board.click({ button: 'right' });
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('menuitem', { name: 'Load CSV…' }).click();
      await page.evaluate(() => {
        delete window.__perf.csvStart;
        const w = window as unknown as { __csvShown: Promise<number> };
        w.__csvShown = new Promise((resolve) => {
          const check = () => {
            const shown = [...document.querySelectorAll('button[aria-label^="Board cards,"]')].some((b) => /200 cards/.test(b.getAttribute('aria-label') ?? ''));
            if (shown && window.__perf.csvStart !== undefined) resolve(performance.now() - window.__perf.csvStart);
            else requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        });
      });
      await (await chooser).setFiles(csvFixture('two-hundred-rows.csv'));
      imports.push(Math.round(await page.evaluate(() => (window as unknown as { __csvShown: Promise<number> }).__csvShown)));
      await page.getByRole('dialog', { name: 'Import results' }).getByRole('button', { name: 'Done' }).click();
      await focusCard(page, 0);
      await page.keyboard.press('ControlOrMeta+z');
      await expect(board).toHaveAccessibleName(/0 cards/);
    }
    record('CSV import 200 rows', imports);

    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.table(results);
    mkdirSync('test-results', { recursive: true });
    writeFileSync(`test-results/perf-${rate}x.json`, `${JSON.stringify(results, null, 2)}\n`);
  });
}
