/**
 * Whether the main pointer is a finger. Focusing a text field there slides the
 * on-screen keyboard up, so dialogs focus a button instead (owner rule).
 */
export function touchScreen(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}
