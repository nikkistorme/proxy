import { Dialog } from './Dialog';
import './ShortcutsDialog.css';

/** One row: the keys (each a combination, any of which works) and what they do. */
interface Shortcut {
  keys: string[];
  action: string;
}

interface Group {
  title: string;
  /** When the group's keys work, if that needs saying. */
  note?: string;
  shortcuts: Shortcut[];
}

// Keep in step with the key handlers: SessionScreen, TableTools, TableSurface and HandTray.
export const SHORTCUT_GROUPS: Group[] = [
  {
    title: 'Anywhere',
    shortcuts: [
      { keys: ['Ctrl+Z', '⌘+Z'], action: 'Undo' },
      { keys: ['Ctrl+Shift+Z', '⌘+Shift+Z', 'Ctrl+Y'], action: 'Redo' },
      { keys: ['Esc'], action: 'Close a menu or dialog' },
    ],
  },
  {
    title: 'Table, hand and toolbar',
    note: 'Single keys work while focus is in the table, the hand or the table tools.',
    shortcuts: [
      { keys: ['D'], action: 'Draw a card' },
      { keys: ['S'], action: 'Switch to the next seat' },
      { keys: ['Shift+S'], action: 'Switch to the previous seat' },
      { keys: ['?'], action: 'Show these shortcuts' },
      { keys: ['L'], action: 'Card layouts' },
      { keys: ['+', '−'], action: 'Zoom in or out' },
      { keys: ['0'], action: 'Fit all cards' },
      { keys: ['G'], action: 'Snap to grid on or off' },
      { keys: ['Shift+arrows'], action: 'Pan the table' },
    ],
  },
  {
    title: 'Card on the table',
    shortcuts: [
      { keys: ['Arrows'], action: 'Go to the next card or pile that way' },
      { keys: ['Enter', 'Shift+F10'], action: 'Open the card’s actions' },
      { keys: ['R'], action: 'Rotate 90° clockwise' },
      { keys: ['Shift+R'], action: 'Rotate 90° counter-clockwise' },
      { keys: ['F'], action: 'Flip' },
      { keys: ['Space'], action: 'Move on the table' },
      { keys: ['M'], action: 'Move to…' },
      { keys: ['C'], action: 'Counters…' },
      { keys: ['I'], action: 'Enlarge' },
      { keys: ['Ctrl+D', '⌘+D'], action: 'Duplicate' },
      { keys: ['Delete', 'Backspace'], action: 'Delete' },
      { keys: ['Esc'], action: 'Back to the table' },
    ],
  },
  {
    title: 'Pile',
    shortcuts: [
      { keys: ['Enter', 'Shift+F10'], action: 'Open the pile’s actions' },
      { keys: ['V'], action: 'View cards…' },
      { keys: ['Space'], action: 'Move on the table' },
      { keys: ['Esc'], action: 'Back to the table' },
    ],
  },
  {
    title: 'Moving on the table',
    note: 'After Space on a card or pile.',
    shortcuts: [
      { keys: ['Arrows'], action: 'Move a little' },
      { keys: ['Shift+arrows'], action: 'Move a card’s width' },
      { keys: ['Enter'], action: 'Place it' },
      { keys: ['Esc'], action: 'Cancel' },
    ],
  },
  {
    title: 'Card in the hand',
    shortcuts: [
      { keys: ['← →', 'Home', 'End'], action: 'Go to another card' },
      { keys: ['Shift+← →'], action: 'Move the card left or right' },
      { keys: ['Enter', 'Shift+F10'], action: 'Open the card’s actions' },
      { keys: ['P'], action: 'Play to the table' },
      { keys: ['M'], action: 'Move to…' },
    ],
  },
];

/** A11Y-4: the shortcut reference, opened with ? or the toolbar's Keyboard shortcuts button. */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} title="Keyboard shortcuts" width="medium" primaryLabel="Done" bodyLabel="Shortcuts" onClose={onClose}>
      {SHORTCUT_GROUPS.map((group) => (
        <section key={group.title} className="shortcuts__group" aria-labelledby={headingId(group.title)}>
          <h3 id={headingId(group.title)} className="shortcuts__title">
            {group.title}
          </h3>
          {group.note && <p className="shortcuts__note">{group.note}</p>}
          <dl className="shortcuts__list">
            {group.shortcuts.map((shortcut) => (
              <div key={shortcut.action} className="shortcuts__row">
                <dt className="shortcuts__keys">
                  {shortcut.keys.map((key, index) => (
                    <span key={key}>
                      {index > 0 && <span className="shortcuts__or"> or </span>}
                      <kbd className="shortcuts__kbd">{key}</kbd>
                    </span>
                  ))}
                </dt>
                <dd className="shortcuts__action">{shortcut.action}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Dialog>
  );
}

function headingId(title: string) {
  return `shortcuts-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
}
