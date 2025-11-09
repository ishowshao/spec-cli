# Repository Guidelines

## Project Structure & Module Organization
- Source lives in `src/`: `cli.ts` (entry), `commands/` (init, create, list, merge), `core/` (config, preflight, git, templates, logger), `adapters/llm/openai.ts`, `types.ts`.
- Tests are in `tests/` (Vitest). Example: `tests/create-command.test.ts`.
- Docs in `docs/`; feature docs are created in `docs/{slug}/`.
- Build output in `dist/` (ignored). Do not commit `dist/` or `node_modules/`.
- Key configs: `spec.config.json`, `eslint.config.js`, `vitest.config.ts`, `tsconfig.json`.

## Build, Test, and Development Commands
- `npm run dev -- <cmd>`: Run CLI from TS, e.g. `npm run dev -- init`.
- `npm run build`: Compile TypeScript to `dist/`.
- `npm test`: Run unit/integration tests.
- `npm run test:watch`: Watch mode.
- `npm run coverage`: Enforce 90% coverage thresholds.
- `npm run lint` / `npm run lint:fix`: ESLint check/fix.
- `npm run format` / `npm run format:check`: Prettier write/check.
- `npm run clean`: Remove `dist/`.

## Coding Style & Naming Conventions
- TypeScript ESM, Node ≥ 22. Strict TS, no bundler.
- Prettier: 4‑space indent, single quotes, no semicolons, width 120.
- ESLint: `@typescript-eslint` strict; console allowed in CLI.
- Names: kebab‑case slugs; branch format `feature-{slug}`; Types/Interfaces in PascalCase; files in kebab‑case `.ts`.

## Testing Guidelines
- Vitest + V8 coverage with 90% lines/branches/functions/statements (see `vitest.config.ts`).
- Place tests under `tests/` named `*.test.ts`.
- Prefer deterministic, unit‑first tests; mock LLM/network calls. Tests must not require `OPENAI_API_KEY`.

## Commit & Pull Request Guidelines
- Use Conventional Commits for every commit: types like `feat`, `fix`, `refactor`, `test`, `docs`, `chore` (optionally with a `scope`).
- Examples:
  - `feat(create): scaffold feature structure`
  - `fix(core/git): handle missing upstream hint`
- Typical workflow:
  - `git add -A`
  - `git commit -m "feat(<scope>): <summary>"`
  - `git push -u origin feature-{slug}` (never push directly to `main`)
- Open PRs from feature branches. Include: summary, linked issues, screenshots/logs when UI/CLI output matters, and a test plan.
- CI hygiene: run `npm run lint`, `npm run coverage`, and `npm run build` before pushing. Do not commit `dist/`, `node_modules/`, or secrets.

## Security & Configuration Tips
- Never commit secrets. Use env vars: `OPENAI_API_KEY` (required), `SPEC_OPENAI_MODEL`, `SPEC_LLM_TIMEOUT_MS`.
- Keep `spec.config.json` minimal and portable; scaffold paths must be relative and include `{slug}`.

## Agent‑Specific Instructions
- Scope: these rules apply to the entire repo.
- Make minimal, focused changes; avoid renames/restructures unless requested.
- Keep style consistent with existing code; do not add new tooling without discussion.
