# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Core library (e.g., `processor.js`, `transform.js`, `versions.js`, `v2/`, `v3/`, `calculator/`). Entry point: `src/index.js` (types in `types/`).
- `tests/`: Jest tests (`*.test.js`) organized by version (`tests/v2`, `tests/v3`) with fixtures in `tests/fixtures/`.
- `scripts/`: Helper scripts (notably `scripts/test.js` which runs Jest in watch mode locally).
- `examples/`: Sample integrations, e.g., `examples/tiny-iiif/`.

## Build, Test, and Development Commands
- `npm install`: Install dependencies (installs optional `sharp`).
- `npm test`: Run Jest (watches locally; CI disables watch).
- `npm test -- --coverage`: Generate coverage report in `coverage/`.
- `npm run lint`: Lint `src/**/*.js` with ESLint (Standard config).
- `npm run lint-fix`: Auto-fix lint issues where possible.
- `npm run clean`: Remove `node_modules/`, `vendor/`, and `coverage/`.

## Coding Style & Naming Conventions
- **Style**: JavaScript (ES2022), 2-space indent, semicolons, Standard-based rules (`.eslintrc`). Prefer `const`, no `var`, enforce object spacing, warn on high complexity.
- **Files**: Lowercase filenames with dashes or simple names (e.g., `processor.js`, `index.js`); tests end with `.test.js`.
- **Imports/Exports**: CommonJS (`require`, `module.exports`). Keep functions small; aim under 30 lines where practical (rule-enforced warning).

## Testing Guidelines
- **Framework**: Jest; place tests under `tests/` mirroring `src/` structure; name files `*.test.js`.
- **Running**: Use `npm test` for watch; add `--coverage` before pushing.
- **Expectations**: Maintain or improve coverage; include tests for new features and bug fixes; avoid network or external I/O—use fixtures/mocks. Debug test runs with `DEBUG=iiif-processor:*`.

## Commit & Pull Request Guidelines
- **Commits**: Short, imperative subjects (e.g., "Constrain region to image bounds", "Increase precision of scale factor calculation"). Group related changes.
- **PRs**: Provide a clear description, link issues, include tests, update README/types if APIs change, and ensure `npm run lint` and `npm test` pass. Follow `CONTRIBUTING.md` and the Samvera Code of Conduct.

## Security & Configuration Tips
- **Image engine**: `sharp` is an optional dependency but required at runtime for processing; ensure compatible Node LTS and native deps.
- **Debugging**: `DEBUG=iiif-processor:*` (or `iiif-processor:main`, `iiif-processor:transform`) enables verbose logs. Local S3 examples may use `process.env.tiffBucket`.

