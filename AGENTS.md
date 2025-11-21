# Repository Guidelines

## Project Structure & Module Organization
- `src/` Node/Bun server (`server.ts`, `aiFiller.ts`, TypeScript types). Entry is `src/server.ts`.
- `frontend/` React + Vite SPA (main UI lives in `frontend/src/App.tsx`, shared pieces under `frontend/src/components` and `frontend/src/lib`).
- `data/templates.json` Static template catalog consumed by both API and UI; edit carefully to keep valid JSON.
- `public/` Built frontend assets for production; `scripts/` helper scripts (e.g., `prepare-assets.js`, deploy).
- `e2e/` Playwright specs (default: `basic.spec.ts`). `playwright.config.ts` at repo root.

## Build, Test, and Development Commands
- Install deps: `bun install` (root) — runs `postinstall` to prepare assets.
- Dev server (API + Vite middleware): `bun dev` (hot reload frontend via Vite).
- Production run: `bun start` (serves `public` build; set `NODE_ENV=production` implicitly).
- Build frontend assets: `bun run build` (runs `frontend` Vite build into `public/`).
- End-to-end tests (UI runner): `bun run test:e2e` (starts Playwright UI); headless: `bunx --bun playwright test`.
- Prepare assets manually if needed: `bun run prepare-assets`.

## Coding Style & Naming Conventions
- Language: TypeScript/JS (server) and React TSX (frontend).
- Follow existing style: 2-space indentation, single quotes, semicolons, and concise comments only when clarifying intent.
- File naming: components in `PascalCase`, shared utilities in `camelCase`. Keep JSON keys snake_case as in templates.
- Avoid large formatting-only diffs; keep changes minimal and aligned with neighboring code.

## Testing Guidelines
- Framework: Playwright (`@playwright/test`). Specs live in `e2e/*.spec.ts`.
- Naming: describe behavior/user journeys (e.g., `template-loading`), assert visible text and rendered prompts.
- Before running tests, ensure dev server is available (or adjust Playwright config to launch it).
- Aim for fast, deterministic checks; prefer data from `data/templates.json` over network calls.

## Commit & Pull Request Guidelines
- Commits: use short, imperative subjects (e.g., “Add text2image reskin template”), group related changes. Avoid bundling unrelated refactors.
- PRs: include purpose, notable implementation choices, and test evidence (commands run + results). Add screenshots/GIFs for UI changes where helpful.
- Link relevant issues or tasks; call out data/schema changes (especially `data/templates.json`) so reviewers can re-validate.

## Security & Configuration Tips
- Do not commit secrets. AI completion uses `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_TEMPERATURE`; configure via env vars.
- Keep `data/templates.json` JSON-valid; schema drives UI controls and API responses. Validate with `node -e "JSON.parse(...)"` before pushing.
