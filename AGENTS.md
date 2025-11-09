# Repository Guidelines

## Project Structure & Module Organization
- `src/` TypeScript sources (ESM only).
  - `src/cli.ts` CLI entry.
  - `src/commands/` subcommands: `init`, `create`, `list`, `merge`.
  - `src/core/` utilities: config, preflight checks, git wrapper, templates, logger.
  - `src/adapters/llm/` LLM client (`openai.ts`).
- `docs/` product docs and specs (created feature docs live under `docs/<slug>/`).
- `dist/` build output from `tsc` (published binary: `bin.spec -> dist/cli.js`).

## Build, Test, and Development Commands
- `npm run dev` Run CLI from TS via `tsx` (example: `npm run dev -- init`).
- `npm run build` Type-check and compile to `dist/` via `tsc`.
- `npm test` Run unit tests with Vitest; `npm run test:watch` for watch mode.
- `npm run lint` Lint with ESLint; `npm run lint:fix` to autofix.
- `npm run format` Format with Prettier; `npm run format:check` to verify.
- `npm run clean` Remove `dist/`.

## Coding Style & Naming Conventions
- Language: TypeScript, strict mode, ESM (`"type": "module"`).
- Prettier: 4‑space indent, single quotes, no semicolons, width 120.
- Files: lowercase; use hyphens for multiword names (e.g., `preflight.ts`).
- Imports: prefer named exports; avoid default exports unless ergonomic.
- CLI output: use `@clack/prompts` logger helpers; keep messages concise.

## Testing Guidelines
- Framework: Vitest (`vitest.config.ts`, Node environment).
- Naming: `*.test.ts` in `tests/` or colocated next to sources.
- Example: `tests/create-command.test.ts`.
- Run: `npm test` (CI should run lint + test). Add `--coverage` locally if needed.

## Commit & Pull Request Guidelines
- Conventional Commits: `type(scope): summary`.
  - Types used in this repo: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.
  - Example: `feat(user-authentication): scaffold feature structure`.
- PRs should include:
  - Purpose and high‑level change list.
  - Screenshots or CLI output when relevant.
  - Linked issue(s) and breaking‑change notes.

## Security & Configuration Tips
- `OPENAI_API_KEY` required for `spec create`; do not commit keys.
- Optional: `OPENAI_BASE_URL`, `SPEC_OPENAI_MODEL`, `SPEC_LLM_TIMEOUT_MS`, `SPEC_LLM_MAX_ATTEMPTS`.
- Initialize a repo with `spec init` to generate `spec.config.json` (kept at repo root).

