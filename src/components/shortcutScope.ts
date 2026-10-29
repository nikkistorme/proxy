/**
 * A11Y-4 and WCAG 2.1.4 Character Key Shortcuts: page-wide single-key shortcuts
 * (D, S, ?, G, 0, + and −) work only while focus is in the table, the hand or the
 * table tools. Anywhere else, like the seat bar, the header or nowhere at all,
 * a stray key from speech input does nothing. Fields always keep their own keys.
 */
export function inShortcutScope(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, [contenteditable]')) return false;
  return target.closest('.session__main, .table-tools') !== null;
}
