/** The one place the demo chunk is imported, so it loads on first use (PF-3) and tests can swap it. */
export const loadDemoData = () => import('./demoData');
