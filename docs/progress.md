# Progress

## Current state

Phase 0 (scaffold and CI) is in review on branch `phase-0-scaffold`. No app features yet.

## Done

### Phase 0: Project scaffold and CI pipeline (2026-10-25)

- Vite 8 + React 18 + TypeScript 6 (strict, plus `noUncheckedIndexedAccess`). The app shell is a `<main>` with `<h1>Proxy</h1>`. Vite `base: '/proxy/'`.
- ESLint 9 flat config: `@eslint/js`, `typescript-eslint` strict, `react-hooks`, `jsx-a11y` strict (for `src/**/*.tsx`).
- Vitest 5 + Testing Library + jsdom, with v8 coverage (text, html, lcov). No thresholds yet. `src/App.test.tsx` covers the shell.
- Playwright: `e2e/smoke.spec.ts` checks the heading and runs an axe scan (WCAG 2.0/2.1/2.2 A and AA tags), expecting zero violations. It runs against `vite preview` of the production build. Locally it uses Chromium only; with `CI` set it uses Chromium, Firefox and WebKit. Trace and screenshot are kept on failure (QA-6).
- `.github/workflows/ci.yml` (pull requests and pushes to `main`) has two parts:
  - a `check` job: `npm ci`, typecheck, lint, `npm test` with coverage (uploaded as an artifact), build
  - an `e2e` matrix with one job per browser, which uploads `playwright-report/` and `test-results/` when it fails
- `.github/workflows/deploy.yml`: on push to `main`, builds and deploys `dist` to GitHub Pages.
- Node version is pinned in `.nvmrc` (22).
- CI verified on PR #1. All checks were green; the whole pipeline takes about 70 seconds. A deliberately broken E2E assertion turned all three browser checks red and uploaded `trace.zip` and `test-failed-1.png` for each. The break was then reverted.

## Next

- Merge the Phase 0 PR. Then the owner sets Settings → Pages → Source to **GitHub Actions** and adds branch protection on `main` requiring the CI checks:
  - `Typecheck, lint, unit tests, build`
  - `E2E + axe (chromium)`
  - `E2E + axe (firefox)`
  - `E2E + axe (webkit)`
- Confirm the site loads at https://nikkistorme.github.io/proxy/.
- Phase 1 (card data) once the owner gives the go-ahead. Add the QA-2 coverage thresholds then.

## Open problems

- The `gh` on this machine is the npm package `gh` (NodeGH), not the GitHub CLI. It can't open PRs or read CI. Install the real one with `brew install gh` and remove the npm one with `npm rm -g gh`.
- The app's PR monitor still shows an error cached from the old npm `gh`. CI was checked with the real `gh` instead.
- Local Node is 22.12.0. Some ESLint deps want ≥ 22.13 (this is an engine warning only). CI uses the latest Node 22.

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-25 | Phase 0 covers QA-6 and CI/CD steps 1, 2 and 5, not the "QA-2, CI/CD 1–4" in the requirements phase table | Coverage thresholds wait until Phase 1, when there's code to measure. Lighthouse CI is in Phase 7. PR previews (step 3) are still undecided. Branch protection (step 4) is an owner step. |
| 2026-10-25 | ESLint 9 and TypeScript 6 rather than the latest majors | `eslint-plugin-jsx-a11y` and `typescript-eslint` don't support ESLint 10 or TypeScript 7 yet. Revisit when they do. |
| 2026-10-25 | E2E runs against the production build (`vite preview`) | Matches the CI/CD requirement that E2E runs against the built app |
| 2026-10-25 | One CI job per browser for E2E | Runs in parallel and keeps each check under the 10-minute budget. Each browser shows as its own required check. |
| 2026-10-25 | E2E jobs run in the `mcr.microsoft.com/playwright` container, and `@playwright/test` is pinned to an exact version | `playwright install --with-deps webkit` took 12 minutes on a plain runner. The image tag must match the pinned version, so bump both together. |
