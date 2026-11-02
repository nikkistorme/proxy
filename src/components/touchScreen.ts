/**
 * Whether the main pointer is a finger. Focusing a text field there slides the
 * on-screen keyboard up, so dialogs focus a button instead (owner rule).
 */
export function touchScreen(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

const KEYBOARD_INPUT_TYPES = new Set(['text', 'search', 'number', 'url', 'email', 'tel', 'password']);

/** Whether focusing this element opens the on-screen keyboard. */
export function isTextField(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return KEYBOARD_INPUT_TYPES.has(el.type) || !el.hasAttribute('type');
  return el instanceof HTMLElement && el.isContentEditable === true;
}
