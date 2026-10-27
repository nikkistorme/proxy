// Light or dark theme (A11Y-9). design/tokens.css switches its values on
// `data-theme="dark"` on <html>. V1 follows the system setting; the Settings
// screen will add a manual choice, which is why the preference is a parameter.

export type ThemePreference = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(preference: ThemePreference, systemDark: boolean): Theme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

/** Sets the theme on `root` now and whenever the system setting changes. Returns a clean-up. */
export function applyTheme(
  preference: ThemePreference = 'system',
  root: HTMLElement = document.documentElement,
  matchMedia: (query: string) => MediaQueryList = window.matchMedia.bind(window),
): () => void {
  const query = matchMedia(DARK_QUERY);
  const update = () => {
    root.dataset.theme = resolveTheme(preference, query.matches);
  };
  update();
  if (preference !== 'system') return () => {};
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
}
