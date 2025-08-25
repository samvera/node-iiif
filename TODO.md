# TypeScript Type Cleanup TODO

Goal: eliminate or minimize explicit `any` casts while keeping runtime behavior unchanged. Tackle in small PRs, running `CI=1 npm test` and `npm run build` after each step.

## Checklist
- [x] Centralize shared types: add `src/types.ts` with `Dimensions`, `BoundingBox`, `Format`, `Quality`, `MaxDimensions`; start replacing ad‑hoc shapes in core files.
- [x] Define module contracts: add `src/contracts.ts` (`VersionModule`, `CalculatorLike`, `Calculated`, `InfoDocInput`, `InfoDoc`, `CalculatorCtor`) and apply in `src/versions.ts`, `src/transform.ts`, and `src/processor.ts`.
- [x] Tighten `processor.ts`: add explicit fields, type resolvers and options, remove many `(this as any)` casts, and type `operations()`/`infoJson()` paths.
- [x] Tighten `transform.ts`: type calculator/module/format/region and replace broad casts with narrow `// @ts-expect-error` where Sharp lacks types.
- [ ] Tighten calculators: type `_canonicalInfo`, `_parsedInfo`, `opts.max`; align `info()` with `Calculated`; reduce `any` in `src/calculator/base.ts`.
- [x] Type v2/v3 info: `infoDoc` args/returns using `InfoDocInput`/`InfoDoc`; keep `Set`→array conversion typed.
- [x] Config guardrails: add `tsconfig.strict.json` with `noImplicitAny` + `strictNullChecks` and npm scripts `typecheck` / `typecheck:strict`; later enable `@typescript-eslint/no-explicit-any` to `warn`.
- [ ] Sweep remaining `any` usages in smaller PRs across files and tests.

Notes
- Prefer `// @ts-expect-error <reason>` over `any` where library types are missing (e.g., Sharp TIFF metadata options).
- Keep public API types aligned with `types/*.d.ts`. Update those once internals are fully typed.
